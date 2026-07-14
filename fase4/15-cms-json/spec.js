"use strict";
/* ============================================================================
   Fase 4 · Mejora #15 "cms-json" — CONTENT: contenido externalizable y cargable
   ----------------------------------------------------------------------------
   Objetivo (brief): sacar LETTERS/ANIMALS/MATH_OBJ/MATH_LEVELS/HAB/DIET/
   DIET_CAT de "datos quemados en el código" a un objeto CONTENT único,
   versionado y VALIDADO, que se pueda cargar/editar desde fuera (hoy:
   localStorage + API programática; mañana: un CMS/backend real) SIN TOCAR
   NINGUNA función de juego (roundMathCount/roundMathSubitize/roundMathCompare/
   roundReading/roundScience/roundScienceDiet/aggregate/etc. quedan intactas,
   byte a byte). Así la app escala en contenido (más letras, más animales, más
   niveles de conteo...) sin volver a tocar la lógica de esos módulos.

   CÓMO FUNCIONA (el truco, documentado a propósito):
   LETTERS/ANIMALS/MATH_OBJ/MATH_LEVELS/HAB/DIET/DIET_CAT en ship/app.js están
   declarados con `const`, pero `const` solo congela el BINDING (el nombre),
   no el contenido del array/objeto al que apunta. Todas las funciones de
   juego leen esas variables en vivo, cada vez que arman una ronda (nunca las
   copian una sola vez al arrancar). Por lo tanto, esta mejora NUNCA reasigna
   esos nombres (rompería, `const x = ...` dos veces lanza SyntaxError/TypeError
   y de todas formas sería reescribir, no aditivo): en su lugar, MUTA el
   contenido de esos mismos arrays/objetos in-place (vaciar + rellenar), y
   dichas funciones —sin que nadie las toque— ven el contenido nuevo la
   próxima vez que arman una ronda. Es exactamente el mismo espíritu aditivo
   que ya usa el resto de la Fase 2/3 (envolver por reasignación de window.*),
   aplicado a DATOS en vez de a FUNCIONES.

   FALLBACK a los datos actuales (obligatorio por brief):
   - Si no hay ninguna fuente externa disponible (no hay nada en
     localStorage['pequenautas.content.v1'], nadie llamó a CONTENT_API.set),
     este bloque NO MUTA NADA. LETTERS/ANIMALS/MATH_OBJ/MATH_LEVELS/HAB/DIET/
     DIET_CAT quedan exactamente como en ship/app.js. Los 19 tests existentes
     no ven ninguna diferencia de comportamiento.
   - Si la fuente externa es inválida (forma incorrecta, faltan campos,
     rompería una regla estructural del juego), esa SECCIÓN se rechaza y se
     conserva el contenido anterior para esa sección (nunca se aplica un
     estado a medias que pueda crashear una ronda). Ver validate*() abajo.
   - `CONTENT_API.reset()` restaura, en cualquier momento, el snapshot
     original capturado al cargar este módulo (antes de aplicar cualquier
     override), sin necesidad de recargar la página.

   SIN RED bajo file:// (obligatorio): la única fuente que se lee de forma
   AUTOMÁTICA al cargar es `localStorage['pequenautas.content.v1']` (mismo
   mecanismo ya usado por DB/STORE_KEY en ship/app.js, funciona igual bajo
   file:// que bajo https:). Se expone también `loadContentFromURL(url,cb)`
   como utilidad OPCIONAL para una futura pantalla de administración/CMS o
   para el backend ya diseñado en docs/backend-supabase.md (PEQUE_FLAGS.
   backendSync), pero NO se invoca nunca de forma automática y además se
   niega a sí misma bajo file:// (mismo guard que ya usa registerPWA() en
   ship/app.js), así que no puede abrir ningún socket salvo que un futuro
   módulo explícito la llame bajo http(s)/https.

   PATRÓN DE EXTENSIÓN: IIFE aditiva al final de app.js. No redefine init ni
   applyLang. No usa .onclick= sobre #langBtn/#tabSet. Envuelve
   window.renderEducator por reasignación (mismo mecanismo que
   window.speak/afterCorrect/nextRound/refreshHome ya usan en ship/app.js)
   solo para pintar una insignia informativa opcional en el panel del
   educador; si esa función no existe todavía (panel educador no integrado),
   el resto de CONTENT_API funciona igual. Anima solo opacity/transform
   (insignia) y respeta prefers-reduced-motion.
   ============================================================================ */
(function () {
  "use strict";

  var STORE_KEY_CONTENT = "pequenautas.content.v1";
  var KNOWN_HAB = ["water", "land", "sky"];     // fijos: roundScience() los tiene hardcodeados
  var KNOWN_DIET = ["herb", "carn"];            // fijos: roundScienceDiet() los tiene hardcodeados
  var MIN_LETTERS = 3;                          // roundReading pide target + sample(...,2)
  var MIN_ANIMALS = 3;
  var MIN_MATH_OBJECTS = 3;
  var MIN_DIET_POOL = 1;                        // roundScienceDiet: pool=ANIMALS.filter(a=>DIET[a.emoji]); no puede quedar en 0

  /* ---------- helpers de forma ---------- */
  function isStr(x) { return typeof x === "string" && x.length > 0; }
  function isPlainObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function cloneItem(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function replaceArray(arr, items) { arr.length = 0; for (var i = 0; i < items.length; i++) arr.push(items[i]); }

  /* ---------- validadores por sección (defensivos: nunca lanzan) ---------- */
  function validateMathObjects(arr) {
    return Array.isArray(arr) && arr.length >= MIN_MATH_OBJECTS && arr.every(isStr);
  }
  function validateMathLevels(arr) {
    return Array.isArray(arr) && arr.length >= 1 && arr.every(function (p) {
      return Array.isArray(p) && p.length === 2 &&
        typeof p[0] === "number" && typeof p[1] === "number" &&
        p[0] >= 0 && p[1] >= p[0];
    });
  }
  function validateLetterSet(arr) {
    if (!Array.isArray(arr) || arr.length < MIN_LETTERS) return false;
    var seen = {};
    for (var i = 0; i < arr.length; i++) {
      var o = arr[i];
      if (!o || !isStr(o.L) || o.L.length > 4 || !isStr(o.emoji) || !isStr(o.word) || !isStr(o.sound)) return false;
      var key = o.L.toLowerCase();
      if (seen[key]) return false; // sample(set.filter(x=>x.L!==target.L),2) exige L únicas
      seen[key] = true;
    }
    return true;
  }
  function validateAnimalsShape(arr) {
    return Array.isArray(arr) && arr.length >= MIN_ANIMALS && arr.every(function (a) {
      return a && isStr(a.emoji) && KNOWN_HAB.indexOf(a.hab) >= 0 && isStr(a.es) && isStr(a.en);
    });
  }
  function validateHabitatsPatch(obj) {
    if (!isPlainObj(obj)) return false;
    var keys = Object.keys(obj).filter(function (k) { return KNOWN_HAB.indexOf(k) >= 0; });
    if (!keys.length) return false; // patch vacío/solo con claves desconocidas: nada que aplicar
    return keys.every(function (k) {
      var v = obj[k];
      return v && isStr(v.emoji) && isStr(v.es) && isStr(v.en);
    });
  }
  function validateDietPatch(map) {
    if (!isPlainObj(map)) return false;
    var keys = Object.keys(map);
    if (!keys.length) return false;
    return keys.every(function (k) { return isStr(k) && (map[k] === "herb" || map[k] === "carn"); });
  }
  function validateDietCategoriesPatch(obj) {
    if (!isPlainObj(obj)) return false;
    var keys = Object.keys(obj).filter(function (k) { return KNOWN_DIET.indexOf(k) >= 0; });
    if (!keys.length) return false;
    return keys.every(function (k) {
      var v = obj[k];
      return v && isStr(v.emoji) && isStr(v.es) && isStr(v.en);
    });
  }

  /* ---------- snapshot inicial desde los datos YA existentes en ship/app.js ---------- */
  function snapshotFromLive() {
    return {
      version: 1,
      math: {
        objects: MATH_OBJ.slice(),
        levels: MATH_LEVELS.map(function (p) { return p.slice(); })
      },
      letters: {
        es: LETTERS.es.map(cloneItem),
        en: LETTERS.en.map(cloneItem)
      },
      animals: ANIMALS.map(cloneItem),
      habitats: { water: cloneItem(HAB.water), land: cloneItem(HAB.land), sky: cloneItem(HAB.sky) },
      diet: Object.assign({}, DIET),
      dietCategories: { herb: cloneItem(DIET_CAT.herb), carn: cloneItem(DIET_CAT.carn) }
    };
  }

  var DEFAULT_CONTENT = snapshotFromLive();       // snapshot pristino (para reset())
  window.CONTENT = clone(DEFAULT_CONTENT);         // espejo de solo-lectura del estado actual

  /* ---------- aplicación transaccional de un parche (parcial u total) ---------- */
  /* applyContent(partial) valida cada sección presente en `partial`; solo MUTA
     los datos reales (LETTERS/ANIMALS/MATH_OBJ/MATH_LEVELS/HAB/DIET/DIET_CAT)
     de las secciones que resultan válidas (individualmente Y en conjunto, ver
     la validación cruzada animals+diet más abajo). Devuelve un reporte
     {applied:[...], rejected:[{section,reason}]} — nunca lanza. */
  function applyContent(partial) {
    partial = partial || {};
    var applied = [], rejected = [];
    var plan = {}; // section -> valor final a commitear

    if (Object.prototype.hasOwnProperty.call(partial, "math")) {
      var m = partial.math || {};
      if (Object.prototype.hasOwnProperty.call(m, "objects")) {
        if (validateMathObjects(m.objects)) plan.mathObjects = m.objects.slice();
        else rejected.push({ section: "math.objects", reason: "forma inválida (mínimo " + MIN_MATH_OBJECTS + " strings no vacíos)" });
      }
      if (Object.prototype.hasOwnProperty.call(m, "levels")) {
        if (validateMathLevels(m.levels)) plan.mathLevels = m.levels.map(function (p) { return p.slice(); });
        else rejected.push({ section: "math.levels", reason: "forma inválida (array de pares [min,max], min<=max, >=1 nivel)" });
      }
    }
    if (Object.prototype.hasOwnProperty.call(partial, "letters")) {
      var l = partial.letters || {};
      ["es", "en"].forEach(function (lang) {
        if (Object.prototype.hasOwnProperty.call(l, lang)) {
          if (validateLetterSet(l[lang])) { plan.letters = plan.letters || {}; plan.letters[lang] = l[lang].map(cloneItem); }
          else rejected.push({ section: "letters." + lang, reason: "forma inválida (mínimo " + MIN_LETTERS + " letras {L,emoji,word,sound}, L únicas)" });
        }
      });
    }
    var animalsCandidate = null, animalsProvided = false;
    if (Object.prototype.hasOwnProperty.call(partial, "animals")) {
      animalsProvided = true;
      if (validateAnimalsShape(partial.animals)) animalsCandidate = partial.animals.map(cloneItem);
      else rejected.push({ section: "animals", reason: "forma inválida (mínimo " + MIN_ANIMALS + " animales {emoji,hab:water|land|sky,es,en})" });
    }
    if (Object.prototype.hasOwnProperty.call(partial, "habitats")) {
      if (validateHabitatsPatch(partial.habitats)) {
        plan.habitats = {};
        KNOWN_HAB.forEach(function (k) { if (partial.habitats[k]) plan.habitats[k] = cloneItem(partial.habitats[k]); });
      } else rejected.push({ section: "habitats", reason: "forma inválida (parche parcial sobre water/land/sky: {emoji,es,en} cada uno)" });
    }
    var dietCandidate = null, dietProvided = false;
    if (Object.prototype.hasOwnProperty.call(partial, "diet")) {
      dietProvided = true;
      if (validateDietPatch(partial.diet)) dietCandidate = Object.assign({}, partial.diet);
      else rejected.push({ section: "diet", reason: "forma inválida (mapa emoji -> 'herb'|'carn')" });
    }
    if (Object.prototype.hasOwnProperty.call(partial, "dietCategories")) {
      if (validateDietCategoriesPatch(partial.dietCategories)) {
        plan.dietCategories = {};
        KNOWN_DIET.forEach(function (k) { if (partial.dietCategories[k]) plan.dietCategories[k] = cloneItem(partial.dietCategories[k]); });
      } else rejected.push({ section: "dietCategories", reason: "forma inválida (parche parcial sobre herb/carn: {emoji,es,en} cada uno)" });
    }

    /* Validación cruzada (obligatoria para no romper roundScienceDiet): el pool
       de animales con dieta conocida ((animales efectivos) ∩ (dieta efectiva))
       no puede quedar vacío. "Efectivo" = candidato válido de este parche, o el
       contenido actual si esta sección no vino en el parche o vino inválida. */
    var effAnimals = animalsCandidate || CONTENT.animals;
    var effDiet = dietCandidate ? Object.assign({}, CONTENT.diet, dietCandidate) : CONTENT.diet;
    var poolOk = effAnimals.filter(function (a) { return effDiet[a.emoji]; }).length >= MIN_DIET_POOL;

    if (animalsProvided && animalsCandidate) {
      if (poolOk) plan.animals = animalsCandidate;
      else rejected.push({ section: "animals", reason: "el cruce animals×diet quedaría en 0 elementos (roundScienceDiet no tendría pool); se conserva el contenido anterior" });
    }
    if (dietProvided && dietCandidate) {
      if (poolOk) plan.diet = dietCandidate;
      else rejected.push({ section: "diet", reason: "el cruce animals×diet quedaría en 0 elementos (roundScienceDiet no tendría pool); se conserva el contenido anterior" });
    }

    /* ---- commit: solo aquí se muta el estado real (LETTERS/ANIMALS/...) ---- */
    if (plan.mathObjects) { replaceArray(MATH_OBJ, plan.mathObjects); CONTENT.math.objects = plan.mathObjects.slice(); applied.push("math.objects"); }
    if (plan.mathLevels) { replaceArray(MATH_LEVELS, plan.mathLevels.map(function (p) { return p.slice(); })); CONTENT.math.levels = plan.mathLevels.map(function (p) { return p.slice(); }); applied.push("math.levels"); }
    if (plan.letters) {
      Object.keys(plan.letters).forEach(function (lang) {
        replaceArray(LETTERS[lang], plan.letters[lang].map(cloneItem));
        CONTENT.letters[lang] = plan.letters[lang].map(cloneItem);
        applied.push("letters." + lang);
      });
    }
    if (plan.animals) { replaceArray(ANIMALS, plan.animals.map(cloneItem)); CONTENT.animals = plan.animals.map(cloneItem); applied.push("animals"); }
    if (plan.habitats) {
      Object.keys(plan.habitats).forEach(function (k) {
        HAB[k].emoji = plan.habitats[k].emoji; HAB[k].es = plan.habitats[k].es; HAB[k].en = plan.habitats[k].en;
        CONTENT.habitats[k] = cloneItem(HAB[k]);
      });
      applied.push("habitats");
    }
    if (plan.diet) {
      Object.keys(plan.diet).forEach(function (k) { DIET[k] = plan.diet[k]; });
      CONTENT.diet = Object.assign({}, DIET);
      applied.push("diet");
    }
    if (plan.dietCategories) {
      Object.keys(plan.dietCategories).forEach(function (k) {
        DIET_CAT[k].emoji = plan.dietCategories[k].emoji; DIET_CAT[k].es = plan.dietCategories[k].es; DIET_CAT[k].en = plan.dietCategories[k].en;
        CONTENT.dietCategories[k] = cloneItem(DIET_CAT[k]);
      });
      applied.push("dietCategories");
    }

    return { applied: applied, rejected: rejected };
  }

  /* Restaura el snapshot pristino capturado al cargar este módulo. */
  function resetContent() {
    var d = DEFAULT_CONTENT;
    replaceArray(MATH_OBJ, d.math.objects.slice());
    replaceArray(MATH_LEVELS, d.math.levels.map(function (p) { return p.slice(); }));
    replaceArray(LETTERS.es, d.letters.es.map(cloneItem));
    replaceArray(LETTERS.en, d.letters.en.map(cloneItem));
    replaceArray(ANIMALS, d.animals.map(cloneItem));
    KNOWN_HAB.forEach(function (k) { HAB[k].emoji = d.habitats[k].emoji; HAB[k].es = d.habitats[k].es; HAB[k].en = d.habitats[k].en; });
    Object.keys(DIET).forEach(function (k) { delete DIET[k]; });
    Object.keys(d.diet).forEach(function (k) { DIET[k] = d.diet[k]; });
    KNOWN_DIET.forEach(function (k) { DIET_CAT[k].emoji = d.dietCategories[k].emoji; DIET_CAT[k].es = d.dietCategories[k].es; DIET_CAT[k].en = d.dietCategories[k].en; });
    window.CONTENT = clone(d);
    try { localStorage.removeItem(STORE_KEY_CONTENT); } catch (e) { /* fallback en memoria: no-op */ }
  }

  function isCustom() {
    try { return JSON.stringify(CONTENT) !== JSON.stringify(DEFAULT_CONTENT); } catch (e) { return false; }
  }

  /* Aplica y persiste (localStorage) — para una futura pantalla de admin. */
  function setAndPersist(partial) {
    var report = applyContent(partial);
    if (report.applied.length) {
      try { localStorage.setItem(STORE_KEY_CONTENT, JSON.stringify(CONTENT)); } catch (e) { /* fallback en memoria: no-op */ }
    }
    return report;
  }

  /* Autocarga (una vez, al arrancar este módulo) desde localStorage. 100%
     offline: localStorage funciona igual bajo file:// que bajo https:, no
     abre ningún socket. Si la clave no existe o el JSON es inválido, no pasa
     nada (fallback = datos actuales, ya presentes en LETTERS/ANIMALS/...). */
  function autoloadFromStorage() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY_CONTENT); } catch (e) { return { applied: [], rejected: [] }; }
    if (!raw) return { applied: [], rejected: [] };
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { return { applied: [], rejected: [{ section: "*", reason: "JSON inválido en localStorage" }] }; }
    return applyContent(parsed || {});
  }

  /* ---------- utilidad opcional y DORMIDA para un futuro CMS/backend ----------
     NUNCA se invoca automáticamente. Bajo file:// se niega a sí misma (mismo
     guard que ya usa registerPWA() en ship/app.js) para que ni siquiera un
     mal uso manual pueda abrir una petición bajo file://. Solo funciona si
     protocolo es http/https y alguien la llama explícitamente. */
  function loadContentFromURL(url, cb) {
    cb = cb || function () {};
    var secure = (typeof location !== "undefined") && (location.protocol === "https:" || location.protocol === "http:");
    if (!secure) { cb({ applied: [], rejected: [{ section: "*", reason: "bloqueado bajo file:// (sin red permitida)" }] }); return; }
    if (typeof fetch !== "function") { cb({ applied: [], rejected: [{ section: "*", reason: "fetch no disponible" }] }); return; }
    fetch(url).then(function (r) { return r.json(); })
      .then(function (json) { cb(setAndPersist(json || {})); })
      .catch(function () { cb({ applied: [], rejected: [{ section: "*", reason: "fetch/parse falló" }] }); });
  }

  /* ---------- API pública para tests/tooling/futuro admin ---------- */
  window.CONTENT_API = {
    get: function () { return clone(CONTENT); },
    getDefault: function () { return clone(DEFAULT_CONTENT); },
    set: applyContent,
    setAndPersist: setAndPersist,
    reset: resetContent,
    isCustom: isCustom,
    validate: {
      mathObjects: validateMathObjects,
      mathLevels: validateMathLevels,
      letterSet: validateLetterSet,
      animals: validateAnimalsShape,
      habitats: validateHabitatsPatch,
      diet: validateDietPatch,
      dietCategories: validateDietCategoriesPatch
    },
    loadFromURL: loadContentFromURL /* dormida; ver cabecera */
  };

  try { autoloadFromStorage(); } catch (e) { /* nunca debe tumbar el arranque de la app */ }

  /* ---------- insignia informativa opcional en el panel del educador ----------
     Puramente cosmética/informativa: si CONTENT_API.isCustom() es true, avisa
     al adulto (en #eduView) de que el contenido de las materias fue
     personalizado. Se crea UNA vez como hermana de #eduBody (nunca dentro,
     porque renderEducator() reconstruye #eduBody.innerHTML por completo en
     cada llamada y borraría cualquier nodo insertado ahí). Si #eduView no
     existe (panel educador de la mejora #11 no integrado en este build),
     esta sección queda inerte sin afectar CONTENT_API. */
  if (typeof UI === "object" && UI.es && UI.en) {
    Object.assign(UI.es, { cmsCustomLabel: "Contenido personalizado activo" });
    Object.assign(UI.en, { cmsCustomLabel: "Custom content active" });
  }

  function ensureBadge() {
    var view = (typeof $ === "function") ? $("eduView") : document.getElementById("eduView");
    if (!view) return null;
    var badge = document.getElementById("cmsBadge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "cmsBadge";
      badge.className = "cmsBadge";
      badge.hidden = true;
      badge.innerHTML = '<span id="cmsBadgeIcon" aria-hidden="true">🗂️</span><span id="cmsBadgeTxt"></span>';
      var anchor = document.getElementById("eduBody");
      if (anchor && anchor.parentNode === view) view.insertBefore(badge, anchor);
      else view.appendChild(badge);
    }
    return badge;
  }
  function paintBadge() {
    var badge = ensureBadge(); if (!badge) return;
    var on = isCustom();
    badge.hidden = !on;
    if (on) {
      var t = (typeof UI === "object" && typeof S === "object" && UI[S.lang]) ? UI[S.lang] : UI.es;
      var txt = document.getElementById("cmsBadgeTxt");
      if (txt) txt.textContent = t.cmsCustomLabel || "Custom content active";
    }
  }

  if (!window.__cmsJsonWrapped) {
    window.__cmsJsonWrapped = true;
    if (typeof window.renderEducator === "function") {
      var _renderEducator = window.renderEducator;
      window.renderEducator = function () {
        _renderEducator();
        try { paintBadge(); } catch (e) {}
      };
    }
    var lb = (typeof $ === "function") ? $("langBtn") : document.getElementById("langBtn");
    if (lb) lb.addEventListener("click", function () { try { paintBadge(); } catch (e) {} });
  }
})();
