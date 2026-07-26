/* ==================== Fase 4 · loader de mejoras ====================
   Carga los módulos de Fase 4 DESPUÉS de app.js, preservando el ORDEN de
   envoltura de globales (window.afterCorrect/nextRound/roundMath/... — ver
   MASTER_PLAN.md). Cada mejora vive en fase4/NN-slug/{spec.js,spec.css}.
   Para añadir una oleada: agrega su carpeta a la lista que corresponda, en
   el orden indicado por el plan. Aditivo, offline, sin red. Un módulo que
   falte o falle no detiene a los demás (onerror → next).

   Carga progresiva (#50): en vez de inyectar los ~40 módulos en una sola
   cadena secuencial, se separan en dos fases:
   - CRITICAL_MODULES: identidad visual + pantalla Home + HUD (lo que el
     peque ve de inmediato). Se cargan primero, en su ORDEN RELATIVO
     original.
   - DEFERRED_MODULES: analítica, motor adaptativo, accesibilidad, panel
     familiar/educador, tiendas, juegos nuevos y fondos de pantallas
     secundarias. Se cargan justo después, en segundo plano
     (requestIdleCallback/setTimeout), SIN bloquear el primer pintado y
     preservando también su ORDEN RELATIVO original: las envolturas de
     globals como refreshHome/roundMathCount se aplican en la misma
     secuencia que antes, solo unos instantes más tarde.

   En paralelo, sw.js hace un precache en segundo plano de TODOS los
   módulos (spec.css + spec.js + los archivos que sus spec.css importan vía
   @import) reportando progreso real por postMessage — en la práctica esta
   segunda cadena casi siempre resuelve desde caché. */
(function () {
  "use strict";
  var BASE = "fase4/";

  // ---- Fase 1: crítico para el primer pintado --------------------------
  // Oleadas 7-13 de identidad visual y Home. Puramente aditivo (CSS +
  // retoques DOM en runtime); ninguno envuelve globals de juego, así que
  // es seguro adelantarlos.
  var CRITICAL_MODULES = [
    "31-identidad-visual",
    "32-pantallas-bosque",
    "33-hero-diorama",
    "35-cajas3d",
    "36-gate-esquina",
    "37-nav-iconos",
    "38-bosque-arte",
    "39-fondo-vivo",
    "40-secciones-fondo",
    // #46 iconos papercraft del HUD (barra superior, botón de escuchar,
    // píldora de instalación) y #47 layout de las tarjetas de opción: los
    // dos se ven en el primer pintado, así que van en la fase crítica.
    "46-hud-iconos",
    "47-opciones-layout",
    // #48 avatares papercraft: la pantalla "¿Quién juega?" es literalmente
    // lo primero que ve el peque, no puede llegar tarde.
    "48-avatares",
    // #50 portón de carga: tiene que estar en pantalla antes que nada.
    "50-progreso-carga",
    // #51 rediseño del hero (título de portada, Rufo suelto sin marco y
    // globo de cómic): es la primera pantalla que ve el peque al entrar a
    // Home, así que no puede llegar tarde. Va DESPUÉS de #33, que es quien
    // construye el .pa33-hero sobre el que #51 aplica sus reglas.
    "51-hero-globo"
  ];

  // ---- Fase 2: diferido ------------------------------------------------
  // El resto de módulos, en su mismo orden relativo original.
  var DEFERRED_MODULES = [
    // Oleada 1 — medición y analítica (offline, observacional)
    "01-eval-pre-post",
    "02-ab-testing",
    "03-repaso-espaciado",
    "04-indice-dominio",
    "05-deteccion-frustracion",
    // Oleada 2 — contenido curricular + CMS (dispatchers ampliados).
    // 11 antes de 12/13/14 (aporta eduFaceOf del panel que ellos envuelven);
    // 15 al final (muta el contenido; badge depende de #11).
    "11-materias-nuevas",
    "12-mates-avanzadas",
    "13-lectura-avanzada",
    "14-ciencias-avanzada",
    "15-cms-json",
    // Oleada 3 — motor adaptativo, secuenciación y ZDP.
    // 7 antes de 6 (6 envuelve roundMathCount sobre el duplicado de 7);
    // 8 tras 6/12/13/14 (delega los dispatchers ampliados); 9 último
    // (cadena refreshHome).
    "07-secuenciacion",
    "06-motor-adaptativo",
    "08-zdp-dinamica",
    "09-recomendador",
    // Oleada 4 — UX, accesibilidad y personaje.
    // 17,18 puramente aditivos (filas Ajustes); 16 (mascota, voces gated)
    // ANTES de 20 (20 detecta #peqMascot y entra en modo enhance); 30 al
    // final del grupo (applySubjectVisibility es el wrapper más externo de
    // refreshHome/passGate/startGame; PIN off por defecto).
    "17-accesibilidad",
    "18-dislexia",
    "16-voces-mascota",
    "20-animaciones-personaje",
    "30-controles-parentales",
    // Oleada 5 — familia y educador. Orden interno 19→21→22→23:
    // 19 y 21 encadenan sobre window.logRound; 21 y 22 sobre
    // window.renderProgress2; 23 añade una pestaña más al mismo .tabs que
    // comparten #tabAlbum (19) y #tabParental (30). #24 NO se integra: su
    // contenido vive dentro de una IIFE en app.js y no es alcanzable desde
    // fuera — ver fase4/MASTER_PLAN.md.
    "19-album-logros",
    "21-reporte-semanal",
    "22-metas-semanales",
    "23-modo-aula",
    // Oleada 6 — empaquetado a tiendas (código TWA/atajos ?game=, wrap de
    // paintInstall). 25,26,27,29 son scaffolds sin wiring, fuera del loader.
    "28-pwa-tiendas",
    // Juegos nuevos y fondos de pantallas secundarias: no se ven en el
    // primer pintado de Home, así que se difieren.
    "34-juegos",
    "41-fondo-juego",
    "42-pantallas-fondo",
    // #49 iconos papercraft del quiz de fonética: solo aparecen dentro de
    // una ronda de lectura, mucho después del arranque, y su spec.js
    // reintenta con un intervalo hasta encontrar #stage — se difiere.
    "49-iconos-quiz-letras",
    // #52 rediseño de las tarjetas de "Elige un juego": una ilustración por
    // juego en vez de un icono por mecánica. Solo se ve dentro del overlay
    // de #34, así que se difiere igual que él, y va DESPUÉS: #34 es quien
    // construye los botones que #52 reestiliza.
    "52-juegos-tarjetas",
    // #53 sección "Formas y Colores": una cuarta materia completa (formas,
    // colores y patrones) con cuatro juegos propios. Inyecta su tarjeta en
    // Home, así que podría parecer crítica, pero llega con el resto del
    // contenido y aparece con la misma animación de entrada que las otras
    // tres. Va DESPUÉS de #52: reutiliza sus tarjetas papercraft y le añade
    // las cuatro viñetas nuevas.
    "53-formas-colores"
  ];

  var injected = Object.create(null);

  function injectCss(m) {
    if (injected[m + ":css"]) return;
    injected[m + ":css"] = true;
    var l = document.createElement("link");
    l.rel = "stylesheet"; l.href = BASE + m + "/spec.css";
    (document.head || document.documentElement).appendChild(l);
  }

  // Carga aditiva e idempotente de un módulo (CSS + JS). Segura de llamar
  // más de una vez o desde cualquier lugar: si ya se inyectó, no repite
  // nada. Sirve de fallback on-demand: si el peque navega a algo que
  // depende de un módulo diferido antes de que termine de cargar solo,
  // llamar a esto garantiza que cargue en ese momento igual.
  function loadModule(m, cb) {
    injectCss(m);
    if (injected[m + ":js"]) { if (cb) cb(); return; }
    injected[m + ":js"] = true;
    var s = document.createElement("script");
    s.src = BASE + m + "/spec.js";
    s.async = false;
    s.onload = function () { if (cb) cb(); };
    s.onerror = function () { if (cb) cb(); };
    (document.body || document.documentElement).appendChild(s);
  }

  function loadChain(list, done) {
    var i = 0;
    (function next() {
      if (i >= list.length) { if (done) done(); return; }
      loadModule(list[i++], next);
    })();
  }

  loadChain(CRITICAL_MODULES, function () {
    var kick = function () { loadChain(DEFERRED_MODULES, function () {}); };
    if (window.requestIdleCallback) window.requestIdleCallback(kick, { timeout: 1500 });
    else setTimeout(kick, 60);
  });

  // Expuesto por si una pantalla futura necesita forzar la carga anticipada
  // de un módulo puntual concreto (misma función idempotente de arriba).
  window.PA_loadModule = loadModule;
})();
