#!/usr/bin/env python3
"""Hornea los clips de la narradora con Chatterbox Multilingual.

Uso:  python tools/voz/hornear.py <lista.json> <carpeta-salida>

La lista es un array de objetos {lang, text, rank, say?}. `text` es la frase
tal como la dice la app (la clave de búsqueda); `say`, cuando existe, es lo
que se le pasa al modelo, porque hay textos que se escriben con cifra y se
pronuncian con letra: a "4" el modelo le devuelve silencio, a "cuatro" no.

El nombre del clip es sha1 del `text` original, nunca del `say`: así el mapa
que vive en spec.js sigue siendo válido aunque cambie la pronunciación.

Por qué está aquí y no en la máquina de nadie: los mp3 pesan más de un mega
en base64 y no hay forma cómoda de subirlos a mano. Con esto, la lista de
frases —siete kilobytes de texto— es lo único que se versiona, y la voz se
hornea en CI cada vez que la lista crece.

Se puede volver a lanzar sobre una carpeta a medias: los clips que ya están
se saltan, así que un reintento no vuelve a empezar de cero.
"""
import base64, hashlib, json, os, subprocess, sys, time

import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
import chatterbox.models.t3.t3 as _t3

# El muestreador va hasta mil pasos aunque la frase dure medio segundo: sin
# tope, un "cuatro" tarda casi dos minutos en una CPU de dos núcleos porque el
# modelo no encuentra el final. Los tokens de habla van a unos veinticinco por
# segundo, así que se pone un techo calculado desde la duración esperada —el
# doble, más un colchón— y el fin de secuencia sigue mandando si llega antes.
CAP = {"v": None}
_orig_inf = _t3.T3.inference


def _inference(self, **kw):
    if CAP["v"]:
        kw["max_new_tokens"] = CAP["v"]
    return _orig_inf(self, **kw)


_t3.T3.inference = _inference


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
# -45 dB el balbuceo residual del modelo cuenta como sonido y no se recorta
# nada.
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
    tope, se borra lo que dejó a medias y el bucle de reintentos se encarga."""
    try:
        _codificar(wav, mp3)
    except Exception as e:
        print("ERRFF", repr(e)[:90], flush=True)
        try:
            os.remove(mp3)
        except OSError:
            pass
        subprocess.run(["pkill", "-9", "-x", "ffmpeg"], capture_output=True)


def main():
    lista = sys.argv[1] if len(sys.argv) > 1 else "tools/voz/frases-es-w1.json"
    salida = sys.argv[2] if len(sys.argv) > 2 else "clips"
    os.makedirs(salida, exist_ok=True)
    items = json.load(open(lista, encoding="utf-8"))

    m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    print("MODELO CARGADO", flush=True)
    t0 = time.time()

    for i, it in enumerate(items):
        lang, text = it["lang"], it["text"]
        say = it.get("say", text)
        key = cid(lang, text)
        mp3 = os.path.join(salida, key + ".mp3")
        if os.path.exists(mp3) and dur(mp3) > 0.25:
            print("salto", key, flush=True)
            continue

        # Trece caracteres por segundo es el ritmo al que habla esta voz en
        # español; de ahí sale la duración esperada, y de ella la ventana que
        # decide si el clip salió bien o si el modelo se puso a divagar.
        esp = max(0.6, len(say) / 13.0)
        corta = len(say) < 15
        if corta:
            lo, hi = esp * 0.5, max(1.7, esp * 2.0 + 0.7)
        else:
            lo, hi = esp * 0.45, esp * 2.6 + 1.2
        intentos = 3 if corta else 2
        CAP["v"] = int(esp * 25 * 2.2) + 40

        bien = False
        for a in range(intentos):
            torch.manual_seed(1000 + a * 7919 + i)
            try:
                # Las frases de una sola palabra necesitan mano dura: con la
                # temperatura alta el modelo no encuentra el final y rellena
                # el hueco con ruido. Bajarla y castigar la repetición hace
                # que diga la palabra y se calle.
                wav = m.generate(say, language_id=lang,
                                 exaggeration=0.4 if corta else 0.5,
                                 cfg_weight=0.5 if corta else 0.45,
                                 temperature=0.3 if corta else 0.6,
                                 repetition_penalty=3.0 if corta else 2.0)
            except Exception as e:
                print("ERRGEN", key, repr(e)[:120], flush=True)
                continue
            raw = os.path.join(salida, "_raw.wav")
            ta.save(raw, wav, m.sr)
            codificar(raw, mp3)
            d = dur(mp3)
            if lo <= d <= hi:
                bien = True
                break
            print("reintento", key, "d=%.2f esp=%.2f" % (d, esp), flush=True)

        marca = "ok" if bien else "FLOJO"
        print(marca, key, "%d/%d" % (i + 1, len(items)),
              "%.2fs" % dur(mp3), "min=%.1f" % ((time.time() - t0) / 60),
              repr(text)[:60], flush=True)

    print("LOTE TERMINADO", flush=True)


if __name__ == "__main__":
    main()
