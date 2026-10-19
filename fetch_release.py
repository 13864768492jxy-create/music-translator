"""Materialize the approved public release; never fetch local user projects."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request

manifest = json.loads(pathlib.Path('release-manifest.json').read_text())
origin = 'https://music-translator-jxy.politekoi16.chatgpt.site/'
root = pathlib.Path('site')

def materialize(entry):
    relative = pathlib.PurePosixPath(entry['path'])
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Invalid release path')
    destination = root / relative
    data = destination.read_bytes() if destination.is_file() else b''
    if hashlib.sha256(data).hexdigest() != entry['sha256']:
        url = origin + urllib.parse.quote(str(relative))
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read()
    if len(data) != entry['size'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise ValueError('Release checksum mismatch: ' + str(relative))
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    print('Verified', relative)

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(materialize, manifest['files']))
(root / '.nojekyll').touch()
print('Approved release ready:', manifest['revision'])
