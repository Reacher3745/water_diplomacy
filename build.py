"""Rebuild index.html from the source files (engine + rules + interface inlined into one file)."""
import re, pathlib
root = pathlib.Path(__file__).parent
strip = lambda s: re.sub(r'^if \(typeof module.*$', '', s, flags=re.M)
shell = (root / 'shell.html').read_text(encoding='utf-8')
html = (shell.replace('/*ENGINE*/', strip((root / 'engine.js').read_text(encoding='utf-8')))
             .replace('/*LOGIC*/', strip((root / 'logic.js').read_text(encoding='utf-8')))
             .replace('/*UI*/', (root / 'ui.js').read_text(encoding='utf-8')))
(root / 'index.html').write_text(html, encoding='utf-8')
print('wrote index.html,', len(html), 'bytes')
