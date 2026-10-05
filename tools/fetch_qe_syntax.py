#!/usr/bin/env python3
"""Extract QE input syntax from an official, locally downloaded source tree.

Usage: python3 tools/fetch_qe_syntax.py --source examples/qe-source/QEF-q-e-...

Reads INPUT*.def documentation and actual Fortran NAMELIST declarations. No
downloaded Tcl/Fortran is executed. The compact catalog is shipped with the
extension; the downloaded source stays local in examples/.
"""
import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'qe-syntax-data.json'
IDENTIFIER = r'[A-Za-z_]\w*'


def braced_body(text, start):
    """Find the end of a Tcl braced body without evaluating any Tcl."""
    depth = 1
    index = start
    while index < len(text):
        char = text[index]
        if char == '\\':
            index += 2
            continue
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return text[start:index]
        index += 1
    raise ValueError('unbalanced documentation body')


def fortran_statements(text):
    """Free-form statements, with comments removed and continuations joined."""
    pending = ''
    for line in text.splitlines():
        if line.lstrip().startswith('#'):
            continue
        # Keep ! inside quoted strings (including Fortran doubled quotes).
        line = re.sub(r'''("(?:[^"\n]|"")*"|'(?:[^'\n]|'')*')|(!.*$)''',
                      lambda m: m[1] or '', line).strip()
        if not line:
            continue
        line = line.lstrip('&').rstrip()
        continuation = line.endswith('&')
        pending += ' ' + (line[:-1] if continuation else line)
        if not continuation:
            yield pending.strip()
            pending = ''
    if pending:
        yield pending.strip()


def derived_parameters(statements):
    """Resolve local NAMELIST derived-type members, e.g. ggwin%max_i."""
    types, instances = {}, {}
    current = None
    for statement in statements:
        start = re.match(rf'(?i)^type\s+(?:::)?\s*({IDENTIFIER})\s*$', statement)
        if start:
            current = start[1].lower()
            types[current] = set()
        elif re.match(r'(?i)^end\s*type\b', statement):
            current = None
        elif current and '::' in statement:
            # Component declarations in the input structure are scalar/array
            # identifiers; defaults and dimensions are not parameter names.
            declaration = statement.split('::', 1)[1]
            depth, quote, part, pieces = 0, None, '', []
            for char in declaration:
                if quote:
                    if char == quote:
                        quote = None
                elif char in "'\"":
                    quote = char
                elif char == '(':
                    depth += 1
                elif char == ')':
                    depth -= 1
                if char == ',' and not quote and depth == 0:
                    pieces.append(part)
                    part = ''
                else:
                    part += char
            pieces.append(part)
            for piece in pieces:
                match = re.match(rf'\s*({IDENTIFIER})', piece)
                if match:
                    types[current].add(match[1].lower())
        else:
            instance = re.match(rf'(?i)^type\s*\(\s*({IDENTIFIER})\s*\)[^:]*::\s*({IDENTIFIER})', statement)
            if instance:
                instances[instance[2].lower()] = instance[1].lower()
    return {name: {f'{name}%{member}' for member in types.get(kind, [])}
            for name, kind in instances.items()}


def extract(source, ref, archive=None):
    namelists = defaultdict(set)
    definitions = {}
    source_namelists = {}
    cards = set()
    programs = set()
    skipped = {'external', 'test-suite', 'examples', 'tests', 'test', 'dev-tools'}

    for file in sorted(source.rglob('INPUT*.def')):
        relative = file.relative_to(source)
        if skipped.intersection(relative.parts):
            continue
        text = file.read_text(errors='replace')
        program = re.search(r'input_description\b[^\n]*-program\s+(\S+)', text)
        if not program:
            continue
        record = {'program': program[1], 'namelists': {}, 'cards': []}
        programs.add(program[1].removesuffix('.x'))
        for match in re.finditer(rf'^\s*namelist\s+({IDENTIFIER})\s*\{{', text, re.M):
            name = match[1].lower()
            body = braced_body(text, match.end())
            variables = set(re.findall(rf'^\s*(?:var|dimension|multidimension)\s+({IDENTIFIER})', body, re.M))
            record['namelists'][name] = sorted(v.lower() for v in variables)
            namelists[name].update(v.lower() for v in variables)
        for match in re.finditer(rf'^\s*(?:card|supercard)\s+({IDENTIFIER})([^\n{{]*)\{{', text, re.M):
            name, attributes = match[1], match[2]
            if re.search(r'-nameless\s+1\b', attributes):
                continue  # A documentation label, not a literal input card.
            if attributes.strip() and not attributes.lstrip().startswith('-'):
                continue
            record['cards'].append(name.upper())
            cards.add(name.upper())
            end = re.search(r'-endtag\s+(\w+)', attributes)
            if end:
                cards.add(end[1].upper())
        definitions[relative.as_posix()] = record

    for file in sorted(source.rglob('*')):
        if file.suffix.lower() != '.f90' or not file.is_file():
            continue
        relative = file.relative_to(source)
        if skipped.intersection(relative.parts):
            continue
        text = file.read_text(errors='replace')
        found = {}
        statements = list(fortran_statements(text))
        members = derived_parameters(statements)
        joined = '\n'.join(statements)
        for statement in statements:
            if not re.match(r'(?i)^namelist\s*/', statement):
                continue
            for match in re.finditer(rf'/\s*({IDENTIFIER})\s*/\s*([^/]*)', statement):
                name = match[1].lower()
                variables = set(re.findall(rf'(?:^|,)\s*({IDENTIFIER})', match[2]))
                variables.update(v for name in list(variables) for v in members.get(name.lower(), []))
                found[name] = sorted(v.lower() for v in variables)
                namelists[name].update(v.lower() for v in variables)
        if found:
            source_namelists[relative.as_posix()] = found
        # The printed banner name often differs from the executable name.
        if re.search(r'(?i)\bcall\s+environment_start\s*\(', joined):
            for name in re.findall(r'''(?i)\bcall\s+environment_start\s*\(\s*['"]([^'"]+)['"]''', joined):
                programs.add(name.strip())
            for name in re.findall(r'''(?i)\b(?:code|code_name|codename)\s*=\s*['"]([^'"]+)['"]''', joined):
                programs.add(name.strip())

    if len(definitions) < 30 or 'inputepw' not in namelists or 'control' not in namelists:
        raise ValueError('source tree does not contain the expected QE input definitions')
    data = {
        '_comment': 'Generated by tools/fetch_qe_syntax.py; do not edit by hand.',
        'source': f'https://github.com/QEF/q-e/tree/{ref}',
        'ref': ref,
        'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest() if archive else None,
        'namelists': sorted(namelists),
        'cards': sorted(cards),
        'programs': sorted({p.upper() for p in programs if re.fullmatch(r'[\w-]+', p)}),
        'variables': sorted({v for values in namelists.values() for v in values}),
        'variables_by_namelist': {n: sorted(values) for n, values in sorted(namelists.items())},
        'documentation': definitions,
        'fortran_namelists': source_namelists,
    }
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--ref', default='qe-7.6')
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--gipaw-source', type=Path)
    parser.add_argument('--gipaw-ref', default='717e55c36f28c512d232321adb10d5a66d3e1072')
    args = parser.parse_args()
    data = extract(args.source, args.ref, args.archive)
    if args.gipaw_source:
        gipaw = {}
        for file in sorted(args.gipaw_source.rglob('*.f90')):
            if 'examples' in file.relative_to(args.gipaw_source).parts:
                continue
            for statement in fortran_statements(file.read_text(errors='replace')):
                if not re.match(r'(?i)^namelist\s*/', statement):
                    continue
                for match in re.finditer(rf'/\s*({IDENTIFIER})\s*/\s*([^/]*)', statement):
                    name = match[1].lower()
                    variables = set(v.lower() for v in re.findall(rf'(?:^|,)\s*({IDENTIFIER})', match[2]))
                    old = data['variables_by_namelist'].get(name, [])
                    data['variables_by_namelist'][name] = sorted(set(old) | variables)
                    gipaw.setdefault(file.relative_to(args.gipaw_source).as_posix(), {})[name] = sorted(variables)
        data['namelists'] = sorted(data['variables_by_namelist'])
        data['variables'] = sorted({v for values in data['variables_by_namelist'].values() for v in values})
        data['programs'] = sorted(set(data['programs']) | {'GIPAW'})
        data['gipaw'] = {'source': f'https://github.com/dceresoli/qe-gipaw/tree/{args.gipaw_ref}',
                         'ref': args.gipaw_ref, 'fortran_namelists': gipaw}
    OUT.write_text(json.dumps(data, indent=2) + '\n')
    print(f"Wrote {OUT.name}: {len(data['documentation'])} documentation files, "
          f"{len(data['namelists'])} namelists, {len(data['variables'])} parameters, "
          f"{len(data['cards'])} cards, {len(data['programs'])} program banners")


if __name__ == '__main__':
    main()
