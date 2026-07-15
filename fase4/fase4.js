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
    "09-recomendador"
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
