/* ==================== Fase 4 · loader de mejoras ====================
   Carga los módulos de Fase 4 DESPUÉS de app.js, preservando el ORDEN de
   envoltura de globales (window.afterCorrect/nextRound/roundMath/... — ver
   MASTER_PLAN.md). Cada mejora vive en fase4/NN-slug/{spec.js,spec.css}.
   Para añadir una oleada: agrega sus carpetas a MODULES en el orden indicado
   por el plan. Aditivo, offline, sin red. Un módulo que falte o falle no
   detiene a los demás (onerror → next). */
(function () {
  "use strict";
  var BASE = "fase4/";
  // Orden de carga = orden de oleadas del MASTER_PLAN (la última envoltura gana).
  var MODULES = [
    // Oleada 1 — medición y analítica (offline, observacional)
    "01-eval-pre-post",
    "02-ab-testing",
    "03-repaso-espaciado",
    "04-indice-dominio",
    "05-deteccion-frustracion",
    // Oleada 2 — contenido curricular + CMS (dispatchers ampliados)
    // 11 antes de 12/13/14 (aporta eduFaceOf del panel que ellos envuelven);
    // 15 al final (muta el contenido; badge depende de #11).
    "11-materias-nuevas",
    "12-mates-avanzadas",
    "13-lectura-avanzada",
    "14-ciencias-avanzada",
    "15-cms-json",
    // Oleada 3 — motor adaptativo, secuenciación y ZDP (dispatchers ya ampliados por Oleada 2)
    // 7 antes de 6 (6 envuelve roundMathCount sobre el duplicado de 7);
    // 8 tras 6/12/13/14 (envuelve y delega los dispatchers ampliados); 9 último (cadena refreshHome).
    "07-secuenciacion",
    "06-motor-adaptativo",
    "08-zdp-dinamica",
    "09-recomendador",
    // Oleada 4 — UX, accesibilidad y personaje
    // 17,18 puramente aditivos (filas Ajustes); 16 (mascota, voces gated) ANTES de 20
    // (20 detecta #peqMascot y entra en modo enhance, sin doble personaje); 30 AL FINAL
    // (applySubjectVisibility el wrapper más externo de refreshHome/passGate/startGame; PIN off por defecto).
    "17-accesibilidad",
    "18-dislexia",
    "16-voces-mascota",
    "20-animaciones-personaje",
    "30-controles-parentales",
    // Oleada 5 — familia y educador (grupo del panel de adultos, tras las
    // oleadas de flujo de juego). Orden interno 19→21→22→23:
    // 19 y 21 encadenan sobre window.logRound (cada uno delega primero al
    // anterior); 21 y 22 encadenan sobre window.renderProgress2 (22 tras 21,
    // antepone #weekGoalCard como primer hijo de #progBody sin pisar la
    // sección #assessHead de la Oleada 1, que se repinta al final vía
    // MutationObserver); 23 añade una 4ª/5ª pestaña (#tabAula) al mismo
    // .tabs que ya comparten #tabAlbum (19) y #tabParental (30) sin
    // colisión de IDs. #24 "biblioteca-cojuego" NO se integra: su contenido
    // (más preguntas para var COPLAY_Q) requeriría editar app.js porque
    // COPLAY_Q vive dentro de una IIFE y no es alcanzable desde fuera (a
    // diferencia de LETTERS/ANIMALS/MATH_* del wrap de #15, que son const
    // de nivel superior) — se deja fuera del loader, ver fase4/MASTER_PLAN.md.
    "19-album-logros",
    "21-reporte-semanal",
    "22-metas-semanales",
    "23-modo-aula",
    // Oleada 6 — backend/scaffolds sin wiring (25,26,27,29 solo referencia, no en MODULES);
    // #28 (código TWA/atajos ?game=, wrap de paintInstall) SÍ se integra, al final de todo.
    "28-pwa-tiendas",
    // Oleada 7 — identidad visual "Aventuras en el Bosque" (skin papel recortado).
    // Al final de todo: solo CSS + retoques DOM en runtime (mascota Rufo, rename
    // del home); no envuelve globales de juego, no toca STORE_KEY.
    "31-identidad-visual",
    // Oleada 8 - #32 pantallas del bosque (overlays mapa de aventuras y
    // mochila de logros, cableados a botones inyectados en el home; pausa y
    // gate listos como window.PEQ32.* sin cablear) + fix del boton duplicado
    // del modal "Nuevo peque". Al final de todo: solo CSS + overlays y
    // retoques DOM en runtime; no envuelve globales de juego, no toca STORE_KEY.
    "32-pantallas-bosque",
    // Oleada 9 - #33 hero diorama 3D + rediseño del home. Banda hero (fondo de
    // bosque + Rufo saludando + saludo con el nombre), barra de navegación
    // inferior de 4 items (Inicio/Mapa/Mochila/Adultos) cableada a window.PEQ32
    // (#32) y al gate de adultos, y Rufo celebrando en el logro. Al final de
    // todo: solo CSS + retoques DOM en runtime; imágenes embebidas como data-URI
    // en img/*.css (los binarios no se pueden subir byte-exactos con las
    // herramientas MCP). No envuelve globales de juego, no toca STORE_KEY.
    "33-hero-diorama",
    "34-juegos",
    // Oleada 10 - #35 cajas de menu 3D: reemplaza el aspecto plano de las
    // tarjetas .subject por casas del bosque de papel (fondo diorama, marco de
    // color, etiqueta de papel, chevron). Al final de todo: SOLO CSS; imagenes
    // embebidas como data-URI en img/*.css. No toca app.js ni STORE_KEY.
    "35-cajas3d",
    // Oleada 11 - #36 reubica el acceso de adultos: lo saca de la barra inferior
    // (alto riesgo de toque accidental) y lo pone como engranaje discreto en la
    // esquina. Al final de todo: solo CSS + un botón; no toca app.js ni STORE_KEY.
    "36-gate-esquina",
    "37-nav-iconos",
    "38-bosque-arte",
    "39-fondo-vivo",
    "40-secciones-fondo"
  ];
  MODULES.forEach(function (m) {
    var l = document.createElement("link");
    l.rel = "stylesheet"; l.href = BASE + m + "/spec.css";
    (document.head || document.documentElement).appendChild(l);
  });
  var i = 0;
  (function next() {
    if (i >= MODULES.length) return;
    var m = MODULES[i++];
    var s = document.createElement("script");
    s.src = BASE + m + "/spec.js";
    s.async = false;
    s.onload = next;
    s.onerror = function () { next(); };
    (document.body || document.documentElement).appendChild(s);
  })();
})();
