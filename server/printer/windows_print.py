"""Helper local de una sola ejecución. JSON por stdin/stdout; no abre puertos."""
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

MAX_INPUT = 20_000_000


def printers():
    import win32print
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    return win32print.EnumPrinters(flags, None, 2)


def require_printer(name):
    if not isinstance(name, str) or not name or len(name) > 256:
        raise ValueError('Elegí una impresora configurada en el servidor.')
    entry = next((p for p in printers() if p['pPrinterName'] == name), None)
    if not entry:
        raise ValueError('La cuenta del servicio no tiene acceso a esta impresora. Revisá su instalación y permisos.')
    # El spooler puede desconocer un fallo físico posterior a la entrega.
    if entry.get('Status', 0) & (0x1 | 0x2 | 0x80 | 0x1000):
        raise ValueError('La cola informa que la impresora está pausada, sin conexión o con error.')
    return name


def raw_print(name, data):
    import win32print
    handle = win32print.OpenPrinter(name)
    started = False
    try:
        job = win32print.StartDocPrinter(handle, 1, ('Etiqueta servicio técnico', None, 'RAW'))
        started = True
        win32print.StartPagePrinter(handle)
        try:
            win32print.WritePrinter(handle, data)
        finally:
            win32print.EndPagePrinter(handle)
        return job
    finally:
        try:
            if started:
                win32print.EndDocPrinter(handle)
        finally:
            win32print.ClosePrinter(handle)


def pdf_print(name, data, settings):
    executable = os.environ.get('SUMATRA_PDF', '')
    if not executable or not Path(executable).is_file():
        raise ValueError('No se encontró el componente de impresión PDF. Repará la instalación.')
    if settings not in ('fit', 'noscale'):
        raise ValueError('Escala de impresión inválida.')
    directory = os.environ.get('PRINT_TEMP_DIR') or None
    if directory:
        Path(directory).mkdir(parents=True, exist_ok=True)
    fd, filename = tempfile.mkstemp(suffix='.pdf', dir=directory)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(data)
        result = subprocess.run([executable, '-silent', '-print-to', name, '-print-settings', settings, filename],
                                capture_output=True, timeout=60, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode:
            raise ValueError('Windows no aceptó el trabajo PDF. Revisá la impresora, el driver y el acceso de la cuenta del servicio.')
    finally:
        Path(filename).unlink(missing_ok=True)


def execute(payload):
    action = payload.get('action')
    if action == 'grant-service-logon':
        import win32security
        sid = win32security.LookupAccountName(None, payload.get('account', ''))[0]
        policy = win32security.LsaOpenPolicy(None, win32security.POLICY_LOOKUP_NAMES | win32security.POLICY_CREATE_ACCOUNT)
        try:
            win32security.LsaAddAccountRights(policy, sid, ('SeServiceLogonRight',))
            return {'ok': True}
        finally:
            win32security.LsaClose(policy)
    if action == 'validate-account':
        import win32security
        account = payload.get('account', '')
        domain, user = account.split('\\', 1)
        token = win32security.LogonUser(user, domain, payload.get('password', ''), 3, 0)
        try:
            admin_sid = win32security.CreateWellKnownSid(win32security.WinBuiltinAdministratorsSid)
            user_sid = win32security.GetTokenInformation(token, win32security.TokenUser)[0]
            groups = win32security.GetTokenInformation(token, win32security.TokenGroups)
            admin_name = win32security.ConvertSidToStringSid(admin_sid)
            # Rechaza también Administradores con atributo deny-only por UAC.
            is_admin = any(win32security.ConvertSidToStringSid(sid) == admin_name for sid, _attributes in groups)
            return {'ok': True, 'admin': is_admin, 'sid': win32security.ConvertSidToStringSid(user_sid)}
        finally:
            token.Close()
    if action == 'printers':
        import win32api
        import win32print
        import win32security
        accessible = []
        for entry in printers():
            try:
                handle = win32print.OpenPrinter(entry['pPrinterName'], {'DesiredAccess': win32print.PRINTER_ACCESS_USE})
                win32print.ClosePrinter(handle)
                accessible.append(entry['pPrinterName'])
            except Exception:
                continue
        token = win32security.OpenProcessToken(win32api.GetCurrentProcess(), win32security.TOKEN_QUERY)
        try:
            sid = win32security.GetTokenInformation(token, win32security.TokenUser)[0]
            groups = win32security.GetTokenInformation(token, win32security.TokenGroups)
            admin_sid = win32security.ConvertSidToStringSid(win32security.CreateWellKnownSid(win32security.WinBuiltinAdministratorsSid))
            admin = any(win32security.ConvertSidToStringSid(group) == admin_sid for group, _attributes in groups)
            return {'ok': True, 'printers': accessible, 'account': win32api.GetUserNameEx(2), 'sid': win32security.ConvertSidToStringSid(sid), 'admin': admin}
        finally:
            token.Close()
    if action not in ('pdf', 'zpl'):
        raise ValueError('Acción de impresión inválida.')
    name = require_printer(payload.get('printer'))
    if action == 'pdf':
        data = base64.b64decode(payload.get('pdf', ''), validate=True)
        if not data.startswith(b'%PDF'):
            raise ValueError('Documento PDF inválido.')
        pdf_print(name, data, payload.get('settings', 'fit'))
        return {'ok': True, 'status': 'submitted'}
    from zpl_printer import generate_zpl
    label = payload.get('label') or {}
    fields = [label.get(key, '') for key in ('orderNumber', 'model', 'customerName', 'date')]
    if any(not isinstance(value, str) or len(value) > 500 for value in fields):
        raise ValueError('Datos de etiqueta inválidos.')
    data = generate_zpl(*fields).encode('ascii', errors='replace')
    return {'ok': True, 'status': 'submitted', 'jobId': raw_print(name, data)}


def main():
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT + 1)
        if len(raw) > MAX_INPUT:
            raise ValueError('El documento supera el límite de impresión.')
        payload = json.loads(raw.decode('utf-8'))
        if not isinstance(payload, dict):
            raise ValueError('Solicitud inválida.')
        result = execute(payload)
    except ValueError as error:
        result = {'ok': False, 'error': str(error)}
    except subprocess.TimeoutExpired:
        result = {'ok': False, 'error': 'La impresión agotó el tiempo de espera. Revisá la cola antes de reimprimir para evitar duplicados.'}
    except Exception:
        result = {'ok': False, 'error': 'No se pudo acceder al sistema de impresión. Revisá el servicio Spooler y los permisos de su cuenta.'}
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))


if __name__ == '__main__':
    main()
