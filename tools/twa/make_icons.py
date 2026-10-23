#!/usr/bin/env python3
"""Genera los íconos PNG de la app instalable (manifest + Play Store).

Fuente: el arte de Rufo hecho con Grok que ya vive en el repo, embebido en
fase4/51-hero-globo/img/ig-zorro.css (WebP con alfa). No hace falta subir
binarios: este script los reproduce siempre igual a partir de ese archivo de
texto, y el workflow de empaquetado lo ejecuta y commitea el resultado.

Salidas en icons/:
  icon-192.png, icon-512.png                    purpose "any" (encuadre a sangre)
  icon-maskable-192.png, icon-maskable-512.png  purpose "maskable": la cara
      queda dentro del círculo seguro del 80 % que recortan los launchers.

Uso: python3 tools/twa/make_icons.py   (desde la raíz del repo)
"""
import base64
import io
import os
import re

from PIL import Image

SRC = "fase4/51-hero-globo/img/ig-zorro.css"
OUT = "icons"
BG = (87, 197, 150, 255)  # menta de marca #57C596

# Cajas de recorte en coordenadas del WebP de 320x320. Cuadradas, y sus bordes
# coinciden con los del ícono: el cuerpo y la cola salen por abajo y por la
# derecha como si siguieran fuera del encuadre, en vez de verse cortados.
ANY = (8, 4, 252, 248)          # cabeza, pata que saluda y pecho
MASKABLE = (-28, -26, 296, 298)  # más aire: orejas dentro de la zona segura


def fuente():
    css = open(SRC).read().replace("\\\n", "")
    b64 = re.search(r"base64,([A-Za-z0-9+/=]+)", css).group(1)
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")


def icono(z, caja, lado):
    x0, y0, x1, _ = caja
    w = x1 - x0
    lienzo = Image.new("RGBA", (w, w), BG)
    lienzo.alpha_composite(z, (-x0, -y0))
    return lienzo.resize((lado, lado), Image.LANCZOS).convert("RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    z = fuente()
    for nombre, caja in (("icon", ANY), ("icon-maskable", MASKABLE)):
        for lado in (192, 512):
            ruta = os.path.join(OUT, "%s-%d.png" % (nombre, lado))
            icono(z, caja, lado).save(ruta, optimize=True)
            print(ruta)


if __name__ == "__main__":
    main()
