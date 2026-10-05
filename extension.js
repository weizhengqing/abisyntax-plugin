'use strict';

const vscode = require('vscode');
const { detectQeLanguage } = require('./qe-detection');

function activate(context) {
  const seen = new Set();
  const eligible = new Set(['plaintext', 'abinit', 'abinit-output']);

  async function detect(document) {
    const key = document.uri.toString();
    // VS Code emits close/open again on a manual language change. Remember
    // open documents so detection never undoes the user's selection.
    if (seen.has(key)) return;
    seen.add(key);
    if (document.isClosed || !eligible.has(document.languageId)) return;
    if (!/\.(?:in|inp|inc|nml|dat|out|output|log|err)$/i.test(document.fileName)) return;
    const config = vscode.workspace.getConfiguration('abisyntax', document.uri);
    if (!config.get('detectQuantumEspresso', true)) return;
    const associations = vscode.workspace.getConfiguration('files', document.uri).get('associations', {});
    for (const pattern of Object.keys(associations)) {
      const glob = pattern.includes('/') ? pattern : `**/${pattern}`;
      if (vscode.languages.match({ pattern: glob }, document)) return;
    }
    const end = document.positionAt(65536);
    const language = detectQeLanguage(document.getText(new vscode.Range(new vscode.Position(0, 0), end)));
    if (language && !document.isClosed) {
      try {
        await vscode.languages.setTextDocumentLanguage(document, language);
      } catch (error) {
        // A document can close while the language switch is pending.
        if (!document.isClosed) console.warn('ABISyntax: QE detection failed', error);
      }
    }
  }

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(detect));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
    const key = document.uri.toString();
    setTimeout(() => {
      if (!vscode.workspace.textDocuments.some(d => d.uri.toString() === key)) seen.delete(key);
    }, 0);
  }));
  for (const document of vscode.workspace.textDocuments) void detect(document);
}

module.exports = { activate };
