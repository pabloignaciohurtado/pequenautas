/* Fase 4 #39 - Fondo de bosque vivo. Inyecta una capa decorativa animada
   (nubes, hojas, mariposa, pajaro, arboles) detras del contenido del home.
   100% aditivo: no toca app.js ni STORE_KEY. Solo se muestra en #home. */
(function(){
  "use strict";
  if(window.__pa39) return; window.__pa39 = true;


  function bflySVG(){
    return '<div class="bob"><svg width="26" height="22" viewBox="0 0 26 22">'
      + '<g class="w">'
      + '<ellipse cx="8" cy="8" rx="7" ry="6" fill="#E8843A"/>'
      + '<ellipse cx="18" cy="8" rx="7" ry="6" fill="#F2A65A"/>'
      + '<ellipse cx="8" cy="15" rx="5.5" ry="5" fill="#EC9A54"/>'
      + '<ellipse cx="18" cy="15" rx="5.5" ry="5" fill="#F2B36E"/>'
      + '</g>'
      + '<rect x="12" y="4" width="2" height="15" rx="1" fill="#5E3A1B"/>'
      + '<circle cx="13" cy="4" r="2" fill="#5E3A1B"/></svg></div>';
  }
  function birdSVG(){
    return '<div class="bob"><svg width="34" height="24" viewBox="0 0 34 24">'
      + '<ellipse cx="16" cy="14" rx="12" ry="8" fill="#8FB7E8"/>'
      + '<circle cx="27" cy="10" r="6" fill="#A7CBF0"/>'
      + '<circle cx="29" cy="9" r="1.6" fill="#2E3B2C"/>'
      + '<polygon points="33,10 39,9 33,13" fill="#E8843A"/>'
      + '<path class="wg" d="M14 13 Q8 2 2 9 Q9 12 14 15 Z" fill="#6E9BD6"/></svg></div>';
  }

  function build(){
    if(document.getElementById('pa39bg')) return;
    var bg = document.createElement('div');
    bg.id = 'pa39bg'; bg.setAttribute('aria-hidden','true');
    var leaves = '';
    var cls = ['g','o','y','g','o','y'];
    for(var i=1;i<=6;i++){ leaves += '<i class="lf '+cls[i-1]+' l'+i+'"></i>'; }
    bg.innerHTML =
      '<span class="c c1"></span><span class="c c2"></span><span class="c c3"></span>'
      + leaves
      + '<div class="bfly">'+bflySVG()+'</div>'
      + '<div class="bird">'+birdSVG()+'</div>'
      + '<div class="pa39-scroll"></div>';
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
      var home = document.getElementById('home');
      var bg = document.getElementById('pa39bg');
      if(!home || !bg) return;
      bg.classList.toggle('on', home.classList.contains('active'));
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build);
  else build();
})();
