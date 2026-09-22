# Changelog

## 1.2.0

### Input files
- Variable list regenerated from the official ABINIT sources (documentation database and the parsers'
  whitelists): 1415 variables. The anaddb, optic, multibinit, aim and atdep variables were previously listed
  as `name@code` and therefore never matched; they are highlighted now.
- Multi-dataset suffixes (`ecut?1`, `ecut:`, `ecut+`, `ecut*`, `tsmear:?`, ...) and image suffixes
  (`acell_1img`, `xred_lastimg`) are recognised; previously only trailing digits worked.
- Numbers: repetitions (`3*1.0`), fractions (`1/3`), `sqrt(...)`; units follow ABINIT's list
  (`Angstr`, `nm`, `K`, `T`, `fs`, ...) and only match whole words.
- `$ENV` variables in strings, `include` directive, unquoted values of all string variables, optic namelists,
  `SpinPolarized T/F`, `=` between name and value.

### Output files
- Rewritten. Values are no longer coloured as strings (the orange/green mix after `key :`), plain prose is left
  uncoloured, and each kind of element has one colour everywhere.
- New: section titles, variable echo, embedded YAML documents, `message: |` blocks, WARNING/ERROR/COMMENT,
  convergence messages, file names, versions, clock times, `_DDB`/`_EIG`/`_DOS` layouts.
- `#` only starts a comment at the beginning of a line or inside YAML (it no longer swallows `kpt#`, `(# 6)` or
  URLs).

### Structure files
- XYZ: multi-frame trajectories, extra columns.
- POSCAR: title line, species line, `Selective dynamics`, T/F flags. `POSCAR`/`CONTCAR` are now matched as file
  names (they were wrongly declared as extensions).

### Packaging
- Binary files (`DEN`, `GSR`, `*_DEN`, `*_POT`) are no longer associated with the output language.
- `.vscodeignore` keeps examples, tests and tools out of the `.vsix`.
- Grammar generator (`tools/`), regression tests and preview tools (`test/`).
