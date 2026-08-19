"""Imprime etiquetas ZPL a una impresora termica Zebra/Godex por USB (Windows).

Uso:
    python zpl_printer.py --order OS-0001 \
        --model "Samsung A15" --customer "Fernando Fleitas" \
        --date 17/08/2026

Salida (stdout): JSON {"ok": true} o {"ok": false, "error": "..."}.
Reutiliza el formato de repair-shop (printer_utils.py), y translitera
acentos para que la fuente de la impresora no falle.
"""
import argparse
import json
import re
import sys

# Transliteracion: las fuentes estandar de las Zebra (CG Triumvirate) no
# incluyen acentos ni eñe; los reemplazamos por caracteres ASCII simples.
_TRANSLIT = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U', '¿': '?', '¡': '!',
    '·': '-', '–': '-', '—': '-', '°': 'o', 'º': 'o',
}


def ascii_text(s):
    s = ''.join(_TRANSLIT.get(c, c) for c in str(s or ''))
    # Evita comandos ZPL maliciosos y caracteres de control.
    s = re.sub(r'[\^~]', '', s)
    s = re.sub(r'[\x00-\x1f]', '', s)
    return s


def generate_zpl(order_number, phone_model, customer_name, date):
    order_number = ascii_text(order_number)
    phone_model = ascii_text(phone_model)
    customer_name = ascii_text(customer_name)
    date = ascii_text(date)
    return (
        '^XA\r\n'
        '^PW832\r\n'                          # ancho de la etiqueta (~60mm)
        '^FO310,55\r\n'                       # codigo de barras Code 128
        '^BCN,70,N,N,N,N\r\n'
        '^FD' + order_number + '^FS\r\n'
        '^FO0,145\r\n'                        # nro de orden grande centrado
        '^FB832,1,0,C\r\n'
        '^A0N,38,38\r\n'
        '^FD' + order_number + '^FS\r\n'
        '^FO0,195\r\n'                        # modelo del equipo
        '^FB832,1,0,C\r\n'
        '^A0N,28,28\r\n'
        '^FD' + phone_model + '^FS\r\n'
        '^FO0,235\r\n'                        # nombre del cliente
        '^FB832,1,0,C\r\n'
        '^A0N,22,22\r\n'
        '^FD' + customer_name + '^FS\r\n'
        '^FO0,300\r\n'                        # fecha
        '^FB832,1,0,C\r\n'
        '^A0N,18,18\r\n'
        '^FD' + date + '^FS\r\n'
        '^XZ\r\n'
    )


def _get_printer_name():
    try:
        import win32print
        printers = [p[2] for p in win32print.EnumPrinters(2)]
        for p in printers:
            if 'zdesigner' in p.lower() or 'gt800' in p.lower():
                return p
        return win32print.GetDefaultPrinter()
    except Exception:
        return None


def print_label(zpl):
    try:
        import win32print
        printer_name = _get_printer_name()
        if not printer_name:
            return False, 'No se encontró ninguna impresora de etiquetas.'
        hprinter = win32print.OpenPrinter(printer_name)
        win32print.StartDocPrinter(hprinter, 1, ('Repair Label', None, 'RAW'))
        win32print.StartPagePrinter(hprinter)
        win32print.WritePrinter(hprinter, zpl.encode('ascii'))
        win32print.EndPagePrinter(hprinter)
        win32print.EndDocPrinter(hprinter)
        win32print.ClosePrinter(hprinter)
        return True, None
    except Exception as e:
        return False, str(e)


def main():
    parser = argparse.ArgumentParser(description='Imprime una etiqueta ZPL de reparación.')
    parser.add_argument('--order', required=True)
    parser.add_argument('--model', default='')
    parser.add_argument('--customer', default='')
    parser.add_argument('--date', default='')
    args = parser.parse_args()

    zpl = generate_zpl(
        args.order,
        args.model,
        args.customer,
        args.date,
    )
    ok, err = print_label(zpl)
    sys.stdout.write(json.dumps({'ok': ok, 'error': err}))


if __name__ == '__main__':
    main()