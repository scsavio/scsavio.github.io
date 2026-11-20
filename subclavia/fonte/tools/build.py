# Gera dist/atlas.html (arquivo único) a partir de index.html, embutindo <script src> e <link rel=stylesheet> locais.
import os, re, sys, subprocess
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
def inline_js(m):
    path = m.group(1)
    if path.startswith('http') or 'devmods/' in path: return '' if 'devmods/' in path else m.group(0)
    fp = os.path.join(root, path)
    if not os.path.exists(fp):
        print('AVISO: ausente, ignorado:', path); return ''
    if path.endswith('.js'):
        r = subprocess.run(['node', '--check', fp], capture_output=True, text=True)
        if r.returncode != 0:
            print('ERRO de sintaxe em', path); print(r.stderr[:2000]); sys.exit(1)
    code = open(fp, encoding='utf-8').read().replace('</script', '<\\/script')
    return '<script>/* ' + path + ' */\n' + code + '\n</script>'
def inline_css(m):
    path = m.group(1)
    if path.startswith('http'): return m.group(0)
    return '<style>/* ' + path + ' */\n' + open(os.path.join(root, path), encoding='utf-8').read() + '\n</style>'
out = re.sub(r'<script\s+src="([^"]+)"\s*>\s*</script>', inline_js, src)
out = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', inline_css, out)
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
dst = os.path.join(root, 'dist', sys.argv[1] if len(sys.argv) > 1 else 'atlas.html')
open(dst, 'w', encoding='utf-8').write(out)
print(dst, round(len(out.encode('utf-8')) / 1e6, 2), 'MB')
