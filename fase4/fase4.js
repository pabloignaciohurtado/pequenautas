/* ==================== Fase 4 · loader de mejoras ====================
   Carga los módulos de Fase 4 DESPUÉS de app.js, preservando el ORDEN de
   envoltura de globales (window.afterCorrect/nextRound/roundMath/... — ver
   MASTER_PLAN.md). Cada mejora vive en fase4/NN-slug/{spec.js,spec.css}.
   Para añadir una oleada: agrega sus carpetas a MODULES en el orden indicado
   por el plan. Aditivo, offline, sin red. Un módulo que falte o falle no
   detiene a los demás (onerror → next).

   Carga progresiva (feat/carga-progresiva): en vez de inyectar los ~36
   módulos de una sola cadena secuencial, se separan en dos fases:
   - CRITICAL_MODULES: identidad visual + pantalla Home (lo que el peque ve
     de inmediato). Se cargan primero y en su ORDEN RELATIVO original.
   - DEFERRED_MODULES: analítica, motor adaptativo, accesibilidad, panel
     familiar/educador, tiendas y fondos de pantallas secundarias. Se cargan
     justo después, en segundo plano (requestIdleCallback/setTimeout), SIN
     bloquear el primer pintado, preservando también su ORDEN RELATIVO
     original (las envolturas de globals como refreshHome/roundMathCount
     siguen aplicándose en la misma secuencia que antes, solo unos instantes
     más tarde). En paralelo, sw.js hace un precache en segundo plano de
     TODOS los módulos con progreso vía postMessage — en la práctica esta
     segunda cadena casi siempre resuelve desde caché. */
(function () {
  "use strict";
  var BASE = "fase4/";

  // Fase 1 — orden relativo original del plan (Oleadas 7-11: identidad
  // visual + Home). Puramente aditivo/CSS + retoques DOM, no envuelve
  // globals de juego, así que es seguro adelantarlo.
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
    "43-progreso-carga"
  ];

  // Fase 2 — resto de MODULES, en su mismo orden relativo original.
  var DEFERRED_MODULES = [
    // Oleada 1 — medición y analítica (offline, observacional)
    "01-eval-pre-post",
    "02-ab-testing",
    "03-repaso-espaciado",
    "04-indice-dominio",
    "05-deteccion-frustracion",
    // Oleada 2 — contenido curricular + CMS
    "11-materias-nuevas",
    "12-mates-avanzadas",
    "13-lectura-avanzada",
    "14-ciencias-avanzada",
    "15-cms-json",
    // Oleada 3 — motor adaptativo, secuenciación y ZDP
    "07-secuenciacion",
    "06-motor-adaptativo",
    "08-zdp-dinamica",
    "09-recomendador",
    // Oleada 4 — UX, accesibilidad y personaje
    "17-accesibilidad",
    "18-dislexia",
    "16-voces-mascota",
    "20-animaciones-personaje",
    "30-controles-parentales",
    // Oleada 5 — familia y educador
    "19-album-logros",
    "21-reporte-semanal",
    "22-metas-semanales",
    "23-modo-aula",
    // Oleada 6 — empaquetado a tiendas
    "28-pwa-tiendas",
    // Nuevos juegos + fondos de pantallas secundarias (no críticos para el
    // primer pintado de Home)
    "34-juegos",
    "41-fondo-juego",
    "42-pantallas-fondo"
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
