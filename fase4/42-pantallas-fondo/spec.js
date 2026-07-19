/* Fase 4 #42 - Fondos de bosque HD para los overlays Mapa/Mochila (#32). El
   overlay .pa32-ov se crea al abrir y se destruye al cerrar, asi que observamos
   el body: cuando aparece un .pa32-ov cuyo titulo es "Mapa de Aventuras" o
   "Mochila de Logros" inyectamos una capa #pa42bg con la escena correspondiente
   DETRAS de la tarjeta. Pausa/Gate (otros titulos) no reciben fondo. 100%
   aditivo; no toca el DOM del overlay mas alla de la capa de fondo. */
(function(){
  "use strict";
  if(window.__pa42) return; window.__pa42 = true;

  function detectSec(txt){
    if(!txt) return null;
    if(txt.indexOf("Mapa") >= 0) return "map";
    if(txt.indexOf("Mochila") >= 0) return "bag";
    return null;
  }

  function attach(ov){
    try{
      if(!ov || ov.__pa42done) return;
      var t = ov.querySelector(".pa32-title");
      var sec = detectSec(t ? t.textContent : "");
      if(!sec) return;                 // pausa/gate u otros: sin fondo
      ov.__pa42done = true;
      if(getComputedStyle(ov).position === "static"){ ov.style.position = "fixed"; }
      var bg = document.createElement("div");
      bg.id = "pa42bg"; bg.setAttribute("aria-hidden","true");
      bg.setAttribute("data-sec", sec);
      bg.innerHTML = '<div class="pa42-scroll"></div>';
      ov.insertBefore(bg, ov.firstChild);
      // fade-in en el proximo frame
      setTimeout(function(){ try{ bg.classList.add("on"); }catch(e){} }, 30);
    }catch(e){}
  }

  function scan(){
    try{
      var list = document.querySelectorAll(".pa32-ov");
      for(var i=0;i<list.length;i++){ attach(list[i]); }
    }catch(e){}
  }

  try{
    if(window.MutationObserver){
      new MutationObserver(function(muts){
        for(var i=0;i<muts.length;i++){
          var a = muts[i].addedNodes || [];
          for(var j=0;j<a.length;j++){
            var n = a[j];
            if(n && n.nodeType===1){
              if(n.classList && n.classList.contains("pa32-ov")) attach(n);
              else if(n.querySelector){ var inner = n.querySelector(".pa32-ov"); if(inner) attach(inner); }
            }
          }
        }
      }).observe(document.body, {childList:true, subtree:true});
    }
  }catch(e){}
  // sondeo de respaldo por si el overlay ya existe o el observer falla
  var tries = 0;
  var iv = setInterval(function(){ tries++; scan(); if(tries>240) clearInterval(iv); }, 700);
  scan();
})();
