"use strict";
/* ==================== FASE 4 - #33 Hero diorama 3D + rediseno home ====================
   100% ADITIVO y defensivo. No toca app.js, sw.js, ship/ ni STORE_KEY. Cero red.
   - Inserta una banda hero (diorama papel) al principio del home, encima de las
     tarjetas: fondo de bosque + Rufo saludando + saludo con el nombre del perfil.
   - Reemplaza la navegacion suelta del #32 por una barra inferior de 4 items
     (Inicio activo, Mapa, Mochila, Adultos) cableada a window.PEQ32 y al gate.
   - Inserta a Rufo celebrando cuando aparece el nodo de logro (#celebrate.show).
   Las imagenes van via clases CSS (data-URI en img/*.css). Solo ASCII: los
   acentos se construyen con String.fromCharCode. Todo bajo try/catch. */
(function(){
  "use strict";
  if(window.__pa33Applied) return;
  window.__pa33Applied = true;

  var EXCL = String.fromCharCode(161); /* signo de exclamacion inicial */

  /* ---------- Saludo con el nombre del perfil (leido del DOM) ---------- */
  function profileName(){
    try{
      var nm = document.getElementById('chipNm');
      var t = nm ? (nm.textContent || '').trim() : '';
      if(t && t !== String.fromCharCode(8212) && t !== '-') return t; /* 8212 = raya */
    }catch(e){}
    return '';
  }
  function greetText(){
    var n = profileName();
    return EXCL + 'Hola' + (n ? ', ' + n : '') + '!';
  }
  function refreshGreet(){
    try{
      var hi = document.querySelector('.pa33-hero .pa33-greet .hi');
      if(hi) hi.textContent = greetText();
    }catch(e){}
  }

  /* ---------- Banda hero ---------- */
  function injectHero(){
    try{
      var home = document.getElementById('home');
      if(!home) return;
      if(home.querySelector('.pa33-hero')) { refreshGreet(); return; }

      var hero = document.createElement('div');
      hero.className = 'pa33-hero';

      var bg = document.createElement('div');
      bg.className = 'pa33-hero-bg';

      var saludaWrap = document.createElement('div');
      saludaWrap.className = 'pa33-saluda';
      var saludaImg = document.createElement('div');
      saludaImg.className = 'pa33-saluda-img';
      saludaImg.setAttribute('role','img');
      saludaImg.setAttribute('aria-label','Rufo');
      saludaWrap.appendChild(saludaImg);

      var greet = document.createElement('div');
      greet.className = 'pa33-greet';
      var panel = document.createElement('div');
      panel.className = 'panel';
      var hi = document.createElement('div');
      hi.className = 'hi';
      hi.textContent = greetText();
      var sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = 'Vamos a explorar el bosque';
      panel.appendChild(hi);
      panel.appendChild(sub);
      greet.appendChild(panel);

      var idleWrap = document.createElement('div');
      idleWrap.className = 'pa33-idle';
      var idleImg = document.createElement('div');
      idleImg.className = 'pa33-idle-img';
      idleImg.setAttribute('aria-hidden','true');
      idleWrap.appendChild(idleImg);

      hero.appendChild(bg);
      hero.appendChild(saludaWrap);
      hero.appendChild(greet);
      hero.appendChild(idleWrap);

      var cards = home.querySelector('.cards');
      var heroTitle = home.querySelector('.hero');
      if(heroTitle && heroTitle.parentNode === home){
        home.insertBefore(hero, heroTitle.nextSibling);
      } else if(cards){
        home.insertBefore(hero, cards);
      } else {
        home.insertBefore(hero, home.firstChild);
      }

      /* Actualiza el saludo si cambia el perfil (chipNm) */
      try{
        var nm = document.getElementById('chipNm');
        if(nm && window.MutationObserver){
          var mo = new MutationObserver(function(){ refreshGreet(); });
          mo.observe(nm, {childList:true, characterData:true, subtree:true});
        }
      }catch(e){}
    }catch(e){}
  }

  /* ---------- Iconos SVG de la barra inferior ---------- */
  function ic(name){
    if(name === 'home')
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
        + '<path d="M4 11 L12 4 L20 11" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M6 10 V20 H18 V10" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if(name === 'map')
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
        + '<path d="M4 6 L9 4 L15 6 L20 4 V18 L15 20 L9 18 L4 20 Z" stroke-width="2.2" stroke-linejoin="round"/>'
        + '<path d="M9 4 V18 M15 6 V20" stroke-width="2.2"/></svg>';
    if(name === 'bag')
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
        + '<path d="M6 8 H18 L19 20 H5 Z" stroke-width="2.2" stroke-linejoin="round"/>'
        + '<path d="M9 8 A3 3 0 0 1 15 8" stroke-width="2.2"/></svg>';
    /* adults */
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
      + '<circle cx="12" cy="8" r="3.4" stroke-width="2.2"/>'
      + '<path d="M5 20 C5 15.5 8 14 12 14 C16 14 19 15.5 19 20" stroke-width="2.2" stroke-linecap="round"/></svg>';
  }

  function openAdults(){
    try{
      var ab = document.getElementById('adultBtn');
      if(ab){ ab.click(); return; }
    }catch(e){}
    try{ if(window.PEQ32 && typeof window.PEQ32.abrirGate === 'function') window.PEQ32.abrirGate(function(){}); }catch(e){}
  }

  /* ---------- Barra inferior ---------- */
  function buildTab(name, label, active, onClick){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pa33-tab' + (active ? ' active' : '');
    b.setAttribute('aria-label', label);
    b.innerHTML = ic(name) + '<span>' + label + '</span>';
    if(onClick) b.addEventListener('click', onClick);
    return b;
  }
  function injectTabbar(){
    try{
      if(document.querySelector('.pa33-tabbar')) return;
      var bar = document.createElement('div');
      bar.className = 'pa33-tabbar';
      bar.setAttribute('role','navigation');
      bar.setAttribute('aria-label','Navegacion');

      bar.appendChild(buildTab('home','Inicio', true, function(){ /* ya estamos en el home */ }));
      bar.appendChild(buildTab('map','Mapa', false, function(){
        try{ if(window.PEQ32 && window.PEQ32.abrirMapa) window.PEQ32.abrirMapa(); }catch(e){}
      }));
      bar.appendChild(buildTab('bag','Mochila', false, function(){
        try{ if(window.PEQ32 && window.PEQ32.abrirMochila) window.PEQ32.abrirMochila(); }catch(e){}
      }));
      bar.appendChild(buildTab('adults','Adultos', false, function(){ openAdults(); }));

      (document.body || document.documentElement).appendChild(bar);
      updateTabbar();

      /* Muestra la barra solo cuando el home esta activo */
      try{
        var home = document.getElementById('home');
        if(home && window.MutationObserver){
          var mo = new MutationObserver(function(){ updateTabbar(); });
          mo.observe(home, {attributes:true, attributeFilter:['class']});
        }
      }catch(e){}
    }catch(e){}
  }
  function updateTabbar(){
    try{
      var bar = document.querySelector('.pa33-tabbar');
      var home = document.getElementById('home');
      if(!bar || !home) return;
      var active = home.classList.contains('active');
      if(active) bar.classList.add('show'); else bar.classList.remove('show');
    }catch(e){}
  }

  /* ---------- Rufo celebrando en el logro ---------- */
  function injectCelebra(){
    try{
      var cel = document.getElementById('celebrate');
      if(!cel || cel.querySelector('.pa33-celebra')) return;
      var wrap = document.createElement('div');
      wrap.className = 'pa33-celebra';
      var fig = document.createElement('div');
      fig.className = 'pa33-celebra-fig';
      fig.setAttribute('role','img');
      fig.setAttribute('aria-label','Rufo celebra');
      wrap.appendChild(fig);
      cel.insertBefore(wrap, cel.firstChild);
      cel.classList.add('pa33-celebrate-on');
    }catch(e){}
  }
  function wireCelebra(){
    try{
      var cel = document.getElementById('celebrate');
      if(!cel) return;
      if(cel.classList.contains('show')) injectCelebra();
      if(window.MutationObserver){
        var mo = new MutationObserver(function(){
          if(cel.classList.contains('show')) injectCelebra();
        });
        mo.observe(cel, {attributes:true, attributeFilter:['class']});
      }
    }catch(e){}
  }

  function init(){
    injectHero();
    injectTabbar();
    wireCelebra();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} });
  } else {
    try{ init(); }catch(e){}
  }
})();
