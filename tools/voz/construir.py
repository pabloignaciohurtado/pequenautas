#!/usr/bin/env python3
"""Empaqueta los clips horneados dentro de fase4/62-voz-narradora.

Uso:  python tools/voz/construir.py <carpeta-clips> <lista.json> [raiz-repo]

Escribe:
  fase4/62-voz-narradora/voz/NN.css   los clips en base64
  fase4/62-voz-narradora/spec.css     la lista de @import
  fase4/62-voz-narradora/spec.js      el mapa texto -> clip

El mapa se reescribe aquí, y no a mano, por dos motivos. Uno, que con el
catálogo creciendo por olas mantener a mano cuatrocientas líneas de sha1 es
pedir una desincronización. Y dos, que solo entran en el mapa las frases que
de verdad tienen clip: si una toma sale mal y no se empaqueta, su entrada
desaparece del mapa y la app la dice con el sintetizador, en vez de pedir un
recurso que no está.

Los clips se reparten en trozos porque el service worker precachea cada
@import por separado: un archivo por frase serían cientos de descargas en el
primer arranque, y uno solo obligaría a rebajarlo entero cada vez que se
añade una frase.
"""
import base64, hashlib, json, os, re, subprocess, sys

TROZOS = 20


def motor():
    """Identificador de la voz que hornea, tal como está en tools/voz/motor.txt.

    Se estampa en cada trozo generado para que el flujo de voz sepa de quién es
    el audio que hay guardado en la rama. Sin la marca no podría distinguir un
    clip de la voz actual de uno de la anterior, rescataría los viejos y la app
    seguiría hablando con una voz jubilada."""
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "motor.txt")
    try:
        for linea in open(p, encoding="utf-8"):
            linea = linea.split("#")[0].strip()
            if linea:
                return linea
    except OSError:
        pass
    return "desconocido"


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

    # Varias listas separadas por coma: una por ola de frases (ver hornear.py).
    items = []
    for l in lista.split(","):
        items += json.load(open(l.strip(), encoding="utf-8"))
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

    mot = motor()
    n = max(1, (len(listos) + TROZOS - 1) // TROZOS)
    trozos = [listos[i:i + n] for i in range(0, len(listos), n)]
    for i, tr in enumerate(trozos):
        out = ["/* Fase 4 #62 - clips de la narradora, trozo %02d de %02d.\n"
               "   Generado; no editar a mano.\n"
               "   motor: %s */\n:root{\n" % (i + 1, len(trozos), mot)]
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

    escribir_mapa(os.path.join(mod, "spec.js"), items,
                  set(k for k, _ in listos))

    print("trozos:", len(trozos), "->", mod, "motor:", mot)


def escribir_mapa(spec, items, hay):
    """Reescribe el bloque MAPA de spec.js dejando el resto del archivo igual.

    La clave es el idioma y el texto con los espacios colapsados, que es como
    lo normaliza spec.js antes de buscar; el valor, el identificador del clip.
    """
    js = open(spec, encoding="utf-8").read()
    ini = js.index("  var MAPA = {")
    fin = js.index("\n  };", ini) + len("\n  };")
    pares = {}
    for it in items:
        key = cid(it["lang"], it["text"])
        if key in hay:
            pares[it["lang"] + "|" + " ".join(it["text"].split())] = key
    cuerpo = ",\n".join(
        "    %s: %s" % (json.dumps(k, ensure_ascii=False), json.dumps(pares[k]))
        for k in sorted(pares))
    with open(spec, "w", encoding="utf-8") as f:
        f.write(js[:ini] + "  var MAPA = {\n" + cuerpo + "\n  };" + js[fin:])
    print("mapa:", len(pares), "entradas")


if __name__ == "__main__":
    main()
