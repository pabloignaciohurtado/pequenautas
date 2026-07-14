

/* ==================== Mejora #12: Mates avanzadas ====================
   Nuevas variantes de roundMath(): sumas/restas simples, patrones (ABAB /
   AAB / ABC) y medición (más largo / más corto). 100% ADITIVA: envuelve
   window.pickMathRound y window.roundMath por REASIGNACIÓN (mismo mecanismo
   que ya usa esta app para window.speak/speakSeq/afterCorrect/nextRound),
   sin tocar ni una línea de las funciones existentes roundMathCount(),
   roundMathSubitize() ni roundMathCompare(), que se siguen invocando tal
   cual para sus tipos ('count'/'subitize'/'compare'). Idempotente vía
   window.__mathAdvWrapped. i18n aditivo con Object.assign(UI.es/UI.en,{...}).
   Bajo file:// no toca red (sólo DOM/CSS/Audio local vía speak/chime, ya
   existentes). Animaciones nuevas (.patTile) reutilizan el keyframe 'pop'
   ya definido (transform+opacity) y quedan cubiertas por la regla global
   *{animation-duration:.001ms} de prefers-reduced-motion; se añade además
   un bloque @media propio como red de seguridad, sin editar el existente.
   Progresión por nivel (profile.best.math, 0-index, igual criterio que
   pickMathRound original):
     - 'count' / 'subitize' / 'measure' : siempre (nivel 1+)
     - 'compare' / 'pattern'            : nivel >= 2 (best.math >= 1)
     - 'add' (sumas)                    : nivel >= 3 (best.math >= 2)
     - 'take' (restas)                  : nivel >= 4 (best.math >= 3)
   Evidencia: NAEYC 2022 (representación concreta antes de abstracta),
   Clements & Sarama (aprendizaje de patrones y medición en preescolar). */
(function(){
  "use strict";
  if(window.__mathAdvWrapped) return;
  window.__mathAdvWrapped = true;

  /* i18n aditivo — no reemplaza ni borra ninguna clave existente. */
  Object.assign(UI.es, {
    mOpAddQ:      '¿Cuánto es en total?',
    mOpTakeQ:     '¿Cuántos quedan?',
    mOpCountAll:  'Cuenta todos, uno por uno.',
    mOpCountLeft: 'Cuenta los que quedan.',
    mOpAddYes:    '¡Sí! En total son',
    mOpTakeYes:   '¡Sí! Quedan',
    mTakeAway:    'Quitamos',
    mPatQ:        '¿Qué sigue?',
    mPatYes:      '¡Sí! Sigue',
    mPatLookAgain:'Mira el patrón otra vez.',
    mLenLongQ:    'Toca el más largo.',
    mLenShortQ:   'Toca el más corto.',
    mLenYesLong:  '¡Sí! Este es más largo.',
    mLenYesShort: '¡Sí! Este es más corto.'
  });
  Object.assign(UI.en, {
    mOpAddQ:      'How much is it in total?',
    mOpTakeQ:     'How many are left?',
    mOpCountAll:  'Count them all, one by one.',
    mOpCountLeft: 'Count the ones that are left.',
    mOpAddYes:    'Yes! In total there are',
    mOpTakeYes:   'Yes! There are left',
    mTakeAway:    'We take away',
    mPatQ:        'What comes next?',
    mPatYes:      'Yes! Next comes',
    mPatLookAgain:'Look at the pattern again.',
    mLenLongQ:    'Tap the longer one.',
    mLenShortQ:   'Tap the shorter one.',
    mLenYesLong:  'Yes! This one is longer.',
    mLenYesShort: 'Yes! This one is shorter.'
  });

  /* ---------- (1) Sumas simples: 'count all' con dos grupos concretos ---------- */
  function roundMathAdd(){
    var t=UI[S.lang];
    var nWord=function(n){ return (S.lang==='es'?NUM_ES:NUM_EN)[n]||String(n); };
    var emoji=MATH_OBJ[rnd(MATH_OBJ.length)];
    var a=1+rnd(4), b=1+rnd(4);        // 1..4 cada sumando
    var sum=a+b;                        // 2..8
    var stage=$('stage'); stage.innerHTML='';

    var row=document.createElement('div'); row.className='opRow';
    var boxA=document.createElement('div'); boxA.className='countbox';
    var boxB=document.createElement('div'); boxB.className='countbox';
    var tapped=0;
    function mkObj(i){
      var o=document.createElement('div'); o.className='obj'; o.textContent=emoji; o.style.animationDelay=(i*60)+'ms';
      o.onclick=function(){
        if(o.classList.contains('counted')) return; o.classList.add('counted'); tapped++;
        var n=(S.lang==='es'?NUM_ES:NUM_EN)[tapped]||String(tapped);
        speak(n,{rate:0.95}); chime('ok');
      };
      return o;
    }
    for(var i=0;i<a;i++) boxA.appendChild(mkObj(i));
    for(var j=0;j<b;j++) boxB.appendChild(mkObj(a+j));
    var plus=document.createElement('div'); plus.className='opSign'; plus.textContent='+';
    var eq=document.createElement('div'); eq.className='opSign'; eq.textContent='=';
    var qbox=document.createElement('div'); qbox.className='opQBox'; qbox.textContent='?';
    row.appendChild(boxA); row.appendChild(plus); row.appendChild(boxB); row.appendChild(eq); row.appendChild(qbox);
    stage.appendChild(row);

    var wrongPool=[]; for(var n=1;n<=9;n++) if(n!==sum) wrongPool.push(n);
    var opts=shuffle([sum].concat(sample(wrongPool,2)));
    var ch=document.createElement('div'); ch.className='choices'; S.correctBtn=null;
    opts.forEach(function(n){
      var bt=document.createElement('button'); bt.className='choice'; bt.innerHTML='<span class="cnum">'+n+'</span>';
      if(n===sum) S.correctBtn=bt;
      bt.onclick=function(){
        if(n===sum){
          bt.classList.remove('reveal'); bt.classList.add('correct'); chime('ok');
          speakSeq([{t:t.mOpAddYes+' '+nWord(sum)+'.'},{t:t.mGreat}]);
          confetti(); afterCorrect('math-add-'+a+'-'+b);
        } else {
          onWrong(bt,function(lvl){
            if(lvl===1) speak(t.mOpCountAll);
            else if(lvl===3) speak(t.mItWas+' '+nWord(sum)+'. '+t.mTapGlow);
          });
        }
      };
      ch.appendChild(bt);
    });
    stage.appendChild(ch);

    var q=t.mOpAddQ;
    setPrompt(q,function(){ speak(q); });
    speak(q);
  }

  /* ---------- (2) Restas simples: grupo con objetos "tachados" (quitados) ---------- */
  function roundMathTake(){
    var t=UI[S.lang];
    var nWord=function(n){ return (S.lang==='es'?NUM_ES:NUM_EN)[n]||String(n); };
    var emoji=MATH_OBJ[rnd(MATH_OBJ.length)];
    var a=3+rnd(4);              // 3..6
    var b=1+rnd(a-1);            // 1..a-1
    var result=a-b;              // 1..5
    var stage=$('stage'); stage.innerHTML='';

    var box=document.createElement('div'); box.className='countbox';
    for(var i=0;i<a;i++){
      var o=document.createElement('div'); o.className='obj'+(i>=a-b?' takenAway':''); o.textContent=emoji; o.style.animationDelay=(i*60)+'ms';
      box.appendChild(o);
    }
    stage.appendChild(box);

    var wrongPool=[]; for(var n=0;n<=8;n++) if(n!==result) wrongPool.push(n);
    var opts=shuffle([result].concat(sample(wrongPool,2)));
    var ch=document.createElement('div'); ch.className='choices'; S.correctBtn=null;
    opts.forEach(function(n){
      var bt=document.createElement('button'); bt.className='choice'; bt.innerHTML='<span class="cnum">'+n+'</span>';
      if(n===result) S.correctBtn=bt;
      bt.onclick=function(){
        if(n===result){
          bt.classList.remove('reveal'); bt.classList.add('correct'); chime('ok');
          speakSeq([{t:t.mOpTakeYes+' '+nWord(result)+'.'},{t:t.mGreat}]);
          confetti(); afterCorrect('math-take-'+a+'-'+b);
        } else {
          onWrong(bt,function(lvl){
            if(lvl===1) speak(t.mOpCountLeft);
            else if(lvl===3) speak(t.mItWas+' '+nWord(result)+'. '+t.mTapGlow);
          });
        }
      };
      ch.appendChild(bt);
    });
    stage.appendChild(ch);

    var q=t.mThereAre+' '+nWord(a)+'. '+t.mTakeAway+' '+nWord(b)+'. '+t.mOpTakeQ;
    setPrompt(q,function(){ speak(q); });
    speak(q);
  }

  /* ---------- (3) Patrones: unidad repetida AB / AAB / ABC, ¿qué sigue? ---------- */
  function roundMathPattern(){
    var t=UI[S.lang];
    var types=['ab','aab','abc'];
    var type=types[rnd(types.length)];
    var need3=type==='abc';
    var pool=sample(MATH_OBJ, need3?3:2);
    var A=pool[0], B=pool[1], C=need3?pool[2]:null;
    var unit = type==='ab' ? [A,B] : type==='aab' ? [A,A,B] : [A,B,C];

    var shown=[]; for(var i=0;i<5;i++) shown.push(unit[i%unit.length]);
    var answer=unit[5%unit.length];

    var stage=$('stage'); stage.innerHTML='';
    var row=document.createElement('div'); row.className='patternRow';
    shown.forEach(function(em,i){
      var tile=document.createElement('div'); tile.className='patTile'; tile.textContent=em; tile.style.animationDelay=(i*70)+'ms';
      row.appendChild(tile);
    });
    var qTile=document.createElement('div'); qTile.className='patTile qmark'; qTile.textContent='❓'; qTile.style.animationDelay='420ms';
    row.appendChild(qTile);
    stage.appendChild(row);

    var symbols=[]; unit.forEach(function(e){ if(symbols.indexOf(e)<0) symbols.push(e); });
    var wrongChoices=symbols.filter(function(e){ return e!==answer; });
    var guard=0;
    while(wrongChoices.length<2 && guard<20){
      guard++;
      var extra=MATH_OBJ[rnd(MATH_OBJ.length)];
      if(extra!==answer && wrongChoices.indexOf(extra)<0 && symbols.indexOf(extra)<0) wrongChoices.push(extra);
    }
    wrongChoices=wrongChoices.slice(0,2);
    var opts=shuffle([answer].concat(wrongChoices));
    var ch=document.createElement('div'); ch.className='choices'; S.correctBtn=null;
    opts.forEach(function(em){
      var bt=document.createElement('button'); bt.className='choice'; bt.innerHTML='<span class="cface">'+em+'</span>';
      if(em===answer) S.correctBtn=bt;
      bt.onclick=function(){
        if(em===answer){
          bt.classList.remove('reveal'); bt.classList.add('correct'); chime('ok');
          speakSeq([{t:t.mPatYes},{t:t.mGreat}]);
          confetti(); afterCorrect('math-pat-'+type);
        } else {
          onWrong(bt,function(lvl){
            if(lvl===1) speak(t.mPatLookAgain);
            else if(lvl===3) speak(t.mPatYes+'. '+t.mTapGlow);
          });
        }
      };
      ch.appendChild(bt);
    });
    stage.appendChild(ch);

    var q=t.mPatQ;
    setPrompt(q,function(){ speak(q); });
    speak(q);
  }

  /* ---------- (4) Medición: dos "cintas" de distinta longitud, más larga/corta ---------- */
  function roundMathMeasure(){
    var t=UI[S.lang];
    var icons=['🐛','🐍','🪱','🎗️','🧵'];
    var icon=icons[rnd(icons.length)];
    var target=rnd(2)?'long':'short';
    var longW=190+rnd(50);   // 190..239px
    var shortW=70+rnd(40);   // 70..109px (siempre bien diferenciable de longW)
    var stage=$('stage'); stage.innerHTML='';

    var ch=document.createElement('div'); ch.className='choices measureRow'; S.correctBtn=null;
    shuffle([{len:'long',w:longW},{len:'short',w:shortW}]).forEach(function(g){
      var bt=document.createElement('button'); bt.className='choice measureBar'; bt.dataset.len=g.len;
      bt.innerHTML='<span class="mIcon">'+icon+'</span><span class="lenFill" style="width:'+g.w+'px"></span>';
      if(g.len===target) S.correctBtn=bt;
      bt.onclick=function(){
        if(g.len===target){
          bt.classList.remove('reveal'); bt.classList.add('correct'); chime('ok');
          speakSeq([{t: target==='long'?t.mLenYesLong:t.mLenYesShort},{t:t.mGreat}]);
          confetti(); afterCorrect('math-len-'+target);
        } else {
          onWrong(bt,function(lvl){
            if(lvl===1) speak(target==='long'?t.mLenLongQ:t.mLenShortQ);
            else if(lvl===3) speak((target==='long'?t.mLenYesLong:t.mLenYesShort)+' '+t.mTapGlow);
          });
        }
      };
      ch.appendChild(bt);
    });
    stage.appendChild(ch);

    var q=target==='long'?t.mLenLongQ:t.mLenShortQ;
    setPrompt(q,function(){ speak(q); });
    speak(q);
  }

  /* ---------- Selector de tipo ampliado (reasigna window.pickMathRound) ----------
     Nivel 0 (perfil recién creado, sin partidas): idéntico al pool original
     ['count','subitize'], byte-a-byte, para no alterar el comportamiento de
     ningún test/flujo existente que asuma sólo esos dos tipos en un perfil
     nuevo (mismo criterio que ya usaba 'compare' antes de esta mejora). */
  function pickMathRoundAdv(){
    var lv=(currentProfile()?(currentProfile().best.math||0):0)|0;
    var pool=['count','subitize'];
    if(lv>=1) pool.push('compare','pattern','measure');
    if(lv>=2) pool.push('add');
    if(lv>=3) pool.push('take');
    return pool[rnd(pool.length)];
  }

  var _roundMath = window.roundMath; // referencia previa, sólo como red de seguridad

  /* ---------- Dispatcher ampliado (reasigna window.roundMath) ---------- */
  function roundMathAdv(){
    var type=pickMathRoundAdv();
    if(type==='subitize') return roundMathSubitize();
    if(type==='compare')  return roundMathCompare();
    if(type==='pattern')  return roundMathPattern();
    if(type==='measure')  return roundMathMeasure();
    if(type==='add')      return roundMathAdd();
    if(type==='take')     return roundMathTake();
    if(type==='count')    return roundMathCount();
    return _roundMath ? _roundMath() : roundMathCount();
  }

  window.pickMathRound = pickMathRoundAdv;
  window.roundMath = roundMathAdv;

  /* API pública de solo-lectura para tests/tooling (no escribe en DB). */
  window.__mathAdv = {
    types: ['count','subitize','compare','pattern','measure','add','take'],
    pick: pickMathRoundAdv,
    roundMathAdd: roundMathAdd,
    roundMathTake: roundMathTake,
    roundMathPattern: roundMathPattern,
    roundMathMeasure: roundMathMeasure
  };
})();
