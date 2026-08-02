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

# Dos transcriptores, no uno. El pequeño despacha el lote entero a buen ritmo,
# pero se rinde con las palabras sueltas —a un "dos" impecable le contesta con
# silencio— y entonces condena un clip que está bien. Cuando duda, el mediano
# da la segunda opinión: tarda unos segundos más, y solo se le molesta en los
# casos dudosos, que son pocos.
_OIDO = {"small": None, "medium": None}

# Los números llegan escritos con letra al modelo y vuelven en cifra del
# transcriptor, y al revés con las letras sueltas. Sin esta tabla, un "cuatro"
# perfecto se leería como fallo total.
_CIFRAS = {"0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
           "5": "cinco", "6": "seis", "7": "siete", "8": "ocho",
           "9": "nueve", "10": "diez"}


def _modelo_oido(talla="small"):
    if _OIDO[talla] is None:
        from faster_whisper import WhisperModel
        _OIDO[talla] = WhisperModel(talla, device="cpu", compute_type="int8")
    return _OIDO[talla]


def escuchar(mp3, tmp, talla="small"):
    """Devuelve lo que se entiende en el clip.

    El transcriptor devuelve vacío ante audios de menos de medio segundo, y
    aquí medio catálogo son palabras sueltas de esa duración. Se le rodea de
    silencio antes de dárselo: con siete décimas por lado, "círculo" pasa de
    no entenderse a entenderse entero."""
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", mp3,
                    "-af", "adelay=700|700,apad=pad_dur=0.7",
                    "-ar", "16000", "-ac", "1", tmp],
                   capture_output=True, stdin=subprocess.DEVNULL, timeout=30)
    segs, _ = _modelo_oido(talla).transcribe(
        tmp, language="es", beam_size=5, vad_filter=False,
        condition_on_previous_text=False,
        initial_prompt="Narración infantil en español.")
    return " ".join(s.text for s in segs).strip()


def _plano(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9ñ ]", " ", s)
    pal = [_CIFRAS.get(p, p) for p in s.split()]
    return " ".join(pal)


def _nucleo(esperado):
    """La frase sin el fonema de delante: "sss... Sol" -> "Sol"."""
    return re.sub(r"^\w*\.\.\.\s*", "", esperado)


def eco(esperado, oido):
    """¿Se dijo la frase y luego se volvió a decir?

    Es el único defecto que sobrevivió al segundo horneado: cuatro clips de
    ciento veintidós salieron con la frase repetida detrás —"Me seco. Me
    seco.", "La ballena come carne" dos veces— y pasaron el control porque
    todo lo que se oye es lo que tocaba decir, solo que dos veces, y el
    parecido no baja lo suficiente. Aquí se mira aparte: si en la cola de lo
    transcrito reaparece el arranque de la frase, la toma se descarta y se
    vuelve a intentar. No basta con que sobre texto, porque el transcriptor
    añade coletillas suyas; tiene que reaparecer el principio."""
    a = _plano(_nucleo(esperado)).split()
    b = _plano(oido).split()
    if not a or len(b) < len(a) + 1:
        return False
    arranque = " ".join(a[:min(2, len(a))])
    return arranque in " ".join(b[len(a):])


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

CUENTA = {}
DUDOSOS = []


def main():
    lista = sys.argv[1] if len(sys.argv) > 1 else "tools/voz/frases-es-w1.json"
    salida = sys.argv[2] if len(sys.argv) > 2 else "clips"
    os.makedirs(salida, exist_ok=True)
    # Varias listas separadas por coma: el catálogo crece por olas y cada ola
    # es un archivo, pero el horno y el empaquetador tienen que ver el conjunto
    # entero, porque el módulo se reconstruye completo cada vez.
    items = []
    for l in lista.split(","):
        items += json.load(open(l.strip(), encoding="utf-8"))

    # Un trabajo de Actions se corta a las seis horas y se lleva por delante lo
    # que no haya llegado a comprometerse. Con casi cuatrocientas frases el
    # lote ya no cabe en una sola pasada, así que el horno para solo, a tiempo
    # de que el paso siguiente empaquete y suba lo hecho; la pasada siguiente
    # recupera esos clips del propio repositorio y sigue por donde iba.
    tope = float(os.environ.get("MINUTOS_MAX", "250"))

    m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    print("MODELO CARGADO", flush=True)
    t0 = time.time()

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

        # Trece caracteres por segundo es el ritmo al que habla esta voz en
        # español; de ahí sale la duración esperada, y de ella la ventana que
        # decide si el clip salió bien o si el modelo se puso a divagar.
        esp = max(0.6, len(say) / 13.0)
        corta = len(say) < 15
        if corta:
            lo, hi = esp * 0.5, max(1.7, esp * 2.0 + 0.7)
        else:
            # La ventana ancha del primer horneado dejaba pasar divagaciones:
            # "¿Qué come el perro?" salió una vez en 4,2 s —el doble de largo
            # de lo que tarda en decirse— y entró igual. Con 1,8 veces más
            # ocho décimas de margen sigue cabiendo una toma pausada, pero ya
            # no cabe una frase con cola de ruido detrás.
            lo, hi = esp * 0.45, esp * 1.8 + 0.8
        intentos = 7
        CAP["v"] = int(esp * 25 * 2.2) + 40

        raw = os.path.join(salida, "_raw.wav")
        cand = os.path.join(salida, "_cand.mp3")
        pad = os.path.join(salida, "_pad.wav")
        mejor = (-1.0, 0.0, "")   # parecido, duración, transcripción
        for a in range(intentos):
            torch.manual_seed(1000 + a * 7919 + i)
            # Cada intento cambia algo más que la semilla: si tres tomas con
            # los mismos ajustes salieron mal, la cuarta idéntica tampoco va a
            # salir. Conforme se insiste se baja la temperatura y se sube el
            # castigo a la repetición, que es justo lo que corta la cola de
            # divagación del final.
            paso = min(a, 3)
            exa = (0.4 if corta else 0.5) - 0.05 * paso
            cfg = (0.5 if corta else 0.45) + 0.05 * paso
            tem = (0.3 if corta else 0.6) - 0.06 * paso
            rep = (3.0 if corta else 2.0) + 0.5 * paso
            try:
                # Las frases de una sola palabra necesitan mano dura: con la
                # temperatura alta el modelo no encuentra el final y rellena
                # el hueco con ruido. Bajarla y castigar la repetición hace
                # que diga la palabra y se calle.
                wav = m.generate(say, language_id=lang,
                                 exaggeration=exa, cfg_weight=cfg,
                                 temperature=tem, repetition_penalty=rep)
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
            if p < BUENO:
                # Antes de condenar la toma se pide la segunda opinión al oído
                # grande: sobre los treinta y seis dudosos del primer horneado
                # rescató dieciocho, que estaban bien y solo sonaban raro al
                # oído pequeño.
                try:
                    oido2 = escuchar(cand, pad, "medium")
                except Exception as e:
                    print("ERROIR2", key, repr(e)[:90], flush=True)
                    oido2 = ""
                p2 = parecido(say, oido2)
                if p2 > p:
                    p, oido = p2, oido2 + " [oído grande]"
            if eco(say, oido):
                # Una toma con la frase repetida no puede ganar a una limpia,
                # pero sí a no tener nada: se le baja la nota por debajo del
                # umbral de reintento y se deja compitiendo por si ninguna
                # sale mejor.
                p = min(p, 0.5)
                oido += " [eco]"
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
        CUENTA[marca] = CUENTA.get(marca, 0) + 1
        if marca != "ok":
            DUDOSOS.append((marca, key, round(p, 2), text, oido[:60]))
        print(marca, key, "%d/%d" % (i + 1, len(items)),
              "%.2fs p=%.2f" % (d, p), "min=%.1f" % ((time.time() - t0) / 60),
              repr(text)[:40], "->", repr(oido)[:40], flush=True)

    # El registro de Actions se consulta por la cola, y con más de cien clips
    # las primeras líneas quedan fuera de alcance. Por eso el recuento va aquí
    # al final: quien mire el trabajo ve de un vistazo cuántos salieron bien y
    # cuáles hay que revisar, sin tener que descargar el registro entero.
    print("LOTE TERMINADO", flush=True)
    print("RECUENTO ok=%d flojo=%d MALO=%d horneadas de %d en la lista"
          % (CUENTA.get("ok", 0), CUENTA.get("flojo", 0),
             CUENTA.get("MALO", 0), len(items)), flush=True)
    for fila in DUDOSOS:
        print("REVISAR", *fila, flush=True)


if __name__ == "__main__":
    main()
