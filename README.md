# prettier-plugin-acme

A Prettier plugin for ACME assembly sources (`*.asm`).

## What it does

- registers `*.asm` as an ACME source extension
- keeps ACME directives, labels, and comments readable
- normalizes indentation and comma spacing
- preserves quoted strings and semicolons inside them
- supports ACME-specific forms like anonymous labels (`+`, `++`, `---`) and force-bit symbol assignments (`label+3 = $ff`)
- aligns `=` in contiguous variable-assignment blocks by default

## Files of interest

- `index.js` — Prettier plugin entry point
- `parser.js` — AST parser for ACME source lines
- `printer.js` — AST printer/formatter logic
- `tests/acme-plugin.test.js` — node-based integration tests against Prettier
- `tests/fixtures.test.js` and `tests/fixtures/*.asm` — golden fixture tests (input/expected pairs)

## Usage

Install the plugin in a project that already uses Prettier 3:

```bash
npm install --save-dev /path/to/prettier-plugin-acme
```

Then format `*.asm` files with Prettier:

```bash
npx prettier --write src/example.asm --plugin prettier-plugin-acme
```

Or use the included `prettier.config.cjs` style:

```bash
npx prettier --write "**/*.asm"
```

A CommonJS `prettier.config.js` example is also included as `prettier.config.js`.

If your Prettier config loads plugins automatically, running Prettier on an `*.asm` file is enough.

## Options

- `acmeAlignAssignments` (default: `true`)
  - Aligns equal signs in contiguous blocks of variable assignments.
  - Set to `false` to keep normalized assignment spacing without block alignment.

- `acmeAlignAssignmentsMinLines` (default: `2`)
  - Minimum number of contiguous variable-assignment lines required before alignment is applied.
  - Example: set to `3` to only align blocks with 3 or more assignment lines.

Example `prettier.config.cjs` snippet:

```javascript
"use strict";

module.exports = {
  plugins: ["./index.js"],
  overrides: [
	{
	  files: "*.asm",
	  options: {
		parser: "acme",
		acmeAlignAssignments: false,
		acmeAlignAssignmentsMinLines: 2,
	  },
	},
  ],
};
```

## Notes

- The plugin now uses AST parsing (`Program` with typed line nodes) before printing.
- Expression-level AST nodes are also generated for assignments/operands (`ExpressionList`, `Expression`, `BinaryExpression`, `UnaryExpression`, etc.).
- Parser includes grouped expression forms for `(...)` and `[...]`, plus current-PC symbol expressions like `* + 2`.
- Unsupported expression forms are kept non-fatal: parser stores `parseError` while formatter remains stable.
- The formatter is conservative: it does not rewrite expressions or mnemonics.
- It is aimed at ACME-style assembly files, especially the `*.asm` files in this repo.
- Package metadata includes `exports` in `package.json` for modern Node/Prettier loading.

## Testing

Run both unit/integration and fixture golden tests:

```bash
npm test
```

