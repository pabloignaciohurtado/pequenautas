# 🧠 Memoria del proyecto — Pequeñautas

> Contexto para retomar el trabajo en cualquier sesión/agente futura. Última actualización: Fase 4 · Oleada 1.

## Qué es
App educativa preescolar (3–5), bilingüe ES/EN, vanilla JS, offline-first, PWA. Repo: `pabloignaciohurtado/pequenautas`.

## Estado actual
- `main` = v0.4 (prototipo + Sprint 1+2+3) **+ Fase 4 Oleada 1** (puntos 1-5). 23 tests Playwright en verde.
- **Desplegado en producción: https://pequenautas-rfj5.vercel.app** — proyecto Vercel `pequenautas-rfj5` conectado por **integración Git**: cada merge a `main` se despliega automáticamente (sin límite de tamaño; Vercel clona el repo). El antiguo proyecto `pequenautas` (deploys inline) quedó obsoleto/roto — usar el `-rfj5`.
- **Gestos de trazar/arrastrar** sigue diferido.

## Fase 4 — 30 mejoras (orquestadas por 30 agentes)
- Specs completos en `fase4/NN-slug/` + `fase4/MASTER_PLAN.md` (6 oleadas, matriz de 17 colisiones de globales resuelta con orden de carga).
- Reparto: **22 código-listo, 2 contenido, 3 scaffold, 3 candado externo** (16 voz humana, 28 tiendas, 29 firma legal).
- **Arquitectura de integración:** cada mejora es un IIFE aditivo en `fase4/NN/spec.js` (+`spec.css`), cargado por `fase4/fase4.js` (loader) DESPUÉS de `app.js`. `app.js` NO se toca; `index.html` solo tiene 1 línea (el loader). Añadir una oleada = agregar sus carpetas a `MODULES` en `fase4.js` (en el orden del MASTER_PLAN) + pushear los specs. **No re-emitir `index.html` ni `app.js`.**
- **Oleada 1 (LISTA, en main):** 1 eval pre/post · 2 A/B · 3 repaso espaciado · 4 índice de dominio · 5 detección de frustración.
- **Pendiente (oleadas 2-6):** 2) contenido+CMS (11,12,13,14,15,10) · 3) motor adaptativo/ZDP (7,6,8,9) · 4) UX/accesibilidad/personaje (17,18,16,20,30) · 5) familia/educador (19,21,22,23,24) · 6) backend/scaffolds/gated (25,26,27,28,29). Regla clave del plan: cargar dispatchers ampliados (#12/#13/#14) ANTES de ZDP (#8); #16 antes de #20; #30 al final.

## Decisiones clave
- Sin frameworks / sin build. Extensiones = IIFE que envuelven globales por reasignación (cadena de responsabilidad, cada wrapper delega en la referencia previa). No migrar a módulos ES sin refactor.
- Offline-first: nada abre red a terceros. Backend Supabase diseñado pero OFF.
- Seguridad: escape XSS (`eduEsc`), CSV anti-fórmula, parent gate.
- CI: `playwright.config.js` `workers:1, timeout:60000`. Proceso: rama → PR → CI verde → squash merge. Auto-merge por el asistente cuando CI verde.
- **Despliegue:** integración Git de Vercel (NO deploy inline — el paquete completo excede el límite de una sola llamada del conector). Cada merge a main publica solo.

## Pendiente inmediato
Integrar Oleada 2 (contenido+CMS) siguiendo el MASTER_PLAN, verificar con Playwright local, PR → CI verde → merge (auto-deploy). Luego oleadas 3-6. Candados externos (#16/#28/#29) quedan como scaffolding + contrato.

## Evidencia
Ver `README.md` y `docs/` (bilingüe, backend). `ROADMAP.md` = horizonte de 30.
