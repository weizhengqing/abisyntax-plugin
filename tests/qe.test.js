'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const textmate = require('vscode-textmate');
const onig = require('vscode-oniguruma');
const { detectQeLanguage } = require('../qe-detection');
const pkg = require('../package.json');
const catalog = require('../qe-syntax-data.json');
const root = path.resolve(__dirname, '..');
let checks = 0;

function tokenize(grammar, text) {
  let stack = textmate.INITIAL;
  return text.split(/\r?\n/).map(line => {
    const result = grammar.tokenizeLine(line, stack);
    stack = result.ruleStack;
    assert(!result.stoppedEarly, 'tokenization timed out');
    return result.tokens.map(token => ({
      text: line.slice(token.startIndex, token.endIndex), scopes: token.scopes,
    }));
  });
}

function expect(grammar, line, text, scope, context = '') {
  const tokens = tokenize(grammar, context ? `${context}\n${line}` : line).at(-1);
  const start = line.indexOf(text);
  assert(start >= 0);
  let offset = 0;
  const hit = tokens.filter(token => {
    const end = offset + token.text.length;
    const overlaps = end > start && offset < start + text.length;
    offset = end;
    return overlaps;
  });
  assert(hit.length && hit.every(t => t.scopes.some(s => s.startsWith(scope))),
    `${JSON.stringify(line)}: ${text} expected ${scope}, got ${JSON.stringify(hit)}`);
  checks++;
}

function* files(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else if (entry.isFile()) yield file;
  }
}

async function main() {
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await onig.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const grammars = new Map();
  const registry = new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new onig.OnigScanner(patterns),
      createOnigString: value => new onig.OnigString(value),
    }),
    loadGrammar: async scope => {
      const spec = pkg.contributes.grammars.find(g => g.scopeName === scope);
      if (!spec) return null;
      const file = path.join(root, spec.path);
      return textmate.parseRawGrammar(fs.readFileSync(file, 'utf8'), file);
    },
  });
  for (const spec of pkg.contributes.grammars) {
    grammars.set(spec.scopeName, await registry.loadGrammar(spec.scopeName));
    const raw = JSON.parse(fs.readFileSync(path.join(root, spec.path), 'utf8'));
    function compile(node) {
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (['match', 'begin', 'end', 'while'].includes(key) && typeof value === 'string') {
          const scanner = new onig.OnigScanner([value]);
          scanner.dispose();
          checks++;
        } else if (typeof value === 'object') compile(value);
      }
    }
    compile(raw);
  }

  const input = grammars.get('source.qe');
  const output = grammars.get('source.qe-output');
  expect(input, '&CONTROL calculation="scf" /', 'CONTROL', 'storage.type.namelist');
  expect(input, ' celldm(1) = 9.08, starting_magnetization(2) = -.5', 'celldm', 'keyword.other.variable');
  expect(input, ' celldm(1) = 9.08', '1', 'constant.numeric');
  expect(input, ' ggwin%max_i = 5', 'ggwin%max_i', 'keyword.other.variable');
  expect(input, ' alpha_mix(1:3,2)=3*0.5', '1', 'constant.numeric');
  expect(input, ' conv_thr=1.d-9, degauss=.02, nbnd=96', '1.d-9', 'constant.numeric');
  expect(input, " occupations='smearing'", 'occupations', 'keyword.other.variable');
  expect(input, ' xonly_plot=.false., xcoordcrys=.TRUE.', '.false.', 'constant.language.boolean');
  expect(input, " prefix='Al!#2O3', outdir='./tmp/' ! comment", 'Al!#2O3', 'string');
  expect(input, " prefix='Al!#2O3', outdir='./tmp/' ! comment", '! comment', 'comment');
  expect(input, " prefix='it''s a test'", "''", 'constant.character.escape');
  expect(input, " calculation='scf'", 'calculation', 'keyword.other.variable', "prefix='unclosed");
  expect(input, ' # coordinates', '# coordinates', 'comment');
  expect(input, 'ATOMIC_POSITIONS {crystal}', 'ATOMIC_POSITIONS', 'keyword.control.card');
  expect(input, 'ATOMIC_POSITIONS {crystal}', 'crystal', 'support.constant.option');
  expect(input, 'Al_a 26.981539 Al.d.ground.UPF', 'Al_a', 'constant.language.species');
  expect(input, 'Al_a 26.981539 Al.d.ground.UPF', 'Al.d.ground.UPF', 'string');
  expect(input, 'Al_a .3 .6 .8 0 0 1', '.3', 'constant.numeric');
  expect(input, 'HUBBARD (ortho-atomic)', 'HUBBARD', 'keyword.control.card');
  expect(input, 'U Fe-3d 4.0', 'U', 'keyword.other.hubbard');
  expect(input, 'ALPHA Fe-3d 0.1', 'ALPHA', 'keyword.other.hubbard');
  expect(input, '2S 1 0 2.00', '2S', 'constant.language.orbital');
  expect(input, ' &END', '&END', 'punctuation.definition.namelist.end');
  expect(input, '/', '/', 'punctuation.definition.namelist.end');
  expect(output, '     Program PWSCF v.7.5 starts on 2Jul2026', 'Program PWSCF', 'markup.heading');
  expect(output, '!    total energy = -123.456789 Ry', 'total energy', 'keyword.other.energy');
  expect(output, '!    total energy = -123.456789 Ry', '-123.456789', 'constant.numeric');
  expect(output, '!    total energy = -123.456789 Ry', 'Ry', 'keyword.other.unit');
  expect(output, ' the Fermi energy is 8.7641 ev', 'the Fermi energy is', 'keyword.other.energy');
  expect(output, '     iteration # 12 ecut=45.0 Ry', 'iteration # 12', 'markup.heading');
  expect(output, ' WARNING: variable ef_r is obsolete', 'WARNING', 'invalid.illegal');
  expect(output, ' convergence NOT achieved after 100 iterations', 'convergence NOT achieved', 'invalid.illegal');
  expect(output, ' convergence has been achieved in 12 iterations', 'convergence has been achieved', 'markup.inserted');
  expect(output, ' JOB DONE.', 'JOB DONE.', 'markup.inserted');
  expect(output, ' bad input data', 'bad input data', 'invalid.illegal', ' %%%%%%%%%%%%\n Error in routine read_namelists (1)');
  expect(output, ' -100.25 Ry', '-100.25', 'constant.numeric', ' %%%%%%%%%%%%\n Error in routine read_namelists (1)\n %%%%%%%%%%%%');

  for (const [text, language] of [
    ['\uFEFF\n! comment\n &CONTROL\n calculation="scf"\n/', 'qe'],
    ['XSpectra title\n&INPUT_XSPECTRA\n/', 'qe'],
    ['&projwfc\n prefix="Al"\n&end', 'qe'],
    ['\n scheduler preamble\n Program XSpectra v.7.5 starts on ...', 'qe-output'],
    ['\n Program PROJWFC v.7.5 starts on ...', 'qe-output'],
    ['BEGIN\nBEGIN_ENGINE_INPUT\n&CONTROL', 'qe'],
    ['BEGIN\nnot a QE input', undefined],
    [' Program FUTURE_QE v.8.0\nThis program is part of the Quantum ESPRESSO suite', 'qe-output'],
    ['ecut 30\nnatom 2\nxred 0 0 0', undefined],
    ['&FILES\nddkfile_1="file"\n/', undefined],
    ['# &control\n! &input_xspectra', undefined],
    ['Program OTHER v.1.0', undefined],
  ]) {
    assert.equal(detectQeLanguage(text), language, text);
    checks++;
  }
  for (const language of pkg.contributes.languages.filter(l => l.firstLine)) {
    new RegExp(language.firstLine); // VS Code language detection uses JS regexes.
    new onig.OnigScanner([language.firstLine]).dispose();
    checks++;
  }
  // Exhaustive release-derived coverage, beyond the user's local examples.
  for (const name of catalog.namelists) {
    expect(input, ` &${name.toUpperCase()}`, name.toUpperCase(), 'storage.type.namelist');
    assert.equal(detectQeLanguage(`Title\n &${name}\n/`), 'qe', name);
    checks++;
  }
  for (const name of catalog.variables) {
    expect(input, ` ${name} = 1`, name, 'keyword.other.variable');
    expect(input, ` ${name.toUpperCase()}(1,2) = .true.`, name.toUpperCase(), 'keyword.other.variable');
  }
  for (const name of catalog.cards) expect(input, ` ${name}`, name, 'keyword.control.card');
  for (const name of catalog.programs) {
    assert.equal(detectQeLanguage(`\n Program ${name} v.7.6 starts on ...`), 'qe-output', name);
    checks++;
  }
  assert(catalog.namelists.includes('inputepw'));
  assert(catalog.namelists.includes('inputgipaw'));
  assert(catalog.variables.includes('ggwin%max_i'));
  assert(!catalog.cards.includes('PSEUDOPOTENTIALGENERATIONCARDS'), 'nameless documentation label became a card');
  // ABINIT still recognizes its full database and multi-dataset syntax.
  const abinit = grammars.get('source.abinit');
  const variables = require('../tools/abinit_variables.json').variables;
  for (const variable of variables) expect(abinit, `${variable} 1`, variable, 'keyword.other.variable');
  expect(abinit, 'ecut12 30', '12', 'constant.numeric.integer.dataset');

  let inputs = 0, outputs = 0, logs = 0;
  const examples = path.join(root, 'examples/qe_examples/calc');
  if (fs.existsSync(examples)) {
    for (const file of files(examples)) {
      if (!/\.(in|out|log)$/.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      const language = detectQeLanguage(text);
      if (file.endsWith('.in')) assert.equal(language, 'qe', `undetected input: ${file}`);
      if (!language) continue; // Build logs and unrelated reports aren't QE output.
      const grammar = language === 'qe' ? input : output;
      const tokens = tokenize(grammar, text);
      if (language === 'qe') {
        inputs++;
        for (const [index, line] of text.split(/\r?\n/).entries()) {
          if (/^\s*[!#]/.test(line)) continue;
          for (const match of line.matchAll(/\b([A-Za-z_]\w*)\s*(?:\([^()]*\))?\s*=/g)) {
            const before = line.slice(0, match.index);
            if (/[!'"#]/.test(before)) continue;
            assert(tokens[index].some(t => t.text.trim() === match[1] && t.scopes.includes('keyword.other.variable.qe')),
              `${file}:${index + 1}: unhighlighted ${match[1]}`);
            checks++;
          }
        }
      } else if (file.endsWith('.log')) logs++;
      else outputs++;
    }
  }
  let upstreamInputs = 0;
  const sourceRoot = path.join(root, 'examples/qe-source');
  if (fs.existsSync(sourceRoot)) {
    const modules = new Set();
    for (const file of files(sourceRoot)) {
      if (!file.endsWith('.in')) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (detectQeLanguage(text) !== 'qe') continue;
      const lines = text.split(/\r?\n/);
      const tokens = tokenize(input, text);
      for (const [index, line] of lines.entries()) {
        const namelist = /^\s*&([A-Za-z_]\w*)/.exec(line);
        if (namelist && namelist[1].toLowerCase() !== 'end') {
          assert(tokens[index].some(t => t.text === namelist[1] && t.scopes.includes('storage.type.namelist.qe')),
            `${file}:${index + 1}: unhighlighted namelist`);
          checks++;
        }
      }
      upstreamInputs++;
      modules.add(path.relative(sourceRoot, file).split(path.sep)[1]);
    }
    console.log(`Official source samples: ${upstreamInputs} QE inputs tokenized across ${modules.size} source directories`);
  }
  console.log(`PASS ${checks} checks; release catalog: ${catalog.namelists.length} namelists, ${catalog.variables.length} parameters, ${catalog.cards.length} cards; local QE examples: ${inputs} inputs, ${outputs} outputs, ${logs} logs`);
  registry.dispose();
}

main().catch(error => { console.error(error); process.exitCode = 1; });
