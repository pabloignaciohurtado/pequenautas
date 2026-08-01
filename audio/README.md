# Voces pregrabadas (AudioBank)

La app narra con voces del sistema (Web Speech API / TTS). El **AudioBank** permite
sustituir esas voces por **clips locutados por personas** sin tocar la lógica de juego.

## Cómo funciona
- `speak(text, { key })` y `speakSeq([{ t, key }, ...])` intentan primero reproducir
  `audio/<idioma>/<key>.mp3`. Si el clip no está disponible, caen al TTS actual.
- Bajo `file://` el banco queda **inerte** (nunca toca red ni `<audio>`): la app funciona
  igual y los smoke tests file:// no se ven afectados. Los clips suenan al servir la app
  por http/https (o como PWA).
- El gate de runtime es `AUDIO_MANIFEST.available` (en app.js): solo las claves listadas
  ahí intentan cargar un MP3. Así nunca hay 404 ni ruido de consola por clips que aún no existen.

## Estado actual
`available` sigue **VACÍO**, y es a propósito: aquí dentro no hay ningún clip grabado
por una persona todavía. Lo que sí cambió es lo que se oye mientras tanto.

Desde la oleada 27, el módulo `fase4/61-voz-rufo` trae dieciocho clips locutados —las
nueve claves del guion en ES y en EN— sintetizados con **Kokoro** (modelo libre,
licencia Apache 2.0, voz masculina joven «alex» en español y «liam» en inglés), a
24 kHz mono 32 kbps. Viajan en base64 dentro de `fase4/61-voz-rufo/voz/*.css`, igual
que el arte, porque el repo no admite binarios y así el service worker los precachea
solo por estar `@import`ados.

Ese módulo se coloca **por debajo** de este banco, nunca por encima. El orden al
reproducir una clave es:

1. `audio/<idioma>/<clave>.mp3` — locución humana, vía este AudioBank (cuando exista);
2. el clip embebido de #61 — lo que suena hoy;
3. la voz del sistema — el fallback de siempre.

Es decir: el día que se grabe a una persona basta con seguir los pasos de abajo y esos
clips ganan solos, sin borrar ni tocar nada de #61. Por eso `available` se deja vacío
y `app.js` no se modificó.

## Añadir clips reales
1. Abre `AUDIO_MANIFEST.keys` en app.js: es el **guion de locución** (texto por idioma de cada clave).
2. Graba/exporta cada clave en ES y EN (voz clara y cálida, ritmo ~0.9x, 44.1 kHz, mono, mp3):
   - `audio/es/<key>.mp3`
   - `audio/en/<key>.mp3`
3. Marca las claves listas ejecutando:

   ```sh
   node tools/gen-audio-manifest.mjs
   ```

   Lista solo las claves que existen en **todos** los idiomas. Pega el array impreso en
   `AUDIO_MANIFEST.available` (app.js).
4. (Opcional) Añade `key:'<clave>'` a los call-sites de `speak/speakSeq` que quieras que usen
   voz humana (ver PASO 4 de la integración). Sin este paso, las voces siguen en TTS.
5. Sirve la app (http/https) y recarga: las claves con clip usan voz humana; el resto, TTS.

## Convención de nombres
`audio/<idioma>/<clave>.mp3` — p.ej. `audio/es/intro_tap.mp3`, `audio/en/cheer_great.mp3`.
Los nombres de clave deben coincidir EXACTAMENTE con las de `AUDIO_MANIFEST.keys`.

## Claves iniciales (guion)
| clave | ES | EN |
|---|---|---|
| intro_tap | ¡Toca para jugar! | Tap to play! |
| cheer_great | ¡Muy bien! | Great job! |
| cheer_wow | ¡Excelente! | Well done! |
| cheer_win | ¡Lo lograste! | You did it! |
| cheer_amazing | ¡Eres increíble! | You are amazing! |
| lang_es | Español | Español |
| lang_en | English | English |
| break_title | ¡Hora de descansar! | Time for a break! |
| break_bye | ¡Nos vemos pronto! | See you soon! |
