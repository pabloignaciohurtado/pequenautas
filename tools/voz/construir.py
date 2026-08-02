#!/usr/bin/env python3
"""Empaqueta los clips horneados dentro de fase4/62-voz-narradora.

Uso:  python tools/voz/construir.py <carpeta-clips> <lista.json> [raiz-repo]

Escribe:
  fase4/62-voz-narradora/voz/NN.css   los clips en base64
  fase4/62-voz-narradora/spec.css     la lista de @import

No toca spec.js. El mapa texto -> clip que vive allí se calcula con el mismo
sha1 del texto que usa el horno, así que mientras la lista de frases no
cambie, el mapa sigue siendo correcto y no hay dos sitios que sincronizar.

Los clips se reparten en trozos porque el service worker precachea cada
@import por separado: un archivo por frase serían cientos de descargas en el
primer arranque, y uno solo obligaría a rebajarlo entero cada vez que se
añade una frase.
"""
import base64, hashlib, json, os, re, subprocess, sys

TROZOS = 20


def cid(lang, text):
    return lang + "-" + hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


def dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def envolver(s, ancho=76):
    """El base64 va cortado con barra invertida al final de cada línea: es
    continuación de cadena CSS, no un salto real, y mantiene los archivos
    legibles en cualquier editor y en los diffs."""
    return "\\\n".join(s[i:i + ancho] for i in range(0, len(s), ancho))


CABECERA = """/* ===== Fase 4 #62 · La voz de la narradora (clips) =====

   Las frases que la narradora dice durante las rondas —instrucciones,
   preguntas, pistas, respuestas— vienen aquí grabadas, no las improvisa el
   sintetizador del sistema. spec.js las reproduce; este archivo solo carga
   los trozos.

   Están repartidas en varios archivos a propósito: el service worker
   precachea cada @import por separado, así que un archivo por frase serían
   cientos de descargas en el primer arranque. Veinte trozos es el término
   medio entre eso y un único archivo enorme que habría que rebajar entero
   cada vez que se añade una frase.

   Generado por tools/voz/construir.py; no editar a mano. */
"""


def main():
    clips = sys.argv[1] if len(sys.argv) > 1 else "clips"
    lista = sys.argv[2] if len(sys.argv) > 2 else "tools/voz/frases-es-w1.json"
    raiz = sys.argv[3] if len(sys.argv) > 3 else "."
    mod = os.path.join(raiz, "fase4", "62-voz-narradora")

    items = json.load(open(lista, encoding="utf-8"))
    listos = []
    for it in items:
        key = cid(it["lang"], it["text"])
        p = os.path.join(clips, key + ".mp3")
        # Un clip de menos de un cuarto de segundo es un fallo del horno, no
        # una palabra corta: mejor que esa frase caiga al sintetizador a que
        # el niño oiga un chasquido.
        if os.path.exists(p) and dur(p) > 0.25:
            listos.append((key, p))

    print("clips listos:", len(listos), "de", len(items))
    if not listos:
        sys.exit("sin clips que empaquetar")

    os.makedirs(os.path.join(mod, "voz"), exist_ok=True)
    for viejo in os.listdir(os.path.join(mod, "voz")):
        if viejo.endswith(".css"):
            os.remove(os.path.join(mod, "voz", viejo))

    n = max(1, (len(listos) + TROZOS - 1) // TROZOS)
    trozos = [listos[i:i + n] for i in range(0, len(listos), n)]
    for i, tr in enumerate(trozos):
        out = ["/* Fase 4 #62 - clips de la narradora, trozo %02d de %02d.\n"
               "   Generado; no editar a mano. */\n:root{\n" % (i + 1, len(trozos))]
        for key, p in tr:
            b64 = base64.b64encode(open(p, "rb").read()).decode("ascii")
            out.append('  --pa62-%s:url("data:audio/mpeg;base64,%s");\n'
                       % (key, envolver(b64)))
        out.append("}\n")
        with open(os.path.join(mod, "voz", "%02d.css" % (i + 1)), "w") as f:
            f.write("".join(out))

    imports = "".join('@import url("voz/%02d.css");\n' % (i + 1)
                      for i in range(len(trozos)))
    with open(os.path.join(mod, "spec.css"), "w") as f:
        f.write(CABECERA + imports)

    print("trozos:", len(trozos), "->", mod)


if __name__ == "__main__":
    main()
