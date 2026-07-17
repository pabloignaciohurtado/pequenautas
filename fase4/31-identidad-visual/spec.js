"use strict";
/* ==================== FASE 4 - #31 Identidad visual "Aventuras en el Bosque" ====================
   Skin papel recortado. 100% ADITIVO y defensivo:
   - Si existe #peqMascot (mejora #16), reemplaza su contenido por el SVG de
     Rufo (zorro papel recortado plano). Si no existe, no crea nada.
   - Cambia en runtime el texto del <h1> del home y document.title (el rename
     visual queda gated por este modulo; index.html NO se edita).
   - Cero red, cero dependencias. Si un nodo no existe, no rompe nada.
   Los caracteres no ASCII de las cadenas visibles van como \uXXXX. */
(function(){
  "use strict";
  if(window.__pa31Applied) return; // idempotente
  window.__pa31Applied = true;

  var MDOT = String.fromCharCode(0xB7); // "middle dot"
  var TITLE_APP = "Aventuras en el Bosque";
  var TITLE_DOC = TITLE_APP + " " + MDOT + " Aprende jugando";

  var RUFO_SVG = '<svg viewBox="0 0 200 200" width="96" height="96" aria-label="Rufo">'
    + '<path d="M60 150 Q40 100 70 70 L60 40 L90 62 Q100 55 110 62 L140 40 L130 70 Q160 100 140 150 Z" fill="#E8843A"/>'
    + '<path d="M65 150 Q100 172 135 150 L128 132 Q100 148 72 132 Z" fill="#FFF8EA"/>'
    + '<circle cx="82" cy="96" r="17" fill="#FFFDF7"/>'
    + '<circle cx="118" cy="96" r="17" fill="#FFFDF7"/>'
    + '<circle cx="85" cy="97" r="6.5" fill="#2E3B2C"/>'
    + '<circle cx="121" cy="97" r="6.5" fill="#2E3B2C"/>'
    + '<polygon points="100,108 93,119 107,119" fill="#2E3B2C"/>'
    + '<path d="M60 46 L45 16 L74 40 Z" fill="#E8843A"/>'
    + '<path d="M140 46 L155 16 L126 40 Z" fill="#E8843A"/>'
    + '<polygon points="56,28 49,20 65,32" fill="#FFF8EA"/>'
    + '<polygon points="144,28 151,20 135,32" fill="#FFF8EA"/>'
    + '</svg>';

  function dressMascot(){
    try{
      var m = document.getElementById('peqMascot');
      if(m && !m.__pa31Rufo){
        m.__pa31Rufo = true;
        m.innerHTML = RUFO_SVG;
      }
    }catch(e){}
  }

  function renameHome(){
    try{
      var home = document.getElementById('home');
      var h1 = home ? home.querySelector('.hero h1') : null;
      if(h1) h1.textContent = TITLE_APP;
    }catch(e){}
    try{ document.title = TITLE_DOC; }catch(e){}
  }

  function init(){
    renameHome();
    dressMascot();
    // #16 puede crear #peqMascot despues de este modulo (orden de carga previo
    // en MODULES): observa el DOM un rato y viste al zorro cuando aparezca.
    try{
      if(!document.getElementById('peqMascot') && window.MutationObserver){
        var tries = 0;
        var mo = new MutationObserver(function(){
          tries++;
          if(document.getElementById('peqMascot')){ dressMascot(); mo.disconnect(); }
          else if(tries > 400){ mo.disconnect(); }
        });
        mo.observe(document.body || document.documentElement, {childList:true, subtree:true});
        setTimeout(function(){ try{ mo.disconnect(); dressMascot(); }catch(e){} }, 8000);
      }
    }catch(e){}
  }

  /* ---------- API publica (tests / tooling) ---------- */
  window.__identidadBosque = {
    title: TITLE_APP,
    rufoSvg: function(){ return RUFO_SVG; },
    apply: function(){ renameHome(); dressMascot(); }
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} });
  else { try{ init(); }catch(e){} }
})();
