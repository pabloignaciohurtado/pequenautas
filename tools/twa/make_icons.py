#!/usr/bin/env python3
"""Genera los íconos PNG de la app instalable y el gráfico destacado de Play.

Fuente principal: el arte de Grok versionado en assets/brand/ por
tools/twa/fetch_art.py:
  rufo-icono.webp         cabeza de Rufo en papercraft sobre menta
  grafico-destacado.webp  Rufo y sus amigos en el bosque (2:1)

Si todavía no existe rufo-icono.webp, cae al Rufo de la portada embebido en
fase4/51-hero-globo/img/ig-zorro.css, que fue el ícono provisorio.

Salidas:
  icons/icon-192.png, icons/icon-512.png                    purpose "any"
  icons/icon-maskable-192.png, icons/icon-maskable-512.png  purpose "maskable":
      la cara queda dentro del círculo seguro del 80 % que recortan los launchers
  store/feature-graphic.png  1024x500, PNG de 24 bits sin alfa (lo que pide Play)

Uso: python3 tools/twa/make_icons.py   (desde la raíz del repo)
"""
import base64
import io
import os
import re
from statistics import median

from PIL import Image, ImageDraw

OUT = "icons"
ICONO = "assets/brand/rufo-icono.webp"
DESTACADO = "assets/brand/grafico-destacado.webp"

# ---- respaldo: el Rufo de la portada (ícono provisorio) ----
SRC_CSS = "fase4/51-hero-globo/img/ig-zorro.css"
BG_CSS = (87, 197, 150, 255)  # menta de marca #57C596
ANY = (8, 4, 252, 248)
MASKABLE = (-28, -26, 296, 298)


def desde_css():
    css = open(SRC_CSS).read().replace("\\\n", "")
    b64 = re.search(r"base64,([A-Za-z0-9+/=]+)", css).group(1)
    z = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")

    def icono(caja, lado):
        x0, y0, x1, _ = caja
        w = x1 - x0
        lienzo = Image.new("RGBA", (w, w), BG_CSS)
        lienzo.alpha_composite(z, (-x0, -y0))
        return lienzo.resize((lado, lado), Image.LANCZOS).convert("RGB")

    return lambda lado: icono(ANY, lado), lambda lado: icono(MASKABLE, lado)


# ---- fuente principal: el ícono de Grok ----
def fondo_de(im):
    """Color de fondo: mediana de una franja interior cerca del borde superior
    e inferior (lejos de las esquinas, donde Grok dejó el redondeo)."""
    w, h = im.size
    pts = [(x, y) for x in range(w // 4, 3 * w // 4, 16) for y in (h // 12, h - h // 12)]
    px = [im.getpixel(p) for p in pts]
    return tuple(int(median(c[i] for c in px)) for i in range(3))


def desde_grok():
    im = Image.open(ICONO).convert("RGB")
    bg = fondo_de(im)
    # Grok dibujó el ícono como un cuadrado redondeado sobre blanco, pese a
    # pedirle fondo a sangre. Se rellenan las cuatro esquinas blancas con el
    # menta del propio fondo: el ícono queda a sangre, como lo exigen Play y
    # los launchers (que aplican su propia máscara).
    for esquina in ((0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)):
        ImageDraw.floodfill(im, esquina, bg, thresh=110)

    def any_(lado):
        return im.resize((lado, lado), Image.LANCZOS)

    def maskable(lado):
        # El arte se reduce al 80 % sobre su mismo fondo: la cabeza y las
        # orejas entran en el círculo seguro y no hay costura visible.
        lienzo = Image.new("RGB", (lado, lado), bg)
        s = round(lado * 0.80)
        lienzo.paste(im.resize((s, s), Image.LANCZOS), ((lado - s) // 2, (lado - s) // 2))
        return lienzo

    return any_, maskable


def grafico_destacado():
    if not os.path.exists(DESTACADO):
        return
    im = Image.open(DESTACADO).convert("RGB")
    # 1024x500 = 2.048:1; la fuente es 2:1, se recorta un poco arriba y abajo.
    h = round(im.width / 2.048)
    y = (im.height - h) // 2
    im = im.crop((0, y, im.width, y + h)).resize((1024, 500), Image.LANCZOS)
    os.makedirs("store", exist_ok=True)
    im.save("store/feature-graphic.png", optimize=True)
    print("store/feature-graphic.png")


def main():
    os.makedirs(OUT, exist_ok=True)
    any_, maskable = desde_grok() if os.path.exists(ICONO) else desde_css()
    for nombre, f in (("icon", any_), ("icon-maskable", maskable)):
        for lado in (192, 512):
            ruta = os.path.join(OUT, "%s-%d.png" % (nombre, lado))
            f(lado).save(ruta, optimize=True)
            print(ruta)
    grafico_destacado()


if __name__ == "__main__":
    main()
