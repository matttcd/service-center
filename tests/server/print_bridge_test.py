import importlib.util
import json
import socket
import struct
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('print_bridge', root / 'server/printer/print_bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class PrintBridgeSecurityTest(unittest.TestCase):
    def test_labels_do_not_use_office_default_printer(self):
        with patch.object(bridge, 'HAS_WIN32', True), patch.object(bridge, 'win32print', create=True) as printers, patch.object(bridge, 'read_setting', return_value=''):
            printers.EnumPrinters.return_value = [(0, '', 'Microsoft Print to PDF', '')]
            self.assertIsNone(bridge.get_default_printer())
            printers.GetDefaultPrinter.assert_not_called()

    def test_configured_label_printer_is_used(self):
        with patch.object(bridge, 'HAS_WIN32', True), patch.object(bridge, 'win32print', create=True) as printers, patch.object(bridge, 'read_setting', return_value='Etiquetas Taller'):
            printers.EnumPrinters.return_value = [(0, '', 'Etiquetas Taller', '')]
            self.assertEqual(bridge.get_default_printer(), 'Etiquetas Taller')

    def test_missing_configured_label_printer_fails_closed(self):
        with patch.object(bridge, 'HAS_WIN32', True), patch.object(bridge, 'win32print', create=True) as printers, patch.object(bridge, 'read_setting', return_value='Etiquetas Taller'):
            printers.EnumPrinters.return_value = [(0, '', 'ZDesigner GT800', '')]
            self.assertIsNone(bridge.get_default_printer())

    def request(self, payload):
        client, server = socket.socketpair()
        client.settimeout(2)
        worker = threading.Thread(target=bridge.handle_client, args=(server, 'local-test'))
        worker.start()
        data = json.dumps(payload).encode()
        header = struct.pack('>I', len(data))
        client.sendall(header[:2])
        client.sendall(header[2:] + data)
        response = b''
        while True:
            part = client.recv(4096)
            if not part:
                break
            response += part
        client.close()
        worker.join(timeout=2)
        return json.loads(response[4:])

    def test_missing_token_never_reaches_printer(self):
        with patch.object(bridge, 'BRIDGE_TOKEN', 'secret'), patch.object(bridge, 'print_zpl') as printer:
            self.assertFalse(self.request({'zpl': '^XA^XZ'})['ok'])
            printer.assert_not_called()

    def test_wrong_token_never_reaches_printer(self):
        with patch.object(bridge, 'BRIDGE_TOKEN', 'secret'), patch.object(bridge, 'print_zpl') as printer:
            self.assertFalse(self.request({'token': 'wrong', 'zpl': '^XA^XZ'})['ok'])
            printer.assert_not_called()

    def test_non_string_token_is_rejected(self):
        with patch.object(bridge, 'BRIDGE_TOKEN', 'secret'):
            self.assertFalse(self.request({'token': ['secret'], 'action': 'printers'})['ok'])

    def test_no_configured_secret_fails_closed(self):
        with patch.object(bridge, 'BRIDGE_TOKEN', ''), patch.object(bridge, 'list_printers') as printer:
            self.assertFalse(self.request({'token': '', 'action': 'printers'})['ok'])
            printer.assert_not_called()

    def test_authenticated_request_handles_fragmented_header(self):
        with patch.object(bridge, 'BRIDGE_TOKEN', 'secret'), patch.object(bridge, 'list_printers', return_value=['Prueba']):
            result = self.request({'token': 'secret', 'action': 'printers'})
            self.assertTrue(result['ok'])
            self.assertEqual(result['printers'], ['Prueba'])


if __name__ == '__main__':
    unittest.main()
