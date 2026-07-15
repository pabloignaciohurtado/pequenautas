# #29 · Auditoría legal COPPA / GDPR-K + Política de privacidad (borrador)

> **Estado: GATED.** Este documento es una **auditoría técnica** y un **borrador**
> de política de privacidad preparados por el agente de ingeniería. **No
> constituyen asesoría legal ni una política vigente.** Antes de publicar la
> política o de declarar cumplimiento ante terceros (tiendas de apps,
> reguladores, colegios/clientes B2B), un **abogado con competencia en
> privacidad infantil (COPPA en EE. UU., art. 8 RGPD/"GDPR-K" en UE, y
> normativa local aplicable) debe revisar, corregir y FIRMAR** el contenido de
> `politica-privacidad.md`. Ver §7 "Candado de firma legal" para el detalle
> exacto de lo que falta y quién debe resolverlo.

Punto de fase 4 · tipo `docs` · no modifica `ship/app.js` ni `ship/index.html`
(no hay código en este entregable: es auditoría + borrador documental).

---

## 1. Alcance y metodología

**Alcance auditado:** el árbol `ship/` tal como está desplegado hoy (v0.4,
Sprint 1–3 + mejoras de fase 4 ya integradas a `main`), más los **scaffolds
DISEÑADOS PERO NO ACTIVOS** de fase 4 que tocan datos (`25-backend-supabase`,
`26-panel-nube-cohortes`, `27-pipeline-analitica`), porque aunque no corren hoy
son el mapa de lo que se activaría a futuro y deben quedar cubiertos por el
mismo estándar de cumplimiento antes de encenderse.

**Metodología:** lectura directa de código (no dinámica; no se instrumentó
tráfico de red real) sobre:
- `ship/app.js` (persistencia, analítica, voz, exportación CSV, flags).
- `ship/index.html` (recursos externos cargados: fuentes, meta tags).
- `ship/sw.js` (qué cachea el service worker y de qué orígenes).
- `ship/manifest.webmanifest` (metadatos PWA, iconos).
- `ship/docs/backend-supabase.md` (diseño ya existente del backend opcional).
- Manifiestos de `fase4/25-backend-supabase`, `fase4/26-panel-nube-cohortes`,
  `fase4/27-pipeline-analitica` (scaffolds inertes, no wireados).

Cada hallazgo se contrasta contra:
- **COPPA** (EE. UU., 16 CFR Part 312 — Children's Online Privacy Protection
  Rule), aplicable porque la app está dirigida a niños de 3–5 años (audiencia
  "child-directed").
- **"GDPR-K"**: art. 8 del RGPD (condiciones para el consentimiento del niño
  en servicios de la sociedad de la información) + directrices del EDPB sobre
  tratamiento de datos de menores, aplicable si hay usuarios/adultos
  responsables en la UE/EEE.

Este documento **no sustituye** una auditoría legal formal ni un DPIA/EIPD
(Evaluación de Impacto en Protección de Datos) completo; es la base técnica
para que esa auditoría sea rápida y barata.

---

## 2. Resumen ejecutivo

**Veredicto técnico general: la postura de privacidad de Pequeñautas hoy es
fuerte para una app infantil** — offline-first, sin cuentas de niño, sin
backend activo, sin SDKs de analítica/publicidad de terceros, con
minimización de datos ya aplicada en el diseño (`ev[]` es 100% conductual y
anónimo, nunca PII). El backend opcional está honestamente apagado
(`PEQUE_FLAGS.backendSync=false`) y ya fue diseñado en `docs/backend-supabase.md`
pensando en COPPA/GDPR-K desde el principio (alias en vez de nombre real, RLS
por dueño, retención con TTL, borrado en cascada).

Aun así, la auditoría encontró **3 puntos reales que requieren decisión y,
en dos casos, remediación técnica sencilla**, y **1 vacío de proceso**
(ausencia de una política de privacidad publicada) que este entregable
resuelve con un borrador. Ninguno de los hallazgos es un incumplimiento
"activo" hoy (no hay backend encendido, no hay venta de datos, no hay
publicidad), pero sí hay **llamadas de red de terceros que ocurren siempre
que la app corre bajo http(s)** (no bajo `file://`) que deben documentarse y,
donde el coste es bajo, mitigarse.

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| H1 | Google Fonts (`fonts.googleapis.com`/`fonts.gstatic.com`) se cargan en cada visita bajo http(s); transmiten la IP del dispositivo a Google incluso antes de cualquier interacción o consentimiento. | Media | Documentado; remediación técnica sugerida (auto-hospedar la fuente) queda fuera de este entregable de tipo `docs` — ver H1 abajo. |
| H2 | `speechSynthesis` (Web Speech API) puede usar, según navegador/SO, voces "de red" que envían el texto a sintetizar a un servidor del proveedor del navegador (p. ej. algunas voces de Chrome/Android son remotas). El texto enviado es siempre contenido fijo de la app (preguntas/frases del juego), nunca datos introducidos por el niño, pero el canal de red existe y no está bajo control de Pequeñautas. | Media-baja | Documentado; sin remediación 100% posible desde la app (es comportamiento del navegador), mitigable parcialmente prefiriendo voces locales cuando existan (ver H2 abajo). |
| H3 | No existe hoy una política de privacidad publicada ni un aviso de privacidad accesible desde la app o el listing de tienda. | Media (proceso, no técnico) | Resuelto en este entregable con un **borrador** (`politica-privacidad.md`) — pendiente de firma legal antes de publicar. |
| H4 | Los scaffolds `25-backend-supabase`, `26-panel-nube-cohortes` y `27-pipeline-analitica` están diseñados y su código de red está verificado como inerte (no hay ninguna ruta ejecutable que abra `fetch`/socket con la configuración por defecto), pero **no han pasado por revisión legal** de su diseño de datos (alias, RLS, retención, k-anonimato en #27). | Baja hoy / Alta si se activan sin revisión | Este documento formaliza el requisito: **ninguno de los tres se activa sin que este mismo proceso de auditoría (§7) se repita sobre su diseño final.** |

Ningún hallazgo bloquea el uso actual de la app (todo lo anterior ya es
público/documentado o de severidad media-baja), pero **sí bloquea**:
(a) publicar cualquier afirmación de "cumplimiento COPPA/GDPR-K" hacia
terceros, y (b) activar cualquiera de los tres backends opcionales — ambos
casos requieren la firma legal de §7.

---

## 3. Inventario de datos y superficies auditadas

### 3.1 Datos que la app recolecta y dónde viven

| Dato | Campo | Origen | Destino | PII? |
|---|---|---|---|---|
| Nombre del perfil | `profile.name` | Tecleado por el adulto/niño en `#nameInput` al crear perfil (`createProfile()`) | `localStorage` (`pequenautas.v1`), **solo en el dispositivo** | Sí, potencialmente (puede ser un nombre real si el adulto lo elige así) |
| Avatar | `profile.avatar` | Elegido de una lista fija de 10 emoji (`AVATARS`) | `localStorage` | No |
| Estrellas / nivel | `profile.stars`, `profile.best` | Generado por el juego | `localStorage` | No |
| Eventos de aprendizaje | `profile.ev[] = {g,k,ft,at,ms,as}` | Generado por `logRound()` tras cada ronda | `localStorage` | No (materia, clave de contenido, acierto a la 1ª, intentos, ms, asistido — sin identificar a nadie por sí solo) |
| Ajustes (sonido, animación, guía, sesión, idioma, etc.) | `DB.settings.*` | Elegidos por el adulto en el panel de ajustes | `localStorage` | No |
| Texto hablado por la app (TTS) | frases fijas de `UI[lang]` | Código de la app (nunca input del niño) | Motor de voz del navegador/SO (local o remoto según el caso — ver H2) | No (es contenido de la app, no del usuario) |

**No se recolecta:** apellidos, fecha de nacimiento exacta, dirección, correo,
teléfono, foto/video, voz grabada del niño, geolocalización, identificadores
publicitarios (IDFA/GAID), ni ningún identificador persistente cross-app o
cross-site. No hay cuentas de niño ni autenticación del niño en ningún punto
del flujo (`selectProfile()` es una simple elección local, sin credenciales).

### 3.2 Persistencia

`loadDB()`/`saveDB()` usan exclusivamente `localStorage` con la clave
`pequenautas.v1`, con **fallback en memoria** si `localStorage` no está
disponible (try/catch silencioso). Todo el dato vive **únicamente en el
dispositivo del usuario**; no hay sincronización activa a ningún servidor
propio ni de terceros (`PEQUE_FLAGS.backendSync=false`, sin `sync.js` cargado
desde `index.html`/`app.js`).

### 3.3 Red bajo `file://` (smoke tests)

Confirmado por lectura de código: **ninguna** ruta de `app.js` abre `fetch`,
`XMLHttpRequest` ni WebSocket. La única aparición de `fetch(` en el árbol
`ship/` está en `sw.js` (el *service worker*, que ni siquiera se registra
bajo `file://` — `registerPWA()` comprueba `location.protocol==='https:' ||
location.hostname==='localhost'||'127.0.0.1'` antes de llamar a
`serviceWorker.register()`). Esto es consistente con el requisito duro del
proyecto de no tocar red bajo `file://` y con que los 19 tests Playwright
actuales sigan pasando.

### 3.4 Red bajo http(s) (producción / Vercel)

Cuando la app corre servida (no `file://`), sí existen estas llamadas de red,
**ninguna dirigida por datos del niño**, pero relevantes para la política de
privacidad:

1. **Google Fonts** (`index.html`): `<link rel="preconnect" href="https://fonts.googleapis.com">`,
   `...fonts.gstatic.com...` y la hoja de estilos de la tipografía "Fredoka".
   Esta petición ocurre en la carga inicial de la página, **antes** de
   cualquier interacción, y transmite la IP del dispositivo a servidores de
   Google (ver H1).
2. **Service worker** (`sw.js`, solo bajo https/localhost): cachea el *app
   shell* (`index.html`, `app.js`, `manifest.webmanifest`) y, adicionalmente,
   los recursos de `fonts.googleapis.com`/`fonts.gstatic.com` para que
   funcionen offline tras la primera visita (`FONT_HOSTS`). No añade ningún
   destino de red nuevo respecto al punto 1; solo cachea lo que ya se pidió.
3. **Prompt de instalación PWA** (`beforeinstallprompt`/`appinstalled`): es
   una API del navegador, no hace red por sí misma.

No se detectó ningún SDK de analítica, publicidad, atribución ni tracking de
terceros (Google Analytics, Meta Pixel, Sentry, etc.) en `ship/`.

### 3.5 Voz (Text-to-Speech)

`speak()`/`speakSeq()` usan `window.speechSynthesis` (Web Speech API) del
navegador. El **texto** que se sintetiza es siempre una cadena fija definida
en el código (`UI.es`/`UI.en`, nombres de letras/animales, etc.) — **nunca**
el nombre del niño ni ningún dato introducido por él. Sin embargo, la
*implementación* de `speechSynthesis` es responsabilidad del navegador/SO: en
algunas combinaciones (notablemente algunas voces de Chrome/Android) la
síntesis se realiza en un servidor remoto del proveedor, lo que implica que
ese texto (siempre contenido de la app, no del usuario) viaja a un tercero.
Pequeñautas no elige explícitamente "solo voces locales" (`pickVoice()` no
filtra por `voice.localService`). Ver H2.

### 3.6 Exportación de datos (panel educador)

`eduExportCSV()` genera el CSV **100% en el cliente** con `Blob` +
`URL.createObjectURL` (sin red) y ya implementa una **guarda anti-fórmula**
(`/^[=+\-@]/` → antepone `'`) para prevenir CSV injection al abrir el archivo
en Excel/Sheets — buena práctica de seguridad ya presente, verificada en
`eduExportCSV()`. Los nombres de perfil que aparecen en pantalla (no en el
CSV en texto plano sin escapar) pasan por `eduEsc()` contra XSS.

### 3.7 Backend opcional (diseñado, apagado)

`docs/backend-supabase.md` documenta un backend Supabase con: alias
seudónimo (nunca nombre real) para sincronizar, RLS por `owner=auth.uid()`,
edge function de *ingest* idempotente, retención de 365 días con purga, y
borrado en cascada. **Nada de esto está wireado** a `ship/index.html`/`app.js`
hoy — es diseño puro. El flag existe y está en `false`:
`window.PEQUE_FLAGS = Object.assign({ backendSync:false }, window.PEQUE_FLAGS||{});`

Los scaffolds de fase 4 relacionados (`25-backend-supabase`,
`26-panel-nube-cohortes`, `27-pipeline-analitica`) llevan la misma disciplina:
cada uno documenta en su propio manifiesto que **ninguna ruta de código abre
red** con la configuración por defecto (verificado por sus autores con
lectura/`grep`/ejecución de Node fuera de este entregable). Este documento no
vuelve a re-verificar esos tres scaffolds línea por línea (están fuera del
alcance de "docs" de este punto), pero los **incorpora al mismo candado de
firma legal** antes de activación (§7).

---

## 4. Mapeo de cumplimiento COPPA (16 CFR Part 312)

Ver detalle accionable ítem por ítem en `checklist-coppa-gdprk.md` §A.
Resumen por obligación clave de la Rule:

- **§312.3 Notice** (aviso claro de qué se recolecta y para qué): **pendiente**
  hasta publicar `politica-privacidad.md` firmada (H3).
- **§312.4 Direct notice to parents / consentimiento verificable**: no
  aplica hoy porque **no se recolecta información personal fuera del
  dispositivo** (no hay backend activo); pasa a ser obligatorio **antes** de
  activar cualquier sync (§7, hereda el gate ya definido en
  `fase4/25-backend-supabase`).
- **§312.5 Parental consent mechanisms**: el diseño de
  `docs/backend-supabase.md` ya prevé un "parent gate" con registro de
  consentimiento (`DB.settings.sync={on,consentAt,policyVersion}`) — correcto
  en diseño, no implementado (scaffold).
- **§312.6 Right to review/delete** (derecho de los padres a revisar y
  eliminar datos del niño): **ya cumplido localmente** — el dato vive en el
  dispositivo del adulto y puede eliminarse por completo borrando
  `localStorage` (no hay UI dedicada de "borrar todo" hoy; **recomendación
  no bloqueante**: añadir un botón de "borrar todos los datos" en el panel de
  adultos sería una mejora de fase 4 futura, no parte de este punto #29).
- **§312.8 Data retention and deletion** (retención mínima): cumplido
  localmente (no hay retención indefinida en servidor porque no hay
  servidor); el diseño de backend ya prevé TTL de 365 días.
- **§312.10 Data security** (medidas razonables de seguridad): cumplido para
  la superficie actual (escape XSS, guarda anti-fórmula CSV, sin
  transmisión de datos del niño); a revisar de nuevo cuando se active
  cualquier backend (TLS, RLS ya diseñados).
- **"Mixed audience" / edad objetivo**: Pequeñautas es *child-directed* de
  forma inequívoca (contenido, diseño, App Store/Play Store listing
  esperado), por lo que **aplica COPPA en su forma más estricta** (no hay
  ambigüedad de "audiencia mixta" que permitiría neutral age-screening).

## 5. Mapeo de cumplimiento GDPR-K (art. 8 RGPD + guías EDPB)

Ver detalle en `checklist-coppa-gdprk.md` §B. Resumen:

- **Base legal / titularidad del consentimiento**: correctamente diseñada
  para recaer en el adulto (nunca el niño) — art. 8.1 RGPD exige
  consentimiento parental para servicios de la sociedad de la información
  ofrecidos directamente a un niño menor de 16 años (o la edad menor que fije
  el Estado miembro, mínimo 13). Pequeñautas no pide consentimiento alguno
  hoy porque no hay tratamiento fuera del dispositivo — correcto mientras
  `backendSync=false`.
- **Minimización y limitación de la finalidad** (art. 5.1.b/c): cumplido —
  `ev[]` es el mínimo necesario para el panel de progreso, sin más.
- **Transferencias a terceros** (Google Fonts): la carga de fuentes desde
  `fonts.googleapis.com` transmite la IP del visitante a Google al cargar la
  página, **sin que medie consentimiento ni exista una base legal explícita
  documentada para esa transferencia concreta** — este es exactamente el tipo
  de hallazgo que motivó la jurisprudencia europea sobre Google Fonts
  auto-hospedadas (p. ej. la sentencia del LG München I de 2022) y debe
  tratarse como **hallazgo real** (H1), no cosmético.
- **Derechos del interesado (acceso, rectificación, supresión, portabilidad)**:
  cumplidos de forma trivial hoy (todo el dato está en el dispositivo del
  adulto, editable/borrable directamente); a re-diseñar cuando exista
  backend, ya previsto en `docs/backend-supabase.md` §1.5.
- **DPIA / Evaluación de Impacto**: **recomendado antes de activar cualquier
  backend** que trate datos de menores a escala, aunque sean seudonimizados
  — no aplica hoy (no hay tratamiento fuera del dispositivo).
- **Responsable del tratamiento (controller)**: hoy, arguiblemente **no hay
  "tratamiento" en el sentido del RGPD que involucre a Pequeñautas como
  responsable**, porque los datos nunca salen del dispositivo del propio
  adulto (autotratamiento / "household exception" análoga, a confirmar con
  el abogado revisor). Esto cambia en cuanto se active cualquier
  sincronización.

---

## 6. Hallazgos detallados y remediación sugerida

### H1 — Google Fonts de terceros sin consentimiento previo (Media)
**Dónde:** `ship/index.html` líneas del `<head>` (`preconnect`/`stylesheet` a
`fonts.googleapis.com`/`fonts.gstatic.com`); cacheado adicionalmente por
`ship/sw.js` (`FONT_HOSTS`).
**Por qué importa:** transmite la IP del dispositivo a Google en cada carga,
sin consentimiento ni control del usuario, y sin mención en ninguna política.
**Remediación sugerida (fuera de alcance de código en este punto `docs`,
queda como recomendación para un futuro punto de fase 4 de tipo `code`):**
auto-hospedar los archivos `.woff2` de "Fredoka" dentro de `ship/` (o de un
CDN propio del mismo origen) y eliminar los `<link>` a `fonts.googleapis.com`/
`fonts.gstatic.com`. Es una mejora de bajo riesgo técnico (misma fuente, sin
cambios visuales) que elimina por completo la transferencia a terceros.
**Mientras tanto:** mencionarlo explícitamente en la política de privacidad
(ya incluido en el borrador, ver `politica-privacidad.md` §"Terceros y
fuentes tipográficas").

### H2 — Voces de síntesis de voz potencialmente remotas (Media-baja)
**Dónde:** `pickVoice()`/`speak()`/`speakSeq()` en `app.js`.
**Por qué importa:** el navegador puede usar un motor de voz remoto para
algunas voces sin que la app lo controle; el contenido enviado es siempre
texto fijo de la app, nunca dato personal del niño, lo que reduce
severamente el riesgo, pero el canal de red existe y su proveedor/jurisdicción
no está bajo control de Pequeñautas.
**Remediación sugerida (no bloqueante, fuera de alcance de este punto):**
si en el futuro se desea eliminar por completo esta superficie, preferir
`voice.localService===true` al elegir voz en `pickVoice()`, con fallback al
comportamiento actual si no hay voz local disponible para el idioma. El
banco de audio pregrabado ya scaffoldeado al final de `app.js`
("Voces pregrabadas ES/EN") apunta en esta dirección a largo plazo (evita
TTS en tiempo real por completo una vez locutados los clips).
**Mientras tanto:** mencionarlo en la política (ya incluido en el borrador).

### H3 — Sin política de privacidad publicada (Media, proceso)
**Resuelto por este entregable** con `politica-privacidad.md`, un borrador
completo ES/EN. **No debe publicarse tal cual**: requiere revisión y firma
legal (§7).

### H4 — Scaffolds de backend sin revisión legal de su diseño final (Baja hoy)
**Dónde:** `fase4/25-backend-supabase`, `fase4/26-panel-nube-cohortes`,
`fase4/27-pipeline-analitica`.
**Por qué importa:** aunque hoy están inertes (ninguno abre red con la
configuración por defecto, según sus propios manifiestos), representan la
superficie de mayor riesgo legal futuro del proyecto (datos de menores
saliendo del dispositivo). No deben activarse "por default" sin que este
mismo proceso de auditoría se repita sobre su implementación final real
(no solo sobre el diseño).
**Remediación:** este documento formaliza la regla en §7; no requiere cambio
de código adicional hoy.

---

## 7. Candado de firma legal (GATED)

Este es el **candado real** de la mejora #29 (declarado como `gated:true` en
`manifest.json`). Es un candado de **decisión legal/humana**, no de permisos
técnicos de este agente ni de infraestructura faltante.

**Lo que falta, exactamente:**

1. **Un abogado (o firma legal) con competencia en privacidad infantil**
   (COPPA en EE. UU. y art. 8 RGPD/GDPR-K en UE, más cualquier normativa
   local del/los país(es) de distribución objetivo) debe **leer y corregir**
   `politica-privacidad.md`: nombres reales del responsable del tratamiento,
   dirección de contacto legal, jurisdicción aplicable, fecha de vigencia,
   y cualquier cláusula adicional exigida por la tienda de apps (Apple/Google
   tienen sus propios requisitos de "Kids Category"/"Designed for Families"
   que exceden COPPA/GDPR-K).
2. **Una decisión de producto/negocio** sobre: (a) si se auto-hospeda Google
   Fonts (H1) antes de publicar la política, o si se documenta como
   excepción aceptada; (b) qué jurisdicción(es) de distribución concreta(s)
   determinan qué anexos de la política aplican (EE. UU. / UE / otras).
3. **La firma/aprobación formal** (registro de quién aprobó, cuándo, y qué
   versión) antes de: (a) publicar la política en producción, (b) declarar
   cumplimiento COPPA/GDPR-K ante una tienda de apps, colegio/cliente B2B, o
   regulador, y (c) activar `PEQUE_FLAGS.backendSync`,
   `PEQUE_FLAGS.analyticsAgg`, o cualquier otro flag de red futuro de datos
   de menores.

Ninguno de estos tres puntos es alcanzable dentro de este entorno de trabajo
(no hay una firma legal real disponible para este agente, y no corresponde
que un agente de IA emita una opinión legal vinculante). El checklist
accionable de §4/§5 y el borrador de `politica-privacidad.md` dejan el
trabajo técnico-documental listo para que ese paso humano sea rápido.

---

## 8. Referencias

- `ship/docs/backend-supabase.md` — diseño del backend opcional ya alineado
  con estos principios.
- `ship/docs/CONTEXT.md` — memoria de decisiones del proyecto.
- `fase4/25-backend-supabase/`, `fase4/26-panel-nube-cohortes/`,
  `fase4/27-pipeline-analitica/` — scaffolds cubiertos por el mismo candado.
- 16 CFR Part 312 (COPPA Rule), FTC.
- Reglamento (UE) 2016/679 (RGPD), art. 8; directrices del EDPB sobre
  tratamiento de datos de menores (2020/2021).
- Requisitos de tienda: Google Play "Families Policy" / Apple App Store
  "Kids Category" (a revisar por separado al momento de publicar en cada
  tienda; no cubiertos en profundidad por este documento).
