"""Extrae únicamente el runtime necesario desde archivos con hash verificado."""
import shutil
import sys
import zipfile
from pathlib import Path, PurePosixPath

cache, output = map(Path, sys.argv[1:3])
for name in ('node', 'postgres', 'chromium', 'caddy', 'sumatra'):
    with zipfile.ZipFile(cache / (name + '.zip')) as archive:
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            original = PurePosixPath(entry.filename)
            if original.is_absolute() or '..' in original.parts:
                raise ValueError('Ruta insegura en archivo de runtime.')
            parts = original.parts
            if name == 'node':
                parts = parts[1:]
                if len(parts) != 1 or parts[0] not in ('node.exe', 'LICENSE'):
                    continue
            elif name == 'postgres':
                if parts[0] != 'pgsql':
                    continue
                parts = parts[1:]
                if not parts or (parts[0] not in ('bin', 'lib', 'share') and not parts[0].endswith('.txt')):
                    continue
            elif name == 'chromium':
                parts = parts[1:]
            elif name == 'sumatra':
                if not entry.filename.endswith('.exe'):
                    continue
                parts = ('SumatraPDF.exe',)
            target = output / ('pgsql' if name == 'postgres' else name) / Path(*parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, target.open('wb') as destination:
                shutil.copyfileobj(source, destination)
shutil.copyfile(cache / 'WinSW.exe', output / 'WinSW.exe')
shutil.copyfile(cache / 'vcredist.exe', output / 'vcredist.exe')
