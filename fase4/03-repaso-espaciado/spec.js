"use strict";
/* ==================== FASE 4 · #3: Repaso espaciado (repaso-espaciado) ====================
   Curva del olvido (Ebbinghaus) + cajas de repetición espaciada (Leitner): los ítems que
   alguna vez costaron (intentos>1 o pista revelada) se reintroducen más adelante con
   intervalos CRECIENTES, medidos en "rondas jugadas por el perfil" (longitud de
   profile.ev[] en el momento de cada aparición del ítem), no en tiempo de reloj — no
   depende de que el dispositivo tenga la hora correcta ni de sesiones diarias.

   Scheduler 100% derivado de profile.ev[] (sin esquema nuevo persistido):
   - Se agrupan los eventos ya logueados por logRound()/afterCorrect() por su `k` (misma
     clave que ya usan aggregate()/topFails: 'math-5','math-sub-3','math-cmp','read-A',
     'sci-water','sci-diet-herb', etc).
   - Para cada clave con al menos un fallo histórico, se recorre su historial en orden y se
     avanza/reinicia una "caja" Leitner (acierto a la 1ª sin pista ⇒ sube de caja; fallo o
     pista revelada ⇒ vuelve a la caja 0). El intervalo de cada caja (en rondas jugadas)
     crece: 2 → 4 → 8 → 16 → 32.
   - Un ítem está "vencido" (due) cuando ya se jugaron, desde su última aparición, al menos
     tantas rondas como el intervalo de su caja actual.
   - Practicar un ítem de repaso vuelve a llamar a logRound() con la MISMA clave (`k`) y
     materia (`g`) que el ítem original: el repaso queda registrado como una repetición más
     de esa clave, así que el propio historial (profile.ev[]) recalcula automáticamente el
     siguiente vencimiento la próxima vez que se abra el panel. No hace falta ningún campo
     ni estructura nueva en el perfil.

   Dónde vive: nueva sección "Repaso espaciado" dentro del panel de Progreso del adulto
   (#progBody, ya existente), con su propio mini-juego autocontenido (elige el ítem,
   dibuja las opciones, reproduce la locución) que reutiliza las clases visuales ya
   existentes (.choices/.choice/.countbox/.obj/.lettertile/.animalBig/.habitat/.diet/
   .subitizeWrap) para que se vea igual que el juego principal, sin volver a abrir #stage
   ni tocar S.round/S.game/S.attempts/S.correctBtn/S.revealed (evita cualquier interferencia
   con una ronda real que pudiera quedar pausada detrás del panel de adultos).

   100% ADITIVO y offline:
   - NO reasigna window.speak/speakSeq/afterCorrect/nextRound (no hace falta): solo define
     window.* NUEVOS (window.srsCompute, window.__srs) y usa un MutationObserver sobre
     #progBody (mismo patrón que usa 01-eval-pre-post sobre el mismo host: ambos son
     idempotentes por id y componibles en cualquier orden) para repintar la sección cada
     vez que renderProgress2() reescribe el panel — sin definir/editar renderProgress2,
     showTab, passGate, aggregate, logRound, afterCorrect, nextRound, finishGame ni init.
   - Llama a funciones YA EXISTENTES tal cual (logRound, addStar, confetti, chime, speak,
     speakSeq, currentProfile, saveDB indirectamente vía logRound/addStar) exactamente como
     lo hace el propio juego; no las redefine.
   - i18n aditivo con Object.assign(UI.es,{...})/Object.assign(UI.en,{...}).
   - #langBtn se engancha solo con addEventListener (nunca .onclick=) para no romper la
     cadena de listeners ya registrados por otras extensiones.
   - Solo se anima transform/opacity (reutiliza @keyframes pop/goodPulse/shake/hintPulse ya
     existentes; las reglas nuevas de spec.css respetan prefers-reduced-motion).
   - Bajo file:// no se abre red: todo vive en profile.ev[] (ya persistido) + localStorage
     vía saveDB(), sin ninguna llamada fetch/XHR/WebSocket nueva.

   Evidencia: curva del olvido (Ebbinghaus 1885) · repetición espaciada con intervalos
   crecientes (Leitner) · la app ya mide precisión/pistas por ítem (aggregate()/topFails);
   este paquete cierra el ciclo reintroduciendo justo esos ítems en vez de solo mostrarlos
   como diagnóstico pasivo.
   ============================================================================ */
(function(){
  "use strict";

  /* ---------- 1) Scheduler: derivado 100% de profile.ev[] ---------- */
  var SRS_INTERVALS = [2, 4, 8, 16, 32]; // rondas jugadas antes del próximo repaso, por caja (0..4)

  function srsCompute(p){
    var ev = (p && p.ev) || [];
    var total = ev.length;
    var groups = {};
    ev.forEach(function(e, i){
      if(!e || !e.k) return;
      var list = groups[e.k] || (groups[e.k] = []);
      list.push({ g:e.g, ft:!!e.ft, as:!!e.as, at:e.at||1, idx:i });
    });
    var out = [];
    Object.keys(groups).forEach(function(key){
      var list = groups[key];
      var everFailed = list.some(function(e){ return e.at > 1 || e.as; });
      if(!everFailed) return; // solo reintroducimos ítems que alguna vez costaron
      var box = 0;
      list.forEach(function(e){
        if(e.ft && !e.as) box = Math.min(box + 1, SRS_INTERVALS.length - 1);
        else box = 0;
      });
      var last = list[list.length - 1];
      var interval = SRS_INTERVALS[box];
      var dueAtRound = last.idx + 1 + interval;
      var due = total >= dueAtRound;
      out.push({
        key: key, game: last.g, box: box, due: due, dueAtRound: dueAtRound,
        overdueBy: due ? (total - dueAtRound) : 0,
        roundsUntilDue: due ? 0 : (dueAtRound - total),
        lastSeen: last.idx
      });
    });
    out.sort(function(a, b){
      if(a.due !== b.due) return a.due ? -1 : 1;
      if(a.due) return b.overdueBy - a.overdueBy;      // más atrasado primero
      return a.roundsUntilDue - b.roundsUntilDue;       // el más próximo a vencer primero
    });
    return out;
  }

  /* ---------- 2) Interpretar una clave de log para reconstruir un ítem jugable ---------- */
  function findLetterAny(L){
    var e = LETTERS.es.find(function(x){ return x.L === L; });
    if(e) return { entry:e, lang:'es' };
    e = LETTERS.en.find(function(x){ return x.L === L; });
    if(e) return { entry:e, lang:'en' };
    return null;
  }
  function srsDescribeKey(key){
    if(key.indexOf('math-sub-') === 0){ var ns = parseInt(key.slice(9), 10); if(!isNaN(ns)) return { type:'sub', n:ns }; return null; }
    if(key.indexOf('math-cmp') === 0) return { type:'cmp' };
    if(key.indexOf('math-') === 0){ var nc = parseInt(key.slice(5), 10); if(!isNaN(nc)) return { type:'count', n:nc }; return null; }
    if(key.indexOf('read-') === 0) return { type:'letter', L:key.slice(5) };
    if(key.indexOf('sci-diet-') === 0) return { type:'diet', d:key.slice(9) };
    if(key.indexOf('sci-') === 0) return { type:'hab', h:key.slice(4) };
    return null;
  }
  function srsPlayable(desc){
    if(!desc) return false;
    if(desc.type === 'count') return desc.n >= 1 && desc.n <= 9;
    if(desc.type === 'sub') return desc.n >= 2 && desc.n <= 6;
    if(desc.type === 'cmp') return true;
    if(desc.type === 'letter') return !!findLetterAny(desc.L);
    if(desc.type === 'diet') return !!(typeof DIET_CAT !== 'undefined' && DIET_CAT[desc.d]);
    if(desc.type === 'hab') return !!HAB[desc.h];
    return false;
  }

  /* ---------- 3) Estado local de la sesión de repaso (independiente de S.*) ---------- */
  var srsState = { queue:[], idx:0, itemState:null, active:false, gen:0 };

  /* Réplica local de onWrong(): usa su propio contador de intentos (itemState), nunca
     S.attempts/S.correctBtn/S.revealed, para no interferir con una ronda real que
     pudiera quedar pausada detrás del panel de adultos. Sí lee S.guide (ajuste
     compartido de solo lectura, igual que hace el resto de la app). */
  function srsOnWrong(btn, hintFn, st){
    st.attempts++;
    btn.classList.add('wrong');
    try{ chime('no'); }catch(e){}
    setTimeout(function(){ btn.classList.remove('wrong'); }, 450);
    if(!S.guide) return;
    if(st.attempts === 1){ if(hintFn) hintFn(1); }
    else if(st.attempts === 2){ if(hintFn) hintFn(2); }
    if(st.attempts >= 2 && st.correctBtn && !st.revealed){
      st.revealed = true; st.correctBtn.classList.add('reveal'); if(hintFn) hintFn(3);
    }
  }

  function srsItemCorrect(item, st){
    if(st.resolved) return; st.resolved = true;
    var attempts = st.attempts + 1, firstTry = (st.attempts === 0), ms = now() - st.start;
    try{ logRound(item.game, item.key, firstTry, attempts, ms, st.revealed); }catch(e){}
    try{ addStar(); }catch(e){}
    srsAdvance();
  }

  function srsAdvance(){
    var gen = srsState.gen;
    srsState.idx++;
    if(srsState.idx >= srsState.queue.length){ finishSession(srsState.queue.length); return; }
    setTimeout(function(){ if(gen !== srsState.gen) return; renderCurrentItem(); }, 1100);
  }

  function finishSession(count){
    var t = UI[S.lang];
    srsState.active = false;
    var playEl = $('srsPlay'), doneEl = $('srsDone'), doneTxt = $('srsDoneTxt');
    if(playEl) playEl.style.display = 'none';
    if(doneEl) doneEl.style.display = 'block';
    if(doneTxt) doneTxt.textContent = t.srsDoneTitle + ' ' + t.srsDoneMsg + ' ' + count + ' ' + t.srsItemsWord + '.';
    var gen = srsState.gen;
    setTimeout(function(){ if(gen !== srsState.gen) return; paintSrsIntro(); }, 1600);
  }

  function srsExit(){
    srsState.gen = (srsState.gen || 0) + 1;
    srsState.active = false;
    paintSrsIntro();
  }

  function setSrsPrompt(text, sayFn){
    var el = $('srsPromptTxt'); if(el) el.textContent = text;
    srsState.replay = sayFn;
  }

  function buildDots(){
    var host = $('srsDots'); if(!host) return;
    host.innerHTML = '';
    srsState.queue.forEach(function(_, i){
      var d = document.createElement('div');
      d.className = 'dot' + (i < srsState.idx ? ' done' : i === srsState.idx ? ' cur' : '');
      host.appendChild(d);
    });
  }

  /* ---------- 4) Constructores de ronda por tipo (mismas clases visuales que el juego) ---------- */
  function srsBuildCount(item, st){
    var t = UI[S.lang];
    var n = item.desc.n;
    var emoji = MATH_OBJ[rnd(MATH_OBJ.length)];
    var stage = $('srsStage');
    var box = document.createElement('div'); box.className = 'countbox'; var tapped = 0;
    for(let i = 0; i < n; i++){
      const o = document.createElement('div'); o.className = 'obj'; o.textContent = emoji; o.style.animationDelay = (i * 60) + 'ms';
      o.onclick = function(){ if(o.classList.contains('counted')) return; o.classList.add('counted'); tapped++; var nm = (S.lang === 'es' ? NUM_ES : NUM_EN)[tapped] || String(tapped); speak(nm, { rate:0.95 }); chime('ok'); };
      box.appendChild(o);
    }
    stage.appendChild(box);
    var wrongPool = []; for(var w = 1; w <= 9; w++) if(w !== n) wrongPool.push(w);
    var opts = shuffle([n].concat(sample(wrongPool, 2)));
    var ch = document.createElement('div'); ch.className = 'choices';
    opts.forEach(function(num){
      var b = document.createElement('button'); b.className = 'choice'; b.innerHTML = '<span class="cnum">' + num + '</span>';
      if(num === n) st.correctBtn = b;
      b.onclick = function(){
        if(num === n){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          var nmw = (S.lang === 'es' ? NUM_ES : NUM_EN)[n];
          speakSeq([{ t:(S.lang === 'es' ? ('¡Sí! Hay ' + nmw + '.') : ('Yes! There are ' + nmw + '.')) }, { t:t.mGreat }]);
          confetti(); srsItemCorrect(item, st);
        } else {
          srsOnWrong(b, function(lvl){
            if(lvl === 1) speak(S.lang === 'es' ? 'Cuéntalos otra vez, toca cada uno.' : 'Count again, tap each one.');
            else if(lvl === 3) speak(S.lang === 'es' ? ('Mira, son ' + ((S.lang === 'es' ? NUM_ES : NUM_EN)[n]) + '.') : ('Look, it is ' + ((S.lang === 'es' ? NUM_ES : NUM_EN)[n]) + '.'));
          }, st);
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q = S.lang === 'es' ? '¿Cuántos hay? Tócalos para contar.' : 'How many are there? Tap to count.';
    setSrsPrompt(q, function(){ speak(q); }); speak(q);
  }

  function srsBuildSubitize(item, st){
    var t = UI[S.lang];
    var n = item.desc.n;
    var emoji = MATH_OBJ[rnd(MATH_OBJ.length)];
    var nWord = function(x){ return (S.lang === 'es' ? NUM_ES : NUM_EN)[x] || String(x); };
    var stage = $('srsStage');
    var wrap = document.createElement('div'); wrap.className = 'subitizeWrap';
    var box = document.createElement('div'); box.className = 'countbox';
    for(let i = 0; i < n; i++){ const o = document.createElement('div'); o.className = 'obj'; o.textContent = emoji; o.style.animationDelay = (i * 50) + 'ms'; box.appendChild(o); }
    wrap.appendChild(box);
    var veil = document.createElement('div'); veil.className = 'veil'; veil.textContent = '👀'; veil.setAttribute('aria-hidden', 'true');
    wrap.appendChild(veil);
    stage.appendChild(wrap);
    var flashTimer = null;
    function peek(){ clearTimeout(flashTimer); wrap.classList.remove('veiled'); flashTimer = setTimeout(function(){ wrap.classList.add('veiled'); }, 1200); }
    veil.onclick = peek;
    var wrongPool = []; for(var w = 2; w <= 6; w++) if(w !== n) wrongPool.push(w);
    var opts = shuffle([n].concat(sample(wrongPool, 2)));
    var ch = document.createElement('div'); ch.className = 'choices';
    opts.forEach(function(num){
      var b = document.createElement('button'); b.className = 'choice'; b.innerHTML = '<span class="cnum">' + num + '</span>';
      if(num === n) st.correctBtn = b;
      b.onclick = function(){
        if(num === n){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([{ t:t.mSubYes + ' ' + nWord(n) + '.' }, { t:t.mGreat }]);
          confetti(); srsItemCorrect(item, st);
        } else {
          srsOnWrong(b, function(lvl){
            if(lvl === 1){ peek(); speak(t.mLookAgain); }
            else if(lvl === 3){ peek(); speak(t.mItWas + ' ' + nWord(n) + '. ' + t.mTapGlow); }
          }, st);
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q = t.mSubQ;
    setSrsPrompt(q, function(){ peek(); speak(q); }); peek(); speak(q);
  }

  function srsBuildCompare(item, st){
    var t = UI[S.lang];
    var emoji = MATH_OBJ[rnd(MATH_OBJ.length)];
    var nWord = function(x){ return (S.lang === 'es' ? NUM_ES : NUM_EN)[x] || String(x); };
    var a = 2 + rnd(4), b; do{ b = 2 + rnd(4); }while(b === a);
    var hi = Math.max(a, b);
    var stage = $('srsStage');
    var ch = document.createElement('div'); ch.className = 'choices compare';
    shuffle([{ n:a }, { n:b }]).forEach(function(g){
      var btn = document.createElement('button'); btn.className = 'choice groupChoice';
      var gb = document.createElement('div'); gb.className = 'countbox';
      for(let i = 0; i < g.n; i++){ const o = document.createElement('div'); o.className = 'obj'; o.textContent = emoji; o.style.animationDelay = (i * 50) + 'ms'; gb.appendChild(o); }
      btn.appendChild(gb);
      var more = g.n === hi;
      if(more) st.correctBtn = btn;
      btn.onclick = function(){
        if(more){
          btn.classList.remove('reveal'); btn.classList.add('correct'); chime('ok');
          speakSeq([{ t:t.mCmpYes }, { t:t.mThereAre + ' ' + nWord(g.n) + '.' }]);
          confetti(); srsItemCorrect(item, st);
        } else {
          srsOnWrong(btn, function(lvl){
            if(lvl === 1) speak(t.mCountEach);
            else if(lvl === 3) speak(t.mMoreHere + ' ' + t.mTapGlow);
          }, st);
        }
      };
      ch.appendChild(btn);
    });
    stage.appendChild(ch);
    var q = t.mCmpQ;
    setSrsPrompt(q, function(){ speak(q); }); speak(q);
  }

  function srsBuildLetter(item, st){
    var found = findLetterAny(item.desc.L); if(!found) return;
    var target = found.entry, lang = found.lang;
    var pool = LETTERS[lang];
    var others = sample(pool.filter(function(x){ return x.L !== target.L; }), Math.min(2, pool.length - 1));
    var opts = shuffle([target].concat(others));
    var stage = $('srsStage');
    var tile = document.createElement('div'); tile.className = 'lettertile'; tile.textContent = target.L; stage.appendChild(tile);
    var ch = document.createElement('div'); ch.className = 'choices';
    opts.forEach(function(o){
      var b = document.createElement('button'); b.className = 'choice'; b.innerHTML = '<span class="cface">' + o.emoji + '</span>';
      if(o.L === target.L) st.correctBtn = b;
      b.onclick = function(){
        if(o.L === target.L){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          speakSeq([{ t:(lang === 'es' ? ('¡Sí! ' + target.word + ' empieza con ' + target.L + '.') : ('Yes! ' + target.word + ' starts with ' + target.L + '.')), lang:lang }, { t:target.sound + '... ' + target.word, rate:0.8, lang:lang }]);
          confetti(); srsItemCorrect(item, st);
        } else {
          srsOnWrong(b, function(lvl){
            if(lvl === 1) speak(lang === 'es' ? ('Escucha: ' + target.sound + '. ¿Cuál empieza así?') : ('Listen: ' + target.sound + '. Which starts like that?'), { lang:lang });
            else if(lvl === 3) speakSeq([{ t:(lang === 'es' ? ('Es ' + target.word + '.') : ('It is ' + target.word + '.')), lang:lang }, { t:target.sound, rate:0.8, lang:lang }]);
          }, st);
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var say = function(){ speakSeq([{ t:(lang === 'es' ? ('La letra ' + target.L) : ('The letter ' + target.L)), lang:lang }, { t:target.sound, rate:0.8, lang:lang }, { t:(lang === 'es' ? ('¿Qué empieza con ' + target.L + '?') : ('What starts with ' + target.L + '?')), lang:lang }]); };
    var q = lang === 'es' ? ('¿Qué empieza con ' + target.L + '?') : ('What starts with ' + target.L + '?');
    setSrsPrompt(q, say); say();
  }

  function srsBuildHabitat(item, st){
    var h = item.desc.h;
    var pool = ANIMALS.filter(function(a){ return a.hab === h; });
    var a = pool[rnd(pool.length)]; if(!a) return;
    var stage = $('srsStage');
    var big = document.createElement('div'); big.className = 'animalBig'; big.textContent = a.emoji; stage.appendChild(big);
    var ch = document.createElement('div'); ch.className = 'choices habitats';
    ['water', 'land', 'sky'].forEach(function(hh){
      var b = document.createElement('button'); b.className = 'choice habitat ' + hh;
      b.innerHTML = '<span class="cface">' + HAB[hh].emoji + '</span><span class="clabel">' + HAB[hh][S.lang] + '</span>';
      if(hh === a.hab) st.correctBtn = b;
      b.onclick = function(){
        if(hh === a.hab){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          var name = a[S.lang]; var place = HAB[a.hab][S.lang].toLowerCase();
          speakSeq([{ t:(S.lang === 'es' ? (name + ' vive en ' + (a.hab === 'sky' ? 'el cielo' : a.hab === 'water' ? 'el agua' : 'la tierra') + '.') : ('Yes! ' + name + ' lives in the ' + place + '.')) }, { t:(S.lang === 'es' ? '¡Excelente!' : 'Well done!') }]);
          confetti(); srsItemCorrect(item, st);
        } else {
          srsOnWrong(b, function(lvl){
            if(lvl === 1) speak(S.lang === 'es' ? ('¿Dónde vive ' + a[S.lang].toLowerCase() + '?') : ('Where does ' + a.en.toLowerCase() + ' live?'));
            else if(lvl === 3) speak(S.lang === 'es' ? ('Vive en ' + (a.hab === 'sky' ? 'el cielo' : a.hab === 'water' ? 'el agua' : 'la tierra') + '.') : ('It lives in the ' + HAB[a.hab].en.toLowerCase() + '.'));
          }, st);
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q = S.lang === 'es' ? ('¿Dónde vive ' + a.es.toLowerCase() + '?') : ('Where does ' + a.en.toLowerCase() + ' live?');
    setSrsPrompt(q, function(){ speak(q); }); speak(q);
  }

  function srsBuildDiet(item, st){
    var d = item.desc.d;
    var pool = ANIMALS.filter(function(a){ return typeof DIET !== 'undefined' && DIET[a.emoji] === d; });
    var a = pool[rnd(pool.length)]; if(!a) return;
    var stage = $('srsStage');
    var big = document.createElement('div'); big.className = 'animalBig'; big.textContent = a.emoji; stage.appendChild(big);
    var ch = document.createElement('div'); ch.className = 'choices diets';
    shuffle(['herb', 'carn']).forEach(function(dd){
      var b = document.createElement('button'); b.className = 'choice diet ' + dd;
      b.innerHTML = '<span class="cface">' + DIET_CAT[dd].emoji + '</span><span class="clabel">' + DIET_CAT[dd][S.lang] + '</span>';
      if(dd === d) st.correctBtn = b;
      b.onclick = function(){
        if(dd === d){
          b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
          var name = a[S.lang]; var eats = S.lang === 'es' ? (d === 'herb' ? 'come plantas.' : 'come carne.') : (d === 'herb' ? 'eats plants.' : 'eats meat.');
          speakSeq([{ t:name + ' ' + eats }, { t:(S.lang === 'es' ? '¡Excelente!' : 'Well done!') }]);
          confetti(); srsItemCorrect(item, st);
        } else {
          srsOnWrong(b, function(lvl){
            if(lvl === 1) speak(S.lang === 'es' ? ('¿Qué come ' + a.es.toLowerCase() + '?') : ('What does ' + a.en.toLowerCase() + ' eat?'));
            else if(lvl === 3){ var hint = S.lang === 'es' ? (d === 'herb' ? 'Come plantas.' : 'Come carne.') : (d === 'herb' ? 'It eats plants.' : 'It eats meat.'); speak(hint); }
          }, st);
        }
      };
      ch.appendChild(b);
    });
    stage.appendChild(ch);
    var q = S.lang === 'es' ? ('¿Qué come ' + a.es.toLowerCase() + '?') : ('What does ' + a.en.toLowerCase() + ' eat?');
    setSrsPrompt(q, function(){ speak(q); }); speak(q);
  }

  function renderCurrentItem(){
    var item = srsState.queue[srsState.idx]; if(!item) return;
    var st = { attempts:0, correctBtn:null, revealed:false, start:now(), resolved:false };
    srsState.itemState = st;
    buildDots();
    var stage = $('srsStage'); if(stage) stage.innerHTML = '';
    if(item.desc.type === 'count') srsBuildCount(item, st);
    else if(item.desc.type === 'sub') srsBuildSubitize(item, st);
    else if(item.desc.type === 'cmp') srsBuildCompare(item, st);
    else if(item.desc.type === 'letter') srsBuildLetter(item, st);
    else if(item.desc.type === 'diet') srsBuildDiet(item, st);
    else if(item.desc.type === 'hab') srsBuildHabitat(item, st);
  }

  function srsStart(){
    var p = (typeof currentProfile === 'function') ? currentProfile() : null; if(!p) return;
    var due = srsCompute(p).filter(function(e){ return e.due; });
    var queue = [];
    for(var i = 0; i < due.length && queue.length < 6; i++){
      var desc = srsDescribeKey(due[i].key);
      if(srsPlayable(desc)) queue.push({ key:due[i].key, game:due[i].game, desc:desc });
    }
    if(!queue.length) return;
    srsState.gen = (srsState.gen || 0) + 1;
    srsState.queue = queue; srsState.idx = 0; srsState.active = true;
    var introEl = $('srsIntro'), playEl = $('srsPlay'), doneEl = $('srsDone');
    if(introEl) introEl.style.display = 'none';
    if(doneEl) doneEl.style.display = 'none';
    if(playEl) playEl.style.display = 'block';
    buildDots();
    renderCurrentItem();
  }

  /* ---------- 5) i18n aditivo (no toca literales existentes) ---------- */
  Object.assign(UI.es, {
    srsTitle:    'Repaso espaciado',
    srsSub:      'Vuelve a preguntar lo que costó la primera vez, con más tiempo entre cada repaso.',
    srsReady:    'ítems listos para repasar',
    srsPending:  'en revisión, aún no toca',
    srsNoneDue:  'Por ahora nada pendiente de repasar. ¡Vuelve más tarde!',
    srsStart:    '🔁 Practicar ahora',
    srsExit:     'Salir del repaso',
    srsDoneTitle:'¡Repaso terminado!',
    srsDoneMsg:  'Reforzaste',
    srsItemsWord:'ítems'
  });
  Object.assign(UI.en, {
    srsTitle:    'Spaced review',
    srsSub:      'Re-asks what was tricky the first time, with more time between each review.',
    srsReady:    'items ready to review',
    srsPending:  'in review, not due yet',
    srsNoneDue:  'Nothing due to review right now. Check back soon!',
    srsStart:    '🔁 Practice now',
    srsExit:     'Exit review',
    srsDoneTitle:'Review complete!',
    srsDoneMsg:  'You reinforced',
    srsItemsWord:'items'
  });

  /* ---------- 6) Construcción/pintado del panel dentro de #progBody ---------- */
  function ensureSrsSkeleton(host){
    if($('srsPanel')) return false;
    var html =
      '<div id="srsPanel">' +
        '<div class="eduHead" id="srsHead"></div>' +
        '<p class="sub" id="srsSubTxt"></p>' +
        '<div id="srsIntro">' +
          '<div class="statgrid" id="srsStats" style="display:none"></div>' +
          '<div class="empty" id="srsNoneMsg" style="display:none"></div>' +
          '<button class="btn" id="srsStartBtn" type="button" style="width:100%;margin-top:10px;display:none"></button>' +
        '</div>' +
        '<div id="srsPlay" style="display:none">' +
          '<div class="progress srsDots" id="srsDots"></div>' +
          '<div class="srsPromptRow"><button class="speak" id="srsReplayBtn" type="button" aria-label="🔊">🔊</button><p class="srsMiniPrompt" id="srsPromptTxt"></p></div>' +
          '<div class="srsStage" id="srsStage"></div>' +
          '<button class="btn ghost" id="srsExitBtn" type="button" style="width:100%;margin-top:10px"></button>' +
        '</div>' +
        '<div id="srsDone" style="display:none"><div class="empty" id="srsDoneTxt"></div></div>' +
      '</div>';
    host.insertAdjacentHTML('beforeend', html);
    var sb = $('srsStartBtn'); if(sb) sb.addEventListener('click', srsStart);
    var eb = $('srsExitBtn'); if(eb) eb.addEventListener('click', srsExit);
    var rb = $('srsReplayBtn'); if(rb) rb.addEventListener('click', function(){ if(srsState.replay) srsState.replay(); });
    return true;
  }

  /* Etiquetas estáticas que viven FUERA de #srsIntro (#srsHead/#srsSubTxt son
     hermanos de #srsIntro/#srsPlay/#srsDone dentro de #srsPanel, así que
     siguen visibles también durante una sesión activa) y el botón de salir
     (#srsExitBtn, dentro de #srsPlay). Se actualizan siempre al cambiar de
     idioma, esté o no una sesión en curso. */
  function paintSrsChrome(){
    var t = UI[S.lang];
    var headEl = $('srsHead'), subEl = $('srsSubTxt'), exitBtn = $('srsExitBtn');
    if(headEl) headEl.textContent = t.srsTitle;
    if(subEl) subEl.textContent = t.srsSub;
    if(exitBtn) exitBtn.textContent = t.srsExit;
  }

  function paintSrsIntro(){
    var t = UI[S.lang];
    var p = (typeof currentProfile === 'function') ? currentProfile() : null;
    paintSrsChrome();
    var introEl = $('srsIntro'), playEl = $('srsPlay'), doneEl = $('srsDone');
    if(introEl) introEl.style.display = 'block';
    if(playEl) playEl.style.display = 'none';
    if(doneEl) doneEl.style.display = 'none';
    var entries = p ? srsCompute(p) : [];
    var due = entries.filter(function(e){ return e.due; });
    var pending = entries.length - due.length;
    var statsHost = $('srsStats'), noneMsg = $('srsNoneMsg'), startBtn = $('srsStartBtn');
    if(due.length > 0){
      if(statsHost){
        statsHost.style.display = 'grid';
        statsHost.innerHTML =
          '<div class="stat"><div class="n">' + due.length + '</div><div class="l">' + eduEsc(t.srsReady) + '</div></div>' +
          '<div class="stat"><div class="n">' + pending + '</div><div class="l">' + eduEsc(t.srsPending) + '</div></div>';
      }
      if(noneMsg) noneMsg.style.display = 'none';
      if(startBtn){ startBtn.style.display = 'block'; startBtn.textContent = t.srsStart; }
    } else {
      if(statsHost){ statsHost.style.display = 'none'; statsHost.innerHTML = ''; }
      if(noneMsg){ noneMsg.style.display = 'block'; noneMsg.textContent = t.srsNoneDue; }
      if(startBtn) startBtn.style.display = 'none';
    }
  }

  function paintSrs(){
    var host = $('progBody'); if(!host) return;
    var already = !!$('srsPanel');
    if(!already){
      if(host.querySelector('.empty')) return;              // renderProgress2: "aún no hay datos"
      var p = (typeof currentProfile === 'function') ? currentProfile() : null; if(!p) return;
      if(!srsCompute(p).length) return;                      // nunca falló nada: no mostrar la sección
      ensureSrsSkeleton(host);
    }
    if(!srsState.active) paintSrsIntro();
  }

  var __srsObsBound = false;
  function bindSrsObserver(){
    var host = $('progBody'); if(!host || __srsObsBound) return;
    __srsObsBound = true;
    var obs = new MutationObserver(function(){ paintSrs(); });
    obs.observe(host, { childList:true });
  }

  /* #langBtn: SOLO addEventListener (nunca .onclick=) para no romper la cadena de
     listeners ya registrados por otras extensiones (regla del patrón de extensión). */
  var __lb = $('langBtn');
  if(__lb) __lb.addEventListener('click', function(){
    requestAnimationFrame(function(){
      if(!$('srsPanel')) return;
      if(srsState.active){ paintSrsChrome(); renderCurrentItem(); }  // re-genera el ítem actual en el nuevo idioma (igual que toggleLang con una ronda real)
      else paintSrsIntro();
    });
  });

  bindSrsObserver();
  paintSrs();

  /* ---------- 7) API pública (integración / tests) ---------- */
  window.srsCompute = srsCompute;
  window.__srs = {
    compute: srsCompute,
    due: function(p){ return srsCompute(p || ((typeof currentProfile === 'function') ? currentProfile() : null)).filter(function(e){ return e.due; }); },
    intervals: SRS_INTERVALS.slice(),
    start: srsStart,
    exit: srsExit,
    isActive: function(){ return !!srsState.active; },
    currentItem: function(){ return srsState.active ? srsState.queue[srsState.idx] : null; },
    tapCorrect: function(){ var st = srsState.itemState; if(st && st.correctBtn) st.correctBtn.click(); },
    tapWrong: function(){
      var host = $('srsStage'); if(!host) return;
      var st = srsState.itemState; if(!st) return;
      var btns = host.querySelectorAll('.choice');
      for(var i = 0; i < btns.length; i++){ if(btns[i] !== st.correctBtn){ btns[i].click(); return; } }
    },
    paint: paintSrs
  };
})();
