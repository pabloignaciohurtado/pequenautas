/* Fase 4 #39 - Fondo de bosque completo. Inyecta una escena de bosque a
   pantalla completa (imagen Grok) detras del contenido del home, con paneo
   suave y hojas cayendo. 100% aditivo. Solo se muestra en #home. */
(function(){
  "use strict";
  if(window.__pa39) return; window.__pa39 = true;
  function build(){
    if(document.getElementById('pa39bg')) return;
    var bg = document.createElement('div');
    bg.id = 'pa39bg'; bg.setAttribute('aria-hidden','true');
    var leaves = ''; var cls = ['g','o','y','g','o','y'];
    for(var i=1;i<=6;i++){ leaves += '<i class="lf '+cls[i-1]+' l'+i+'"></i>'; }
    bg.innerHTML = '<div class="pa39-scroll"></div>' + leaves;
    document.body.appendChild(bg);
    sync();
    try{
      var home = document.getElementById('home');
      if(home && window.MutationObserver){
        new MutationObserver(sync).observe(home,{attributes:true,attributeFilter:['class']});
      }
    }catch(e){}
  }
  function sync(){
    try{
      var home = document.getElementById('home'); var bg = document.getElementById('pa39bg');
      if(!home || !bg) return;
      bg.classList.toggle('on', home.classList.contains('active'));
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build);
  else build();
})();
