#!/usr/bin/env python3
"""Descarga Fredoka y Baloo 2 de Google Fonts y las deja servidas desde el
propio dominio, en fonts/.

Por qué: la app está dirigida a niños de 3 a 5 años y la política de Familias
de Google Play no admite servicios de terceros embebidos que no estén
aprobados; pedir la fuente a fonts.googleapis.com le entrega a Google la IP
del dispositivo en cada arranque. Servirlas desde el mismo origen elimina la
única petición externa que hacía la app y, de paso, las deja disponibles sin
red desde la primera instalación (el service worker las precachea).

Solo se conservan los subconjuntos latin y latin-ext: la app es español e
inglés, y devanagari/vietnamita/hebreo no se usan nunca.

Uso: python3 tools/fonts/fetch_fonts.py   (desde la raíz del repo)
Escribe fonts/fonts.css y fonts/<familia>-<subset>.woff2.
"""
import os
import re
import urllib.request

CSS_URL = ("https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700"
           "&family=Baloo+2:wght@600;800&display=swap")
# Con un user-agent moderno Google responde woff2.
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
KEEP = ("latin", "latin-ext")
OUT = "fonts"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    os.makedirs(OUT, exist_ok=True)
    css = get(CSS_URL).decode("utf-8")
    blocks = re.findall(r"/\* ([a-z-]+) \*/\s*(@font-face \{.*?\})", css, re.S)
    out, saved = [], {}
    for subset, block in blocks:
        if subset not in KEEP:
            continue
        family = re.search(r"font-family: '([^']+)'", block).group(1)
        url = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
        name = "%s-%s.woff2" % (family.lower().replace(" ", ""), subset)
        if name not in saved:
            data = get(url)
            assert data[:4] == b"wOF2", "no es woff2: " + url
            with open(os.path.join(OUT, name), "wb") as f:
                f.write(data)
            saved[name] = len(data)
        out.append("/* %s */\n%s" % (subset, block.replace(url, name)))
    header = ("/* Fuentes servidas desde el propio dominio (ver tools/fonts/fetch_fonts.py).\n"
              "   Fredoka (texto de la app) y Baloo 2 (titulares de #51/#52), solo latin y\n"
              "   latin-ext. Generado: no editar a mano. */\n")
    with open(os.path.join(OUT, "fonts.css"), "w") as f:
        f.write(header + "\n".join(out) + "\n")
    for k in sorted(saved):
        print(k, saved[k])


if __name__ == "__main__":
    main()
