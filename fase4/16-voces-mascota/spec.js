/* ==================== Fase 4 · Mejora #16 "voces-mascota" ====================
   Parte de CÓDIGO que sí se puede hacer ahora (mascota-guía animada) +
   activador silencioso de voces humanas para cuando la locución exista
   (GATED: ver 16-voces-mascota.md para el candado real — requiere locución
   humana ES/EN, no depende de código). El AudioBank (audio/<lang>/<key>.mp3
   + AUDIO_MANIFEST) ya existe en ship/app.js; este módulo NO lo reescribe.

   100% ADITIVO:
   - No toca init() ni applyLang().
   - Envuelve por REASIGNACIÓN (mismo mecanismo que ya usan AudioBank,
     "Estrategia bilingüe" y "Modo guiado padre-hijo" en app.js):
       window.afterCorrect, window.onWrong, window.show, window.speak,
       window.speakSeq.
   - i18n aditivo vía Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   - Usa addEventListener (nunca .onclick=) sobre #langBtn/#tabSet.
   - Anima solo transform/opacity (ver spec.css) y respeta
     prefers-reduced-motion (regla local + la regla global ya existente).
   - Bajo file:// no abre red: la mascota es 100% visual/DOM local, y el
     "activador de voces humanas" solo AÑADE `opts.key` antes de llamar a
     window.speak/window.speakSeq ya existentes — la decisión final de tocar
     un <audio> sigue dentro de AudioBank, que ya está inerte bajo file://
     (AudioBank.enabled === false ahí). No se abre ningún socket/fetch aquí.
   - Idempotente: si el script se carga dos veces, no vuelve a envolver ni
     duplica la fila de Ajustes o el nodo de la mascota.
   ================================================================== */
(function(){
  "use strict";

  var MASCOT_EMOJI = { idle:'🦉', happy:'🤩', oops:'😯' };

  /* ---------- i18n aditivo (nueva fila de Ajustes) ---------- */
  if (typeof UI === 'object' && UI.es && UI.en){
    Object.assign(UI.es, {
      setMascotN: 'Mascota guía',
      setMascotD: 'Un amigo animado que acompaña el juego'
    });
    Object.assign(UI.en, {
      setMascotN: 'Guide mascot',
      setMascotD: 'An animated friend that plays along'
    });
  }

  /* ---------- preferencia persistida (DB.settings.mascot, ON por defecto) ---------- */
  function cfg(){
    if (typeof DB !== 'object' || !DB) return { mascot:true };
    if (!DB.settings) DB.settings = {};
    if (typeof DB.settings.mascot !== 'boolean') DB.settings.mascot = true;
    return DB.settings;
  }
  function isOn(){ return !!cfg().mascot; }

  /* ---------- nodo de la mascota (creado por DOM APIs, igual que #coplayCard) ---------- */
  var host = null, faceEl = null, talkTimer = null, stateTimer = null;

  function build(){
    if (host) return host;
    // Idempotencia real entre CARGAS del script (no solo dentro de una misma
    // ejecución de la IIFE): si el nodo ya existe en el DOM -por ejemplo
    // porque spec.js se cargó dos veces por error de integración-, se
    // reutiliza en vez de crear un duplicado.
    var existing = document.getElementById('peqMascot');
    if (existing){ host = existing; faceEl = document.getElementById('pmFace'); return host; }
    host = document.createElement('div');
    host.id = 'peqMascot'; host.className = 'peqMascot';
    host.setAttribute('role', 'button');
    host.setAttribute('aria-hidden', 'true'); // decorativo: no añade info que no esté ya en #promptText
    host.innerHTML = '<span class="pmRing" aria-hidden="true"></span><span class="pmFace" id="pmFace">' + MASCOT_EMOJI.idle + '</span>';
    var appHost = $('app') || document.body;
    appHost.appendChild(host);
    faceEl = $('pmFace');
    // Tocar la mascota repite el prompt actual (mismo botón que 🔊), sin duplicar lógica de habla.
    host.addEventListener('click', function(){
      var rb = $('replayBtn');
      if (rb && typeof S === 'object' && S && S.screen === 'game') rb.click();
    });
    return host;
  }

  function sync(){
    if (!host) return;
    var visible = isOn() && typeof S === 'object' && S && S.screen === 'game';
    host.classList.toggle('show', !!visible);
  }

  function setFace(state){ if (faceEl) faceEl.textContent = MASCOT_EMOJI[state] || MASCOT_EMOJI.idle; }

  function pulse(cls, ms, faceState){
    build();
    if (!host || !isOn()) return;
    clearTimeout(stateTimer);
    host.classList.remove('pmHappy', 'pmOops');
    if (faceState) setFace(faceState);
    void host.offsetWidth; // reinicia la animación si se dispara dos veces seguidas
    host.classList.add(cls);
    stateTimer = setTimeout(function(){
      host.classList.remove(cls);
      setFace('idle');
    }, ms);
  }

  function mascotHappy(){ pulse('pmHappy', 640, 'happy'); }
  function mascotOops(){ pulse('pmOops', 440, 'oops'); }

  function talkPulse(){
    build();
    if (!host || !isOn()) return;
    host.classList.add('pmTalk');
    clearTimeout(talkTimer);
    talkTimer = setTimeout(function(){ if (host) host.classList.remove('pmTalk'); }, 900);
  }

  /* ---------- activador de voces humanas: resuelve opts.key por texto ----------
     Compara el texto que se va a decir contra AUDIO_MANIFEST.keys (expuesto en
     window.AudioBank.manifest.keys) del idioma pedido. Si coincide EXACTO con
     el guion de una clave, se la pasa como opts.key/part.key ANTES de llamar al
     speak/speakSeq ya existente (el de AudioBank, que a su vez cae a TTS si la
     clave no tiene clip todavía — hoy siempre, porque AUDIO_MANIFEST.available
     está vacío). Así, el día que exista locución real y se actualice
     `available` (ver 16-voces-mascota.md), TODAS las llamadas a speak/speakSeq
     que YA existen en app.js empiezan a sonar con voz humana automáticamente,
     sin tocar un solo call-site de roundMath()/roundReading()/celebrate()/etc.
     Bajo file:// esto es inofensivo: AudioBank.enabled es false ahí, así que
     el clip nunca se reproduce aunque `key` se resuelva. */
  function resolveKey(text, lang){
    try{
      if (!text || !window.AudioBank || !window.AudioBank.manifest) return null;
      var keys = window.AudioBank.manifest.keys; if (!keys) return null;
      var norm = String(text).trim();
      for (var k in keys){
        if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
        var entry = keys[k];
        if (entry && entry[lang] === norm) return k;
      }
    } catch(e){}
    return null;
  }

  /* ---------- envolturas por REASIGNACIÓN (idempotentes) ---------- */
  if (!window.__mascotWrapped){
    window.__mascotWrapped = true;

    var _afterCorrect = window.afterCorrect;
    if (typeof _afterCorrect === 'function'){
      window.afterCorrect = function(key){
        var r = _afterCorrect(key);
        try{ mascotHappy(); }catch(e){}
        return r;
      };
    }

    var _onWrong = window.onWrong;
    if (typeof _onWrong === 'function'){
      window.onWrong = function(btn, hintFn){
        var r = _onWrong(btn, hintFn);
        try{ mascotOops(); }catch(e){}
        return r;
      };
    }

    var _show = window.show;
    if (typeof _show === 'function'){
      window.show = function(screen){
        var r = _show(screen);
        try{ sync(); }catch(e){}
        return r;
      };
    }

    var _speak = window.speak;
    if (typeof _speak === 'function'){
      window.speak = function(text, opts){
        var o = opts ? Object.assign({}, opts) : {};
        try{
          if (!o.key){
            var lang = o.lang || (typeof S === 'object' && S ? S.lang : 'es');
            var mk = resolveKey(text, lang);
            if (mk) o.key = mk;
          }
        }catch(e){}
        var r = _speak(text, o);
        try{ if (typeof S === 'object' && S && S.sound) talkPulse(); }catch(e){}
        return r;
      };
    }

    var _speakSeq = window.speakSeq;
    if (typeof _speakSeq === 'function'){
      window.speakSeq = function(parts){
        var arr = (parts || []).map(function(p){
          if (!p || p.key) return p;
          try{
            var lang = p.lang || (typeof S === 'object' && S ? S.lang : 'es');
            var mk = resolveKey(p.t, lang);
            if (mk) return Object.assign({}, p, { key: mk });
          }catch(e){}
          return p;
        });
        var r = _speakSeq(arr);
        try{ if (typeof S === 'object' && S && S.sound) talkPulse(); }catch(e){}
        return r;
      };
    }
  }

  /* ---------- fila de Ajustes (toggle mostrar/ocultar mascota), idempotente ---------- */
  function ensureSettingRow(){
    var set = $('setView'); if (!set) return;
    var row = $('setMascot');
    if (!row){
      row = document.createElement('div'); row.className = 'setting'; row.id = 'setMascot';
      row.innerHTML = '<div><div class="name" id="setMascotN"></div><div class="desc" id="setMascotD"></div></div>'
        + '<button class="toggle on" id="tgMascot" role="switch" aria-checked="true"><span class="knob"></span></button>';
      var anchor = $('setSessLimit');
      if (anchor && anchor.parentNode === set) set.insertBefore(row, anchor);
      else set.appendChild(row);
    }
    var tg = $('tgMascot');
    if (tg && !tg._mascotWired){
      tg._mascotWired = true;
      tg.addEventListener('click', function(){
        var c = cfg(); c.mascot = !c.mascot;
        if (typeof saveDB === 'function') saveDB();
        syncRow(); sync();
      });
    }
    applyLangRow(); syncRow();
  }
  function syncRow(){
    var tg = $('tgMascot');
    if (tg){ tg.classList.toggle('on', isOn()); tg.setAttribute('aria-checked', String(isOn())); }
  }
  function applyLangRow(){
    var t = (typeof S === 'object' && S && typeof UI === 'object') ? UI[S.lang] : null; if (!t) return;
    var n = $('setMascotN'), d = $('setMascotD');
    if (n) n.textContent = t.setMascotN || '';
    if (d) d.textContent = t.setMascotD || '';
  }

  function init(){
    cfg();
    build();
    sync();
    ensureSettingRow();
    var ts = $('tabSet');
    if (ts && !ts._mascotWired){ ts._mascotWired = true; ts.addEventListener('click', function(){ ensureSettingRow(); }); }
    var lb = $('langBtn');
    if (lb && !lb._mascotWired){
      lb._mascotWired = true;
      lb.addEventListener('click', function(){ applyLangRow(); try{ mascotHappy(); }catch(e){} });
    }
  }

  /* ---------- API pública (tests / tooling) ---------- */
  window.__mascot = {
    isOn: isOn,
    enable: function(){ cfg().mascot = true; if (typeof saveDB === 'function') saveDB(); syncRow(); sync(); },
    disable: function(){ cfg().mascot = false; if (typeof saveDB === 'function') saveDB(); syncRow(); sync(); },
    happy: mascotHappy,
    oops: mascotOops,
    talk: talkPulse,
    sync: sync,
    resolveKey: resolveKey,
    node: function(){ return host; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} });
  else { try{ init(); }catch(e){} }
})();
