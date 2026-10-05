'use strict';

// Look for QE-specific records, rather than claiming every .in/.out file.
// Titles/comments and blank lines before the namelist/banner are common.
const catalog = require('./qe-syntax-data.json');
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NAMELISTS = catalog.namelists.map(escape).join('|');
const INPUT = new RegExp(`^\\s*&(?:${NAMELISTS})\\b`, 'im');
const OUTPUT = new RegExp(`^\\s*Program\\s+(?:${catalog.programs.map(escape).join('|')})\\s+v\\.[\\d.]+`, 'im');

function detectQeLanguage(text) {
  const head = text.slice(0, 65536).replace(/^\uFEFF/, '');
  if (OUTPUT.test(head) || (/^\s*Program\s+\S+\s+v\.[\d.]+/im.test(head) && /Quantum ESPRESSO suite/i.test(head))) return 'qe-output';
  if (INPUT.test(head) || /^\s*BEGIN_(?:ENGINE|PATH)_INPUT\s*$/im.test(head)) return 'qe';
  return undefined;
}

module.exports = { detectQeLanguage, NAMELISTS };
