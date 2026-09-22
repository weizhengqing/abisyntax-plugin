# Changelog

## 1.3.0

### Output files
- Every word is coloured now. Block titles (`Cartesian coordinates (xcart) [bohr]`,
  `... will be:`, `First record :`, upper-case log lines) use the heading colour; the words in front of a value
  (`Unit cell volume ucvol=`, `Fermi (or HOMO) energy (eV) =`, `; DEN or POT disk file :`, `znucl, zion, pspdat`)
  the name colour; sentences, notes and reference lists are secondary text (`comment.line.note`).
- ABINIT variables are also recognised inside sentences (`decrease tolsym to ...`), except those that are English
  words (`order`, `charge`, ...).
- Dates are coloured as a whole (`Thu 16 Apr 2026`, `Jul 2023`, `13h58`), not only their digits.
- Element symbols (`- Al  ONCVPSP-3.2.3.1`, `xred: - [..., Al]`), space groups, words inside `name(...)=`,
  `yes`/`no` of the build information, md5 checksums.
- Links also get a colour (some themes only underline them).
- Brackets: one colour everywhere. VS Code's bracket-pair colourisation is off for output files
  (`language-configuration-output.json`); unbalanced brackets were shown yellow, purple or red.
- Rows of numbers are matched as a whole, which keeps large log files fast.

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
