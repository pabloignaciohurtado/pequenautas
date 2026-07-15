# Pequeñautas — Fase 4 · MASTER PLAN de integración

> **Estado final (post-implementación):** las 6 oleadas están mergeadas a `main` y
> desplegadas en producción (PRs #1-13, la última tanda: #12 Oleada 5, #13 Oleada 6).
> Diferencia respecto al plan original de esta sección: **#24 "biblioteca-cojuego" NO
> se integró**, ni siquiera como el parche manual de contenido descrito abajo — su
> variable objetivo (`COPLAY_Q`) vive dentro de una IIFE de `app.js` y no es alcanzable
> desde fuera sin editar `app.js` (a diferencia de `LETTERS`/`ANIMALS`/`MATH_*`, que son
> `const` de nivel superior mutables in-place por #15). Queda como el único punto de los
> 30 sin entregar; ver §4 para los demás candados externos (16, 28, 29 código listo pero
> gateados por insumo humano) y §1 para el detalle punto por punto. Los nombres de
> archivo de tests reales de Oleada 6 difieren levemente del plan (`tests/fase4-wave6.spec.js`
> con 3 tests, no `pwa-store.spec.js` con 7) — el resto del documento se deja tal cual se
> escribió antes de implementar, como registro histórico de la planificación.

Consolidación de los 30 specs (`/home/claude/fase4/NN-*/`) contra la base `ship/`
(`app.js` no-módulo `"use strict"`; las `function foo(){}` de nivel superior y sus
llamadas internas resuelven vía el objeto global, por lo que reasignar
`window.speak/afterCorrect/nextRound/roundReading/roundMath/renderScienceRound/refreshHome/…`
SÍ intercepta a los llamadores internos — patrón aditivo por envoltura, cadena de
responsabilidad). Riesgo latente estructural: una futura migración a módulos ES/bundler
tumbaría a la vez a todas las mejoras que dependen de esa resolución global.

Estados: **código-listo** (code, integrable hoy sin acción humana) ·
**contenido** (JSON de referencia, sin wiring) ·
**scaffold** (activable, no encendido, sin wiring) ·
**candado-externo** (bloqueado por un insumo humano/legal/infra fuera de este entorno).

---

## 1) Tabla de los 30 puntos

| # | Slug | Tipo | Estado | Globals clave (reasignados / nuevos) | domIds clave | Riesgo principal |
|---|------|------|--------|--------------------------------------|--------------|------------------|
| 1 | eval-pre-post | code | **código-listo** | `nextRound` (wrap); `__assess`, `__assessWrapped` | `assessHead`, `assessRows` | Observa `#progBody` asumiendo repintado total de `renderProgress2`; `pre` histórico se recalcula desde el despliegue. |
| 2 | ab-testing | code | **código-listo** | `afterCorrect` (wrap); `abVariant`, `__ab`, `__abWrapped` | `abCompareBlock`, `abChildren` | Wrap apilable sobre `afterCorrect`; 50/50 aprox (hash de id). Observa `#eduBody`. |
| 3 | repaso-espaciado | code | **código-listo** | Ninguno del patrón reasignado; `srsCompute`, `__srs` | `srsPanel`, `srsPlay`, `srsStage`… | Sesión de repaso se reinicia al repintar `#progBody`; solo reintroduce claves con fallo histórico. |
| 4 | indice-dominio | code | **código-listo** | `renderEducator` (wrap); `__domi`, `__domiWrapped` | `eduDomHeading` | Depende de `renderEducator` con `innerHTML` total; heurística no validada pedagógicamente. |
| 5 | deteccion-frustracion | code | **código-listo** | `afterCorrect`, `renderEducator` (wrap); `__frustration`; `DB.settings.frustration`; `profile.frustAlerts` | `frustCard`, `frustBadge`, `setFrust`, `tgFrust` | `setInterval` 1s solo-lectura; umbrales heurísticos; abandono deja `frustAlerts>0` sin evento (contemplado). |
| 6 | motor-adaptativo | code | **código-listo** | `afterCorrect`, `roundMathCount`, `renderProgress2` (wrap); `AdaptiveEngine` | `setAdaptive`, `tgAdaptive`, `adaptNote` | Sesga `best.math` efímero (finally). **Choca con #8** (best.math) y **#7** (duplica roundMathCount). Solo materia math v1. |
| 7 | secuenciacion | code | **código-listo** | `nextRound` (wrap); `__seq`, `__seqWrapped` | `setSeq`, `tgSeq`, `seqBadge` | Mantiene DUPLICADO manual de roundXReinforce (re-sincronizar si cambian los originales). `math-cmp` no se refuerza. |
| 8 | zdp-dinamica | code | **código-listo** | `afterCorrect`, `roundMath`, `roundReading`, `renderScienceRound`, `refreshHome` (wrap); `ZDP` | `setZdp`, `tgZdp` | **Choca con #6/#12/#13/#14** (reasigna 4 dispatchers). Debe cargar DESPUÉS de #12/#13/#14 y delegar. |
| 9 | recomendador | code | **código-listo** | `refreshHome` (wrap); `__reco`, `__recoWrapped` | `recoCard`, `recoPlayBtn` | Solo-lectura; comparte `refreshHome` con #8/#11/#30 (cadena). No distingue "hoy" de "siempre". |
| 10 | estandares-preescolar | content | **contenido** | — | — | `content.json` de referencia, sin importar; 2 filas BCEP-CL `pending_verification`; sin sync automático. |
| 11 | materias-nuevas | code+content | **código-listo** | `nextRound`, `refreshHome`, `eduFaceOf` (wrap); `__moreSubjects` | `subj_emotions/shapes/routines`, `lvEmo`… | Opt-in (mantiene `.subject`=3). `faceOf` privado de `renderProgress2` no envolvible (clave cruda). |
| 12 | mates-avanzadas | code+content | **código-listo** | `pickMathRound`, `roundMath` (reasigna dispatcher ampliado); `__mathAdv` | — | Instala dispatcher `roundMath` ampliado → **debe cargar ANTES de #8**. `measure` gateado a nivel≥1. |
| 13 | lectura-avanzada | code+content | **código-listo** | `roundReading`, `eduFaceOf` (wrap); `__readingAdv` | `.syltile`, `.wordtile`, `.storyStrip` | Instala niveles sílaba/palabra/cuento → **antes de #8**. Verificado solo con Node, no Playwright. |
| 14 | ciencias-avanzada | code+content | **código-listo** | `renderScienceRound`, `eduFaceOf` (wrap); `__scienceAdv` | `.bodyFigure`, `.choice.season/.bin` | Instala rondas cuerpo/clima/reciclaje → **antes de #8**. Verificado solo con Node. |
| 15 | cms-json | code | **código-listo** | `renderEducator` (wrap, si existe); `CONTENT`, `CONTENT_API` | `cmsBadge` | Muta in-place `LETTERS/ANIMALS/MATH_*` (const): última mutación gana. Badge depende de #11. `loadFromURL` dormida. |
| 16 | voces-mascota | gated | **candado-externo** (+código mascota listo) | `afterCorrect`, `onWrong`, `show`, `speak`, `speakSeq` (wrap); `__mascot` | `#peqMascot`, `#pmFace`, `setMascot`, `tgMascot` | Mascota=código-listo. **Voces ES/EN gated: falta locución humana real** (AUDIO_MANIFEST.available vacío). Cargar ANTES de #20. |
| 17 | accesibilidad | code | **código-listo** | Ninguno reasignado; `__a11y` (solo addEventListener + MutationObserver) | `setHiContrast`, `setColorblind`, `a11yRoundStatus` | Filas ancladas en `#setSessLimit` (orden visual). Puramente aditivo, sin wraps. |
| 18 | dislexia | code | **código-listo** | `PEQUE_FLAGS.dyslexicFont`; `__dyslexia` | `setDyslexia`, `tgDyslexia` | Solo CSS + fila Ajustes. Fuente OpenDyslexic real no incluida (pila de sistema). |
| 19 | album-logros | code | **código-listo** | `logRound` (wrap); `__album` | `tabAlbum`, `albumView`, `albumBody` | 4ª pestaña (angostamiento en <360px). `playDays` usa fecha UTC. Hitos de esfuerzo, nunca rendimiento. |
| 20 | animaciones-personaje | code | **código-listo** | `afterCorrect`, `onWrong`, `show` (wrap); `__personajeAnim` | `#pa20Pet` (solo modo 'own') | **Choca con #16**: detecta `#peqMascot`→modo 'enhance'. Cargar DESPUÉS de #16 (si no, doble personaje). |
| 21 | reporte-semanal | code | **código-listo** (email gated) | `logRound`, `renderProgress2` (wrap); `PEQUE_FLAGS.weeklyReportEmail`; `__weeklyReport` | `weeklyReportBox`, `wrDownloadBtn`, `wrShareBtn` | Sella `ev.ts` solo en eventos nuevos (historial previo excluido). Envío por correo gated (sin backend). |
| 22 | metas-semanales | code | **código-listo** | `afterCorrect`, `renderProgress2` (wrap); `__weeklyGoal` | `weekGoalCard`, `setWeekGoal`, `tgGoalOn` | Antepone hijo en `#progBody`. "Sesión"=materia completada. `weekKeyFor` fecha local. |
| 23 | modo-aula | code | **código-listo** | `PequeAula` (sin reasignar nada); `DB.classroom` | `tabAula`, `aulaView`, `aulaGroupChips` | 4ª pestaña append. Foco = solo reporte, no gatea Home. Verificado sin Playwright real. |
| 24 | biblioteca-cojuego | content | **contenido** | — (parche manual a `var COPLAY_Q`) | — | Parche BEFORE→AFTER manual: un typo rompe `app.js`. Coplay sigue OFF. 36+9 preguntas sin 2º nativo. |
| 25 | backend-supabase | scaffold | **scaffold** (gated) | `PequeSync`, `PEQUE_FLAGS.backendSync` | — | `flush()` sin fetch real (not_implemented_pending_auth). Sin wiring. 6 candados producto/legal/infra. |
| 26 | panel-nube-cohortes | scaffold | **scaffold** (gated) | `PequeCohorts`; `DB.settings.cohorts` | — | Mitad local funciona sin red, sin wiring; mitad nube hereda candado #25 + 2 propios. Vistas SQL `security_invoker`. |
| 27 | pipeline-analitica | scaffold | **scaffold** (gated) | `PequeAggPipeline`, `PEQUE_FLAGS.analyticsAgg` | — | k-anon server-side; `rollupLocal` bucket_day aprox (sin ts por evento). 7 candados. Independiente de #25. |
| 28 | pwa-tiendas | gated | **candado-externo** (+código listo) | `PEQUE_STORE`; `paintInstall` (wrap) | — | Código TWA/atajos listo. **Publicación gated: dominio HTTPS, cuentas Play/Apple (pago), Mac+Xcode, política pública.** |
| 29 | auditoria-legal | docs | **candado-externo** | — | — | Auditoría COPPA/GDPR-K completa; **política requiere firma de abogado** (placeholders). No tocar código. H1/H2 sin remediar. |
| 30 | controles-parentales | code | **código-listo** | `passGate`, `refreshHome`, `startGame` (wrap); `registerLocale`, `UI_LOCALES`, `__parentalControls` | `tabParental`, `parentalView`, `pinView`, `dailyLimitOverlay` | Default `pinEnabled:false` (no-op). **Integrar AL FINAL** (applySubjectVisibility más externo). PIN djb2 (no cripto). |

**Recuento:** código-listo = **22** (1-9,11-15,17-23,30) · contenido = **2** (10,24) ·
scaffold = **3** (25,26,27) · candado-externo = **3** (16,28,29). Tests nuevos totales = **236**.

---

## 2) OLEADAS de integración (orden seguro, verificable)

> **Decisión de consolidación clave:** el orden "sugerido por auditoría" coloca #8 (ZDP)
> ANTES de #12/#13/#14, pero las resoluciones de conflicto exigen lo contrario (los
> dispatchers ampliados `roundMath`/`roundReading`/`renderScienceRound` deben existir
> antes de que #8 los envuelva). Por eso la **Oleada 2 (contenido)** se adelanta a la
> **Oleada 3 (motor adaptativo/ZDP)**. El orden de carga de `<script src="fase4/…">` en
> `index.html` es la fuente de verdad de "qué envoltura queda más externa": debe seguir
> el orden de oleadas y, dentro de cada una, el orden listado.

### Oleada 1 — Medición y analítica base (offline, observacional)
**Puntos:** 1 · 2 · 3 · 4 · 5  — *(51 tests nuevos)*
- Grupo coherente: solo LEEN `profile.ev[]`/agregados y AÑADEN bloques por
  `MutationObserver` (`#progBody`/`#eduBody`) o wrap aditivo de `afterCorrect`/`renderEducator`.
  Ningún dispatcher de juego se toca → cero riesgo sobre el flujo de rondas.
- Conflicto resuelto `#1/#3` sobre `#progBody`: cargar #1 (analytics) primero; aceptar que
  `renderProgress2` reinicia la sesión a-medias de repaso (#3) al repintar.
- **Archivos:** por cada NN, `spec.js`, `spec.css`, `spec.html`, `tests.md`.
- **Anclas de texto:**
  - `spec.js` → al FINAL de `app.js`, tras el último `})();` (hoy el cierre de la IIFE
    "Modo guiado padre-hijo" / `try{ registerPWA(); wirePWAInstall(); }catch(e){}`), en el orden 1→5.
  - `spec.css` → en `index.html` inmediatamente **antes de `</style>`**, tras
    `@media(prefers-reduced-motion){.installPill…}`.
  - `<script src="fase4/NN/spec.js">` → **después de** `<script src="app.js"></script>`.
  - Filas de Ajustes de #5 (`#setFrust…`) → insertadas **antes de `#setSessLimit`**.
- **Tests nuevos:** `assess.spec.js`(8), `abtest.spec.js`(10), `srs.spec.js`(12),
  `domi.spec.js`(11), `frustration.spec.js`(10). Regresión: los 19 existentes en verde.

### Oleada 2 — Contenido curricular + CMS (dispatchers ampliados)
**Puntos:** 11 · 12 · 13 · 14 · 15 · 10  — *(58 tests nuevos)*
- Instala los dispatchers ampliados que la Oleada 3 (#8) envolverá: `roundMath` (#12),
  `roundReading` (#13), `renderScienceRound` (#14), rondas nuevas vía `nextRound` (#11),
  y `CONTENT_API` (#15). #10 es JSON de referencia (sin wiring).
- Orden de carga interno: **11 → 12 → 13 → 14 → 15 → 10**.
  - #11 primero: aporta panel educador/`eduFaceOf` que #12/#13/#14 envuelven y del que
    depende el badge de #15 (conflicto "#11 antes que el badge de #15").
  - #15 tras 11-14: muta in-place `LETTERS/ANIMALS/MATH_*` (última mutación gana);
    consolidar parches en un único `CONTENT_API.set(...)` si hubiera varios.
- **Archivos:** #11-15 `spec.js/spec.css/spec.html/tests.md`; #10 `content.json`, `doc.md` (referencia).
- **Anclas de texto:**
  - `spec.js` de 11,12,13,14,15 → al final de `app.js` en ese orden, DESPUÉS de la Oleada 1.
  - `spec.css` → antes de `</style>`. `<script>` de cada uno → tras `app.js` en orden de oleada.
  - Fila Ajustes de #11 (`#setMoreSubjects`) → antes de `#setSessLimit`; tarjetas
    `#subj_emotions/shapes/routines` las pinta `refreshHome` (wrap).
  - #10: NO se wirea (documentado en su `integration.md §2` como lectura futura no invasiva).
- **Tests nuevos:** `moresubjects.spec.js`(14), `mathadv.spec.js`(9), `readingadv.spec.js`(11),
  `scienceadv.spec.js`(12), `content.spec.js`(12). #13/#14 tienen tests PROPUESTOS (Node, no Playwright) → correrlos end-to-end aquí.

### Oleada 3 — Motor adaptativo, secuenciación y ZDP
**Puntos:** 7 · 6 · 8 · 9  — *(41 tests nuevos)*
- Carga tras la Oleada 2 para que #8 envuelva los dispatchers ya ampliados.
- Orden de carga interno: **7 → 6 → 8 → 9**.
  - #7 antes que #6: #6 envuelve `roundMathCount` y debe quedar vigente sobre el DUPLICADO
    manual de #7 (conflicto "#6 después"). Re-sincronizar el duplicado de #7 si cambia el original.
  - #8 tras #12/#13/#14 (Oleada 2) y tras #6: envuelve `roundMath/roundReading/renderScienceRound`
    y delega a la referencia previa (verificar delegación).
  - #9 último: envuelve `refreshHome` (cadena con #8).
  - **Conflicto #6↔#8 (best.math):** ambos sesgan `best.math`/`afterCorrect` en Números con
    disparadores distintos (rachas de N vs banda 70-85%). Compuestos, el sesgo se acumula
    acotado pero más agresivo. **Resolución: activar SOLO uno por perfil/build** hasta
    validar con usuarios reales (ya en `08-zdp-dinamica/integration.md`).
- **Anclas de texto:** `spec.js` al final de `app.js` en orden 7→6→8→9; `spec.css` antes de
  `</style>`; filas Ajustes `#setSeq/#setAdaptive/#setZdp` antes de `#setSessLimit`.
- **Tests nuevos:** `seq.spec.js`(9), `adaptive.spec.js`(12), `zdp.spec.js`(10), `reco.spec.js`(10).
  **Test de compatibilidad nuevo a añadir:** con #6 y #8 activos a la vez sobre un perfil, verificar
  que `best.math` persistido NUNCA cambia y que el clamp combinado no desborda.

### Oleada 4 — UX, accesibilidad y personaje
**Puntos:** 17 · 18 · 16(mascota) · 20 · 30  — *(43 tests nuevos)*
- Orden de carga interno: **17 → 18 → 16 → 20 → 30**.
  - #16 (código mascota) antes de #20: #20 detecta `#peqMascot` y entra en modo 'enhance'
    (no crea nodo propio). Aceptar que solo una animación CSS se ve por instante.
  - #30 AL FINAL de todo: su `applySubjectVisibility` queda el wrapper más externo de
    `refreshHome` (sobre #8/#9/#11) y `passGate`/`startGame` (default `pinEnabled:false` = no-op,
    no bloquea tests existentes).
  - #17/#18 (+#16,#30) anclan filas en `#setSessLimit`: orden relativo = orden visual; cada
    una comprueba su propio id antes de insertar (no se pisan).
- **Anclas de texto:** `spec.js` en orden 17→18→16→20→30 al final de `app.js`; `spec.css`
  antes de `</style>`; filas `#setHiContrast/#setColorblind/#setDyslexia/#setMascot/#setPa20Anim`
  antes de `#setSessLimit`; #30: 4ª pestaña `#tabParental` como último hijo de `#adultView .tabs`,
  `#parentalView`/`#pinView` hermanos dentro de `#panel`, overlay `#dailyLimitOverlay` fuera de `#sheet`.
- **Tests nuevos:** `a11y.spec.js`(10), `dyslexia.spec.js`(8), `mascot.spec.js`(8),
  `personaje-anim.spec.js`(9), `parental.spec.js`(8). #18/#20 tienen tests PROPUESTOS → correr real.

### Oleada 5 — Familia y educador
**Puntos:** 19 · 21 · 22 · 23 · 24  — *(36 tests nuevos)*
- Grupo del panel de adultos (pestañas/cajas nuevas), todas tras las oleadas de flujo de juego.
- Orden de carga interno: **19 → 21 → 22 → 23 → 24**.
  - `logRound` (19,21) y `afterCorrect`/`renderProgress2` (21,22) se apilan en cadena (delegan primero).
  - #21/#22 sobre `#progBody`: cargar tras la Oleada 1 (analytics #1 ya presente); #22 antepone
    `#weekGoalCard` como primer hijo (documentado).
  - #24 es contenido: parche manual BEFORE→AFTER a `var COPLAY_Q` (checklist de `integration.md §2`,
    cuidar apóstrofes tipográficos).
- **Anclas de texto:** `spec.js` en orden 19→21→22→23→24 al final de `app.js`; `spec.css` antes de
  `</style>`; pestañas `#tabAlbum` / `#tabAula` como último hijo de `#adultView .tabs` / `#sheet .tabs`;
  vistas `#albumView`/`#aulaView` hermanas de `#eduView`; cajas `#weeklyReportBox` tras `#progBody`,
  `#weekGoalCard` como primer hijo de `#progBody`; filas de meta `#setWeekGoal`/`#setWeekGoalTarget` en Ajustes.
- **Tests nuevos:** `album.spec.js`(10), `weekly-report.spec.js`(10), `weekgoal.spec.js`(7),
  `aula.spec.js`(9); #24 sin tests (contenido). #19/#22/#23 tienen tests PROPUESTOS → correr real.

### Oleada 6 — Backend, scaffolds y candados externos
**Puntos:** 25 · 26 · 27 · 28 · 29 (+ voces de #16)  — *(7 tests nuevos)*
- No hay wiring a `app.js`/`index.html` para 25/26/27/29 (por diseño scaffold/docs).
  De #28 la parte de CÓDIGO (TWA/atajos `?game=`, wrap de `paintInstall`) SÍ se integra hoy.
- **Archivos:** #25 `sync.js`, `sql/*.sql`, `edge/ingest.ts`; #26 `cohorts.js`, `sql/00[456]*.sql`,
  `design-preview.html`; #27 `agg.js`, `sql/02[0-3]*.sql`, `edge/agg-ingest.ts`;
  #28 `spec.js`, `spec.html`, `manifest.webmanifest`, `icons/*`, `capacitor.config.json`, `tools/gen-icons.mjs`;
  #29 `politica-privacidad.md`, `checklist-coppa-gdprk.md`, `29-auditoria-legal.md`.
- **Anclas de texto:** #28 → `spec.js` tras `app.js` (envuelve `paintInstall`), `manifest.webmanifest`
  reemplaza el de `ship/` (start_url `?src=pwa`). El resto: sin anclas (activación por contrato, §4).
- **Tests nuevos:** `pwa-store.spec.js`(7). 25/26/27/29 sin tests de Playwright (scaffold/docs).

**Cadena de carga global resultante (script order en `index.html`):**
`1,2,3,4,5 | 11,12,13,14,15 | 7,6,8,9 | 17,18,16,20,30 | 19,21,22,23,24 | 28`
(#10,#24 parches de contenido; #25,#26,#27,#29 sin wiring).

---

## 3) Matriz de conflictos y su resolución (resumen accionable)

| Conflicto | Recurso compartido | Resolución en este plan |
|-----------|--------------------|-------------------------|
| #6 ↔ #8 | sesgo de `best.math`/`afterCorrect` (Números) | Activar **solo uno** por perfil/build hasta validar; ambos con clamp propio. |
| #12 ↔ #8 | `roundMath` dispatcher | #12 en Oleada 2 (instala dispatcher ampliado) ANTES de #8 en Oleada 3. |
| #13 ↔ #8 | `roundReading` | #13 (Oleada 2) antes; #8 sesga dentro del rango y delega. |
| #14 ↔ #8 | `renderScienceRound` | #14 (Oleada 2) antes; #8 envuelve y delega a la referencia previa. |
| #6 ↔ #7 | `roundMathCount` (wrap vs duplicado) | Cargar #6 tras #7; re-sincronizar el duplicado de #7 si cambia el original. |
| #16 ↔ #20 | nodo del personaje | #16 antes de #20 → modo 'enhance', sin doble personaje. |
| #11/#13/#14 ↔ `faceOf` privado | `renderProgress2` | Aceptar degradación cosmética (clave cruda) — reescribir `renderProgress2` está fuera del patrón aditivo. |
| #1/#3/#21/#22 ↔ `#progBody` | host de Progreso | Orden estable (analytics #1 primero); repintado reinicia secciones con estado (#3). |
| #30 ↔ #8/#9/#11 | `refreshHome` | #30 al final → `applySubjectVisibility` el más externo, delegando. |
| #4/#5/#15 ↔ `renderEducator` | panel Educador | #11 antes que el badge de #15; orden entre #4/#5/#15 solo cambia orden visual. |

---

## 4) Candados externos — entregado vs acción humana

Estos puntos dejan **scaffolding + contrato** listos; el candado NO es de permisos de
este agente sino de un insumo externo (locución, cuentas/infra, firma legal).

### #16 · Voces humanas ES/EN (locución)
- **Entregado:** AudioBank + guion (`AUDIO_MANIFEST.keys`) probados; resolución automática de
  `opts.key` por texto (ningún call-site de `speak/speakSeq` necesita tocarse); mascota-guía
  código-listo. Bajo `file://` nunca reproduce audio (degradación segura a TTS).
- **Requiere acción humana:** (1) grabar `audio/<es|en>/<clave>.mp3` (mp3/44.1kHz/mono) para cada
  clave del guion con voz cálida apta 3-5 años, con licencia/consentimiento; (2) `node tools/gen-audio-manifest.mjs`;
  (3) pegar el array en `AUDIO_MANIFEST.available` (única edición de datos, reversible);
  (4) servir por http/https. Contrato en `16-voces-mascota.md §4-5`.

### #28 · Publicación en tiendas (TWA Android + wrapper iOS)
- **Entregado:** `PEQUE_STORE` (detección de contexto empaquetado, arranque directo `?game=`),
  wrap de `paintInstall`, `manifest.webmanifest`, iconos maskable, `capacitor.config.json`,
  `tools/gen-icons.mjs`. Código verificado, integrable hoy en Oleada 6.
- **Requiere acción humana:** (1) dominio HTTPS de producción (Digital Asset Links);
  (2) Google Play Console (pago): `applicationId`, keystore + SHA-256, Data Safety;
  (3) Apple Developer Program (pago) + **Mac con Xcode** (este entorno es Linux, no puede `npx cap add ios`);
  (4) política de privacidad en URL pública; (5) activos de ficha (capturas, copy ES/EN);
  (6) decisión de `applicationId`/dominio definitivos. Checklist de 11 pasos en `28-pwa-tiendas.md §3`.

### #29 · Auditoría legal + política de privacidad
- **Entregado:** auditoría técnica COPPA/GDPR-K completa de `ship/` + scaffolds #25/#26/#27
  (`29-auditoria-legal.md`); borrador bilingüe ES/EN de política; `checklist-coppa-gdprk.md`.
  Confirma postura fuerte (offline-first, sin cuentas de niño, sin SDKs, sin backend activo).
- **Requiere acción humana:** (1) abogado de privacidad infantil (COPPA + art. 8 RGPD +
  normativa local) revisa/firma la política (placeholders `[razón social/contacto/jurisdicción/vigencia]`);
  (2) decisión producto sobre auto-hospedar Google Fonts (hallazgo H1); (3) confirmar jurisdicciones;
  (4) aprobación formal registrada antes de publicar o activar cualquier flag de red sobre datos de menores.
  **No publicar ni enlazar el borrador tal cual.** H1/H2 documentados, sin remediar (brief docs).

### Scaffolds gated de backend (#25, #26, #27) — herencia del candado
- **Entregado:** `PequeSync` (#25), `PequeCohorts` (#26, mitad local funciona offline),
  `PequeAggPipeline` (#27, `rollupLocal`/`kAnonFilter` puras y usables hoy); esquemas SQL,
  RLS, edge functions; flags OFF por defecto. **Ningún camino de código abre red** (`flush()`/
  `pullCohortOverview()` deliberadamente sin fetch real; config solo en memoria).
- **Requiere acción humana:** proyecto Supabase real + región de datos, auth del adulto
  (magic-link/OAuth), UI de consentimiento verificable en el parent gate, hosting HTTPS,
  decisión legal COPPA/GDPR-K, umbral k (#27), captura incremental con timestamp por evento.
  Checklists en `25/26/27-*.md`. No hay wiring hasta cumplir el contrato de activación.
