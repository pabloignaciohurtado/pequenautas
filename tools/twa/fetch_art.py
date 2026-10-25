#!/usr/bin/env python3
"""Trae el arte de Grok de la ficha de Play y lo deja versionado en assets/brand/.

Las URLs que entrega Grok son temporales, así que la primera vez que corre
(en el flujo twa-assets) descarga cada original, comprueba que su sha256 es
exactamente el del archivo que se eligió, lo reduce al ancho indicado y lo
guarda como WebP de alta calidad. Desde ese momento la fuente vive en el repo
y la URL ya no hace falta: si el archivo existe, no se vuelve a descargar.

Uso: python3 tools/twa/fetch_art.py   (desde la raíz del repo)
"""
import hashlib
import io
import json
import os
import sys
import urllib.request

from PIL import Image

LISTA = "tools/twa/arte-grok.json"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def main():
    for pieza in json.load(open(LISTA)):
        destino = pieza["archivo"]
        if os.path.exists(destino):
            print("ya está:", destino)
            continue
        req = urllib.request.Request(pieza["url"], headers={"User-Agent": UA})
        datos = urllib.request.urlopen(req, timeout=120).read()
        huella = hashlib.sha256(datos).hexdigest()
        if huella != pieza["sha256"]:
            sys.exit("sha256 distinto en %s: %s" % (pieza["url"], huella))
        im = Image.open(io.BytesIO(datos)).convert("RGB")
        ancho = pieza["ancho"]
        im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        im.save(destino, "WEBP", quality=92, method=6)
        print("guardado:", destino, im.size, os.path.getsize(destino))


if __name__ == "__main__":
    main()
