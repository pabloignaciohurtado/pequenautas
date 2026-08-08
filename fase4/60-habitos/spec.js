/* ===== Fase 4 #60 · Sección "Hábitos y Autonomía" =====

   La octava materia, y la segunda seguida que no enseña un contenido
   escolar sino una competencia. #58 trabajó lo que el niño SIENTE; esta
   trabaja lo que el niño HACE solo: lavarse las manos, vestirse, guardar
   sus cosas, saber qué momento del día es.

   Por qué esta y no más números o más letras:
   1. Es lo que el adulto que compra la app está intentando conseguir en
      casa esta misma semana. Una sección que ensaya la rutina de dientes
      no compite con el colegio, compite con la pelea de las 8 de la
      noche — y por eso se percibe como valor inmediato y no como deber.
   2. Es la única familia de contenido donde el acierto se traslada fuera
      de la pantalla. Todo lo demás se queda en el juego.
   3. Reutiliza entera la maquinaria que ya existe: el papercraft de #52,
      el overlay propio de #53/#58 y la capa de gesto de #56 sin tocar una
      línea de ninguno.

   Cuatro juegos, cinco niveles cada uno:
   1. Paso a paso   ordenar los pasos de una rutina (3 y luego 4 pasos).
   2. ¿Qué necesito? la tarea dice qué hace falta; elegir el objeto.
   3. ¿Dónde va?     cada cosa a su sitio (juguetes, ropa, basura, baño).
   4. Mi día         mañana / tarde / noche.

   Decisión de arte, igual que en #53 y #58: los OBJETOS no son imágenes,
   son SVG generado aquí. Son geometría —un vaso, un cepillo, un zapato—,
   y generándolos se consigue lo que una ilustración no da: el mismo objeto
   idéntico en los cuatro juegos, de modo que el niño lo reconoce por su
   forma y no por la escena en la que lo vio. Grok pone las cinco
   ilustraciones de marco (tarjeta del home y las cuatro viñetas), que es
   donde la dirección de arte sí se juega.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY, ni #58. */
(function () {
  "use strict";
  if (window.__pa60) return;
  window.__pa60 = true;

  // Progreso por perfil (auditoría #7): PKEY() lleva el id del niño activo
  // y migra() copia+borra una única vez la llave vieja de dispositivo.
  var PKEY_BASE = "pequenautas.f4.habitos.v1";
  // pid() da null si aún no hay perfil activo (p.ej. #home .cards existe en
  // el HTML estático desde antes de elegir perfil): PKEY() cae entonces a la
  // llave plana de siempre, y migrar() NO se marca hecho hasta que haya un
  // perfil de verdad al que migrar.
  function pid() { var p = (typeof currentProfile === "function") ? currentProfile() : null; return (p && p.id) ? p.id : null; }
  function PKEY() { var id = pid(); return id ? (PKEY_BASE + "." + id) : PKEY_BASE; }
  var migrado = false;
  function migrar() {
    if (migrado) return;
    var id = pid();
    if (!id) return;
    migrado = true;
    try {
      var k = PKEY_BASE + "." + id;
      if (localStorage.getItem(k) != null) return;
      var viejo = localStorage.getItem(PKEY_BASE);
      if (viejo != null) { localStorage.setItem(k, viejo); localStorage.removeItem(PKEY_BASE); }
    } catch (e) {}
  }
  function loadP() { migrar(); try { return JSON.parse(localStorage.getItem(PKEY()) || "{}") || {}; } catch (e) { return {}; } }
  function saveP(o) { try { localStorage.setItem(PKEY(), JSON.stringify(o)); } catch (e) {} }
  function unlocked(gid) { var p = loadP(); return (typeof p[gid] === "number") ? p[gid] : 0; }
  function setUnlocked(gid, v) { var p = loadP(); if (!(p[gid] >= v)) { p[gid] = v; saveP(p); } }

  var d = document;
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { var b = a.slice(), i, j, t; for (i = b.length - 1; i > 0; i--) { j = rnd(i + 1); t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
  function sample(a, n) { return shuffle(a).slice(0, n); }

  var lang = "es";
  function detectLang() {
    var n = d.getElementById("lblRead");
    lang = (n && /letter/i.test(n.textContent || "")) ? "en" : "es";
    return lang;
  }
  function T(es, en) { return lang === "en" ? en : es; }
  function say(txt) { try { if (typeof window.speak === "function") window.speak(txt, { lang: lang }); } catch (e) {} }
  function star() { try { if (typeof window.addStar === "function") window.addStar(); } catch (e) {} }
  // "Pistas guiadas" vive en S.guide dentro de app.js, tan inalcanzable como
  // S.lang: se lee del mismo interruptor visible que el adulto manipula
  // (#tgGuide), calcado de appSoundOn() en #57.
  function guideOn() {
    var tg = d.getElementById("tgGuide");
    return tg ? tg.classList.contains("on") : true;
  }

  /* ================= LOS OBJETOS =================
     Un solo juego de piezas de papel para toda la sección. Todas en un
     viewBox 100x100 y con clases (.p1..p5, .ln) en vez de colores
     incrustados, para que el modo alto contraste de #17 pueda intervenir
     desde el CSS sin volver a generar nada. */
  var SH = {
    tap:    '<path class="p5" d="M22 74h56v10H22z"/><path class="p3" d="M30 40h10v34H30z"/><path class="p3" d="M30 40h34v10H30z"/><path class="p2" d="M58 34h14v14H58z"/><path class="p3 ln" d="M46 56c0 6 6 8 6 14"/>',
    soap:   '<rect class="p4" x="24" y="46" width="52" height="32" rx="12"/><path class="p1" d="M34 54h20v6H34z"/><circle class="p1" cx="66" cy="30" r="8"/><circle class="p1" cx="46" cy="24" r="5"/><circle class="p1" cx="56" cy="38" r="4"/>',
    towel:  '<rect class="p3" x="26" y="24" width="48" height="58" rx="8"/><path class="p1" d="M26 42h48v8H26z"/><path class="p1" d="M26 58h48v6H26z"/><path class="p5" d="M20 22h60v8H20z"/>',
    brush:  '<rect class="p2" x="44" y="34" width="12" height="48" rx="6"/><rect class="p1" x="38" y="18" width="24" height="18" rx="6"/><path class="p5" d="M42 16h4v6h-4zM50 16h4v6h-4zM58 16h4v6h-4z"/>',
    paste:  '<rect class="p1" x="34" y="30" width="32" height="52" rx="8"/><rect class="p4" x="42" y="18" width="16" height="14" rx="4"/><path class="p4" d="M40 46h20v8H40z"/><path class="p4" d="M40 60h14v6H40z"/>',
    cup:    '<path class="p1" d="M30 26h40l-6 56H36z"/><path class="p3" d="M35 50h30l-3 30H38z"/>',
    comb:   '<rect class="p2" x="20" y="34" width="60" height="16" rx="6"/><path class="p2" d="M26 50h6v22h-6zM40 50h6v22h-6zM54 50h6v22h-6zM68 50h6v22h-6z"/>',
    bed:    '<rect class="p5" x="16" y="46" width="68" height="22" rx="6"/><rect class="p1" x="24" y="34" width="28" height="16" rx="6"/><rect class="p3" x="16" y="40" width="68" height="10" rx="5"/><path class="p5" d="M18 68h8v14h-8zM74 68h8v14h-8z"/>',
    shirt:  '<path class="p3" d="M36 24h28l18 12-8 14-10-6v38H36V44l-10 6-8-14z"/><path class="p1" d="M44 24h12l-6 8z"/>',
    sock:   '<path class="p2" d="M36 20h20v34c0 10 20 12 20 22 0 8-8 12-16 12s-16-6-16-16V20z"/><path class="p1" d="M36 20h20v10H36z"/>',
    shoe:   '<path class="p5" d="M22 46h20l10 12h18c8 0 12 6 12 12v6H22z"/><path class="p1" d="M22 70h60v8H22z"/><path class="p1" d="M30 50h8v8h-8z"/>',
    bag:    '<rect class="p4" x="24" y="34" width="52" height="48" rx="12"/><path class="p1" d="M24 52h52v14H24z"/><path class="p5 ln" d="M38 34c0-10 24-10 24 0"/><rect class="p1" x="44" y="56" width="12" height="8" rx="3"/>',
    plate:  '<ellipse class="p1" cx="50" cy="56" rx="34" ry="22"/><ellipse class="p3" cx="50" cy="56" rx="22" ry="13"/>',
    spoon:  '<ellipse class="p1" cx="50" cy="34" rx="14" ry="18"/><rect class="p1" x="45" y="50" width="10" height="34" rx="5"/>',
    ball:   '<circle class="p2" cx="50" cy="54" r="28"/><path class="p1 ln" d="M22 54h56"/><path class="p1 ln" d="M50 26c10 12 10 44 0 56"/>',
    teddy:  '<circle class="p2" cx="30" cy="34" r="11"/><circle class="p2" cx="70" cy="34" r="11"/><circle class="p2" cx="50" cy="56" r="26"/><ellipse class="p1" cx="50" cy="64" rx="14" ry="11"/><circle class="p5" cx="41" cy="49" r="3.5"/><circle class="p5" cx="59" cy="49" r="3.5"/><circle class="p5" cx="50" cy="59" r="4"/>',
    book:   '<path class="p4" d="M18 30h28c3 0 4 2 4 4v44c0-3-2-4-5-4H18z"/><path class="p4" d="M82 30H54c-3 0-4 2-4 4v44c0-3 2-4 5-4h27z"/><path class="p1" d="M24 40h20v5H24zM56 40h20v5H56zM24 52h20v5H24zM56 52h20v5H56z"/>',
    paper:  '<path class="p1" d="M50 20l22 14-6 20 12 16-20 8-18-6-16 8 4-20-12-14 20-8z"/><path class="p5 ln" d="M42 42l12 8-8 12"/>',
    apple:  '<path class="p2" d="M50 30c14-8 32 2 32 22 0 18-14 32-32 32S18 70 18 52c0-20 18-30 32-22z"/><path class="p4" d="M50 30c0-8 6-12 12-12-2 8-6 12-12 12z"/><path class="p1" d="M82 44c-12 2-14 20-2 24z"/>',
    box:    '<path class="p2" d="M18 44h64v38H18z"/><path class="p5" d="M14 30h72v16H14z"/><path class="p1" d="M44 30h12v52H44z"/>',
    drawer: '<rect class="p5" x="18" y="22" width="64" height="60" rx="6"/><rect class="p1" x="24" y="30" width="52" height="20" rx="4"/><rect class="p1" x="24" y="56" width="52" height="20" rx="4"/><circle class="p2" cx="50" cy="40" r="4"/><circle class="p2" cx="50" cy="66" r="4"/>',
    trash:  '<path class="p3" d="M26 34h48l-6 48H32z"/><rect class="p5" x="20" y="24" width="60" height="12" rx="5"/><rect class="p5" x="42" y="16" width="16" height="8" rx="4"/><path class="p1 ln" d="M40 44v30M50 44v30M60 44v30"/>',
    bath:   '<path class="p1" d="M16 48h68v14c0 10-8 18-18 18H34c-10 0-18-8-18-18z"/><path class="p3" d="M16 48h68v6H16z"/><path class="p5" d="M62 24h6v22h-6z"/><path class="p5" d="M62 24h12v6H62z"/><path class="p3 ln" d="M40 30c0 5 5 6 5 11"/>',
    sunrise:'<path class="p2" d="M50 30a24 24 0 0 1 24 24H26a24 24 0 0 1 24-24z"/><path class="p5" d="M14 60h72v8H14z"/><path class="p2 ln" d="M50 12v10M22 26l7 7M78 26l-7 7"/>',
    sun:    '<circle class="p2" cx="50" cy="50" r="22"/><path class="p2 ln" d="M50 10v12M50 78v12M10 50h12M78 50h12M22 22l8 8M78 22l-8 8M22 78l8-8M78 78l-8-8"/>',
    moon:   '<path class="p3" d="M62 18a34 34 0 1 0 20 44 28 28 0 0 1-20-44z"/><path class="p2" d="M28 26l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>'
  };
  /* Los trazos sueltos (los rayos del sol, las cerdas del cepillo) tienen que
     ir con stroke y no con fill, así que se marcan por clase desde el CSS. */
  function objSvg(id, extraCls) {
    return '<svg viewBox="0 0 100 100" class="pa60-obj ' + (extraCls || "") + '" data-obj="' + id + '" aria-hidden="true">' +
      (SH[id] || SH.ball) + "</svg>";
  }

  /* ================= CONTENIDO ================= */

  /* 1 · Rutinas: el orden es el contenido. Se eligen de tres y de cuatro
     pasos por separado porque la dificultad real es el número de pasos que
     hay que sostener en la cabeza, no cuál sea la rutina. */
  var ROUT3 = [
    { id: "manos", es: "Lavarse las manos", en: "Washing hands", steps: [
      { o: "tap",   es: "Abro el agua",   en: "Turn on the water" },
      { o: "soap",  es: "Me enjabono",    en: "Soap my hands" },
      { o: "towel", es: "Me seco",        en: "Dry my hands" } ] },
    { id: "dientes", es: "Los dientes", en: "Brushing teeth", steps: [
      { o: "paste", es: "Pongo la pasta", en: "Put on the paste" },
      { o: "brush", es: "Me cepillo",     en: "Brush my teeth" },
      { o: "cup",   es: "Me enjuago",     en: "Rinse my mouth" } ] },
    { id: "orden", es: "Guardar los juguetes", en: "Tidying up", steps: [
      { o: "ball",  es: "Recojo los juguetes", en: "Pick up the toys" },
      { o: "box",   es: "Los guardo en el baúl", en: "Put them in the chest" },
      { o: "book",  es: "El cuento al estante",  en: "Book back on the shelf" } ] }
  ];
  var ROUT4 = [
    { id: "dormir", es: "Ir a dormir", en: "Going to bed", steps: [
      { o: "bath",  es: "El baño",           en: "Bath time" },
      { o: "shirt", es: "Me pongo el pijama", en: "Put on pajamas" },
      { o: "book",  es: "Un cuento",          en: "A story" },
      { o: "bed",   es: "A dormir",           en: "Go to sleep" } ] },
    { id: "salir", es: "Salir de casa", en: "Going out", steps: [
      { o: "shirt", es: "Me visto",        en: "Get dressed" },
      { o: "sock",  es: "Los calcetines",  en: "Socks on" },
      { o: "shoe",  es: "Los zapatos",     en: "Shoes on" },
      { o: "bag",   es: "La mochila",      en: "Grab my backpack" } ] },
    { id: "comer", es: "La hora de comer", en: "Meal time", steps: [
      { o: "soap",  es: "Me lavo las manos", en: "Wash my hands" },
      { o: "spoon", es: "Como con la cuchara", en: "Eat with my spoon" },
      { o: "cup",   es: "Bebo agua",         en: "Drink some water" },
      { o: "plate", es: "Llevo mi plato",    en: "Take my plate" } ] }
  ];
  function stepTxt(s) { return lang === "en" ? s.en : s.es; }
  function routName(r) { return lang === "en" ? r.en : r.es; }

  /* 2 · Tareas: la frase dice para qué, el niño elige con qué. */
  var NEED = [
    { o: "brush", es: "Para lavarme los dientes",  en: "To brush my teeth" },
    { o: "towel", es: "Para secarme las manos",    en: "To dry my hands" },
    { o: "comb",  es: "Para peinarme",             en: "To comb my hair" },
    { o: "cup",   es: "Para beber agua",           en: "To drink water" },
    { o: "shoe",  es: "Para salir a la calle",     en: "To go outside" },
    { o: "bag",   es: "Para llevar mis cosas",     en: "To carry my things" },
    { o: "spoon", es: "Para comer la sopa",        en: "To eat my soup" },
    { o: "soap",  es: "Para lavarme las manos",    en: "To wash my hands" },
    { o: "book",  es: "Para leer un cuento",       en: "To read a story" },
    { o: "bed",   es: "Para dormir",               en: "To go to sleep" }
  ];
  function needTxt(n) { return lang === "en" ? n.en : n.es; }

  /* 3 · Cada cosa a su sitio. Cuatro destinos y objetos de sobra en cada
     uno: si un destino tuviera un solo objeto, el niño acertaría por
     descarte y no por saber dónde va. */
  var BINS = [
    { id: "box",    o: "box",    es: "Juguetes", en: "Toys",    items: ["ball", "teddy"] },
    { id: "drawer", o: "drawer", es: "Ropa",     en: "Clothes", items: ["shirt", "sock"] },
    { id: "trash",  o: "trash",  es: "Basura",   en: "Trash",   items: ["paper", "apple"] },
    { id: "bath",   o: "bath",   es: "Baño",     en: "Bathroom", items: ["brush", "soap", "towel", "comb"] }
  ];
  function binName(b) { return lang === "en" ? b.en : b.es; }

  /* 4 · Mi día. Tres momentos; en los dos primeros niveles solo día y
     noche, porque "tarde" es la que menos ancla tiene a los 3 años. */
  var DAY = [
    { id: "morn", o: "sunrise", es: "Mañana", en: "Morning", acts: [
      { o: "plate", es: "El desayuno", en: "Breakfast" },
      { o: "shirt", es: "Me visto",    en: "Get dressed" },
      { o: "bag",   es: "Voy a la escuela", en: "Off to school" } ] },
    { id: "noon", o: "sun", es: "Tarde", en: "Afternoon", acts: [
      { o: "spoon", es: "El almuerzo", en: "Lunch" },
      { o: "ball",  es: "Juego afuera", en: "Play outside" },
      { o: "comb",  es: "Me peino",     en: "Comb my hair" } ] },
    { id: "night", o: "moon", es: "Noche", en: "Night", acts: [
      { o: "bath",  es: "El baño",   en: "Bath time" },
      { o: "book",  es: "El cuento", en: "Bedtime story" },
      { o: "bed",   es: "A dormir",  en: "Go to sleep" } ] }
  ];
  function dayName(x) { return lang === "en" ? x.en : x.es; }

  var GAMES = [
    { id: "hab:steps", kind: "steps", mech: "sort",
      es: "Paso a paso", en: "Step by step",
      des: "Ordena la rutina", den: "Put the routine in order" },
    { id: "hab:need", kind: "need", mech: "tap",
      es: "¿Qué necesito?", en: "What do I need?",
      des: "Elige el objeto de la tarea", den: "Pick the right thing" },
    { id: "hab:place", kind: "place", mech: "drag",
      es: "¿Dónde va?", en: "Where does it go?",
      des: "Cada cosa a su sitio", den: "Everything in its place" },
    { id: "hab:day", kind: "day", mech: "match",
      es: "Mi día", en: "My day",
      des: "Mañana, tarde o noche", den: "Morning, afternoon or night" }
  ];
  function gName(g) { return lang === "en" ? g.en : g.es; }
  function mechEmoji(m) {
    if (m === "tap") return String.fromCodePoint(0x1F446);
    if (m === "drag") return String.fromCodePoint(0x270B);
    if (m === "sort") return String.fromCodePoint(0x2195, 0xFE0F);
    if (m === "match") return String.fromCodePoint(0x1F517);
    return "";
  }

  /* ---------- tarjeta del home ----------
     Octava casa. La regla que deja #58 ("si la octava es par entra en la
     rejilla") no sobrevive al caso real: con siete en rejilla vuelve la
     huérfana de 3+3+1. La regla que sí se sostiene, y que se adopta desde
     aquí, es por NATURALEZA y no por paridad: la rejilla es para las
     materias de CONTENIDO (seis, en 3+3) y las bandas para las de
     COMPETENCIA. Emociones y Hábitos quedan así como un zócalo de dos
     bandas al pie del home: se leen juntas, que es exactamente lo que son.
     Esta banda es algo más baja que la de #58 para que el zócalo tenga
     jerarquía y no parezca un bloque repetido. */
  function ensureCard() {
    var cards = d.querySelector("#home .cards");
    if (!cards || d.getElementById("pa60Card")) return;
    var b = el("button", "subject pa60-card");
    b.id = "pa60Card";
    b.setAttribute("data-game", "habits");
    b.innerHTML = '<span class="blob"></span><span class="lv" id="pa60Lv"></span>' +
      '<span class="emoji">🪥</span><span class="label" id="pa60Label"></span>';
    b.addEventListener("click", function () { detectLang(); openGames(); });
    cards.appendChild(b);
    paintCard();
  }
  function paintCard() {
    var lb = d.getElementById("pa60Label"), lv = d.getElementById("pa60Lv");
    if (lb) lb.textContent = T("Hábitos", "Habits");
    if (lv) {
      var tot = 0, i;
      for (i = 0; i < GAMES.length; i++) tot += unlocked(GAMES[i].id);
      lv.textContent = T("Nivel ", "Level ") + (Math.floor(tot / GAMES.length) + 1);
    }
  }

  /* ---------- overlay propio ---------- */
  var ov = null, hdT = null, body = null, backBtn = null;
  function ensureOv() {
    if (ov) return;
    ov = el("div", "pa60-ov");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    var sheet = el("div", "pa34-sheet pa60-sheet");
    var hd = el("div", "pa34-hd");
    backBtn = el("button", "pa34-back", "&lsaquo;");
    backBtn.setAttribute("aria-label", T("Volver", "Back"));
    backBtn.style.display = "none";
    hdT = el("div", "t", "");
    var x = el("button", "pa34-x", "&times;");
    x.setAttribute("aria-label", T("Cerrar", "Close"));
    hd.appendChild(backBtn); hd.appendChild(hdT); hd.appendChild(x);
    body = el("div", "pa34-body");
    sheet.appendChild(hd); sheet.appendChild(body); ov.appendChild(sheet);
    d.body.appendChild(ov);
    x.addEventListener("click", closeOv);
    ov.addEventListener("click", function (e) { if (e.target === ov) closeOv(); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { if (play && play.classList.contains("show")) exitPlay(); else if (ov.classList.contains("show")) closeOv(); }
    });
  }
  function closeOv() { if (ov) ov.classList.remove("show"); paintCard(); }
  function openOv() { ensureOv(); ov.classList.add("show"); }

  function openGames() {
    openOv();
    backBtn.style.display = "none";
    hdT.innerHTML = T("Hábitos y Autonomía", "Habits &amp; Independence") +
      "<small>" + T("Elige un juego", "Choose a game") + "</small>";
    body.innerHTML = "";
    var grid = el("div", "pa34-games pa60-games");
    GAMES.forEach(function (g) {
      var b = el("button", "pa34-game");
      b.setAttribute("data-pa34-game", g.id);
      b.appendChild(el("div", "pa34-m-" + g.mech + " mech", mechEmoji(g.mech)));
      b.appendChild(el("div", "gn", gName(g)));
      b.appendChild(el("div", "gp", T("Nivel ", "Level ") + (unlocked(g.id) + 1) + T(" de 5", " of 5")));
      b.addEventListener("click", function () { openLevels(g); });
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  function openLevels(g) {
    openOv();
    backBtn.style.display = "";
    backBtn.onclick = function () { openGames(); };
    hdT.innerHTML = gName(g) + "<small>" + T("Elige un nivel", "Choose a level") + "</small>";
    body.innerHTML = "";
    var u = unlocked(g.id);
    var wrap = el("div", "pa34-levels");
    var caps = lang === "en"
      ? ["Very easy", "Easy", "Normal", "A challenge", "Expert"]
      : ["Muy fácil", "Fácil", "Normal", "Un reto", "Experto"];
    for (var i = 0; i < 5; i++) {
      (function (i) {
        if (i > 0) wrap.appendChild(el("div", "pa34-link"));
        var row = el("div", "pa34-lvlwrap");
        var state = i < u ? "done" : (i === u ? "cur" : "lock");
        var b = el("button", "pa34-lvl " + state, String(i + 1));
        if (state === "lock") { b.innerHTML = String.fromCodePoint(0x1F512); b.disabled = true; }
        else { b.addEventListener("click", function () { launch(g, i); }); }
        if (state === "done") b.appendChild(el("span", "st", String.fromCodePoint(0x2B50)));
        var cap = el("div", "cap", caps[i]);
        if (i % 2 === 0) { row.appendChild(b); row.appendChild(cap); }
        else { row.appendChild(cap); row.appendChild(b); }
        wrap.appendChild(row);
      })(i);
    }
    body.appendChild(wrap);
  }

  /* ---------- superficie de juego ---------- */
  var play = null, P = {}, G = null;
  function ensurePlay() {
    if (play) return;
    play = el("div", "pa60-play");
    play.innerHTML =
      '<div class="pa60-ptop"><button class="pa34-x" id="pa60pX" aria-label="Salir">&times;</button>' +
      '<div class="pa60-prompt" id="pa60prompt"></div>' +
      '<div class="pa60-pstar">' + String.fromCodePoint(0x2B50) + ' <span id="pa60score">0</span></div></div>' +
      '<div class="pa60-field" id="pa60field"></div>' +
      '<div class="pa60-pbot"><div class="pa60-prog" id="pa60prog"></div>' +
      '<button class="pa60-cta" id="pa60replay" aria-label="Repetir">🔁</button></div>' +
      '<div class="pa60-win" id="pa60win"><div class="pa60-wc">' +
      '<div class="rf">🪥</div>' +
      '<h2 id="pa60wt"></h2><p id="pa60wp"></p>' +
      '<div class="row"><button class="pa60-cta ghost" id="pa60wmap"></button>' +
      '<button class="pa60-cta" id="pa60wnext"></button></div></div></div>';
    d.body.appendChild(play);
    P = {
      field: d.getElementById("pa60field"), prompt: d.getElementById("pa60prompt"),
      prog: d.getElementById("pa60prog"), score: d.getElementById("pa60score"),
      win: d.getElementById("pa60win"), wt: d.getElementById("pa60wt"),
      wp: d.getElementById("pa60wp"), wnext: d.getElementById("pa60wnext"),
      wmap: d.getElementById("pa60wmap"), replay: d.getElementById("pa60replay")
    };
    d.getElementById("pa60pX").addEventListener("click", exitPlay);
    P.replay.addEventListener("click", function () {
      if (!G) return;
      if (typeof G.replay === "function") G.replay();
      else if (G.prompt) say(G.prompt);
    });
    P.wmap.addEventListener("click", function () { exitPlay(); if (G && G.g) openLevels(G.g); });
    P.wnext.addEventListener("click", function () {
      var nx = G.level + 1;
      if (nx < 5) { launch(G.g, nx); } else { exitPlay(); openLevels(G.g); }
    });
  }
  function exitPlay() {
    if (play) play.classList.remove("show");
    if (P.win) P.win.classList.remove("show");
  }
  function openPlay() { ensurePlay(); play.classList.add("show"); P.win.classList.remove("show"); }

  function setPrompt(txt, speakIt) {
    G.prompt = txt;
    P.prompt.textContent = txt;
    if (speakIt !== false) say(txt);
  }
  function setProg() {
    P.prog.innerHTML = "";
    for (var i = 0; i < G.total; i++) P.prog.appendChild(el("i", i < G.done ? "on" : null));
  }
  function good(node) {
    if (node) { node.classList.remove("pa60-reveal"); node.classList.add("pa60-ok"); }
    G.score++; P.score.textContent = G.score;
    // Economía de premios unificada con el modelo base (auditoría #8): cada
    // acierto suena, brilla en confeti y suma estrella, igual que un acierto
    // en matemáticas/letras/animales. chime()/confetti() son globales de
    // app.js (funciones de nivel superior en un script clásico), así que se
    // llaman directo sin reimplementarlas aquí.
    try { if (typeof window.chime === "function") window.chime("ok"); } catch (e) {}
    try { if (typeof window.confetti === "function") window.confetti(); } catch (e) {}
    star();
  }
  /* ---------- pista progresiva ----------
     Mismo contrato de dos pasos que onWrong() en app.js (1a falla: pista
     suave; 2a falla: brillo + narración de la respuesta), reimplementado
     localmente porque S/onWrong de app.js no son alcanzables desde aquí. */
  function resetHint(node) {
    if (G && G.hintNode) G.hintNode.classList.remove("pa60-reveal");
    G.attempts = 0; G.revealed = false; G.hintNode = node || null;
  }
  function bad(node, hintFn) {
    if (!node) return;
    node.classList.add("pa60-no");
    setTimeout(function () { node.classList.remove("pa60-no"); }, 480);
    if (!guideOn()) return;
    G.attempts = (G.attempts || 0) + 1;
    if (G.attempts === 1) { if (hintFn) hintFn(1); }
    else if (G.attempts >= 2 && G.hintNode && !G.revealed) {
      G.revealed = true;
      G.hintNode.classList.add("pa60-reveal");
      if (hintFn) hintFn(3);
    }
  }
  function labelHint(labelEs, labelEn) {
    return function (lvl) {
      if (lvl === 1) say(T(labelEs, labelEn));
      else if (lvl === 3) say(T(labelEs + ". Toca el que brilla.", labelEn + ". Tap the glowing one."));
    };
  }
  function stepDone() {
    G.done++; setProg();
    var mine = G;
    if (G.done >= G.total) setTimeout(function () { if (G === mine) winLevel(); }, 640);
  }
  function winLevel() {
    setUnlocked(G.g.id, Math.min(4, G.level + 1));
    // La estrella ya se da por acierto en good() (economía unificada, #8):
    // el nivel solo desbloquea el siguiente, no regala una estrella extra,
    // igual que finishGame() en app.js no premia dos veces.
    P.wt.textContent = T("¡Muy bien!", "Great job!");
    P.wp.textContent = G.level < 4
      ? T("Completaste el nivel " + (G.level + 1), "You finished level " + (G.level + 1))
      : T("¡Terminaste todos los niveles!", "You finished every level!");
    P.wmap.textContent = T("Mapa", "Map");
    P.wnext.textContent = G.level < 4 ? T("Siguiente", "Next") : T("Mapa", "Map");
    P.win.classList.add("show");
    say(T("¡Muy bien!", "Great job!"));
  }

  function launch(g, level) {
    detectLang();
    closeOv();
    openPlay();
    G = { g: g, level: level, score: 0, done: 0, total: 0, prompt: "", replay: null, busy: false };
    P.score.textContent = "0";
    P.field.innerHTML = "";
    P.replay.style.display = "";
    if (g.kind === "steps") roundSteps();
    else if (g.kind === "need") roundNeed();
    else if (g.kind === "place") roundPlace();
    else roundDay();
  }

  /* Cada ronda vive dentro de una partida concreta. Como hay esperas de
     medio segundo entre acierto y acierto, una partida que se abandona en
     ese hueco podría repintar el campo de la siguiente: se compara contra
     la partida en curso y, si ya no es la suya, la espera no hace nada. */
  function stale(mine) { return G !== mine; }

  /* ---------- ficha de objeto reutilizable ---------- */
  function objCard(cls, id, label, onPick) {
    var b = el("button", "pa60-item " + (cls || ""));
    b.setAttribute("data-obj", id);
    b.innerHTML = objSvg(id) + (label ? '<span class="nm">' + label + "</span>" : "");
    if (onPick) b.addEventListener("click", function () { onPick(b); });
    return b;
  }

  /* ===== 1 · Paso a paso =====
     Se muestran los pasos barajados y hay que tocarlos EN ORDEN. El paso
     acertado se queda con su número y ya no se puede volver a tocar: el
     rastro de números es la respuesta construyéndose a la vista, que es lo
     que convierte el juego en memoria de la rutina y no en adivinanza.
     Un error no borra nada — deshacer el progreso a esta edad se lee como
     castigo y hace que el niño deje de probar. */
  function roundSteps() {
    var mine = G;
    var lv = G.level;
    var pool = lv <= 1 ? ROUT3 : (lv === 2 ? ROUT3.concat(ROUT4) : ROUT4);
    var rounds = lv <= 1 ? 2 : 3;
    G.total = rounds;
    G.done = 0; setProg();
    var order = sample(pool, Math.min(rounds, pool.length));
    while (order.length < rounds) order.push(pool[rnd(pool.length)]);
    var idx = 0;

    function play1() {
      P.field.innerHTML = "";
      var r = order[idx];
      setPrompt(T("Ordena: ", "Put in order: ") + routName(r));
      G.replay = function () { say(T("Ordena: ", "Put in order: ") + routName(r)); };
      var next = 0;
      var row = el("div", "pa60-steps");
      var nodeByIdx = [];
      var stepsHint = function (lvl) {
        if (lvl === 1) say(T("Toca el paso " + (next + 1), "Tap step " + (next + 1)));
        else if (lvl === 3) say(T(stepTxt(r.steps[next]) + ". Toca el que brilla.", stepTxt(r.steps[next]) + ". Tap the glowing one."));
      };
      shuffle(r.steps).forEach(function (s) {
        var b = objCard("step", s.o, stepTxt(s), function (node) {
          if (stale(mine) || G.busy || node.classList.contains("pa60-ok")) return;
          if (r.steps[next] === s) {
            good(node);
            node.appendChild(el("span", "num", String(next + 1)));
            next++;
            say(stepTxt(s));
            if (next >= r.steps.length) {
              G.busy = true;
              setTimeout(function () {
                if (stale(mine)) return;
                G.busy = false;
                stepDone();
                idx++;
                if (idx < order.length && G.done < G.total) play1();
              }, 700);
            } else {
              resetHint(nodeByIdx[next]);
            }
          } else { bad(node, stepsHint); }
        });
        nodeByIdx[r.steps.indexOf(s)] = b;
        row.appendChild(b);
      });
      P.field.appendChild(row);
      resetHint(nodeByIdx[next]);
    }
    play1();
  }

  /* ===== 2 · ¿Qué necesito? =====
     Sube el número de opciones antes que el de rondas: lo difícil no es
     ver más objetos, es descartar entre objetos del mismo sitio (el peine
     y el cepillo de dientes viven los dos en el baño). */
  function roundNeed() {
    var mine = G;
    var lv = G.level;
    var opts = lv === 0 ? 2 : (lv <= 2 ? 3 : 4);
    var rounds = lv <= 1 ? 4 : (lv <= 3 ? 5 : 6);
    G.total = rounds; G.done = 0; setProg();
    var queue = sample(NEED, rounds);
    var idx = 0;

    function play1() {
      P.field.innerHTML = "";
      var n = queue[idx];
      setPrompt(needTxt(n) + "…");
      G.replay = function () { say(needTxt(n)); };
      var others = NEED.filter(function (x) { return x.o !== n.o; });
      var choices = shuffle(sample(others, opts - 1).map(function (x) { return x.o; }).concat([n.o]));
      var row = el("div", "pa60-choices");
      var targetNode = null;
      var hint = labelHint(needTxt(n), needTxt(n));
      choices.forEach(function (oid) {
        var b = objCard("choice", oid, null, function (node) {
          if (stale(mine) || G.busy) return;
          if (oid === n.o) {
            G.busy = true; good(node); say(needTxt(n));
            setTimeout(function () {
              if (stale(mine)) return;
              G.busy = false; stepDone(); idx++;
              if (idx < queue.length && G.done < G.total) play1();
            }, 640);
          } else { bad(node, hint); }
        });
        if (oid === n.o) targetNode = b;
        row.appendChild(b);
      });
      P.field.appendChild(row);
      resetHint(targetNode);
    }
    play1();
  }

  /* ===== 3 · ¿Dónde va? =====
     El objeto está arriba y los destinos abajo. Los destinos son nodos
     propios y estables, así que la capa de gesto de #56 los toma como
     diana sin que haya que añadirle nada al DOM. */
  function roundPlace() {
    var mine = G;
    var lv = G.level;
    var nbins = lv <= 1 ? 2 : (lv === 2 ? 3 : 4);
    var rounds = lv <= 1 ? 4 : (lv <= 3 ? 5 : 6);
    G.total = rounds; G.done = 0; setProg();
    var bins = BINS.slice(0, nbins);
    var pool = [];
    bins.forEach(function (b) { b.items.forEach(function (it) { pool.push({ o: it, bin: b.id }); }); });
    var queue = shuffle(pool);
    while (queue.length < rounds) queue = queue.concat(shuffle(pool));
    queue = queue.slice(0, rounds);
    var idx = 0;

    var binRow = el("div", "pa60-bins");
    bins.forEach(function (b) {
      var t = el("button", "pa60-bin");
      t.setAttribute("data-bin", b.id);
      t.innerHTML = objSvg(b.o) + '<span class="nm">' + binName(b) + "</span>";
      t.addEventListener("click", function () { pick(b, t); });
      binRow.appendChild(t);
    });

    var holder = el("div", "pa60-hold");

    function play1() {
      holder.innerHTML = "";
      var q = queue[idx];
      setPrompt(T("¿Dónde va?", "Where does it go?"));
      G.replay = function () { say(T("¿Dónde va?", "Where does it go?")); };
      var it = objCard("hold", q.o, null, null);
      it.setAttribute("data-answer", q.bin);
      holder.appendChild(it);
      var targetNode = null;
      bins.forEach(function (b) {
        var n = binRow.querySelector('[data-bin="' + b.id + '"]');
        if (n) { n.classList.remove("pa60-ok"); if (b.id === q.bin) targetNode = n; }
      });
      var target = bins.filter(function (b) { return b.id === q.bin; })[0];
      G.placeHint = target ? labelHint(binName(target), binName(target)) : null;
      resetHint(targetNode);
    }
    function pick(b, node) {
      if (stale(mine) || G.busy) return;
      var it = holder.querySelector(".pa60-item");
      if (!it) return;
      if (it.getAttribute("data-answer") === b.id) {
        G.busy = true; good(node); say(binName(b));
        setTimeout(function () {
          if (stale(mine)) return;
          G.busy = false; stepDone(); idx++;
          if (idx < queue.length && G.done < G.total) play1();
        }, 620);
      } else { bad(node, G.placeHint); }
    }

    P.field.appendChild(holder);
    P.field.appendChild(binRow);
    play1();
  }

  /* ===== 4 · Mi día =====
     Mismo esqueleto que "¿Dónde va?" a propósito: la mecánica ya está
     aprendida del juego anterior y así el niño gasta la atención en el
     contenido nuevo (el momento del día) y no en entender qué se espera
     de él. En los dos primeros niveles solo mañana y noche, que son las
     que tienen ancla física; la tarde entra después. */
  function roundDay() {
    var mine = G;
    var lv = G.level;
    var slots = lv <= 1 ? [DAY[0], DAY[2]] : DAY;
    var rounds = lv <= 1 ? 4 : (lv <= 3 ? 5 : 6);
    G.total = rounds; G.done = 0; setProg();
    var pool = [];
    slots.forEach(function (s) { s.acts.forEach(function (a) { pool.push({ a: a, slot: s.id }); }); });
    var queue = shuffle(pool);
    while (queue.length < rounds) queue = queue.concat(shuffle(pool));
    queue = queue.slice(0, rounds);
    var idx = 0;

    var binRow = el("div", "pa60-bins");
    slots.forEach(function (s) {
      var t = el("button", "pa60-bin pa60-when");
      t.setAttribute("data-when", s.id);
      t.innerHTML = objSvg(s.o) + '<span class="nm">' + dayName(s) + "</span>";
      t.addEventListener("click", function () { pick(s, t); });
      binRow.appendChild(t);
    });
    var holder = el("div", "pa60-hold");

    function play1() {
      holder.innerHTML = "";
      var q = queue[idx];
      setPrompt(T("¿Cuándo? ", "When? ") + stepTxt(q.a));
      G.replay = function () { say(T("¿Cuándo? ", "When? ") + stepTxt(q.a)); };
      var it = objCard("hold", q.a.o, stepTxt(q.a), null);
      it.setAttribute("data-answer", q.slot);
      holder.appendChild(it);
      var targetNode = null;
      slots.forEach(function (s) {
        var n = binRow.querySelector('[data-when="' + s.id + '"]');
        if (n) { n.classList.remove("pa60-ok"); if (s.id === q.slot) targetNode = n; }
      });
      var target = slots.filter(function (s) { return s.id === q.slot; })[0];
      G.dayHint = target ? labelHint(dayName(target), dayName(target)) : null;
      resetHint(targetNode);
    }
    function pick(s, node) {
      if (stale(mine) || G.busy) return;
      var it = holder.querySelector(".pa60-item");
      if (!it) return;
      if (it.getAttribute("data-answer") === s.id) {
        G.busy = true; good(node); say(dayName(s));
        setTimeout(function () {
          if (stale(mine)) return;
          G.busy = false; stepDone(); idx++;
          if (idx < queue.length && G.done < G.total) play1();
        }, 620);
      } else { bad(node, G.dayHint); }
    }

    P.field.appendChild(holder);
    P.field.appendChild(binRow);
    play1();
  }

  /* ---------- arranque ---------- */
  function boot() {
    detectLang();
    ensureCard();
    var lb = d.getElementById("langBtn");
    if (lb && !lb.__pa60) {
      lb.__pa60 = true;
      lb.addEventListener("click", function () { setTimeout(function () { detectLang(); paintCard(); if (ov && ov.classList.contains("show")) openGames(); }, 60); });
    }
    /* app.js puede repintar el home; si la casa desaparece, se repone. */
    var host = d.getElementById("home");
    if (host) new MutationObserver(function () { ensureCard(); }).observe(host, { childList: true, subtree: true });
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ---------- API pública (tests e integración) ---------- */
  window.pa60 = {
    open: function () { detectLang(); openGames(); },
    play: function (kind, level) {
      var g = GAMES.filter(function (x) { return x.kind === kind; })[0] || GAMES[0];
      launch(g, level || 0);
      return g.id;
    },
    objects: function () { return Object.keys(SH); },
    games: function () { return GAMES.map(function (g) { return g.id; }); },
    reset: function () { try { localStorage.removeItem(PKEY()); } catch (e) {} paintCard(); }
  };
})();
