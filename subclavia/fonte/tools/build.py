# Gera dist/atlas.html (arquivo único) a partir de index.html, embutindo <script src> e <link rel=stylesheet> locais.
# Dados binários embutidos são compactados na construção (sem alterar os arquivos de data/):
#   • data/hand.js     ← data/hand.glb com pesos em uint8, UV em uint16 e normais em int8 normalizados
#                        (KHR_mesh_quantization, lido nativamente pelo GLTFLoader do three r160);
#   • data/prancha.js  ← data/prancha.jpg reencodada em JPEG progressivo q82 (requer Pillow).
# Se numpy/Pillow faltarem, os .js originais são usados. Opção --raw desliga a compactação.
import os, re, sys, subprocess, json, struct, base64, io
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
RAW = '--raw' in sys.argv
src = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
report = {}


def compact_glb(glb):
    """Quantiza atributos de vértice do GLB (somente atributos seguros para malha com esqueleto:
    POSITION e índices ficam como estão; a posição quantizada exigiria mexer nas matrizes de ligação)."""
    import numpy as np
    magic, ver, _ = struct.unpack('<III', glb[:12])
    assert magic == 0x46546C67 and ver == 2
    l0, t0 = struct.unpack('<II', glb[12:20]); js = json.loads(glb[20:20 + l0])
    o = 20 + l0; l1, t1 = struct.unpack('<II', glb[o:o + 8]); bin0 = glb[o + 8:o + 8 + l1]
    CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
    NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
    role = {}
    for m in js['meshes']:
        for p in m['primitives']:
            for k, a in p['attributes'].items(): role[a] = k
            if 'indices' in p: role[p['indices']] = 'INDICES'
    if any('byteStride' in bv for bv in js['bufferViews']) or len(js['buffers']) != 1:
        return glb  # leiaute intercalado/múltiplos buffers: não mexe
    def read(i):
        a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); n = a['count'] * NC[a['type']]
        return np.frombuffer(bin0, dtype=CT[a['componentType']], count=n, offset=off).reshape(a['count'], NC[a['type']])
    out = bytearray(); views = []; quantN = False
    for i, a in enumerate(js['accessors']):
        d = read(i); r = role.get(i); stride = None; target = js['bufferViews'][a['bufferView']].get('target')
        if r == 'WEIGHTS_0' and a['componentType'] == 5126:
            q = np.clip(np.rint(d * 255.0), 0, 255).astype(np.int32)
            fix = 255 - q.sum(axis=1); idx = q.argmax(axis=1); q[np.arange(len(q)), idx] += fix
            d = np.clip(q, 0, 255).astype(np.uint8); a['componentType'] = 5121; a['normalized'] = True
            a.pop('min', None); a.pop('max', None)
        elif r == 'TEXCOORD_0' and a['componentType'] == 5126 and d.min() >= 0 and d.max() <= 1:
            d = np.rint(d * 65535.0).astype(np.uint16); a['componentType'] = 5123; a['normalized'] = True
            a.pop('min', None); a.pop('max', None)
        elif r == 'NORMAL' and a['componentType'] == 5126:
            q = np.rint(np.clip(d, -1, 1) * 127.0).astype(np.int8)
            d = np.concatenate([q, np.zeros((len(q), 1), np.int8)], axis=1); stride = 4  # alinhamento de 4 bytes
            a['componentType'] = 5120; a['normalized'] = True; quantN = True
            a.pop('min', None); a.pop('max', None)
        while len(out) % 4: out.append(0)
        bv = {'buffer': 0, 'byteOffset': len(out), 'byteLength': int(d.nbytes)}
        if stride: bv['byteStride'] = stride
        if target: bv['target'] = target
        out += d.tobytes(); a['bufferView'] = len(views); a['byteOffset'] = 0; views.append(bv)
    while len(out) % 4: out.append(0)
    js['bufferViews'] = views; js['buffers'] = [{'byteLength': len(out)}]
    if quantN:
        for k in ('extensionsUsed', 'extensionsRequired'):
            js[k] = sorted(set(js.get(k, [])) | {'KHR_mesh_quantization'})
    jb = json.dumps(js, separators=(',', ':')).encode('utf-8')
    while len(jb) % 4: jb += b' '
    body = struct.pack('<II', len(jb), 0x4E4F534A) + jb + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
    return struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body


def data_js(path):
    """Conteúdo compactado para data/hand.js e data/prancha.js (None → usar o arquivo original)."""
    if RAW: return None
    try:
        if path == 'data/hand.js':
            glb = open(os.path.join(root, 'data/hand.glb'), 'rb').read()
            small = compact_glb(glb)
            report['hand.glb'] = (len(glb), len(small))
            return 'window.HAND_GLB="' + base64.b64encode(small).decode('ascii') + '";'
        if path == 'data/prancha.js':
            from PIL import Image
            raw = open(os.path.join(root, 'data/prancha.jpg'), 'rb').read()
            im = Image.open(io.BytesIO(raw)).convert('RGB'); b = io.BytesIO()
            im.save(b, 'JPEG', quality=82, progressive=True, optimize=True)
            small = b.getvalue() if len(b.getvalue()) < len(raw) else raw
            report['prancha.jpg'] = (len(raw), len(small))
            return 'window.PRANCHA_JPG="' + base64.b64encode(small).decode('ascii') + '";'
    except Exception as e:  # sem numpy/Pillow ou arquivo ausente: usa o .js original
        print('AVISO: compactação de', path, 'indisponível:', e)
    return None


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
    code = data_js(path) or open(fp, encoding='utf-8').read()
    code = code.replace('</script', '<\\/script')
    return '<script>/* ' + path + ' */\n' + code + '\n</script>'


def inline_css(m):
    path = m.group(1)
    if path.startswith('http'): return m.group(0)
    return '<style>/* ' + path + ' */\n' + open(os.path.join(root, path), encoding='utf-8').read() + '\n</style>'


out = re.sub(r'<script\s+src="([^"]+)"\s*>\s*</script>', inline_js, src)
out = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', inline_css, out)
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
dst = os.path.join(root, 'dist', args[0] if args else 'atlas.html')
open(dst, 'w', encoding='utf-8').write(out)
for k, (a, b) in report.items(): print('  %s: %.0f KB → %.0f KB' % (k, a / 1024, b / 1024))
print(dst, round(len(out.encode('utf-8')) / 1e6, 2), 'MB')
