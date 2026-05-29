"use strict";

const { parseAcme } = require("./parser");
const { printProgram } = require("./printer");

const ACME_AST_FORMAT = "acme-asm";

function parse(text) {
  return parseAcme(text);
}

function print(path, options) {
  const node = path.getValue();
  if (!node || node.type !== "Program") {
    return "";
  }
  return printProgram(node, options);
}

const parsers = {
  acme: {
    astFormat: ACME_AST_FORMAT,
    parse,
    locStart() {
      return 0;
    },
    locEnd(node) {
      return typeof node.sourceLength === "number" ? node.sourceLength : 0;
    },
  },
};

const printers = {
  [ACME_AST_FORMAT]: {
    print,
  },
};

const languages = [
  {
    name: "ACME Assembly",
    parsers: ["acme"],
    filenames: [],
    extensions: [".asm", ".a"],
    linguistLanguageId: 219,
    vscodeLanguageIds: ["asm"],
  },
];

const options = {
  acmeAlignAssignments: {
    type: "boolean",
    category: "ACME",
    default: true,
    description: "Align equal signs for contiguous blocks of variable assignment lines.",
  },
  acmeAlignAssignmentsMinLines: {
    type: "int",
    category: "ACME",
    default: 2,
    description: "Minimum number of consecutive variable-assignment lines required before equal-sign alignment is applied.",
  },
};

module.exports = {
  languages,
  parsers,
  printers,
  options,
};

