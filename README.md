# 🚀 Pequeñautas

Prototipo de **app educativa interactiva para preescolares (3–5 años)**, **bilingüe español/inglés**, con tres mini-juegos: **Números**, **Letras** y **Animales**.

> Prototipo jugable en un solo archivo `index.html` (sin dependencias en tiempo de ejecución). Ábrelo en el navegador de una tablet o celular.

## 🎮 Qué incluye

| Mini-juego | Aprende | Mecánica |
|---|---|---|
| 🔢 Números | Conteo y correspondencia número–cantidad | Toca los objetos para contarlos en voz alta, luego elige el número |
| 🔤 Letras | Fonética: letra + sonido inicial | Escucha la letra y su sonido, elige el dibujo que empieza igual |
| 🐢 Animales | Clasificación por hábitat | Ubica al animal en agua, tierra o cielo |

Audio bilingüe (Web Speech API), botones grandes, iconos siempre visibles, y un **panel para grandes** (con *parent gate* de mantener-presionado) para controlar voz, animaciones y modo guiado.

## 🧪 Base de evidencia

El diseño se apoya en investigación revisada por pares:

- **Cuatro Pilares** de aprendizaje (Hirsh-Pasek et al., 2015): activo, comprometido, significativo, socialmente interactivo — cada ronda exige una decisión cognitiva, no un toque reflejo.
- **Andamiaje** (Callaghan et al., 2021, *BJET*, n=240): dificultad gradual (no aleatoria) + **feedback verbal nombrado y explicativo** ("¡Sí! Hay tres.").
- **Juego guiado** (NAEYC, 2022): las pistas *preguntan y orientan*, no dan la respuesta.
- **UX para pre-lectores** (Google for Developers; NN/g): evitar botones solo-texto, objetivos táctiles grandes, instrucción multimodal (sonido + visual + texto), gestos simples.
- **Evitar recompensa extrínseca como meta** (Lepper, Greene & Nisbett, 1973): sin presión de tiempo ni economías de fichas agresivas; las estrellas celebran el logro, no son el objetivo explícito.

## ▶️ Cómo probarlo

Abre `index.html` en cualquier navegador moderno. Para el audio, activa el sonido con el botón 🔊.

## 🔧 Desarrollo

```bash
npm install
npx playwright install --with-deps chromium
npm test   # test de humo headless
```

## 📌 Estado

Prototipo (v0.1). Próximos pasos sugeridos: perfiles por niño, más niveles por materia, modo padre-hijo (co-juego), y contenido de ciencias ampliado.
