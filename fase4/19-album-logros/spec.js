/* ==================== Fase 4 · Mejora #19 "album-logros" ====================
   Álbum de logros saludable: hitos de ESFUERZO/CONSTANCIA por perfil,
   nunca de ranking ni de rendimiento comparado.

   Por qué así (evita la sobrejustificación, Lepper 1973):
   - Los hitos premian PROCESO (volver a jugar otro día, no rendirse tras
     fallar, explorar las 3 materias, practicar mucho) y NUNCA precisión,
     velocidad ni "eres el mejor". Evita convertir el acierto -que ya es
     intrínsecamente satisfactorio, con su propio confeti/estrella- en una
     mercancía por la que "trabajar".
   - El álbum es 100% RETROSPECTIVO: no hay HUD, contador ni notificación
     durante el juego. Se revisa después, en el panel de adultos ya
     existente (misma zona que Progreso/Ajustes/Educador), junto al AAP tip
     de co-juego. No interrumpe ni compite con la celebración de ronda.
   - Las tarjetas BLOQUEADAS no muestran el criterio exacto ni un contador
     "te faltan N" — solo un "❔" y un texto genérico. Un objetivo explícito
     y contingente es justo el mecanismo que más debilita el interés
     intrínseco (Lepper/Deci); mantenerlo como sorpresa evita convertir el
     álbum en una lista de tareas por cumplir.
   - Un solo perfil a la vez, sin tabla comparativa entre niños (a
     diferencia del panel Educador, que sí agrega varios perfiles para el
     adulto pero tampoco los rankea entre sí). No hay "quién va ganando".
   - Los hitos, una vez desbloqueados, quedan persistidos para siempre en
     profile.achv (no se "pierden" aunque profile.ev se recorte a 400
     eventos) — sin mecánicas de racha que se rompen (no hay culpa/ansiedad
     por "perder" un logro ya ganado).

   100% ADITIVO, mismo mecanismo que otros módulos de fase4/ship ya
   integrados (AudioBank, bilingüe, co-juego, panel educador):
   - NO reescribe ningún cuerpo de función existente. Envuelve
     window.logRound por reasignación (mismo patrón que window.afterCorrect
     /window.nextRound en el bloque bilingüe) para registrar el día de
     juego y evaluar hitos tras cada ronda, sin cambiar su firma ni su
     valor de retorno.
   - NO toca init() ni applyLang(). Usa addEventListener (nunca .onclick=)
     sobre #langBtn/#tabSet y sobre los tabs YA existentes (#tabProg/
     #tabSet/#tabEdu) para ocultar el álbum al cambiar de pestaña —
     reasignar su .onclick no serviría: esos botones ya tienen un .onclick
     fijado por app.js con una referencia de función capturada en el
     momento de la carga, así que solo un listener adicional (addEventListener)
     se ejecuta de forma fiable sin pisar esa cadena.
   - i18n aditivo vía Object.assign(UI.es,{...})/Object.assign(UI.en,{...}).
   - Solo anima transform/opacity (misma curva --ease-out que .pcard/.subject)
     y respeta prefers-reduced-motion.
   - Bajo file:// no toca red: todo el estado vive en DB (localStorage con
     fallback en memoria) vía saveDB() ya existente.
   - Idempotente: si spec.js se carga dos veces, no duplica el tab ni la
     vista, y no vuelve a envolver logRound.
   ================================================================== */
(function(){
  "use strict";

  /* ---------- catálogo de hitos (esfuerzo/constancia, no ranking) ---------- */
  /* Cada def: id estable + icono + check(profile)->boolean. El criterio NUNCA
     se muestra al niño mientras está bloqueado (ver renderAlbum). */
  var ACHV = [
    { id:'welcome',  icon:'🚀',
      check: function(p){ return (p.ev||[]).length >= 1; } },
    { id:'persist',  icon:'💪',
      check: function(p){ return (p.ev||[]).some(function(e){ return (e.at||0) >= 3 || (e.as && !e.ft); }); } },
    { id:'explorer', icon:'🧭',
      check: function(p){ var seen={}; (p.ev||[]).forEach(function(e){ seen[e.g]=1; }); return !!(seen.math && seen.reading && seen.science); } },
    { id:'return1',  icon:'🌤️',
      check: function(p){ return (p.playDays||[]).length >= 2; } },
    { id:'steady',   icon:'🌱',
      check: function(p){ return (p.playDays||[]).length >= 5; } },
    { id:'practice', icon:'📚',
      check: function(p){ return (p.ev||[]).length >= 40; } }
  ];

  function todayStr(){ try{ return new Date().toISOString().slice(0,10); }catch(e){ return String(Date.now()); } }

  /* ---------- i18n aditivo ---------- */
  if (typeof UI === 'object' && UI.es && UI.en){
    Object.assign(UI.es, {
      tabAlbum: 'Logros', albumTitle: 'Álbum de logros', albumSub: 'Momentos de esfuerzo y constancia de tu peque — sin comparar con nadie más.',
      albumLocked: '¿Un momento sorpresa?', albumTip: '💡 Este álbum celebra el esfuerzo y la constancia, no quién es "mejor". Los hitos bloqueados son sorpresa: no hace falta perseguirlos, solo seguir jugando juntos.',
      albumCount: '{n} de {t} momentos descubiertos',
      achv_welcome_t: '¡Tu primer viaje!', achv_welcome_d: 'Empezaste a jugar. ¡Bienvenido, peque explorador!',
      achv_persist_t: '¡No te rendiste!', achv_persist_d: 'Seguiste intentando aunque una ronda costó un poco más.',
      achv_explorer_t: '¡Explorador de todo!', achv_explorer_d: 'Probaste Números, Letras y Animales.',
      achv_return1_t: '¡Volviste a jugar!', achv_return1_d: 'Regresaste a jugar en otro día, por tu cuenta.',
      achv_steady_t: '¡Constancia de peque explorador!', achv_steady_d: 'Jugaste en varios días distintos. ¡Eso es constancia!',
      achv_practice_t: '¡Practicaste mucho!', achv_practice_d: 'Acumulaste muchas rondas jugadas. El esfuerzo se nota.'
    });
    Object.assign(UI.en, {
      tabAlbum: 'Milestones', albumTitle: 'Achievement album', albumSub: "Moments of effort and consistency for your child — never compared to anyone else.",
      albumLocked: 'A surprise moment?', albumTip: "💡 This album celebrates effort and consistency, not who's \"best\". Locked milestones are a surprise — no need to chase them, just keep playing together.",
      albumCount: '{n} of {t} moments discovered',
      achv_welcome_t: 'Your first trip!', achv_welcome_d: 'You started playing. Welcome, little explorer!',
      achv_persist_t: 'You kept trying!', achv_persist_d: 'You stuck with a round even when it took a bit more effort.',
      achv_explorer_t: 'Explorer of it all!', achv_explorer_d: 'You tried Numbers, Letters and Animals.',
      achv_return1_t: 'You came back to play!', achv_return1_d: 'You returned to play on another day, all on your own.',
      achv_steady_t: 'Steady little explorer!', achv_steady_d: "You played on several different days. That's consistency!",
      achv_practice_t: 'You practiced a lot!', achv_practice_d: 'You played many rounds. The effort shows.'
    });
  }

  /* ---------- tracking + evaluación (wrap de window.logRound) ---------- */
  function ensureAchvState(p){
    if(!p.playDays) p.playDays = [];
    if(!p.achv) p.achv = [];
  }

  function albumTrack(){
    var p = (typeof currentProfile === 'function') ? currentProfile() : null;
    if(!p) return;
    ensureAchvState(p);
    var day = todayStr();
    var changed = false;
    if(p.playDays.indexOf(day) < 0){ p.playDays.push(day); changed = true; }
    var unlockedIds = p.achv.map(function(a){ return a.id; });
    ACHV.forEach(function(def){
      if(unlockedIds.indexOf(def.id) < 0 && def.check(p)){
        p.achv.push({ id: def.id, at: new Date().toISOString() });
        changed = true;
      }
    });
    if(changed && typeof saveDB === 'function') saveDB();
  }

  if(!window.__albumWrapped){
    window.__albumWrapped = true;
    var _logRound = window.logRound;
    if(typeof _logRound === 'function'){
      window.logRound = function(){
        var r = _logRound.apply(this, arguments);
        try{ albumTrack(); }catch(e){}
        return r;
      };
    }
  }

  /* ---------- construcción de la pestaña y la vista (DOM nuevo, aditivo) ---------- */
  function ensureAlbumUI(){
    var tabs = document.querySelector('#adultView .tabs');
    var adultView = $('adultView');
    if(!tabs || !adultView) return;

    if(!$('tabAlbum')){
      var b = document.createElement('button');
      b.className = 'tab'; b.id = 'tabAlbum'; b.type = 'button';
      b.innerHTML = '🏅 <span id="tabAlbumTxt"></span>';
      tabs.appendChild(b);
      b.addEventListener('click', showAlbum);
    }
    if(!$('albumView')){
      var view = document.createElement('div');
      view.id = 'albumView'; view.style.display = 'none';
      view.innerHTML =
        '<h3 id="albumTitle"></h3>'
        + '<p class="sub" id="albumSub"></p>'
        + '<div id="albumBody"></div>'
        + '<div class="tip" id="albumTipText"></div>';
      adultView.appendChild(view);
    }
  }

  function albumHide(){
    var v = $('albumView'); if(v) v.style.display = 'none';
    var t = $('tabAlbum'); if(t) t.classList.remove('on');
  }

  function showAlbum(){
    ['tabProg','tabSet','tabEdu'].forEach(function(id){ var el=$(id); if(el) el.classList.remove('on'); });
    ['progView','setView','eduView'].forEach(function(id){ var el=$(id); if(el) el.style.display='none'; });
    var tab = $('tabAlbum'); if(tab) tab.classList.add('on');
    var view = $('albumView'); if(view) view.style.display = 'block';
    applyAlbumLang();
    renderAlbum();
  }

  /* ---------- render ---------- */
  function renderAlbum(){
    var t = UI[S.lang]; var host = $('albumBody'); if(!host) return;
    var p = (typeof currentProfile === 'function') ? currentProfile() : null;
    if(!p){ host.innerHTML = '<div class="empty">' + (t.noData || '') + '</div>'; return; }
    ensureAchvState(p);
    var unlockedIds = {}; p.achv.forEach(function(a){ unlockedIds[a.id] = a; });
    var n = p.achv.length, total = ACHV.length;
    var countTxt = (t.albumCount || '{n}/{t}').replace('{n}', n).replace('{t}', total);
    var html = '<div class="albumCount">' + eduEsc(countTxt) + '</div><div class="albumGrid">';
    ACHV.forEach(function(def, i){
      var un = unlockedIds[def.id];
      var delay = (i * 60) + 'ms';
      if(un){
        var title = t['achv_' + def.id + '_t'] || def.id;
        var desc = t['achv_' + def.id + '_d'] || '';
        var dateStr = '';
        try{ dateStr = new Date(un.at).toLocaleDateString(S.lang === 'es' ? 'es-ES' : 'en-US'); }catch(e){}
        html += '<div class="albumCard unlocked" style="animation-delay:' + delay + '">'
          + '<div class="albumIcon">' + def.icon + '</div>'
          + '<div class="albumCardTitle">' + eduEsc(title) + '</div>'
          + '<div class="albumCardDesc">' + eduEsc(desc) + '</div>'
          + (dateStr ? '<div class="albumDate">' + eduEsc(dateStr) + '</div>' : '')
          + '</div>';
      } else {
        html += '<div class="albumCard locked" style="animation-delay:' + delay + '">'
          + '<div class="albumIcon">❔</div>'
          + '<div class="albumCardTitle">' + eduEsc(t.albumLocked || '') + '</div>'
          + '</div>';
      }
    });
    html += '</div>';
    host.innerHTML = html;
  }

  function applyAlbumLang(){
    var t = UI[S.lang]; if(!t) return;
    var set = function(id, txt){ var el = $(id); if(el && txt != null) el.textContent = txt; };
    set('tabAlbumTxt', t.tabAlbum);
    set('albumTitle', t.albumTitle);
    set('albumSub', t.albumSub);
    set('albumTipText', t.albumTip);
  }

  /* ---------- wiring: ocultar el álbum al navegar a otras pestañas/cerrar ----------
     addEventListener adicional (no .onclick=) sobre elementos YA existentes
     (#tabProg/#tabSet/#tabEdu/#closeSheet/#sheet), tal como hacen los demás
     módulos de fase4 ya integrados (AudioBank sobre #langBtn, co-juego sobre
     #tabSet). No reemplaza ni reordena su .onclick original. */
  function wireAlbum(){
    ensureAlbumUI();
    ['tabProg','tabSet','tabEdu'].forEach(function(id){
      var el = $(id);
      if(el && !el._albumWired){ el._albumWired = true; el.addEventListener('click', albumHide); }
    });
    var cs = $('closeSheet'); if(cs && !cs._albumWired){ cs._albumWired = true; cs.addEventListener('click', albumHide); }
    var sh = $('sheet'); if(sh && !sh._albumWired){ sh._albumWired = true; sh.addEventListener('click', function(e){ if(e.target === sh) albumHide(); }); }
    var lb = $('langBtn'); if(lb && !lb._albumLangWired){
      lb._albumLangWired = true;
      lb.addEventListener('click', function(){
        applyAlbumLang();
        var v = $('albumView'); if(v && v.style.display !== 'none') renderAlbum();
      });
    }
    applyAlbumLang();
  }

  /* ---------- API pública (tests / tooling) ---------- */
  window.__album = {
    defs: function(){ return ACHV.map(function(d){ return d.id; }); },
    unlocked: function(){ var p = currentProfile(); return p && p.achv ? p.achv.map(function(a){ return a.id; }) : []; },
    playDays: function(){ var p = currentProfile(); return p && p.playDays ? p.playDays.slice() : []; },
    evaluate: albumTrack,
    show: showAlbum,
    hide: albumHide,
    render: renderAlbum
  };

  function init(){ try{ wireAlbum(); }catch(e){} }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} });
  else { try{ init(); }catch(e){} }
})();
