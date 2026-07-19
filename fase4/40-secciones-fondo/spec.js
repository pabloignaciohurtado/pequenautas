/* Fase 4 #40 - Fondos de bosque por seccion. Inyecta una capa #pa40bg detras
   del overlay de juegos (.pa34-ov, creado por #34) y elige la escena segun la
   seccion abierta (Numeros/Letras/Animales), leida del titulo del header.
   100% aditivo; no toca el DOM de #34 mas alla de insertar la capa de fondo. */
(function(){
  "use strict";
  if(window.__pa40) return; window.__pa40 = true;

  function detectSec(txt){
    if(!txt) return null;
    if(txt.indexOf("Letras") >= 0) return "reading";
    if(txt.indexOf("Animales") >= 0) return "science";
    if(txt.indexOf("meros") >= 0) return "math"; // "Numeros" (con acento)
    return null;
  }

  function syncSec(){
    try{
      var ov = document.querySelector(".pa34-ov");
      var bg = document.getElementById("pa40bg");
      if(!ov || !bg) return;
      var t = ov.querySelector(".pa34-hd .t");
      var s = detectSec(t ? t.textContent : "");
      if(s) bg.setAttribute("data-sec", s);
    }catch(e){}
  }
  function syncShow(){
    try{
      var ov = document.querySelector(".pa34-ov");
      var bg = document.getElementById("pa40bg");
      if(!ov || !bg) return;
      bg.classList.toggle("on", ov.classList.contains("show"));
    }catch(e){}
  }

  function build(){
    var ov = document.querySelector(".pa34-ov");
    if(!ov) return false;
    if(document.getElementById("pa40bg")) return true;
    var bg = document.createElement("div");
    bg.id = "pa40bg"; bg.setAttribute("aria-hidden","true");
    bg.setAttribute("data-sec","math");
    bg.innerHTML = '<div class="pa40-scroll"></div>';
    ov.insertBefore(bg, ov.firstChild);
    syncSec(); syncShow();
    try{
      if(window.MutationObserver){
        var hd = ov.querySelector(".pa34-hd") || ov;
        new MutationObserver(syncSec).observe(hd,{childList:true,subtree:true,characterData:true});
        new MutationObserver(syncShow).observe(ov,{attributes:true,attributeFilter:["class"]});
      }
    }catch(e){}
    return true;
  }

  // El overlay de #34 se crea de forma perezosa (al abrir la 1a seccion):
  // sondeamos hasta que exista, luego dejamos los observers a cargo.
  var tries = 0;
  var iv = setInterval(function(){
    tries++;
    if(build() || tries > 240) clearInterval(iv);
  }, 500);
})();
