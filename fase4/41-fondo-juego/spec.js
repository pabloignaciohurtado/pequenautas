/* Fase 4 #41 - Fondo de bosque HD para la pantalla de juego. Inyecta una capa
   #pa41bg (fixed, z-index:-1) con la escena de un claro del bosque detras del
   contenido del juego; visible solo cuando #game esta activo. 100% aditivo:
   no toca app.js ni el DOM del juego mas alla de la capa de fondo. */
(function(){
  "use strict";
  if(window.__pa41) return; window.__pa41 = true;
  function sync(){
    try{
      var g = document.getElementById('game'); var bg = document.getElementById('pa41bg');
      if(!g || !bg) return;
      bg.classList.toggle('on', g.classList.contains('active'));
    }catch(e){}
  }
  function build(){
    if(document.getElementById('pa41bg')) return;
    var bg = document.createElement('div');
    bg.id = 'pa41bg'; bg.setAttribute('aria-hidden','true');
    var leaves = ''; var cls = ['g','o','y','g'];
    for(var i=1;i<=4;i++){ leaves += '<i class="lf '+cls[i-1]+' l'+i+'"></i>'; }
    bg.innerHTML = '<div class="pa41-scroll"></div>' + leaves;
    document.body.appendChild(bg);
    sync();
    try{
      var g = document.getElementById('game');
      if(g && window.MutationObserver){
        new MutationObserver(sync).observe(g,{attributes:true,attributeFilter:['class']});
      }
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build);
  else build();
})();
