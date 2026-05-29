# AGENTS.md

## Project snapshot
- This repository is a packaged ACME crossassembler release, not a modern app scaffold.
- The shipped executable is `acme0.97mac/acme` (a prebuilt Mach-O binary); do not treat it as editable source.
- The only visible buildable source tree here is `acme0.97mac/contrib/toacme/src`, which builds the `toacme` converter.

## Where to look first
- `acme0.97mac/docs/QuickRef.txt` — primary assembler usage and syntax overview.
- `acme0.97mac/docs/AllPOs.txt` — pseudo-opcode reference; the canonical source for ACME directives.
- `acme0.97mac/docs/AddrModes.txt` — explains ACME’s addressing-mode selection rules.
- `acme0.97mac/docs/Upgrade.txt` — compatibility changes and `--dialect` behavior.
- `acme0.97mac/docs/Lib.txt` — how `ACME_Lib` lookup works with `!source` / `!binary`.
- `acme0.97mac/contrib/toacme/docs/README` — converter formats and verification guidance.

## Big-picture architecture
- ACME assembles 65xx-family code and ships its own platform-neutral docs plus a library tree in `acme0.97mac/ACME_Lib/`.
- Library assets are referenced from ACME sources with `<...>` quoting; `"..."` resolves from the current directory.
- ACME source files use the `.a` extension, and source paths inside files should use UNIX-style separators for portability.

## Build / workflow conventions
- Build the converter from `acme0.97mac/contrib/toacme/src` with `make`.
- The helper Makefile also supports `make install` and `make userinstall`.
- There is no repo-wide package manager or test runner in this tree; validation is mostly manual and doc-driven.

## Editing conventions that matter here
- Preserve ACME syntax examples exactly when changing docs: pseudo ops are prefixed with `!`, and examples often use tabs and column alignment intentionally.
- When compatibility behavior changes, update the relevant docs first/alongside code, especially `Upgrade.txt`.
- Addressing modes are sensitive to leading zeros and postfixes (`+1`, `+2`, `+3`); do not “simplify” examples that demonstrate that behavior.

## Validation habits
- For `toacme` changes, compare behavior against the format list documented in `contrib/toacme/docs/README` (`object`, `hypra`, `giga`, `vis`, `ab3`, `f8ab`, `prof`).
- For assembler docs/examples, use the example binaries referenced in `docs/Example.txt` as the behavioral baseline when available.
- If you touch library lookup or encoding behavior, re-check `docs/Lib.txt` and `docs/Help.txt` for the user-facing contract.

