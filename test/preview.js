#!/usr/bin/env node
// Render files to a self-contained HTML page with a real VS Code theme, to
// eyeball the colours without installing the extension.
//
//   node test/preview.js out.html [--theme dark_vs|dark_plus|light_plus|...] file[:from-to] ...
//
// Themes are read from the local VS Code installation (macOS path by default,
// override with VSCODE_THEMES=/path/to/extensions/theme-defaults/themes).
'use strict';

const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const { getRegistry, scopeForFile } = require('./grammar');

const THEMES = process.env.VSCODE_THEMES ||
  '/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/theme-defaults/themes';

function readTheme(name) {
  const file = path.join(THEMES, `${name}.json`);
  // theme files are JSON with comments / trailing commas
  // eslint-disable-next-line no-eval
  const theme = eval(`(${fs.readFileSync(file, 'utf8')})`);
  const base = theme.include ? readTheme(path.basename(theme.include, '.json')) : { tokenColors: [], colors: {} };
  return {
    tokenColors: [...base.tokenColors, ...(theme.tokenColors || [])],
    colors: { ...base.colors, ...(theme.colors || {}) },
  };
}

function toSettings(theme) {
  const settings = [{ settings: { foreground: theme.colors['editor.foreground'] || '#D4D4D4',
    background: theme.colors['editor.background'] || '#1E1E1E' } }];
  for (const r of theme.tokenColors) {
    const scopes = Array.isArray(r.scope) ? r.scope : (r.scope || '').split(',').map((s) => s.trim());
    settings.push({ scope: scopes.filter(Boolean), settings: r.settings });
  }
  return settings;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function main() {
  const args = process.argv.slice(2);
  const out = args.shift();
  let themeName = 'dark_vs';
  const ti = args.indexOf('--theme');
  if (ti >= 0) { themeName = args[ti + 1]; args.splice(ti, 2); }
  const theme = readTheme(themeName);
  const registry = await getRegistry();
  registry.setTheme({ name: themeName, settings: toSettings(theme) });
  const colorMap = registry.getColorMap();
  let html = `<!doctype html><meta charset="utf-8"><style>
    body{background:${theme.colors['editor.background'] || '#1E1E1E'};color:${theme.colors['editor.foreground'] || '#D4D4D4'};
    font:13px/1.45 Menlo,monospace;margin:0;padding:8px 14px}
    h3{font:600 12px sans-serif;color:#888;margin:14px 0 4px}
    pre{margin:0;white-space:pre}
    .n{color:#666;display:inline-block;width:5ch;text-align:right;margin-right:1.5ch;user-select:none}
  </style>`;
  for (const spec of args) {
    const [file, range] = spec.split(':');
    const scope = scopeForFile(file);
    const grammar = await registry.loadGrammar(scope);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const [from, to] = range ? range.split('-').map(Number) : [1, lines.length];
    const s = { file, scope, lines, from, to };
    let stack = vsctm.INITIAL;
    html += `<h3>${esc(path.basename(s.file))} &middot; ${s.scope} &middot; ${themeName}</h3><pre>`;
    s.lines.forEach((line, i) => {
      const r = grammar.tokenizeLine2(line, stack);
      stack = r.ruleStack;
      if (i + 1 < s.from || i + 1 > s.to) return;
      let rowHtml = '';
      for (let k = 0; k < r.tokens.length; k += 2) {
        const start = r.tokens[k];
        const end = k + 2 < r.tokens.length ? r.tokens[k + 2] : line.length;
        const meta = r.tokens[k + 1];
        // vscode-textmate token metadata: fontStyle bits 11-14, foreground bits 15-23
        const fg = colorMap[(meta >>> 15) & 0x1ff];
        const fs_ = (meta >>> 11) & 0xf;
        const style = `color:${fg}` + (fs_ & 2 ? ';font-weight:bold' : '') + (fs_ & 1 ? ';font-style:italic' : '') +
          (fs_ & 4 ? ';text-decoration:underline' : '');
        rowHtml += `<span style="${style}">${esc(line.slice(start, end))}</span>`;
      }
      html += `<span class="n">${i + 1}</span>${rowHtml}\n`;
    });
    html += '</pre>';
  }
  fs.writeFileSync(out, html);
  console.log(`wrote ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
