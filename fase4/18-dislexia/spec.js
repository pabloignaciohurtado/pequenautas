/* ==================== Fase 4 · Mejora #18 "dislexia" ====================
   Modo dislexia-friendly: fuente OpenDyslexic OPCIONAL (gated por flag,
   nunca toca red), mayor espaciado (letras/palabras/línea) y toggle en
   Ajustes. 100% ADITIVO, mismo mecanismo que "17-accesibilidad":

   - No toca init() ni applyLang(). No reescribe ningún cuerpo de función
     existente de ship/app.js: solo añade una fila nueva en #setView
     (mismo patrón/ancla que #setCoplay / #setMascot / #setHiContrast:
     insertBefore($('setSessLimit'))) y alterna una clase en <html>.
   - i18n aditivo vía Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   - Usa addEventListener (nunca .onclick=) sobre #langBtn/#tabSet y sobre
     el propio toggle nuevo (#tgDyslexia), con flags _wired para ser
     idempotente si el script se carga dos veces.
   - Solo anima transform/opacity: reutiliza .toggle/.knob (ya animan
     transform) y no añade ninguna animación nueva. Respeta
     prefers-reduced-motion por herencia (no define excepciones).
   - Bajo file:// NO abre red, en ningún estado del toggle:
       · El espaciado/línea y la pila de fuentes de reemplazo (Comic Sans MS,
         Trebuchet MS, Verdana) son fuentes de sistema; no se descargan.
       · La fuente OpenDyslexic es 100% OPCIONAL y está detrás de DOS
         candados a la vez: (a) window.PEQUE_FLAGS.dyslexicFont debe ser
         true (OFF por defecto, mismo patrón que PEQUE_FLAGS.backendSync
         ya definido en ship/app.js), y (b) el modo debe estar encendido.
         Si el flag sigue en false (caso por defecto, y el único caso
         posible bajo file:// salvo que alguien lo active a mano), la clase
         que activa font-family:'OpenDyslexic' en spec.css NUNCA se añade
         a <html>, así que el navegador jamás intenta resolver ese nombre
         de fuente ni el @font-face asociado. Los archivos .woff2 reales
         NO se incluyen en este entregable de código (ver integration.md
         §4 para cómo activarlos si se agregan más adelante).
   - Idempotente: si spec.js se carga dos veces, no duplica la fila de
     Ajustes ni vuelve a envolver listeners marcados con flags _dys*.
   ================================================================== */
(function(){
  "use strict";

  /* ---------- flag de fuente opcional (mismo patrón que PEQUE_FLAGS.backendSync) ----------
     OFF por defecto: activarlo NO descarga nada por sí solo, solo permite que
     spec.css aplique font-family:'OpenDyslexic' SI además los archivos de
     fuente existen en la ruta documentada (integration.md §4). Sin esos
     archivos, el navegador simplemente cae al siguiente nombre de la pila
     (Comic Sans MS / Trebuchet MS / Verdana) sin generar ningún error. */
  window.PEQUE_FLAGS = Object.assign({ dyslexicFont:false }, window.PEQUE_FLAGS||{});

  /* ---------- i18n aditivo ---------- */
  if (typeof UI === 'object' && UI.es && UI.en){
    Object.assign(UI.es, {
      setDysN: 'Modo lectura fácil',
      setDysD: 'Más espacio entre letras y líneas (dislexia)'
    });
    Object.assign(UI.en, {
      setDysN: 'Easy-read mode',
      setDysD: 'More space between letters and lines (dyslexia)'
    });
  }

  /* ---------- preferencia persistida (DB.settings.dyslexia, OFF por defecto) ----------
     Booleano de nivel superior en DB.settings, mismo patrón que
     DB.settings.coplay (no anidado bajo DB.settings.a11y para que este
     módulo funcione de forma 100% independiente, se integre o no
     "17-accesibilidad"). */
  function cfg(){
    if (typeof DB !== 'object' || !DB) return { dyslexia:false };
    if (!DB.settings) DB.settings = {};
    if (typeof DB.settings.dyslexia !== 'boolean') DB.settings.dyslexia = false; /* default OFF */
    return DB.settings;
  }
  function isOn(){ return !!cfg().dyslexia; }

  /* ---------- aplica/retira las clases en <html> ---------- */
  function applyClasses(){
    var on = isOn();
    document.documentElement.classList.toggle('a11y-dys', on);
    /* la clase de fuente opcional SOLO se añade si el modo está encendido
       Y el flag de activación está en true; nunca por separado. */
    document.documentElement.classList.toggle('a11y-dys-font', on && !!(window.PEQUE_FLAGS && window.PEQUE_FLAGS.dyslexicFont));
  }

  /* ---------- fila nueva en Ajustes (mismo patrón que #setCoplay/#setMascot/#setHiContrast) ---------- */
  function place(row){
    var set = $('setView'); if (!set) return;
    var anchor = $('setSessLimit');
    if (anchor && anchor.parentNode === set) set.insertBefore(row, anchor);
    else set.appendChild(row);
  }
  function ensureRow(){
    var set = $('setView'); if (!set) return;
    if (!$('setDyslexia')){
      var row = document.createElement('div'); row.className = 'setting'; row.id = 'setDyslexia';
      row.innerHTML = '<div><div class="name" id="setDysN"></div><div class="desc" id="setDysD"></div></div>'
        + '<button class="toggle" id="tgDyslexia" role="switch" aria-checked="false"><span class="knob"></span></button>';
      place(row);
    }
    var tg = $('tgDyslexia');
    if (tg && !tg._dysWired){
      tg._dysWired = true;
      tg.addEventListener('click', function(){
        var c = cfg(); c.dyslexia = !c.dyslexia;
        if (typeof saveDB === 'function') saveDB();
        applyClasses(); syncRow();
        if (typeof speak === 'function'){
          var t = (typeof S === 'object' && typeof UI === 'object') ? UI[S.lang] : null;
          if (t && t.setDysN) speak(t.setDysN);
        }
      });
    }
    applyRowLang(); syncRow();
  }
  function syncRow(){
    var tg = $('tgDyslexia'); if (!tg) return;
    var on = isOn();
    tg.classList.toggle('on', on);
    tg.setAttribute('aria-checked', String(on));
  }
  function applyRowLang(){
    var t = (typeof S === 'object' && S && typeof UI === 'object') ? UI[S.lang] : null; if (!t) return;
    var set = function(id, txt){ var el = $(id); if (el && txt != null) el.textContent = txt; };
    set('setDysN', t.setDysN); set('setDysD', t.setDysD);
  }

  /* ---------- init ---------- */
  function init(){
    cfg(); applyClasses();
    ensureRow();
    var lb = $('langBtn');
    if (lb && !lb._dysLangWired){ lb._dysLangWired = true; lb.addEventListener('click', applyRowLang); }
    var ts = $('tabSet');
    if (ts && !ts._dysTabWired){ ts._dysTabWired = true; ts.addEventListener('click', function(){ ensureRow(); }); }
  }

  /* ---------- API pública (tests / tooling) ---------- */
  window.__dyslexia = {
    isOn: isOn,
    hasFontAsset: function(){ return !!(window.PEQUE_FLAGS && window.PEQUE_FLAGS.dyslexicFont); },
    enable:  function(){ cfg().dyslexia = true;  if (typeof saveDB === 'function') saveDB(); applyClasses(); syncRow(); },
    disable: function(){ cfg().dyslexia = false; if (typeof saveDB === 'function') saveDB(); applyClasses(); syncRow(); },
    toggle:  function(){ cfg().dyslexia = !cfg().dyslexia; if (typeof saveDB === 'function') saveDB(); applyClasses(); syncRow(); return isOn(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} });
  else { try{ init(); }catch(e){} }
})();
