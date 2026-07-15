"use strict";
/* ==================== Secuenciación inteligente (Fase 4 · mejora #7) ====================
   Objetivo: priorizar ítems "a reforzar" en la SELECCIÓN DE RONDAS del juego principal
   (no es una pantalla aparte: reemplaza, de forma intercalada, el objetivo aleatorio de
   una ronda normal por el ítem que más le cuesta al perfil actual).

   Cómo decide qué es "a reforzar" (100% derivado de profile.ev[], sin esquema nuevo):
     - Agrupa los eventos del perfil por clave de ítem (mismo formato que logRound ya usa:
       'math-N', 'math-sub-N', 'read-L', 'sci-<hab>', 'sci-diet-<dieta>'). 'math-cmp' queda
       fuera a propósito: esa clave no guarda qué par de números se comparó, así que no hay
       forma de "forzar" la misma ronda otra vez con esa clave.
     - Para cada clave mira sólo sus últimas 6 apariciones (ventana reciente: si el peque ya
       domina algo que antes le costaba, deja de reforzarse solo, sin tocar profile.ev).
     - "A reforzar" = al menos 2 puntos de dificultad recientes (intentos extra + pistas
       reveladas) Y menos del 50% de aciertos a la primera en esa ventana. Umbral deliberadamente
       alto para no disparar con un único tropiezo aislado (evita falsos positivos en sesiones
       cortas de prueba/demo).

   Cómo interviene en la selección (aditivo, sin tocar funciones existentes):
     - Envuelve window.nextRound por reasignación (mismo mecanismo que ya usan AudioBank,
       Estrategia bilingüe y Modo guiado padre-hijo en este archivo). Guarda la referencia
       previa (_nextRound) y SIEMPRE cae en ella cuando no aplica refuerzo: perfiles nuevos,
       función desactivada, o sin ítems "a reforzar" ⇒ comportamiento 100% idéntico al original.
     - Cuando sí aplica (cada SEQ_CADENCE rondas, nunca en la ronda 0), en vez de delegar en la
       función original hace el mismo trabajo previo que nextRound() (renderProgress, reset de
       S.attempts/S.revealed/S.roundLogged/S.roundStart) y llama a una función NUEVA
       (roundXReinforce) que renderiza la MISMA UI que la ronda normal (mismas clases .choice/
       .obj, mismo setPrompt/afterCorrect/onWrong) pero con el objetivo forzado al ítem débil en
       vez de aleatorio. No se reescribe ninguna función roundMath / roundReading / roundScience
       original; son duplicados mínimos y deliberados porque el objetivo se decide con rnd() dentro del
       cuerpo de esas funciones y no hay forma de inyectarlo desde fuera sin tocarlas.
     - Si el ítem débil no se puede reconstruir en el idioma/estado actual (p.ej. una letra que
       no existe en el set del idioma activo), la función de refuerzo devuelve false y el wrapper
       cae automáticamente en la ronda normal (_nextRound()). Nunca deja el juego sin ronda.

   Ajuste del adulto: toggle "Refuerzo inteligente" en Ajustes (ON por defecto), persistido en
   DB.settings.seqReinforce — mismo patrón que DB.settings.session / DB.settings.coplay.

   Compat con Estrategia bilingüe (si ambas mejoras están integradas): cuando el modo de idioma
   por perfil es 'alternate', el nextRound original de esa mejora alterna S.lang según S.round.
   Como este wrapper puede evitar llamar a esa cadena cuando renderiza un refuerzo, replica el
   mismo cálculo de idioma (usando el S.bilBase y window.bilMode ya expuestos por esa mejora) para
   no dejar el idioma "atascado" en la ronda de refuerzo. Es un no-op si esa mejora no está.

   Bajo file:// no se abre red en ningún punto (sólo DOM/localStorage, igual que el resto de la app).
   Animaciones nuevas (badge) sólo transform/opacity y respetan prefers-reduced-motion. ============ */
(function(){
  "use strict";
  if (typeof window === 'undefined') return;
  if (window.__seqWrapped) return; // idempotente: evita doble envoltura si el script se carga dos veces

  /* ---------- i18n aditivo (no toca los literales UI.es/UI.en originales) ---------- */
  if (typeof UI === 'object' && UI && UI.es && UI.en) {
    Object.assign(UI.es, {
      setSeqN: 'Refuerzo inteligente',
      setSeqD: 'Repite, de vez en cuando, lo que a tu peque le cuesta más',
      seqBadge: 'A repasar'
    });
    Object.assign(UI.en, {
      setSeqN: 'Smart reinforcement',
      setSeqD: 'Every so often, repeats what your child finds hardest',
      seqBadge: 'Review'
    });
  }

  /* ---------- config: cada cuántas rondas se evalúa el refuerzo (nunca en la ronda 0) ---------- */
  var SEQ_CADENCE = 2; // rondas índice 2, 4, 6... (con totalRounds=5 ⇒ 2 oportunidades por sesión)
  var SEQ_WINDOW = 6;      // últimas N apariciones de una clave que se consideran "recientes"
  var SEQ_MIN_SCORE = 2;   // mínimo de "puntos de dificultad" recientes para calificar de "a reforzar"
  var SEQ_MAX_FIRSTTRY = 0.5; // umbral de tasa de aciertos a la 1ª por debajo del cual sigue "a reforzar"

  /* ---------- ajuste persistido (DB.settings.seqReinforce, ON por defecto) ---------- */
  function seqCfg(){
    if (typeof DB !== 'object' || !DB) return { seqReinforce: true };
    if (!DB.settings) DB.settings = {};
    if (typeof DB.settings.seqReinforce !== 'boolean') DB.settings.seqReinforce = true; // default ON
    return DB.settings;
  }
  function seqEnabled(){ return !!seqCfg().seqReinforce; }

  /* ---------- claves que esta mejora sabe reconstruir (excluye 'math-cmp' a propósito) ---------- */
  function seqReinforceable(k){
    if (!k) return false;
    if (k === 'math-cmp') return false;
    if (k.indexOf('math-') === 0) return true;
    if (k.indexOf('read-') === 0) return true;
    if (k.indexOf('sci-') === 0) return true; // cubre 'sci-<hab>' y 'sci-diet-<dieta>'
    return false;
  }

  /* ---------- deriva la cola de "a reforzar" a partir de profile.ev[] (sin estado nuevo) ---------- */
  function seqWeakItems(game){
    var p = (typeof currentProfile === 'function') ? currentProfile() : null;
    if (!p || !p.ev || !p.ev.length) return [];
    var byKey = {};
    p.ev.forEach(function(e){
      if (e.g !== game || !seqReinforceable(e.k)) return;
      (byKey[e.k] = byKey[e.k] || []).push(e);
    });
    var out = [];
    Object.keys(byKey).forEach(function(k){
      var arr = byKey[k].slice(-SEQ_WINDOW);
      var total = arr.length; if (!total) return;
      var score = 0, firstTries = 0;
      arr.forEach(function(e){ score += Math.max(0, (e.at || 1) - 1) + (e.as ? 1 : 0); if (e.ft) firstTries++; });
      var firstRate = firstTries / total;
      if (score >= SEQ_MIN_SCORE && firstRate < SEQ_MAX_FIRSTTRY) {
        out.push({ k: k, score: score, firstRate: firstRate, lastMs: arr[arr.length - 1].ms || 0 });
      }
    });
    out.sort(function(a, b){ return (b.score - a.score) || (a.firstRate - b.firstRate); });
    return out;
  }

  /* ---------- elige la clave a reforzar, evitando repetir la última mostrada si hay otra opción ---------- */
  function seqPickWeak(game){
    var items = seqWeakItems(game);
    if (!items.length) return null;
    var avoid = S.seqLastKey;
    for (var i = 0; i < items.length; i++) { if (items[i].k !== avoid) return items[i].k; }
    return items[0].k;
  }

  function seqClamp(n, lo, hi){ n = parseInt(n, 10); if (isNaN(n)) return lo; return Math.max(lo, Math.min(hi, n)); }

  /* ==================== badge visual "A repasar" (no bloquea, sólo informa al adulto) ==================== */
  var seqBadgeEl = null;
  function seqBuildBadge(){
    if (seqBadgeEl && document.body.contains(seqBadgeEl)) return seqBadgeEl;
    var prompt = document.querySelector('.prompt'); if (!prompt) return null;
    seqBadgeEl = document.createElement('span');
    seqBadgeEl.id = 'seqBadge'; seqBadgeEl.className = 'seqBadge'; seqBadgeEl.setAttribute('aria-hidden', 'true');
    prompt.appendChild(seqBadgeEl);
    return seqBadgeEl;
  }
  function seqShowBadge(){
    var b = seqBuildBadge(); if (!b) return;
    var t = UI[S.lang] || {};
    b.textContent = '🔁 ' + (t.seqBadge || 'A repasar');
    b.classList.add('show');
  }
  function seqHideBadge(){ if (seqBadgeEl) seqBadgeEl.classList.remove('show'); }

  /* ==================== compat opcional con Estrategia bilingüe (modo 'alternate') ==================== */
  function seqSyncBilingualAlternate(){
    try{
      if (typeof window.bilMode !== 'function') return; // esa mejora no está integrada: no-op
      if (window.bilMode() !== 'alternate' || !S.bilBase) return;
      var other = S.bilBase === 'es' ? 'en' : 'es';
      var tgt = (S.round % 2 === 0) ? S.bilBase : other;
      if (S.lang !== tgt) {
        S.lang = tgt;
        document.documentElement.lang = S.lang;
        var es = $('lgES'), en = $('lgEN');
        if (es) es.className = S.lang === 'es' ? 'on' : 'off';
        if (en) en.className = S.lang === 'en' ? 'on' : 'off';
      }
    }catch(e){}
  }

  /* ==================== rondas de refuerzo (misma UI, objetivo forzado) ==================== */

  function roundMathCountReinforce(count){
    count = seqClamp(count, 1, 9);
    var emoji = MATH_OBJ[rnd(MATH_OBJ.length)];
    var stage = $('stage'); stage.innerHTML = '';
    var box = document.createElement('div'); box.className = 'countbox'; var tapped = 0;
    for (var i = 0; i < count; i++) {
      var o = document.createElement('div'); o.className = 'obj'; o.textContent = emoji; o.style.animationDelay = (i * 70) + 'ms';
      o.onclick = (function(){ return function(){
        if (o.classList.contains('counted')) return; o.classList.add('counted'); tapped++;
        var n = (S.lang === 'es' ? NUM_ES : NUM_EN)[tapped] || String(tapped); speak(n, { rate: 0.95 }); chime('ok');
      }; })();
      box.appendChild(o);
    }
    stage.appendChild(box);
    var wrongPool = []; for (var n = 1; n <= 9; n++) if (n !== count) wrongPool.push(n);
    var opts = shuffle([count].concat(sample(wrongPool, 2)));
    var ch = document.createElement('div'); ch.className = 'choices'; S.correctBtn = null;
    opts.forEach(function(n){
      var b = document.createElement('button'); b.className = 'choice'; b.innerHTML = '<span class="cnum">' + n + '</span>';
      if (n === count) S.correctBtn = b;
      b.onclick = function(){
        if (n === count) {
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          var nm = (S.lang === 'es' ? NUM_ES : NUM_EN)[count];
          speakSeq([{ t: (S.lang === 'es' ? ('¡Sí! Hay ' + nm + '.') : ('Yes! There are ' + nm + '.')) }, { t: (S.lang === 'es' ? '¡Muy bien!' : 'Great job!') }]);
          confetti(); afterCorrect('math-' + count);
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) speak(S.lang === 'es' ? 'Cuéntalos otra vez, toca cada uno.' : 'Count again, tap each one.');
            else if (lvl === 3) speak(S.lang === 'es' ? ('Mira, son ' + ((S.lang === 'es' ? NUM_ES : NUM_EN)[count]) + '. Toca el número que brilla.') : ('Look, it is ' + ((S.lang === 'es' ? NUM_ES : NUM_EN)[count]) + '. Tap the glowing number.'));
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q = S.lang === 'es' ? '¿Cuántos hay? Toca para contar.' : 'How many are there? Tap to count.';
    setPrompt(q, function(){ speak(q); }); speak(q);
    seqShowBadge();
    return true;
  }

  function roundMathSubitizeReinforce(count){
    count = seqClamp(count, 2, 6);
    var t = UI[S.lang];
    var emoji = MATH_OBJ[rnd(MATH_OBJ.length)];
    var nWord = function(n){ return (S.lang === 'es' ? NUM_ES : NUM_EN)[n] || String(n); };
    var stage = $('stage'); stage.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'subitizeWrap';
    var box = document.createElement('div'); box.className = 'countbox';
    for (var i = 0; i < count; i++) { var o = document.createElement('div'); o.className = 'obj'; o.textContent = emoji; o.style.animationDelay = (i * 60) + 'ms'; box.appendChild(o); }
    wrap.appendChild(box);
    var veil = document.createElement('div'); veil.className = 'veil'; veil.textContent = '👀'; veil.setAttribute('aria-hidden', 'true');
    wrap.appendChild(veil);
    stage.appendChild(wrap);
    var flashTimer = null;
    function peek(){ clearTimeout(flashTimer); wrap.classList.remove('veiled'); flashTimer = setTimeout(function(){ wrap.classList.add('veiled'); }, 1200); }
    veil.onclick = peek;
    var wrongPool = []; for (var n = 2; n <= 6; n++) if (n !== count) wrongPool.push(n);
    var opts = shuffle([count].concat(sample(wrongPool, 2)));
    var ch = document.createElement('div'); ch.className = 'choices'; S.correctBtn = null;
    opts.forEach(function(n){
      var b = document.createElement('button'); b.className = 'choice'; b.innerHTML = '<span class="cnum">' + n + '</span>';
      if (n === count) S.correctBtn = b;
      b.onclick = function(){
        if (n === count) {
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([{ t: t.mSubYes + ' ' + nWord(count) + '.' }, { t: t.mGreat }]);
          confetti(); afterCorrect('math-sub-' + count);
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) { peek(); speak(t.mLookAgain); }
            else if (lvl === 3) { peek(); speak(t.mItWas + ' ' + nWord(count) + '. ' + t.mTapGlow); }
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q = t.mSubQ;
    setPrompt(q, function(){ peek(); speak(q); });
    peek(); speak(q);
    seqShowBadge();
    return true;
  }

  function roundReadingReinforce(letter){
    var set = LETTERS[S.lang];
    var target = set.filter(function(x){ return x.L === letter; })[0];
    if (!target) return false; // la letra no existe en el idioma activo: dejar caer a la ronda normal
    var others = sample(set.filter(function(x){ return x.L !== target.L; }), 2);
    var opts = shuffle([target].concat(others));
    var stage = $('stage'); stage.innerHTML = '';
    var tile = document.createElement('div'); tile.className = 'lettertile'; tile.textContent = target.L; stage.appendChild(tile);
    var ch = document.createElement('div'); ch.className = 'choices'; S.correctBtn = null;
    opts.forEach(function(o){
      var b = document.createElement('button'); b.className = 'choice'; b.innerHTML = '<span class="cface">' + o.emoji + '</span>';
      if (o.L === target.L) S.correctBtn = b;
      b.onclick = function(){
        if (o.L === target.L) {
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([{ t: (S.lang === 'es' ? ('¡Sí! ' + target.word + ' empieza con ' + target.L + '.') : ('Yes! ' + target.word + ' starts with ' + target.L + '.')) }, { t: target.sound + '... ' + target.word, rate: 0.8 }]);
          confetti(); afterCorrect('read-' + target.L);
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) speak(S.lang === 'es' ? ('Escucha: ' + target.sound + '. ¿Cuál empieza así?') : ('Listen: ' + target.sound + '. Which starts like that?'));
            else if (lvl === 3) speakSeq([{ t: (S.lang === 'es' ? ('Es ' + target.word + '.') : ('It is ' + target.word + '.')) }, { t: target.sound, rate: 0.8 }]);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var say = function(){ speakSeq([{ t: (S.lang === 'es' ? ('La letra ' + target.L) : ('The letter ' + target.L)) }, { t: target.sound, rate: 0.8 }, { t: (S.lang === 'es' ? ('¿Qué empieza con ' + target.L + '?') : ('What starts with ' + target.L + '?')) }]); };
    var q = S.lang === 'es' ? ('¿Qué empieza con  ' + target.L + ' ?') : ('What starts with  ' + target.L + ' ?');
    setPrompt(q, say); say();
    seqShowBadge();
    return true;
  }

  function roundScienceReinforce(hab){
    if (!HAB[hab]) return false;
    var pool = ANIMALS.filter(function(a){ return a.hab === hab; });
    if (!pool.length) return false;
    var a = pool[rnd(pool.length)];
    var stage = $('stage'); stage.innerHTML = '';
    var big = document.createElement('div'); big.className = 'animalBig'; big.textContent = a.emoji; stage.appendChild(big);
    var ch = document.createElement('div'); ch.className = 'choices habitats'; S.correctBtn = null;
    ['water', 'land', 'sky'].forEach(function(h){
      var b = document.createElement('button'); b.className = 'choice habitat ' + h; b.innerHTML = '<span class="cface">' + HAB[h].emoji + '</span><span class="clabel">' + HAB[h][S.lang] + '</span>';
      if (h === a.hab) S.correctBtn = b;
      b.onclick = function(){
        if (h === a.hab) {
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          var name = a[S.lang], place = HAB[a.hab][S.lang].toLowerCase();
          speakSeq([{ t: (S.lang === 'es' ? (name + ' vive en ' + (a.hab === 'sky' ? 'el cielo' : a.hab === 'water' ? 'el agua' : 'la tierra') + '.') : ('Yes! ' + name + ' lives in the ' + place + '.')) }, { t: (S.lang === 'es' ? '¡Excelente!' : 'Well done!') }]);
          confetti(); afterCorrect('sci-' + a.hab);
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) speak(S.lang === 'es' ? ('¿Dónde vive ' + a[S.lang].toLowerCase() + '?') : ('Where does ' + a.en.toLowerCase() + ' live?'));
            else if (lvl === 3) speak(S.lang === 'es' ? ('Vive en ' + (a.hab === 'sky' ? 'el cielo' : a.hab === 'water' ? 'el agua' : 'la tierra') + '. Toca el que brilla.') : ('It lives in the ' + HAB[a.hab].en.toLowerCase() + '. Tap the glowing one.'));
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q = S.lang === 'es' ? ('¿Dónde vive ' + a.es.toLowerCase() + '?') : ('Where does ' + a.en.toLowerCase() + ' live?');
    setPrompt(q, function(){ speak(q); }); speak(q);
    seqShowBadge();
    return true;
  }

  function roundScienceDietReinforce(diet){
    if (typeof DIET === 'undefined' || typeof DIET_CAT === 'undefined' || !DIET_CAT[diet]) return false;
    var pool = ANIMALS.filter(function(a){ return DIET[a.emoji] === diet; });
    if (!pool.length) return false;
    var a = pool[rnd(pool.length)];
    var stage = $('stage'); stage.innerHTML = '';
    var big = document.createElement('div'); big.className = 'animalBig'; big.textContent = a.emoji; stage.appendChild(big);
    var ch = document.createElement('div'); ch.className = 'choices diets'; S.correctBtn = null;
    shuffle(['herb', 'carn']).forEach(function(d){
      var b = document.createElement('button'); b.className = 'choice diet ' + d; b.innerHTML = '<span class="cface">' + DIET_CAT[d].emoji + '</span><span class="clabel">' + DIET_CAT[d][S.lang] + '</span>';
      if (d === diet) S.correctBtn = b;
      b.onclick = function(){
        if (d === diet) {
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          var name = a[S.lang]; var eats = S.lang === 'es' ? (d === 'herb' ? 'come plantas.' : 'come carne.') : (d === 'herb' ? 'eats plants.' : 'eats meat.');
          speakSeq([{ t: name + ' ' + eats }, { t: (S.lang === 'es' ? '¡Excelente!' : 'Well done!') }]);
          confetti(); afterCorrect('sci-diet-' + d);
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) speak(S.lang === 'es' ? ('¿Qué come ' + a.es.toLowerCase() + '?') : ('What does ' + a.en.toLowerCase() + ' eat?'));
            else if (lvl === 3) { var hint = S.lang === 'es' ? (diet === 'herb' ? 'Come plantas. Toca la hoja verde.' : 'Come carne. Toca la carne.') : (diet === 'herb' ? 'It eats plants. Tap the green leaf.' : 'It eats meat. Tap the meat.'); speak(hint); }
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q = S.lang === 'es' ? ('¿Qué come ' + a.es.toLowerCase() + '?') : ('What does ' + a.en.toLowerCase() + ' eat?');
    setPrompt(q, function(){ speak(q); }); speak(q);
    seqShowBadge();
    return true;
  }

  /* ---------- dispatcher: parsea la clave y llama a la ronda de refuerzo correspondiente ---------- */
  function renderReinforceRound(game, key){
    try{
      if (game === 'math') {
        if (key.indexOf('math-sub-') === 0) return roundMathSubitizeReinforce(key.slice(9));
        if (key.indexOf('math-') === 0) return roundMathCountReinforce(key.slice(5));
        return false;
      }
      if (game === 'reading') {
        if (key.indexOf('read-') === 0) return roundReadingReinforce(key.slice(5));
        return false;
      }
      if (game === 'science') {
        if (key.indexOf('sci-diet-') === 0) return roundScienceDietReinforce(key.slice(9));
        if (key.indexOf('sci-') === 0) return roundScienceReinforce(key.slice(4));
        return false;
      }
    }catch(e){ return false; }
    return false;
  }

  /* ==================== fila de Ajustes (toggle), creada/cableada de forma idempotente ==================== */
  function seqEnsureRow(){
    var set = $('setView'); if (!set) return;
    var row = $('setSeq');
    if (!row) {
      row = document.createElement('div'); row.className = 'setting'; row.id = 'setSeq';
      row.innerHTML = '<div><div class="name" id="setSeqN"></div><div class="desc" id="setSeqD"></div></div>'
        + '<button class="toggle" id="tgSeq" role="switch"><span class="knob"></span></button>';
      var anchor = $('setSessLimit');
      if (anchor && anchor.parentNode === set) set.insertBefore(row, anchor); else set.appendChild(row);
    }
    var tg = $('tgSeq');
    if (tg && !tg._seqWired) {
      tg._seqWired = true;
      tg.addEventListener('click', function(){
        var c = seqCfg(); c.seqReinforce = !c.seqReinforce;
        if (typeof saveDB === 'function') saveDB();
        seqSyncRow();
      });
    }
    seqApplyLangRow(); seqSyncRow();
  }
  function seqSyncRow(){ var tg = $('tgSeq'); if (tg) { tg.classList.toggle('on', seqEnabled()); tg.setAttribute('aria-checked', String(seqEnabled())); } }
  function seqApplyLangRow(){
    var t = UI[S.lang]; if (!t) return;
    var n = $('setSeqN'), d = $('setSeqD');
    if (n) n.textContent = t.setSeqN || 'Refuerzo inteligente';
    if (d) d.textContent = t.setSeqD || '';
  }

  /* ==================== envoltura de nextRound por reasignación ==================== */
  var _nextRound = window.nextRound;

  window.nextRound = function(){
    try{
      seqHideBadge();
      if (seqEnabled() && S.round > 0 && S.round < S.totalRounds && (S.round % SEQ_CADENCE === 0)) {
        var key = seqPickWeak(S.game);
        if (key) {
          seqSyncBilingualAlternate();
          renderProgress(); S.attempts = 0; S.revealed = false; S.roundLogged = false; S.roundStart = now();
          if (renderReinforceRound(S.game, key)) { S.seqLastKey = key; return; }
          // el ítem no se pudo reconstruir (p.ej. cambio de idioma): cae a la ronda normal debajo
        }
      }
    }catch(e){ /* nunca deja el juego sin ronda: sigue al flujo original */ }
    return _nextRound();
  };

  /* ==================== init: fila de Ajustes + limpieza de badge al salir del juego ==================== */
  function seqInit(){
    seqCfg();
    seqEnsureRow();
    var ts = $('tabSet'); if (ts && !ts._seqWired) { ts._seqWired = true; ts.addEventListener('click', function(){ seqEnsureRow(); }); }
    var lb = $('langBtn'); if (lb && !lb._seqWired) { lb._seqWired = true; lb.addEventListener('click', function(){ seqApplyLangRow(); }); }
    var hb = $('homeBtn'); if (hb) hb.addEventListener('click', seqHideBadge);
    var bb = $('backBtn'); if (bb) bb.addEventListener('click', seqHideBadge);
  }

  /* ---------- hooks públicos para integración/tests (no exponen estado interno sensible) ---------- */
  window.__seq = {
    isOn: seqEnabled,
    enable: function(){ seqCfg().seqReinforce = true; if (typeof saveDB === 'function') saveDB(); seqSyncRow(); },
    disable: function(){ seqCfg().seqReinforce = false; if (typeof saveDB === 'function') saveDB(); seqSyncRow(); },
    weakItems: seqWeakItems,
    pickWeak: seqPickWeak,
    render: renderReinforceRound,
    cadence: SEQ_CADENCE,
    minScore: SEQ_MIN_SCORE,
    isBadgeVisible: function(){ return !!(seqBadgeEl && seqBadgeEl.classList.contains('show')); }
  };

  window.__seqWrapped = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ try{ seqInit(); }catch(e){} });
  else { try{ seqInit(); }catch(e){} }
})();
