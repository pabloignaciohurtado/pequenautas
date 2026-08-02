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

Cada clip se escucha antes de darlo por bueno. La duración sola no basta: en
el primer horneado hubo frases que duraban lo previsto y decían otra cosa
—"La mariposa come plantas" salió convertida en una retahíla de "¡pues no!"—
y otras que se cortaban a media palabra sin salirse de la ventana. Así que lo
generado se transcribe y se compara con lo que tenía que decir; si no se
parece, se prueba otra vez con otra semilla y al final se guarda la mejor
toma. Vale la pena el gasto: son voces que van a oír niños de tres años una y
otra vez, y un clip que balbucea se nota mucho más que uno que tarda de más.
"""
import base64, difflib, hashlib, json, os, re, shutil, subprocess, sys, time
import unicodedata

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


# ---------------------------------------------------------------- el oído

_OIDO = {"m": None}

# Los números llegan escritos con letra al modelo y vuelven en cifra del
# transcriptor, y al revés con las letras sueltas. Sin esta tabla, un "cuatro"
# perfecto se leería como fallo total.
_CIFRAS = {"0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
           "5": "cinco", "6": "seis", "7": "siete", "8": "ocho",
           "9": "nueve", "10": "diez"}


def _modelo_oido():
    if _OIDO["m"] is None:
        from faster_whisper import WhisperModel
        _OIDO["m"] = WhisperModel("small", device="cpu", compute_type="int8")
    return _OIDO["m"]


def escuchar(mp3, tmp):
    """Devuelve lo que se entiende en el clip.

    El transcriptor devuelve vacío ante audios de menos de medio segundo, y
    aquí medio catálogo son palabras sueltas de esa duración. Se le rodea de
    silencio antes de dárselo: con siete décimas por lado, "círculo" pasa de
    no entenderse a entenderse entero."""
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", mp3,
                    "-af", "adelay=700|700,apad=pad_dur=0.7",
                    "-ar", "16000", "-ac", "1", tmp],
                   capture_output=True, stdin=subprocess.DEVNULL, timeout=30)
    segs, _ = _modelo_oido().transcribe(tmp, language="es", beam_size=5,
                                        vad_filter=False,
                                        condition_on_previous_text=False)
    return " ".join(s.text for s in segs).strip()


def _plano(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9ñ ]", " ", s)
    pal = [_CIFRAS.get(p, p) for p in s.split()]
    return " ".join(pal)


def parecido(esperado, oido):
    """Cuánto se parece lo que se oye a lo que tocaba decir, de 0 a 1.

    Las frases de fonema —"sss... Sol"— se comparan también contra la palabra
    sola: nadie transcribe una ese alargada de la misma manera dos veces, y lo
    que de verdad importa es que la palabra esté."""
    a, b = _plano(esperado), _plano(oido)
    if not a:
        return 1.0
    r = difflib.SequenceMatcher(None, a, b).ratio()
    corto = re.sub(r"^\w*\.\.\.\s*", "", esperado)
    if corto != esperado:
        r = max(r, difflib.SequenceMatcher(None, _plano(corto), b).ratio())
    return r


# Por debajo de esto se vuelve a intentar; por debajo del segundo umbral, el
# clip se marca en el registro para poder mirarlo a mano. Los valores salen de
# medir el primer horneado: las tomas buenas quedaron por encima de 0,75 y las
# claramente rotas por debajo de 0,60.
BUENO, ACEPTABLE = 0.75, 0.60


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
        intentos = 4
        CAP["v"] = int(esp * 25 * 2.2) + 40

        raw = os.path.join(salida, "_raw.wav")
        cand = os.path.join(salida, "_cand.mp3")
        pad = os.path.join(salida, "_pad.wav")
        mejor = (-1.0, 0.0, "")   # parecido, duración, transcripción
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
            ta.save(raw, wav, m.sr)
            if os.path.exists(cand):
                os.remove(cand)
            codificar(raw, cand)
            d = dur(cand)
            if not (lo <= d <= hi):
                # Fuera de ventana no merece transcribirse, pero sí guardarse
                # por si ninguna toma sale bien: más vale un clip regular que
                # un hueco, porque el hueco deja a la app sin la frase.
                if mejor[0] < 0 and d > 0.25:
                    shutil.copyfile(cand, mp3)
                    mejor = (0.0, d, "(fuera de ventana)")
                print("reintento", key, "dura %.2f, esperaba %.2f" % (d, esp),
                      flush=True)
                continue
            try:
                oido = escuchar(cand, pad)
            except Exception as e:
                print("ERROIR", key, repr(e)[:90], flush=True)
                oido = ""
            p = parecido(say, oido)
            if p > mejor[0]:
                mejor = (p, d, oido)
                shutil.copyfile(cand, mp3)
            if p >= BUENO:
                break
            print("reintento", key, "oí %r (%.2f)" % (oido[:50], p), flush=True)

        for f in (raw, cand, pad):
            if os.path.exists(f):
                os.remove(f)

        p, d, oido = mejor
        marca = "ok" if p >= BUENO else ("flojo" if p >= ACEPTABLE else "MALO")
        print(marca, key, "%d/%d" % (i + 1, len(items)),
              "%.2fs p=%.2f" % (d, p), "min=%.1f" % ((time.time() - t0) / 60),
              repr(text)[:40], "->", repr(oido)[:40], flush=True)

    print("LOTE TERMINADO", flush=True)


if __name__ == "__main__":
    main()
