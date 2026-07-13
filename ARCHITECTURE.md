# Arquitectura

## Stack
HTML + CSS + JavaScript **vanilla** (sin frameworks ni build). `index.html` (estructura + estilos) + `app.js` (lógica). Offline-first; funciona abriendo el archivo (`file://`) y servido (PWA con `sw.js` + `manifest.webmanifest`).

## Estado y persistencia
- `S` = estado de sesión (idioma, pantalla, juego, ronda, etc.).
- `DB = { profiles:[], currentId, settings:{ session, coplay } }` en `localStorage` con **fallback en memoria** (`loadDB`/`saveDB` con try/catch).
- `profile = { id, avatar, name, stars, best:{math,reading,science}, ev:[], seenIntro, langMode }`. `ev` = eventos de analítica por ronda.

## Patrón de extensión (importante)
`app.js` es un `<script>` clásico (no módulos). Las funciones de nivel superior son propiedades del objeto global, así que **reasignar `window.speak/speakSeq/afterCorrect/nextRound`** intercepta a los llamadores internos. Las features del Sprint 3 se añaden como **IIFE al final** que envuelven esas globales, en orden: **voces → bilingüe → educador → guiado**. No editar `applyLang()`/init; usar `addEventListener` (nunca `.onclick=`) sobre `#langBtn`/`#tabSet` para no romper la cadena.
> ⚠️ Migrar a módulos ES / bundler rompería los wrappers globales a la vez.

## Juegos
`nextRound()` enruta por `S.game`: `roundMath()` (dispatcher → count/subitize/compare por nivel), `roundReading()`, `renderScienceRound()` (alterna hábitat/dieta). Cada ronda: fija `S.correctBtn`, en acierto `afterCorrect(key)`, en error `onWrong(btn, hintFn)` (pistas progresivas, revela tras 2 fallas).

## Analítica
`logRound(...)` registra por ronda; `aggregate(p)` produce métricas. El **panel educador** agrega todos los perfiles locales. `renderProgress2()` pinta el panel por-niño.

## Seguridad / privacidad
- Escape XSS en `renderProfiles` y panel educador (`eduEsc`).
- Export CSV con guarda anti-inyección de fórmulas.
- Backend Supabase **OFF** por diseño (`PEQUE_FLAGS.backendSync=false`); ningún runtime abre red a terceros. Datos locales.
- Parent gate (mantener-presionado) para ajustes/salidas sensibles.

## Tests / CI
Playwright en `tests/` (smoke + audiobank + bilingual + coplay + educator). CI (`.github/workflows/ci.yml`) corre `npx playwright test`. `playwright.config.js`: `workers:1`, `timeout:60000` (estable ante arranque en frío).
