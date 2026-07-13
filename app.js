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
  attempts:0, roundStart:0, roundLogged:false, correctBtn:null, revealed:false };

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
    stStars:'Estrellas', stRounds:'Rondas', stFirst:'Aciertos a la 1ª', stTime:'Tiempo medio', stFocus:'A reforzar', mAcc:'Aciertos', noData:'Aún no hay datos. ¡A jugar!' },
  en:{ tagline:'Learn by playing', math:'Numbers', read:'Letters', sci:'Animals', adult:'For grown-ups',
    celTitle:'You did it!', celSub:'You earned a star!', celHome:'Home', celAgain:'Again',
    gateTitle:'Grown-ups only', gateSub:'Tap and hold the button to enter.', hold:'Press and hold', holdNum:'Press and hold 👇',
    tabProg:'Progress', tabSet:'Settings', progTitle:'Progress', progSub:'How your child is doing.',
    setSoundN:'Voice & sounds', setSoundD:'Narration and effects', setAnimN:'Extra animations', setAnimD:'Confetti & celebrations',
    setGuideN:'Guided hints', setGuideD:'Progressive help on mistakes',
    tip:'💡 AAP: co-play with your child, 10–15 min sessions. Learning is greater with a grown-up alongside.',
    close:'Done', switch:'Switch child', pTitle:'Who is playing?', pSub:'Choose your profile',
    newTitle:'New child', newSub:'Pick an avatar and a name.', create:'Done!', namePH:'Name', level:'Level', add:'Add',
    stStars:'Stars', stRounds:'Rounds', stFirst:'First-try correct', stTime:'Avg time', stFocus:'To practice', mAcc:'Accuracy', noData:'No data yet. Let’s play!' }
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
    b.innerHTML=`<span class="av">${p.avatar}</span><span class="nm">${p.name}</span><span class="st">⭐ ${p.stars||0}</span>`;
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
  const p={id:newId(),avatar:newAvatar,name:name,stars:0,best:{math:0,reading:0,science:0},ev:[]};
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
function startGame(g){ S.game=g; S.round=0; show('game'); nextRound(); }
function renderProgress(){ const p=$('progress'); p.innerHTML=''; for(let i=0;i<S.totalRounds;i++){ const d=document.createElement('div'); d.className='dot'+(i<S.round?' done':i===S.round?' cur':''); p.appendChild(d);} }
function nextRound(){ if(S.round>=S.totalRounds){ finishGame(); return; } renderProgress(); S.attempts=0; S.revealed=false; S.roundLogged=false; S.roundStart=now(); if(S.game==='math') roundMath(); else if(S.game==='reading') roundReading(); else roundScience(); }
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

function roundMath(){
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
}
function toggleLang(){ S.lang=S.lang==='es'?'en':'es'; applyLang(); if(S.screen==='game'){ if(S.game==='math') roundMath(); else if(S.game==='reading') roundReading(); else roundScience(); } speak(S.lang==='es'?'Español':'English'); }

/* ---------- sheet / gate / progreso ---------- */
let holdTimer=null;
function showSheetView(which){ ['gateView','adultView','newView'].forEach(v=>{ $(v).style.display = v===which?'block':'none'; }); }
function openAdult(){ showSheetView('gateView'); $('sheet').classList.add('show'); }
function passGate(){ showSheetView('adultView'); showTab('prog'); }
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
  const faceOf=k=>{ if(k.indexOf('math-')===0) return '🔢 '+k.split('-')[1]; if(k.indexOf('read-')===0) return '🔤 '+k.split('-')[1]; if(k.indexOf('sci-')===0){ const h=k.split('-')[1]; return HAB[h]?HAB[h].emoji+' '+HAB[h][S.lang]:k; } return k; };
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
$('profileChip').onclick=()=>{ if(window.speechSynthesis) speechSynthesis.cancel(); renderProfiles(); show('profiles'); };
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

/* ---------- init ---------- */
loadDB();
applyLang();
if(DB.currentId && currentProfile()){ syncChip(); refreshHome(); show('home'); }
else { renderProfiles(); show('profiles'); }
