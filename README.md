# ABINIT VS Code Extension

A comprehensive syntax highlighting extension for [ABINIT](https://www.abinit.org/) input and output files in Visual Studio Code.

## Features

This extension provides specialized syntax highlighting tailored for the different structures of ABINIT files:

### 1. ABINIT Input Files (`.abi`, `.in`)
- **Full Parameter Support**: Recognizes and highlights all 1380+ official ABINIT variables (including dataset index suffixes like `acell1`, `ecut2`).
- **Data Types**: Accurately highlights numbers, strings, booleans (`.true.`, `.false.`), and comments (`#`, `!`).
- **Bracket Matching**: Auto-closing pairs and bracket matching for `[]`, `()`, `""`, `''`.

### 2. ABINIT Output & Log Files (`.abo`, `.log`, `.err`, `*_EIG`, `*_DDB`, `*_DEN`, `*_POT`)
- **Output-Specific Grammar**: A separate, strictly-tuned grammar for output files that displays standard verbose text (like version information, copyright, and intro messages) as clean text without accidentally highlighting them as parameters.
- **Log Structures**: Highlights delimiters (`====`, `----`), section headers, list items (`- `), and YAML dataset blocks (`--- !DatasetInfo`).
- **Key-Value Pairs**: Accurately highlights properties like `C compiler : gnu7.3` and typical output table variables (`kpt#`, `Etot`, `deltaE`, etc.).
- **Warning & Errors**: Captures and highlights runtime warnings and errors to make them stand out.

## Installation

1. Visit the [Releases Page](https://github.com/weizhengqing/abinit-vscode/releases).
2. Download the latest `abinit-X.X.X.vsix` package.
3. Open VS Code and go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
4. Click on the `...` menu in the top right corner and select **"Install from VSIX..."**.
5. Select the downloaded `.vsix` file to install it.

## Repository

Source code and issue tracking are hosted on GitHub:
[https://github.com/weizhengqing/abinit-vscode](https://github.com/weizhengqing/abinit-vscode)
