/* ==================== FASE 4 · #14 Ciencias avanzada ====================
   Partes del cuerpo · Clima y estaciones · Reciclaje (clasificar residuos).

   100% ADITIVO: no se reescribe ninguna función existente de ship/app.js.
   window.renderScienceRound (el dispatcher hábitat/dieta ya existente de
   Fase 2) se envuelve por REASIGNACIÓN — mismo mecanismo que ya usan
   AudioBank (window.speak/speakSeq), la Estrategia bilingüe
   (window.afterCorrect/nextRound) y 13-lectura-avanzada
   (window.roundReading) al final de app.js. La implementación original
   (alternancia hábitat par / dieta impar vía S.round%2) queda guardada en
   un closure privado y se sigue usando tal cual para el nivel 0 (por
   defecto), así que cualquier perfil nuevo ve exactamente el mismo juego
   de "Animales" de siempre — los 19 tests actuales no se ven afectados,
   incluido el que fuerza `S.round=1; renderScienceRound();` y espera la
   ronda de dieta (`smoke.spec.js`, "la ronda de ciencias de dieta...").

   Progresión por nivel (profile.best.science, 0-index, mismo campo que ya
   usa finishGame() para subir de nivel — no se toca finishGame ni
   MATH_LEVELS): mismo patrón de "pool de tipos de ronda" que ya usan
   pickMathRound() (Fase 2) y pickReadingRound() (#13 lectura-avanzada).
     - nivel 1 (best.science===0): solo 'classic'  (hábitat/dieta, idéntico a hoy)
     - nivel 2 (best.science>=1):  + 'body'          (partes del cuerpo)
                                    + 'weather'        (clima → estación)
     - nivel 3 (best.science>=2):  + 'recycle'        (reciclaje: clasificar residuos)
   El pool crece pero nunca deja de incluir 'classic'; a mayor nivel, más
   variedad, nunca menos.

   Motor reutilizado sin cambios: $, rnd, shuffle, sample, chime, speak,
   speakSeq, confetti, onWrong, afterCorrect, setPrompt, currentProfile,
   S, UI, eduEsc. Claves de log nuevas: 'sci-body-<id>', 'sci-season-<id>',
   'sci-bin-<id>' (mismo prefijo 'sci-' que ya usa hábitat/dieta, así que
   aggregate()/byGame.science las cuenta automáticamente sin cambios).
   ========================================================================= */
(function(){
  "use strict";

  if (typeof window === 'undefined' || typeof UI === 'undefined' || typeof $ !== 'function') return;

  /* ---------- i18n aditivo (Object.assign, nunca sobreescribe claves existentes) ---------- */
  Object.assign(UI.es, {
    sciBodyQPrefix: 'Toca:',
    sciBodyYes: '¡Sí! Es',
    sciBodyHint: 'Escucha otra vez y busca esa parte del cuerpo.',
    sciSeasonQ: '¿A qué estación pertenece esto?',
    sciSeasonYes: '¡Sí! Es',
    sciSeasonHint: 'Fíjate bien: ¿hace calor, frío, llueve o caen las hojas?',
    sciBinQ: '¿A qué bote de reciclaje va esto?',
    sciBinYes: '¡Sí! Va al bote de',
    sciBinHint: 'Piensa: ¿es comida, papel o plástico?'
  });
  Object.assign(UI.en, {
    sciBodyQPrefix: 'Touch:',
    sciBodyYes: 'Yes! It is',
    sciBodyHint: 'Listen again and find that body part.',
    sciSeasonQ: 'Which season does this belong to?',
    sciSeasonYes: 'Yes! It is',
    sciSeasonHint: 'Think about it: is it hot, cold, rainy, or are the leaves falling?',
    sciBinQ: 'Which recycling bin does this go in?',
    sciBinYes: 'Yes! It goes in the',
    sciBinHint: 'Think: is it food, paper, or plastic?'
  });

  /* ---------- contenido: partes del cuerpo ---------- */
  var BODY_PARTS = [
    { id:'eye',   emoji:'👁️', es:'El ojo',    en:'The eye' },
    { id:'ear',   emoji:'👂', es:'La oreja',  en:'The ear' },
    { id:'nose',  emoji:'👃', es:'La nariz',  en:'The nose' },
    { id:'mouth', emoji:'👄', es:'La boca',   en:'The mouth' },
    { id:'hand',  emoji:'✋', es:'La mano',   en:'The hand' },
    { id:'foot',  emoji:'🦶', es:'El pie',    en:'The foot' },
    { id:'leg',   emoji:'🦵', es:'La pierna', en:'The leg' },
    { id:'arm',   emoji:'💪', es:'El brazo',  en:'The arm' }
  ];

  /* ---------- contenido: clima → estación ---------- */
  var SEASONS = {
    spring: { emoji:'🌸', es:'Primavera', en:'Spring' },
    summer: { emoji:'☀️', es:'Verano',    en:'Summer' },
    autumn: { emoji:'🍂', es:'Otoño',     en:'Fall' },
    winter: { emoji:'❄️', es:'Invierno',  en:'Winter' }
  };
  var SEASON_ORDER = ['spring','summer','autumn','winter'];
  var WEATHER_ITEMS = [
    { emoji:'☀️', season:'summer' },
    { emoji:'🌻', season:'summer' },
    { emoji:'🏖️', season:'summer' },
    { emoji:'🌧️', season:'spring' },
    { emoji:'🌈', season:'spring' },
    { emoji:'🌷', season:'spring' },
    { emoji:'🍂', season:'autumn' },
    { emoji:'🎃', season:'autumn' },
    { emoji:'🍁', season:'autumn' },
    { emoji:'❄️', season:'winter' },
    { emoji:'⛄', season:'winter' },
    { emoji:'🧣', season:'winter' }
  ];

  /* ---------- contenido: reciclaje (clasificar residuos) ---------- */
  var BINS = {
    organic: { emoji:'🌱', es:'Orgánico', en:'Organic' },
    paper:   { emoji:'📦', es:'Papel',    en:'Paper' },
    plastic: { emoji:'♻️', es:'Plástico', en:'Plastic' }
  };
  var BIN_ORDER = ['organic','paper','plastic'];
  var WASTE_ITEMS = [
    { emoji:'🍌', bin:'organic' },
    { emoji:'🍎', bin:'organic' },
    { emoji:'🥕', bin:'organic' },
    { emoji:'📰', bin:'paper' },
    { emoji:'📄', bin:'paper' },
    { emoji:'🧻', bin:'paper' },
    { emoji:'🧴', bin:'plastic' },
    { emoji:'🥤', bin:'plastic' },
    { emoji:'🛍️', bin:'plastic' }
  ];

  /* ---------- selector de tipo de ronda por nivel (mismo patrón que pickMathRound/pickReadingRound) ---------- */
  function pickScienceRound(){
    var lv = (typeof currentProfile === 'function' && currentProfile()) ? (currentProfile().best.science || 0) : 0;
    lv = lv | 0;
    var pool = ['classic'];
    if (lv >= 1) pool.push('body','weather');
    if (lv >= 2) pool.push('recycle');
    return pool[rnd(pool.length)];
  }

  /* ---------- (1) Partes del cuerpo: escucha el nombre, toca la parte correcta ----------
     Sin visual "gancho" que delate la respuesta: se muestra una figura neutra
     (🧍) y la pregunta se resuelve solo por audio + las 3 opciones, igual que
     el mecanismo de roundReading (tile no revela la respuesta de los .choice). */
  function roundScienceBody(){
    var t = UI[S.lang];
    var target = BODY_PARTS[rnd(BODY_PARTS.length)];
    var others = sample(BODY_PARTS.filter(function(x){ return x.id !== target.id; }), 2);
    var opts = shuffle([target].concat(others));

    var stage = $('stage'); stage.innerHTML = '';
    var big = document.createElement('div'); big.className = 'animalBig bodyFigure';
    big.textContent = '🧍'; big.setAttribute('aria-hidden', 'true');
    stage.appendChild(big);

    var ch = document.createElement('div'); ch.className = 'choices bodyparts'; S.correctBtn = null;
    opts.forEach(function(o){
      var b = document.createElement('button'); b.className = 'choice bodypart';
      b.innerHTML = '<span class="cface">' + eduEsc(o.emoji) + '</span><span class="clabel">' + eduEsc(o[S.lang]) + '</span>';
      if (o.id === target.id) S.correctBtn = b;
      b.onclick = function(){
        if (o.id === target.id){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([
            { t: t.sciBodyYes + ' ' + target[S.lang].toLowerCase() + '.' },
            { t: t.mGreat }
          ]);
          confetti(); afterCorrect('sci-body-' + target.id);
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) speak(t.sciBodyHint);
            else if (lvl === 3) speak(t.mTapGlow);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);

    var q = t.sciBodyQPrefix + ' ' + target[S.lang].toLowerCase();
    var say = function(){ speak(q); };
    setPrompt(q, say); say();
  }

  /* ---------- (2) Clima → estación: ver el clima, tocar la estación correcta ---------- */
  function roundScienceWeather(){
    var t = UI[S.lang];
    var item = WEATHER_ITEMS[rnd(WEATHER_ITEMS.length)];

    var stage = $('stage'); stage.innerHTML = '';
    var big = document.createElement('div'); big.className = 'animalBig'; big.textContent = item.emoji;
    stage.appendChild(big);

    var ch = document.createElement('div'); ch.className = 'choices seasons'; S.correctBtn = null;
    SEASON_ORDER.forEach(function(sk){
      var cat = SEASONS[sk];
      var b = document.createElement('button'); b.className = 'choice season ' + sk;
      b.innerHTML = '<span class="cface">' + eduEsc(cat.emoji) + '</span><span class="clabel">' + eduEsc(cat[S.lang]) + '</span>';
      if (sk === item.season) S.correctBtn = b;
      b.onclick = function(){
        if (sk === item.season){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([
            { t: t.sciSeasonYes + ' ' + cat[S.lang] + '.' },
            { t: t.mGreat }
          ]);
          confetti(); afterCorrect('sci-season-' + sk);
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) speak(t.sciSeasonHint);
            else if (lvl === 3) speak(t.mTapGlow);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);

    var q = t.sciSeasonQ;
    setPrompt(q, function(){ speak(q); }); speak(q);
  }

  /* ---------- (3) Reciclaje: ver el residuo, tocar el bote correcto ---------- */
  function roundScienceRecycle(){
    var t = UI[S.lang];
    var item = WASTE_ITEMS[rnd(WASTE_ITEMS.length)];

    var stage = $('stage'); stage.innerHTML = '';
    var big = document.createElement('div'); big.className = 'animalBig'; big.textContent = item.emoji;
    stage.appendChild(big);

    var ch = document.createElement('div'); ch.className = 'choices bins'; S.correctBtn = null;
    BIN_ORDER.forEach(function(bk){
      var cat = BINS[bk];
      var b = document.createElement('button'); b.className = 'choice bin ' + bk;
      b.innerHTML = '<span class="cface">' + eduEsc(cat.emoji) + '</span><span class="clabel">' + eduEsc(cat[S.lang]) + '</span>';
      if (bk === item.bin) S.correctBtn = b;
      b.onclick = function(){
        if (bk === item.bin){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([
            { t: t.sciBinYes + ' ' + cat[S.lang] + '.' },
            { t: t.mGreat }
          ]);
          confetti(); afterCorrect('sci-bin-' + bk);
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) speak(t.sciBinHint);
            else if (lvl === 3) speak(t.mTapGlow);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);

    var q = t.sciBinQ;
    setPrompt(q, function(){ speak(q); }); speak(q);
  }

  /* ---------- envoltura por reasignación de window.renderScienceRound ---------- */
  var _renderScienceRoundClassic = window.renderScienceRound;
  if (typeof _renderScienceRoundClassic === 'function' && !window.__sciAdvWrapped){
    window.__sciAdvWrapped = true;
    window.renderScienceRound = function(){
      var type = pickScienceRound();
      if (type === 'body')    return roundScienceBody();
      if (type === 'weather') return roundScienceWeather();
      if (type === 'recycle') return roundScienceRecycle();
      return _renderScienceRoundClassic();
    };
  }

  /* ---------- envoltura opcional de window.eduFaceOf (panel del EDUCADOR) ----------
     Solo si ya existe (viene del panel educador, punto anterior de fase 4). Añade
     emoji+etiqueta legible para las 3 familias de claves nuevas en "A reforzar";
     delega cualquier otra clave a la implementación previa sin tocarla. */
  if (typeof window.eduFaceOf === 'function' && !window.__sciAdvEduWrapped){
    window.__sciAdvEduWrapped = true;
    var _eduFaceOf = window.eduFaceOf;
    window.eduFaceOf = function(k){
      if (typeof k === 'string'){
        if (k.indexOf('sci-body-') === 0){
          var bp = BODY_PARTS.filter(function(x){ return x.id === k.slice(9); })[0];
          if (bp) return bp.emoji + ' ' + bp[(typeof S === 'object' && S) ? S.lang : 'es'];
        }
        if (k.indexOf('sci-season-') === 0){
          var se = SEASONS[k.slice(11)];
          if (se) return se.emoji + ' ' + se[(typeof S === 'object' && S) ? S.lang : 'es'];
        }
        if (k.indexOf('sci-bin-') === 0){
          var bi = BINS[k.slice(8)];
          if (bi) return bi.emoji + ' ' + bi[(typeof S === 'object' && S) ? S.lang : 'es'];
        }
      }
      return _eduFaceOf(k);
    };
  }

  /* ---------- API pública para tests/tooling (no reemplaza nada existente) ---------- */
  window.__scienceAdv = {
    BODY_PARTS: BODY_PARTS,
    SEASONS: SEASONS,
    BINS: BINS,
    WEATHER_ITEMS: WEATHER_ITEMS,
    WASTE_ITEMS: WASTE_ITEMS,
    pickScienceRound: pickScienceRound,
    roundScienceBody: roundScienceBody,
    roundScienceWeather: roundScienceWeather,
    roundScienceRecycle: roundScienceRecycle
  };
})();
