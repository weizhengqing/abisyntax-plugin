# ABINIT VS Code Extension

Syntax highlighting for [ABINIT](https://www.abinit.org/) input and output files in Visual Studio Code.

## Features

### Input files (`.abi`, `.in`, `.inc`)

- **Every ABINIT input variable** (1400+), taken from the official ABINIT sources: abinit, anaddb, optic,
  multibinit, aim and atdep, including developer and legacy variables.
- Multi-dataset syntax: `ecut12`, `ecut?1`, `ecut1?`, series `ecut:` / `ecut+` / `ecut*`, `tsmear:?`, ...
- Image suffixes: `acell_1img`, `xred_lastimg`; optic namelists (`&FILES`, `ddkfile_1 = '...'`).
- Numbers in all Fortran forms (`1.0d-9`, `.5`, `5.`), repetitions (`3*1.0`), fractions (`1/3`), `sqrt(0.75)`.
- Physical units accepted by ABINIT (`Bohr`, `Angstrom`, `Ha`, `eV`, `meV`, `Ry`, `K`, `T`, `fs`, ...).
- Quoted strings with `$ENV` variables, unquoted paths (`xyzfile ../geo.xyz`), `include '...'`.
- `#` and `!` comments.
- Unknown words are left uncoloured, so a typo such as `ecutt` stands out against the highlighted variables.

### Output files (`.abo`, `.log`, `.err`, `.output`, `*_EIG`, `*_DDB`, `*_DOS`, `*_PHFRQ`, `*_GW`, `*_SIGRES`)

- Section titles (`== DATASET 1 ==`, `--- Iteration ...`, `---OUTPUT---`, `-outvars: ...`) and separators; block
  titles such as `Cartesian coordinates (xcart) [bohr]` or `Exchange-correlation functional ... will be:`.
- Descriptive labels in front of values (`Unit cell volume ucvol=`, `Fermi (or HOMO) energy (eV) =`,
  `znucl, zion, pspdat`); explanatory sentences, notes and reference lists as secondary text, so that every word
  has a colour.
- Dates (`Thu 16 Apr 2026`, `13h58`), element symbols, space groups.
- Echo of input variables and the memory summary, with the same colour as in input files.
- Embedded YAML documents (`--- !ResultsGS`, `--- !DatasetInfo`, `--- !WARNING`, ...) with keys, values and
  `message: |` blocks.
- `ERROR`/`BUG` in red, `WARNING`s and "not converged" highlighted, "is converged" / "Calculation completed."
  marked as success.
- File paths, output file names (`runo_GSR.nc`), URLs, units, versions and timings.
- Log files of the other ABINIT tools (cut3d, anaddb, ...) use the same grammar.

### Structure files

- XYZ (`.xyz`, also multi-frame trajectories) and VASP POSCAR/CONTCAR (`POSCAR*`, `CONTCAR*`, `.vasp`,
  `.poscar`) including selective-dynamics flags.

### Colours

The grammars only use standard TextMate scopes, so every colour theme gives a consistent palette:

| Element                                  | Scope                         |
| ---------------------------------------- | ----------------------------- |
| ABINIT variable                          | `keyword.other.variable`      |
| Other named quantity / YAML key          | `support.type.property-name`  |
| Number, dataset index                    | `constant.numeric`            |
| Unit                                     | `keyword.other.unit`          |
| String, path, file name                  | `string`                      |
| Comment, separator line                  | `comment`                     |
| Section / block title                    | `markup.heading`              |
| Explanatory text, notes, references      | `comment.line.note`           |
| Date, time                               | `constant.numeric.date` / `.time` |
| Element symbol, space group              | `constant.language`           |
| Error / warning / success                | `invalid` / `markup.deleted` / `markup.inserted` |

Individual colours can be changed with
[`editor.tokenColorCustomizations`](https://code.visualstudio.com/docs/getstarted/themes#_editor-syntax-highlighting),
e.g. `"textMateRules": [{"scope": "keyword.other.variable.abinit", "settings": {"foreground": "#4FC1FF"}}]`,
or `{"scope": "comment.line.note.abinit", "settings": {"foreground": "#D4D4D4"}}` to show explanatory text in the
default colour again.

VS Code's bracket-pair colours are switched off in output files: brackets there are often unbalanced (a `(` in
one line and the `)` in another), which made them yellow, purple or red at random.

## Installation

1. Visit the [Releases Page](https://github.com/weizhengqing/abisyntax-plugin/releases).
2. Download the latest `abisyntax-X.X.X.vsix` package.
3. Open VS Code and go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
4. Click on the `...` menu in the top right corner and select **"Install from VSIX..."**.
5. Select the downloaded `.vsix` file to install it.

## Development

The input and output grammars are generated; edit `tools/build_grammars.py`, not the JSON files.

```sh
npm install                  # test dependencies (vscode-textmate, vscode-oniguruma)
npm run build                # regenerate syntaxes/abinit*.tmLanguage.json
npm test                     # regression tests (also scans abinit_example/ if present)
npm run update-variables     # refresh the variable list from github.com/abinit/abinit, then build

node test/dump.js FILE --shapes              # show how each distinct line is tokenized
node test/preview.js out.html FILE[:10-80]   # render with a VS Code theme (--theme dark_vs, light_plus, ...)

npx @vscode/vsce package     # build the .vsix
```

## Repository

Source code and issue tracking are hosted on GitHub:
[https://github.com/weizhengqing/abisyntax-plugin](https://github.com/weizhengqing/abisyntax-plugin)
