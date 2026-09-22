#!/usr/bin/env node
// Print how a file is tokenized, in a compact form:  V[ecut] N[30] U[Ha] C[# note]
//
//   node test/dump.js <file> [--shapes] [--scope source.abinit]
//
// --shapes  prints every distinct "line shape" (numbers collapsed) only once,
//           which makes it practical to review multi-MB log files.
'use strict';

const fs = require('fs');
const { loadGrammar, tokenize, scopeForFile } = require('./grammar');

const TAGS = [
  ['invalid', 'ERR'],
  ['markup.deleted', 'WARN'],
  ['markup.inserted', 'OK'],
  ['markup.changed', 'NOTE'],
  ['markup.heading', 'H'],
  ['markup.underline.link', 'URL'],
  ['keyword.other.variable', 'V'],
  ['keyword.other.unit', 'U'],
  ['keyword.control', 'K'],
  ['keyword.operator', 'OP'],
  ['support.type.property-name', 'P'],
  ['support.function', 'F'],
  ['constant.numeric', 'N'],
  ['constant.language', 'B'],
  ['string', 'S'],
  ['comment', 'C'],
  ['variable.other.environment', 'ENV'],
  ['storage', 'ST'],
];

function tagOf(scopes) {
  for (let i = scopes.length - 1; i > 0; i--) {
    for (const [prefix, tag] of TAGS) {
      if (scopes[i].startsWith(prefix)) return tag;
    }
  }
  return '';
}

function render(tokens) {
  // merge adjacent tokens with the same tag
  const out = [];
  for (const t of tokens) {
    const tag = tagOf(t.scopes);
    const last = out[out.length - 1];
    if (last && last.tag === tag) last.text += t.text;
    else out.push({ tag, text: t.text });
  }
  return out.map((s) => (s.tag && s.text.trim() ? `${s.tag}[${s.text}]` : s.text)).join('');
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const shapes = args.includes('--shapes');
  const si = args.indexOf('--scope');
  const scope = si >= 0 ? args[si + 1] : scopeForFile(file);
  if (!file || !scope) {
    console.error('usage: node test/dump.js <file> [--shapes] [--scope <scopeName>]');
    process.exit(2);
  }
  const grammar = await loadGrammar(scope);
  const lines = tokenize(grammar, fs.readFileSync(file, 'utf8'));
  const seen = new Set();
  lines.forEach((tokens, i) => {
    const text = render(tokens);
    if (shapes) {
      const key = text.replace(/[-+]?\d*\.?\d+([EeDd][-+]?\d+)?/g, '0').replace(/\s+/g, ' ');
      if (seen.has(key)) return;
      seen.add(key);
    }
    console.log(`${String(i + 1).padStart(6)}| ${text}`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
