#!/usr/bin/env python3
"""Hornea los clips de la narradora con Kokoro, voz «alex».

Uso:  python tools/voz/hornear.py <lista.json> <carpeta-salida>

La lista es un array de objetos {lang, text, rank, say?}. `text` es la frase
tal como la dice la app (la clave de búsqueda); `say`, cuando existe, es lo
que se le pasa al modelo, porque hay textos que se escriben con cifra y se
pronuncian con letra: a "4" el modelo le devuelve silencio, a "cuatro" no.

El nombre del clip es sha1 del `text` original, nunca del `say`: así el mapa
que vive en spec.js sigue siendo válido aunque cambie la pronunciación.

Por qué está aquí y no en la máquina de nadie: los mp3 en base64 pesan más de
un mega y no hay manera cómoda de subirlos a mano. Con esto, la lista de
frases —siete kilobytes de texto— es lo único que se versiona, y la voz se
hornea cada vez que la lista crece.

Se puede volver a lanzar sobre una carpeta a medias: los clips que ya están
se saltan, así que un reintento no vuelve a empezar de cero.

## Por qué Kokoro y no Chatterbox

La primera versión de este horno usaba Chatterbox Multilingual, que es un
modelo autorregresivo: inventa el audio token a token, y de vez en cuando se
pierde. Salían frases con eco —"Verde. Verde."—, colas cortadas a media
palabra y alguna retahíla que no se parecía a lo pedido, así que hubo que
montarle encima dos transcriptores para escuchar cada toma, siete reintentos
por frase con semillas y temperaturas distintas, y una lista de clips
condenados a rehornear. Aun así quedaban siete que fallaban igual toma tras
toma, y el catálogo entero ya no cabía en un trabajo de Actions: casi un
minuto por frase.

Kokoro no es autorregresivo. A la misma frase le devuelve siempre el mismo
audio, no divaga y no repite, así que todo ese andamiaje de vigilancia sobra:
basta comprobar que la duración es razonable. Y va unas cien veces más
rápido, con lo que el catálogo completo se hornea en minutos en cualquier
máquina, sin CI y sin tres gigas de modelo. La voz es «em_alex», la misma que
ya usa Rufo en el módulo 61: una sola voz para toda la app.
"""
import hashlib, json, os, subprocess, sys, time

import numpy as np
import soundfile as sf
from kokoro import KPipeline

# Kokoro trabaja por idioma: 'e' es el castellano, 'a' el inglés americano.
# La voz va emparejada al idioma —em_alex habla español, am_liam inglés— y no
# se pueden cruzar: a un texto en español con voz inglesa le sale un acento
# que un niño de tres años no debería tener que descifrar.
VOZ = {"es": ("e", "em_alex"), "en": ("a", "am_liam")}

# Por debajo de 1.0 la voz se abre y se entiende mejor, que es lo que pide una
# app para preescolares. Más lento de esto ya suena a burla.
VELOCIDAD = 0.92

SR = 24000


def pronunciar(it):
    """Lo que se le pasa al modelo, que no siempre es lo que se ve en pantalla.

    El campo `say` manda cuando está. Cuando no, se rebajan a minúscula las
    palabras escritas enteras en mayúscula: la app las usa para destacar
    —"¡Sí! Es SOL.", "La sílaba MA", "¿Quién hace PUM PUM?"— pero el modelo
    entiende la mayúscula como deletreo y contesta "ese, o, ele". Las letras
    sueltas se dejan como están, porque ahí el deletreo es justo lo que se
    quiere: "¿Qué empieza con A?" se dice nombrando la letra."""
    if it.get("say"):
        return it["say"]
    return " ".join(p.lower() if len(p) > 1 and p.upper() == p and p.lower() != p
                    else p for p in it["text"].split())


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


# Al modelo le sobra medio segundo de aire por delante y por detrás, y el
# volumen le baila entre frases. Se recorta el silencio por los dos extremos
# —el segundo recorte va sobre la señal invertida, que es la manera de tratar
# la cola como si fuera la cabeza— y se iguala la sonoridad para que ninguna
# frase salte respecto de la anterior. El umbral de -30 dB no es capricho: a
# -45 dB el aire residual del modelo cuenta como sonido y no se recorta nada.
FILTRO = ("silenceremove=start_periods=1:start_silence=0.08:start_threshold=-30dB,"
          "areverse,"
          "silenceremove=start_periods=1:start_silence=0.08:start_threshold=-30dB,"
          "areverse,"
          "loudnorm=I=-16:TP=-1.5:LRA=11")


def _codificar(wav, mp3):
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-i", wav, "-af", FILTRO,
                    "-ac", "1", "-ar", "24000", "-b:a", "32k", mp3],
                   capture_output=True, stdin=subprocess.DEVNULL, timeout=25)


def codificar(wav, mp3):
    """ffmpeg se ha quedado colgado alguna vez sin motivo aparente en máquinas
    justas de memoria. Un cuelgue no puede tumbar el lote entero: se le pone
    tope y se borra lo que dejó a medias."""
    try:
        _codificar(wav, mp3)
    except Exception as e:
        print("ERRFF", repr(e)[:90], flush=True)
        try:
            os.remove(mp3)
        except OSError:
            pass
        subprocess.run(["pkill", "-9", "-x", "ffmpeg"], capture_output=True)


def sintetizar(pipe, texto, voz, velocidad):
    """Kokoro devuelve la frase por trozos; aquí se pegan en una sola pista.

    Entre trozo y trozo se cuela un respiro corto, que es lo que separa las
    dos mitades de una frase larga sin que suene a corte."""
    partes = []
    for res in pipe(texto, voice=voz, speed=velocidad):
        a = res.audio
        if a is None:
            continue
        partes.append(a.numpy() if hasattr(a, "numpy") else np.asarray(a))
    if not partes:
        return None
    if len(partes) == 1:
        return partes[0]
    respiro = np.zeros(int(SR * 0.12), dtype=partes[0].dtype)
    pegado = []
    for i, p in enumerate(partes):
        if i:
            pegado.append(respiro)
        pegado.append(p)
    return np.concatenate(pegado)


def main():
    listas, salida = sys.argv[1], sys.argv[2]
    os.makedirs(salida, exist_ok=True)
    items = []
    for l in listas.split(","):
        items += json.load(open(l.strip(), encoding="utf-8"))

    # Aunque con Kokoro el catálogo entero cabe de sobra en un solo lote, el
    # tope se queda: es la red que impide que un cuelgue de ffmpeg deje el
    # trabajo corriendo hasta que Actions lo mate sin comprometer nada.
    tope = float(os.environ.get("MINUTOS_MAX", "250"))

    pipes = {}
    t0 = time.time()
    cuenta = {"ok": 0, "raro": 0, "MALO": 0}
    revisar = []

    for i, it in enumerate(items):
        lang, text = it["lang"], it["text"]
        say = pronunciar(it)
        key = cid(lang, text)
        mp3 = os.path.join(salida, key + ".mp3")
        if os.path.exists(mp3) and dur(mp3) > 0.25:
            continue
        if (time.time() - t0) / 60 > tope:
            print("TIEMPO AGOTADO tras %.0f min, quedan %d frases"
                  % ((time.time() - t0) / 60, len(items) - i), flush=True)
            break

        if lang not in VOZ:
            print("MALO", key, "idioma sin voz:", lang, flush=True)
            cuenta["MALO"] += 1
            continue
        codigo, voz = VOZ[lang]
        if codigo not in pipes:
            pipes[codigo] = KPipeline(lang_code=codigo,
                                      repo_id="hexgrad/Kokoro-82M")
            print("MODELO CARGADO", codigo, flush=True)

        # Trece caracteres por segundo es el ritmo al que habla esta voz en
        # español; de ahí sale la duración esperada, y de ella la ventana que
        # avisa de que algo no cuadra. Kokoro no divaga, así que la ventana ya
        # no decide si se reintenta —no habría nada que cambiar, el modelo es
        # determinista— sino qué clips conviene escuchar a mano antes de dar
        # la tanda por buena.
        esp = max(0.6, len(say) / 13.0)
        lo, hi = (esp * 0.5, max(1.7, esp * 2.0 + 0.7)) if len(say) < 15 \
            else (esp * 0.45, esp * 1.8 + 0.8)

        raw = os.path.join(salida, "_raw.wav")
        try:
            au = sintetizar(pipes[codigo], say, voz, VELOCIDAD)
        except Exception as e:
            print("ERRGEN", key, repr(e)[:120], flush=True)
            au = None
        if au is None or len(au) < SR * 0.1:
            print("MALO", key, "sin audio", repr(text)[:40], flush=True)
            cuenta["MALO"] += 1
            revisar.append(("MALO", key, text, "sin audio"))
            continue
        sf.write(raw, au, SR)
        if os.path.exists(mp3):
            os.remove(mp3)
        codificar(raw, mp3)
        if os.path.exists(raw):
            os.remove(raw)

        d = dur(mp3)
        if d < 0.25:
            marca = "MALO"
            revisar.append(("MALO", key, text, "%.2fs" % d))
        elif not (lo <= d <= hi):
            marca = "raro"
            revisar.append(("raro", key, text,
                            "dura %.2f, esperaba %.2f" % (d, esp)))
        else:
            marca = "ok"
        cuenta[marca] += 1
        print(marca, key, "%d/%d" % (i + 1, len(items)),
              "%.2fs" % d, "min=%.1f" % ((time.time() - t0) / 60),
              repr(text)[:44], flush=True)

    print("LOTE TERMINADO", flush=True)
    print("RECUENTO ok=%d raro=%d MALO=%d horneadas de %d en la lista"
          % (cuenta["ok"], cuenta["raro"], cuenta["MALO"], len(items)),
          flush=True)
    for fila in revisar:
        print("REVISAR", *fila, flush=True)


if __name__ == "__main__":
    main()
