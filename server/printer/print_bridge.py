"""
Print Bridge: recibe datos ZPL por TCP y los envía a la impresora USB.

Uso (Windows):
    python print_bridge.py [--port 9100]

Escucha en el puerto indicado (default 9100), recibe JSON {"zpl": "..."},
lo imprime en la impresora USB por defecto y responde {"ok": true/false}.

Diseñado para correr como tarea programada en Windows, permitiendo que
el backend en Docker imprima vía TCP.
"""
import argparse
import json
import socket
import struct
import sys
import threading

try:
    import win32print
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False


def get_default_printer():
    if not HAS_WIN32:
        return None
    try:
        return win32print.GetDefaultPrinter()
    except Exception:
        return None


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


def _send_response(conn, ok, error=None):
    resp = json.dumps({'ok': ok, 'error': error}).encode('utf-8')
    conn.sendall(struct.pack('>I', len(resp)))
    conn.sendall(resp)


def handle_client(conn, addr):
    try:
        # Leer 4 bytes: largo del mensaje (network byte order)
        raw_len = conn.recv(4)
        if len(raw_len) < 4:
            _send_response(conn, False, 'Mensaje incompleto.')
            return
        msg_len = struct.unpack('>I', raw_len)[0]
        if msg_len > 1_000_000:
            _send_response(conn, False, 'Mensaje demasiado grande.')
            return

        # Leer el payload
        data = b''
        while len(data) < msg_len:
            chunk = conn.recv(msg_len - len(data))
            if not chunk:
                break
            data += chunk

        payload = json.loads(data.decode('utf-8'))
        zpl = payload.get('zpl', '')
        if not zpl:
            _send_response(conn, False, 'Campo "zpl" vacío.')
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
    parser = argparse.ArgumentParser(description='Print Bridge: TCP → USB printer.')
    parser.add_argument('--port', type=int, default=9200, help='Puerto TCP (default: 9200)')
    args = parser.parse_args()

    printer = get_default_printer()
    if not printer:
        print('[print_bridge] Advertencia: no se detectó impresora por defecto.', file=sys.stderr)
    else:
        print(f'[print_bridge] Impresora: {printer}', file=sys.stderr)

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
