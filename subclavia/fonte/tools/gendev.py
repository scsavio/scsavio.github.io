# Gera dev.html incluindo apenas módulos existentes, na ordem de tools/modules.txt
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mods = [m.strip() for m in open(os.path.join(root, 'tools/modules.txt')) if m.strip()]
tags = '\n'.join(f'<script src="src/modules/{m}.js"></script>' for m in mods if os.path.exists(os.path.join(root, 'src/modules', m + '.js')))
import sys
if '--lmdebug' in sys.argv: tags += '\n<script src="devmods/lmdebug.js"></script>'
html = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>dev</title>
<style>html,body{{margin:0;height:100%;background:#e9ece6;font:12px system-ui}}#view{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 35%,#f5f3ea,#cfd9d3)}}#status{{position:absolute;left:4px;bottom:2px;right:4px;font:10px monospace;color:#333;white-space:pre-wrap;pointer-events:none;max-height:40%;overflow:hidden}}#labels{{position:absolute;inset:0;pointer-events:none}}.lb{{position:absolute;font:10px monospace;background:#fff9;padding:0 2px;border-left:2px solid #c00;transform:translate(2px,-50%)}}</style></head>
<body><div id="view"></div><div id="labels"></div><div id="status">carregando…</div>
<script src="vendor/three.js"></script><script src="vendor/gltf.js"></script><script src="data/hand.js"></script>
<script src="src/core.js"></script><script src="src/landmarks.js"></script><script src="src/engine.js"></script>
{tags}
<script src="src/devboot.js"></script></body></html>'''
open(os.path.join(root, 'dev.html'), 'w').write(html)
print('dev.html com módulos:', [m for m in mods if os.path.exists(os.path.join(root, 'src/modules', m + '.js'))])
