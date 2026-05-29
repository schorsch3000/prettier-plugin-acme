const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');
const plugin = require('../index');

const fixturesDir = path.join(__dirname, 'fixtures');

async function formatAcme(text) {
  return prettier.format(text, {
    parser: 'acme',
    plugins: [plugin],
    endOfLine: 'lf',
  });
}

function loadFixtureNames() {
  return fs
    .readdirSync(fixturesDir)
    .filter((name) => name.endsWith('.input.asm'))
    .map((name) => name.replace(/\.input\.asm$/, ''))
    .sort();
}

for (const fixtureName of loadFixtureNames()) {
  test(`fixture: ${fixtureName}`, async () => {
    const inputPath = path.join(fixturesDir, `${fixtureName}.input.asm`);
    const expectedPath = path.join(fixturesDir, `${fixtureName}.expected.asm`);
    const input = fs.readFileSync(inputPath, 'utf8');
    const expected = fs.readFileSync(expectedPath, 'utf8');

    const formatted = await formatAcme(input);
    assert.equal(formatted, expected);

    // Formatting should be idempotent.
    const formattedTwice = await formatAcme(formatted);
    assert.equal(formattedTwice, expected);
  });
}

