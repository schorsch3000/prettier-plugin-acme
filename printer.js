"use strict";

function normalizeComment(comment) {
  if (!comment) {
    return "";
  }
  const body = comment.trimStart();
  return body ? `\t; ${body}` : "\t;";
}

function normalizeCommaSpacing(text) {
  let out = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      out += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && (inSingle || inDouble)) {
      out += char;
      escaped = true;
      continue;
    }
    if (char === '"' && !inSingle) {
      out += char;
      inDouble = !inDouble;
      continue;
    }
    if (char === "'" && !inDouble) {
      out += char;
      inSingle = !inSingle;
      continue;
    }
    if (char === "," && !inSingle && !inDouble) {
      while (out.endsWith(" ") || out.endsWith("\t")) {
        out = out.slice(0, -1);
      }
      out += ",";
      let lookahead = index + 1;
      while (lookahead < text.length && /\s/.test(text[lookahead])) {
        lookahead += 1;
      }
      if (lookahead < text.length) {
        out += " ";
      }
      index = lookahead - 1;
      continue;
    }
    out += char;
  }

  return out.trimEnd();
}

function formatCodeBody(first, rest) {
  return rest ? `${first}\t${normalizeCommaSpacing(rest)}` : first;
}

function renderLineNode(node) {
  const suffix = normalizeComment(node.comment || "");
  switch (node.type) {
    case "BlankLine":
      return { line: "", alignable: false };
    case "CommentLine": {
      const body = (node.comment || "").trimStart();
      return { line: body ? `; ${body}` : ";", alignable: false };
    }
    case "AssignmentLine": {
      if (node.assignmentKind === "pc") {
        return {
          line: `\t* = ${normalizeCommaSpacing(node.rhs)}${suffix}`,
          alignable: false,
        };
      }
      return {
        line: `${node.lhs} = ${normalizeCommaSpacing(node.rhs)}${suffix}`,
        alignable: true,
        lhs: node.lhs,
        rhs: normalizeCommaSpacing(node.rhs),
        suffix,
      };
    }
    case "ColonLabelLine":
      if (!node.statement) {
        return { line: `${node.label}:${suffix}`, alignable: false };
      }
      return {
        line: `${node.label}:\t${formatCodeBody(node.statement.first, node.statement.rest)}${suffix}`,
        alignable: false,
      };
    case "AnonymousLabelLine":
      if (!node.body) {
        return { line: `${node.label}${suffix}`, alignable: false };
      }
      return {
        line: `${node.label}\t${formatCodeBody(node.body.first, node.body.rest)}${suffix}`,
        alignable: false,
      };
    case "CodeLine":
      return {
        line: `${node.indented ? "\t" : ""}${formatCodeBody(node.first, node.rest)}${suffix}`,
        alignable: false,
      };
    case "LabelWithCodeLine":
      return {
        line: `${node.label}\t${formatCodeBody(node.first, node.rest)}${suffix}`,
        alignable: false,
      };
    case "LabelOnlyLine":
      return {
        line: `${node.label}${suffix}`,
        alignable: false,
      };
    case "FallbackCodeLine":
      return {
        line: `\t${normalizeCommaSpacing(node.code)}${suffix}`,
        alignable: false,
      };
    default:
      return { line: "", alignable: false };
  }
}

function alignVariableAssignmentBlocks(entries, minBlockSize) {
  const out = [...entries];
  let index = 0;

  while (index < out.length) {
    if (!out[index].alignable) {
      index += 1;
      continue;
    }

    let end = index;
    let maxLhs = out[index].lhs.length;
    while (end < out.length && out[end].alignable) {
      maxLhs = Math.max(maxLhs, out[end].lhs.length);
      end += 1;
    }

    if (end - index >= minBlockSize) {
      for (let i = index; i < end; i += 1) {
        const row = out[i];
        row.line = `${row.lhs.padEnd(maxLhs, " ")} = ${row.rhs}${row.suffix}`;
      }
    }

    index = end;
  }

  return out;
}

function normalizeEndOfLine(text, endOfLine, hadCRLF) {
  if (endOfLine === "crlf") {
    return text.replace(/\n/g, "\r\n");
  }
  if (endOfLine === "auto" && hadCRLF) {
    return text.replace(/\n/g, "\r\n");
  }
  return text;
}

function printProgram(program, options = {}) {
  const alignAssignments = options.acmeAlignAssignments !== false;
  const minAlignmentLines =
    Number.isInteger(options.acmeAlignAssignmentsMinLines) && options.acmeAlignAssignmentsMinLines > 0
      ? options.acmeAlignAssignmentsMinLines
      : 2;

  const rendered = program.lines.map(renderLineNode);
  const aligned = alignAssignments ? alignVariableAssignmentBlocks(rendered, minAlignmentLines) : rendered;
  const output = aligned.map((entry) => entry.line).join("\n") + (program.hasTrailingNewline ? "\n" : "");
  return normalizeEndOfLine(output, options.endOfLine || "lf", Boolean(program.hadCRLF));
}

module.exports = {
  printProgram,
};

