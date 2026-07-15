"use strict";
/* ==================== FASE 4 · #20 Animaciones de personaje variadas ====================
   Añade VARIEDAD de animaciones (idle / celebración / ánimo) a un personaje-guía,
   solo con transform/opacity (respeta prefers-reduced-motion).

   100% ADITIVO — mismo mecanismo que ya usan en ship/app.js "Estrategia bilingüe",
   "Modo guiado padre-hijo" y "Voces pregrabadas (AudioBank)": envuelve
   window.afterCorrect / window.onWrong / window.show POR REASIGNACIÓN (llama
   siempre a la versión previa y luego añade su propio efecto). Nunca edita
   init() ni applyLang(), y nunca usa .onclick= sobre #langBtn/#tabSet (solo
   addEventListener, para no romper la cadena que ya usan otras mejoras).

   Dos modos, detectados en runtime (sin coordinación manual):
   - "enhance": si ya existe #peqMascot (p.ej. la mejora #16 "voces-mascota"
     integrada), NO crea un nodo nuevo — añade sus clases de variedad
     (idle/celebración/ánimo) sobre ESE mismo nodo. #16 sigue gobernando
     visibilidad/estado base (.pmHappy/.pmOops) sin que esta mejora lo toque;
     solo se sobrepone variedad adicional (ver integration.md, nota de orden
     de <script>).
   - "own": si no existe #peqMascot, crea un personaje propio y ligero
     (#pa20Pet), gestiona su propia visibilidad (solo en pantalla de juego)
     y sus propias animaciones. Deliverable 100% autocontenido y testable
     de forma aislada bajo file://.

   Ajuste propio en Ajustes ("Animación del personaje", DB.settings.pa20Anim,
   ON por defecto) que SOLO controla la variedad añadida por esta mejora — no
   oculta el personaje de #16 si existe, solo detiene la variedad extra.
   Respeta además prefers-reduced-motion (detección JS + CSS) y, para la
   variedad de celebración, el ajuste existente S.anim ("Animaciones extra").
   Bajo file:// no se abre ninguna conexión de red. */
(function(){
  "use strict";
  if(window.__pa20Wrapped) return; // idempotente: si el script se carga dos veces, no duplica wiring
  window.__pa20Wrapped = true;

  var $=(typeof window.$==='function')?window.$:function(id){ return document.getElementById(id); };

  var REDUCE=false;
  try{ REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){}

  /* ---------- i18n aditivo (no toca los literales UI.es/UI.en originales) ---------- */
  if(typeof UI==='object' && UI && UI.es && UI.en){
    Object.assign(UI.es,{ setPa20N:'Animación del personaje', setPa20D:'Variedad de gestos: reposo, celebración y ánimo' });
    Object.assign(UI.en,{ setPa20N:'Character animation',    setPa20D:'Variety of moves: idle, celebration and encouragement' });
  }

  /* ---------- ajuste persistido ---------- */
  function cfg(){
    if(typeof DB!=='object'||!DB) return { pa20Anim:true };
    if(!DB.settings) DB.settings={};
    if(typeof DB.settings.pa20Anim!=='boolean') DB.settings.pa20Anim=true; // ON por defecto
    return DB.settings;
  }
  function isOn(){ return !!cfg().pa20Anim; }

  /* ---------- nodo: reutiliza #peqMascot (modo "enhance") o crea el propio (modo "own") ---------- */
  var node=null; // {root, mode:'enhance'|'own'}
  function getNode(){
    if(node) return node;
    var ext=document.getElementById('peqMascot');
    if(ext){ node={root:ext, mode:'enhance'}; return node; }
    var own=document.getElementById('pa20Pet');
    if(!own){
      own=document.createElement('div');
      own.id='pa20Pet'; own.className='pa20Pet'; own.setAttribute('aria-hidden','true');
      own.innerHTML='<span class="pa20PetFace">🦊</span>';
      (document.getElementById('app')||document.body).appendChild(own);
    }
    node={root:own, mode:'own'};
    return node;
  }

  /* ---------- pools de clases de animación (solo transform/opacity, ver spec.css) ---------- */
  var IDLE  =['pa20-idle-bob','pa20-idle-sway','pa20-idle-breathe','pa20-idle-peek'];
  var CEL   =['pa20-cel-jump','pa20-cel-spin','pa20-cel-wiggle','pa20-cel-pop'];
  var CHEER =['pa20-cheer-nod','pa20-cheer-nudge','pa20-cheer-lean'];
  var ONE_SHOT=CEL.concat(CHEER);

  function rndIdx(n){ return Math.floor(Math.random()*n); }
  function pick(arr, avoid){
    if(arr.length===1) return arr[0];
    var c; do{ c=arr[rndIdx(arr.length)]; }while(c===avoid);
    return c;
  }

  var lastIdle=null, lastOneShot=null, idleTimer=null;

  function clearIdleClasses(){ var n=getNode(); IDLE.forEach(function(c){ n.root.classList.remove(c); }); }
  function clearOneShot(){ var n=getNode(); ONE_SHOT.forEach(function(c){ n.root.classList.remove(c); }); }

  function setIdle(){
    if(!isOn()||REDUCE) return;
    var n=getNode();
    clearIdleClasses();
    var c=pick(IDLE,lastIdle); lastIdle=c;
    n.root.classList.add(c);
  }
  function scheduleIdle(){
    clearTimeout(idleTimer);
    if(!isOn()||REDUCE) return;
    var delay=4200+Math.floor(Math.random()*2600);
    idleTimer=setTimeout(function(){ setIdle(); scheduleIdle(); }, delay);
  }

  function playOneShot(pool){
    if(!isOn()||REDUCE) return;
    var n=getNode();
    var c=pick(pool,lastOneShot); lastOneShot=c;
    clearIdleClasses(); clearOneShot();
    void n.root.offsetWidth; // fuerza reflow: reinicia la animación aunque se repita la misma clase
    n.root.classList.add(c);
    var done=false;
    n.root.addEventListener('animationend', function h(){
      if(done) return; done=true;
      n.root.removeEventListener('animationend', h);
      n.root.classList.remove(c);
      setIdle();
    }, {once:true});
    // red de seguridad: si por lo que sea 'animationend' no dispara (p. ej. animation:none del
    // usuario), no dejamos el nodo "pegado" en el estado de un solo disparo.
    setTimeout(function(){ if(!done){ done=true; n.root.classList.remove(c); setIdle(); } }, 1200);
  }

  function celebrate(){
    // celebración: respeta además el ajuste existente "Animaciones extra" (S.anim), igual que confetti().
    if(typeof S==='object' && S && S.anim===false) return;
    playOneShot(CEL);
  }
  function cheer(){ playOneShot(CHEER); }

  /* ---------- visibilidad + arranque/parada del ciclo idle ---------- */
  function syncAll(){
    var n=getNode();
    var inGame=(typeof S==='object' && S && S.screen==='game');
    if(n.mode==='own'){ n.root.classList.toggle('show', inGame && isOn()); }
    if(inGame && isOn()){ setIdle(); scheduleIdle(); }
    else { clearTimeout(idleTimer); clearIdleClasses(); clearOneShot(); }
  }

  /* ---------- envolturas aditivas (reasignación; llaman siempre a la versión previa) ---------- */
  var _afterCorrect=window.afterCorrect;
  if(typeof _afterCorrect==='function'){
    window.afterCorrect=function(key){
      var r=_afterCorrect.apply(this,arguments);
      try{ celebrate(); }catch(e){}
      return r;
    };
  }
  var _onWrong=window.onWrong;
  if(typeof _onWrong==='function'){
    window.onWrong=function(btn,hintFn){
      var r=_onWrong.apply(this,arguments);
      try{ cheer(); }catch(e){}
      return r;
    };
  }
  var _show=window.show;
  if(typeof _show==='function'){
    window.show=function(screen){
      var r=_show.apply(this,arguments);
      try{ syncAll(); }catch(e){}
      return r;
    };
  }

  /* ---------- fila de Ajustes (idempotente; mismo patrón que #setCoplay/#setSessLimit) ---------- */
  function applyLangRow(){
    var t=(typeof UI==='object' && typeof S==='object' && S) ? UI[S.lang] : null;
    if(!t) return;
    var n=$('setPa20AnimN'), d=$('setPa20AnimD');
    if(n) n.textContent=t.setPa20N||'';
    if(d) d.textContent=t.setPa20D||'';
  }
  function syncRow(){
    var tg=$('tgPa20Anim');
    if(tg){ tg.classList.toggle('on', isOn()); tg.setAttribute('aria-checked', String(isOn())); }
  }
  function ensureSettingRow(){
    var set=$('setView'); if(!set) return;
    var row=$('setPa20Anim');
    if(!row){
      row=document.createElement('div'); row.className='setting'; row.id='setPa20Anim';
      row.innerHTML='<div><div class="name" id="setPa20AnimN"></div><div class="desc" id="setPa20AnimD"></div></div>'
        +'<button class="toggle" id="tgPa20Anim" role="switch"><span class="knob"></span></button>';
      var anchor=$('setSessLimit');
      if(anchor && anchor.parentNode===set) set.insertBefore(row, anchor);
      else set.appendChild(row);
    }
    var tg=$('tgPa20Anim');
    if(tg && !tg._pa20Wired){ tg._pa20Wired=true;
      tg.addEventListener('click', function(){
        var c=cfg(); c.pa20Anim=!c.pa20Anim;
        if(typeof saveDB==='function') saveDB();
        syncRow(); syncAll();
      });
    }
    applyLangRow(); syncRow();
  }

  function init(){
    getNode();
    ensureSettingRow();
    syncAll();
    var ts=$('tabSet'); if(ts && !ts._pa20Wired){ ts._pa20Wired=true; ts.addEventListener('click', function(){ ensureSettingRow(); }); }
    var lb=$('langBtn'); if(lb && !lb._pa20Wired){ lb._pa20Wired=true; lb.addEventListener('click', function(){ applyLangRow(); }); }
  }

  /* ---------- API pública (tests / tooling) ---------- */
  window.__personajeAnim = {
    isOn: isOn,
    enable:  function(){ cfg().pa20Anim=true;  if(typeof saveDB==='function') saveDB(); syncRow(); syncAll(); },
    disable: function(){ cfg().pa20Anim=false; if(typeof saveDB==='function') saveDB(); syncRow(); syncAll(); },
    mode: function(){ return getNode().mode; },
    node: function(){ return getNode().root; },
    celebrate: celebrate,
    cheer: cheer,
    idle: setIdle,
    reducedMotion: function(){ return REDUCE; },
    pools: { idle:IDLE.slice(), celebrate:CEL.slice(), cheer:CHEER.slice() }
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} });
  else { try{ init(); }catch(e){} }
})();
