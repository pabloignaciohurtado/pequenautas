/* Fase 4 #49 - Iconos papercraft del quiz "¿Que empieza con L?" (roundReading
   en app.js). 100% aditivo: no toca app.js ni index.html.

   Detecta con MutationObserver cuando #stage renderiza las tarjetas
   .choice > .cface de esa ronda (se reconoce por la presencia de .lettertile,
   que roundReading es la unica ronda que crea) y les anade las clases
   pa49-ico-on + pa49-<slug>; el CSS del modulo oculta el glifo emoji
   (font-size:0) y pinta el icono via background-image.

   Fuera del quiz de letras las clases se retiran, asi que math/science
   conservan su aspecto original. */
(function(){
  "use strict";
  if(window.__pa49) return; window.__pa49 = true;

  function cp(){ return String.fromCodePoint.apply(String, arguments); }

  // Los 12 items distintos de LETTERS.es / LETTERS.en en app.js.
  var MAP = {};
  MAP[cp(0x1F333)] = "tree";      // arbol
  MAP[cp(0x1F418)] = "elephant";  // elefante
  MAP[cp(0x1F43B)] = "bear";      // oso
  MAP[cp(0x1F34E)] = "apple";     // manzana
  MAP[cp(0x2600, 0xFE0F)] = "sun";
  MAP[cp(0x2600)] = "sun";        // sol (con y sin selector de variacion)
  MAP[cp(0x1F319)] = "moon";      // luna
  MAP[cp(0x1F436)] = "dog";       // perro
  MAP[cp(0x1F3E0)] = "house";     // casa
  MAP[cp(0x26BD, 0xFE0F)] = "ball";
  MAP[cp(0x26BD)] = "ball";       // pelota
  MAP[cp(0x1F431)] = "cat";       // gato
  MAP[cp(0x1F41F)] = "fish";      // pez
  MAP[cp(0x1F419)] = "octopus";   // pulpo

  var SLUGS = ["tree","elephant","bear","apple","sun","moon","dog","house",
               "ball","cat","fish","octopus"];

  function clearSlugs(el){
    for(var i=0;i<SLUGS.length;i++) el.classList.remove("pa49-"+SLUGS[i]);
  }

  function slugOf(el){
    var t = (el.textContent || "").trim();
    if(MAP[t]) return MAP[t];
    // por si el nodo trae (o pierde) el selector de variacion U+FE0F
    var bare = t.replace(/️/g, "");
    return MAP[bare] || null;
  }

  function syncStage(){
    try{
      var stage = document.getElementById("stage");
      if(!stage) return;
      var reading = !!stage.querySelector(".lettertile");
      var cfaces = stage.querySelectorAll(".choice .cface");
      for(var i=0;i<cfaces.length;i++){
        var el = cfaces[i];
        var slug = reading ? slugOf(el) : null;
        if(slug){
          clearSlugs(el);
          el.classList.add("pa49-ico-on");
          el.classList.add("pa49-" + slug);
        } else {
          el.classList.remove("pa49-ico-on");
          clearSlugs(el);
        }
      }
    }catch(e){}
  }

  function build(){
    var stage = document.getElementById("stage");
    var game = document.getElementById("game");
    if(!stage || !game) return false;
    syncStage();
    try{
      if(window.MutationObserver){
        // El quiz reconstruye #stage entero en cada ronda (stage.innerHTML='').
        new MutationObserver(syncStage).observe(stage,
          {childList:true, subtree:true, characterData:true});
        // Al entrar/salir de la pantalla de juego hay que re-evaluar.
        new MutationObserver(syncStage).observe(game,
          {attributes:true, attributeFilter:["class"]});
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
