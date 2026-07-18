/* ===== Fase 4 #34 · Juegos por secciones, niveles y arrastrar =====
   100% ADITIVO. No toca app.js/STORE_KEY. Progreso propio en clave separada.
   - Intercepta el tap en las tarjetas .subject y abre una grilla de juegos.
   - Juego "ya existe" -> llama startGame() de la app.
   - Juego de arrastrar -> mapa de 5 niveles -> motor de arrastrar.
*/
(function(){
  "use strict";
  var PKEY = "pequenautas.f4.juegos.v1";
  function loadP(){ try{ return JSON.parse(localStorage.getItem(PKEY)||"{}")||{}; }catch(e){ return {}; } }
  function saveP(o){ try{ localStorage.setItem(PKEY, JSON.stringify(o)); }catch(e){} }
  function unlocked(gid){ var p=loadP(); return (typeof p[gid]==="number")?p[gid]:0; } // highest unlocked level index (0..4)
  function setUnlocked(gid,v){ var p=loadP(); if(!(p[gid]>=v)){ p[gid]=v; saveP(p); } }

  function ch(sp){ return String.fromCharCode(sp); }
  var ACC = ch(0xE1); // a acute
  var IACC = ch(0xED); // i acute
  var OACC = ch(0xF3); // o acute
  var UACC = ch(0xFA);
  var NTIL = ch(0xF1);
  var INV = ch(0xA1); // inverted !
  var INVQ = ch(0xBF); // inverted ?

  // ---- registry ----
  // mech: tap|drag|sort|match|trace ; impl: 'app' (existing) | 'drag' | 'soon'
  var SECTIONS = {
    math: { name:"N"+UACC+"meros", games:[
      {id:"math:count", name:"Contar y arrastrar", mech:"drag", impl:"drag", desc:"Lleva las bellotas a la canasta"},
      {id:"math:tap", name:"Cu"+ACC+"ntos ves", mech:"tap", impl:"app", app:"math", desc:"Cuenta y toca el n"+UACC+"mero"},
      {id:"math:sort", name:"Ordena los n"+UACC+"meros", mech:"sort", impl:"sort", gen:"ordernum", desc:"Toca del m"+ACC+"s chico al m"+ACC+"s grande"},
      {id:"math:match", name:"Une cantidad y n"+UACC+"mero", mech:"match", impl:"match", gen:"countnum", desc:"Une la cantidad con su n"+UACC+"mero"}
    ]},
    reading: { name:"Letras", games:[
      {id:"read:tap", name:"Con qu"+ch(0xE9)+" letra empieza", mech:"tap", impl:"app", app:"reading", desc:"Toca la letra inicial"},
      {id:"read:drag", name:"Letra a su sombra", mech:"drag", impl:"classify", gen:"shadow", desc:"Toca la letra y luego su sombra"},
      {id:"read:match", name:"May"+UACC+"scula y min"+UACC+"scula", mech:"match", impl:"match", gen:"caseAa", desc:"Une la letra grande con la peque"+NTIL+"a"},
      {id:"read:trace", name:"Traza la letra", mech:"trace", impl:"trace", gen:"trace", desc:"Une los puntos y traza la letra"}
    ]},
    science: { name:"Animales", games:[
      {id:"sci:tap", name:"D"+OACC+"nde vive", mech:"tap", impl:"app", app:"science", desc:"Toca el h"+ACC+"bitat"},
      {id:"sci:drag", name:"Cada uno a su casa", mech:"drag", impl:"classify", gen:"habitat", desc:"Toca el animal y luego su casa"},
      {id:"sci:sort", name:"Grandes y chicos", mech:"sort", impl:"sort", gen:"ordersize", desc:"Toca del m"+ACC+"s chico al m"+ACC+"s grande"},
      {id:"sci:match", name:"Mam"+ACC+" y beb"+ch(0xE9), mech:"match", impl:"match", gen:"babies", desc:"Une cada mam"+ACC+" con su beb"+ch(0xE9)}
    ]}
  };
  var MECH_ICON = {tap:ch(0x1F446)?"":"", }; // fallback set below
  // use simple text glyphs to stay ASCII-safe in source; build via codepoints
  function mechEmoji(m){
    if(m==="tap") return String.fromCodePoint(0x1F446);
    if(m==="drag") return String.fromCodePoint(0x270B);
    if(m==="sort") return String.fromCodePoint(0x2195,0xFE0F);
    if(m==="match") return String.fromCodePoint(0x1F517);
    if(m==="trace") return String.fromCodePoint(0x270F,0xFE0F);
    return "";
  }
  // drag-count 5 levels: [need, poolExtra]
  var DRAG_LEVELS = [ [3,2],[5,2],[4,4],[6,3],[8,4] ];

  var $=function(id){return document.getElementById(id);};
  function el(tag,cls,html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }

  // ---------- overlays root ----------
  var ov=null, sheet=null, hdT=null, body=null, backBtn=null, curSection=null;
  function ensureOv(){
    if(ov) return;
    ov=el("div","pa34-ov"); ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true");
    sheet=el("div","pa34-sheet");
    var hd=el("div","pa34-hd");
    backBtn=el("button","pa34-back",INVQ===""?"&lsaquo;":"&lsaquo;"); backBtn.setAttribute("aria-label","Volver"); backBtn.style.display="none";
    hdT=el("div","t","");
    var x=el("button","pa34-x","&times;"); x.setAttribute("aria-label","Cerrar");
    hd.appendChild(backBtn); hd.appendChild(hdT); hd.appendChild(x);
    body=el("div","pa34-body");
    sheet.appendChild(hd); sheet.appendChild(body); ov.appendChild(sheet);
    document.body.appendChild(ov);
    x.addEventListener("click",closeOv);
    ov.addEventListener("click",function(e){ if(e.target===ov) closeOv(); });
    document.addEventListener("keydown",function(e){ if(e.key==="Escape" && ov.classList.contains("show")) closeOv(); });
  }
  function closeOv(){ if(ov) ov.classList.remove("show"); }
  function openOv(){ ensureOv(); ov.classList.add("show"); }

  // ---------- games grid ----------
  function openGames(sectionKey){
    var sec=SECTIONS[sectionKey]; if(!sec) return;
    curSection=sectionKey;
    openOv(); backBtn.style.display="none";
    hdT.innerHTML = sec.name + "<small>Elige un juego</small>";
    body.innerHTML="";
    var grid=el("div","pa34-games");
    sec.games.forEach(function(g){
      var b=el("button","pa34-game"+(g.impl==="soon"?" pa34-soon":""));
      b.setAttribute("data-pa34-game", g.id);
      if(g.impl==="app" && g.app){ b.setAttribute("data-pa34-app", g.app); }
      var mech=el("div","pa34-m-"+g.mech+" mech", mechEmoji(g.mech));
      var nm=el("div","gn",g.name);
      var pr;
      if(g.impl==="drag"||g.impl==="match"||g.impl==="sort"||g.impl==="trace"||g.impl==="classify"){ var u=unlocked(g.id); pr=el("div","gp","Nivel "+(u+1)+" de 5"); }
      else if(g.impl==="app"){ pr=el("div","gp","Con voz de Rufo"); }
      else { pr=el("div","gp","Pronto"); }
      b.appendChild(mech); b.appendChild(nm); b.appendChild(pr);
      if(g.impl==="soon"){ b.appendChild(el("div","lock",String.fromCodePoint(0x1F512))); }
      b.addEventListener("click",function(){ pickGame(g); });
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  function pickGame(g){
    if(g.impl==="app"){
      closeOv();
      if(typeof window.startGame==="function"){ try{ window.startGame(g.app); }catch(e){} }
      return;
    }
    if(g.impl==="drag"||g.impl==="match"||g.impl==="sort"||g.impl==="trace"||g.impl==="classify"){ openLevels(g); return; }
    // soon
    toast(INV+"Pronto"+"! Este juego llega muy prontito "+String.fromCodePoint(0x1F98A));
  }

  function toast(msg){
    var t=el("div",null,msg);
    t.style.cssText="position:fixed;left:50%;bottom:120px;transform:translateX(-50%);background:#2E3B2C;color:#fff;padding:11px 18px;border-radius:16px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600;font-size:14px;z-index:1600;box-shadow:0 6px 18px rgba(0,0,0,.3);max-width:80%;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function(){ t.style.transition="opacity .4s"; t.style.opacity="0"; setTimeout(function(){t.remove();},420); },1500);
  }

  // ---------- level map ----------
  function openLevels(g){
    openOv(); backBtn.style.display="";
    backBtn.onclick=function(){ openGames(curSection); };
    hdT.innerHTML = g.name + "<small>Elige un nivel</small>";
    body.innerHTML="";
    var u=unlocked(g.id);
    var wrap=el("div","pa34-levels");
    for(var i=0;i<5;i++){(function(i){
      if(i>0){ wrap.appendChild(el("div","pa34-link")); }
      var row=el("div","pa34-lvlwrap");
      var state = i<u? "done" : (i===u? "cur":"lock");
      var b=el("button","pa34-lvl "+state, String(i+1));
      if(state!=="lock" || i===u){
        b.addEventListener("click",function(){ launchLevel(g,i); });
      } else {
        b.innerHTML=String.fromCodePoint(0x1F512); b.disabled=true;
      }
      if(state==="done"){ b.appendChild(el("span","st",String.fromCodePoint(0x2B50))); }
      var caps=["Muy f"+ACC+"cil","F"+ACC+"cil","Normal","Un reto","Experto"];
      var cap=el("div","cap",caps[i]);
      // alternate side for a path feel
      if(i%2===0){ row.appendChild(b); row.appendChild(cap); }
      else { row.appendChild(cap); row.appendChild(b); }
      wrap.appendChild(row);
    })(i);}
    body.appendChild(wrap);
  }

  // ---------- DRAG GAME ENGINE ----------
  var play=null, pEls={};
  function acornSVG(){
    return '<svg viewBox="0 0 100 100"><ellipse cx="50" cy="62" rx="30" ry="34" fill="#C98A4A"/><ellipse cx="50" cy="60" rx="30" ry="32" fill="#D89A57"/><path d="M20 40 Q50 20 80 40 Q78 52 50 52 Q22 52 20 40 Z" fill="#7A4B23"/><path d="M20 40 Q50 30 80 40" fill="none" stroke="#5E3A1B" stroke-width="3"/><rect x="46" y="16" width="8" height="12" rx="3" fill="#5E3A1B"/><ellipse cx="42" cy="60" rx="6" ry="9" fill="#E8B57C" opacity=".55"/></svg>';
  }
  function basketSVG(){
    return '<svg viewBox="0 0 200 160" style="width:100%;height:100%"><ellipse cx="100" cy="50" rx="82" ry="25" fill="#C98A4A"/><path d="M22 52 L38 150 Q100 168 162 150 L178 52 Q100 82 22 52 Z" fill="#A8703A"/><g stroke="#8B5E2F" stroke-width="4" opacity=".5"><path d="M40 66 L54 148"/><path d="M70 74 L78 156"/><path d="M100 78 L100 160"/><path d="M130 74 L122 156"/><path d="M160 66 L146 148"/><path d="M28 92 Q100 108 172 92"/><path d="M32 120 Q100 138 168 120"/></g></svg>';
  }
  function rufoSVG(happy){
    var eyes = happy ? '<path d="M34 50 Q42 42 50 50" fill="none" stroke="#2E3B2C" stroke-width="4" stroke-linecap="round"/><path d="M50 50 Q58 42 66 50" fill="none" stroke="#2E3B2C" stroke-width="4" stroke-linecap="round"/><path d="M40 64 Q50 76 60 64" fill="none" stroke="#2E3B2C" stroke-width="4.5" stroke-linecap="round"/>'
      : '<circle cx="42" cy="52" r="8" fill="#fff"/><circle cx="58" cy="52" r="8" fill="#fff"/><circle cx="43" cy="53" r="3.4" fill="#2E3B2C"/><circle cx="57" cy="53" r="3.4" fill="#2E3B2C"/><polygon points="50,60 46,66 54,66" fill="#2E3B2C"/>';
    return '<svg viewBox="0 0 100 100"><circle cx="50" cy="52" r="46" fill="#FBE3CC"/><path d="M30 74 Q22 45 40 33 L34 18 L48 30 Q50 27 52 30 L66 18 L60 33 Q78 45 70 74 Z" fill="#E8843A"/>'+eyes+'</svg>';
  }
  function ensurePlay(){
    if(play) return;
    play=el("div","pa34-play");
    play.innerHTML=
      '<div class="pa34-ptop"><button class="pa34-x" id="pa34pX" aria-label="Salir">&times;</button>'+
        '<div class="pa34-prompt" id="pa34prompt"></div>'+
        '<div class="pa34-pstar">'+String.fromCodePoint(0x2B50)+' <span id="pa34score">0</span></div></div>'+
      '<div class="pa34-field" id="pa34field">'+
        '<div class="pa34-basket" id="pa34basket"><div class="count" id="pa34count">0 / 0</div>'+basketSVG()+'</div>'+
        '<div class="pa34-hint" id="pa34hint">Tocá una bellota y llevala a la canasta</div>'+
        '<div class="pa34-rufo" id="pa34rufo">'+rufoSVG(false)+'</div>'+
      '</div>'+
      '<div class="pa34-pbot"><div class="pa34-prog" id="pa34prog"></div>'+
        '<button class="pa34-cta" id="pa34cta" disabled>Sigue arrastrando...</button></div>'+
      '<div class="pa34-win" id="pa34win"><div class="pa34-wc">'+
        '<div class="rf">'+rufoSVG(true)+'</div><h2 id="pa34wt">'+INV+'Muy bien!</h2><p id="pa34wp"></p>'+
        '<div class="row"><button class="pa34-cta ghost" id="pa34wmap">Mapa</button><button class="pa34-cta" id="pa34wnext">Siguiente</button></div>'+
      '</div></div>';
    document.body.appendChild(play);
    pEls={ field:$("pa34field"), basket:$("pa34basket"), count:$("pa34count"),
      prompt:$("pa34prompt"), cta:$("pa34cta"), prog:$("pa34prog"), rufo:$("pa34rufo"),
      hint:$("pa34hint"), win:$("pa34win"), score:$("pa34score"), wt:$("pa34wt"), wp:$("pa34wp"),
      wnext:$("pa34wnext"), wmap:$("pa34wmap") };
    $("pa34pX").addEventListener("click",exitPlay);
    pEls.cta.addEventListener("click",function(){ if(!pEls.cta.disabled) advanceOrExit(); });
  }
  var G={ acorns:[], need:0, placed:0, gid:null, level:0, score:0 };
  function exitPlay(){ play.classList.remove("show"); }
  function pointXY(e){ if(e.touches&&e.touches[0])return{x:e.touches[0].clientX,y:e.touches[0].clientY}; if(e.changedTouches&&e.changedTouches[0])return{x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY}; return{x:e.clientX,y:e.clientY}; }
  function overBasket(x,y){ var r=pEls.basket.getBoundingClientRect(); return x>r.left-18&&x<r.right+18&&y>r.top-10&&y<r.bottom; }

  function launchDrag(g,level){
    ensurePlay();
    closeOv();
    G.gid=g.id; G.level=level; G.name=g.name;
    var cfg=DRAG_LEVELS[level]||DRAG_LEVELS[0];
    G.need=cfg[0]; var pool=cfg[0]+cfg[1]; G.placed=0;
    play.classList.add("show"); pEls.win.classList.remove("show");
    pEls.rufo.innerHTML=rufoSVG(false);
    pEls.prompt.innerHTML="Arrastra <b>"+G.need+"</b> bellotas "+String.fromCodePoint(0x1F330)+" a la canasta";
    pEls.count.textContent="0 / "+G.need;
    pEls.cta.textContent="Sigue arrastrando..."; pEls.cta.disabled=true;
    pEls.hint.style.display="";
    // progress leaves
    pEls.prog.innerHTML=""; for(var i=0;i<G.need;i++){ var lf=el("div","pa34-leaf"); lf.id="pa34lf"+i; pEls.prog.appendChild(lf); }
    // clear acorns
    G.acorns.forEach(function(a){ a.remove(); }); G.acorns=[];
    var spots=[[18,60],[74,70],[10,150],[80,175],[44,110],[60,230],[26,220],[70,130],[40,40],[86,110],[14,110],[56,60]];
    for(var k=0;k<pool && k<spots.length;k++){
      var a=el("div","pa34-acorn",acornSVG());
      a.style.left="calc("+spots[k][0]+"% - 29px)"; a.style.top=spots[k][1]+"px";
      pEls.field.appendChild(a); makeDraggable(a); G.acorns.push(a);
    }
  }
  function makeDraggable(elm){
    var dragging=false,offx=0,offy=0;
    function start(e){ if(elm.classList.contains("placed"))return; dragging=true; elm.classList.add("grab");
      var p=pointXY(e),r=elm.getBoundingClientRect(); offx=p.x-r.left; offy=p.y-r.top; pEls.hint.style.display="none"; e.preventDefault(); }
    function move(e){ if(!dragging)return; var p=pointXY(e),fr=pEls.field.getBoundingClientRect();
      elm.style.left=(p.x-fr.left-offx)+"px"; elm.style.top=(p.y-fr.top-offy)+"px";
      pEls.basket.classList.toggle("hot",overBasket(p.x,p.y)); e.preventDefault(); }
    function end(e){ if(!dragging)return; dragging=false; elm.classList.remove("grab");
      var p=pointXY(e); pEls.basket.classList.remove("hot"); if(overBasket(p.x,p.y)) drop(elm); }
    elm.addEventListener("mousedown",start); elm.addEventListener("touchstart",start,{passive:false});
    window.addEventListener("mousemove",move); window.addEventListener("touchmove",move,{passive:false});
    window.addEventListener("mouseup",end); window.addEventListener("touchend",end);
  }
  function drop(elm){
    elm.classList.add("placed");
    var br=pEls.basket.getBoundingClientRect(), fr=pEls.field.getBoundingClientRect();
    var col=G.placed%3, row=Math.floor(G.placed/3);
    elm.style.left=(br.left-fr.left+42+col*38)+"px"; elm.style.top=(br.top-fr.top+48+row*22)+"px"; elm.style.transform="scale(.66)";
    G.placed++;
    pEls.count.textContent=G.placed+" / "+G.need;
    var lf=$("pa34lf"+(G.placed-1)); if(lf) lf.classList.add("on");
    pEls.rufo.classList.add("cheer"); setTimeout(function(){ pEls.rufo.classList.remove("cheer"); },260);
    if(G.placed>=G.need) winLevel();
  }
  function winLevel(){
    pEls.cta.textContent=INV+"Listo!"; pEls.cta.disabled=false;
    G.score++; pEls.score.textContent=G.score;
    // unlock next level & add a star in the app if possible
    setUnlocked(G.gid, Math.min(G.level+1,4));
    try{ if(typeof window.addStar==="function") window.addStar(); }catch(e){}
    pEls.wp.textContent="Contaste y llevaste "+G.need+" bellotas "+String.fromCodePoint(0x1F330);
    var last = G.level>=4;
    pEls.wnext.textContent = last ? INV+"Terminado!" : "Siguiente";
    setTimeout(function(){ burst(); pEls.win.classList.add("show"); },340);
  }
  function advanceOrExit(){
    // CTA in-game (when level solved) -> show win already handled; this fires only if enabled
    pEls.win.classList.add("show");
  }
  pEls_bind();
  function pEls_bind(){} // placeholder (bindings set in ensurePlay)

  function wireWinButtons(){
    if(!pEls.wnext) return;
    pEls.wnext.onclick=function(){
      pEls.win.classList.remove("show");
      if(G.level>=4){ // finished all -> go to level map
        var g=findGame(G.gid); if(g) openLevels(g);
      } else {
        var g=findGame(G.gid); if(g) launchDrag(g, G.level+1);
      }
    };
    pEls.wmap.onclick=function(){ pEls.win.classList.remove("show"); play.classList.remove("show"); var g=findGame(G.gid); if(g) openLevels(g); };
  }
  function findGame(gid){ for(var s in SECTIONS){ var arr=SECTIONS[s].games; for(var i=0;i<arr.length;i++){ if(arr[i].id===gid){ curSection=s; return arr[i]; } } } return null; }

  function burst(){
    if(!play) return;
    var colors=["#E8843A","#57C596","#4EA8DE","#F2748C","#FDBA4D"];
    for(var i=0;i<24;i++){(function(i){
      var c=el("div"); c.style.cssText="position:absolute;width:10px;height:14px;border-radius:2px;top:-20px;z-index:19;background:"+colors[i%5]+";left:"+(20+Math.random()*60)+"%;";
      play.appendChild(c);
      var dx=(Math.random()*2-1)*120, dur=900+Math.random()*700;
      try{ c.animate([{transform:"translate(0,0) rotate(0)",opacity:1},{transform:"translate("+dx+"px,540px) rotate("+(Math.random()*720)+"deg)",opacity:.9}],{duration:dur,easing:"cubic-bezier(.3,.7,.5,1)"}); }catch(e){}
      setTimeout(function(){ c.remove(); },dur);
    })(i);}
  }

  // ---------- level launch dispatch ----------
  function launchLevel(g,level){
    if(g.impl==="match"){ launchMatch(g,level); }
    else if(g.impl==="sort"){ launchSort(g,level); }
    else if(g.impl==="trace"){ launchTrace(g,level); }
    else if(g.impl==="classify"){ launchClassify(g,level); }
    else { launchDrag(g,level); }
  }

  // ================= MATCH GAME ENGINE =================
  var MATCH_PAIRS = [3,3,4,4,5];              // pares por nivel
  var LETTERS_POOL = ["A","B","C","D","E","F","L","M","O","P","S","T","U","N"];
  function cp(n){ return String.fromCodePoint(n); }
  // parejas mamá/bebé por punto de código (fuente ASCII-safe, ver nota arriba)
  var BABY_PAIRS = [ [cp(0x1F404),cp(0x1F42E)], [cp(0x1F415),cp(0x1F436)],
    [cp(0x1F408),cp(0x1F431)], [cp(0x1F416),cp(0x1F437)],
    [cp(0x1F414),cp(0x1F423)], [cp(0x1F40E),cp(0x1F434)] ];
  function shuffle(arr){ var a=arr.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }
  function dotsHTML(n){ var s='<div class="pa34-dots">'; for(var i=0;i<n;i++){ s+='<span></span>'; } return s+'</div>'; }
  function tokenHTML(tk){
    if(tk.k==="dots") return dotsHTML(tk.v);
    if(tk.k==="emoji") return '<span class="pa34-emoji">'+tk.v+'</span>';
    return '<span class="pa34-big">'+tk.v+'</span>';
  }
  // build [{a,b}] pairs for a game+level
  function buildPairs(g,level){
    var n=MATCH_PAIRS[level]||3, out=[];
    if(g.gen==="countnum"){
      var maxN=[3,4,5,6,9][level]||n;
      var nums=shuffle(function(){var r=[];for(var i=1;i<=maxN;i++)r.push(i);return r;}()).slice(0,n);
      nums.forEach(function(v){ out.push({a:{k:"dots",v:v}, b:{k:"text",v:String(v)}}); });
    } else if(g.gen==="caseAa"){
      var ls=shuffle(LETTERS_POOL).slice(0,n);
      ls.forEach(function(v){ out.push({a:{k:"text",v:v}, b:{k:"text",v:v.toLowerCase()}}); });
    } else { // babies
      var ps=shuffle(BABY_PAIRS).slice(0,n);
      ps.forEach(function(p){ out.push({a:{k:"emoji",v:p[0]}, b:{k:"emoji",v:p[1]}}); });
    }
    return out;
  }

  var mplay=null, mEls={}, M={ gid:null, level:0, name:"", total:0, matched:0, selLeft:null, g:null };
  function ensureMPlay(){
    if(mplay) return;
    mplay=el("div","pa34-mplay");
    mplay.innerHTML=
      '<div class="pa34-ptop"><button class="pa34-x" id="pa34mX" aria-label="Salir">&times;</button>'+
        '<div class="pa34-prompt" id="pa34mprompt"></div>'+
        '<div class="pa34-pstar">'+String.fromCodePoint(0x2B50)+' <span id="pa34mscore">0</span></div></div>'+
      '<div class="pa34-mcols"><div class="pa34-col" id="pa34mL"></div><div class="pa34-col" id="pa34mR"></div></div>'+
      '<div class="pa34-win" id="pa34mwin"><div class="pa34-wc">'+
        '<div class="rf">'+rufoSVG(true)+'</div><h2 id="pa34mwt">'+INV+'Muy bien!</h2><p id="pa34mwp"></p>'+
        '<div class="row"><button class="pa34-cta ghost" id="pa34mwmap">Mapa</button><button class="pa34-cta" id="pa34mwnext">Siguiente</button></div>'+
      '</div></div>';
    document.body.appendChild(mplay);
    mEls={ L:$("pa34mL"), R:$("pa34mR"), prompt:$("pa34mprompt"), score:$("pa34mscore"),
      win:$("pa34mwin"), wt:$("pa34mwt"), wp:$("pa34mwp"), wnext:$("pa34mwnext"), wmap:$("pa34mwmap") };
    $("pa34mX").addEventListener("click",function(){ mplay.classList.remove("show"); });
    mEls.wnext.onclick=function(){
      mEls.win.classList.remove("show");
      if(M.level>=4){ mplay.classList.remove("show"); if(M.g) openLevels(M.g); }
      else { launchMatch(M.g, M.level+1); }
    };
    mEls.wmap.onclick=function(){ mEls.win.classList.remove("show"); mplay.classList.remove("show"); if(M.g) openLevels(M.g); };
  }
  function launchMatch(g,level){
    ensureMPlay();
    closeOv();
    M.gid=g.id; M.level=level; M.name=g.name; M.g=g; M.selLeft=null; M.matched=0;
    var pairs=buildPairs(g,level); M.total=pairs.length;
    mplay.classList.add("show"); mEls.win.classList.remove("show");
    mEls.prompt.innerHTML=g.desc || "Une las parejas";
    mEls.L.innerHTML=""; mEls.R.innerHTML="";
    // left in order, right shuffled; tag each with the same pairId
    var rights=shuffle(pairs.map(function(p,idx){ return {tok:p.b, id:idx}; }));
    pairs.forEach(function(p,idx){
      var lb=el("button","pa34-mcard", tokenHTML(p.a)); lb.setAttribute("data-pid",idx); lb.setAttribute("data-side","L");
      lb.addEventListener("click",function(){ onLeft(lb); }); mEls.L.appendChild(lb);
    });
    rights.forEach(function(r){
      var rb=el("button","pa34-mcard", tokenHTML(r.tok)); rb.setAttribute("data-pid",r.id); rb.setAttribute("data-side","R");
      rb.addEventListener("click",function(){ onRight(rb); }); mEls.R.appendChild(rb);
    });
  }
  function onLeft(btn){
    if(btn.classList.contains("done")) return;
    if(M.selLeft){ M.selLeft.classList.remove("sel"); }
    if(M.selLeft===btn){ M.selLeft=null; return; }
    M.selLeft=btn; btn.classList.add("sel");
  }
  function onRight(btn){
    if(btn.classList.contains("done")) return;
    if(!M.selLeft){ btn.classList.add("bad"); setTimeout(function(){ btn.classList.remove("bad"); },300); return; }
    var lp=M.selLeft.getAttribute("data-pid"), rp=btn.getAttribute("data-pid");
    if(lp===rp){
      M.selLeft.classList.remove("sel"); M.selLeft.classList.add("done");
      btn.classList.add("done"); M.selLeft=null; M.matched++;
      try{ if(typeof window.playSfx==="function") window.playSfx("ok"); }catch(e){}
      if(M.matched>=M.total) matchWin();
    } else {
      var a=M.selLeft; a.classList.add("bad"); btn.classList.add("bad");
      a.classList.remove("sel"); M.selLeft=null;
      setTimeout(function(){ a.classList.remove("bad"); btn.classList.remove("bad"); },320);
    }
  }
  function matchWin(){
    setUnlocked(M.gid, Math.min(M.level+1,4));
    M.score=(M.score||0)+1; mEls.score.textContent=M.score;
    try{ if(typeof window.addStar==="function") window.addStar(); }catch(e){}
    mEls.wp.textContent="Uniste "+M.total+" parejas "+String.fromCodePoint(0x1F31F);
    mEls.wnext.textContent = M.level>=4 ? INV+"Terminado!" : "Siguiente";
    setTimeout(function(){ if(typeof burstIn==="function") burstIn(mplay); mEls.win.classList.add("show"); },300);
  }
  function burstIn(host){
    if(!host) return;
    var colors=["#E8843A","#57C596","#4EA8DE","#F2748C","#FDBA4D"];
    for(var i=0;i<20;i++){(function(i){
      var c=el("div"); c.style.cssText="position:absolute;width:10px;height:14px;border-radius:2px;top:-20px;z-index:19;background:"+colors[i%5]+";left:"+(20+Math.random()*60)+"%;";
      host.appendChild(c);
      var dx=(Math.random()*2-1)*120, dur=900+Math.random()*700;
      try{ c.animate([{transform:"translate(0,0) rotate(0)",opacity:1},{transform:"translate("+dx+"px,540px) rotate("+(Math.random()*720)+"deg)",opacity:.9}],{duration:dur,easing:"cubic-bezier(.3,.7,.5,1)"}); }catch(e){}
      setTimeout(function(){ c.remove(); },dur);
    })(i);}
  }

  // ================= SORT GAME ENGINE =================
  var SORT_LEVELS = [3,3,4,4,5];
  // ranking chico -> grande (puntos de código)
  var ANIMAL_SIZES = [0x1F41C,0x1F401,0x1F407,0x1F408,0x1F415,0x1F416,0x1F40E,0x1F404,0x1F418];
  function buildSort(g,level){
    var n=SORT_LEVELS[level]||3, out=[];
    if(g.gen==="ordersize"){
      var idx=shuffle(ANIMAL_SIZES.map(function(_,i){return i;})).slice(0,n).sort(function(a,b){return a-b;});
      idx.forEach(function(ai,rank){ out.push({tok:{k:"emoji",v:cp(ANIMAL_SIZES[ai])}, rank:rank}); });
    } else {
      var maxN=[5,6,7,8,9][level]||n;
      var nums=shuffle(function(){var r=[];for(var i=1;i<=maxN;i++)r.push(i);return r;}()).slice(0,n).sort(function(a,b){return a-b;});
      nums.forEach(function(v,rank){ out.push({tok:{k:"text",v:String(v)}, rank:rank}); });
    }
    return out;
  }
  var splay=null, sEls={}, ST={ gid:null, level:0, g:null, expected:0, total:0, score:0 };
  function ensureSPlay(){
    if(splay) return;
    splay=el("div","pa34-splay");
    splay.innerHTML=
      '<div class="pa34-ptop"><button class="pa34-x" id="pa34sX" aria-label="Salir">&times;</button>'+
        '<div class="pa34-prompt" id="pa34sprompt"></div>'+
        '<div class="pa34-pstar">'+String.fromCodePoint(0x2B50)+' <span id="pa34sscore">0</span></div></div>'+
      '<div class="pa34-sarea" id="pa34sarea"></div>'+
      '<div class="pa34-win" id="pa34swin"><div class="pa34-wc">'+
        '<div class="rf">'+rufoSVG(true)+'</div><h2>'+INV+'Muy bien!</h2><p id="pa34swp"></p>'+
        '<div class="row"><button class="pa34-cta ghost" id="pa34swmap">Mapa</button><button class="pa34-cta" id="pa34swnext">Siguiente</button></div>'+
      '</div></div>';
    document.body.appendChild(splay);
    sEls={ area:$("pa34sarea"), prompt:$("pa34sprompt"), score:$("pa34sscore"),
      win:$("pa34swin"), wp:$("pa34swp"), wnext:$("pa34swnext"), wmap:$("pa34swmap") };
    $("pa34sX").addEventListener("click",function(){ splay.classList.remove("show"); });
    sEls.wnext.onclick=function(){
      sEls.win.classList.remove("show");
      if(ST.level>=4){ splay.classList.remove("show"); if(ST.g) openLevels(ST.g); }
      else { launchSort(ST.g, ST.level+1); }
    };
    sEls.wmap.onclick=function(){ sEls.win.classList.remove("show"); splay.classList.remove("show"); if(ST.g) openLevels(ST.g); };
  }
  function launchSort(g,level){
    ensureSPlay(); closeOv();
    ST.gid=g.id; ST.level=level; ST.g=g; ST.expected=0;
    var items=buildSort(g,level); ST.total=items.length;
    splay.classList.add("show"); sEls.win.classList.remove("show");
    sEls.prompt.innerHTML=g.desc || "Ordena";
    sEls.area.innerHTML="";
    shuffle(items).forEach(function(it){
      var b=el("button","pa34-scard", tokenHTML(it.tok));
      b.setAttribute("data-rank", it.rank);
      b.addEventListener("click",function(){ onSortTile(b); });
      sEls.area.appendChild(b);
    });
  }
  function onSortTile(btn){
    if(btn.classList.contains("done")) return;
    var r=parseInt(btn.getAttribute("data-rank"),10);
    if(r===ST.expected){
      btn.classList.add("done");
      btn.appendChild(el("div","ord", String(ST.expected+1)));
      ST.expected++;
      try{ if(typeof window.playSfx==="function") window.playSfx("ok"); }catch(e){}
      if(ST.expected>=ST.total) sortWin();
    } else {
      btn.classList.add("bad"); setTimeout(function(){ btn.classList.remove("bad"); },320);
    }
  }
  function sortWin(){
    setUnlocked(ST.gid, Math.min(ST.level+1,4));
    ST.score=(ST.score||0)+1; sEls.score.textContent=ST.score;
    try{ if(typeof window.addStar==="function") window.addStar(); }catch(e){}
    sEls.wp.textContent="Ordenaste "+ST.total+" del m"+ACC+"s chico al m"+ACC+"s grande "+String.fromCodePoint(0x1F31F);
    sEls.wnext.textContent = ST.level>=4 ? INV+"Terminado!" : "Siguiente";
    setTimeout(function(){ burstIn(splay); sEls.win.classList.add("show"); },300);
  }

  // ================= TRACE GAME ENGINE =================
  var TRACE_LETTERS = [
    { ch:"L", pts:[[32,22],[32,78],[70,78]] },
    { ch:"V", pts:[[28,22],[50,78],[72,22]] },
    { ch:"N", pts:[[30,78],[30,22],[70,78],[70,22]] },
    { ch:"Z", pts:[[30,24],[70,24],[30,76],[70,76]] },
    { ch:"M", pts:[[26,78],[26,22],[50,52],[74,22],[74,78]] }
  ];
  var tplay=null, tEls={}, TR={ gid:null, level:0, g:null, pts:[], reached:0, score:0 };
  function ensureTPlay(){
    if(tplay) return;
    tplay=el("div","pa34-tplay");
    tplay.innerHTML=
      '<div class="pa34-ptop"><button class="pa34-x" id="pa34tX" aria-label="Salir">&times;</button>'+
        '<div class="pa34-prompt" id="pa34tprompt"></div>'+
        '<div class="pa34-pstar">'+String.fromCodePoint(0x2B50)+' <span id="pa34tscore">0</span></div></div>'+
      '<div class="pa34-tarea"><svg class="pa34-tsvg" id="pa34tsvg" viewBox="0 0 100 100"></svg></div>'+
      '<div class="pa34-win" id="pa34twin"><div class="pa34-wc">'+
        '<div class="rf">'+rufoSVG(true)+'</div><h2>'+INV+'Muy bien!</h2><p id="pa34twp"></p>'+
        '<div class="row"><button class="pa34-cta ghost" id="pa34twmap">Mapa</button><button class="pa34-cta" id="pa34twnext">Siguiente</button></div>'+
      '</div></div>';
    document.body.appendChild(tplay);
    tEls={ svg:$("pa34tsvg"), prompt:$("pa34tprompt"), score:$("pa34tscore"),
      win:$("pa34twin"), wp:$("pa34twp"), wnext:$("pa34twnext"), wmap:$("pa34twmap") };
    $("pa34tX").addEventListener("click",function(){ tplay.classList.remove("show"); });
    tEls.wnext.onclick=function(){
      tEls.win.classList.remove("show");
      if(TR.level>=4){ tplay.classList.remove("show"); if(TR.g) openLevels(TR.g); }
      else { launchTrace(TR.g, TR.level+1); }
    };
    tEls.wmap.onclick=function(){ tEls.win.classList.remove("show"); tplay.classList.remove("show"); if(TR.g) openLevels(TR.g); };
    // pointer tracking over the svg
    var svg=tEls.svg;
    function toVB(e){
      var p=pointXY(e), r=svg.getBoundingClientRect();
      return { x:(p.x-r.left)/r.width*100, y:(p.y-r.top)/r.height*100 };
    }
    function onMove(e){
      if(!tplay.classList.contains("show")) return;
      if(TR.reached>=TR.pts.length) return;
      var v=toVB(e), nx=TR.pts[TR.reached];
      var d=Math.sqrt((v.x-nx[0])*(v.x-nx[0])+(v.y-nx[1])*(v.y-nx[1]));
      if(d<15) reachPoint(TR.reached);
      e.preventDefault();
    }
    svg.addEventListener("mousemove",onMove);
    svg.addEventListener("touchmove",onMove,{passive:false});
    svg.addEventListener("touchstart",onMove,{passive:false});
  }
  function svgEl(name,attrs){
    var e=document.createElementNS("http://www.w3.org/2000/svg",name);
    for(var k in attrs){ e.setAttribute(k,attrs[k]); } return e;
  }
  function launchTrace(g,level){
    ensureTPlay(); closeOv();
    TR.gid=g.id; TR.level=level; TR.g=g;
    var L=TRACE_LETTERS[level]||TRACE_LETTERS[0];
    TR.pts=L.pts; TR.reached=0;
    tplay.classList.add("show"); tEls.win.classList.remove("show");
    tEls.prompt.innerHTML="Traza la <b>"+L.ch+"</b>";
    drawTrace();
  }
  function drawTrace(){
    var svg=tEls.svg; svg.innerHTML="";
    var pts=TR.pts;
    // guía punteada por todos los puntos
    var dpath="M"+pts.map(function(p){return p[0]+" "+p[1];}).join(" L");
    svg.appendChild(svgEl("path",{d:dpath,fill:"none",stroke:"#CFC6AE","stroke-width":"5","stroke-linecap":"round","stroke-linejoin":"round","stroke-dasharray":"1 7"}));
    // trazo cumplido
    if(TR.reached>0){
      var done="M"+pts.slice(0,TR.reached+1).map(function(p){return p[0]+" "+p[1];}).join(" L");
      svg.appendChild(svgEl("path",{d:done,fill:"none",stroke:"#57C596","stroke-width":"7","stroke-linecap":"round","stroke-linejoin":"round"}));
    }
    // puntos
    pts.forEach(function(p,i){
      var state = i<TR.reached ? "done" : (i===TR.reached ? "next":"todo");
      var c=svgEl("circle",{cx:p[0],cy:p[1],r:(state==="next"?7:5.5),
        fill: state==="done"?"#369468":(state==="next"?"#E8843A":"#FFFDF7"),
        stroke: state==="done"?"#2b7a52":(state==="next"?"#C6672A":"#CFC6AE"), "stroke-width":"2.5"});
      c.setAttribute("data-idx",i); c.style.cursor="pointer";
      c.addEventListener("click",function(){ if(i===TR.reached) reachPoint(i); });
      svg.appendChild(c);
      if(state==="next"){
        var lbl=svgEl("text",{x:p[0],y:p[1]+3.2,"text-anchor":"middle","font-size":"7","font-weight":"800",fill:"#fff"});
        lbl.textContent=String(i+1); svg.appendChild(lbl);
      }
    });
  }
  function reachPoint(i){
    if(i!==TR.reached) return;
    TR.reached++;
    drawTrace();
    try{ if(typeof window.playSfx==="function") window.playSfx("ok"); }catch(e){}
    if(TR.reached>=TR.pts.length) traceWin();
  }
  function traceWin(){
    setUnlocked(TR.gid, Math.min(TR.level+1,4));
    TR.score=(TR.score||0)+1; tEls.score.textContent=TR.score;
    try{ if(typeof window.addStar==="function") window.addStar(); }catch(e){}
    var L=TRACE_LETTERS[TR.level]||TRACE_LETTERS[0];
    tEls.wp.textContent="Trazaste la letra "+L.ch+" "+String.fromCodePoint(0x270F,0xFE0F);
    tEls.wnext.textContent = TR.level>=4 ? INV+"Terminado!" : "Siguiente";
    setTimeout(function(){ burstIn(tplay); tEls.win.classList.add("show"); },300);
  }

  // ================= CLASSIFY GAME ENGINE (tocar y colocar) =================
  var SHADOW_LETTERS = ["A","B","C","D","E","F","L","M","O","S","T","U"];
  var CLASS_LET_LEVELS = [2,3,4,4,5];
  var CLASS_HAB_LEVELS = [3,4,4,5,6];
  var HAB_BINS = [
    { key:"agua", label:"Agua", tok:cp(0x1F30A) },
    { key:"tierra", label:"Tierra", tok:cp(0x1F333) },
    { key:"cielo", label:"Cielo", tok:cp(0x2601,0xFE0F) }
  ];
  // animal -> índice de HAB_BINS (0 agua, 1 tierra, 2 cielo)
  var ANIMAL_HAB = [
    [0x1F41F,0],[0x1F422,0],[0x1F419,0],[0x1F433,0],[0x1F980,0],
    [0x1F415,1],[0x1F408,1],[0x1F407,1],[0x1F981,1],[0x1F418,1],
    [0x1F426,2],[0x1F98B,2],[0x1F41D,2],[0x1F989,2]
  ];
  function buildClassify(g,level){
    if(g.gen==="habitat"){
      var n=CLASS_HAB_LEVELS[level]||3;
      var pool=shuffle(ANIMAL_HAB).slice(0,n);
      return { bins:HAB_BINS.map(function(b){ return {kind:"hab", label:b.label, tok:{k:"emoji",v:b.tok}}; }),
        items:pool.map(function(p){ return {tok:{k:"emoji",v:cp(p[0])}, bin:p[1]}; }) };
    }
    // shadow (letras)
    var m=CLASS_LET_LEVELS[level]||2;
    var letters=shuffle(SHADOW_LETTERS).slice(0,m);
    var bins=shuffle(letters.slice()).map(function(L){ return {kind:"shadow", letter:L, tok:{k:"shadow",v:L}}; });
    var items=shuffle(letters.slice()).map(function(L){
      var bi=-1; for(var i=0;i<bins.length;i++){ if(bins[i].letter===L){ bi=i; break; } }
      return {tok:{k:"text",v:L}, bin:bi};
    });
    return { bins:bins, items:items };
  }

  var cplay=null, cEls={}, C={ gid:null, level:0, g:null, sel:null, placed:0, total:0, score:0 };
  function ensureCPlay(){
    if(cplay) return;
    cplay=el("div","pa34-cplay");
    cplay.innerHTML=
      '<div class="pa34-ptop"><button class="pa34-x" id="pa34cX" aria-label="Salir">&times;</button>'+
        '<div class="pa34-prompt" id="pa34cprompt"></div>'+
        '<div class="pa34-pstar">'+String.fromCodePoint(0x2B50)+' <span id="pa34cscore">0</span></div></div>'+
      '<div class="pa34-citems" id="pa34citems"></div>'+
      '<div class="pa34-cbins" id="pa34cbins"></div>'+
      '<div class="pa34-win" id="pa34cwin"><div class="pa34-wc">'+
        '<div class="rf">'+rufoSVG(true)+'</div><h2>'+INV+'Muy bien!</h2><p id="pa34cwp"></p>'+
        '<div class="row"><button class="pa34-cta ghost" id="pa34cwmap">Mapa</button><button class="pa34-cta" id="pa34cwnext">Siguiente</button></div>'+
      '</div></div>';
    document.body.appendChild(cplay);
    cEls={ items:$("pa34citems"), bins:$("pa34cbins"), prompt:$("pa34cprompt"), score:$("pa34cscore"),
      win:$("pa34cwin"), wp:$("pa34cwp"), wnext:$("pa34cwnext"), wmap:$("pa34cwmap") };
    $("pa34cX").addEventListener("click",function(){ cplay.classList.remove("show"); });
    cEls.wnext.onclick=function(){
      cEls.win.classList.remove("show");
      if(C.level>=4){ cplay.classList.remove("show"); if(C.g) openLevels(C.g); }
      else { launchClassify(C.g, C.level+1); }
    };
    cEls.wmap.onclick=function(){ cEls.win.classList.remove("show"); cplay.classList.remove("show"); if(C.g) openLevels(C.g); };
  }
  function launchClassify(g,level){
    ensureCPlay(); closeOv();
    C.gid=g.id; C.level=level; C.g=g; C.sel=null; C.placed=0;
    var data=buildClassify(g,level); C.total=data.items.length;
    cplay.classList.add("show"); cEls.win.classList.remove("show");
    cEls.prompt.innerHTML=g.desc || "Toca y coloca";
    // bins
    cEls.bins.innerHTML="";
    data.bins.forEach(function(b,idx){
      var bin=el("button","pa34-cbin");
      bin.setAttribute("data-bin",idx);
      var head=el("div","bh");
      if(b.kind==="shadow"){ head.appendChild(el("span","pa34-shadow",b.letter)); }
      else { head.appendChild(el("span","pa34-emoji",b.tok.v)); head.appendChild(el("span","bl",b.label)); }
      var slot=el("div","bslot");
      bin.appendChild(head); bin.appendChild(slot);
      bin.addEventListener("click",function(){ onBin(bin,slot); });
      cEls.bins.appendChild(bin);
    });
    // items
    cEls.items.innerHTML="";
    shuffle(data.items.slice()).forEach(function(it){
      var b=el("button","pa34-citem", tokenHTML(it.tok));
      b.setAttribute("data-bin", it.bin);
      b.addEventListener("click",function(){ onItem(b); });
      cEls.items.appendChild(b);
    });
  }
  function onItem(btn){
    if(btn.classList.contains("placed")) return;
    if(C.sel){ C.sel.classList.remove("sel"); }
    if(C.sel===btn){ C.sel=null; return; }
    C.sel=btn; btn.classList.add("sel");
  }
  function onBin(bin,slot){
    if(!C.sel){ bin.classList.add("bad"); setTimeout(function(){ bin.classList.remove("bad"); },300); return; }
    var want=C.sel.getAttribute("data-bin"), got=bin.getAttribute("data-bin");
    if(want===got){
      var item=C.sel; item.classList.remove("sel"); item.classList.add("placed");
      var mini=el("span","pa34-mini", item.innerHTML); slot.appendChild(mini);
      C.sel=null; C.placed++;
      try{ if(typeof window.playSfx==="function") window.playSfx("ok"); }catch(e){}
      if(C.placed>=C.total) classifyWin();
    } else {
      var s=C.sel; s.classList.add("bad"); bin.classList.add("bad");
      s.classList.remove("sel"); C.sel=null;
      setTimeout(function(){ s.classList.remove("bad"); bin.classList.remove("bad"); },320);
    }
  }
  function classifyWin(){
    setUnlocked(C.gid, Math.min(C.level+1,4));
    C.score=(C.score||0)+1; cEls.score.textContent=C.score;
    try{ if(typeof window.addStar==="function") window.addStar(); }catch(e){}
    cEls.wp.textContent="Colocaste "+C.total+" en su lugar "+String.fromCodePoint(0x1F31F);
    cEls.wnext.textContent = C.level>=4 ? INV+"Terminado!" : "Siguiente";
    setTimeout(function(){ burstIn(cplay); cEls.win.classList.add("show"); },300);
  }

  // ---------- hook subject cards ----------
  function hookCards(){
    var cards=document.querySelectorAll(".subject");
    if(!cards.length) return false;
    cards.forEach(function(b){
      if(b.getAttribute("data-pa34")) return;
      b.setAttribute("data-pa34","1");
      b.addEventListener("click",function(e){
        var key=b.dataset.game;
        if(SECTIONS[key]){
          e.stopImmediatePropagation(); e.preventDefault();
          openGames(key);
        }
      }, true); // capture phase -> runs before app handler
    });
    return true;
  }

  function init(){
    // ensure win buttons wired once play exists (lazy). Poll cards until home renders.
    var tries=0;
    var iv=setInterval(function(){
      tries++;
      var ok=hookCards();
      if(play && pEls.wnext) wireWinButtons();
      if(ok || tries>40) { /* keep observing a bit for late renders */ }
      if(tries>60) clearInterval(iv);
    },400);
    // also observe DOM for home re-renders (profiles switching etc.)
    try{
      var mo=new MutationObserver(function(){ hookCards(); if(play&&pEls.wnext) wireWinButtons(); });
      mo.observe(document.body,{childList:true,subtree:true});
    }catch(e){}
    // wire win buttons after first play creation
    var wb=setInterval(function(){ if(play&&pEls.wnext){ wireWinButtons(); clearInterval(wb); } },300);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
