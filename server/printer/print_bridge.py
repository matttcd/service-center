"""
Print Bridge: recibe datos ZPL o PDF por TCP y los imprime en la PC Windows.

Uso (Windows):
    python print_bridge.py [--port 9200]

Escucha en el puerto indicado (default 9200) y acepta JSON:
  - {"zpl": "..."}                  -> imprime etiqueta ZPL en la impresora USB default
  - {"pdf": "<base64>", "printer": "Nombre"} -> imprime el PDF en la impresora indicada
                                        (si "printer" es null, usa la impresora default)
  - {"action": "printers"}          -> devuelve la lista de impresoras instaladas

La impresión de PDF usa SumatraPDF en modo silencioso (-print-to -silent).

Diseñado para correr en la PC Windows, permitiendo que el backend en Docker
imprima vía TCP.
"""
import argparse
import base64
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import hmac
from pathlib import Path

# Comparte el secreto de la app sin requerir módulos adicionales en Windows.
def read_setting(name, default=''):
    if name in os.environ:
        return os.environ[name]
    env_file = Path(__file__).resolve().parents[2] / '.env'
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8-sig').splitlines():
            key, sep, value = line.partition('=')
            if sep and key.strip() == name:
                return value.strip().strip('\"\'')
    return default

BRIDGE_TOKEN = read_setting('PRINT_BRIDGE_TOKEN')

try:
    import win32print
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

# Ruta a SumatraPDF ( configurable por env SUMATRA_PDF ).
SUMATRA_PDF = read_setting('SUMATRA_PDF') or next((str(p) for p in [
    Path(os.environ.get('LOCALAPPDATA', '')) / 'SumatraPDF' / 'SumatraPDF.exe',
    Path(os.environ.get('ProgramFiles', r'C:\Program Files')) / 'SumatraPDF' / 'SumatraPDF.exe',
] if p.is_file()), '')


def get_default_printer():
    if not HAS_WIN32:
        return None
    try:
        printers = [p[2] for p in win32print.EnumPrinters(2)]
        configured = read_setting('LABEL_PRINTER_NAME')
        if configured:
            return next((p for p in printers if p == configured), None)
        for p in printers:
            if any(name in p.lower() for name in ('zdesigner', 'gt800', 'zebra', 'godex')):
                return p
        return None
    except Exception:
        return None


def list_printers():
    if not HAS_WIN32:
        return []
    try:
        return [p[2] for p in win32print.EnumPrinters(2)]
    except Exception:
        return []


def print_zpl(zpl_data, printer_name=None):
    if not HAS_WIN32:
        return False, 'win32print no disponible (¿estás en Windows?)'
    if printer_name and printer_name not in list_printers():
        return False, 'La impresora de etiquetas seleccionada no está instalada.'
    printer_name = printer_name or get_default_printer()
    if not printer_name:
        return False, 'Configurá LABEL_PRINTER_NAME con una impresora de etiquetas ZPL instalada.'
    try:
        hprinter = win32print.OpenPrinter(printer_name)
        win32print.StartDocPrinter(hprinter, 1, ('ZPL Label', None, 'RAW'))
        win32print.StartPagePrinter(hprinter)
        win32print.WritePrinter(hprinter, zpl_data.encode('ascii'))
        win32print.EndPagePrinter(hprinter)
        win32print.EndDocPrinter(hprinter)
        win32print.ClosePrinter(hprinter)
        return True, None
    except Exception as e:
        return False, str(e)


def print_pdf(pdf_bytes, printer_name=None):
    if not os.path.exists(SUMATRA_PDF):
        return False, f'SumatraPDF no encontrado en {SUMATRA_PDF}. Instalalo o setea SUMATRA_PDF.'
    fd, path = tempfile.mkstemp(suffix='.pdf')
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(pdf_bytes)
        args = [SUMATRA_PDF, '-silent']
        if printer_name:
            args += ['-print-to', printer_name]
        else:
            args += ['-print-to-default']
        args.append(path)
        proc = subprocess.run(args, capture_output=True, text=True, timeout=60)
        if proc.returncode != 0:
            return False, (proc.stderr.strip() or f'SumatraPDF salió con código {proc.returncode}')
        return True, None
    except subprocess.TimeoutExpired:
        return False, 'Timeout imprimiendo el PDF.'
    except Exception as e:
        return False, str(e)
    finally:
        try:
            os.remove(path)
        except Exception:
            pass


def _send_response(conn, ok, error=None, extra=None):
    resp = {'ok': ok, 'error': error}
    if extra:
        resp.update(extra)
    data = json.dumps(resp).encode('utf-8')
    conn.sendall(struct.pack('>I', len(data)))
    conn.sendall(data)


def handle_client(conn, addr):
    try:
        conn.settimeout(10)
        raw_len = b''
        while len(raw_len) < 4:
            chunk = conn.recv(4 - len(raw_len))
            if not chunk:
                break
            raw_len += chunk
        if len(raw_len) < 4:
            _send_response(conn, False, 'Mensaje incompleto.')
            return
        msg_len = struct.unpack('>I', raw_len)[0]
        if msg_len > 20_000_000:
            _send_response(conn, False, 'Mensaje demasiado grande.')
            return

        data = b''
        while len(data) < msg_len:
            chunk = conn.recv(msg_len - len(data))
            if not chunk:
                break
            data += chunk

        payload = json.loads(data.decode('utf-8'))
        token = payload.get('token', '')
        if not BRIDGE_TOKEN or not isinstance(token, str) or not hmac.compare_digest(token, BRIDGE_TOKEN):
            _send_response(conn, False, 'No autorizado.')
            return

        # Lista de impresoras
        if payload.get('action') == 'printers':
            _send_response(conn, True, extra={'printers': list_printers()})
            return

        # PDF
        if payload.get('pdf'):
            try:
                pdf_bytes = base64.b64decode(payload['pdf'])
            except Exception:
                _send_response(conn, False, 'PDF inválido (base64).')
                return
            ok, err = print_pdf(pdf_bytes, payload.get('printer') or None)
            _send_response(conn, ok, err)
            return

        # ZPL
        zpl = payload.get('zpl', '')
        if not zpl:
            _send_response(conn, False, 'Payload vacío (ni "zpl" ni "pdf").')
            return
        ok, err = print_zpl(zpl, payload.get('printer') or None)
        _send_response(conn, ok, err)
    except Exception as e:
        try:
            _send_response(conn, False, str(e))
        except Exception:
            pass
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Print Bridge: TCP → printer.')
    parser.add_argument('--port', type=int, default=9200, help='Puerto TCP (default: 9200)')
    args = parser.parse_args()
    if not BRIDGE_TOKEN:
        parser.error('Falta PRINT_BRIDGE_TOKEN. Ejecutá node scripts/setup-env.mjs antes de iniciar el bridge.')

    printer = get_default_printer()
    if not printer:
        print('[print_bridge] Advertencia: no se detectó impresora por defecto.', file=sys.stderr)
    else:
        print(f'[print_bridge] Impresora default: {printer}', file=sys.stderr)
    print(f'[print_bridge] SumatraPDF: {SUMATRA_PDF} ({"" if os.path.exists(SUMATRA_PDF) else "NO ENCONTRADO"})', file=sys.stderr)

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', args.port))
    server.listen(5)
    print(f'[print_bridge] Escuchando en puerto {args.port}...', file=sys.stderr)

    try:
        while True:
            conn, addr = server.accept()
            t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
            t.start()
    except KeyboardInterrupt:
        print('\n[print_bridge] Detenido.', file=sys.stderr)
    finally:
        server.close()


if __name__ == '__main__':
    main()
