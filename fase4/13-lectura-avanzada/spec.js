/* ==================== FASE 4 · #13 Lectura avanzada ====================
   Sílabas · Palabras completas · Comprensión de mini-cuento (1 pregunta).

   100% ADITIVO: no se reescribe ninguna función existente de ship/app.js.
   window.roundReading (el juego de letras original) se envuelve por
   REASIGNACIÓN — mismo mecanismo que ya usan AudioBank (window.speak/
   speakSeq) y la Estrategia bilingüe (window.afterCorrect/nextRound) al
   final de app.js. La implementación original queda guardada en un closure
   privado y se sigue usando tal cual para el nivel 0 (por defecto), así que
   cualquier perfil nuevo ve exactamente el mismo juego de "Letras" de
   siempre — los 19 tests actuales no se ven afectados.

   Progresión por nivel (profile.best.reading, 0-index, mismo campo que ya
   usa finishGame() para subir de nivel — no se toca finishGame ni
   MATH_LEVELS): mismo patrón de "pool de tipos de ronda" que ya usa
   pickMathRound()/roundMath() para matemáticas.
     - nivel 1 (best.reading===0): solo 'letter'      (idéntico a hoy)
     - nivel 2 (best.reading>=1):  + 'syllable'        (sílabas)
     - nivel 3 (best.reading>=2):  + 'word'             (palabras completas)
     - nivel 4 (best.reading>=3):  + 'story'            (mini-cuento + 1 pregunta)
   El pool crece pero nunca deja de incluir 'letter'; a mayor nivel, más
   variedad, nunca menos.

   Motor reutilizado sin cambios: $, rnd, shuffle, sample, chime, speak,
   speakSeq, confetti, onWrong, afterCorrect, setPrompt, currentProfile,
   S, UI, eduEsc. Claves de log nuevas: 'read-syl-<SIL>', 'read-word-<PALABRA>',
   'read-story-<id>' (mismo prefijo 'read-' que ya usa el juego de letras,
   así que aggregate()/byGame.reading las cuenta automáticamente sin cambios).
   ========================================================================= */
(function(){
  "use strict";

  if (typeof window === 'undefined' || typeof UI === 'undefined' || typeof $ !== 'function') return;

  /* ---------- i18n aditivo (Object.assign, nunca sobreescribe claves existentes) ---------- */
  Object.assign(UI.es, {
    rdWordQ: 'Lee la palabra y toca el dibujo.',
    rdWordHint: 'Lee despacio, letra por letra.',
    rdStoryReplay: 'Escucha el cuento de nuevo.'
  });
  Object.assign(UI.en, {
    rdWordQ: 'Read the word and tap the picture.',
    rdWordHint: 'Read it slowly, letter by letter.',
    rdStoryReplay: 'Listen to the story again.'
  });

  /* ---------- contenido: sílabas (CV) ---------- */
  var SYLLABLES = {
    es: [
      { syl:'MA', word:'Mamá',  emoji:'👩' },
      { syl:'PA', word:'Papá',  emoji:'👨' },
      { syl:'SO', word:'Sol',   emoji:'☀️' },
      { syl:'LU', word:'Luna',  emoji:'🌙' },
      { syl:'GA', word:'Gato',  emoji:'🐱' },
      { syl:'PE', word:'Perro', emoji:'🐶' },
      { syl:'CA', word:'Casa',  emoji:'🏠' },
      { syl:'PI', word:'Piña',  emoji:'🍍' }
    ],
    en: [
      { syl:'CA', word:'Cat',   emoji:'🐱' },
      { syl:'SU', word:'Sun',   emoji:'☀️' },
      { syl:'DO', word:'Dog',   emoji:'🐶' },
      { syl:'FI', word:'Fish',  emoji:'🐟' },
      { syl:'MO', word:'Moon',  emoji:'🌙' },
      { syl:'BA', word:'Ball',  emoji:'⚽' },
      { syl:'HO', word:'House', emoji:'🏠' },
      { syl:'BI', word:'Bird',  emoji:'🐦' }
    ]
  };

  /* ---------- contenido: palabras completas ---------- */
  var WORDS = {
    es: [
      { word:'SOL',   emoji:'☀️' },
      { word:'LUNA',  emoji:'🌙' },
      { word:'GATO',  emoji:'🐱' },
      { word:'PERRO', emoji:'🐶' },
      { word:'CASA',  emoji:'🏠' },
      { word:'PEZ',   emoji:'🐟' },
      { word:'FLOR',  emoji:'🌸' },
      { word:'OSO',   emoji:'🐻' }
    ],
    en: [
      { word:'SUN',    emoji:'☀️' },
      { word:'MOON',   emoji:'🌙' },
      { word:'CAT',    emoji:'🐱' },
      { word:'DOG',    emoji:'🐶' },
      { word:'HOUSE',  emoji:'🏠' },
      { word:'FISH',   emoji:'🐟' },
      { word:'FLOWER', emoji:'🌸' },
      { word:'BEAR',   emoji:'🐻' }
    ]
  };

  /* ---------- contenido: mini-cuentos + 1 pregunta de comprensión ---------- */
  var STORIES = {
    es: [
      { id:'gato-sol', scenes:[{emoji:'🐱',cap:'El gato'},{emoji:'☀️',cap:'sale al sol'},{emoji:'😴',cap:'y se duerme.'}],
        narrate:'El gato sale al sol y se duerme.', q:'¿Dónde se durmió el gato?',
        opts:[{emoji:'☀️',correct:true},{emoji:'🌧️'},{emoji:'🌙'}] },
      { id:'pez-agua', scenes:[{emoji:'🐟',cap:'El pez'},{emoji:'💧',cap:'nada en el agua'},{emoji:'😊',cap:'muy feliz.'}],
        narrate:'El pez nada en el agua muy feliz.', q:'¿Dónde nada el pez?',
        opts:[{emoji:'💧',correct:true},{emoji:'🌳'},{emoji:'☁️'}] },
      { id:'perro-pelota', scenes:[{emoji:'🐶',cap:'El perro'},{emoji:'⚽',cap:'juega con la pelota'},{emoji:'🎉',cap:'y salta feliz.'}],
        narrate:'El perro juega con la pelota y salta feliz.', q:'¿Con qué juega el perro?',
        opts:[{emoji:'⚽',correct:true},{emoji:'🍎'},{emoji:'📚'}] }
    ],
    en: [
      { id:'cat-sun', scenes:[{emoji:'🐱',cap:'The cat'},{emoji:'☀️',cap:'goes in the sun'},{emoji:'😴',cap:'and falls asleep.'}],
        narrate:'The cat goes in the sun and falls asleep.', q:'Where did the cat fall asleep?',
        opts:[{emoji:'☀️',correct:true},{emoji:'🌧️'},{emoji:'🌙'}] },
      { id:'fish-water', scenes:[{emoji:'🐟',cap:'The fish'},{emoji:'💧',cap:'swims in the water'},{emoji:'😊',cap:'very happy.'}],
        narrate:'The fish swims in the water very happy.', q:'Where does the fish swim?',
        opts:[{emoji:'💧',correct:true},{emoji:'🌳'},{emoji:'☁️'}] },
      { id:'dog-ball', scenes:[{emoji:'🐶',cap:'The dog'},{emoji:'⚽',cap:'plays with the ball'},{emoji:'🎉',cap:'and jumps happily.'}],
        narrate:'The dog plays with the ball and jumps happily.', q:'What does the dog play with?',
        opts:[{emoji:'⚽',correct:true},{emoji:'🍎'},{emoji:'📚'}] }
    ]
  };

  /* ---------- selector de tipo de ronda por nivel (mismo patrón que pickMathRound) ---------- */
  function pickReadingRound(){
    var lv = (typeof currentProfile === 'function' && currentProfile()) ? (currentProfile().best.reading || 0) : 0;
    lv = lv | 0;
    var pool = ['letter'];
    if (lv >= 1) pool.push('syllable');
    if (lv >= 2) pool.push('word');
    if (lv >= 3) pool.push('story');
    return pool[rnd(pool.length)];
  }

  /* ---------- (1) Sílabas: igual mecánica que el juego de letras, con sílabas CV ---------- */
  function roundReadingSyllable(){
    var t = UI[S.lang];
    var set = SYLLABLES[S.lang] || SYLLABLES.es;
    var target = set[rnd(set.length)];
    var others = sample(set.filter(function(x){ return x.syl !== target.syl; }), 2);
    var opts = shuffle([target].concat(others));

    var stage = $('stage'); stage.innerHTML = '';
    var tile = document.createElement('div'); tile.className = 'syltile'; tile.textContent = target.syl;
    stage.appendChild(tile);

    var ch = document.createElement('div'); ch.className = 'choices'; S.correctBtn = null;
    opts.forEach(function(o){
      var b = document.createElement('button'); b.className = 'choice';
      b.innerHTML = '<span class="cface">' + eduEsc(o.emoji) + '</span>';
      if (o.syl === target.syl) S.correctBtn = b;
      b.onclick = function(){
        if (o.syl === target.syl){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([
            { t: (S.lang === 'es' ? ('¡Sí! ' + target.word + ' empieza con ' + target.syl + '.') : ('Yes! ' + target.word + ' starts with ' + target.syl + '.')) },
            { t: t.mGreat }
          ]);
          confetti(); afterCorrect('read-syl-' + target.syl.toLowerCase());
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) speak(S.lang === 'es' ? ('Escucha: ' + target.syl + '. ¿Cuál empieza así?') : ('Listen: ' + target.syl + '. Which one starts like that?'));
            else if (lvl === 3) speak(S.lang === 'es' ? ('Es ' + target.word + '. ' + t.mTapGlow) : ('It is ' + target.word + '. ' + t.mTapGlow));
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);

    var say = function(){
      speakSeq([
        { t: (S.lang === 'es' ? ('La sílaba ' + target.syl) : ('The sound ' + target.syl)), rate:0.85 },
        { t: (S.lang === 'es' ? ('¿Qué empieza con ' + target.syl + '?') : ('What starts with ' + target.syl + '?')) }
      ]);
    };
    var q = S.lang === 'es' ? ('¿Qué empieza con  ' + target.syl + '  ?') : ('What starts with  ' + target.syl + '  ?');
    setPrompt(q, say); say();
  }

  /* ---------- (2) Palabras completas: reconocer la palabra impresa y tocar el dibujo ---------- */
  function roundReadingWord(){
    var t = UI[S.lang];
    var set = WORDS[S.lang] || WORDS.es;
    var target = set[rnd(set.length)];
    var others = sample(set.filter(function(x){ return x.word !== target.word; }), 2);
    var opts = shuffle([target].concat(others));

    var stage = $('stage'); stage.innerHTML = '';
    var tile = document.createElement('div'); tile.className = 'wordtile'; tile.textContent = target.word;
    stage.appendChild(tile);

    var ch = document.createElement('div'); ch.className = 'choices'; S.correctBtn = null;
    opts.forEach(function(o){
      var b = document.createElement('button'); b.className = 'choice';
      b.innerHTML = '<span class="cface">' + eduEsc(o.emoji) + '</span>';
      if (o.word === target.word) S.correctBtn = b;
      b.onclick = function(){
        if (o.word === target.word){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([
            { t: (S.lang === 'es' ? ('¡Sí! Es ' + target.word + '.') : ('Yes! It is ' + target.word + '.')) },
            { t: t.mGreat }
          ]);
          confetti(); afterCorrect('read-word-' + target.word.toLowerCase());
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1) speak(t.rdWordHint);
            else if (lvl === 3) speak((S.lang === 'es' ? ('Es ' + target.word + '. ') : ('It is ' + target.word + '. ')) + t.mTapGlow);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);

    var say = function(){ speak(target.word, { rate:0.8 }); };
    setPrompt(t.rdWordQ, say); say();
  }

  /* ---------- (3) Comprensión de mini-cuento: narración + 1 pregunta de opción múltiple ---------- */
  function roundReadingStory(){
    var t = UI[S.lang];
    var set = STORIES[S.lang] || STORIES.es;
    var story = set[rnd(set.length)];

    var stage = $('stage'); stage.innerHTML = '';
    var strip = document.createElement('div'); strip.className = 'storyStrip';
    story.scenes.forEach(function(sc, i){
      var card = document.createElement('div'); card.className = 'storyScene';
      card.style.animationDelay = (i * 90) + 'ms';
      card.innerHTML = '<span class="ssEmoji">' + eduEsc(sc.emoji) + '</span><span class="ssCap">' + eduEsc(sc.cap) + '</span>';
      strip.appendChild(card);
    });
    stage.appendChild(strip);

    var ch = document.createElement('div'); ch.className = 'choices'; S.correctBtn = null;
    var opts = shuffle(story.opts.slice());
    opts.forEach(function(o){
      var b = document.createElement('button'); b.className = 'choice';
      b.innerHTML = '<span class="cface">' + eduEsc(o.emoji) + '</span>';
      if (o.correct) S.correctBtn = b;
      b.onclick = function(){
        if (o.correct){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([{ t: t.mGreat }]);
          confetti(); afterCorrect('read-story-' + story.id);
        } else {
          onWrong(b, function(lvl){
            if (lvl === 1 || lvl === 3) speak(story.narrate);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);

    var say = function(){ speakSeq([{ t: story.narrate }, { t: story.q }]); };
    setPrompt(story.q, say); say();
  }

  /* ---------- envoltura por reasignación de window.roundReading ---------- */
  var _roundReadingLetter = window.roundReading;
  if (typeof _roundReadingLetter === 'function' && !window.__readingAdvWrapped){
    window.__readingAdvWrapped = true;
    window.roundReading = function(){
      var type = pickReadingRound();
      if (type === 'syllable') return roundReadingSyllable();
      if (type === 'word')     return roundReadingWord();
      if (type === 'story')    return roundReadingStory();
      return _roundReadingLetter();
    };
  }

  /* ---------- envoltura opcional de window.eduFaceOf (panel del EDUCADOR) ----------
     Solo si ya existe (viene del panel educador, punto anterior de fase 4). Añade
     emoji+etiqueta legible para las 3 familias de claves nuevas en "A reforzar";
     delega cualquier otra clave a la implementación previa sin tocarla. */
  if (typeof window.eduFaceOf === 'function' && !window.__readingAdvEduWrapped){
    window.__readingAdvEduWrapped = true;
    var _eduFaceOf = window.eduFaceOf;
    window.eduFaceOf = function(k){
      if (typeof k === 'string'){
        if (k.indexOf('read-syl-') === 0)   return '🔤 ' + k.slice(9).toUpperCase();
        if (k.indexOf('read-word-') === 0)  return '🔤 ' + k.slice(10).toUpperCase();
        if (k.indexOf('read-story-') === 0) return '📖 ' + k.slice(11);
      }
      return _eduFaceOf(k);
    };
  }

  /* ---------- API pública para tests/tooling (no reemplaza nada existente) ---------- */
  window.__readingAdv = {
    SYLLABLES: SYLLABLES,
    WORDS: WORDS,
    STORIES: STORIES,
    pickReadingRound: pickReadingRound,
    roundReadingSyllable: roundReadingSyllable,
    roundReadingWord: roundReadingWord,
    roundReadingStory: roundReadingStory
  };
})();
