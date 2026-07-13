# 🚀 Pequeñautas

App educativa interactiva para **preescolares (3–5 años)**, **bilingüe español/inglés**, construida con evidencia y sin dependencias en tiempo de ejecución. Un solo `index.html` + `app.js` (offline-first, instalable como PWA).

**Demo:** ver despliegue en Vercel (link en el PR / releases).

## 🎮 Qué hace

Tres mini-juegos con audio bilingüe, botones grandes y navegación audio-first:

| Materia | Aprende | Mecánicas |
|---|---|---|
| 🔢 Números | Conteo, correspondencia número-cantidad, **subitización**, **comparar (más/menos)** | tocar para contar, elegir número, reconocer cantidad, comparar grupos |
| 🔤 Letras | Fonética (letra + sonido inicial) | elegir el dibujo que empieza con la letra |
| 🐢 Animales | Clasificación por **hábitat** y por **dieta** (herbívoro/carnívoro) | ubicar al animal donde vive / según qué come |

Además: **perfiles por niño** con progreso persistente, **analítica de aprendizaje** + **panel educador** local, **pistas progresivas**, **límite de sesión saludable (AAP)**, **onboarding sin texto**, **modo de idioma** (inmersión/alternado/espejo), **modo guiado padre-hijo**, y **PWA offline**.

## 🧪 Base de evidencia
Hirsh-Pasek et al. 2015 (Cuatro Pilares) · Callaghan et al. 2021 (andamiaje + feedback) · NAEYC 2022 (juego guiado) · Wildgruber et al. 2024 · Google/NN-g (UX pre-lectores) · AAP (tiempo de pantalla) · Lepper et al. 1973 (anti-sobrejustificación). Ver `docs/`.

## ▶️ Cómo probar
Abre `index.html` en un navegador (tablet/celular ideal). Activa el sonido con 🔊. Crea un perfil, juega, y abre "Para grandes" para Progreso / Ajustes / Educador.

## 🔧 Desarrollo y tests
```bash
npm install
npx playwright install --with-deps chromium
npm test   # 19 smoke/feature tests (Playwright)
```

## 📚 Documentación
- `ARCHITECTURE.md` — estructura del código y decisiones.
- `ROADMAP.md` — horizonte de 30 mejoras con estado.
- `docs/CONTEXT.md` — **memoria del proyecto** (estado, decisiones, cómo continuar).
- `docs/bilingue.md` — estrategia bilingüe.
- `docs/backend-supabase.md` — diseño de backend (feature-flag OFF).
