"use strict";
/* ==================== #11 Materias nuevas: Emociones · Formas y colores · Rutinas ====================
   Mejora 100% ADITIVA (no reescribe ninguna función existente de ship/app.js).
   Añade 3 subject cards nuevas ("mismo motor" que math/reading/science: mismos
   helpers S/DB/UI/$/rnd/shuffle/sample/chime/speak/speakSeq/confetti/onWrong/
   afterCorrect/setPrompt) para:
     - emotions  ("Emociones" / socioemocional): escena -> reconocer la emoción.
     - shapes    ("Formas y colores"): alterna identificar forma / identificar
                 color (mismo patrón que renderScienceRound alterna hábitat/dieta).
     - routines  ("Rutinas"): actividad diaria -> ¿mañana, tarde o noche?

   DECISIÓN CLAVE (para no romper los 19 tests actuales, en particular
   smoke.spec.js: "...lleva al hub con 3 materias" -> expect('.subject').
   toHaveCount(3)): las 3 tarjetas nuevas NO se insertan en el DOM al cargar.
   Viven detrás de un toggle nuevo en Ajustes, "Más materias" (setMoreSubjects),
   OFF por defecto y persistido en DB.settings.moreSubjects (mismo patrón que
   DB.settings.coplay). Con el toggle apagado (estado por defecto de CUALQUIER
   perfil existente o nuevo) el hub sigue mostrando exactamente 3 tarjetas, así
   que ningún test existente se ve afectado. Al encenderlo, se inyectan 3
   <button class="subject"> más en el mismo contenedor .cards (localizado por
   selector, sin necesitar id nuevo ni tocar index.html), como children 4-6,
   así que las reglas :nth-child(4/5/6) de spec.css los alcanzan igual que a
   los 3 originales.

   Envuelve por reasignación: window.nextRound, window.refreshHome,
   window.eduFaceOf. Nunca reescribe sus cuerpos; siempre llama primero a la
   implementación previa (o replica su misma lógica de bookkeeping antes de
   delegar, ver comentario en el wrap de nextRound). Cablea #langBtn/#tabSet
   con addEventListener (nunca .onclick=), para no romper la cadena de
   listeners ya existente. Bajo file:// no abre red (nada nuevo aquí toca
   fetch/XHR/WebSocket). Solo anima transform/opacity (ver spec.css) y respeta
   prefers-reduced-motion vía la regla global "*" ya existente en index.html.
   Evidencia: CASEL (aprendizaje socioemocional) · NAEYC 2022 (formas/colores
   y rutinas como contenido preescolar núcleo) · Piaget (clasificación).
   ================================================================= */
(function(){

  /* ---------- 1) i18n aditivo (Object.assign, nunca sobreescribe claves) ---------- */
  if (typeof UI === 'object' && UI.es && UI.en){
    Object.assign(UI.es,{
      setMoreN:'Más materias',
      setMoreD:'Agrega Emociones, Formas y colores, y Rutinas al inicio',
      emoLbl:'Emociones', shapesLbl:'Formas y colores', routLbl:'Rutinas',
      emoQ:'¿Cómo se siente?', emoYes:'¡Sí! Se siente', emoHint1:'Mira la escena, ¿cómo se siente?', emoIt:'Se siente',
      shapeQ:'¿Qué forma es?', shapeYes:'¡Sí! Es un', shapeHint1:'Mira bien los lados: ¿es redondo o tiene puntas?', shapeIt:'Es un',
      colorQ:'¿Qué color es?', colorYes:'¡Sí! Es', colorHint1:'Mira bien el color.', colorIt:'Es',
      routQ:'¿Cuándo haces esto: {act}?', routYes:'¡Sí! Es en la', routHint1:'Piensa: ¿mañana, tarde o noche?', routIt:'Es en la'
    });
    Object.assign(UI.en,{
      setMoreN:'More subjects',
      setMoreD:'Adds Feelings, Shapes & Colors, and Routines to the home screen',
      emoLbl:'Feelings', shapesLbl:'Shapes & Colors', routLbl:'Routines',
      emoQ:'How does it feel?', emoYes:'Yes! It feels', emoHint1:'Look at the scene, how does it feel?', emoIt:'It feels',
      shapeQ:'What shape is it?', shapeYes:'Yes! It is a', shapeHint1:'Look closely: is it round or does it have points?', shapeIt:'It is a',
      colorQ:'What color is it?', colorYes:'Yes! It is', colorHint1:'Look closely at the color.', colorIt:'It is',
      routQ:'When do you do this: {act}?', routYes:"Yes! It's in the", routHint1:'Think: morning, afternoon, or night?', routIt:"It's in the"
    });
  }

  /* ---------- 2) Contenido ---------- */
  var EMOTIONS={
    happy: {emoji:'😄', es:'Feliz',      en:'Happy'},
    sad:   {emoji:'😢', es:'Triste',     en:'Sad'},
    angry: {emoji:'😠', es:'Enojado',    en:'Angry'},
    scared:{emoji:'😨', es:'Asustado',   en:'Scared'},
    calm:  {emoji:'😌', es:'Tranquilo',  en:'Calm'}
  };
  var EMO_SCENARIOS=[
    {emoji:'🎂', emo:'happy',  es:'Es tu cumpleaños',            en:'It is your birthday'},
    {emoji:'🎁', emo:'happy',  es:'Recibes un regalo',            en:'You get a present'},
    {emoji:'🐶', emo:'happy',  es:'Juegas con tu mascota',        en:'You play with your pet'},
    {emoji:'🧸', emo:'sad',    es:'Perdiste tu juguete',          en:'You lost your toy'},
    {emoji:'💔', emo:'sad',    es:'Tu amigo se fue',              en:'Your friend went away'},
    {emoji:'🌧️', emo:'sad',    es:'No puedes salir a jugar',      en:'You cannot go out to play'},
    {emoji:'🧱', emo:'angry',  es:'Alguien rompió tu torre',      en:'Someone knocked down your tower'},
    {emoji:'⏳', emo:'angry',  es:'Tienes que esperar tu turno',  en:'You have to wait your turn'},
    {emoji:'⛈️', emo:'scared', es:'Hay una tormenta fuerte',      en:'There is a loud storm'},
    {emoji:'🌑', emo:'scared', es:'Está muy oscuro',              en:'It is very dark'},
    {emoji:'📖', emo:'calm',   es:'Lees un cuento tranquilo',     en:'You read a quiet story'},
    {emoji:'🛌', emo:'calm',   es:'Descansas después de jugar',   en:'You rest after playing'}
  ];

  var SHAPES=[
    {key:'circle',   es:'Círculo',    en:'Circle'},
    {key:'square',   es:'Cuadrado',   en:'Square'},
    {key:'triangle', es:'Triángulo',  en:'Triangle'},
    {key:'star',     es:'Estrella',   en:'Star'}
  ];
  var COLORS=[
    {key:'red',    es:'Rojo',      en:'Red',    hex:'#E8574A'},
    {key:'blue',   es:'Azul',      en:'Blue',   hex:'#4EA8DE'},
    {key:'yellow', es:'Amarillo',  en:'Yellow', hex:'#FDBA4D'},
    {key:'green',  es:'Verde',     en:'Green',  hex:'#57C596'},
    {key:'purple', es:'Morado',    en:'Purple', hex:'#A57EDC'},
    {key:'orange', es:'Naranja',   en:'Orange', hex:'#FF8C42'}
  ];

  var ROUT_TIME={
    morning:  {emoji:'🌅', es:'Mañana', en:'Morning'},
    afternoon:{emoji:'☀️', es:'Tarde',  en:'Afternoon'},
    night:    {emoji:'🌙', es:'Noche',  en:'Night'}
  };
  var ROUTINES=[
    {emoji:'☀️', time:'morning',   es:'Despertar',              en:'Wake up'},
    {emoji:'🪥', time:'morning',   es:'Cepillarse los dientes', en:'Brush your teeth'},
    {emoji:'🍳', time:'morning',   es:'Desayunar',              en:'Eat breakfast'},
    {emoji:'🎒', time:'morning',   es:'Ir a la escuela',        en:'Go to school'},
    {emoji:'🍽️', time:'afternoon', es:'Almorzar',               en:'Eat lunch'},
    {emoji:'🧩', time:'afternoon', es:'Jugar con juguetes',     en:'Play with toys'},
    {emoji:'🛁', time:'night',     es:'Bañarse',                en:'Take a bath'},
    {emoji:'📖', time:'night',     es:'Leer un cuento',         en:'Read a story'},
    {emoji:'🌙', time:'night',     es:'Dormir',                 en:'Go to sleep'}
  ];

  /* ---------- 3) Rondas (mismo motor: S.correctBtn / onWrong / afterCorrect / setPrompt) ---------- */

  /* (a) Socioemocional: escena -> tocar la emoción correcta. Clave: 'emo-<key>'. */
  function roundEmotions(){
    var t=UI[S.lang];
    var sc=EMO_SCENARIOS[rnd(EMO_SCENARIOS.length)];
    var keys=Object.keys(EMOTIONS);
    var others=sample(keys.filter(function(k){ return k!==sc.emo; }),2);
    var opts=shuffle([sc.emo].concat(others));
    var correctLabel=EMOTIONS[sc.emo][S.lang];
    var stage=$('stage'); stage.innerHTML='';
    var big=document.createElement('div'); big.className='scenarioBig'; big.textContent=sc.emoji; stage.appendChild(big);
    var ch=document.createElement('div'); ch.className='choices emos'; S.correctBtn=null;
    opts.forEach(function(k){
      var e=EMOTIONS[k];
      var b=document.createElement('button'); b.className='choice emoCard '+k;
      b.innerHTML='<span class="cface">'+e.emoji+'</span><span class="clabel">'+e[S.lang]+'</span>';
      if(k===sc.emo) S.correctBtn=b;
      b.onclick=function(){
        if(k===sc.emo){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([{t:t.emoYes+' '+correctLabel.toLowerCase()+'.'},{t:t.mGreat}]);
          confetti(); afterCorrect('emo-'+k);
        } else {
          onWrong(b,function(lvl){
            if(lvl===1) speak(t.emoHint1);
            else if(lvl===3) speak(t.emoIt+' '+correctLabel.toLowerCase()+'. '+t.mTapGlow);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q=t.emoQ;
    setPrompt(q,function(){ speak(q); }); speak(q);
  }

  /* (b) Formas y colores: alterna forma (ronda par) / color (ronda impar),
     mismo patrón que renderScienceRound alterna hábitat/dieta. */
  function renderShapesRound(){ if(S.round%2===1) roundColorId(); else roundShapeId(); }

  function roundShapeId(){
    var t=UI[S.lang];
    var target=SHAPES[rnd(SHAPES.length)];
    var others=sample(SHAPES.filter(function(s){ return s.key!==target.key; }),2);
    var opts=shuffle([target].concat(others));
    var stage=$('stage'); stage.innerHTML='';
    var big=document.createElement('div'); big.className='shapeStage '+target.key; stage.appendChild(big);
    var ch=document.createElement('div'); ch.className='choices shapes'; S.correctBtn=null;
    opts.forEach(function(sh){
      var b=document.createElement('button'); b.className='choice shapeChoice';
      var icon=document.createElement('span'); icon.className='shapeIcon '+sh.key;
      var lab=document.createElement('span'); lab.className='clabel'; lab.textContent=sh[S.lang];
      b.appendChild(icon); b.appendChild(lab);
      if(sh.key===target.key) S.correctBtn=b;
      b.onclick=function(){
        if(sh.key===target.key){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([{t:t.shapeYes+' '+sh[S.lang].toLowerCase()+'.'},{t:t.mGreat}]);
          confetti(); afterCorrect('shape-'+sh.key);
        } else {
          onWrong(b,function(lvl){
            if(lvl===1) speak(t.shapeHint1);
            else if(lvl===3) speak(t.shapeIt+' '+target[S.lang].toLowerCase()+'. '+t.mTapGlow);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q=t.shapeQ;
    setPrompt(q,function(){ speak(q); }); speak(q);
  }

  function roundColorId(){
    var t=UI[S.lang];
    var target=COLORS[rnd(COLORS.length)];
    var others=sample(COLORS.filter(function(c){ return c.key!==target.key; }),2);
    var opts=shuffle([target].concat(others));
    var stage=$('stage'); stage.innerHTML='';
    var big=document.createElement('div'); big.className='colorSwatch'; big.style.background=target.hex; stage.appendChild(big);
    var ch=document.createElement('div'); ch.className='choices colors'; S.correctBtn=null;
    opts.forEach(function(c){
      var b=document.createElement('button'); b.className='choice colorChoice';
      var chip=document.createElement('span'); chip.className='colorChip'; chip.style.background=c.hex;
      var lab=document.createElement('span'); lab.className='clabel'; lab.textContent=c[S.lang];
      b.appendChild(chip); b.appendChild(lab);
      if(c.key===target.key) S.correctBtn=b;
      b.onclick=function(){
        if(c.key===target.key){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([{t:t.colorYes+' '+c[S.lang].toLowerCase()+'.'},{t:t.mGreat}]);
          confetti(); afterCorrect('color-'+c.key);
        } else {
          onWrong(b,function(lvl){
            if(lvl===1) speak(t.colorHint1);
            else if(lvl===3) speak(t.colorIt+' '+target[S.lang].toLowerCase()+'. '+t.mTapGlow);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q=t.colorQ;
    setPrompt(q,function(){ speak(q); }); speak(q);
  }

  /* (c) Rutinas: actividad -> ¿mañana, tarde o noche? (3 opciones fijas,
     mismo patrón que roundScience con hábitat). Clave: 'rout-<time>'. */
  function roundRoutines(){
    var t=UI[S.lang];
    var r=ROUTINES[rnd(ROUTINES.length)];
    var stage=$('stage'); stage.innerHTML='';
    var big=document.createElement('div'); big.className='scenarioBig'; big.textContent=r.emoji; stage.appendChild(big);
    var ch=document.createElement('div'); ch.className='choices routines'; S.correctBtn=null;
    ['morning','afternoon','night'].forEach(function(tm){
      var b=document.createElement('button'); b.className='choice routineCard '+tm;
      b.innerHTML='<span class="cface">'+ROUT_TIME[tm].emoji+'</span><span class="clabel">'+ROUT_TIME[tm][S.lang]+'</span>';
      if(tm===r.time) S.correctBtn=b;
      b.onclick=function(){
        if(tm===r.time){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([{t:t.routYes+' '+ROUT_TIME[tm][S.lang].toLowerCase()+'.'},{t:t.mGreat}]);
          confetti(); afterCorrect('rout-'+tm);
        } else {
          onWrong(b,function(lvl){
            if(lvl===1) speak(t.routHint1);
            else if(lvl===3) speak(t.routIt+' '+ROUT_TIME[r.time][S.lang].toLowerCase()+'. '+t.mTapGlow);
          });
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q=t.routQ.replace('{act}', r[S.lang].toLowerCase());
    setPrompt(q,function(){ speak(q); }); speak(q);
  }

  var NEW_GAMES={ emotions:roundEmotions, shapes:renderShapesRound, routines:roundRoutines };
  window.__newSubjectRounds = NEW_GAMES; // expuesto para tests/tooling

  /* ---------- 4) Envolver nextRound (por reasignación) para reconocer los 3 juegos nuevos ----------
     nextRound original: if(S.round>=S.totalRounds){finishGame();return;} renderProgress();
     S.attempts=0; S.revealed=false; S.roundLogged=false; S.roundStart=now();
     if(math) roundMath(); else if(reading) roundReading(); else renderScienceRound();
     Su rama "else" asumiría erróneamente ciencia para S.game nuevos, así que
     hay que interceptar ANTES de delegar. Replicamos el mismo bookkeeping
     (idéntico al original) solo para los 3 juegos nuevos; para math/reading/
     science (o cualquier otro futuro) delegamos intacto a la implementación
     previa, sin tocarla. */
  if(!window.__moreSubjectsNextRoundWrapped){
    window.__moreSubjectsNextRoundWrapped=true;
    var _nextRound=window.nextRound;
    window.nextRound=function(){
      if(NEW_GAMES[S.game]){
        if(S.round>=S.totalRounds){ finishGame(); return; }
        renderProgress(); S.attempts=0; S.revealed=false; S.roundLogged=false; S.roundStart=now();
        NEW_GAMES[S.game]();
        return;
      }
      return _nextRound();
    };
  }

  /* ---------- 5) Badges "Nivel N" + etiquetas de las tarjetas nuevas ---------- */
  function syncNewSubjectBadges(){
    var p=(typeof currentProfile==='function')?currentProfile():null; if(!p) return;
    var t=UI[S.lang]; if(!t) return;
    var setLv=function(id,g){ var el=$(id); if(el) el.textContent=t.level+' '+(((p.best&&p.best[g])||0)+1); };
    setLv('lvEmo','emotions'); setLv('lvShapes','shapes'); setLv('lvRoutines','routines');
  }
  function paintNewSubjectLabels(){
    var t=UI[S.lang]; if(!t) return;
    var setTxt=function(id,txt){ var el=$(id); if(el&&txt!=null) el.textContent=txt; };
    setTxt('lblEmo', t.emoLbl); setTxt('lblShapes', t.shapesLbl); setTxt('lblRoutines', t.routLbl);
  }
  if(!window.__moreSubjectsRefreshHomeWrapped){
    window.__moreSubjectsRefreshHomeWrapped=true;
    var _refreshHome=window.refreshHome;
    window.refreshHome=function(){ _refreshHome(); syncNewSubjectBadges(); };
  }

  /* ---------- 6) Etiquetas legibles de fallos nuevos en el panel Educador ----------
     eduFaceOf() es una función global independiente (no una closure interna
     como el "faceOf" de renderProgress2), así que sí puede envolverse. La
     lista "A reforzar" del panel del EDUCADOR mostrará emoji+etiqueta para
     'emo-*'/'shape-*'/'color-*'/'rout-*'; el "A reforzar" del panel de
     PROGRESO POR NIÑO (renderProgress2) seguirá mostrando la clave cruda para
     estas 4 familias porque su faceOf vive dentro del cuerpo de esa función
     (no se puede tocar sin reescribirla) — degradación aceptada y documentada
     en integration.md/manifest.json, sin romper nada (fallback ya existente:
     "return k;"). */
  if(typeof window.eduFaceOf==='function' && !window.__moreSubjectsEduFaceWrapped){
    window.__moreSubjectsEduFaceWrapped=true;
    var _eduFaceOf=window.eduFaceOf;
    window.eduFaceOf=function(k){
      if(k.indexOf('emo-')===0){ var ek=k.slice(4); return EMOTIONS[ek]?EMOTIONS[ek].emoji+' '+EMOTIONS[ek][S.lang]:k; }
      if(k.indexOf('shape-')===0){ var sk=k.slice(6); var sh=SHAPES.filter(function(s){return s.key===sk;})[0]; return sh?'🔺 '+sh[S.lang]:k; }
      if(k.indexOf('color-')===0){ var ck=k.slice(6); var co=COLORS.filter(function(c){return c.key===ck;})[0]; return co?'🎨 '+co[S.lang]:k; }
      if(k.indexOf('rout-')===0){ var tk=k.slice(5); return ROUT_TIME[tk]?ROUT_TIME[tk].emoji+' '+ROUT_TIME[tk][S.lang]:k; }
      return _eduFaceOf(k);
    };
  }

  /* ---------- 7) Toggle en Ajustes: "Más materias" (default OFF, persistido) ---------- */
  function moreCfg(){
    if(typeof DB!=='object'||!DB) return { moreSubjects:false };
    if(!DB.settings) DB.settings={};
    if(typeof DB.settings.moreSubjects!=='boolean') DB.settings.moreSubjects=false; /* default OFF */
    return DB.settings;
  }
  function moreOn(){ return !!moreCfg().moreSubjects; }

  function ensureMoreSettingRow(){
    var set=$('setView'); if(!set) return;
    var row=$('setMoreSubjects');
    if(!row){
      row=document.createElement('div'); row.className='setting'; row.id='setMoreSubjects';
      row.innerHTML='<div><div class="name" id="setMoreN"></div><div class="desc" id="setMoreD"></div></div>'
        +'<button class="toggle" id="tgMoreSubjects" role="switch"><span class="knob"></span></button>';
      var anchor=$('tipText');
      if(anchor && anchor.parentNode===set) set.insertBefore(row, anchor); else set.appendChild(row);
    }
    var tg=$('tgMoreSubjects');
    if(tg && !tg._msWired){ tg._msWired=true;
      tg.addEventListener('click', function(){
        var c=moreCfg(); c.moreSubjects=!c.moreSubjects; if(typeof saveDB==='function') saveDB();
        syncMoreRow(); syncMoreSubjectsUI();
        if(typeof speak==='function'){ var t=UI[S.lang]; speak(c.moreSubjects?t.setMoreN:t.close); }
      });
    }
    applyMoreLangRow(); syncMoreRow();
  }
  function syncMoreRow(){ var tg=$('tgMoreSubjects'); if(tg){ tg.classList.toggle('on', moreOn()); tg.setAttribute('aria-checked', String(moreOn())); } }
  function applyMoreLangRow(){
    var t=UI[S.lang]; if(!t) return;
    var n=$('setMoreN'), d=$('setMoreD');
    if(n) n.textContent=t.setMoreN||'More subjects'; if(d) d.textContent=t.setMoreD||'';
  }

  /* ---------- 8) Inyección/retiro de las 3 tarjetas nuevas en .cards ---------- */
  var NEW_SUBJECTS=[
    { game:'emotions', emoji:'😊', lvId:'lvEmo',      lblId:'lblEmo' },
    { game:'shapes',   emoji:'🎨', lvId:'lvShapes',   lblId:'lblShapes' },
    { game:'routines', emoji:'⏰', lvId:'lvRoutines', lblId:'lblRoutines' }
  ];
  function buildSubjectCard(def){
    var b=document.createElement('button');
    b.className='subject'; b.id='subj_'+def.game; b.setAttribute('data-game', def.game);
    b.innerHTML='<span class="blob"></span><span class="lv" id="'+def.lvId+'">Nivel 1</span>'
      +'<span class="emoji">'+def.emoji+'</span><span class="label" id="'+def.lblId+'"></span>';
    /* Wireo propio: la delegación original (document.querySelectorAll('.subject')...)
       corrió una sola vez, al parsear app.js, ANTES de que este botón exista;
       por eso se cablea aquí con addEventListener, replicando el mismo efecto
       ( ac(); startGame(game); ) que usan las 3 tarjetas originales. */
    b.addEventListener('click', function(){ if(typeof ac==='function') ac(); startGame(def.game); });
    return b;
  }
  function ensureExtraSubjectCards(){
    var host=document.querySelector('.cards'); if(!host) return;
    NEW_SUBJECTS.forEach(function(def){ if(!$('subj_'+def.game)) host.appendChild(buildSubjectCard(def)); });
    paintNewSubjectLabels(); syncNewSubjectBadges();
  }
  function removeExtraSubjectCards(){
    NEW_SUBJECTS.forEach(function(def){ var el=$('subj_'+def.game); if(el) el.remove(); });
  }
  function syncMoreSubjectsUI(){ if(moreOn()) ensureExtraSubjectCards(); else removeExtraSubjectCards(); }

  /* ---------- 9) Cableado #tabSet / #langBtn (addEventListener, nunca .onclick=) ---------- */
  function wireChrome(){
    var ts=$('tabSet');
    if(ts && !ts._msWired){ ts._msWired=true; ts.addEventListener('click', function(){ ensureMoreSettingRow(); }); }
    var lb=$('langBtn');
    if(lb && !lb._msWired){ lb._msWired=true;
      lb.addEventListener('click', function(){
        applyMoreLangRow(); paintNewSubjectLabels();
        if(S.screen==='game' && NEW_GAMES[S.game]) NEW_GAMES[S.game]();
      });
    }
  }

  /* ---------- 10) API pública para tests/tooling (no expone estado sensible) ---------- */
  window.__moreSubjects = {
    isOn: moreOn,
    enable:  function(){ var c=moreCfg(); c.moreSubjects=true;  if(typeof saveDB==='function') saveDB(); syncMoreRow(); syncMoreSubjectsUI(); },
    disable: function(){ var c=moreCfg(); c.moreSubjects=false; if(typeof saveDB==='function') saveDB(); syncMoreRow(); syncMoreSubjectsUI(); },
    games: Object.keys(NEW_GAMES),
    refresh: syncMoreSubjectsUI
  };

  /* ---------- 11) Init ---------- */
  function initMoreSubjects(){
    moreCfg();
    ensureMoreSettingRow();
    wireChrome();
    syncMoreSubjectsUI(); /* si el dispositivo ya tenía el toggle ON de una sesión previa, reaparecen sin acción extra */
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ try{ initMoreSubjects(); }catch(e){} });
  else { try{ initMoreSubjects(); }catch(e){} }

})();
