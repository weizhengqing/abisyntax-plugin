// Loads the extension's grammars with the same engine VS Code uses
// (vscode-textmate + oniguruma) so that tests reflect real highlighting.
'use strict';

const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const ROOT = path.resolve(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));

const grammarPaths = {};
for (const g of pkg.contributes.grammars) {
  grammarPaths[g.scopeName] = path.join(ROOT, g.path);
}

let registryPromise;
function getRegistry() {
  if (!registryPromise) {
    const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer;
    const onigLib = oniguruma.loadWASM(wasm).then(() => ({
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (s) => new oniguruma.OnigString(s),
    }));
    registryPromise = Promise.resolve(new vsctm.Registry({
      onigLib,
      loadGrammar: async (scopeName) => {
        const p = grammarPaths[scopeName];
        if (!p) return null;
        return vsctm.parseRawGrammar(fs.readFileSync(p, 'utf8'), p);
      },
    }));
  }
  return registryPromise;
}

async function loadGrammar(scopeName) {
  const grammar = await (await getRegistry()).loadGrammar(scopeName);
  if (!grammar) throw new Error(`cannot load grammar ${scopeName}`);
  return grammar;
}

/** Tokenize text; returns [[{text, scopes}]] (one array per line). */
function tokenize(grammar, text) {
  let ruleStack = vsctm.INITIAL;
  return text.split(/\r?\n/).map((line) => {
    const r = grammar.tokenizeLine(line, ruleStack);
    ruleStack = r.ruleStack;
    return r.tokens.map((t) => ({
      text: line.substring(t.startIndex, t.endIndex),
      scopes: t.scopes,
    }));
  });
}

/** Map a file name to the scope name VS Code would pick, using package.json. */
function scopeForFile(file) {
  const base = path.basename(file);
  const glob = (pat) => new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  for (const lang of pkg.contributes.languages) {
    const hit = (lang.filenames || []).includes(base) ||
      (lang.filenamePatterns || []).some((p) => glob(p).test(base)) ||
      (lang.extensions || []).some((e) => base.endsWith(e));
    if (hit) return pkg.contributes.grammars.find((g) => g.language === lang.id).scopeName;
  }
  return null;
}

module.exports = { getRegistry, loadGrammar, tokenize, scopeForFile, ROOT };
