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

from PIL import Image, ImageChops, ImageDraw

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
    # pedirle fondo a sangre. Se rellenan las cuatro esquinas con el menta del
    # propio fondo para que quede a sangre, como lo exigen Play y los launchers
    # (que aplican su propia máscara). No basta con un relleno por color: el
    # borde antialiasado del redondeo deja un anillo claro que, reducido en el
    # ícono maskable, se ve como un cuadrado fantasma. Por eso se mide el radio
    # del redondeo en la diagonal de cada esquina y se pinta todo lo que queda
    # fuera de ese arco (con 4 px de margen hacia dentro).
    w, h = im.size
    lienzo = ImageDraw.Draw(im)
    for cx, cy, dx, dy in ((0, 0, 1, 1), (w - 1, 0, -1, 1), (0, h - 1, 1, -1), (w - 1, h - 1, -1, -1)):
        d = 0
        while d < w // 3 and min(im.getpixel((cx + dx * d, cy + dy * d))) > 200:
            d += 1
        if d == 0:
            continue
        r = d / (1 - 2 ** -0.5)              # el arco cruza la diagonal en x = r(1 - 1/raíz de 2)
        ox, oy = cx + dx * r, cy + dy * r    # centro del arco
        for y in range(int(r) + 1):
            for x in range(int(r) + 1):
                px, py = cx + dx * x, cy + dy * y
                if ((px - ox) ** 2 + (py - oy) ** 2) ** 0.5 > r - 4:
                    lienzo.point((px, py), fill=bg)

    # Además, el cuadrado de Grok trae un sombreado muy leve (2-6 niveles)
    # junto al arco de las esquinas: invisible a tamaño grande, pero al reducir
    # el ícono maskable dibuja un cuadrado fantasma. Se recompone la imagen
    # sobre un fondo liso: lo que se aparta del menta menos de 8 niveles es
    # fondo; desde ahí la opacidad sube suave hasta 32 niveles, para conservar
    # la sombra de papel bajo la cara sin bordes duros.
    plano = Image.new("RGB", (w, h), bg)
    dif = ImageChops.difference(im, plano).split()
    dist = ImageChops.lighter(ImageChops.lighter(dif[0], dif[1]), dif[2])
    alfa = dist.point(lambda v: 0 if v <= 8 else 255 if v >= 32 else round((v - 8) * 255 / 24))
    im = Image.composite(im, plano, alfa)

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
