"""Unpack and verify the approved release without any remote dependency."""
import hashlib
import io
import json
import pathlib
import tarfile

manifest = json.loads(pathlib.Path('release-manifest.json').read_text())
root = pathlib.Path('site')
parts = sorted(pathlib.Path('.').glob('release.bundle-*'))
if parts:
    bundle = b''.join(part.read_bytes() for part in parts)
    with tarfile.open(fileobj=io.BytesIO(bundle), mode='r:gz') as archive:
        for member in archive.getmembers():
            path = pathlib.PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or path.parts[0] != 'site':
                raise ValueError('Invalid release archive path')
            if member.isdir():
                pathlib.Path(member.name).mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target = pathlib.Path(member.name)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.extractfile(member).read())
            else:
                raise ValueError('Unexpected release archive entry')
for entry in manifest['files']:
    relative = pathlib.PurePosixPath(entry['path'])
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Invalid release path')
    data = (root / relative).read_bytes()
    if len(data) != entry['size'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise ValueError('Release checksum mismatch: ' + str(relative))
    print('Verified', relative)
(root / '.nojekyll').touch()
print('Approved release ready:', manifest['revision'])
