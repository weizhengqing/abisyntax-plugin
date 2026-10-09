'use strict';

const catalog = require('./vasp-syntax-data.json');
const tags = new Set([...catalog.incar_tags, ...(catalog.source_incar_tags || [])]);
const families = [...catalog.tag_families, ...(catalog.source_tag_families || [])].map(f => new RegExp(`^(?:${f.pattern})$`, 'i'));

function stripStringsAndComments(text) {
  let quote, comment = false, clean = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (comment) {
      if (c === '\n' || c === '\r') { comment = false; clean += c; }
      else clean += ' ';
    } else if (quote) {
      if (c === '\\' && i + 1 < text.length) { clean += '  '; i++; }
      else { if (c === quote) quote = undefined; clean += /[\r\n]/.test(c) ? c : ' '; }
    } else if (c === '"' || c === "'") { quote = c; clean += ' '; }
    else if (c === '#' || c === '!') { comment = true; clean += ' '; }
    else clean += c;
  }
  return clean;
}

// Shared extensions need positive VASP evidence, not generic key=value syntax.
function detectVaspLanguage(text) {
  const head = text.slice(0, 65536).replace(/^\uFEFF/, '');
  if (/^\s*vasp\.\d+\.\d+/im.test(head) ||
      (/^\s*(?:DAV|RMM):\s*\d+\s+[-+.\d]/m.test(head) && /^\s*\d+\s+F=\s*[-+.\d]/m.test(head))) {
    return 'vasp-output';
  }
  // Quoted multiline strings can contain apparent assignments; don't use
  // them or comment text as evidence. Distinct known tags reduce collisions.
  const clean = stripStringsAndComments(head);
  const found = new Set();
  for (const match of clean.matchAll(/(?:^|[;\n\r])\s*([A-Za-z_][\w/]*)(?=\s*=)/g)) {
    const name = match[1].toUpperCase();
    if ((tags.has(name) || families.some(re => re.test(name))) && name !== 'SYSTEM') found.add(name);
  }
  if (found.size >= 2) return 'vasp-input';
  return undefined;
}

module.exports = { detectVaspLanguage };
