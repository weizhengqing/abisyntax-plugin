#!/usr/bin/env node
// Regression tests for the ABINIT grammars.  Run with `npm test`.
//
//  1. every regex in every grammar compiles with Oniguruma
//  2. all variables of tools/abinit_variables.json are highlighted, with and
//     without multi-dataset suffixes
//  3. hand-written expectations for tricky input / output lines
//  4. if abinit_example/ exists, every token of every input file there is
//     highlighted, and the output files tokenize without stray error scopes
'use strict';

const fs = require('fs');
const path = require('path');
const oniguruma = require('vscode-oniguruma');
const { loadGrammar, tokenize, scopeForFile, ROOT } = require('./grammar');

let failures = 0;
let checks = 0;
function fail(msg) {
  failures++;
  console.log(`  FAIL ${msg}`);
}

// Tokens overlapping the first occurrence of `text` in the line.  Tokens may
// stick out of the span only by whitespace.
function tokensFor(lineTokens, text) {
  const line = lineTokens.map((t) => t.text).join('');
  const start = line.indexOf(text);
  if (start < 0) return { error: 'text not found' };
  const end = start + text.length;
  const hit = [];
  let pos = 0;
  for (const t of lineTokens) {
    const tEnd = pos + t.text.length;
    if (tEnd > start && pos < end) {
      const outside = line.slice(pos, Math.max(pos, start)) + line.slice(Math.min(tEnd, end), tEnd);
      hit.push({ ...t, clean: !outside.trim() });
    }
    pos = tEnd;
  }
  return { hit };
}

const plain = (scopes) => scopes.slice(1).every((s) => s.startsWith('meta.') || s.startsWith('punctuation.'));

// expectLine(grammar, line, {text: scopePrefix | null}, contextLines)
//   scopePrefix: every token of `text` carries a scope starting with it, and
//                the tokens do not extend beyond `text` (except whitespace)
//   null:        `text` is not highlighted at all
function expectLine(grammar, line, expected, context = []) {
  const lines = tokenize(grammar, [...context, line].join('\n'));
  const tokens = lines[lines.length - 1];
  for (const [text, want] of Object.entries(expected)) {
    checks++;
    const { hit, error } = tokensFor(tokens, text);
    const describe = () => error || hit.map((t) => `"${t.text}"=${t.scopes.slice(1).join(' ') || '-'}`).join(', ');
    const ok = !error && (want === null
      ? hit.every((t) => plain(t.scopes))
      : hit.every((t) => t.clean && t.scopes.some((s) => s.startsWith(want))));
    if (!ok) fail(`${JSON.stringify(line)}: "${text}" expected ${want}, got ${describe()}`);
  }
}

async function testRegexesCompile() {
  console.log('regexes compile');
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer;
  await oniguruma.loadWASM(wasm).catch(() => {}); // may already be loaded
  for (const file of fs.readdirSync(path.join(ROOT, 'syntaxes'))) {
    const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'syntaxes', file), 'utf8'));
    (function walk(node, where) {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${where}[${i}]`));
      if (!node || typeof node !== 'object') return;
      for (const key of ['match', 'begin', 'end', 'while']) {
        if (typeof node[key] !== 'string') continue;
        checks++;
        // \A and \G are handled specially by vscode-textmate
        const src = node[key].replace(/\\[AG]/g, '');
        try {
          new oniguruma.OnigScanner([src]).dispose();
        } catch (e) {
          fail(`${file} ${where}.${key}: ${e.message}`);
        }
      }
      for (const [k, v] of Object.entries(node)) walk(v, `${where}.${k}`);
    })(g, file);
  }
}

async function testAllVariables() {
  console.log('all ABINIT variables are recognised');
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'abinit_variables.json'), 'utf8'));
  const g = await loadGrammar('source.abinit');
  const suffixes = ['', '1', '12', '?', '1?', '?2', ':', '+', '*', '?:', ':?'];
  const known = new Set(data.variables.map((v) => v.toLowerCase()));
  const cases = [];
  for (const v of data.variables) {
    for (const s of suffixes) cases.push([v, `${v}${s} 1`]);
  }
  const tokens = tokenize(g, cases.map((c) => c[1]).join('\n'));
  tokens.forEach((lineTokens, i) => {
    checks++;
    const [name, line] = cases[i];
    const first = lineTokens[0];
    // "ngqpt1" is itself a variable (atdep), so "ngqpt" + dataset 1 may legitimately
    // be read as "ngqpt1"; any known name that is a prefix of the line is fine.
    const okName = first.text === name || (known.has(first.text.toLowerCase()) && line.startsWith(first.text));
    if (!first.scopes.some((s) => s.startsWith('keyword.other.variable')) || !okName) {
      fail(`"${line}" -> "${first.text}": ${first.scopes.join(' ')}`);
    }
  });
  console.log(`  ${data.variables.length} variables x ${suffixes.length} suffixes`);
}

async function testInputGrammar() {
  console.log('input grammar');
  const g = await loadGrammar('source.abinit');
  const V = 'keyword.other.variable';
  const N = 'constant.numeric';
  const U = 'keyword.other.unit';
  const S = 'string';
  const C = 'comment';
  const OP = 'keyword.operator';

  expectLine(g, 'ecut 30  # cutoff', { ecut: V, 30: N, '# cutoff': C });
  expectLine(g, 'ecut = 30 Ha', { ecut: V, '=': OP, 30: N, Ha: U });
  expectLine(g, 'toldfe 1.0d-9 ! old style comment', { toldfe: V, '1.0d-9': N, '! old style comment': C });
  expectLine(g, 'acell 3*10.26 angstrom', { acell: V, 3: N, '*': OP, '10.26': N, angstrom: U });
  expectLine(g, 'rprim 0 1/2 1/2', { rprim: V, '/': OP });
  expectLine(g, 'xred -sqrt(0.75) .5 5.', { xred: V, sqrt: 'support.function', '0.75': N, '.5': N, '5.': N });
  // multi-dataset syntax
  expectLine(g, 'ndtset 4  udtset 2 2', { ndtset: V, udtset: V });
  expectLine(g, 'ecut12 20', { ecut: V, 12: 'constant.numeric.integer.dataset' });
  expectLine(g, 'ecut?1 20', { ecut: V, '?': 'keyword.operator.wildcard', 1: 'constant.numeric.integer.dataset' });
  expectLine(g, 'ecut: 10 ecut+ 5', { ecut: V, ':': 'keyword.operator.series', '+': 'keyword.operator.series', 10: N });
  expectLine(g, 'tsmear:? 0.01 tsmear*? 2', { tsmear: V, ':': 'keyword.operator.series', '?': 'keyword.operator.wildcard' });
  expectLine(g, 'acell_lastimg 3*10', { acell: V, _lastimg: 'keyword.other.variable.image' });
  // longest name wins, names that end with digits
  expectLine(g, 'nbandhf 10', { nbandhf: V });
  expectLine(g, 'get1den -1', { get1den: V, '-1': N });
  expectLine(g, 'nph1l 2', { nph1l: V });
  // strings, paths, include
  expectLine(g, "include '../base.inc'", { include: 'keyword.control.import', '../base.inc': S });
  expectLine(g, 'pp_dirpath "$HOME/pseudos"', { pp_dirpath: V, $HOME: 'variable.other.environment' });
  expectLine(g, 'pseudos "Al.psp8, C.psp8"', { pseudos: V, 'Al.psp8, C.psp8': S });
  expectLine(g, 'xyzfile ../geo/al28.xyz', { xyzfile: V, '../geo/al28.xyz': S });
  expectLine(g, 'structure "abifile:out_GSR.nc"', { structure: V, abifile: 'storage.type.format' });
  expectLine(g, 'SpinPolarized T', { SpinPolarized: V, T: 'constant.language' });
  // anaddb / optic / multibinit variables
  expectLine(g, 'ifcflag 1  dipdip 1  ngqpt 4 4 4', { ifcflag: V, dipdip: V, ngqpt: V });
  expectLine(g, '&FILES', { FILES: 'storage.type.namelist' });
  expectLine(g, " ddkfile_1 = 'toptic_1o_DS4_1WF7',", { ddkfile: V, _1: 'keyword.other.variable.image', toptic_1o_DS4_1WF7: S });
  expectLine(g, ' broadening = 0.002,', { broadening: V, '0.002': N });
  expectLine(g, 'dynamics 13  temperature 300', { dynamics: V, temperature: V });
  // unknown words are left uncoloured, and nothing inside them is highlighted
  expectLine(g, 'ecutt 30', { ecutt: null, 30: N });
  expectLine(g, 'foo_1 3', { foo_1: null });
  // units only as whole words
  expectLine(g, 'tsmear 0.01 eV', { eV: U });
  expectLine(g, 'kptopt 1', { kptopt: V, 1: N });
}

async function testOutputGrammar() {
  console.log('output grammar');
  const g = await loadGrammar('source.abinit-output');
  const V = 'keyword.other.variable';
  const P = 'support.type.property-name';
  const N = 'constant.numeric';
  const U = 'keyword.other.unit';
  const S = 'string';
  const H = 'markup.heading';

  expectLine(g, '            acell      9.3761834869E+00  1.0826684213E+01  8.3211636133E+01 Bohr',
    { acell: V, '9.3761834869E+00': N, Bohr: U });
  expectLine(g, '-          fftalg         512', { fftalg: V, 512: N });
  expectLine(g, 'P           mkmem           2', { mkmem: V });
  expectLine(g, '             ecut1      3.00000000E+01 Hartree', { ecut: V, 1: 'constant.numeric.integer.dataset', Hartree: U });
  expectLine(g, '           etotal     -7.0702109382E+01', { etotal: V, '-7.0702109382E+01': N });
  expectLine(g, '     intxc =       0    ionmov =       2', { intxc: V, ionmov: V, 0: N });
  expectLine(g, '   mgfft =       270  nbnd_in_blk=    11', { mgfft: V, nbnd_in_blk: P });
  expectLine(g, ' ETOT  3  -70.702079466839    -3.024E-05 5.109E-07 4.041E-03', { ETOT: V, '-70.702079466839': N });
  expectLine(g, '== DATASET  1 ==================================================================',
    { DATASET: H, 1: N });
  expectLine(g, '---SELF-CONSISTENT-FIELD CONVERGENCE--------------------------------------------',
    { 'SELF-CONSISTENT-FIELD CONVERGENCE': H, '---': 'comment' });
  expectLine(g, '================================================================================',
    { '================================================================================': 'comment' });
  expectLine(g, ' -outvars: echo values of preprocessed input variables --------',
    { '-outvars: echo values of preprocessed input variables': H });
  expectLine(g, '- pspini: atom type   1  psp file is /home/u/pseudo/Al.psp8',
    { pspini: P, '/home/u/pseudo/Al.psp8': S });
  expectLine(g, '- input  file    -> run.abi', { 'run.abi': S });
  expectLine(g, '- --> not optimal distribution: autoparal keyword recommended in input file <--',
    { not: null });
  expectLine(g, ' kpt#   1, nband= 82, wtk=  0.05556, kpt=  0.0833  0.0833  0.2500 (reduced coord)',
    { 'kpt#': null, nband: V, wtk: V, '0.05556': N });
  expectLine(g, '  sigma(1 1)=  2.58072324E-05  sigma(3 2)=  0.00000000E+00', { sigma: P, '2.58072324E-05': N });
  expectLine(g, ' Fermi (or HOMO) energy (hartree) =  -0.01384', { energy: P, hartree: U });
  expectLine(g, ' Unit cell volume ucvol=  8.4470610E+03 bohr^3', { ucvol: P, 'bohr^3': U });
  expectLine(g, '.Version 9.10.3 of ABINIT', { '9.10.3': 'constant.numeric.version' });
  expectLine(g, '- Al    ONCVPSP-3.2.3.1  r_core=   1.76802', { '3.2.3.1': 'constant.numeric.version', r_core: P });
  expectLine(g, '.Starting date : Thu 16 Apr 2026.', { 'Starting date': P, 2026: N });
  expectLine(g, '  for the second time, diff in etot=  2.933E-10 < toldfe=  1.000E-09',
    { second: null, etot: P, toldfe: V });
  expectLine(g, ' Please read https://docs.abinit.org/theory/acknowledgments for suggested',
    { 'https://docs.abinit.org/theory/acknowledgments': 'markup.underline.link' });
  expectLine(g, ' Calculation completed.', { 'Calculation completed.': 'markup.inserted' });
  expectLine(g, '.Delivered   3 WARNINGs and   5 COMMENTs to log file.',
    { WARNINGs: 'markup.deleted', COMMENTs: 'markup.changed' });
  expectLine(g, ' fconv : at Broyd/MD step   1, gradients have not converged yet.',
    { 'have not converged yet': 'markup.deleted' });
  expectLine(g, ' {SCF_istep: 1 , Vnl|psi>: 1640 , wall_time: \' 05:22 [minutes] \'} <<< TIME',
    { SCF_istep: P, 1640: N, '<<< TIME': 'comment' });
  expectLine(g, '   FFT mesh divisions ........................    54   64  480',
    { 'FFT mesh divisions': P, 54: N });
  expectLine(g, '                 HAVE_DFTI HAVE_FC_ALLOCATABLE_DT...             HAVE_FC_ASYNC',
    { HAVE_DFTI: null });
  expectLine(g, ' **** DERIVATIVE DATABASE ****', { 'DERIVATIVE DATABASE': H });
  expectLine(g, '     acell  0.93761834869000D+01  0.10826684213000D+02', { acell: V, '0.93761834869000D+01': N });
  expectLine(g, '# Fermi energy :      -0.01675397', { '# Fermi energy :      -0.01675397': 'comment' });
  expectLine(g, ' dataset: 1 , wall: 09:17:14 [hours] , cpu: 09:15:14 [hours] <<< TIME',
    { '09:17:14': 'constant.numeric.time', hours: U });

  // YAML documents
  const doc = ['--- !ResultsGS'];
  expectLine(g, '--- !ResultsGS', { ResultsGS: 'markup.heading' });
  expectLine(g, 'etotal     :  -7.06936175E+01', { etotal: P, '-7.06936175E+01': N }, doc);
  expectLine(g, 'dimensions: {natom: 29, nkpt: 18, dtset: 1, }', { dimensions: P, natom: V, dtset: P, 29: N }, doc);
  expectLine(g, 'convergence: {deltae: -2.933E-10, diffor: null, }', { null: 'constant.language' }, doc);
  expectLine(g, "'-kT*entropy'       : -1.57710899060653E-01", { "'-kT*entropy'": P }, doc);
  expectLine(g, 'lattice_angles: [ 90.000,  90.000,  90.000, ] # degrees, (23, 13, 12)',
    { '# degrees, (23, 13, 12)': 'comment' }, doc);
  expectLine(g, '...', { '...': 'comment' }, doc);
  expectLine(g, '--- !WARNING', { WARNING: 'markup.deleted' });
  expectLine(g, '--- !ERROR', { ERROR: 'invalid.illegal' });
  const warn = ['--- !WARNING', 'src_file: m_mpinfo.F90', 'src_line: 83', 'message: |'];
  expectLine(g, '    nkpt*nsppol (18) is not a multiple of nproc_spkpt (16)', { 18: N }, warn);
  expectLine(g, '    The k-point parallelisation is INEFFICIENT: 1', { 'The k-point parallelisation is INEFFICIENT': null }, warn);
  expectLine(g, ' ETOT  3  -70.7', { ETOT: V }, [...warn, '    text', '...']);
}

async function testStructureGrammars() {
  console.log('xyz / POSCAR grammars');
  const xyz = await loadGrammar('source.xyz');
  const N = 'constant.numeric';
  const E = 'entity.name.tag';
  expectLine(xyz, '3', { 3: N });
  expectLine(xyz, 'Al 1 2 3 water molecule', { 'Al 1 2 3 water molecule': 'comment' }, ['3']);
  expectLine(xyz, 'O      0.000   0.000   0.117', { O: E, '0.117': N }, ['3', 'comment']);
  expectLine(xyz, 'H  0.0 0.7 -0.4  0.01 0.02 0.03', { H: E, '0.03': N }, ['3', 'comment']);

  const vasp = await loadGrammar('source.vasp');
  const head = ['Si8 cubic diamond', '1.0', '5.43 0 0', '0 5.43 0', '0 0 5.43'];
  expectLine(vasp, 'Si8 cubic diamond', { 'Si8 cubic diamond': 'comment' });
  expectLine(vasp, '   5.43  0.0  0.0', { '5.43': N }, head.slice(0, 2));
  expectLine(vasp, 'Si C', { Si: E, C: E }, head);
  expectLine(vasp, '8 1', { 8: N }, [...head, 'Si C']);
  expectLine(vasp, 'Selective dynamics', { 'Selective dynamics': 'keyword' }, [...head, 'Si C', '8 1']);
  expectLine(vasp, 'Direct', { Direct: 'keyword' }, [...head, 'Si C', '8 1']);
  expectLine(vasp, '  0.00 0.00 0.00  T T F  Si1', { '0.00': N, T: 'constant.language', F: 'constant.language', Si1: 'comment' },
    [...head, 'Si C', '8 1', 'Direct']);
}

async function testExamples() {
  const dir = path.join(ROOT, 'abinit_example');
  if (!fs.existsSync(dir)) return;
  console.log('abinit_example/');
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (scopeForFile(p) && fs.statSync(p).size < 5e6) files.push(p);
    }
  })(dir);
  for (const file of files) {
    const scope = scopeForFile(file);
    const grammar = await loadGrammar(scope);
    const t0 = Date.now();
    const lines = tokenize(grammar, fs.readFileSync(file, 'utf8'));
    const rel = path.relative(ROOT, file);
    let problems = 0;
    lines.forEach((tokens, i) => {
      for (const t of tokens) {
        const scopes = t.scopes.slice(1);
        if (scope === 'source.abinit' && t.text.trim() &&
            scopes.every((s) => s.startsWith('meta.') || s.startsWith('punctuation.'))) {
          if (problems++ < 5) fail(`${rel}:${i + 1} not highlighted: "${t.text}"`);
        }
        if (scope !== 'source.abinit' && scopes.some((s) => s.startsWith('invalid')) &&
            !/^(ERROR|BUG|FATAL|Error)$/.test(t.text)) {
          if (problems++ < 5) fail(`${rel}:${i + 1} unexpected error scope on "${t.text}"`);
        }
      }
    });
    checks++;
    console.log(`  ${rel.padEnd(48)} ${String(lines.length).padStart(6)} lines  ${Date.now() - t0} ms` +
      (problems ? `  (${problems} problems)` : ''));
  }
}

(async () => {
  await testRegexesCompile();
  await testAllVariables();
  await testInputGrammar();
  await testOutputGrammar();
  await testStructureGrammars();
  await testExamples();
  console.log(failures ? `\n${failures} of ${checks} checks FAILED` : `\nall ${checks} checks passed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
