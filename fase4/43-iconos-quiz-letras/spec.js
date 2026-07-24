/* Fase 4 #43 - Iconos ilustrados para el quiz "Que empieza con L?" (roundReading
   en app.js). 100% aditivo: no toca app.js ni index.html. Detecta con
   MutationObserver cuando #stage (dentro de #game) renderiza las tarjetas
   .choice > .cface del quiz de letras (se reconoce por la presencia de
   .lettertile, que roundReading es la unica ronda que crea) y les agrega una
   clase pa43-* que el CSS de este modulo usa para ocultar el glifo emoji
   (font-size:0) y mostrar en su lugar el icono papercraft via
   background-image. Tambien sincroniza el emoji zorro crudo del chip de
   perfil (topbar) SOLO mientras el quiz de letras esta en pantalla. */
(function(){
  "use strict";
  if(window.__pa43) return; window.__pa43 = true;

  // Emoji -> slug para los 12 items distintos usados en LETTERS.es/en.
  var MAP = {
    "🌳":"tree",      // 🌳
    "🐘":"elephant",  // 🐘
    "🐻":"bear",      // 🐻
    "🍎":"apple",     // 🍎
    "☀️":"sun",       // ☀️
    "🌙":"moon",      // 🌙
    "🐶":"dog",       // 🐶
    "🏠":"house",     // 🏠
    "⚽":"ball",            // ⚽
    "🐱":"cat",       // 🐱
    "🐟":"fish",      // 🐟
    "🐙":"octopus"    // 🐙
  };
  var FOX = "🦊"; // 🦊
  var SLUGS = ["tree","elephant","bear","apple","sun","moon","dog","house","ball","cat","fish","octopus"];

  function clearSlugClasses(el){
    for(var i=0;i<SLUGS.length;i++) el.classList.remove("pa43-"+SLUGS[i]);
  }

  function isReadingQuiz(stage){
    return !!(stage && stage.querySelector(".lettertile"));
  }

  function syncStage(){
    try{
      var stage = document.getElementById("stage");
      if(!stage) return;
      var reading = isReadingQuiz(stage);
      var cfaces = stage.querySelectorAll(".choice .cface");
      for(var i=0;i<cfaces.length;i++){
        var el = cfaces[i];
        var txt = (el.textContent || "").trim();
        var slug = MAP[txt];
        if(reading && slug){
          clearSlugClasses(el);
          el.classList.add("pa43-ico-on");
          el.classList.add("pa43-"+slug);
        } else {
          el.classList.remove("pa43-ico-on");
          clearSlugClasses(el);
        }
      }
      syncFox(reading);
    }catch(e){}
  }

  function syncFox(reading){
    try{
      var av = document.querySelector("#profileChip .av");
      if(!av) return;
      var txt = (av.textContent || "").trim();
      if(reading && txt === FOX){
        av.classList.add("pa43-fox-on");
        av.classList.add("pa43-fox");
      } else {
        av.classList.remove("pa43-fox-on");
        av.classList.remove("pa43-fox");
      }
    }catch(e){}
  }

  function build(){
    var stage = document.getElementById("stage");
    var game = document.getElementById("game");
    var chip = document.getElementById("profileChip");
    if(!stage || !game) return false;

    syncStage();

    try{
      if(window.MutationObserver){
        // El quiz reconstruye #stage por completo en cada ronda (stage.innerHTML='').
        new MutationObserver(syncStage).observe(stage, {childList:true, subtree:true, characterData:true});
        // Al entrar/salir de la pantalla de juego (clase "active") tambien
        // hay que re-evaluar (p.ej. para apagar el icono del zorro al volver
        // al home).
        new MutationObserver(syncStage).observe(game, {attributes:true, attributeFilter:["class"]});
        // El chip de perfil puede refrescar su avatar (cambio de perfil)
        // independientemente del stage.
        if(chip) new MutationObserver(syncStage).observe(chip, {childList:true, subtree:true, characterData:true});
      }
    }catch(e){}
    return true;
  }

  var tries = 0;
  var iv = setInterval(function(){
    tries++;
    if(build() || tries > 240) clearInterval(iv);
  }, 500);
})();
