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

try:
    import win32print
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

# Ruta a SumatraPDF ( configurable por env SUMATRA_PDF ).
SUMATRA_PDF = os.environ.get(
    'SUMATRA_PDF',
    r'C:\Program Files\SumatraPDF\SumatraPDF.exe',
)


def get_default_printer():
    if not HAS_WIN32:
        return None
    try:
        printers = [p[2] for p in win32print.EnumPrinters(2)]
        for p in printers:
            if 'zdesigner' in p.lower() or 'gt800' in p.lower():
                return p
        return win32print.GetDefaultPrinter()
    except Exception:
        return None


def list_printers():
    if not HAS_WIN32:
        return []
    try:
        return [p[2] for p in win32print.EnumPrinters(2)]
    except Exception:
        return []


def print_zpl(zpl_data):
    if not HAS_WIN32:
        return False, 'win32print no disponible (¿estás en Windows?)'
    printer_name = get_default_printer()
    if not printer_name:
        return False, 'No se encontró impresora por defecto.'
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
        raw_len = conn.recv(4)
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
        ok, err = print_zpl(zpl)
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
