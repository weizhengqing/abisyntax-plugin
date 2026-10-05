'use strict';

// Run with VS Code's --extensionDevelopmentPath and --extensionTestsPath.
const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const catalog = require('../qe-syntax-data.json');

async function run() {
  const results = [];
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'abisyntax-integration-'));
  const extension = vscode.extensions.getExtension('weizhengqing.abisyntax');
  assert(extension, 'development extension was not loaded');
  await extension.activate();

  async function open(name, text, expected) {
    const file = path.join(folder, name);
    await fs.writeFile(file, text);
    const uri = vscode.Uri.file(file);
    await vscode.workspace.openTextDocument(uri);
    const deadline = Date.now() + 5000;
    let document;
    do {
      document = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
      if (document && document.languageId === expected) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    } while (Date.now() < deadline);
    assert.equal(document?.languageId, expected, `${name} language`);
    results.push(`${name}: ${expected}`);
    return document;
  }

  try {
    await open('scf.in', '! input comment\n&control\n calculation="scf"\n/\n&system\n ecutwfc=45\n/', 'qe');
    await open('xspectra.in', 'XANES example\n&input_xspectra\n xonly_plot=.false.\n/', 'qe');
    await open('projwfc.in', '&projwfc\n prefix="Al"\n/', 'qe');
    await open('scf.out', '\n Program PWSCF v.7.5 starts on ...\n! total energy = -10 Ry\n JOB DONE.', 'qe-output');
    await open('slurm.log', 'job preamble\n\n Program XSpectra v.7.5 starts on ...', 'qe-output');
    await open('abinit.in', 'ecut 30\nnatom 1\nxred 0 0 0', 'abinit');
    await open('optic.in', '&FILES\n ddkfile_1="file"\n/', 'abinit');
    await open('structure.pwi', 'ATOMIC_POSITIONS crystal\nAl 0 0 0', 'qe');
    await open('neb.dat', 'BEGIN\nBEGIN_PATH_INPUT\n&path\n/\nEND_PATH_INPUT\nEND', 'qe');
    await open('epw.nml', 'EPW title\n&inputepw\n ep_coupling=.true.\n/', 'qe');
    for (const name of catalog.namelists) {
      await open(`namelist-${name}.in`, `! official namelist\n&${name}\n/`, 'qe');
    }
    const document = await open('manual.in', '! comment\n&control\n/', 'qe');
    await vscode.languages.setTextDocumentLanguage(document, 'abinit');
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(vscode.workspace.textDocuments.find(d => d.uri.toString() === document.uri.toString()).languageId, 'abinit');
    results.push('manual selection is preserved');

    const associations = vscode.workspace.getConfiguration('files');
    await associations.update('associations', { '*.in': 'abinit' }, vscode.ConfigurationTarget.Global);
    await open('associated.in', '! comment\n&control\n/', 'abinit');
    await associations.update('associations', undefined, vscode.ConfigurationTarget.Global);
    const settings = vscode.workspace.getConfiguration('abisyntax');
    await settings.update('detectQuantumEspresso', false, vscode.ConfigurationTarget.Global);
    await open('disabled.in', '! comment\n&control\n/', 'abinit');
    await settings.update('detectQuantumEspresso', undefined, vscode.ConfigurationTarget.Global);
    console.log(`PASS VS Code integration: ${results.join('; ')}`);
    if (process.env.ABISYNTAX_TEST_REPORT) {
      await fs.writeFile(process.env.ABISYNTAX_TEST_REPORT, JSON.stringify({ passed: true, results }, null, 2));
    }
  } catch (error) {
    if (process.env.ABISYNTAX_TEST_REPORT) {
      await fs.writeFile(process.env.ABISYNTAX_TEST_REPORT, JSON.stringify({ passed: false, results, error: String(error) }, null, 2));
    }
    throw error;
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
}

module.exports = { run };
