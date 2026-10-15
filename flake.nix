{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f {
            inherit system;
            pkgs = nixpkgs.legacyPackages.${system};
            lib = nixpkgs.lib;
          }
        );
    in
    {
      devShells = forAllSystems (
        { pkgs, lib, ... }:
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              just
              git
              nixfmt
              # Rust toolchain (the host's rust install is partial; never rely on it).
              rustc
              cargo
              clippy
              rustfmt
              rust-analyzer
              # C toolchain: builds vendored SOEM (SOEM 2.0.0 requires CMake >= 3.28).
              cmake
              ninja
              gcc
              clang
              pkg-config
              llvmPackages.libclang
              # JS toolchain.
              nodejs
              pnpm
            ];

            buildInputs = lib.optionals pkgs.stdenv.isLinux (
              with pkgs;
              [
                # Tauri 2 / WebKitGTK 4.1 runtime and headers.
                webkitgtk_4_1
                libsoup_3
                gtk3
                gdk-pixbuf
                glib
                glib-networking
                gsettings-desktop-schemas
                at-spi2-atk
                cairo
                pango
                librsvg
                libGL
                libxkbcommon
                openssl
              ]
            );

            nativeBuildInputs = lib.optionals pkgs.stdenv.isLinux (with pkgs; [ wrapGAppsHook4 ]);

            # bindgen (crates/soem-sys) needs libclang and, on NixOS, explicit libc and GCC
            # builtin include paths — bindgen does not read NIX_CFLAGS_COMPILE.
            shellHook = ''
              export LIBCLANG_PATH="${pkgs.llvmPackages.libclang.lib}/lib"
            ''
            + lib.optionalString pkgs.stdenv.isLinux ''
              export BINDGEN_EXTRA_CLANG_ARGS="-isystem ${pkgs.stdenv.cc.libc.dev}/include -isystem $(gcc -print-file-name=include)"
              export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"
            '';
          };
        }
      );

      formatter = forAllSystems ({ pkgs, ... }: pkgs.nixfmt);
    };
}
