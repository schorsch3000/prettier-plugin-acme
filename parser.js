"use strict";

const MNEMONICS = new Set([
  "adc", "and", "asl", "bcc", "bcs", "beq", "bit", "bmi", "bne", "bpl", "brk", "bvc", "bvs", "clc", "cld", "cli",
  "clv", "cmp", "cpx", "cpy", "dec", "dex", "dey", "eor", "inc", "inx", "iny", "jmp", "jsr", "lda", "ldx", "ldy",
  "lsr", "nop", "ora", "pha", "php", "pla", "plp", "rol", "ror", "rti", "rts", "sbc", "sec", "sed", "sei", "sta",
  "stx", "sty", "tax", "tay", "tsx", "txa", "txs", "tya", "ahx", "alr", "anc", "ane", "arr", "asr", "axs", "bbr0",
  "bbr1", "bbr2", "bbr3", "bbr4", "bbr5", "bbr6", "bbr7", "bbs0", "bbs1", "bbs2", "bbs3", "bbs4", "bbs5", "bbs6",
  "bbs7", "bra", "brl", "dea", "dcp", "ina", "isc", "kil", "las", "lax", "lxa", "mvn", "mvp", "pea", "pei", "phb",
  "phd", "phk", "phx", "plb", "pld", "plx", "per", "rep", "rla", "rmb0", "rmb1", "rmb2", "rmb3", "rmb4", "rmb5",
  "rmb6", "rmb7", "rra", "sax", "sbx", "sep", "sha", "shx", "shy", "slo", "smb0", "smb1", "smb2", "smb3", "smb4",
  "smb5", "smb6", "smb7", "sre", "stp", "stz", "tas", "trb", "tsb", "wai", "xaa", "xba", "xce", "rtl", "rtn", "cop",
]);

const IDENT_RE = /^[A-Za-z_.$@][A-Za-z0-9_.$@]*$/;
const POSTFIX_RE = /^(?<name>[A-Za-z_.$@][A-Za-z0-9_.$@]*?)(?:\+(?<force>[123]))?$/;
const SYMBOL_ASSIGN_RE = /^(?<name>[A-Za-z_.$@][A-Za-z0-9_.$@]*)(?:\+(?<force>[123]))?$/;

const WORD_OPERATORS = new Set(["AND", "OR", "XOR", "MOD", "DIV"]);

const INFIX_PRECEDENCE = {
  OR: 1,
  "||": 1,
  XOR: 2,
  AND: 3,
  "&&": 3,
  "|": 3,
  "&": 4,
  "<<": 5,
  ">>": 5,
  ">>>": 5,
  "+": 6,
  "-": 6,
  "*": 7,
  "/": 7,
  "%": 7,
  MOD: 7,
  DIV: 7,
  "^": 8,
};

const RIGHT_ASSOCIATIVE = new Set(["^"]);

const MULTI_CHAR_OPERATORS = [">>>", "<<", ">>", "&&", "||", "<=", ">=", "==", "!="];

const SINGLE_CHAR_OPERATORS = new Set(["+", "-", "*", "/", "%", "&", "|", "^", "~", "<", ">", "!", "#"]);

function splitInlineComment(line) {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && (inSingle || inDouble)) {
      escaped = true;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === ";" && !inSingle && !inDouble) {
      return [line.slice(0, index), line.slice(index)];
    }
  }

  return [line, ""];
}

function splitFirstToken(text) {
  const match = text.trimStart().match(/^(\S+)(?:\s+(.*))?$/s);
  if (!match) {
    return ["", ""];
  }
  return [match[1], match[2] || ""];
}

function splitTopLevelCSV(text) {
  const parts = [];
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && (inSingle || inDouble)) {
      escaped = true;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (inSingle || inDouble) {
      continue;
    }
    if (char === "(") {
      depthParen += 1;
      continue;
    }
    if (char === ")") {
      depthParen = Math.max(0, depthParen - 1);
      continue;
    }
    if (char === "[") {
      depthBracket += 1;
      continue;
    }
    if (char === "]") {
      depthBracket = Math.max(0, depthBracket - 1);
      continue;
    }
    if (char === "{") {
      depthBrace += 1;
      continue;
    }
    if (char === "}") {
      depthBrace = Math.max(0, depthBrace - 1);
      continue;
    }
    if (char === "," && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(text.slice(start).trim());
  return parts.filter((part) => part.length > 0);
}

function tokenizeExpression(text) {
  const tokens = [];
  let index = 0;

  const readQuoted = (quote) => {
    let value = quote;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const char = text[index];
      value += char;
      index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        return value;
      }
    }
    throw new Error("Unterminated quoted literal");
  };

  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const literal = readQuoted(char);
      tokens.push({ type: "literal", value: literal });
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "lparen", value: "(" });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen", value: ")" });
      index += 1;
      continue;
    }
    if (char === "[") {
      tokens.push({ type: "lbracket", value: "[" });
      index += 1;
      continue;
    }
    if (char === "]") {
      tokens.push({ type: "rbracket", value: "]" });
      index += 1;
      continue;
    }

    let matched = null;
    for (const op of MULTI_CHAR_OPERATORS) {
      if (text.startsWith(op, index)) {
        matched = op;
        break;
      }
    }
    if (matched) {
      tokens.push({ type: "operator", value: matched });
      index += matched.length;
      continue;
    }

    if (SINGLE_CHAR_OPERATORS.has(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (/[0-9$%&]/.test(char)) {
      const start = index;
      index += 1;
      while (index < text.length && /[0-9A-Fa-f._]/.test(text[index])) {
        index += 1;
      }
      tokens.push({ type: "literal", value: text.slice(start, index) });
      continue;
    }

    if (/[A-Za-z_.$@]/.test(char)) {
      const start = index;
      index += 1;
      while (index < text.length && /[A-Za-z0-9_.$@]/.test(text[index])) {
        index += 1;
      }
      const ident = text.slice(start, index);
      if (WORD_OPERATORS.has(ident.toUpperCase())) {
        tokens.push({ type: "operator", value: ident.toUpperCase() });
      } else {
        tokens.push({ type: "identifier", value: ident });
      }
      continue;
    }

    throw new Error(`Unexpected token '${char}' in expression`);
  }

  return tokens;
}

function parseExpressionTokens(tokens) {
  let index = 0;

  const peek = () => (index < tokens.length ? tokens[index] : null);
  const next = () => {
    const token = peek();
    index += 1;
    return token;
  };

  const parsePrefix = () => {
    const token = next();
    if (!token) {
      throw new Error("Unexpected end of expression");
    }
    if (token.type === "literal") {
      return { type: "Literal", value: token.value };
    }
    if (token.type === "identifier") {
      return { type: "Identifier", name: token.value };
    }
    if (token.type === "lparen") {
      const expr = parseExpression(0);
      const closing = next();
      if (!closing || closing.type !== "rparen") {
        throw new Error("Missing closing ')' in expression");
      }
      return { type: "GroupedExpression", expression: expr };
    }
    if (token.type === "lbracket") {
      const expr = parseExpression(0);
      const closing = next();
      if (!closing || closing.type !== "rbracket") {
        throw new Error("Missing closing ']' in expression");
      }
      return { type: "BracketExpression", expression: expr };
    }
    if (token.type === "operator" && token.value === "*") {
      return { type: "Identifier", name: "*" };
    }
    if (token.type === "operator" && ["+", "-", "~", "!", "<", ">", "^", "#"].includes(token.value)) {
      const argument = parseExpression(9);
      return {
        type: "UnaryExpression",
        operator: token.value,
        argument,
      };
    }
    throw new Error(`Unexpected token '${token.value}' in prefix position`);
  };

  const parseExpression = (minPrecedence) => {
    let left = parsePrefix();

    while (true) {
      const token = peek();
      if (!token || token.type !== "operator") {
        break;
      }
      const precedence = INFIX_PRECEDENCE[token.value];
      if (!precedence || precedence < minPrecedence) {
        break;
      }
      next();
      const nextMin = RIGHT_ASSOCIATIVE.has(token.value) ? precedence : precedence + 1;
      const right = parseExpression(nextMin);
      left = {
        type: "BinaryExpression",
        operator: token.value,
        left,
        right,
      };
    }

    return left;
  };

  const root = parseExpression(0);
  if (index < tokens.length) {
    throw new Error(`Unexpected token '${tokens[index].value}'`);
  }
  return root;
}

function parseExpressionText(text) {
  const raw = text.trim();
  if (!raw) {
    return {
      type: "Expression",
      raw,
      ast: null,
      parseError: "Empty expression",
    };
  }

  try {
    const tokens = tokenizeExpression(raw);
    return {
      type: "Expression",
      raw,
      ast: parseExpressionTokens(tokens),
    };
  } catch (error) {
    return {
      type: "Expression",
      raw,
      ast: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseExpressionList(text) {
  const raw = text.trim();
  if (!raw) {
    return {
      type: "ExpressionList",
      raw,
      items: [],
    };
  }
  const parts = splitTopLevelCSV(raw);
  return {
    type: "ExpressionList",
    raw,
    items: parts.map((part) => ({
      raw: part,
      expression: parseExpressionText(part),
    })),
  };
}

function isMnemonic(token) {
  const match = token.toLowerCase().match(POSTFIX_RE);
  return Boolean(match && MNEMONICS.has(match.groups.name));
}

function isMacroCall(token) {
  return token.startsWith("+") && token.length > 1 && !["+", "-", " ", "\t"].includes(token[1]);
}

function isSymbol(token) {
  return IDENT_RE.test(token) && !isMnemonic(token);
}

function isAssignableSymbol(token) {
  return SYMBOL_ASSIGN_RE.test(token);
}

function isAnonymousLabelToken(token) {
  return token.length > 0 && /^[+-]+$/.test(token);
}

function parseLine(line, index) {
  const leadingMatch = line.match(/^[ \t]*/);
  const leading = leadingMatch ? leadingMatch[0] : "";
  const stripped = line.slice(leading.length).trimEnd();

  if (!stripped) {
    return { type: "BlankLine", index, raw: line };
  }

  if (stripped.startsWith(";")) {
    return {
      type: "CommentLine",
      index,
      raw: line,
      comment: stripped.slice(1),
    };
  }

  const [codePart, commentPart] = splitInlineComment(stripped);
  const code = codePart.trim();
  const comment = commentPart ? commentPart.slice(1) : "";

  const assignmentMatch = code.match(/^([^=\s]+)\s*=\s*(.*)$/s);
  if (assignmentMatch) {
    const lhs = assignmentMatch[1];
    const rhs = assignmentMatch[2];
    if (lhs === "*" || isAssignableSymbol(lhs)) {
      return {
        type: "AssignmentLine",
        index,
        raw: line,
        lhs,
        rhs,
        rhsAst: parseExpressionList(rhs),
        comment,
        assignmentKind: lhs === "*" ? "pc" : "variable",
      };
    }
  }

  const colonMatch = code.match(/^([A-Za-z_.$@][A-Za-z0-9_.$@]*):(?:\s*(.*))?$/s);
  if (colonMatch) {
    const rest = colonMatch[2] || "";
    const [first, tail] = splitFirstToken(rest);
    return {
      type: "ColonLabelLine",
      index,
      raw: line,
      label: colonMatch[1],
      statement: rest
        ? {
            first,
            rest: tail,
            operandsAst: parseExpressionList(tail),
          }
        : null,
      comment,
    };
  }

  const [first, rest] = splitFirstToken(code);

  if (isAnonymousLabelToken(first)) {
    const [bodyFirst, bodyRest] = splitFirstToken(rest);
    return {
      type: "AnonymousLabelLine",
      index,
      raw: line,
      label: first,
      body: rest
        ? {
            first: bodyFirst,
            rest: bodyRest,
            operandsAst: parseExpressionList(bodyRest),
          }
        : null,
      comment,
    };
  }

  if (first.startsWith("!") || isMnemonic(first) || isMacroCall(first) || first === "*=") {
    return {
      type: "CodeLine",
      index,
      raw: line,
      first,
      rest,
      operandsAst: parseExpressionList(rest),
      comment,
      indented: true,
    };
  }

  if (rest && (isSymbol(first) || first.startsWith(".") || first.startsWith("@"))) {
    const [nextFirst, nextRest] = splitFirstToken(rest);
    return {
      type: "LabelWithCodeLine",
      index,
      raw: line,
      label: first,
      first: nextFirst,
      rest: nextRest,
      operandsAst: parseExpressionList(nextRest),
      comment,
    };
  }

  if (isSymbol(first) || first.startsWith(".") || first.startsWith("@")) {
    return {
      type: "LabelOnlyLine",
      index,
      raw: line,
      label: first,
      comment,
    };
  }

  return {
    type: "FallbackCodeLine",
    index,
    raw: line,
    code,
    comment,
  };
}

function parseAcme(text) {
  const hadCRLF = /\r\n/.test(text);
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const hasTrailingNewline = /\n$/.test(normalized);
  if (hasTrailingNewline) {
    lines.pop();
  }

  return {
    type: "Program",
    sourceLength: text.length,
    hasTrailingNewline,
    hadCRLF,
    lines: lines.map((line, index) => parseLine(line, index)),
  };
}

module.exports = {
  parseAcme,
  parseExpressionText,
  parseExpressionList,
  splitInlineComment,
  splitFirstToken,
};

