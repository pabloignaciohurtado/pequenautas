"use strict";
/* ==================== FASE 4 - #32 Pantallas del bosque ====================
   Overlays estilo papel recortado + fix del boton duplicado del modal
   "Nuevo peque". 100% ADITIVO y defensivo. No toca app.js, sw.js, ship/ ni
   STORE_KEY. Lee el progreso real leyendo localStorage 'pequenautas.v1'
   (contrato estable) sin depender de simbolos de ambito de script de app.js.
   Todas las cadenas no ASCII van como \uXXXX. Cero red.

   Contenido:
   1. FIX boton duplicado: en el modal #newView conviven el boton crear
      (#createBtn Listo) y el boton generico de cierre del panel
      (#closeSheet "Listo"), que app.js nunca oculta al mostrar #newView
      (showSheetView solo togglea display de gateView/adultView/newView).
      Se oculta #closeSheet mientras #newView este visible (reversible).
   2. Overlays: Mapa de Aventuras y Mochila de Logros (cableados a botones
      inyectados en el home). Pausa y Gate quedan listos como
      window.PEQ32.abrirPausa()/abrirGate(cb) (no cableados). */
(function(){
  "use strict";
  if(window.__pa32Applied) return;
  window.__pa32Applied = true;

  /* ---------- Paleta ---------- */
  var CRE="#FFF8EA", TIN="#2E3B2C", SOL="#FDBA4D", NAR="#E8843A";

  /* ---------- Textos (acentos como \uXXXX) ---------- */
  var T = {
    mapTitle:   "Mapa de Aventuras",
    mapSub:     "Tu camino por el bosque",
    bagTitle:   "Mochila de Logros",
    bagSub:     "Tus insignias del bosque",
    navMap:     "Ir al mapa",
    navBag:     "Mochila",
    nivel:      "Nivel ",
    racha:      "Racha: ",
    dias:       " días",     // dias
    pauseTitle: "Hora de descansar",
    pauseMsg:   "Estira las piernas y respira. ¡Rufo te espera para seguir!", // Rufo espera
    pauseCta:   "Seguir jugando",
    gateTitle:  "Solo para grandes",
    gateSub:    "Resuelve para continuar.",
    gateQ:      "¿Cuánto es 7 + 4?", // Cuanto es 7 + 4
    cerrar:     "Cerrar",
    b_star1:    "Primera estrella",
    b_star5:    "Cinco estrellas",
    b_star10:   "Diez estrellas",
    b_num:      "Números",    // Numeros
    b_let:      "Letras",
    b_ani:      "Animales",
    b_racha:    "Racha de 3",
    b_lvl:      "Explorador"
  };

  /* ---------- SVG helpers ---------- */
  var CHECK = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">'
    + '<path d="M5 13 l4 4 l10 -11" fill="none" stroke="'+CRE+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
    + '<rect x="5" y="10" width="14" height="10" rx="2" fill="'+TIN+'"/>'
    + '<path d="M8 10 V7 a4 4 0 0 1 8 0 V10" fill="none" stroke="'+TIN+'" stroke-width="2.4"/></svg>';
  function starSvg(sz){
    var s = sz||34;
    return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" aria-hidden="true">'
      + '<polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" fill="'+SOL+'" stroke="'+TIN+'" stroke-width="1"/></svg>';
  }
  var MAP_IC = '<svg class="pa32-ic" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M4 6 l5 -2 l6 2 l5 -2 v14 l-5 2 l-6 -2 l-5 2 Z" fill="none" stroke="'+TIN+'" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M9 4 v14 M15 6 v14" stroke="'+TIN+'" stroke-width="2"/></svg>';
  var BAG_IC = '<svg class="pa32-ic" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M6 9 h12 l1 11 H5 Z" fill="none" stroke="'+TIN+'" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M9 9 a3 3 0 0 1 6 0" fill="none" stroke="'+TIN+'" stroke-width="2"/></svg>';
  function rufoSvg(){
    try{
      if(window.PEQ_ICONOS && typeof window.PEQ_ICONOS.svg === 'function'){
        var s = window.PEQ_ICONOS.svg('zorro', 110);
        if(s) return s;
      }
    }catch(e){}
    return '<svg viewBox="0 0 100 100" width="110" height="110" aria-hidden="true">'
      + '<circle cx="50" cy="52" r="40" fill="'+NAR+'"/>'
      + '<circle cx="42" cy="50" r="4" fill="'+TIN+'"/><circle cx="58" cy="50" r="4" fill="'+TIN+'"/>'
      + '<polygon points="50,60 45,66 55,66" fill="'+TIN+'"/></svg>';
  }

  /* ---------- Lectura de progreso real ---------- */
  function readDB(){
    try{
      var r = localStorage.getItem('pequenautas.v1');
      if(r){ var p = JSON.parse(r); if(p && p.profiles) return p; }
    }catch(e){}
    return null;
  }
  function curProfile(){
    var db = readDB(); if(!db) return null;
    var arr = db.profiles || [];
    for(var i=0;i<arr.length;i++){ if(arr[i].id === db.currentId) return arr[i]; }
    return arr[0] || null;
  }

  /* ---------- Racha (clave propia, no toca STORE_KEY) ---------- */
  var RK = 'pequenautas.f4.racha';
  function dstr(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function bumpRacha(){
    try{
      var raw = localStorage.getItem(RK);
      var o = null; try{ o = raw ? JSON.parse(raw) : null; }catch(e){ o = null; }
      var t = dstr(new Date());
      if(!o || typeof o !== 'object'){ o = { last:t, days:1 }; }
      else if(o.last === t){ /* mismo dia, sin cambios */ }
      else {
        var y = new Date(); y.setDate(y.getDate()-1);
        o.days = (o.last === dstr(y)) ? ((o.days||1)+1) : 1;
        o.last = t;
      }
      localStorage.setItem(RK, JSON.stringify(o));
      return o.days || 1;
    }catch(e){ return 0; }
  }
  function getRacha(){
    try{ var raw = localStorage.getItem(RK); if(raw){ var o = JSON.parse(raw); return (o && o.days) || 0; } }catch(e){}
    return 0;
  }

  /* ---------- Helper de overlay (papel recortado, accesible) ---------- */
  function makeOverlay(title, sub, buildBody){
    var lastFocus = null;
    try{ lastFocus = document.activeElement; }catch(e){}
    var ov = document.createElement('div');
    ov.className = 'pa32-ov';
    ov.setAttribute('role','dialog');
    ov.setAttribute('aria-modal','true');
    ov.setAttribute('aria-label', title);

    var card = document.createElement('div');
    card.className = 'pa32-card';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'pa32-close';
    closeBtn.setAttribute('aria-label', T.cerrar);
    closeBtn.innerHTML = '×'; // x

    var h = document.createElement('div');
    h.className = 'pa32-title';
    h.textContent = title;
    var p = document.createElement('div');
    p.className = 'pa32-sub';
    if(sub) p.textContent = sub;

    var body = document.createElement('div');
    body.className = 'pa32-body';

    card.appendChild(closeBtn);
    card.appendChild(h);
    if(sub) card.appendChild(p);
    card.appendChild(body);
    ov.appendChild(card);

    function close(){
      try{ document.removeEventListener('keydown', onKey, true); }catch(e){}
      try{ if(ov.parentNode) ov.parentNode.removeChild(ov); }catch(e){}
      try{ if(lastFocus && lastFocus.focus) lastFocus.focus(); }catch(e){}
    }
    function focusables(){
      try{ return card.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])'); }
      catch(e){ return []; }
    }
    function onKey(e){
      if(e.key === 'Escape'){ e.preventDefault(); close(); return; }
      if(e.key === 'Tab'){
        var f = focusables(); if(!f.length) return;
        var first = f[0], last = f[f.length-1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
    closeBtn.addEventListener('click', close);
    ov.addEventListener('click', function(e){ if(e.target === ov) close(); });
    document.addEventListener('keydown', onKey, true);

    var api = { el:ov, card:card, body:body, close:close };
    try{ if(buildBody) buildBody(body, api); }catch(e){}

    (document.body || document.documentElement).appendChild(ov);
    try{ closeBtn.focus(); }catch(e){}
    return api;
  }

  /* ---------- Mapa de Aventuras ---------- */
  function abrirMapa(){
    return makeOverlay(T.mapTitle, T.mapSub, function(body){
      var p = curProfile();
      var best = (p && p.best) || { math:0, reading:0, science:0 };
      var TOTAL = 6;
      var done;
      if(!p){ done = 2; } // estado de ejemplo funcional si no hay perfil
      else {
        done = (best.math||0) + (best.reading||0) + (best.science||0);
        if(done < 0) done = 0;
      }
      if(done > TOTAL - 1) done = TOTAL - 1; // deja al menos un nodo actual

      var wrap = document.createElement('div');
      wrap.className = 'pa32-map';
      var bg = document.createElement('div');
      bg.className = 'pa32-map-bg';
      wrap.appendChild(bg);

      for(var i=0;i<TOTAL;i++){
        var node = document.createElement('div');
        var cls = (i < done) ? 'done' : (i === done ? 'cur' : 'lock');
        node.className = 'pa32-node ' + cls;
        var path = '<span class="path"></span>';
        var discInner;
        if(cls === 'done') discInner = CHECK;
        else if(cls === 'lock') discInner = LOCK;
        else discInner = String(i+1);
        node.innerHTML = path
          + '<span class="disc">' + discInner + '</span>'
          + '<span class="lbl">' + T.nivel + (i+1) + '</span>';
        wrap.appendChild(node);
      }
      body.appendChild(wrap);
    });
  }

  /* ---------- Mochila de Logros ---------- */
  function abrirMochila(){
    return makeOverlay(T.bagTitle, T.bagSub, function(body){
      var p = curProfile();
      var stars = (p && p.stars) || 0;
      var best = (p && p.best) || { math:0, reading:0, science:0 };
      var racha = getRacha();

      var rachaEl = document.createElement('div');
      rachaEl.className = 'pa32-racha';
      rachaEl.innerHTML = starSvg(24) + '<span>' + T.racha + racha + T.dias + '</span>';
      body.appendChild(rachaEl);

      var defs = [
        { name:T.b_star1,  on: stars >= 1,          ico: starSvg(34) },
        { name:T.b_star5,  on: stars >= 5,          ico: starSvg(34) },
        { name:T.b_star10, on: stars >= 10,         ico: starSvg(34) },
        { name:T.b_num,    on: (best.math||0) >= 1, ico: icoOrText('numeros','5') },
        { name:T.b_let,    on: (best.reading||0) >= 1, ico: icoOrText('letras','A') },
        { name:T.b_ani,    on: (best.science||0) >= 1, ico: icoOrText('animales','') },
        { name:T.b_racha,  on: racha >= 3,          ico: starSvg(34) },
        { name:T.b_lvl,    on: (best.math||0) >= 2 || (best.reading||0) >= 2 || (best.science||0) >= 2, ico: icoOrText('trofeo','') }
      ];

      var grid = document.createElement('div');
      grid.className = 'pa32-grid';
      for(var i=0;i<defs.length;i++){
        var d = defs[i];
        var b = document.createElement('div');
        b.className = 'pa32-badge' + (d.on ? '' : ' locked');
        if(d.on){
          b.innerHTML = '<span class="bico">' + d.ico + '</span>'
            + '<span class="bname">' + d.name + '</span>';
        } else {
          b.innerHTML = '<span class="bico bq">?</span>';
        }
        grid.appendChild(b);
      }
      body.appendChild(grid);
    });
  }
  function icoOrText(nombre, fallback){
    try{
      if(window.PEQ_ICONOS && typeof window.PEQ_ICONOS.svg === 'function'){
        var s = window.PEQ_ICONOS.svg(nombre, 36);
        if(s) return s;
      }
    }catch(e){}
    return fallback ? ('<span style="font-size:26px;font-weight:700;color:'+TIN+'">'+fallback+'</span>') : starSvg(34);
  }

  /* ---------- Pausa de descanso (lista, no cableada) ---------- */
  function abrirPausa(){
    return makeOverlay(T.pauseTitle, '', function(body, api){
      var c = document.createElement('div');
      c.className = 'pa32-center';
      c.innerHTML = '<div class="rufo">' + rufoSvg() + '</div>'
        + '<div class="msg">' + T.pauseMsg + '</div>';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pa32-cta';
      btn.textContent = T.pauseCta;
      btn.addEventListener('click', api.close);
      c.appendChild(btn);
      body.appendChild(c);
    });
  }

  /* ---------- Gate parental (lista, no cableada) ---------- */
  function abrirGate(onPass){
    return makeOverlay(T.gateTitle, T.gateSub, function(body, api){
      var q = document.createElement('div');
      q.className = 'pa32-gate-q';
      q.textContent = T.gateQ;
      body.appendChild(q);
      var opts = document.createElement('div');
      opts.className = 'pa32-gate-opts';
      var vals = [10, 11, 12];
      var CORRECT = 11;
      for(var i=0;i<vals.length;i++){
        (function(v){
          var o = document.createElement('button');
          o.type = 'button';
          o.className = 'pa32-opt';
          o.textContent = String(v);
          o.addEventListener('click', function(){
            if(v === CORRECT){
              o.classList.add('good');
              setTimeout(function(){
                api.close();
                try{ if(typeof onPass === 'function') onPass(); }catch(e){}
              }, 260);
            } else {
              o.classList.remove('bad');
              void o.offsetWidth;
              o.classList.add('bad');
            }
          });
          opts.appendChild(o);
        })(vals[i]);
      }
      body.appendChild(opts);
    });
  }

  /* ---------- FIX boton duplicado del modal "Nuevo peque" ---------- */
  function syncCloseBtn(){
    try{
      var nv = document.getElementById('newView');
      var cs = document.getElementById('closeSheet');
      if(!cs) return;
      var showingNew = false;
      if(nv){
        var disp = '';
        try{ disp = window.getComputedStyle(nv).display; }catch(e){ disp = nv.style.display; }
        showingNew = disp !== 'none';
      }
      cs.style.display = showingNew ? 'none' : '';
    }catch(e){}
  }
  function wireDupFix(){
    try{
      syncCloseBtn();
      if(window.MutationObserver){
        var nv = document.getElementById('newView');
        var sheet = document.getElementById('sheet');
        var mo = new MutationObserver(function(){ syncCloseBtn(); });
        if(nv) mo.observe(nv, { attributes:true, attributeFilter:['style'] });
        if(sheet) mo.observe(sheet, { attributes:true, attributeFilter:['class'] });
      }
    }catch(e){}
  }

  /* ---------- Navegacion inyectada en el home ---------- */
  function injectNav(){
    try{
      var home = document.getElementById('home');
      if(!home) return;
      if(home.querySelector('.pa32-nav')) return; // idempotente
      var nav = document.createElement('div');
      nav.className = 'pa32-nav';

      var bMap = document.createElement('button');
      bMap.type = 'button';
      bMap.className = 'pa32-navbtn map';
      bMap.setAttribute('aria-label', T.navMap);
      bMap.innerHTML = MAP_IC + '<span>' + T.navMap + '</span>';
      bMap.addEventListener('click', function(){ abrirMapa(); });

      var bBag = document.createElement('button');
      bBag.type = 'button';
      bBag.className = 'pa32-navbtn bag';
      bBag.setAttribute('aria-label', T.navBag);
      bBag.innerHTML = BAG_IC + '<span>' + T.navBag + '</span>';
      bBag.addEventListener('click', function(){ abrirMochila(); });

      nav.appendChild(bMap);
      nav.appendChild(bBag);

      var adult = document.getElementById('adultBtn');
      if(adult && adult.parentNode === home){ home.insertBefore(nav, adult); }
      else { home.appendChild(nav); }
    }catch(e){}
  }

  /* ---------- Enganche opcional a un disparador "IR AL MAPA" existente ---------- */
  function wireExistingMapTrigger(){
    try{
      var nodes = document.querySelectorAll('button, a, [role="button"]');
      for(var i=0;i<nodes.length;i++){
        var el = nodes[i];
        if(el.className && String(el.className).indexOf('pa32-') === 0) continue;
        var txt = (el.textContent || '').toUpperCase();
        if(txt.indexOf('IR AL MAPA') !== -1 && !el.__pa32Wired){
          el.__pa32Wired = true;
          el.addEventListener('click', function(){ abrirMapa(); });
        }
      }
    }catch(e){}
  }

  /* ---------- API publica ---------- */
  window.PEQ32 = {
    abrirMapa: abrirMapa,
    abrirMochila: abrirMochila,
    abrirPausa: abrirPausa,
    abrirGate: abrirGate
  };

  function init(){
    try{ bumpRacha(); }catch(e){}
    injectNav();
    wireExistingMapTrigger();
    wireDupFix();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} });
  } else {
    try{ init(); }catch(e){}
  }
})();
