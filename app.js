"use strict";
/* ================= Pequeñautas · Sprint 1 =================
   + Persistencia + perfiles por niño
   + Analítica de aprendizaje (panel del adulto)
   + Pistas progresivas (feedback andamiado por intento)
   Evidencia: Hirsh-Pasek 2015 · Callaghan 2021 · NAEYC 2022 · AAP · Lepper 1973
   ========================================================= */

/* ---------- persistencia ---------- */
const STORE_KEY='pequenautas.v1';
let DB={profiles:[],currentId:null};
function loadDB(){ try{ const r=localStorage.getItem(STORE_KEY); if(r){ const p=JSON.parse(r); if(p&&p.profiles) DB=p; } }catch(e){} }
function saveDB(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }catch(e){/* fallback en memoria */} }
function newId(){ return 'p'+Date.now().toString(36)+Math.floor(performance.now()%1000); }
function currentProfile(){ return DB.profiles.find(p=>p.id===DB.currentId)||null; }

/* ---------- estado de sesión ---------- */
const S={ lang:'es', screen:'profiles', sound:true, anim:true, guide:true,
  game:null, round:0, totalRounds:5,
  attempts:0, roundStart:0, roundLogged:false, correctBtn:null, revealed:false, gatePending:null };

const AVATARS=['🦊','🐼','🐰','🐸','🦁','🐯','🐧','🐨','🐵','🐷'];
let newAvatar=AVATARS[0];

/* ---------- textos ---------- */
const UI={
  es:{ tagline:'Aprende jugando', math:'Números', read:'Letras', sci:'Animales', adult:'Para grandes',
    celTitle:'¡Lo lograste!', celSub:'¡Ganaste una estrella!', celHome:'Inicio', celAgain:'Otra vez',
    gateTitle:'Solo para grandes', gateSub:'Toca y mantén presionado el botón para entrar.', hold:'Mantén presionado', holdNum:'Mantén presionado 👇',
    tabProg:'Progreso', tabSet:'Ajustes', progTitle:'Progreso', progSub:'Cómo va tu peque.',
    setSoundN:'Voz y sonidos', setSoundD:'Narración y efectos', setAnimN:'Animaciones extra', setAnimD:'Confeti y celebraciones',
    setGuideN:'Pistas guiadas', setGuideD:'Ayuda progresiva al fallar',
    tip:'💡 AAP: acompaña a tu peque, sesiones de 10–15 min. El aprendizaje es mayor con un adulto al lado.',
    close:'Listo', switch:'Cambiar de niño', pTitle:'¿Quién juega?', pSub:'Elige tu perfil',
    newTitle:'Nuevo peque', newSub:'Elige un avatar y un nombre.', create:'¡Listo!', namePH:'Nombre', level:'Nivel', add:'Agregar',
    stStars:'Estrellas', stRounds:'Rondas', stFirst:'Aciertos a la 1ª', stTime:'Tiempo medio', stFocus:'A reforzar', mAcc:'Aciertos', noData:'Aún no hay datos. ¡A jugar!', mSubQ:"¿Cuántos había?", mSubYes:"¡Sí! Había", mGreat:"¡Muy bien!", mLookAgain:"Mira otra vez, cuenta despacio.", mItWas:"Eran", mTapGlow:"Toca el que brilla.", mCmpQ:"¿Cuál grupo tiene más?", mCmpYes:"¡Sí! Este grupo tiene más.", mThereAre:"Hay", mCountEach:"Cuenta cada grupo, toca el que tiene más.", mMoreHere:"Aquí hay más.", introTap:"¡Toca para jugar!", sessLimitName:"Límite de sesión saludable", sessLimitDesc:"Una pausa amable para descansar (recomendado en niños de 3 a 5 años).", sessMinsName:"Duración de la sesión", sessMinsDesc:"Tiempo de juego antes de un descanso.", breakTitle:"¡Hora de descansar!", breakMsg:"Jugaste muy bien. Descansemos los ojos, estrírate un poquito y volvemos pronto.", breakRest:"Ok, a descansar", breakAdult:"Un adulto continúa", breakGatePrompt:"Para continuar, resuelve la suma.", restBye:"¡Nos vemos pronto!", pwaInstall:"Instalar app", tabEdu:"Educador", eduTitle:"Panel del educador", eduSub:"Resumen de todos los niños de este dispositivo.", eduGlobal:"Resumen global", eduChildren:"Niños", eduPerChild:"Por niño", eduNoRounds:"Sin rondas todavía", eduExport:"Exportar CSV", },
  en:{ tagline:'Learn by playing', math:'Numbers', read:'Letters', sci:'Animals', adult:'For grown-ups',
    celTitle:'You did it!', celSub:'You earned a star!', celHome:'Home', celAgain:'Again',
    gateTitle:'Grown-ups only', gateSub:'Tap and hold the button to enter.', hold:'Press and hold', holdNum:'Press and hold 👇',
    tabProg:'Progress', tabSet:'Settings', progTitle:'Progress', progSub:'How your child is doing.',
    setSoundN:'Voice & sounds', setSoundD:'Narration and effects', setAnimN:'Extra animations', setAnimD:'Confetti & celebrations',
    setGuideN:'Guided hints', setGuideD:'Progressive help on mistakes',
    tip:'💡 AAP: co-play with your child, 10–15 min sessions. Learning is greater with a grown-up alongside.',
    close:'Done', switch:'Switch child', pTitle:'Who is playing?', pSub:'Choose your profile',
    newTitle:'New child', newSub:'Pick an avatar and a name.', create:'Done!', namePH:'Name', level:'Level', add:'Add',
    stStars:'Stars', stRounds:'Rounds', stFirst:'First-try correct', stTime:'Avg time', stFocus:'To practice', mAcc:'Accuracy', noData:'No data yet. Let’s play!', mSubQ:"How many were there?", mSubYes:"Yes! There were", mGreat:"Great job!", mLookAgain:"Look again, count slowly.", mItWas:"There were", mTapGlow:"Tap the glowing one.", mCmpQ:"Which group has more?", mCmpYes:"Yes! This group has more.", mThereAre:"There are", mCountEach:"Count each group, tap the one with more.", mMoreHere:"Here there are more.", introTap:"Tap to play!", sessLimitName:"Healthy session limit", sessLimitDesc:"A gentle break to rest (recommended for ages 3 to 5).", sessMinsName:"Session length", sessMinsDesc:"Play time before a break.", breakTitle:"Time for a break!", breakMsg:"You played so well. Let's rest our eyes, stretch a little and come back soon.", breakRest:"Okay, let's rest", breakAdult:"A grown-up continues", breakGatePrompt:"To continue, solve the sum.", restBye:"See you soon!", pwaInstall:"Install app", tabEdu:"Educator", eduTitle:"Educator panel", eduSub:"Overview of every child on this device.", eduGlobal:"Overall summary", eduChildren:"Children", eduPerChild:"By child", eduNoRounds:"No rounds yet", eduExport:"Export CSV", }
};

/* ---------- contenido ---------- */
const MATH_OBJ=['🍎','🐟','⭐','🦋','🌸','🐢','🍌','🐥'];
const MATH_LEVELS=[[1,3],[2,4],[3,5],[4,6],[5,7]];
const LETTERS={
  es:[{L:'A',emoji:'🌳',word:'Árbol',sound:'aaa'},{L:'E',emoji:'🐘',word:'Elefante',sound:'eee'},{L:'O',emoji:'🐻',word:'Oso',sound:'ooo'},{L:'M',emoji:'🍎',word:'Manzana',sound:'mmm'},{L:'S',emoji:'☀️',word:'Sol',sound:'sss'},{L:'L',emoji:'🌙',word:'Luna',sound:'lll'},{L:'P',emoji:'🐶',word:'Perro',sound:'ppp'},{L:'C',emoji:'🏠',word:'Casa',sound:'ca'}],
  en:[{L:'A',emoji:'🍎',word:'Apple',sound:'aa'},{L:'B',emoji:'⚽',word:'Ball',sound:'buh'},{L:'C',emoji:'🐱',word:'Cat',sound:'kuh'},{L:'D',emoji:'🐶',word:'Dog',sound:'duh'},{L:'F',emoji:'🐟',word:'Fish',sound:'fff'},{L:'S',emoji:'☀️',word:'Sun',sound:'sss'},{L:'M',emoji:'🌙',word:'Moon',sound:'mmm'},{L:'O',emoji:'🐙',word:'Octopus',sound:'ah'}]
};
const ANIMALS=[{emoji:'🐟',hab:'water',es:'El pez',en:'The fish'},{emoji:'🐬',hab:'water',es:'El delfín',en:'The dolphin'},{emoji:'🐙',hab:'water',es:'El pulpo',en:'The octopus'},{emoji:'🐳',hab:'water',es:'La ballena',en:'The whale'},{emoji:'🐘',hab:'land',es:'El elefante',en:'The elephant'},{emoji:'🦁',hab:'land',es:'El león',en:'The lion'},{emoji:'🐰',hab:'land',es:'El conejo',en:'The rabbit'},{emoji:'🐶',hab:'land',es:'El perro',en:'The dog'},{emoji:'🦋',hab:'sky',es:'La mariposa',en:'The butterfly'},{emoji:'🐝',hab:'sky',es:'La abeja',en:'The bee'},{emoji:'🦅',hab:'sky',es:'El águila',en:'The eagle'},{emoji:'🐦',hab:'sky',es:'El pájaro',en:'The bird'}];
const HAB={water:{emoji:'💧',es:'Agua',en:'Water'},land:{emoji:'🌳',es:'Tierra',en:'Land'},sky:{emoji:'☁️',es:'Cielo',en:'Sky'}};

/* ---------- audio ---------- */
let audioCtx=null;
function ac(){ if(!audioCtx){ try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return audioCtx; }
function chime(type){ if(!S.sound) return; const c=ac(); if(!c) return; const notes=type==='ok'?[523,659,784]:[392,330]; notes.forEach((f,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(c.destination); const t=c.currentTime+i*0.09; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.14,t+0.03); g.gain.exponentialRampToValueAtTime(0.0001,t+0.28); o.start(t); o.stop(t+0.3); }); }
let voices=[];
function loadVoices(){ voices=window.speechSynthesis?speechSynthesis.getVoices():[]; }
if(window.speechSynthesis){ loadVoices(); speechSynthesis.onvoiceschanged=loadVoices; }
function pickVoice(lang){ const pref=lang==='es'?['es-ES','es-MX','es-US','es']:['en-US','en-GB','en']; for(const p of pref){ const v=voices.find(v=>v.lang&&v.lang.toLowerCase().startsWith(p.toLowerCase())); if(v) return v; } return null; }
function speak(text,opts){ opts=opts||{}; if(!S.sound||!window.speechSynthesis||!text) return; const lang=opts.lang||S.lang; try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang=lang==='es'?'es-ES':'en-US'; const v=pickVoice(lang); if(v)u.voice=v; u.rate=opts.rate||0.92; u.pitch=opts.pitch||1.12; speechSynthesis.speak(u); }catch(e){} }
function speakSeq(parts){ if(!S.sound||!window.speechSynthesis) return; speechSynthesis.cancel(); parts.forEach(p=>{ if(!p||!p.t) return; const u=new SpeechSynthesisUtterance(p.t); const lang=p.lang||S.lang; u.lang=lang==='es'?'es-ES':'en-US'; const v=pickVoice(lang); if(v)u.voice=v; u.rate=p.rate||0.9; u.pitch=p.pitch||1.12; speechSynthesis.speak(u); }); }

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
const rnd=n=>Math.floor(Math.random()*n);
const shuffle=a=>{const b=a.slice();for(let i=b.length-1;i>0;i--){const j=rnd(i+1);const t=b[i];b[i]=b[j];b[j]=t;}return b;};
const sample=(a,n)=>shuffle(a).slice(0,n);
const NUM_ES=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve'];
const NUM_EN=['zero','one','two','three','four','five','six','seven','eight','nine'];
function now(){ return (window.performance&&performance.now)?performance.now():0; }

/* ---------- analítica ---------- */
function logRound(game,key,firstTry,attempts,ms,assisted){
  const p=currentProfile(); if(!p) return;
  if(!p.ev) p.ev=[];
  p.ev.push({g:game,k:key,ft:firstTry?1:0,at:attempts,ms:Math.round(ms),as:assisted?1:0});
  if(p.ev.length>400) p.ev=p.ev.slice(-400);
  saveDB();
}
function aggregate(p){
  const ev=p.ev||[]; const rounds=ev.length;
  const first=ev.filter(e=>e.ft).length;
  const avg=rounds?ev.reduce((s,e)=>s+e.ms,0)/rounds:0;
  const byGame={math:{r:0,err:0},reading:{r:0,err:0},science:{r:0,err:0}};
  const fails={};
  ev.forEach(e=>{ const g=byGame[e.g]; if(g){ g.r++; if(e.at>1||e.as) g.err++; } if(e.at>1){ fails[e.k]=(fails[e.k]||0)+(e.at-1); } });
  const topFails=Object.keys(fails).map(k=>({k,c:fails[k]})).sort((a,b)=>b.c-a.c).slice(0,3);
  return {rounds,firstRate:rounds?first/rounds:0,avg,byGame,topFails};
}

/* ---------- navegación ---------- */
function show(screen){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active','enter'));
  const el=$(screen); el.classList.add('active','enter'); S.screen=screen;
  const inGame=screen==='game';
  $('homeBtn').hidden=!inGame; $('backBtn').hidden=!inGame;
  const showChrome = screen!=='profiles';
  $('profileChip').hidden=!showChrome;
  $('starBox').style.display=showChrome?'':'none';
}
function goHome(){ if(window.speechSynthesis) speechSynthesis.cancel(); refreshHome(); show('home'); }

/* ---------- perfiles ---------- */
function renderProfiles(){
  const t=UI[S.lang]; $('pTitle').textContent=t.pTitle; $('pSub').textContent=t.pSub;
  const host=$('plist'); host.innerHTML='';
  DB.profiles.forEach((p,i)=>{
    const b=document.createElement('button'); b.className='pcard'; b.style.animationDelay=(i*70)+'ms';
    b.innerHTML=`<span class="av">${eduEsc(p.avatar)}</span><span class="nm">${eduEsc(p.name)}</span><span class="st">⭐ ${p.stars||0}</span>`;
    b.onclick=()=>selectProfile(p.id);
    host.appendChild(b);
  });
  const add=document.createElement('button'); add.className='pcard add'; add.style.animationDelay=(DB.profiles.length*70)+'ms';
  add.innerHTML=`<span class="av">➕</span><span class="nm">${t.add}</span>`;
  add.onclick=openNewProfile;
  host.appendChild(add);
}
function selectProfile(id){ DB.currentId=id; saveDB(); ac(); syncChip(); goHome(); }
function syncChip(){ const p=currentProfile(); if(!p) return; $('chipAv').textContent=p.avatar; $('chipNm').textContent=p.name; $('starCount').textContent=p.stars||0; }
function openNewProfile(){ newAvatar=AVATARS[0]; renderAvatarPicker(); $('nameInput').value=''; showSheetView('newView'); $('sheet').classList.add('show'); }
function renderAvatarPicker(){ const host=$('avpick'); host.innerHTML=''; AVATARS.forEach(a=>{ const b=document.createElement('button'); b.className='avopt'+(a===newAvatar?' sel':''); b.textContent=a; b.onclick=()=>{ newAvatar=a; renderAvatarPicker(); }; host.appendChild(b); }); }
function createProfile(){
  const t=UI[S.lang];
  let name=($('nameInput').value||'').trim();
  if(!name){ name=(S.lang==='es'?'Peque ':'Kid ')+(DB.profiles.length+1); }
  const p={id:newId(),avatar:newAvatar,name:name,stars:0,best:{math:0,reading:0,science:0},ev:[],seenIntro:false};
  DB.profiles.push(p); DB.currentId=p.id; saveDB();
  $('sheet').classList.remove('show');
  syncChip(); renderProfiles(); goHome();
}

/* ---------- home ---------- */
function refreshHome(){
  const p=currentProfile(); if(!p) return;
  const t=UI[S.lang];
  $('lvMath').textContent=t.level+' '+((p.best.math||0)+1);
  $('lvRead').textContent=t.level+' '+((p.best.reading||0)+1);
  $('lvSci').textContent=t.level+' '+((p.best.science||0)+1);
  syncChip();
}

/* ---------- juego ---------- */
function startGame(g){ S.game=g; S.round=0; show('game'); nextRound(); maybeShowIntro(); }
function renderProgress(){ const p=$('progress'); p.innerHTML=''; for(let i=0;i<S.totalRounds;i++){ const d=document.createElement('div'); d.className='dot'+(i<S.round?' done':i===S.round?' cur':''); p.appendChild(d);} }
function nextRound(){ if(S.round>=S.totalRounds){ finishGame(); return; } renderProgress(); S.attempts=0; S.revealed=false; S.roundLogged=false; S.roundStart=now(); if(S.game==='math') roundMath(); else if(S.game==='reading') roundReading(); else renderScienceRound(); }
function afterCorrect(key){
  if(!S.roundLogged){ logRound(S.game,key,S.attempts===0,S.attempts+1,now()-S.roundStart,S.revealed); S.roundLogged=true; }
  S.round++; addStar(); renderProgress(); setTimeout(nextRound,1150);
}
function addStar(){ const p=currentProfile(); if(p){ p.stars=(p.stars||0)+1; saveDB(); $('starCount').textContent=p.stars; } const box=$('starBox'); box.animate([{transform:'scale(1)'},{transform:'scale(1.22)'},{transform:'scale(1)'}],{duration:420,easing:'cubic-bezier(0.23,1,0.32,1)'}); }
function finishGame(){ const p=currentProfile(); if(p){ const lv=p.best[S.game]||0; if(lv<MATH_LEVELS.length-1){ p.best[S.game]=lv+1; saveDB(); } } celebrate(); }

/* pista progresiva: revela la respuesta correcta tras 2 fallas */
function onWrong(btn,hintFn){
  S.attempts++;
  btn.classList.add('wrong'); chime('no');
  setTimeout(()=>btn.classList.remove('wrong'),450);
  if(!S.guide) return;
  if(S.attempts===1){ if(hintFn) hintFn(1); }
  else if(S.attempts===2){ if(hintFn) hintFn(2); }
  if(S.attempts>=2 && S.correctBtn && !S.revealed){ S.revealed=true; S.correctBtn.classList.add('reveal'); if(hintFn) hintFn(3); }
}

function roundMathCount(){
  const lvl=MATH_LEVELS[Math.min((currentProfile()?currentProfile().best.math:0),MATH_LEVELS.length-1)];
  const count=lvl[0]+rnd(lvl[1]-lvl[0]+1);
  const emoji=MATH_OBJ[rnd(MATH_OBJ.length)];
  const stage=$('stage'); stage.innerHTML='';
  const box=document.createElement('div'); box.className='countbox'; let tapped=0;
  for(let i=0;i<count;i++){ const o=document.createElement('div'); o.className='obj'; o.textContent=emoji; o.style.animationDelay=(i*70)+'ms'; o.onclick=()=>{ if(o.classList.contains('counted')) return; o.classList.add('counted'); tapped++; const n=(S.lang==='es'?NUM_ES:NUM_EN)[tapped]||String(tapped); speak(n,{rate:0.95}); chime('ok'); }; box.appendChild(o); }
  stage.appendChild(box);
  const wrongPool=[]; for(let n=1;n<=9;n++) if(n!==count) wrongPool.push(n);
  const opts=shuffle([count].concat(sample(wrongPool,2)));
  const ch=document.createElement('div'); ch.className='choices'; S.correctBtn=null;
  opts.forEach(n=>{ const b=document.createElement('button'); b.className='choice'; b.innerHTML='<span class="cnum">'+n+'</span>'; if(n===count) S.correctBtn=b;
    b.onclick=()=>{ if(n===count){ b.classList.remove('reveal'); b.classList.add('correct'); chime('ok'); const nm=(S.lang==='es'?NUM_ES:NUM_EN)[count]; speakSeq([{t:(S.lang==='es'?('¡Sí! Hay '+nm+'.'):('Yes! There are '+nm+'.'))},{t:(S.lang==='es'?'¡Muy bien!':'Great job!')}]); confetti(); afterCorrect('math-'+count); }
      else{ onWrong(b,(lvl)=>{ if(lvl===1) speak(S.lang==='es'?'Cuéntalos otra vez, toca cada uno.':'Count again, tap each one.'); else if(lvl===3) speak(S.lang==='es'?('Mira, son '+((S.lang==='es'?NUM_ES:NUM_EN)[count])+'. Toca el número que brilla.'):('Look, it is '+((S.lang==='es'?NUM_ES:NUM_EN)[count])+'. Tap the glowing number.')); }); } };
    ch.appendChild(b); });
  stage.appendChild(ch);
  const q=S.lang==='es'?'¿Cuántos hay? Toca para contar.':'How many are there? Tap to count.';
  setPrompt(q,()=>speak(q)); speak(q);
}
function roundReading(){
  const set=LETTERS[S.lang]; const target=set[rnd(set.length)]; const others=sample(set.filter(x=>x.L!==target.L),2); const opts=shuffle([target].concat(others));
  const stage=$('stage'); stage.innerHTML='';
  const tile=document.createElement('div'); tile.className='lettertile'; tile.textContent=target.L; stage.appendChild(tile);
  const ch=document.createElement('div'); ch.className='choices'; S.correctBtn=null;
  opts.forEach(o=>{ const b=document.createElement('button'); b.className='choice'; b.innerHTML='<span class="cface">'+o.emoji+'</span>'; if(o.L===target.L) S.correctBtn=b;
    b.onclick=()=>{ if(o.L===target.L){ b.classList.remove('reveal'); b.classList.add('correct'); chime('ok'); speakSeq([{t:(S.lang==='es'?('¡Sí! '+target.word+' empieza con '+target.L+'.'):('Yes! '+target.word+' starts with '+target.L+'.'))},{t:target.sound+'... '+target.word,rate:0.8}]); confetti(); afterCorrect('read-'+target.L); }
      else{ onWrong(b,(lvl)=>{ if(lvl===1) speak(S.lang==='es'?('Escucha: '+target.sound+'. ¿Cuál empieza así?'):('Listen: '+target.sound+'. Which starts like that?')); else if(lvl===3) speakSeq([{t:(S.lang==='es'?('Es '+target.word+'.'):('It is '+target.word+'.'))},{t:target.sound,rate:0.8}]); }); } };
    ch.appendChild(b); });
  stage.appendChild(ch);
  const say=()=>speakSeq([{t:(S.lang==='es'?('La letra '+target.L):('The letter '+target.L))},{t:target.sound,rate:0.8},{t:(S.lang==='es'?('¿Qué empieza con '+target.L+'?'):('What starts with '+target.L+'?'))}]);
  const q=S.lang==='es'?('¿Qué empieza con  '+target.L+' ?'):('What starts with  '+target.L+' ?');
  setPrompt(q,say); say();
}
function roundScience(){
  const a=ANIMALS[rnd(ANIMALS.length)];
  const stage=$('stage'); stage.innerHTML='';
  const big=document.createElement('div'); big.className='animalBig'; big.textContent=a.emoji; stage.appendChild(big);
  const ch=document.createElement('div'); ch.className='choices habitats'; S.correctBtn=null;
  ['water','land','sky'].forEach(h=>{ const b=document.createElement('button'); b.className='choice habitat '+h; b.innerHTML='<span class="cface">'+HAB[h].emoji+'</span><span class="clabel">'+HAB[h][S.lang]+'</span>'; if(h===a.hab) S.correctBtn=b;
    b.onclick=()=>{ if(h===a.hab){ b.classList.remove('reveal'); b.classList.add('correct'); chime('ok'); const name=a[S.lang]; const place=HAB[a.hab][S.lang].toLowerCase(); speakSeq([{t:(S.lang==='es'?(name+' vive en '+(a.hab==='sky'?'el cielo':a.hab==='water'?'el agua':'la tierra')+'.'):('Yes! '+name+' lives in the '+place+'.'))},{t:(S.lang==='es'?'¡Excelente!':'Well done!')}]); confetti(); afterCorrect('sci-'+a.hab); }
      else{ onWrong(b,(lvl)=>{ if(lvl===1) speak(S.lang==='es'?('¿Dónde vive '+a[S.lang].toLowerCase()+'?'):('Where does '+a.en.toLowerCase()+' live?')); else if(lvl===3) speak(S.lang==='es'?('Vive en '+(a.hab==='sky'?'el cielo':a.hab==='water'?'el agua':'la tierra')+'. Toca el que brilla.'):('It lives in the '+HAB[a.hab].en.toLowerCase()+'. Tap the glowing one.')); }); } };
    ch.appendChild(b); });
  stage.appendChild(ch);
  const q=S.lang==='es'?('¿Dónde vive '+a.es.toLowerCase()+'?'):('Where does '+a.en.toLowerCase()+' live?');
  setPrompt(q,()=>speak(q)); speak(q);
}
function setPrompt(text,sayFn){ $('promptText').innerHTML=text.replace(/\s\s(.+?)\s\s/,' <span class="big">$1</span> '); $('replayBtn').onclick=()=>{ if(sayFn) sayFn(); }; }

/* ---------- celebración ---------- */
function celebrate(){ const t=UI[S.lang]; $('celTitle').textContent=t.celTitle; $('celSub').textContent=t.celSub; $('celHomeTxt').textContent=t.celHome; $('celAgainTxt').textContent=t.celAgain; $('trophyEmoji').textContent=['🏆','🎉','🌟','🎈'][rnd(4)]; $('celebrate').classList.add('show'); speakSeq([{t:(S.lang==='es'?'¡Lo lograste!':'You did it!')},{t:(S.lang==='es'?'¡Eres increíble!':'You are amazing!')}]); if(S.anim) burst(60); }
function endCelebrate(again){ $('celebrate').classList.remove('show'); if(again){ startGame(S.game); } else { goHome(); } }
function confetti(){ if(S.anim) burst(14); }
function burst(n){ if(!S.anim) return; const emojis=['⭐','🎉','✨','🌟','💫','🎈']; const host=$('app'); for(let i=0;i<n;i++){ const c=document.createElement('div'); c.className='confetti'; c.textContent=emojis[rnd(emojis.length)]; const x=10+Math.random()*80; c.style.left=x+'vw'; c.style.top='-6vh'; host.appendChild(c); const dx=(Math.random()*2-1)*120; const dur=1400+Math.random()*900; c.animate([{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:'translate('+dx+'px, 108vh) rotate('+((Math.random()*2-1)*540)+'deg)',opacity:.9}],{duration:dur,easing:'cubic-bezier(0.32,0.72,0,1)'}).onfinish=()=>c.remove(); } }

/* ---------- idioma ---------- */
function applyLang(){ const t=UI[S.lang]; document.documentElement.lang=S.lang;
  $('lgES').className=S.lang==='es'?'on':'off'; $('lgEN').className=S.lang==='en'?'on':'off';
  $('tagline').textContent=t.tagline; $('lblMath').textContent=t.math; $('lblRead').textContent=t.read; $('lblSci').textContent=t.sci; $('lblAdult').textContent=t.adult;
  $('gateTitle').textContent=t.gateTitle; $('gateSub').textContent=t.gateSub; $('holdTxt').textContent=t.hold; $('gateNum').textContent=t.holdNum;
  $('tabProgTxt').textContent=t.tabProg; $('tabSetTxt').textContent=t.tabSet; $('progTitle').textContent=t.progTitle; $('progSub').textContent=t.progSub;
  $('setSoundN').textContent=t.setSoundN; $('setSoundD').textContent=t.setSoundD; $('setAnimN').textContent=t.setAnimN; $('setAnimD').textContent=t.setAnimD; $('setGuideN').textContent=t.setGuideN; $('setGuideD').textContent=t.setGuideD;
  $('tipText').textContent=t.tip; $('closeTxt').textContent=t.close; $('switchTxt').textContent=t.switch;
  $('newTitle').textContent=t.newTitle; $('newSub').textContent=t.newSub; $('createTxt').textContent=t.create; $('nameInput').placeholder=t.namePH;
  if(S.screen==='profiles') renderProfiles(); if(S.screen==='home') refreshHome();
  if(window.applySessionLang) applySessionLang(); if(window.paintInstall) paintInstall();
}
function toggleLang(){ S.lang=S.lang==='es'?'en':'es'; applyLang(); if(S.screen==='game'){ if(S.game==='math') roundMath(); else if(S.game==='reading') roundReading(); else renderScienceRound(); } speak(S.lang==='es'?'Español':'English'); }

/* ---------- sheet / gate / progreso ---------- */
let holdTimer=null;
function showSheetView(which){ ['gateView','adultView','newView'].forEach(v=>{ $(v).style.display = v===which?'block':'none'; }); }
function openAdult(){ S.gatePending=null; showSheetView('gateView'); $('sheet').classList.add('show'); }
function passGate(){ const act=S.gatePending; S.gatePending=null; if(act){ act(); } else { showSheetView('adultView'); showTab('prog'); } }
function showTab(which){ $('tabProg').classList.toggle('on',which==='prog'); $('tabSet').classList.toggle('on',which==='set'); $('progView').style.display=which==='prog'?'block':'none'; $('setView').style.display=which==='set'?'block':'none'; if(which==='prog') renderProgress2(); if(which==='set') syncToggles(); }
function syncToggles(){ $('tgSound').classList.toggle('on',S.sound); $('tgAnim').classList.toggle('on',S.anim); $('tgGuide').classList.toggle('on',S.guide); }
function renderProgress2(){
  const t=UI[S.lang]; const p=currentProfile(); const host=$('progBody');
  if(!p){ host.innerHTML='<div class="empty">'+t.noData+'</div>'; return; }
  const a=aggregate(p);
  if(a.rounds===0){ host.innerHTML='<div class="empty">'+t.noData+'</div>'; return; }
  const secs=(a.avg/1000).toFixed(1);
  const gname={math:t.math,reading:t.read,science:t.sci};
  let bars='';
  ['math','reading','science'].forEach(g=>{ const gg=a.byGame[g]; if(gg.r>0){ const acc=Math.round((1-gg.err/gg.r)*100); const col=g==='math'?'var(--math)':g==='reading'?'var(--read)':'var(--sci)'; bars+='<div class="bar"><div class="lab"><span>'+gname[g]+'</span><span>'+acc+'% '+t.mAcc.toLowerCase()+'</span></div><div class="track"><div class="fillb" style="width:'+acc+'%;background:'+col+'"></div></div></div>'; } });
  const faceOf=k=>{ if(k.indexOf('math-')===0) return '🔢 '+k.split('-')[1]; if(k.indexOf('read-')===0) return '🔤 '+k.split('-')[1]; if(k.indexOf('sci-diet-')===0){ const d=k.split('-')[2]; return DIET_CAT[d]?DIET_CAT[d].emoji+' '+DIET_CAT[d][S.lang]:k; } if(k.indexOf('sci-')===0){ const h=k.split('-')[1]; return HAB[h]?HAB[h].emoji+' '+HAB[h][S.lang]:k; } return k; };
  let fails=''; if(a.topFails.length){ fails='<div style="margin-top:16px"><div class="lab" style="font-size:13px;font-weight:600;color:var(--ink-soft);margin-bottom:2px">'+t.stFocus+'</div>'; a.topFails.forEach(f=>{ fails+='<div class="failitem"><span class="fx">'+faceOf(f.k).split(' ')[0]+'</span><span>'+faceOf(f.k).split(' ').slice(1).join(' ')+'</span><span class="fc">'+f.c+' ✗</span></div>'; }); fails+='</div>'; }
  host.innerHTML=
    '<div class="statgrid">'+
      '<div class="stat"><div class="n">⭐ '+(p.stars||0)+'</div><div class="l">'+t.stStars+'</div></div>'+
      '<div class="stat"><div class="n">'+a.rounds+'</div><div class="l">'+t.stRounds+'</div></div>'+
      '<div class="stat"><div class="n">'+Math.round(a.firstRate*100)+'%</div><div class="l">'+t.stFirst+'</div></div>'+
      '<div class="stat"><div class="n">'+secs+'s</div><div class="l">'+t.stTime+'</div></div>'+
    '</div>'+bars+fails;
}

/* ---------- eventos ---------- */
document.querySelectorAll('.subject').forEach(b=>{ b.addEventListener('click',()=>{ ac(); startGame(b.dataset.game); }); });
$('homeBtn').onclick=goHome;
$('backBtn').onclick=goHome;
$('profileChip').onclick=()=>requireGate(()=>{ $('sheet').classList.remove('show'); if(window.speechSynthesis) speechSynthesis.cancel(); renderProfiles(); show('profiles'); });
$('langBtn').onclick=toggleLang;
$('soundBtn').onclick=()=>{ S.sound=!S.sound; $('soundBtn').textContent=S.sound?'🔊':'🔇'; if(!S.sound&&window.speechSynthesis) speechSynthesis.cancel(); };
$('adultBtn').onclick=openAdult;
$('celHome').onclick=()=>endCelebrate(false);
$('celAgain').onclick=()=>endCelebrate(true);
$('closeSheet').onclick=()=>$('sheet').classList.remove('show');
$('sheet').onclick=(e)=>{ if(e.target===$('sheet')) $('sheet').classList.remove('show'); };
$('tabProg').onclick=()=>showTab('prog');
$('tabSet').onclick=()=>showTab('set');
$('tgSound').onclick=()=>{S.sound=!S.sound;syncToggles();$('soundBtn').textContent=S.sound?'🔊':'🔇';};
$('tgAnim').onclick=()=>{S.anim=!S.anim;syncToggles();};
$('tgGuide').onclick=()=>{S.guide=!S.guide;syncToggles();};
$('switchProfile').onclick=()=>{ $('sheet').classList.remove('show'); renderProfiles(); show('profiles'); };
$('createBtn').onclick=createProfile;
$('nameInput').addEventListener('keydown',e=>{ if(e.key==='Enter') createProfile(); });

const holdBtn=$('holdBtn');
function startHold(e){ e.preventDefault(); holdBtn.classList.add('holding'); holdTimer=setTimeout(()=>{ holdBtn.classList.remove('holding'); passGate(); },1200); }
function endHold(){ holdBtn.classList.remove('holding'); clearTimeout(holdTimer); }
holdBtn.addEventListener('pointerdown',startHold);
holdBtn.addEventListener('pointerup',endHold);
holdBtn.addEventListener('pointerleave',endHold);
holdBtn.addEventListener('pointercancel',endHold);



/* ==================== FASE 2: Matemáticas ampliadas ==================== */
/* ===================== Matemáticas ampliadas =====================
   Requiere: renombrar la función roundMath() existente a roundMathCount()
   (ver campo "integration"). Aquí se define el nuevo dispatcher roundMath()
   más las dos variantes. Reutiliza helpers/afterCorrect/onWrong/setPrompt. */

function pickMathRound(){
  const lv=(currentProfile()?(currentProfile().best.math||0):0)|0;
  const pool=['count','subitize'];
  if(lv>=1) pool.push('compare');
  return pool[rnd(pool.length)];
}

function roundMath(){
  const type=pickMathRound();
  if(type==='subitize') return roundMathSubitize();
  if(type==='compare')  return roundMathCompare();
  return roundMathCount();
}

function roundMathSubitize(){
  const t=UI[S.lang];
  const count=2+rnd(4);
  const emoji=MATH_OBJ[rnd(MATH_OBJ.length)];
  const nWord=n=>(S.lang==='es'?NUM_ES:NUM_EN)[n]||String(n);
  const stage=$('stage'); stage.innerHTML='';

  const wrap=document.createElement('div'); wrap.className='subitizeWrap';
  const box=document.createElement('div'); box.className='countbox';
  for(let i=0;i<count;i++){ const o=document.createElement('div'); o.className='obj'; o.textContent=emoji; o.style.animationDelay=(i*60)+'ms'; box.appendChild(o); }
  wrap.appendChild(box);
  const veil=document.createElement('div'); veil.className='veil'; veil.textContent='👀'; veil.setAttribute('aria-hidden','true');
  wrap.appendChild(veil);
  stage.appendChild(wrap);

  let flashTimer=null;
  function peek(){ clearTimeout(flashTimer); wrap.classList.remove('veiled'); flashTimer=setTimeout(()=>wrap.classList.add('veiled'),1200); }
  veil.onclick=peek;

  const wrongPool=[]; for(let n=2;n<=6;n++) if(n!==count) wrongPool.push(n);
  const opts=shuffle([count].concat(sample(wrongPool,2)));
  const ch=document.createElement('div'); ch.className='choices'; S.correctBtn=null;
  opts.forEach(n=>{
    const b=document.createElement('button'); b.className='choice'; b.innerHTML='<span class="cnum">'+n+'</span>';
    if(n===count) S.correctBtn=b;
    b.onclick=()=>{
      if(n===count){
        b.classList.remove('reveal'); b.classList.add('correct'); chime('ok');
        speakSeq([{t:t.mSubYes+' '+nWord(count)+'.'},{t:t.mGreat}]);
        confetti(); afterCorrect('math-sub-'+count);
      } else {
        onWrong(b,(lvl)=>{
          if(lvl===1){ peek(); speak(t.mLookAgain); }
          else if(lvl===3){ peek(); speak(t.mItWas+' '+nWord(count)+'. '+t.mTapGlow); }
        });
      }
    };
    ch.appendChild(b);
  });
  stage.appendChild(ch);

  const q=t.mSubQ;
  setPrompt(q,()=>{ peek(); speak(q); });
  peek(); speak(q);
}

function roundMathCompare(){
  const t=UI[S.lang];
  const emoji=MATH_OBJ[rnd(MATH_OBJ.length)];
  const nWord=n=>(S.lang==='es'?NUM_ES:NUM_EN)[n]||String(n);
  let a=2+rnd(4), b; do{ b=2+rnd(4); }while(b===a);
  const hi=Math.max(a,b);
  const stage=$('stage'); stage.innerHTML='';
  const ch=document.createElement('div'); ch.className='choices compare'; S.correctBtn=null;

  shuffle([{n:a},{n:b}]).forEach(g=>{
    const btn=document.createElement('button'); btn.className='choice groupChoice';
    const gb=document.createElement('div'); gb.className='countbox';
    for(let i=0;i<g.n;i++){ const o=document.createElement('div'); o.className='obj'; o.textContent=emoji; o.style.animationDelay=(i*60)+'ms'; gb.appendChild(o); }
    btn.appendChild(gb);
    const more=g.n===hi;
    if(more) S.correctBtn=btn;
    btn.onclick=()=>{
      if(more){
        btn.classList.remove('reveal'); btn.classList.add('correct'); chime('ok');
        speakSeq([{t:t.mCmpYes},{t:t.mThereAre+' '+nWord(g.n)+'.'}]);
        confetti(); afterCorrect('math-cmp');
      } else {
        onWrong(btn,(lvl)=>{
          if(lvl===1) speak(t.mCountEach);
          else if(lvl===3) speak(t.mMoreHere+' '+t.mTapGlow);
        });
      }
    };
    ch.appendChild(btn);
  });
  stage.appendChild(ch);

  const q=t.mCmpQ;
  setPrompt(q,()=>speak(q)); speak(q);
}


/* ==================== FASE 2: Ciencias ampliada ==================== */
const DIET={'🐟':'carn','🐬':'carn','🐙':'carn','🐳':'carn','🐘':'herb','🦁':'carn','🐰':'herb','🐶':'carn','🦋':'herb','🐝':'herb','🦅':'carn','🐦':'herb'};
const DIET_CAT={herb:{emoji:'🌿',es:'Plantas',en:'Plants'},carn:{emoji:'🍖',es:'Carne',en:'Meat'}};

function renderScienceRound(){ if(S.round%2===1) roundScienceDiet(); else roundScience(); }

function roundScienceDiet(){
  const pool=ANIMALS.filter(a=>DIET[a.emoji]); const a=pool[rnd(pool.length)]; const diet=DIET[a.emoji];
  const stage=$('stage'); stage.innerHTML='';
  const big=document.createElement('div'); big.className='animalBig'; big.textContent=a.emoji; stage.appendChild(big);
  const ch=document.createElement('div'); ch.className='choices diets'; S.correctBtn=null;
  shuffle(['herb','carn']).forEach(d=>{ const b=document.createElement('button'); b.className='choice diet '+d; b.innerHTML='<span class="cface">'+DIET_CAT[d].emoji+'</span><span class="clabel">'+DIET_CAT[d][S.lang]+'</span>'; if(d===diet) S.correctBtn=b;
    b.onclick=()=>{ if(d===diet){ b.classList.remove('reveal'); b.classList.add('correct'); chime('ok'); const name=a[S.lang]; const eats=S.lang==='es'?(diet==='herb'?'come plantas.':'come carne.'):(diet==='herb'?'eats plants.':'eats meat.'); speakSeq([{t:name+' '+eats},{t:(S.lang==='es'?'¡Excelente!':'Well done!')}]); confetti(); afterCorrect('sci-diet-'+diet); }
      else{ onWrong(b,(lvl)=>{ if(lvl===1) speak(S.lang==='es'?('¿Qué come '+a.es.toLowerCase()+'?'):('What does '+a.en.toLowerCase()+' eat?')); else if(lvl===3){ const hint=S.lang==='es'?(diet==='herb'?'Come plantas. Toca la hoja verde.':'Come carne. Toca la carne.'):(diet==='herb'?'It eats plants. Tap the green leaf.':'It eats meat. Tap the meat.'); speak(hint); } }); } };
    ch.appendChild(b); });
  stage.appendChild(ch);
  const q=S.lang==='es'?('¿Qué come '+a.es.toLowerCase()+'?'):('What does '+a.en.toLowerCase()+' eat?');
  setPrompt(q,()=>speak(q)); speak(q);
}


/* ==================== Onboarding sin texto + gate ==================== */
let coachDismiss=null;
function maybeShowIntro(){ const p=currentProfile(); if(!p||p.seenIntro) return; requestAnimationFrame(()=>requestAnimationFrame(showIntro)); }
function showIntro(){
  const p=currentProfile(); if(!p||p.seenIntro) return;
  if(S.screen!=='game') return;
  const target=document.querySelector('#stage .obj, #stage .choice'); if(!target) return;
  const coach=$('coach'); if(!coach) return;
  $('coachTxt').textContent=UI[S.lang].introTap;
  coach.classList.add('show');
  positionCoach(target);
  speak(UI[S.lang].introTap,{rate:0.95});
  window.addEventListener('resize',onCoachResize);
  coachDismiss=dismissIntro;
  $('game').addEventListener('pointerdown',coachDismiss,true);
}
function onCoachResize(){ const target=document.querySelector('#stage .obj, #stage .choice'); if(target) positionCoach(target); }
function positionCoach(target){
  const ar=$('app').getBoundingClientRect(); const r=target.getBoundingClientRect();
  const cx=r.left-ar.left+r.width/2, cy=r.top-ar.top+r.height/2, d=Math.max(r.width,r.height)+24;
  const ring=$('coachRing'), hand=$('coachHand');
  ring.style.left=cx+'px'; ring.style.top=cy+'px'; ring.style.width=d+'px'; ring.style.height=d+'px';
  hand.style.left=cx+'px'; hand.style.top=(cy+d/2)+'px';
}
function dismissIntro(){
  const coach=$('coach'); if(coach) coach.classList.remove('show');
  window.removeEventListener('resize',onCoachResize);
  if(coachDismiss){ $('game').removeEventListener('pointerdown',coachDismiss,true); coachDismiss=null; }
  const p=currentProfile(); if(p && !p.seenIntro){ p.seenIntro=true; saveDB(); }
  if(window.speechSynthesis) speechSynthesis.cancel();
}

function requireGate(action){ S.gatePending=action||null; showSheetView('gateView'); $('sheet').classList.add('show'); }


/* ==================== Límite de sesión saludable ==================== */
(function(){
  let sessMs = 0, sessLast = Date.now(), sessInt = null;

  function ensureSessCfg(){
    if(!DB.settings) DB.settings = {};
    if(!DB.settings.session) DB.settings.session = { on:true, mins:15 };
    const s = DB.settings.session;
    if(![10,15,20].includes(s.mins)) s.mins = 15;
    if(typeof s.on !== 'boolean') s.on = true;
    return s;
  }
  function sessCfg(){ return ensureSessCfg(); }

  function sessTick(){
    const s = sessCfg(), now = Date.now();
    if(S.screen === 'profiles'){ sessMs = 0; sessLast = now; return; }
    if(s.on && !document.hidden && !S.onBreak){ sessMs += now - sessLast; }
    sessLast = now;
    if(s.on && !S.onBreak && sessMs >= s.mins * 60000){ triggerBreak(); }
  }

  function buildBreakOverlay(){
    if($('breakOverlay')) return;
    const o = document.createElement('div');
    o.id = 'breakOverlay'; o.className = 'sheet breakOverlay'; o.hidden = true;
    o.setAttribute('role','dialog'); o.setAttribute('aria-modal','true');
    o.setAttribute('aria-labelledby','breakTitle');
    o.innerHTML =
      '<div class="panel breakPanel">'
      + '<div class="breakEmoji" aria-hidden="true">🌙</div>'
      + '<h2 id="breakTitle"></h2>'
      + '<p id="breakMsg" class="breakMsg"></p>'
      + '<button class="btn" id="breakRestBtn"></button>'
      + '<button class="btn ghost" id="breakAdultBtn"></button>'
      + '<div id="breakGate" class="breakGate" hidden>'
        + '<p id="breakGateQ" class="breakGateQ"></p>'
        + '<div class="choices" id="breakGateChoices"></div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(o);
    $('breakRestBtn').addEventListener('click', restEndSession);
    $('breakAdultBtn').addEventListener('click', renderBreakGate);
    applySessionLang();
  }

  function triggerBreak(){
    buildBreakOverlay();
    S.onBreak = true;
    $('breakGate').hidden = true;
    applySessionLang();
    const o = $('breakOverlay'); o.hidden = false;
    requestAnimationFrame(()=> o.classList.add('show'));
    const L = UI[S.lang];
    if(typeof speakSeq === 'function'){
      speakSeq([{t:L.breakTitle, lang:S.lang, rate:.95}, {t:L.breakMsg, lang:S.lang, rate:.95}]);
    } else if(typeof speak === 'function'){ speak(L.breakMsg, {lang:S.lang}); }
  }

  function restEndSession(){
    resetSession();
    hideBreakOverlay();
    if(typeof speak === 'function') speak(UI[S.lang].restBye, {lang:S.lang});
    if(typeof show === 'function') show('profiles');
    else if(typeof goHome === 'function') goHome();
  }

  function renderBreakGate(){
    const g = $('breakGate'); g.hidden = false;
    const a = 2 + rnd(6), b = 2 + rnd(6), ans = a + b;
    $('breakGateQ').textContent = a + ' + ' + b + ' = ?';
    const set = [ans];
    while(set.length < 3){ const d = ans + (rnd(5) - 2); if(d > 0 && set.indexOf(d) < 0) set.push(d); }
    const opts = shuffle(set), wrap = $('breakGateChoices'); wrap.innerHTML = '';
    opts.forEach(val=>{
      const btn = document.createElement('button');
      btn.className = 'btn ghost'; btn.textContent = val;
      btn.addEventListener('click', ()=>{
        if(val === ans){ resumeSessionAfterBreak(); }
        else { btn.classList.remove('shakeNo'); void btn.offsetWidth; btn.classList.add('shakeNo'); }
      });
      wrap.appendChild(btn);
    });
    if(typeof speak === 'function') speak(UI[S.lang].breakGatePrompt, {lang:S.lang});
  }

  function resetSession(){ sessMs = 0; sessLast = Date.now(); }

  function hideBreakOverlay(){
    const o = $('breakOverlay'); if(!o) return;
    o.classList.remove('show'); o.hidden = true;
    const g = $('breakGate'); if(g) g.hidden = true;
  }

  function resumeSessionAfterBreak(){
    S.onBreak = false; resetSession(); hideBreakOverlay();
  }

  function applySessionLang(){
    const L = UI[S.lang]; if(!L) return;
    const set = (id, txt)=>{ const el = $(id); if(el && txt != null) el.textContent = txt; };
    set('sessLimitName', L.sessLimitName); set('sessLimitDesc', L.sessLimitDesc);
    set('sessMinsName', L.sessMinsName);  set('sessMinsDesc', L.sessMinsDesc);
    set('breakTitle', L.breakTitle);      set('breakMsg', L.breakMsg);
    set('breakRestBtn', L.breakRest);     set('breakAdultBtn', L.breakAdult);
    syncSessionControls();
  }

  function syncSessionControls(){
    const s = sessCfg();
    const tg = $('sessLimitToggle');
    if(tg){ tg.classList.toggle('on', s.on); tg.setAttribute('aria-checked', String(s.on)); }
    const box = $('sessMinsChoices');
    if(box){
      box.querySelectorAll('button[data-mins]').forEach(b=>{
        const sel = Number(b.dataset.mins) === s.mins;
        b.classList.toggle('ghost', !sel);
        b.setAttribute('aria-pressed', String(sel));
      });
      box.classList.toggle('disabled', !s.on);
    }
  }

  function wireSessionControls(){
    const tg = $('sessLimitToggle');
    if(tg && !tg._wired){ tg._wired = true;
      tg.addEventListener('click', ()=>{ const s = sessCfg(); s.on = !s.on; if(s.on) resetSession(); saveDB(); syncSessionControls(); });
    }
    const box = $('sessMinsChoices');
    if(box && !box._wired){ box._wired = true;
      box.addEventListener('click', (e)=>{ const b = e.target.closest('button[data-mins]'); if(!b) return;
        const s = sessCfg(); s.mins = Number(b.dataset.mins); resetSession(); saveDB(); syncSessionControls(); });
    }
  }

  function initSessionLimit(){
    ensureSessCfg();
    wireSessionControls();
    applySessionLang();
    document.addEventListener('visibilitychange', ()=>{ sessLast = Date.now(); });
    if(sessInt) clearInterval(sessInt);
    sessInt = setInterval(sessTick, 1000);
  }

  window.initSessionLimit       = initSessionLimit;
  window.applySessionLang       = applySessionLang;
  window.syncSessionControls    = syncSessionControls;
  window.wireSessionControls    = wireSessionControls;
  window.resumeSessionAfterBreak= resumeSessionAfterBreak;
  window.resetSession           = resetSession;
  window.triggerSessionBreak    = triggerBreak;
})();


/* ==================== PWA + offline ==================== */
function registerPWA(){
  if(!('serviceWorker' in navigator)) return;
  var secure = location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1';
  if(!secure) return;
  var doReg=function(){ navigator.serviceWorker.register('./sw.js').catch(function(){}); };
  if(document.readyState==='complete') doReg(); else window.addEventListener('load', doReg);
}

var __deferredPrompt=null, __installBtn=null;
function __installLabel(){ return (UI[S.lang]&&UI[S.lang].pwaInstall) || (S.lang==='en'?'Install app':'Instalar app'); }
function paintInstall(){ if(!__installBtn) return; __installBtn.querySelector('.ip-txt').textContent=__installLabel(); __installBtn.setAttribute('aria-label', __installLabel()); }
function __ensureInstallBtn(){
  if(__installBtn) return __installBtn;
  __installBtn=document.createElement('button');
  __installBtn.id='installBtn'; __installBtn.type='button'; __installBtn.className='installPill';
  __installBtn.innerHTML='<span class="ip-ico" aria-hidden="true">🚀</span><span class="ip-txt"></span>';
  __installBtn.addEventListener('click', function(){
    if(!__deferredPrompt) return;
    __installBtn.classList.remove('show');
    var dp=__deferredPrompt; __deferredPrompt=null;
    try{ dp.prompt(); }catch(e){}
  });
  document.body.appendChild(__installBtn);
  paintInstall();
  return __installBtn;
}
function wirePWAInstall(){
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); __deferredPrompt=e; __ensureInstallBtn(); paintInstall(); __installBtn.classList.add('show'); });
  window.addEventListener('appinstalled', function(){ if(__installBtn) __installBtn.classList.remove('show'); __deferredPrompt=null; });
  var lb=$('langBtn'); if(lb) lb.addEventListener('click', paintInstall);
}

/* ---------- init ---------- */
loadDB();
applyLang();
if(DB.currentId && currentProfile()){ syncChip(); refreshHome(); show('home'); }
else { renderProfiles(); show('profiles'); }
if(location.protocol!=='file:'){ try{ var __ml=document.createElement('link'); __ml.rel='manifest'; __ml.href='./manifest.webmanifest'; document.head.appendChild(__ml); }catch(e){} }
try{ initSessionLimit(); }catch(e){}
try{ registerPWA(); wirePWAInstall(); }catch(e){}

/* ==================== Voces pregrabadas ES/EN (AudioBank + fallback TTS) ====================
   Infra ADITIVA y NO invasiva. Envuelve speak()/speakSeq(): si existe un clip de voz
   locutado para la clave dada (opts.key / part.key), reproduce audio/<lang>/<key>.mp3;
   si no, cae al Web Speech API original. Bajo file:// el banco queda INERTE (nunca toca
   red ni <audio>), por lo que los smoke tests en file:// se mantienen intactos y sin
   errores de consola. Los clips reales quedan pendientes de locución: 'available' está
   vacío hasta grabarlos; el runtime queda listo y el fallback TTS activo. */
(function(){
  "use strict";
  var MANIFEST = {
    version: 1,
    base: 'audio',
    ext:  'mp3',
    langs: ['es','en'],
    keys: {
      intro_tap:     { es:'¡Toca para jugar!',  en:'Tap to play!' },
      cheer_great:   { es:'¡Muy bien!',         en:'Great job!' },
      cheer_wow:     { es:'¡Excelente!',        en:'Well done!' },
      cheer_win:     { es:'¡Lo lograste!',      en:'You did it!' },
      cheer_amazing: { es:'¡Eres increíble!',   en:'You are amazing!' },
      lang_es:       { es:'Español',            en:'Español' },
      lang_en:       { es:'English',            en:'English' },
      break_title:   { es:'¡Hora de descansar!',en:'Time for a break!' },
      break_bye:     { es:'¡Nos vemos pronto!', en:'See you soon!' }
    },
    available: []
  };

  var ENABLED = (typeof location !== 'undefined') && location.protocol !== 'file:';
  var cache = {};

  function has(key, lang){
    if(!key) return false;
    if(MANIFEST.available.indexOf(key) < 0) return false;
    if(lang && MANIFEST.langs.indexOf(lang) < 0) return false;
    return true;
  }
  function urlFor(key, lang){ return MANIFEST.base + '/' + lang + '/' + key + '.' + MANIFEST.ext; }
  function el(key, lang){
    var k = lang + '/' + key, a = cache[k];
    if(!a){ a = new Audio(urlFor(key, lang)); a.preload = 'auto'; cache[k] = a; }
    return a;
  }
  function playClip(key, lang){
    return new Promise(function(resolve){
      lang = lang || (typeof S !== 'undefined' ? S.lang : 'es');
      if(!ENABLED || typeof S === 'undefined' || !S.sound || !has(key, lang)) return resolve(false);
      var a; try { a = el(key, lang); } catch(e){ return resolve(false); }
      var done = false;
      function fin(ok){ if(done) return; done = true; a.onended = a.onerror = null; resolve(ok); }
      a.onended = function(){ fin(true); };
      a.onerror = function(){ fin(false); };
      try { a.currentTime = 0; var pr = a.play(); if(pr && pr.then) pr.catch(function(){ fin(false); }); }
      catch(e){ fin(false); }
    });
  }

  var _speak    = (typeof speak    === 'function') ? speak    : null;
  var _speakSeq = (typeof speakSeq === 'function') ? speakSeq : null;

  function ttsPart(p, lang, done){
    if(typeof S === 'undefined' || !S.sound || !window.speechSynthesis || !p || !p.t){ return done(); }
    try {
      var u = new SpeechSynthesisUtterance(p.t);
      u.lang = lang === 'es' ? 'es-ES' : 'en-US';
      u.rate = p.rate || 0.9; u.pitch = p.pitch || 1.12;
      u.onend = function(){ done(); };
      u.onerror = function(){ done(); };
      speechSynthesis.speak(u);
    } catch(e){ done(); }
  }

  window.speak = function(text, opts){
    opts = opts || {};
    var lang = opts.lang || (typeof S !== 'undefined' ? S.lang : 'es');
    if(ENABLED && typeof S !== 'undefined' && S.sound && opts.key && has(opts.key, lang)){
      if(window.speechSynthesis){ try{ speechSynthesis.cancel(); }catch(e){} }
      playClip(opts.key, lang).then(function(ok){ if(!ok && _speak) _speak(text, opts); });
      return;
    }
    if(_speak) return _speak(text, opts);
  };

  window.speakSeq = function(parts){
    parts = parts || [];
    var useBank = ENABLED && typeof S !== 'undefined' && S.sound &&
      parts.some(function(p){ return p && p.key && has(p.key, (p.lang || S.lang)); });
    if(!useBank){ if(_speakSeq) return _speakSeq(parts); return; }
    if(window.speechSynthesis){ try{ speechSynthesis.cancel(); }catch(e){} }
    var i = 0;
    (function next(){
      if(i >= parts.length) return;
      var p = parts[i++]; if(!p || !p.t){ return next(); }
      var lang = p.lang || S.lang;
      if(p.key && has(p.key, lang)){
        playClip(p.key, lang).then(function(ok){ if(ok) next(); else ttsPart(p, lang, next); });
      } else { ttsPart(p, lang, next); }
    })();
  };

  function preload(lang){
    if(!ENABLED) return;
    lang = lang || (typeof S !== 'undefined' ? S.lang : 'es');
    MANIFEST.available.forEach(function(key){ if(has(key, lang)){ try{ el(key, lang); }catch(e){} } });
  }

  window.AudioBank = {
    enabled: ENABLED,
    manifest: MANIFEST,
    has: has,
    url: urlFor,
    play: playClip,
    preload: preload,
    keys: function(){ return Object.keys(MANIFEST.keys); },
    available: function(){ return MANIFEST.available.slice(); },
    missing: function(){ return Object.keys(MANIFEST.keys).filter(function(k){ return MANIFEST.available.indexOf(k) < 0; }); }
  };
})();


/* ==================== Estrategia bilingüe deliberada ====================
   Modo de idioma POR PERFIL (profile.langMode):
     - 'immersion' (por defecto): una sola lengua por sesión (sin conmutación
        automática). Reduce la carga cognitiva; el niño se sumerge en un código.
     - 'alternate' : alterna ES/EN por RONDA (nunca dos lenguas a la vez dentro
        de una ronda). Fomenta la transferencia translingüística sin sobrecargar.
     - 'mirror'    : al ACERTAR, refleja la palabra-clave del concepto en ambas
        lenguas (ES→EN). El etiquetado bilingüe queda anclado al momento de éxito.
   Infra 100% ADITIVA: envuelve afterCorrect()/nextRound() por reasignación de la
   propiedad global (mismo mecanismo que AudioBank usa con speak/speakSeq). No
   redefine helpers existentes. Bajo file:// no toca red; los smoke tests siguen
   verdes porque el modo por defecto ('immersion') no altera el flujo original.
   Evidencia: Cummins (transferencia translingüística) · García & Wei
   (translanguaging) · Bialystok (control ejecutivo) · carga cognitiva (Sweller). */
(function(){
  "use strict";
  var MODES=['immersion','alternate','mirror'];
  function bilMode(){ var p=(typeof currentProfile==='function')?currentProfile():null; var m=p&&p.langMode; return MODES.indexOf(m)>=0?m:'immersion'; }
  function other(l){ return l==='es'?'en':'es'; }

  function bilSyncChrome(){ try{ document.documentElement.lang=S.lang; var es=$('lgES'),en=$('lgEN'); if(es)es.className=S.lang==='es'?'on':'off'; if(en)en.className=S.lang==='en'?'on':'off'; }catch(e){} }

  function bilMirrorEcho(key){
    if(!key) return;
    var es=null,en=null,n;
    if(key.indexOf('math-sub-')===0){ n=parseInt(key.slice(9),10); es=NUM_ES[n]; en=NUM_EN[n]; }
    else if(key.indexOf('math-cmp')===0){ es='más'; en='more'; }
    else if(key.indexOf('math-')===0){ n=parseInt(key.slice(5),10); es=NUM_ES[n]; en=NUM_EN[n]; }
    else if(key.indexOf('read-')===0){ var L=key.slice(5); es=L; en=L; }
    else if(key.indexOf('sci-diet-')===0){ var d=key.slice(9); if(DIET_CAT[d]){ es=DIET_CAT[d].es; en=DIET_CAT[d].en; } }
    else if(key.indexOf('sci-')===0){ var h=key.slice(4); if(HAB[h]){ es=HAB[h].es; en=HAB[h].en; } }
    if(es==null||en==null) return;
    try{ speakSeq([{t:es,lang:'es',rate:0.85},{t:en,lang:'en',rate:0.85}]); }catch(e){}
  }

  function bilSync(){
    var box=$('bilModeChoices'); if(!box) return; var m=bilMode();
    box.querySelectorAll('button[data-mode]').forEach(function(b){
      var sel=b.dataset.mode===m; b.classList.toggle('ghost',!sel); b.setAttribute('aria-pressed',String(sel));
    });
  }

  window.applyBilingualLang=function(){
    var t=UI[S.lang]; if(!t) return;
    var set=function(id,txt){ var el=$(id); if(el&&txt!=null) el.textContent=txt; };
    set('bilModeName',t.bilModeName); set('bilModeDesc',t.bilModeDesc);
    var box=$('bilModeChoices');
    if(box){ var map={immersion:t.bilImmersion,alternate:t.bilAlternate,mirror:t.bilMirror};
      box.querySelectorAll('span[data-bil]').forEach(function(s){ var k=s.getAttribute('data-bil'); if(map[k]!=null) s.textContent=map[k]; }); }
    bilSync();
  };

  function initBilingual(){
    Object.assign(UI.es,{bilModeName:'Modo de idioma',bilModeDesc:'Cómo se combinan español e inglés',bilImmersion:'Inmersión',bilAlternate:'Alternado',bilMirror:'Espejo'});
    Object.assign(UI.en,{bilModeName:'Language mode',bilModeDesc:'How Spanish and English blend',bilImmersion:'Immersion',bilAlternate:'Alternate',bilMirror:'Mirror'});

    if(!window.__bilWrapped){ window.__bilWrapped=true;
      var _afterCorrect=window.afterCorrect;
      window.afterCorrect=function(key){ _afterCorrect(key); try{ if(bilMode()==='mirror') bilMirrorEcho(key); }catch(e){} };
      var _nextRound=window.nextRound;
      window.nextRound=function(){
        try{
          if(S.round===0) S.bilBase=S.lang;
          if(bilMode()==='alternate'){
            if(S.round>=S.totalRounds){
              if(S.bilBase&&S.lang!==S.bilBase){ S.lang=S.bilBase; bilSyncChrome(); }
            } else {
              var tgt=(S.round%2===0)?S.bilBase:other(S.bilBase);
              if(S.lang!==tgt){ S.lang=tgt; bilSyncChrome(); }
            }
          }
        }catch(e){}
        return _nextRound();
      };
    }

    var box=$('bilModeChoices');
    if(box&&!box._bilWired){ box._bilWired=true;
      box.addEventListener('click',function(e){
        var b=e.target.closest('button[data-mode]'); if(!b) return;
        var p=currentProfile(); if(!p) return;
        p.langMode=b.dataset.mode; saveDB(); bilSync();
        var t=UI[S.lang]; var nm={immersion:t.bilImmersion,alternate:t.bilAlternate,mirror:t.bilMirror}[b.dataset.mode];
        if(typeof speak==='function'&&nm) speak(nm);
      });
    }
    var lb=$('langBtn'); if(lb&&!lb._bilWired){ lb._bilWired=true; lb.addEventListener('click',function(){ if(window.applyBilingualLang) applyBilingualLang(); }); }
    var ts=$('tabSet'); if(ts&&!ts._bilWired){ ts._bilWired=true; ts.addEventListener('click',function(){ if(window.applyBilingualLang) applyBilingualLang(); }); }
    applyBilingualLang();
  }

  window.initBilingual=initBilingual;
  window.bilMode=bilMode;
  try{ initBilingual(); }catch(e){}
})();


/* ==================== Panel educador (local) + flag de backend ====================
   Vista agregada de TODOS los perfiles (por niño + global), tras el parent gate,
   como 3ª pestaña del área de adultos. 100% offline sobre DB.profiles[].ev.
   Reutiliza aggregate() y el estilo de renderProgress2. Aditivo: no redefine
   showTab/passGate/applyLang; re-cablea los onclick de pestañas al final. */

window.PEQUE_FLAGS = Object.assign({ backendSync:false }, window.PEQUE_FLAGS||{});

function eduEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

function eduFaceOf(k){
  if(k.indexOf('math-')===0){ var rest=k.slice(5); if(rest==='cmp') return '🔢 ⚖️'; if(rest.indexOf('sub-')===0) return '🔢 '+rest.slice(4); return '🔢 '+rest; }
  if(k.indexOf('read-')===0) return '🔤 '+k.split('-')[1];
  if(k.indexOf('sci-diet-')===0){ var d=k.split('-')[2]; return (typeof DIET_CAT!=='undefined'&&DIET_CAT[d])?DIET_CAT[d].emoji+' '+DIET_CAT[d][S.lang]:k; }
  if(k.indexOf('sci-')===0){ var h=k.split('-')[1]; return HAB[h]?HAB[h].emoji+' '+HAB[h][S.lang]:k; }
  return k;
}

function eduSpark(ev){
  var n=ev.length; if(!n) return '';
  var B=Math.min(8,n), per=n/B, out=[];
  for(var i=0;i<B;i++){
    var s=Math.floor(i*per), e=Math.floor((i+1)*per); if(e<=s) e=s+1;
    var slice=ev.slice(s,e), ft=slice.filter(function(x){return x.ft;}).length/(slice.length||1);
    var cls=ft>=0.7?'hi':ft>=0.4?'mid':'lo', hgt=6+Math.round(ft*22);
    out.push('<span class="sparkbar '+cls+'" style="height:'+hgt+'px"></span>');
  }
  return '<div class="spark" aria-hidden="true">'+out.join('')+'</div>';
}

function renderEducator(){
  var t=UI[S.lang], host=$('eduBody'); if(!host) return;
  var te=$('eduTitle'); if(te) te.textContent=t.eduTitle;
  var se=$('eduSub'); if(se) se.textContent=t.eduSub;
  var xb=$('eduExportBtn'); if(xb){ xb.textContent=t.eduExport; xb.onclick=eduExportCSV; }
  var profs=DB.profiles||[], allEv=[];
  profs.forEach(function(p){ (p.ev||[]).forEach(function(ev){ allEv.push(ev); }); });
  if(!profs.length || !allEv.length){ host.innerHTML='<div class="empty">'+t.noData+'</div>'; return; }
  var g=aggregate({ev:allEv});
  var secs=(g.avg/1000).toFixed(1);
  var gname={math:t.math,reading:t.read,science:t.sci};
  var html='<div class="eduHead">'+t.eduGlobal+'</div>';
  html+='<div class="statgrid">'
    +'<div class="stat"><div class="n">'+profs.length+'</div><div class="l">'+t.eduChildren+'</div></div>'
    +'<div class="stat"><div class="n">'+g.rounds+'</div><div class="l">'+t.stRounds+'</div></div>'
    +'<div class="stat"><div class="n">'+Math.round(g.firstRate*100)+'%</div><div class="l">'+t.stFirst+'</div></div>'
    +'<div class="stat"><div class="n">'+secs+'s</div><div class="l">'+t.stTime+'</div></div>'
  +'</div>';
  ['math','reading','science'].forEach(function(gk){
    var gg=g.byGame[gk]; if(gg && gg.r>0){
      var acc=Math.round((1-gg.err/gg.r)*100);
      var col=gk==='math'?'var(--math)':gk==='reading'?'var(--read)':'var(--sci)';
      html+='<div class="bar"><div class="lab"><span>'+gname[gk]+'</span><span>'+acc+'% '+t.mAcc.toLowerCase()+'</span></div><div class="track"><div class="fillb" style="width:'+acc+'%;background:'+col+'"></div></div></div>';
    }
  });
  if(g.topFails.length){
    html+='<div class="eduHead">'+t.stFocus+'</div>';
    g.topFails.forEach(function(f){ var face=eduFaceOf(f.k), em=face.split(' ')[0], rest=face.split(' ').slice(1).join(' ');
      html+='<div class="failitem"><span class="fx">'+em+'</span><span>'+rest+'</span><span class="fc">'+f.c+' ✗</span></div>'; });
  }
  html+='<div class="eduHead">'+t.eduPerChild+'</div>';
  profs.forEach(function(p){
    var a=aggregate(p), ev=p.ev||[];
    var sub=ev.length?(a.rounds+' '+t.stRounds.toLowerCase()+' · '+Math.round(a.firstRate*100)+'% '+t.stFirst.toLowerCase()):t.eduNoRounds;
    html+='<div class="eduChild">'
      +'<span class="eduAv">'+eduEsc(p.avatar)+'</span>'
      +'<div class="eduMeta"><div class="eduName">'+eduEsc(p.name)+'</div><div class="eduChildSub">'+sub+'</div></div>'
      +(ev.length?eduSpark(ev):'')
      +'</div>';
  });
  host.innerHTML=html;
}

function eduExportCSV(){
  var rows=[['child','avatar','game','item','first_try','attempts','ms','assisted']];
  (DB.profiles||[]).forEach(function(p){ (p.ev||[]).forEach(function(e){ rows.push([p.name,p.avatar,e.g,e.k,e.ft,e.at,e.ms,e.as]); }); });
  var csv=rows.map(function(r){ return r.map(function(c){ var s=String(c==null?'':c); if(/^[=+\-@]/.test(s)) s="'"+s; return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }).join(','); }).join('\n');
  try{
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8'}), url=URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download='pequenautas-educador.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },1000);
  }catch(e){}
}

function eduHide(){ var e=$('eduView'); if(e) e.style.display='none'; var t=$('tabEdu'); if(t) t.classList.remove('on'); }
function showEducator(){
  var tp=$('tabProg'),ts=$('tabSet'),te=$('tabEdu');
  if(tp) tp.classList.remove('on'); if(ts) ts.classList.remove('on'); if(te) te.classList.add('on');
  var pv=$('progView'),sv=$('setView'),ev=$('eduView');
  if(pv) pv.style.display='none'; if(sv) sv.style.display='none'; if(ev) ev.style.display='block';
  renderEducator();
}
function eduApplyChrome(){ var e=$('tabEduTxt'); if(e && UI[S.lang]) e.textContent=UI[S.lang].tabEdu; }

(function(){
  var tp=$('tabProg'); if(tp) tp.onclick=function(){ eduHide(); showTab('prog'); };
  var ts=$('tabSet'); if(ts) ts.onclick=function(){ eduHide(); showTab('set'); };
  var te=$('tabEdu'); if(te) te.onclick=showEducator;
  var cs=$('closeSheet'); if(cs) cs.addEventListener('click', eduHide);
  var sh=$('sheet'); if(sh) sh.addEventListener('click', function(e){ if(e.target===sh) eduHide(); });
  var lb=$('langBtn'); if(lb) lb.addEventListener('click', function(){ eduApplyChrome(); var ev=$('eduView'); if(ev && ev.style.display!=='none') renderEducator(); });
  eduApplyChrome();
})();


/* ==================== Modo guiado padre-hijo (co-juego / NAEYC) ====================
   Toggle en Ajustes (persistido en DB.settings.coplay, OFF por defecto). Cuando está
   activo, muestra al ADULTO una tarjeta discreta con una pregunta indagatoria en
   momentos oportunos: al iniciar una materia (ronda 0) y a mitad del juego (ronda 2).
   NO quita agencia al niño: la tarjeta no bloquea la pantalla, es cerrable y se retira
   sola al avanzar de ronda. 100% offline y aditivo: no redefine funciones existentes;
   detecta cambios de ronda observando #stage. Bilingüe ES/EN. Inerte hasta activarse,
   así que no altera los smoke tests con el modo apagado (default). */
(function(){
  "use strict";

  var COPLAY_Q = {
    math: {
      start: [
        { es:'Cuenta en voz alta junto a tu peque y señala cada objeto.', en:'Count out loud together and point to each object.' },
        { es:'Pregúntale cuántos ve antes de tocar, y luego cuenten juntos.', en:'Ask how many they see before tapping, then count together.' }
      ],
      mid: [
        { es:'Pregúntale: ¿cuántos habría si añadimos uno más?', en:'Ask: how many would there be if we add one more?' },
        { es:'Muestren ese mismo número con los dedos de las manos.', en:'Show that same number using your fingers together.' },
        { es:'Pregúntale: ¿y si quitamos uno, cuántos quedan?', en:'Ask: if we take one away, how many are left?' }
      ]
    },
    reading: {
      start: [
        { es:'Di el sonido de la letra y pídele que lo repita contigo.', en:'Say the letter’s sound and ask them to repeat it with you.' },
        { es:'Pregúntale cómo suena esta letra antes de elegir.', en:'Ask how this letter sounds before choosing.' }
      ],
      mid: [
        { es:'Pregúntale: ¿qué otra cosa empieza con esta letra?', en:'Ask: what else starts with this letter?' },
        { es:'Busquen en la sala algo cuyo nombre empiece igual.', en:'Look around the room for something that starts the same way.' },
        { es:'Pregúntale por el nombre de alguien que empiece con esta letra.', en:'Ask for someone’s name that starts with this letter.' }
      ]
    },
    science: {
      start: [
        { es:'Pregúntale por qué cree que el animal vive en ese lugar.', en:'Ask why they think the animal lives in that place.' },
        { es:'Pregúntale qué sabe de este animal antes de responder.', en:'Ask what they already know about this animal before answering.' }
      ],
      mid: [
        { es:'Pregúntale: ¿qué otros animales viven en el agua, la tierra o el cielo?', en:'Ask: what other animals live in the water, on land, or in the sky?' },
        { es:'Pregúntale qué crees que come este animal y por qué.', en:'Ask what they think this animal eats, and why.' },
        { es:'Pregúntale en qué se parece a otro animal que conozca.', en:'Ask how it is similar to another animal they know.' }
      ]
    }
  };

  if (typeof UI === 'object' && UI.es && UI.en){
    Object.assign(UI.es, {
      cpKicker:'Momento en familia',
      setCoplayN:'Modo guiado con adulto',
      setCoplayD:'Muestra preguntas para acompañar a tu peque'
    });
    Object.assign(UI.en, {
      cpKicker:'Together moment',
      setCoplayN:'Guided grown-up mode',
      setCoplayD:'Shows prompts to explore alongside your child'
    });
  }

  var card=null, closeBtn=null, qEl=null, kickEl=null;
  var currentQ=null, visible=false, lastKey=null, pending=false;

  function cfg(){
    if(typeof DB!=='object'||!DB) return { coplay:false };
    if(!DB.settings) DB.settings={};
    if(typeof DB.settings.coplay!=='boolean') DB.settings.coplay=false;
    return DB.settings;
  }
  function isOn(){ return !!cfg().coplay; }

  function L(){ var l=(typeof S==='object'&&S)?S.lang:'es'; return (typeof UI==='object'&&UI[l])?UI[l]:null; }

  function buildCard(){
    if(card) return card;
    card=document.createElement('div');
    card.id='coplayCard'; card.className='coplayCard';
    card.setAttribute('role','note'); card.setAttribute('aria-live','polite');
    card.innerHTML='<span class="cpIcon" aria-hidden="true">👩‍👧</span>'
      +'<div class="cpBody"><div class="cpKicker" id="cpKicker"></div><div class="cpQ" id="coplayQ"></div></div>'
      +'<button class="cpClose" id="coplayClose" type="button">✕</button>';
    var host=$('app')||document.body; host.appendChild(card);
    qEl=$('coplayQ'); kickEl=$('cpKicker'); closeBtn=$('coplayClose');
    if(closeBtn){ closeBtn.setAttribute('aria-label', L()&&L().close ? L().close : 'Cerrar'); closeBtn.addEventListener('click', hideCard); }
    return card;
  }

  function paint(){
    if(!qEl||!currentQ) return;
    var l=(typeof S==='object'&&S)?S.lang:'es';
    qEl.textContent=currentQ[l]||currentQ.es;
    if(kickEl){ var t=L(); kickEl.textContent=(t&&t.cpKicker)||(l==='en'?'Together moment':'Momento en familia'); }
    if(closeBtn){ var tt=L(); closeBtn.setAttribute('aria-label',(tt&&tt.close)||'Cerrar'); }
  }

  function showQ(game, moment){
    var pack=COPLAY_Q[game]; if(!pack||!pack[moment]||!pack[moment].length) return;
    buildCard();
    currentQ=pack[moment][ rnd(pack[moment].length) ];
    paint();
    card.style.display='flex';
    void card.offsetWidth;
    card.classList.add('show');
    visible=true;
  }

  function hideCard(){
    if(!card) return;
    card.classList.remove('show');
    card.style.display='none';
    visible=false; currentQ=null;
  }

  function evaluate(){
    pending=false;
    if(typeof S!=='object'||!S) return;
    if(S.screen!=='game' || !isOn()){ hideCard(); lastKey=null; return; }
    var g=S.game, r=S.round;
    var key=g+':'+r;
    if(key===lastKey){ if(visible) paint(); return; }
    lastKey=key;
    hideCard();
    var moment = (r===0) ? 'start' : (r===2 ? 'mid' : null);
    if(moment) showQ(g, moment);
  }
  function scheduleEval(){ if(pending) return; pending=true; requestAnimationFrame(evaluate); }

  function ensureSettingRow(){
    var set=$('setView'); if(!set) return;
    var row=$('setCoplay');
    if(!row){
      row=document.createElement('div'); row.className='setting'; row.id='setCoplay';
      row.innerHTML='<div><div class="name" id="setCoplayN"></div><div class="desc" id="setCoplayD"></div></div>'
        +'<button class="toggle" id="tgCoplay" role="switch"><span class="knob"></span></button>';
      var anchor=$('setSessLimit');
      if(anchor && anchor.parentNode===set) set.insertBefore(row, anchor);
      else set.appendChild(row);
    }
    var tg=$('tgCoplay');
    if(tg && !tg._cpWired){ tg._cpWired=true;
      tg.addEventListener('click', function(){
        var c=cfg(); c.coplay=!c.coplay; if(typeof saveDB==='function') saveDB();
        syncRow();
        if(!c.coplay) hideCard(); else { lastKey=null; scheduleEval(); }
      });
    }
    applyLangRow(); syncRow();
  }
  function syncRow(){ var tg=$('tgCoplay'); if(tg){ tg.classList.toggle('on', isOn()); tg.setAttribute('aria-checked', String(isOn())); } }
  function applyLangRow(){
    var t=L(); if(!t) return;
    var n=$('setCoplayN'), d=$('setCoplayD');
    if(n) n.textContent=t.setCoplayN||'Modo guiado con adulto';
    if(d) d.textContent=t.setCoplayD||'';
  }

  function initCoplay(){
    cfg();
    buildCard();
    ensureSettingRow();
    var stage=$('stage');
    if(stage && !stage._cpObs){
      stage._cpObs=true;
      var obs=new MutationObserver(scheduleEval);
      obs.observe(stage, { childList:true });
    }
    var ts=$('tabSet'); if(ts && !ts._cpWired){ ts._cpWired=true; ts.addEventListener('click', function(){ ensureSettingRow(); }); }
    var lb=$('langBtn'); if(lb && !lb._cpWired){ lb._cpWired=true; lb.addEventListener('click', function(){ applyLangRow(); if(visible) paint(); }); }
    var hb=$('homeBtn'); if(hb) hb.addEventListener('click', hideCard);
    var bb=$('backBtn'); if(bb) bb.addEventListener('click', hideCard);
  }

  window.__coplay = {
    enable:  function(){ cfg().coplay=true;  if(typeof saveDB==='function') saveDB(); syncRow(); lastKey=null; scheduleEval(); },
    disable: function(){ cfg().coplay=false; if(typeof saveDB==='function') saveDB(); syncRow(); hideCard(); },
    isOn: isOn,
    isVisible: function(){ return visible; },
    refresh: scheduleEval,
    init: initCoplay
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ try{ initCoplay(); }catch(e){} });
  else { try{ initCoplay(); }catch(e){} }
})();
