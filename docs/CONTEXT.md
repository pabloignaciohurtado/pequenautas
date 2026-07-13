# 🧠 Memoria del proyecto — Pequeñautas

> Contexto para retomar el trabajo en cualquier sesión/agente futura. Última actualización: Sprint 3 (v0.4).

## Qué es
App educativa preescolar (3–5), bilingüe ES/EN, vanilla JS, offline-first, PWA. Repo: `pabloignaciohurtado/pequenautas`.

## Estado actual
- `main` contiene v0.4: prototipo + Sprint 1 + Sprint 2 + Sprint 3 (5 features). 19 tests Playwright en verde.
- Desplegado en Vercel (link en el PR de Sprint 3).
- **Gestos de trazar/arrastrar quedó diferido** (falta `jsCode` integrable) — es lo primero a retomar.

## Decisiones clave
- **Sin frameworks / sin build**: single-file app + `app.js`. Extensiones como IIFE que envuelven globales (`window.speak/afterCorrect/nextRound`). No migrar a módulos sin refactor de esos wrappers.
- **Orden de IIFE**: voces → bilingüe → educador → guiado. `#tabSet.onclick` lo gana educador (conserva `showTab('set')`); `#langBtn` = 1 `onclick` (toggleLang) + N `addEventListener`.
- **Offline-first**: nada abre red a terceros. Backend Supabase diseñado pero **OFF** (`PEQUE_FLAGS.backendSync=false`).
- **Seguridad**: escape XSS en `renderProfiles`/educador; CSV con guarda anti-fórmula; parent gate.
- **CI estable**: `playwright.config.js` con `workers:1, timeout:60000` (evita flaky por arranque en frío de Chromium).
- **Proceso**: nunca push directo a `main`; rama → PR draft → CI verde → squash merge. Se asume auto-merge por el asistente cuando CI verde.

## Proceso de integración (cómo se hace)
Los features llegan como specs (css/jsCode/htmlSnippets/i18n/integration). Se integran anclando por TEXTO (no por línea), se prueba con Playwright localmente, se sube por lotes (los archivos grandes `app.js`/`index.html` se suben escapados) y se despliega en Vercel con `deploy_to_vercel`.

## Pendiente inmediato
1. Gestos (trazar letra + arrastrar) con `jsCode` completo. 2. Fase 4: empezar por "medir aprendizaje + A/B testing" (frente de mayor apalancamiento; barato sobre la analítica existente). Ver `ROADMAP.md`.

## Evidencia
Ver `README.md` (referencias) y `docs/` (bilingüe, backend, benchmark).
