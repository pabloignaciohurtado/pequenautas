# 🚀 Pequeñautas

App educativa interactiva para **preescolares (3–5 años)**, **bilingüe español/inglés**, construida con evidencia y sin dependencias en tiempo de ejecución. Un solo `index.html` + `app.js` (offline-first, instalable como PWA).

**🌐 Demo en producción:** https://pequenautas-rfj5.vercel.app — ábrela en tablet/celular y usa "Añadir a pantalla de inicio" para instalarla como app. (Auto-desplegada desde `main` vía la integración Git de Vercel: cada merge a `main` publica solo.)

## 🎮 Qué hace

Tres mini-juegos con audio bilingüe, botones grandes y navegación audio-first:

| Materia | Aprende | Mecánicas |
|---|---|---|
| 🔢 Números | Conteo, correspondencia número-cantidad, **subitización**, **comparar (más/menos)** | tocar para contar, elegir número, reconocer cantidad, comparar grupos |
| 🔤 Letras | Fonética (letra + sonido inicial) | elegir el dibujo que empieza con la letra |
| 🐢 Animales | Clasificación por **hábitat** y por **dieta** (herbívoro/carnívoro) | ubicar al animal donde vive / según qué come |

Además: **perfiles por niño** con progreso persistente, **analítica de aprendizaje** + **panel educador** local, **pistas progresivas**, **límite de sesión saludable (AAP)**, **onboarding sin texto**, **modo de idioma** (inmersión/alternado/espejo), **modo guiado padre-hijo**, y **PWA offline**.

## 🧭 Fase 4 (en curso)
Mejoras cargadas como módulos aditivos desde `fase4/` (loader `fase4/fase4.js`). **Oleada 1 — medición del aprendizaje** ya en `main`: evaluación pre/post, A/B testing, repaso espaciado, índice de dominio y detección de frustración. Ver `fase4/MASTER_PLAN.md` para el plan completo de 6 oleadas.

## 🧪 Base de evidencia
Hirsh-Pasek et al. 2015 (Cuatro Pilares) · Callaghan et al. 2021 (andamiaje + feedback) · NAEYC 2022 (juego guiado) · Wildgruber et al. 2024 · Google/NN-g (UX pre-lectores) · AAP (tiempo de pantalla) · Lepper et al. 1973 (anti-sobrejustificación). Ver `docs/`.

## ▶️ Cómo probar
Abre https://pequenautas-rfj5.vercel.app (o `index.html` local) en un navegador (tablet/celular ideal). Activa el sonido con 🔊. Crea un perfil, juega, y abre "Para grandes" para Progreso / Ajustes / Educador.

## 🔧 Desarrollo y tests
```bash
npm install
npx playwright install --with-deps chromium
npm test   # 23 smoke/feature tests (Playwright): 19 base + 4 de Fase 4 Oleada 1
```

## 📚 Documentación
- `ARCHITECTURE.md` — estructura del código y decisiones.
- `ROADMAP.md` — horizonte de 30 mejoras con estado.
- `fase4/MASTER_PLAN.md` — plan de integración de las 30 mejoras en 6 oleadas.
- `docs/CONTEXT.md` — **memoria del proyecto** (estado, decisiones, cómo continuar).
- `docs/bilingue.md` — estrategia bilingüe.
- `docs/backend-supabase.md` — diseño de backend (feature-flag OFF).
