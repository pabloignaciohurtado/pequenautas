/* ===== Fase 4 #36 · Reubicar el acceso de adultos =====
   El acceso a "Adultos" estaba como 4º item de la barra inferior: muy fácil de
   tocar por accidente. Este módulo lo saca de la barra (vía CSS en spec.css) y
   lo reubica como un engranaje pequeño y discreto en la esquina superior
   derecha, que sigue abriendo el MISMO gate de "mantén presionado".
   100% ADITIVO: no toca app.js, #33 ni STORE_KEY; solo agrega un botón y estilos. */
(function(){
  "use strict";
  function openAdults(){
    // usa el mismo camino que el botón original: dispara el gate de la app
    try{ var ab=document.getElementById('adultBtn'); if(ab){ ab.click(); return; } }catch(e){}
    try{ if(window.PEQ32 && typeof window.PEQ32.abrirGate==='function') window.PEQ32.abrirGate(function(){}); }catch(e){}
  }
  function gearSVG(){
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
      +'<circle cx="12" cy="12" r="3.1" stroke="currentColor" stroke-width="2"/>'
      +'<path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  var btn=null;
  function ensureBtn(){
    if(btn) return;
    btn=document.createElement('button');
    btn.type='button';
    btn.className='pa36-adult';
    btn.setAttribute('aria-label','Para grandes');
    btn.innerHTML=gearSVG();
    btn.addEventListener('click',openAdults);
    (document.body||document.documentElement).appendChild(btn);
  }
  function sync(){
    try{
      ensureBtn();
      var home=document.getElementById('home');
      var on = home && home.classList.contains('active');
      if(on) btn.classList.add('show'); else btn.classList.remove('show');
    }catch(e){}
  }
  function init(){
    ensureBtn(); sync();
    try{
      var home=document.getElementById('home');
      if(home && window.MutationObserver){
        new MutationObserver(sync).observe(home,{attributes:true,attributeFilter:['class']});
      }
    }catch(e){}
    // reintento por si el home se pinta tarde
    var n=0, iv=setInterval(function(){ sync(); if(++n>40) clearInterval(iv); },400);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
