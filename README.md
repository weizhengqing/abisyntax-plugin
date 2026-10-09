# ABINIT, Quantum ESPRESSO & VASP Syntax Highlighting

A Visual Studio Code extension for highlighting input, output and structure files
used by ABINIT, Quantum ESPRESSO and VASP.

## Supported files

| Software / format | Common files |
| --- | --- |
| ABINIT | `.abi`, `.in`, `.inc`, `.abo`, `.output`, `.log`, `.err`, `*_EIG`, `*_DDB`, `*_DOS` |
| Quantum ESPRESSO | `.in`, `.inp`, `.inc`, `.nml`, `.dat`, `.pwi`, `.qei`, `.out`, `.output`, `.pwo`, `.qeo`, `.log`, `.err` |
| VASP | `INCAR`, `STOPCAR`, `KPOINTS`, `IBZKPT`, `POTCAR`, `POSCAR`, `CONTCAR`, `OUTCAR`, `OSZICAR`, `ICONST`, `vasprun.xml` |
| VASP text data | `CHG`, `CHGCAR`, `DOSCAR`, `EIGENVAL`, `PROCAR`, `LOCPOT`, `ELFCAR`, `PARCHG`, `XDATCAR`, `REPORT`, and related files |
| Structure formats | `.xyz`, `.vasp`, `.poscar` |

Supports parameter names, numbers, strings, comments, structures, energies and
calculation diagnostics. Common VASP filename variants such as `INCAR.relax`
and `OUTCAR.1` are also recognized.

Files are detected automatically where possible. If needed, select the language
from the VS Code status bar. Highlighting does not validate calculation settings.

## Installation

In VS Code, run **Extensions: Install from VSIX...**, select the `.vsix` package,
and reload the window when prompted.

[GitHub repository](https://github.com/weizhengqing/abisyntax-plugin)
