# Mejora #10 — Alineación a estándares preescolares ("estandares-preescolar")

**Tipo:** content · **Entregable:** `content.json` (mapeo) + este documento
(metodología, fuentes, limitaciones) + `integration.md` (anclas de origen).

## 1. Qué problema resuelve

Pequeñautas (3–5 años, bilingüe ES/EN) tenía contenido pedagógico sólido
(conteo, subitización, comparación, letras, hábitats, dieta animal) pero
**ninguna referencia explícita a marcos curriculares preescolares**. Esto
importa para dos audiencias:

- **Educadores/centros:** quieren saber "¿esto que juega mi peque, a qué
  objetivo de aprendizaje corresponde en el currículo que yo uso?"
- **Inversionistas/partners (p. ej. distribución en EE. UU. o LATAM):**
  suelen pedir una matriz de alineación a estándares como parte de
  due diligence de producto edtech.

Este entregable produce esa matriz, con trazabilidad hasta el código
(`app.js`) y hasta las fuentes oficiales de cada estándar.

## 2. Marcos elegidos y por qué

| Framework | Por qué se incluyó |
|---|---|
| **CCSS-K** (Common Core, Kindergarten) | Es el marco que el brief pide explícitamente ("tipo CCSS-K"); es el más citado en edtech de habla inglesa. **Ojo:** es de Kindergarten (~5-6 años), un año por encima del rango de la app — se usa como alineación "hacia adelante", nunca como algo que un preescolar de 3 años deba cumplir hoy. |
| **Head Start ELOF** (2015) | Es el único de los marcos incluidos diseñado explícitamente para 3–5 años (banda "Preschooler"). Es el marco de mejor ajuste de edad y el que debería pesar más en cualquier conversación con un educador de preescolar en EE. UU. |
| **NGSS-K** | CCSS no cubre ciencias; NGSS es su contraparte de facto en la práctica de alineación curricular de EE. UU., y Pequeñautas no tenía ninguna referencia científica formal (los dos juegos de Ciencias — hábitat y dieta — quedaban sin marco). |
| **BCEP-CL** (Chile, Bases Curriculares Educación Parvularia) | La app es bilingüe ES/EN; su contenido en español merece poder situarse en un marco curricular en español, no solo en normas de EE. UU. Se eligió Chile por ser uno de los marcos preescolares hispanohablantes más documentados y accesibles públicamente. Nivel de Transición cubre 4–6 años. |
| **NAEYC DAP (2022)** | Ya citado en `app.js` (cabecera y `S.tip`) como base del diseño pedagógico general. Se incluye solo por trazabilidad — no aporta códigos de ítem, se documenta como tal. |

No se incluyeron otros marcos (p. ej. Texas Prekindergarten Guidelines, EYFS
del Reino Unido) por acotar el alcance de esta primera versión; quedan como
candidatos naturales para una v2 de este mapeo si el negocio lo requiere.

## 3. Metodología

1. Se leyeron `ship/app.js` y `ship/index.html` completos para extraer, sin
   modificar nada, el catálogo real de contenido jugable: rangos de conteo
   (`MATH_LEVELS`), letras por idioma (`LETTERS`), animales con hábitat y
   dieta (`ANIMALS`, `HAB`, `DIET`, `DIET_CAT`), y las claves exactas que
   `logRound()` registra en `profile.ev[]` para cada ronda (`math-N`,
   `math-sub-N`, `math-cmp`, `read-L`, `sci-{hab}`, `sci-diet-{d}`).
2. Se agruparon esas claves en 6 "dominios" pedagógicos (dos de Matemáticas
   más comparar, dos de Lectura —reconocimiento de letra y conciencia
   fonológica, que comparten la misma ronda de juego—, dos de Ciencias).
3. Para cada dominio se buscaron objetivos de aprendizaje reales en las
   fuentes oficiales de cada framework (ver tabla de arriba), priorizando
   documentos primarios (PDF del organismo emisor) sobre resúmenes de
   terceros.
4. Cada código de estándar en `content.json` lleva un campo `confidence`:
   - `verified`: el texto citado se confirmó contra una fuente primaria/oficial durante esta investigación.
   - `pending_verification`: el área/núcleo y la existencia del OA se confirmaron, pero el texto literal citado no se pudo reconciliar 1:1 contra la sección exacta del documento oficial en esta sesión (ver sección 4 abajo).

## 4. Fuentes consultadas (con URL) y qué se verificó en cada una

- **CCSS-K Math (K.CC.B.4, K.CC.B.5, K.CC.C.6) y ELA (RF.K.1d, RF.K.2d, RF.K.3a)**
  — http://www.corestandards.org/ — códigos y textos estándar, ampliamente
  documentados y estables desde 2010; no requirieron verificación adicional
  en esta sesión más allá del conocimiento ya consolidado sobre este marco.
- **Head Start ELOF, banda Preschooler (P-MATH 1–5, P-SCI 1–3, P-LIT 1–3)**
  — verificado contra un mirror del PDF oficial:
  https://highscope.org/wp-content/uploads/2018/08/HeadStartEarlyLearning0-5toCORAdvantage1.5_2_24_17-SS.pdf
  — se transcribieron los títulos/textos de goal tal como aparecen ahí.
- **NGSS-K** (K-LS1-1) — https://www.nextgenscience.org/ — código estable y
  público, ampliamente documentado.
- **BCEP-CL, Núcleo Pensamiento Matemático, OA6 (Nivel Transición)** —
  verificado contra:
  https://parvularia.mineduc.cl/wp-content/uploads/2021/11/8.-Fichas-Pedagogicas-NT-Pensamiento-Matematico.pdf
  — texto confirmado: *"Emplear los números, para contar, identificar,
  cuantificar y comparar cantidades hasta el 20 e indicar orden o posición
  de algunos elementos en situaciones cotidianas o juegos."*
- **BCEP-CL, Núcleo Lenguaje Verbal (conciencia fonológica / letras)** —
  se intentó verificar contra el PDF oficial completo de las Bases
  Curriculares 2018
  (https://parvularia.mineduc.cl/wp-content/uploads/2019/09/Bases_Curriculares_Ed_Parvularia_2018-1.pdf,
  págs. 67–72), pero la herramienta de extracción usada en esta sesión no
  logró recuperar esa sección específica del documento. Se encontró un texto
  candidato en una fuente secundaria oficial (Programa Pedagógico NT1/NT2,
  MINEDUC) — *"Iniciar progresivamente la conciencia fonológica (sonidos de
  las palabras habladas) mediante la producción y asociación de palabras que
  tengan los mismos sonidos iniciales (aliteraciones) y finales (rimas)"* —
  pero el número de OA asociado varió entre fuentes consultadas (6 vs. 11),
  así que se marcó `pending_verification`.
- **BCEP-CL, Núcleo Exploración del Entorno Natural (hábitat/dieta de
  animales)** — se confirmó que existen OA numerados en este núcleo para
  Nivel Transición (índice oficial de curriculumnacional.cl menciona "OA 06
  EEN NT" y "OA 07 EEN NT"), y se verificó el texto de OA1 del mismo núcleo
  (sobre "interés y asombro" ante cambios en el entorno, sección de progresión
  de OA1 en https://parvularia.mineduc.cl/wp-content/uploads/2020/09/Programa-Pedagogico-NT1-y-NT2.pdf,
  pág. 37), pero **no** el texto de OA6/OA7, que son los más pertinentes
  para "características/hábitat de animales" y quedan como
  `pending_verification`.

## 5. Limitaciones y qué falta para "certificación formal"

1. **Dos entradas quedan `pending_verification`** (Lenguaje Verbal — sonido
   inicial/letras — y Exploración del Entorno Natural — hábitat/dieta —,
   ambas en BCEP-CL). El núcleo/área está confirmado; el número y texto
   exacto del OA no. Antes de presentar este mapeo como "certificado" ante
   un centro educativo chileno, alguien con acceso de lectura cómoda al PDF
   completo de BCEP 2018 (idealmente impreso o con un lector de PDF normal,
   no vía herramienta de scraping) debe confirmar esas dos filas.
2. **CCSS-K y NGSS-K son de Kindergarten, no de preescolar** (edad 5–6 vs.
   3–5). Este documento los usa deliberadamente como objetivos de
   "alineación hacia adelante" (*builds toward*), nunca como afirmación de
   que un niño de 3 años "cumple" el estándar. Cualquier material de
   marketing derivado de este mapeo debe preservar ese matiz para no ser
   engañoso.
3. **Granularidad de `math-cmp` y de las claves de Ciencias**: como se
   explica en `integration.md` §1.3, las claves de log de Ciencias agrupan
   por categoría (hábitat/dieta), no por animal, y `math-cmp` no distingue
   qué par de números se comparó. El mapeo a estándares es correcto a nivel
   de dominio/destreza, pero no permite decir "este niño domina
   específicamente comparar 3 vs. 5" — solo "domina comparar cantidades" en
   general. Es la misma limitación ya documentada por la mejora #7
   (`07-secuenciacion`) para la misma clave.
4. **No hay generación automática.** Si el contenido de `app.js` cambia
   (nueva letra, nuevo animal, nuevo rango de nivel matemático),
   `content.json` debe actualizarse manualmente — no existe ningún script
   de sincronización en este entregable (sería una mejora de tipo "code"
   fuera del alcance de la #10).
5. **Sin wiring a la UI.** Esta mejora no modifica `app.js` ni
   `index.html`: no hay ningún badge, tooltip ni pantalla nueva que muestre
   estos estándares dentro de la app. `integration.md` §2 deja documentado,
   a título de referencia, cómo una futura mejora de tipo "code" podría
   consumir este JSON sin tocar `renderProgress2`, pero construir esa UI
   queda fuera del alcance de esta entrega de contenido.

## 6. Privacidad / seguridad

Este entregable es 100% metadatos de currículo (qué enseña cada ítem del
juego). No contiene, referencia ni requiere ningún dato de perfil de niño,
evento de `profile.ev[]`, ni PII. No abre red en runtime (no se ejecuta en
runtime en absoluto: es un JSON de referencia, no código). No interactúa con
`window.PEQUE_FLAGS.backendSync` ni con el diseño de Supabase descrito en
`docs/backend-supabase.md`.
