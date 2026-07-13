# 🚀 Pequeñautas

Prototipo de **app educativa interactiva para preescolares (3–5 años)**, **bilingüe español/inglés**, con tres mini-juegos: **Números**, **Letras** y **Animales**.

> Prototipo jugable en un solo archivo `index.html` (sin dependencias en tiempo de ejecución). Ábrelo en el navegador de una tablet o celular.

## 🆕 Novedades — Sprint 1

- **Perfiles por niño + persistencia:** cada peque tiene su avatar, sus estrellas y su nivel; el progreso se guarda localmente y sobrevive al cierre.
- **Analítica de aprendizaje:** panel "Progreso" (tras el *parent gate*) con estrellas, rondas, aciertos a la primera, tiempo medio, precisión por materia e ítems a reforzar.
- **Pistas progresivas:** feedback andamiado por intento — la 1ª falla orienta, la 2ª refuerza y revela/explica la respuesta correcta.

## 🎮 Mini-juegos

| Mini-juego | Aprende | Mecánica |
|---|---|---|
| 🔢 Números | Conteo y correspondencia número–cantidad | Toca los objetos para contarlos en voz alta, luego elige el número |
| 🔤 Letras | Fonética: letra + sonido inicial | Escucha la letra y su sonido, elige el dibujo que empieza igual |
| 🐢 Animales | Clasificación por hábitat | Ubica al animal en agua, tierra o cielo |

Audio bilingüe (Web Speech API), botones grandes, iconos siempre visibles, y un **panel para grandes** (con *parent gate* de mantener-presionado).

## 🧪 Base de evidencia

- **Cuatro Pilares** (Hirsh-Pasek et al., 2015): aprendizaje activo, comprometido, significativo y social.
- **Andamiaje** (Callaghan et al., 2021, *BJET*, n=240): dificultad gradual + **feedback verbal nombrado y explicativo**.
- **Juego guiado** (NAEYC, 2022): las pistas *preguntan y orientan*.
- **UX para pre-lectores** (Google for Developers; NN/g): sin botones solo-texto, objetivos táctiles grandes, instrucción multimodal.
- **Evitar recompensa extrínseca como meta** (Lepper, Greene & Nisbett, 1973).

## ▶️ Cómo probarlo

Abre `index.html` en cualquier navegador moderno. Activa el sonido con 🔊. Crea un perfil, juega, y abre "Para grandes" para ver el panel de progreso.

## 🔧 Desarrollo

```bash
npm install
npx playwright install --with-deps chromium
npm test   # test de humo headless
```

## 📌 Estado

Prototipo v0.2 (Sprint 1 completo). Próximos pasos: contenido ampliado (mates/ciencias), voces pregrabadas, gestos de arrastrar/trazar, PWA + offline.
