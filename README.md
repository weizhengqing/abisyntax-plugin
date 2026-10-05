# ABINIT & Quantum ESPRESSO Syntax Highlighting

A Visual Studio Code extension that adds syntax highlighting for [ABINIT](https://www.abinit.org/) and [Quantum ESPRESSO](https://www.quantum-espresso.org/) files:

- Input files: `.abi`, `.in`, `.inc`
- Output and log files: `.abo`, `.log`, `.err`, `.output`, `*_EIG`, `*_DDB`, `*_DOS`, ...
- Structure files: `.xyz`, POSCAR / CONTCAR
- QE inputs: namelists, parameter assignments (including array indices), Fortran
  numbers and booleans, strings, comments, structure cards, species and UPF filenames.
- QE outputs: program headers, energies, iterations, values and units,
  convergence, warnings, errors and `JOB DONE.`

## Quantum ESPRESSO

QE uses the same `.in` extension as ABINIT. When a file is opened, the extension
checks its first 64 KiB for a QE namelist or program banner and selects
**Quantum ESPRESSO** or **Quantum ESPRESSO Output**. Leading blank lines, comments
and titles are supported. Content detection covers `.in`, `.inp`, `.inc`, `.out`,
`.output`, `.log`, `.err`, `.nml` and `.dat`; `.pwi` / `.qei` and `.pwo` / `.qeo` select the QE
input and output modes directly.

The syntax catalog is extracted from the official [QE 7.6 source release](https://github.com/QEF/q-e/releases/tag/qe-7.6):
36 input documentation files and actual Fortran namelist declarations, plus the
GIPAW revision pinned by that release. It covers **64 namelists, 1,979 parameter
names, and 32 named cards**, including PWscf, CP, PHonon, NEB, HP, EPW, TDDFPT,
XSpectra, KCW, GWW, GIPAW and postprocessing utilities.

Parameter assignments are also highlighted generically, including indexed arrays
and derived-type parameters such as `ggwin%max_i`, so new or external parameters
do not need a catalog update to receive highlighting. Atomic orbital labels and
Hubbard parameters are supported. This extension does not validate variable names
or input correctness. Nameless utilities and external add-ons without a recognized
QE header can use the language selected manually in the status bar.

For a file without a recognizable header, select the language using the VS Code
status bar. New content is detected when the file is reopened. Explicit
`files.associations` settings and manual language selections take precedence.
To disable content detection, set `abisyntax.detectQuantumEspresso` to `false`.
For projects containing only QE files, an optional workspace setting is:

```json
"files.associations": {
  "*.in": "qe",
  "*.out": "qe-output"
}
```

`examples/` is local only: Git ignores it and VSIX packaging excludes it.

## Installation

1. Open VS Code and go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
2. Search for **ABINIT Syntax Highlighting** (publisher `weizhengqing`).
3. Click **Install**.

For a locally built version, run **Extensions: Install from VSIX...** and select
the generated `.vsix` file, then reload VS Code when prompted.

## Development

```sh
npm install
npm run build
npm test
```

The tests use VS Code's TextMate / Oniguruma tokenizer. If `examples/qe_examples/calc`
exists locally, they also verify detection and tokenization of its QE inputs and
outputs; these calculations are not needed for tests in a clean checkout.

Tests also check every catalog parameter (plain and indexed, lower and upper
case), every namelist and named card, all program banners, and the official QE
source examples when the locally downloaded sources are available.

To refresh the catalog from a downloaded QE source tree:

```sh
python3 tools/fetch_qe_syntax.py --source /path/to/qe --ref qe-7.6
npm run build
npm test
```

Add `--gipaw-source /path/to/qe-gipaw` to include that optional module. The
generated `qe-syntax-data.json` records source paths and the release reference;
`--archive /path/to/qe-7.6.tar.gz` also records the archive checksum. The extension
uses the bundled catalog offline and does not download QE at runtime.

## Repository

[https://github.com/weizhengqing/abisyntax-plugin](https://github.com/weizhengqing/abisyntax-plugin)
