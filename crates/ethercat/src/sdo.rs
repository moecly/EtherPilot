//! Value <-> bytes conversion for SDO objects. Pure functions so they can be unit-tested without a
//! live master; the display format mirrors SOEM's `slaveinfo` sample (`SDO2string`).
//!
//! The EtherCAT wire format is little-endian for numeric types; strings are byte sequences.

use crate::error::EthercatError;
use crate::types::ValueFormat;
use soem_sys::*;

/// Lowercase, contiguous hex (wire order). Used for the raw `hex` field of `SdoValue` and process
/// data.
pub fn to_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// Nominal width in bytes for the fixed-width EtherCAT datatypes. `None` for strings, bit types and
/// unknown values (their length is data-dependent).
fn nominal_bytes(data_type: u16) -> Option<usize> {
    match data_type {
        x if x == ec_datatype_ECT_BOOLEAN as u16 => Some(1),
        x if x == ec_datatype_ECT_INTEGER8 as u16 => Some(1),
        x if x == ec_datatype_ECT_INTEGER16 as u16 => Some(2),
        x if x == ec_datatype_ECT_INTEGER24 as u16 => Some(3),
        x if x == ec_datatype_ECT_INTEGER32 as u16 => Some(4),
        x if x == ec_datatype_ECT_INTEGER64 as u16 => Some(8),
        x if x == ec_datatype_ECT_UNSIGNED8 as u16 => Some(1),
        x if x == ec_datatype_ECT_UNSIGNED16 as u16 => Some(2),
        x if x == ec_datatype_ECT_UNSIGNED24 as u16 => Some(3),
        x if x == ec_datatype_ECT_UNSIGNED32 as u16 => Some(4),
        x if x == ec_datatype_ECT_UNSIGNED64 as u16 => Some(8),
        x if x == ec_datatype_ECT_REAL32 as u16 => Some(4),
        x if x == ec_datatype_ECT_REAL64 as u16 => Some(8),
        _ => None,
    }
}

fn is_signed(data_type: u16) -> bool {
    matches!(
        data_type,
        x if x == ec_datatype_ECT_INTEGER8 as u16
            || x == ec_datatype_ECT_INTEGER16 as u16
            || x == ec_datatype_ECT_INTEGER24 as u16
            || x == ec_datatype_ECT_INTEGER32 as u16
            || x == ec_datatype_ECT_INTEGER64 as u16
    )
}

fn is_string(data_type: u16) -> bool {
    matches!(
        data_type,
        x if x == ec_datatype_ECT_VISIBLE_STRING as u16
            || x == ec_datatype_ECT_OCTET_STRING as u16
            || x == ec_datatype_ECT_UNICODE_STRING as u16
    )
}

/// Little-endian unsigned value from at most `width` bytes.
fn le_uint(bytes: &[u8], width: usize) -> u64 {
    let n = bytes.len().min(width);
    let mut v: u64 = 0;
    for b in bytes[..n].iter().rev() {
        v = (v << 8) | *b as u64;
    }
    v
}

/// Little-endian signed value, sign-extended from the actual byte length.
fn le_int(bytes: &[u8], width: usize) -> i128 {
    let n = bytes.len().min(width);
    if n == 0 {
        return 0;
    }
    let v = le_uint(bytes, width);
    let bits = n * 8;
    if bits < 64 && (v >> (bits - 1)) & 1 == 1 {
        v as i128 - (1i128 << bits)
    } else {
        v as i128
    }
}

fn fmt_unsigned(bytes: &[u8], width: usize) -> String {
    let v = le_uint(bytes, width);
    format!("0x{v:X} / {v}")
}

fn fmt_signed(bytes: &[u8], width: usize) -> String {
    let raw = le_uint(bytes, width);
    let v = le_int(bytes, width);
    format!("0x{raw:X} / {v}")
}

fn ascii(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|&b| {
            if (0x20..=0x7e).contains(&b) {
                b as char
            } else {
                '.'
            }
        })
        .collect()
}

fn utf16(bytes: &[u8]) -> String {
    let units: Vec<u16> = bytes
        .as_chunks::<2>()
        .0
        .iter()
        .map(|c| u16::from_le_bytes(*c))
        .collect();
    String::from_utf16_lossy(&units)
}

/// Decode raw SDO bytes into a human-readable string. Unknown types fall back to hex.
pub fn decode_value(data_type: u16, bytes: &[u8]) -> String {
    let d = data_type;
    match d {
        x if x == ec_datatype_ECT_BOOLEAN as u16 => {
            if bytes.first().copied().unwrap_or(0) != 0 {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        x if x == ec_datatype_ECT_INTEGER8 as u16 => fmt_signed(bytes, 1),
        x if x == ec_datatype_ECT_INTEGER16 as u16 => fmt_signed(bytes, 2),
        x if x == ec_datatype_ECT_INTEGER24 as u16 => fmt_signed(bytes, 3),
        x if x == ec_datatype_ECT_INTEGER32 as u16 => fmt_signed(bytes, 4),
        x if x == ec_datatype_ECT_INTEGER64 as u16 => fmt_signed(bytes, 8),
        x if x == ec_datatype_ECT_UNSIGNED8 as u16 => fmt_unsigned(bytes, 1),
        x if x == ec_datatype_ECT_UNSIGNED16 as u16 => fmt_unsigned(bytes, 2),
        x if x == ec_datatype_ECT_UNSIGNED24 as u16 => fmt_unsigned(bytes, 3),
        x if x == ec_datatype_ECT_UNSIGNED32 as u16 => fmt_unsigned(bytes, 4),
        x if x == ec_datatype_ECT_UNSIGNED64 as u16 => fmt_unsigned(bytes, 8),
        x if x == ec_datatype_ECT_REAL32 as u16 => {
            let v = f32::from_le_bytes([
                bytes.first().copied().unwrap_or(0),
                bytes.get(1).copied().unwrap_or(0),
                bytes.get(2).copied().unwrap_or(0),
                bytes.get(3).copied().unwrap_or(0),
            ]);
            format!("{v}")
        }
        x if x == ec_datatype_ECT_REAL64 as u16 => {
            let mut b = [0u8; 8];
            for (i, slot) in b.iter_mut().enumerate() {
                *slot = bytes.get(i).copied().unwrap_or(0);
            }
            format!("{}", f64::from_le_bytes(b))
        }
        x if x == ec_datatype_ECT_BIT1 as u16
            || x == ec_datatype_ECT_BIT2 as u16
            || x == ec_datatype_ECT_BIT3 as u16
            || x == ec_datatype_ECT_BIT4 as u16
            || x == ec_datatype_ECT_BIT5 as u16
            || x == ec_datatype_ECT_BIT6 as u16
            || x == ec_datatype_ECT_BIT7 as u16
            || x == ec_datatype_ECT_BIT8 as u16 =>
        {
            fmt_unsigned(bytes, 1)
        }
        x if x == ec_datatype_ECT_VISIBLE_STRING as u16
            || x == ec_datatype_ECT_OCTET_STRING as u16 =>
        {
            ascii(bytes)
        }
        x if x == ec_datatype_ECT_UNICODE_STRING as u16 => utf16(bytes),
        _ => to_hex(bytes),
    }
}

/// Encode a UI string into SDO bytes.
///
/// `text` is interpreted according to `format`:
/// - `Text`: raw UTF-8 bytes, only for string datatypes, bounded by `bit_length`.
/// - `Bool`: `true`/`false`/`1`/`0` (case-insensitive).
/// - `Dec`: decimal integer (or float for REAL types), range-checked against the type width.
/// - `Hex`: `0x`-prefixed or bare hex byte pairs; must match the fixed width for numeric types.
///
/// Unknown `data_type` only accepts `Hex` (arbitrary even length).
pub fn encode_value(
    data_type: u16,
    format: ValueFormat,
    text: &str,
    bit_length: u16,
) -> Result<Vec<u8>, EthercatError> {
    let width = nominal_bytes(data_type);
    match format {
        ValueFormat::Text => {
            if !is_string(data_type) {
                return Err(EthercatError::InvalidArgument(format!(
                    "text format requires a string datatype (got {data_type:#06X})"
                )));
            }
            let bytes = text.as_bytes().to_vec();
            let max = (bit_length as usize) / 8;
            if max > 0 && bytes.len() > max {
                return Err(EthercatError::InvalidArgument(format!(
                    "value is {} bytes, object holds at most {max}",
                    bytes.len()
                )));
            }
            Ok(bytes)
        }
        ValueFormat::Bool => {
            let v = match text.trim().to_ascii_lowercase().as_str() {
                "true" | "1" => 1u8,
                "false" | "0" => 0u8,
                other => {
                    return Err(EthercatError::InvalidArgument(format!(
                        "invalid boolean '{other}'"
                    )))
                }
            };
            Ok(vec![v])
        }
        ValueFormat::Dec => {
            let trimmed = text.trim();
            match data_type {
                x if x == ec_datatype_ECT_REAL32 as u16 => {
                    let v: f32 = trimmed.parse().map_err(|_| {
                        EthercatError::InvalidArgument(format!("invalid float '{trimmed}'"))
                    })?;
                    Ok(v.to_le_bytes().to_vec())
                }
                x if x == ec_datatype_ECT_REAL64 as u16 => {
                    let v: f64 = trimmed.parse().map_err(|_| {
                        EthercatError::InvalidArgument(format!("invalid float '{trimmed}'"))
                    })?;
                    Ok(v.to_le_bytes().to_vec())
                }
                _ => {
                    let width = width.ok_or_else(|| {
                        EthercatError::InvalidArgument(
                            "decimal format needs a numeric datatype".to_string(),
                        )
                    })?;
                    let v: i128 = trimmed.parse().map_err(|_| {
                        EthercatError::InvalidArgument(format!("invalid integer '{trimmed}'"))
                    })?;
                    let bits = width * 8;
                    let (lo, hi) = if is_signed(data_type) {
                        (-(1i128 << (bits - 1)), (1i128 << (bits - 1)) - 1)
                    } else {
                        (0, (1i128 << bits) - 1)
                    };
                    if v < lo || v > hi {
                        return Err(EthercatError::InvalidArgument(format!(
                            "value {v} out of range for a {bits}-bit {}",
                            if is_signed(data_type) {
                                "signed"
                            } else {
                                "unsigned"
                            }
                        )));
                    }
                    Ok(v.to_le_bytes()[..width].to_vec())
                }
            }
        }
        ValueFormat::Hex => {
            let bytes = parse_hex(text)?;
            if let Some(w) = width {
                if bytes.len() != w {
                    return Err(EthercatError::InvalidArgument(format!(
                        "expected {w} hex bytes, got {}",
                        bytes.len()
                    )));
                }
            } else if data_type != 0 && !is_string(data_type) {
                return Err(EthercatError::InvalidArgument(
                    "hex format for this object needs a known fixed width".to_string(),
                ));
            }
            Ok(bytes)
        }
    }
}

/// Parse hex input: optional `0x` prefix, whitespace and separators ignored. Must be even length.
pub fn parse_hex(text: &str) -> Result<Vec<u8>, EthercatError> {
    let cleaned: String = text
        .trim()
        .trim_start_matches("0x")
        .trim_start_matches("0X")
        .chars()
        .filter(|c| !c.is_whitespace() && *c != ':' && *c != '-')
        .collect();
    if !cleaned.len().is_multiple_of(2) {
        return Err(EthercatError::InvalidArgument(format!(
            "hex string '{text}' has an odd number of digits"
        )));
    }
    let mut out = Vec::with_capacity(cleaned.len() / 2);
    for pair in cleaned.as_bytes().chunks(2) {
        let s = std::str::from_utf8(pair).unwrap();
        let b = u8::from_str_radix(s, 16)
            .map_err(|_| EthercatError::InvalidArgument(format!("invalid hex '{s}'")))?;
        out.push(b);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(ty: u16) -> u16 {
        ty
    }

    #[test]
    fn encode_decode_roundtrip_all_types() {
        // Integer types: encode a known decimal, decode, and check the numeric suffix.
        let cases: &[(u16, i64, &str)] = &[
            (d(ec_datatype_ECT_INTEGER8 as u16), 42, "/ 42"),
            (d(ec_datatype_ECT_INTEGER16 as u16), 1000, "/ 1000"),
            (d(ec_datatype_ECT_INTEGER32 as u16), 100_000, "/ 100000"),
            (d(ec_datatype_ECT_UNSIGNED8 as u16), 200, "/ 200"),
            (d(ec_datatype_ECT_UNSIGNED16 as u16), 60000, "/ 60000"),
            (
                d(ec_datatype_ECT_UNSIGNED32 as u16),
                4_000_000_000,
                "/ 4000000000",
            ),
        ];
        for (ty, val, suffix) in cases {
            let bytes = encode_value(*ty, ValueFormat::Dec, &val.to_string(), 0).unwrap();
            let decoded = decode_value(*ty, &bytes);
            assert!(decoded.ends_with(suffix), "{ty:#06X}: {decoded}");
        }

        // Negative signed value round-trips.
        let bytes =
            encode_value(ec_datatype_ECT_INTEGER16 as u16, ValueFormat::Dec, "-5", 0).unwrap();
        assert_eq!(bytes, vec![0xfb, 0xff]);
        assert_eq!(
            decode_value(ec_datatype_ECT_INTEGER16 as u16, &bytes),
            "0xFFFB / -5"
        );

        // Boolean.
        let t = encode_value(ec_datatype_ECT_BOOLEAN as u16, ValueFormat::Bool, "true", 0).unwrap();
        assert_eq!(t, vec![1]);
        assert_eq!(decode_value(ec_datatype_ECT_BOOLEAN as u16, &t), "true");

        // Real.
        let r = encode_value(ec_datatype_ECT_REAL32 as u16, ValueFormat::Dec, "1.5", 0).unwrap();
        assert_eq!(decode_value(ec_datatype_ECT_REAL32 as u16, &r), "1.5");

        // Visible string.
        let s = encode_value(
            ec_datatype_ECT_VISIBLE_STRING as u16,
            ValueFormat::Text,
            "Drive",
            40 * 8,
        )
        .unwrap();
        assert_eq!(s, b"Drive");
        assert_eq!(
            decode_value(ec_datatype_ECT_VISIBLE_STRING as u16, &s),
            "Drive"
        );

        // Hex round-trip for a fixed-width type.
        let h = encode_value(
            ec_datatype_ECT_UNSIGNED32 as u16,
            ValueFormat::Hex,
            "0x01020304",
            0,
        )
        .unwrap();
        assert_eq!(h, vec![1, 2, 3, 4]);
    }

    #[test]
    fn encode_rejects_bad_hex() {
        let ty = ec_datatype_ECT_UNSIGNED32 as u16;
        assert!(matches!(
            encode_value(ty, ValueFormat::Hex, "0xZZ", 0),
            Err(EthercatError::InvalidArgument(_))
        ));
        assert!(matches!(
            encode_value(ty, ValueFormat::Hex, "0x0102", 0),
            Err(EthercatError::InvalidArgument(_))
        ));
        assert!(matches!(
            encode_value(ty, ValueFormat::Dec, "not-a-number", 0),
            Err(EthercatError::InvalidArgument(_))
        ));
        // Decimal out of range for an 8-bit unsigned.
        assert!(matches!(
            encode_value(ec_datatype_ECT_UNSIGNED8 as u16, ValueFormat::Dec, "300", 0),
            Err(EthercatError::InvalidArgument(_))
        ));
    }

    #[test]
    fn decode_string_masks_non_printable() {
        let ty = ec_datatype_ECT_OCTET_STRING as u16;
        assert_eq!(decode_value(ty, &[b'A', 0x00, 0x7f, b'Z']), "A..Z");
        // Unknown datatype falls back to raw hex.
        assert_eq!(decode_value(0x9999, &[0xde, 0xad]), "dead");
    }

    #[test]
    fn hex_parse_tolerates_separators() {
        assert_eq!(
            parse_hex("0xDE AD:BE-EF").unwrap(),
            vec![0xde, 0xad, 0xbe, 0xef]
        );
    }
}
