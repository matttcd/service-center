import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

spec = importlib.util.spec_from_file_location('windows_print', Path(__file__).resolve().parents[2] / 'server/printer/windows_print.py')
printer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(printer)


class WindowsPrintingTest(unittest.TestCase):
    def test_administrator_group_is_rejected_even_when_uac_marks_it_deny_only(self):
        security = MagicMock()
        security.TokenUser = 1
        security.TokenGroups = 2
        security.CreateWellKnownSid.return_value = 'admins'
        security.ConvertSidToStringSid.side_effect = lambda sid: sid
        security.GetTokenInformation.side_effect = lambda token, kind: ('user-sid', 0) if kind == 1 else [('admins', 0x10)]
        with patch.dict(sys.modules, {'win32security': security}):
            result = printer.execute({'action': 'validate-account', 'account': 'PC\\usuario', 'password': 'fake'})
            self.assertTrue(result['admin'])
            security.LogonUser.return_value.Close.assert_called_once()

    def test_missing_printer_never_falls_back(self):
        with patch.object(printer, 'printers', return_value=[]), patch.object(printer, 'pdf_print') as send:
            with self.assertRaises(ValueError):
                printer.execute({'action': 'pdf', 'printer': 'No existe', 'pdf': 'JVBERg=='})
            send.assert_not_called()

    def test_offline_queue_rejects_before_submission(self):
        with patch.object(printer, 'printers', return_value=[{'pPrinterName': 'Etiquetas', 'Status': 0x80}]), patch.object(printer, 'pdf_print') as send:
            with self.assertRaises(ValueError):
                printer.execute({'action': 'pdf', 'printer': 'Etiquetas', 'pdf': 'JVBERg=='})
            send.assert_not_called()

    def test_invalid_pdf_never_reaches_renderer(self):
        with patch.object(printer, 'require_printer', return_value='A4'), patch.object(printer, 'pdf_print') as send:
            with self.assertRaises(ValueError):
                printer.execute({'action': 'pdf', 'printer': 'A4', 'pdf': 'aHRtbA=='})
            send.assert_not_called()

    def test_success_reports_submission_not_physical_completion(self):
        with patch.object(printer, 'require_printer', return_value='A4'), patch.object(printer, 'pdf_print') as send:
            result = printer.execute({'action': 'pdf', 'printer': 'A4', 'pdf': 'JVBERg==', 'settings': 'noscale'})
            self.assertEqual(result, {'ok': True, 'status': 'submitted'})
            send.assert_called_once_with('A4', b'%PDF', 'noscale')

    def test_pdf_temporary_file_removed_on_spooler_failure(self):
        with patch.object(printer.subprocess, 'run', return_value=MagicMock(returncode=5)) as run, patch.dict(printer.os.environ, {'SUMATRA_PDF': __file__}):
            with self.assertRaises(ValueError):
                printer.pdf_print('A4', b'%PDF', 'fit')
            filename = run.call_args.args[0][-1]
            self.assertFalse(Path(filename).exists())

    def test_unknown_action_rejected(self):
        with self.assertRaises(ValueError):
            printer.execute({'action': 'shell'})


if __name__ == '__main__':
    unittest.main()
