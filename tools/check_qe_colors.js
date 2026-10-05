'use strict';

// Check actual TextMate theme resolution, rather than just scope presence.
// Optionally compare with a previous Git tag: --baseline v1.3.2
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const textmate = require('vscode-textmate');
const onig = require('vscode-oniguruma');
const root = path.resolve(__dirname, '..');
const packageJson = require('../package.json');
const options = process.argv.slice(2);
const baseline = options.includes('--baseline') ? options[options.indexOf('--baseline') + 1] : undefined;
const themeFolder = options.includes('--theme-dir') ? options[options.indexOf('--theme-dir') + 1] :
  '/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/theme-defaults/themes';

function loadTheme(file) {
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  const parent = current.include ? loadTheme(path.resolve(path.dirname(file), current.include)) : { colors: {}, tokenColors: [] };
  return { colors: { ...parent.colors, ...current.colors }, tokenColors: [...parent.tokenColors, ...(current.tokenColors || [])] };
}

async function main() {
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await onig.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const samples = [
    { language: 'qe', text: '&control\n calculation="scf", prefix="Si"\n/\n&system\n celldm(1)=30.86131988\n/\nATOMIC_SPECIES\nSih 28.085500 Si.Khole.zv5.UPF\nATOMIC_POSITIONS crystal\nSih 0.0 0.0 0.0\nK_POINTS automatic\n4 4 4 0 0 0' },
    { language: 'qe', text: "&input_xspectra\n prefix='it''s a test', xonly_plot=.false. ! comment\n r_paw(1:3)=3*2.0, ggwin%max_i=5\n&END\n# comment\nHUBBARD (ortho-atomic)\nU Fe-3d 4.0\nunknown_bare_value @ ?\n2S 1 0 2.00" },
    { language: 'qe-output', text: ' Program PWSCF v.7.5 starts on 4Jul2026 at 21:17:37\nThis program is part of the open-source Quantum ESPRESSO suite\nParallelization info\nsticks: dense smooth PW G-vecs: dense smooth PW\nMin 2461 984 259 197471 49972 6802\nMD5 check sum: 29db7f4633594bd997459ec8b07a2523\nPseudo is Projector augmented-wave + core cor, Zval = 4.0\nGenerated using ATOMPAW code\nCartesian axes\nsite n. atom positions (alat units)\n1 Sih tau(1) = (0.0000000 0.0000000 0.0000000)\nhttp://www.quantum-espresso.org/quote\n/beegfs-home/user/calc/mp-149/pseudo/Si.ground.UPF' },
    { language: 'qe-output', text: "! total energy = -123.456 Ry\nWARNING: variable ef_r is obsolete\n%%%%%%%%%%%%\nError in routine read_namelists (1)\nbad input data\n%%%%%%%%%%%%\nconvergence has been achieved in 12 iterations\nJOB DONE.\n( 1.0D+00 1.D-9 )\ninit_us_2 : 2.24s CPU 2.26s WALL (51 calls)\ncalculation: 'xanes_dipole'\n" },
  ];
  const sampleDirectory = path.join(root, 'examples/qe_examples/calc/mp-149/core_hole');
  for (const file of ['scf_SiaK.in', 'scf_SiaL.in', 'scf_SiaK.out', 'scf_SiaL.out', 'xspectra_SiaK.in', 'xspectra_SiaK.out']) {
    const filePath = path.join(sampleDirectory, file);
    if (fs.existsSync(filePath)) samples.push({ language: file.endsWith('.in') ? 'qe' : 'qe-output', text: fs.readFileSync(filePath, 'utf8'), file });
  }
  const reports = [];
  for (const filename of ['dark_vs.json', 'dark_plus.json', 'light_vs.json', 'light_plus.json']) {
    const theme = loadTheme(path.join(themeFolder, filename));
    const foreground = theme.colors['editor.foreground'] || (filename.startsWith('dark') ? '#D4D4D4' : '#000000');
    for (const ref of [undefined, ...(baseline ? [baseline] : [])]) {
      const registry = new textmate.Registry({
        theme: { name: filename, settings: [{ settings: { foreground } }, ...theme.tokenColors] },
        onigLib: Promise.resolve({ createOnigScanner: p => new onig.OnigScanner(p), createOnigString: s => new onig.OnigString(s) }),
        loadGrammar: async scope => {
          const spec = packageJson.contributes.grammars.find(g => g.scopeName === scope);
          if (!spec) return null;
          const file = spec.path.replace(/^\.\//, '');
          const source = ref ? cp.execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, file), 'utf8');
          return textmate.parseRawGrammar(source, file);
        },
      });
      let visible = 0, defaultColored = 0;
      const misses = [];
      for (const sample of samples) {
        const grammar = await registry.loadGrammar(`source.${sample.language}`);
        let stack = textmate.INITIAL;
        for (const [index, line] of sample.text.split(/\r?\n/).entries()) {
          const result = grammar.tokenizeLine2(line, stack);
          stack = result.ruleStack;
          assert(!result.stoppedEarly);
          const colors = registry.getColorMap();
          for (let i = 0; i < result.tokens.length; i += 2) {
            const end = i + 2 < result.tokens.length ? result.tokens[i + 2] : line.length;
            const text = line.slice(result.tokens[i], end);
            const count = text.replace(/\s/g, '').length;
            visible += count;
            const color = colors[(result.tokens[i + 1] >>> 15) & 0x1ff];
            if (count && color.toUpperCase() === foreground.toUpperCase()) {
              defaultColored += count;
              if (misses.length < 8) misses.push({ file: sample.file || 'fixture', line: index + 1, text });
            }
          }
        }
      }
      reports.push({ theme: filename, ref: ref || 'current', visible, defaultColored, misses });
      if (!ref) assert.equal(defaultColored, 0, JSON.stringify(reports.at(-1)));
      registry.dispose();
    }
  }
  console.log(JSON.stringify(reports, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
