// Hex formatting with fixed width and zero-padding; the mask/pad expressions are not obvious at
// the call site, which is why these live here.

export function hex32(value: number): string {
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

export function hex16(value: number, width = 4): string {
  return `0x${(value & 0xffff).toString(16).toUpperCase().padStart(width, "0")}`;
}
