const test = require('node:test');
const assert = require('node:assert/strict');
const prettier = require('prettier');
const plugin = require('../index');
const { parseAcme, parseExpressionText, parseExpressionList } = require('../parser');

async function format(text) {
  return prettier.format(text, {
    parser: 'acme',
    plugins: [plugin],
    endOfLine: 'lf',
  });
}

async function formatWithOptions(text, extraOptions) {
  return prettier.format(text, {
    parser: 'acme',
    plugins: [plugin],
    endOfLine: 'lf',
    ...extraOptions,
  });
}

test('formats basic ACME code', async () => {
  const source = [
    'CLEAR = 147',
    '!to "tiny.o", cbm',
    '* = $c000',
    '  ldx    #0',
    '  lda .string,x ; get character',
    '.string   !pet  "Dumb example",13,0',
    '',
  ].join('\n');

  const expected = [
    'CLEAR = 147',
    '\t!to\t"tiny.o", cbm',
    '\t* = $c000',
    '\tldx\t#0',
    '\tlda\t.string, x\t; get character',
    '.string\t!pet\t"Dumb example", 13, 0',
    '',
  ].join('\n');

  assert.equal(await format(source), expected);
});

test('preserves semicolons inside strings', async () => {
  const source = 'text !text "A;B", "C\\";D", 0 ; comment\n';
  const expected = 'text\t!text\t"A;B", "C\\";D", 0\t; comment\n';
  assert.equal(await format(source), expected);
});

test('formats anonymous label lines', async () => {
  const source = '+            lda .string,x\n-            bne -\n';
  const expected = '+\tlda\t.string, x\n-\tbne\t-\n';
  assert.equal(await format(source), expected);
});

test('supports .asm extension registration', async () => {
  assert.ok(plugin.languages.some((language) => language.extensions.includes('.asm')));
});

test('formats repeated anonymous labels and branch targets', async () => {
  const source = '++    lda #1\n---   bne --\n';
  const expected = '++\tlda\t#1\n---\tbne\t--\n';
  assert.equal(await format(source), expected);
});

test('formats force-bit symbol assignment syntax', async () => {
  const source = 'symbol3+3=$ff\nsta symbol3\n';
  const expected = 'symbol3+3 = $ff\n\tsta\tsymbol3\n';
  assert.equal(await format(source), expected);
});

test('aligns variable assignments within a contiguous block', async () => {
  const source = ['A=1', 'LONG_NAME=$10', '.l=3', '@cheap=4', ''].join('\n');
  const expected = ['A         = 1', 'LONG_NAME = $10', '.l        = 3', '@cheap    = 4', ''].join('\n');
  assert.equal(await format(source), expected);
});

test('stops assignment alignment when a non-assignment line appears', async () => {
  const source = ['A=1', 'BB=2', 'lda #0', 'X=3', 'YYYY=4', ''].join('\n');
  const expected = ['A  = 1', 'BB = 2', '\tlda\t#0', 'X    = 3', 'YYYY = 4', ''].join('\n');
  assert.equal(await format(source), expected);
});

test('can disable assignment block alignment via option', async () => {
  const source = ['A=1', 'LONG_NAME=$10', ''].join('\n');
  const expected = ['A = 1', 'LONG_NAME = $10', ''].join('\n');
  assert.equal(await formatWithOptions(source, { acmeAlignAssignments: false }), expected);
});

test('does not align single-line assignment blocks by default (2+)', async () => {
  const source = ['A=1', 'lda #0', ''].join('\n');
  const expected = ['A = 1', '\tlda\t#0', ''].join('\n');
  assert.equal(await format(source), expected);
});

test('supports custom minimum alignment block size', async () => {
  const source = ['A=1', 'BB=2', ''].join('\n');
  const expected = ['A = 1', 'BB = 2', ''].join('\n');
  assert.equal(await formatWithOptions(source, { acmeAlignAssignmentsMinLines: 3 }), expected);
});

test('parses structured AST nodes', () => {
  const ast = parseAcme(['A=1', 'label: lda #1 ; c', '; note', ''].join('\n'));
  assert.equal(ast.type, 'Program');
  assert.equal(ast.lines[0].type, 'AssignmentLine');
  assert.equal(ast.lines[0].lhs, 'A');
  assert.equal(ast.lines[0].rhsAst.type, 'ExpressionList');
  assert.equal(ast.lines[0].rhsAst.items[0].expression.type, 'Expression');
  assert.equal(ast.lines[0].rhsAst.items[0].expression.ast.type, 'Literal');
  assert.equal(ast.lines[1].type, 'ColonLabelLine');
  assert.equal(ast.lines[1].label, 'label');
  assert.equal(ast.lines[1].statement.operandsAst.type, 'ExpressionList');
  assert.equal(ast.lines[2].type, 'CommentLine');
});

test('parses binary expression AST with precedence', () => {
  const expression = parseExpressionText('1 + 2 * 3');
  assert.equal(expression.ast.type, 'BinaryExpression');
  assert.equal(expression.ast.operator, '+');
  assert.equal(expression.ast.right.type, 'BinaryExpression');
  assert.equal(expression.ast.right.operator, '*');
});

test('parses expression lists while preserving raw parts', () => {
  const list = parseExpressionList('foo, 1+2, "A;B"');
  assert.equal(list.items.length, 3);
  assert.equal(list.items[0].expression.ast.type, 'Identifier');
  assert.equal(list.items[1].expression.ast.type, 'BinaryExpression');
  assert.equal(list.items[2].expression.ast.type, 'Literal');
});

test('keeps expression parse errors non-fatal', () => {
  const expression = parseExpressionText('{not-supported}');
  assert.equal(expression.type, 'Expression');
  assert.equal(expression.ast, null);
  assert.ok(typeof expression.parseError === 'string' && expression.parseError.length > 0);
});

test('parses square-bracket grouped expressions', () => {
  const expression = parseExpressionText('[1 + 2]');
  assert.equal(expression.ast.type, 'BracketExpression');
  assert.equal(expression.ast.expression.type, 'BinaryExpression');
  assert.equal(expression.ast.expression.operator, '+');
});

test('parses current PC symbol in expressions', () => {
  const expression = parseExpressionText('* + 2');
  assert.equal(expression.ast.type, 'BinaryExpression');
  assert.equal(expression.ast.left.type, 'Identifier');
  assert.equal(expression.ast.left.name, '*');
});

