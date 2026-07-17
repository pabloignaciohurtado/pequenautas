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

/* ==================== FASE 4 - #31 (tanda 2) Iconos papel recortado ====================
   Reemplaza en runtime los emoji de avatares, tarjetas de materia y trofeo de
   celebracion por SVGs inline planos estilo papel recortado. 100% ADITIVO:
   - No toca app.js ni STORE_KEY; solo sustituye contenido visual de nodos
     cuyo textContent es exactamente uno de los emoji conocidos.
   - Scan acotado a contenedores concretos (nada de recorrer todo el body).
   - Idempotente: tras el swap el nodo contiene un <svg data-pa31-ico>, su
     textContent ya no es un emoji del mapa y no se reprocesa. Si app.js
     reescribe el texto (syncChip, celebrate, renderAvatarPicker...), el
     MutationObserver (throttled) vuelve a aplicar el swap.
   - Solo ASCII en este archivo; emoji construidos con String.fromCodePoint. */
(function(){
  "use strict";
  if(window.__pa31IconosApplied) return;
  window.__pa31IconosApplied = true;

  function cp(n){ try{ return String.fromCodePoint(n); }catch(e){ return ""; } }

  /* ---------- Paleta papel ---------- */
  var NAR="#E8843A", VER="#57C596", VERD="#3D7A4A", AZU="#4EA8DE",
      COR="#F2748C", CRE="#FFF8EA", TIN="#2E3B2C", SOL="#FDBA4D";

  /* ---------- Cuerpos SVG (viewBox 0 0 100 100, formas planas) ---------- */
  var BODIES = {
    numeros: '<rect x="18" y="14" width="70" height="76" rx="8" fill="'+AZU+'" transform="rotate(4 53 52)"/>'
      + '<rect x="14" y="10" width="70" height="76" rx="8" fill="'+CRE+'"/>'
      + '<text x="49" y="72" font-family="Fredoka,system-ui,sans-serif" font-size="58" font-weight="700" text-anchor="middle" fill="'+AZU+'">5</text>',
    letras: '<rect x="18" y="14" width="70" height="76" rx="8" fill="'+COR+'" transform="rotate(-4 53 52)"/>'
      + '<rect x="14" y="10" width="70" height="76" rx="8" fill="'+CRE+'"/>'
      + '<text x="49" y="72" font-family="Fredoka,system-ui,sans-serif" font-size="58" font-weight="700" text-anchor="middle" fill="'+COR+'">A</text>',
    animales: '<circle cx="52" cy="54" r="44" fill="'+VER+'"/>'
      + '<circle cx="50" cy="52" r="42" fill="'+CRE+'"/>'
      + '<ellipse cx="50" cy="62" rx="17" ry="14" fill="'+NAR+'"/>'
      + '<circle cx="30" cy="42" r="8" fill="'+NAR+'"/>'
      + '<circle cx="44" cy="34" r="8" fill="'+NAR+'"/>'
      + '<circle cx="58" cy="34" r="8" fill="'+NAR+'"/>'
      + '<circle cx="71" cy="42" r="8" fill="'+NAR+'"/>',
    trofeo: '<circle cx="52" cy="54" r="44" fill="'+VERD+'"/>'
      + '<circle cx="50" cy="52" r="42" fill="'+CRE+'"/>'
      + '<polygon points="50,16 60,40 86,42 66,59 72,84 50,70 28,84 34,59 14,42 40,40" fill="'+SOL+'"/>'
      + '<circle cx="50" cy="52" r="9" fill="'+CRE+'"/>',
    zorro: '<circle cx="50" cy="52" r="44" fill="#FFE3C2"/>'
      + '<path d="M28 22 L38 40 L22 44 Z" fill="'+NAR+'"/>'
      + '<path d="M72 22 L62 40 L78 44 Z" fill="'+NAR+'"/>'
      + '<path d="M26 44 Q50 30 74 44 Q80 62 50 80 Q20 62 26 44 Z" fill="'+NAR+'"/>'
      + '<path d="M38 62 Q50 74 62 62 L50 78 Z" fill="'+CRE+'"/>'
      + '<circle cx="40" cy="54" r="4" fill="'+TIN+'"/>'
      + '<circle cx="60" cy="54" r="4" fill="'+TIN+'"/>'
      + '<polygon points="50,66 45,72 55,72" fill="'+TIN+'"/>',
    panda: '<circle cx="50" cy="52" r="44" fill="#DFF2E7"/>'
      + '<circle cx="27" cy="30" r="11" fill="'+TIN+'"/>'
      + '<circle cx="73" cy="30" r="11" fill="'+TIN+'"/>'
      + '<circle cx="50" cy="54" r="28" fill="'+CRE+'"/>'
      + '<ellipse cx="39" cy="50" rx="8" ry="10" fill="'+TIN+'" transform="rotate(-15 39 50)"/>'
      + '<ellipse cx="61" cy="50" rx="8" ry="10" fill="'+TIN+'" transform="rotate(15 61 50)"/>'
      + '<circle cx="40" cy="50" r="3" fill="'+CRE+'"/>'
      + '<circle cx="60" cy="50" r="3" fill="'+CRE+'"/>'
      + '<ellipse cx="50" cy="64" rx="5" ry="4" fill="'+TIN+'"/>',
    conejo: '<circle cx="50" cy="52" r="44" fill="#CDE9FF"/>'
      + '<ellipse cx="38" cy="26" rx="8" ry="18" fill="'+CRE+'" transform="rotate(-8 38 26)"/>'
      + '<ellipse cx="62" cy="26" rx="8" ry="18" fill="'+CRE+'" transform="rotate(8 62 26)"/>'
      + '<ellipse cx="38" cy="27" rx="3.5" ry="11" fill="'+COR+'" transform="rotate(-8 38 27)"/>'
      + '<ellipse cx="62" cy="27" rx="3.5" ry="11" fill="'+COR+'" transform="rotate(8 62 27)"/>'
      + '<circle cx="50" cy="58" r="24" fill="'+CRE+'"/>'
      + '<circle cx="42" cy="54" r="3.5" fill="'+TIN+'"/>'
      + '<circle cx="58" cy="54" r="3.5" fill="'+TIN+'"/>'
      + '<ellipse cx="50" cy="65" rx="4" ry="3" fill="'+COR+'"/>',
    rana: '<circle cx="50" cy="52" r="44" fill="#FFE9C9"/>'
      + '<circle cx="34" cy="32" r="11" fill="'+VER+'"/>'
      + '<circle cx="66" cy="32" r="11" fill="'+VER+'"/>'
      + '<circle cx="34" cy="31" r="6" fill="'+CRE+'"/>'
      + '<circle cx="66" cy="31" r="6" fill="'+CRE+'"/>'
      + '<circle cx="34" cy="31" r="3" fill="'+TIN+'"/>'
      + '<circle cx="66" cy="31" r="3" fill="'+TIN+'"/>'
      + '<ellipse cx="50" cy="58" rx="30" ry="24" fill="'+VER+'"/>'
      + '<path d="M36 62 Q50 72 64 62" stroke="'+TIN+'" stroke-width="4" fill="none" stroke-linecap="round"/>',
    leon: '<circle cx="50" cy="52" r="44" fill="#D9F0FF"/>'
      + '<circle cx="50" cy="52" r="34" fill="'+NAR+'"/>'
      + '<circle cx="50" cy="54" r="24" fill="'+SOL+'"/>'
      + '<circle cx="42" cy="50" r="3.5" fill="'+TIN+'"/>'
      + '<circle cx="58" cy="50" r="3.5" fill="'+TIN+'"/>'
      + '<polygon points="50,58 45,64 55,64" fill="'+TIN+'"/>'
      + '<path d="M50 64 L50 70" stroke="'+TIN+'" stroke-width="3" stroke-linecap="round"/>',
    tigre: '<circle cx="50" cy="52" r="44" fill="#DFF2E7"/>'
      + '<circle cx="30" cy="28" r="9" fill="'+NAR+'"/>'
      + '<circle cx="70" cy="28" r="9" fill="'+NAR+'"/>'
      + '<circle cx="50" cy="54" r="28" fill="'+NAR+'"/>'
      + '<path d="M50 26 L46 36 L54 36 Z" fill="'+TIN+'"/>'
      + '<path d="M26 46 L36 50 L27 55 Z" fill="'+TIN+'"/>'
      + '<path d="M74 46 L64 50 L73 55 Z" fill="'+TIN+'"/>'
      + '<circle cx="41" cy="52" r="3.5" fill="'+TIN+'"/>'
      + '<circle cx="59" cy="52" r="3.5" fill="'+TIN+'"/>'
      + '<ellipse cx="50" cy="66" rx="10" ry="8" fill="'+CRE+'"/>'
      + '<polygon points="50,62 46,66 54,66" fill="'+TIN+'"/>',
    pinguino: '<circle cx="50" cy="52" r="44" fill="#CDE9FF"/>'
      + '<ellipse cx="50" cy="54" rx="28" ry="32" fill="'+TIN+'"/>'
      + '<ellipse cx="50" cy="60" rx="18" ry="22" fill="'+CRE+'"/>'
      + '<circle cx="42" cy="46" r="3.5" fill="'+TIN+'"/>'
      + '<circle cx="58" cy="46" r="3.5" fill="'+TIN+'"/>'
      + '<polygon points="50,52 43,58 57,58" fill="'+NAR+'"/>',
    koala: '<circle cx="50" cy="52" r="44" fill="#FFDCE3"/>'
      + '<circle cx="26" cy="36" r="13" fill="#9FB3A6"/>'
      + '<circle cx="74" cy="36" r="13" fill="#9FB3A6"/>'
      + '<circle cx="26" cy="36" r="6" fill="'+COR+'"/>'
      + '<circle cx="74" cy="36" r="6" fill="'+COR+'"/>'
      + '<circle cx="50" cy="54" r="27" fill="#9FB3A6"/>'
      + '<circle cx="41" cy="50" r="3.5" fill="'+TIN+'"/>'
      + '<circle cx="59" cy="50" r="3.5" fill="'+TIN+'"/>'
      + '<ellipse cx="50" cy="62" rx="7" ry="10" fill="'+TIN+'"/>',
    mono: '<circle cx="50" cy="52" r="44" fill="#E8F6D9"/>'
      + '<circle cx="26" cy="50" r="10" fill="#8C5A33"/>'
      + '<circle cx="74" cy="50" r="10" fill="#8C5A33"/>'
      + '<circle cx="50" cy="52" r="28" fill="#8C5A33"/>'
      + '<circle cx="41" cy="44" r="10" fill="'+CRE+'"/>'
      + '<circle cx="59" cy="44" r="10" fill="'+CRE+'"/>'
      + '<ellipse cx="50" cy="62" rx="16" ry="12" fill="'+CRE+'"/>'
      + '<circle cx="42" cy="46" r="3.5" fill="'+TIN+'"/>'
      + '<circle cx="58" cy="46" r="3.5" fill="'+TIN+'"/>'
      + '<path d="M42 66 Q50 72 58 66" stroke="'+TIN+'" stroke-width="3" fill="none" stroke-linecap="round"/>',
    cerdo: '<circle cx="50" cy="52" r="44" fill="#DFF2E7"/>'
      + '<polygon points="26,28 40,36 26,44" fill="#FFA0AE"/>'
      + '<polygon points="74,28 60,36 74,44" fill="#FFA0AE"/>'
      + '<circle cx="50" cy="54" r="28" fill="#FFA0AE"/>'
      + '<circle cx="40" cy="48" r="3.5" fill="'+TIN+'"/>'
      + '<circle cx="60" cy="48" r="3.5" fill="'+TIN+'"/>'
      + '<ellipse cx="50" cy="62" rx="12" ry="9" fill="'+COR+'"/>'
      + '<circle cx="45" cy="62" r="2.5" fill="'+TIN+'"/>'
      + '<circle cx="55" cy="62" r="2.5" fill="'+TIN+'"/>'
  };

  function svgOf(nombre, px){
    var b = BODIES[nombre];
    if(!b) return "";
    var s = Math.max(12, Math.round(px || 48));
    return '<svg viewBox="0 0 100 100" width="'+s+'" height="'+s+'" aria-hidden="true" data-pa31-ico="'+nombre+'" style="display:block">'+b+'</svg>';
  }

  window.PEQ_ICONOS = { map: BODIES, svg: svgOf };

  /* ---------- Mapa emoji -> nombre de SVG ---------- */
  var EMOJI = {};
  EMOJI[cp(0x1F522)] = "numeros";  // input numbers
  EMOJI[cp(0x1F524)] = "letras";   // input latin letters
  EMOJI[cp(0x1F422)] = "animales"; // turtle (tarjeta Animales)
  EMOJI[cp(0x1F3C6)] = "trofeo";   // trophy
  EMOJI[cp(0x1F389)] = "trofeo";   // party popper (celebracion)
  EMOJI[cp(0x1F31F)] = "trofeo";   // glowing star (celebracion)
  EMOJI[cp(0x1F388)] = "trofeo";   // balloon (celebracion)
  // AVATARS de app.js: fox, panda, rabbit, frog, lion, tiger, penguin, koala, monkey, pig
  EMOJI[cp(0x1F98A)] = "zorro";
  EMOJI[cp(0x1F43C)] = "panda";
  EMOJI[cp(0x1F430)] = "conejo";
  EMOJI[cp(0x1F438)] = "rana";
  EMOJI[cp(0x1F981)] = "leon";
  EMOJI[cp(0x1F42F)] = "tigre";
  EMOJI[cp(0x1F427)] = "pinguino";
  EMOJI[cp(0x1F428)] = "koala";
  EMOJI[cp(0x1F435)] = "mono";
  EMOJI[cp(0x1F437)] = "cerdo";

  /* Contenedores concretos donde viven esos emoji (nada de body global) */
  var SCOPES = ['#home .cards', '#plist', '#profileChip', '#avpick', '#eduBody', '#celebrate'];
  var TARGETS = '.emoji,.av,.avopt,.eduAv,.trophy';

  function swapNode(el){
    try{
      if(!el || el.querySelector('svg[data-pa31-ico]')) return;
      var t = (el.textContent || "").trim();
      var name = EMOJI[t];
      if(!name) return;
      var px = 48;
      try{ px = parseFloat(window.getComputedStyle(el).fontSize) || 48; }catch(e){}
      var html = svgOf(name, Math.round(px * 1.15));
      if(!html) return;
      el.innerHTML = html;
      el.setAttribute('data-pa31-swapped', name);
    }catch(e){}
  }

  function swapGlyphs(){
    try{
      for(var i=0;i<SCOPES.length;i++){
        var root = document.querySelector(SCOPES[i]);
        if(!root) continue;
        if(root.matches && root.matches(TARGETS)) swapNode(root);
        var list = root.querySelectorAll(TARGETS);
        for(var j=0;j<list.length;j++) swapNode(list[j]);
      }
    }catch(e){}
  }
  window.PEQ_ICONOS.swapGlyphs = swapGlyphs;

  var pending = false;
  function scheduleSwap(){
    if(pending) return;
    pending = true;
    setTimeout(function(){ pending = false; try{ swapGlyphs(); }catch(e){} }, 120);
  }

  function initIconos(){
    swapGlyphs();
    try{
      if(window.MutationObserver){
        var app = document.getElementById('app') || document.body;
        if(app){
          var mo = new MutationObserver(scheduleSwap);
          mo.observe(app, {childList:true, subtree:true, characterData:true});
        }
      }
    }catch(e){}
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ try{ initIconos(); }catch(e){} });
  else { try{ initIconos(); }catch(e){} }
})();
