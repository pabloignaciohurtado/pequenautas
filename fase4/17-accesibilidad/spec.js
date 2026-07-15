/* ==================== Fase 4 · Mejora #17 "accesibilidad" ====================
   Roles/ARIA, foco visible, alto contraste opcional, paleta daltónico-segura
   y navegación por teclado/switch. 100% ADITIVO:

   - No toca init() ni applyLang().
   - No reescribe ningún cuerpo de función existente. En vez de envolver
     afterCorrect/onWrong/roundMathCount/roundMathSubitize/roundMathCompare/
     roundReading/roundScience/roundScienceDiet por reasignación (como hacen
     otros módulos de fase4), esta mejora observa
     el DOM ya renderizado por esas funciones (MutationObserver sobre
     #stage, mismo mecanismo que ya usa "Modo guiado padre-hijo" sobre
     #stage con MutationObserver({childList:true})) y añade atributos
     ARIA / tabindex / listeners de teclado a los nodos que van
     apareciendo, sin cambiar su lógica de juego ni su marcado base.
   - i18n aditivo vía Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   - Usa addEventListener (nunca .onclick=) sobre #langBtn/#tabSet, y
     también sobre el resto de elementos existentes (#tgSound/#tgAnim/
     #tgGuide ya usan .onclick= en app.js; esta mejora SOLO añade un
     addEventListener adicional en paralelo, nunca reemplaza esa propiedad).
   - Alto contraste / paleta daltónico-segura se activan con clases en
     <html> (a11y-hc / a11y-cb) definidas en spec.css; no animan nada más
     que lo que ya animaba la app (transform/opacity) y respetan
     prefers-reduced-motion (heredado de la regla global de ship/index.html
     más las reglas locales de spec.css).
   - Bajo file:// no abre red: todo es DOM/CSS/localStorage local, igual
     que el resto de módulos de fase4 ya integrados.
   - Idempotente: si el script se carga dos veces, no duplica filas de
     Ajustes, no vuelve a envolver listeners marcados con flags _a11y*, y
     los nodos ya marcados con data-a11y="1" no se reprocesan.
   ================================================================== */
(function(){
  "use strict";

  /* ---------- i18n aditivo ---------- */
  if (typeof UI === 'object' && UI.es && UI.en){
    Object.assign(UI.es, {
      setHCN: 'Alto contraste',
      setHCD: 'Colores más marcados para ver mejor',
      setCBN: 'Paleta daltónico-segura',
      setCBD: 'Colores y símbolos que no dependen solo del color',
      a11yProfileChip: 'Cambiar de perfil',
      a11yGameLabel: 'Juego',
      a11yRound: 'Ronda {n} de {total}',
      a11yPeek: 'Ver de nuevo',
      a11yObject: 'Objeto',
      a11yOf: 'de',
      a11yChoices: 'Opciones',
      a11yCountGroup: 'Objetos para contar',
      a11yGroupOf: 'Grupo de'
    });
    Object.assign(UI.en, {
      setHCN: 'High contrast',
      setHCD: 'Bolder colors for easier viewing',
      setCBN: 'Colorblind-safe palette',
      setCBD: "Colors and symbols that don't rely on color alone",
      a11yProfileChip: 'Switch profile',
      a11yGameLabel: 'Game',
      a11yRound: 'Round {n} of {total}',
      a11yPeek: 'Peek again',
      a11yObject: 'Object',
      a11yOf: 'of',
      a11yChoices: 'Choices',
      a11yCountGroup: 'Objects to count',
      a11yGroupOf: 'Group of'
    });
  }

  /* ---------- preferencias persistidas (DB.settings.a11y, OFF por defecto) ---------- */
  function cfg(){
    if (typeof DB !== 'object' || !DB) return { highContrast:false, colorblindSafe:false };
    if (!DB.settings) DB.settings = {};
    if (!DB.settings.a11y || typeof DB.settings.a11y !== 'object') DB.settings.a11y = {};
    var a = DB.settings.a11y;
    if (typeof a.highContrast !== 'boolean') a.highContrast = false;
    if (typeof a.colorblindSafe !== 'boolean') a.colorblindSafe = false;
    return a;
  }
  function applyClasses(){
    var a = cfg();
    document.documentElement.classList.toggle('a11y-hc', !!a.highContrast);
    document.documentElement.classList.toggle('a11y-cb', !!a.colorblindSafe);
  }

  /* ---------- filas nuevas en Ajustes (mismo patrón que #setCoplay / #setMascot) ---------- */
  function place(row){
    var set = $('setView'); if (!set) return;
    var anchor = $('setSessLimit');
    if (anchor && anchor.parentNode === set) set.insertBefore(row, anchor);
    else set.appendChild(row);
  }
  function wireRow(id, key){
    var tg = $(id); if (!tg || tg._a11yRowWired) return;
    tg._a11yRowWired = true;
    tg.addEventListener('click', function(){
      var a = cfg(); a[key] = !a[key];
      if (typeof saveDB === 'function') saveDB();
      applyClasses(); syncRows();
    });
  }
  function syncRows(){
    var a = cfg();
    var h = $('tgHiContrast');
    if (h){ h.classList.toggle('on', !!a.highContrast); h.setAttribute('aria-checked', String(!!a.highContrast)); }
    var c = $('tgColorblind');
    if (c){ c.classList.toggle('on', !!a.colorblindSafe); c.setAttribute('aria-checked', String(!!a.colorblindSafe)); }
  }
  function applyRowLang(){
    var t = (typeof S === 'object' && S && typeof UI === 'object') ? UI[S.lang] : null; if (!t) return;
    var set = function(id, txt){ var el = $(id); if (el && txt != null) el.textContent = txt; };
    set('setHCN', t.setHCN); set('setHCD', t.setHCD);
    set('setCBN', t.setCBN); set('setCBD', t.setCBD);
  }
  function ensureRows(){
    var set = $('setView'); if (!set) return;
    if (!$('setHiContrast')){
      var r1 = document.createElement('div'); r1.className = 'setting'; r1.id = 'setHiContrast';
      r1.innerHTML = '<div><div class="name" id="setHCN"></div><div class="desc" id="setHCD"></div></div>'
        + '<button class="toggle" id="tgHiContrast" role="switch" aria-checked="false"><span class="knob"></span></button>';
      place(r1);
    }
    if (!$('setColorblind')){
      var r2 = document.createElement('div'); r2.className = 'setting'; r2.id = 'setColorblind';
      r2.innerHTML = '<div><div class="name" id="setCBN"></div><div class="desc" id="setCBD"></div></div>'
        + '<button class="toggle" id="tgColorblind" role="switch" aria-checked="false"><span class="knob"></span></button>';
      place(r2);
    }
    wireRow('tgHiContrast', 'highContrast');
    wireRow('tgColorblind', 'colorblindSafe');
    applyRowLang(); syncRows();
  }

  /* ---------- roles/aria estáticos (elementos con id fijo, ya existentes) ---------- */
  function applyStaticRoles(){
    var sheet = $('sheet'); if (sheet){ sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true'); }
    var cel = $('celebrate'); if (cel){ cel.setAttribute('role','dialog'); cel.setAttribute('aria-modal','true'); cel.setAttribute('aria-live','assertive'); cel.setAttribute('aria-labelledby','celTitle'); }
    var prof = $('profiles'); if (prof){ prof.setAttribute('role','region'); prof.setAttribute('aria-labelledby','pTitle'); }
    var promptWrap = document.querySelector('.prompt');
    if (promptWrap){ promptWrap.setAttribute('aria-live','polite'); promptWrap.setAttribute('aria-atomic','true'); }
    var progress = $('progress'); if (progress) progress.setAttribute('aria-hidden','true'); // decorativo: la ronda ya se anuncia por #a11yRoundStatus
    ensureRoundStatus();
    applyChromeLabels();
  }
  function applyChromeLabels(){
    var t = (typeof S === 'object' && S && typeof UI === 'object') ? UI[S.lang] : null; if (!t) return;
    var chip = $('profileChip'); if (chip) chip.setAttribute('aria-label', t.a11yProfileChip || '');
    var game = $('game'); if (game){ game.setAttribute('role','region'); game.setAttribute('aria-label', t.a11yGameLabel || ''); }
  }

  /* ---------- región viva: anuncia el cambio de ronda a lectores de pantalla ---------- */
  var lastRoundKey = null;
  function ensureRoundStatus(){
    if ($('a11yRoundStatus')) return;
    var el = document.createElement('div');
    el.id = 'a11yRoundStatus'; el.className = 'sr-only';
    el.setAttribute('aria-live','polite'); el.setAttribute('aria-atomic','true');
    (document.body || $('app')).appendChild(el);
  }
  function updateRoundStatus(){
    var el = $('a11yRoundStatus'); if (!el) return;
    if (typeof S !== 'object' || !S || S.screen !== 'game') return;
    var key = S.game + ':' + S.round;
    if (key === lastRoundKey) return;
    lastRoundKey = key;
    var t = (typeof UI === 'object') ? UI[S.lang] : null;
    var tmpl = (t && t.a11yRound) || 'Ronda {n} de {total}';
    el.textContent = tmpl.replace('{n}', (S.round + 1)).replace('{total}', S.totalRounds);
  }

  /* ---------- toggles nativos existentes: role=switch + aria-checked sincronizado ----------
     #tgSound/#tgAnim/#tgGuide ya tienen su propio .onclick= en app.js (no se toca); aquí solo
     se añade un addEventListener EN PARALELO para reflejar el estado en aria-checked. */
  function enhanceToggle(id, getVal){
    var btn = $(id); if (!btn) return;
    btn.setAttribute('role','switch');
    btn.setAttribute('aria-checked', String(!!getVal()));
    if (!btn._a11yWired){
      btn._a11yWired = true;
      btn.addEventListener('click', function(){
        setTimeout(function(){ btn.setAttribute('aria-checked', String(!!getVal())); }, 0);
      });
    }
  }
  function syncCoreToggles(){
    if (typeof S !== 'object' || !S) return;
    enhanceToggle('tgSound', function(){ return S.sound; });
    enhanceToggle('tgAnim', function(){ return S.anim; });
    enhanceToggle('tgGuide', function(){ return S.guide; });
  }

  /* ---------- mapa emoji -> palabra para las fichas de lectura (.cface sin .clabel) ----------
     Deriva el nombre accesible del objeto mostrado (p.ej. "Elephant"/"Elefante") para que un
     lector de pantalla tenga la MISMA información que un niño vidente obtiene mirando la
     imagen -no revela cuál es la respuesta correcta, solo identifica cada opción, igual que
     el propio dibujo hace para quien ve-. Usa LETTERS[S.lang], ya global en app.js. */
  function letterWordMap(){
    var map = {};
    try{
      var set = (typeof LETTERS === 'object') ? LETTERS[S.lang] : null;
      if (set) set.forEach(function(e){ if (e && e.emoji && e.word) map[e.emoji] = e.word; });
    }catch(e){}
    return map;
  }

  /* ---------- enriquecimiento de nodos dinámicos del juego (#stage) ---------- */
  function setupChoice(btn){
    if (btn.getAttribute('data-a11y')) return;
    btn.setAttribute('data-a11y','1');
    var cface = btn.querySelector('.cface');
    var clabel = btn.querySelector('.clabel');
    var cnum = btn.querySelector('.cnum');
    if (cface && !clabel && !cnum){
      var word = letterWordMap()[cface.textContent.trim()];
      if (word) btn.setAttribute('aria-label', word);
    }
    if (btn.classList.contains('groupChoice')){
      var t = (typeof S === 'object' && typeof UI === 'object') ? UI[S.lang] : null;
      var n = btn.querySelectorAll('.obj').length;
      btn.setAttribute('aria-label', ((t && t.a11yGroupOf) || 'Group of') + ' ' + n);
    }
  }
  function setupObj(el){
    if (el.getAttribute('data-a11y')) return;
    el.setAttribute('data-a11y','1');
    if (el.closest('button')){ el.setAttribute('aria-hidden','true'); return; } // dentro de .groupChoice: la etiqueta la pone el botón contenedor
    var t = (typeof S === 'object' && typeof UI === 'object') ? UI[S.lang] : null;
    var parent = el.parentElement;
    var idx = parent ? (Array.prototype.indexOf.call(parent.children, el) + 1) : 1;
    var total = parent ? parent.children.length : 1;
    el.setAttribute('role','button');
    el.setAttribute('tabindex','0');
    el.setAttribute('aria-label', ((t && t.a11yObject) || 'Object') + ' ' + idx + ' ' + ((t && t.a11yOf) || 'of') + ' ' + total);
    el.addEventListener('keydown', activateOnKey);
  }
  function setupVeil(el){
    if (!el.getAttribute('data-a11y')){
      el.setAttribute('data-a11y','1');
      el.setAttribute('role','button');
      var t = (typeof S === 'object' && typeof UI === 'object') ? UI[S.lang] : null;
      el.setAttribute('aria-label', (t && t.a11yPeek) || 'Peek again');
      el.addEventListener('keydown', activateOnKey);
    }
    syncVeilFocusable(el);
  }
  function syncVeilFocusable(el){
    var wrap = el.closest('.subitizeWrap');
    var visible = !!(wrap && wrap.classList.contains('veiled'));
    el.setAttribute('tabindex', visible ? '0' : '-1');
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
  function setupContainer(el){
    if (el.getAttribute('data-a11y')) return;
    el.setAttribute('data-a11y','1');
    el.setAttribute('role','group');
    var t = (typeof S === 'object' && typeof UI === 'object') ? UI[S.lang] : null;
    if (el.classList.contains('choices')) el.setAttribute('aria-label', (t && t.a11yChoices) || 'Choices');
    else if (el.classList.contains('countbox') && !el.closest('button')) el.setAttribute('aria-label', (t && t.a11yCountGroup) || 'Objects to count');
  }
  function activateOnKey(e){
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter'){
      e.preventDefault(); e.currentTarget.click();
    }
  }

  function scan(root){
    if (!root || root.nodeType !== 1) return;
    if (root.matches){
      if (root.matches('.choice')) setupChoice(root);
      if (root.matches('.obj')) setupObj(root);
      if (root.matches('.veil')) setupVeil(root);
      if (root.matches('.choices, .countbox')) setupContainer(root);
    }
    if (root.querySelectorAll){
      root.querySelectorAll('.choice').forEach(setupChoice);
      root.querySelectorAll('.obj').forEach(setupObj);
      root.querySelectorAll('.veil').forEach(setupVeil);
      root.querySelectorAll('.choices, .countbox').forEach(setupContainer);
    }
  }

  function onStageMutations(muts){
    muts.forEach(function(m){
      if (m.type === 'childList'){
        m.addedNodes.forEach(scan);
      } else if (m.type === 'attributes' && m.attributeName === 'class'){
        var t = m.target;
        if (t.classList && t.classList.contains('subitizeWrap')){
          var v = t.querySelector('.veil'); if (v) syncVeilFocusable(v);
        }
      }
    });
    updateRoundStatus();
  }

  /* ---------- navegación por teclado / switch: flechas mueven el foco dentro de un grupo ---------- */
  function focusableIn(container){
    var list = container.querySelectorAll('button, [tabindex]');
    return Array.prototype.filter.call(list, function(el){
      if (el.getAttribute('tabindex') === '-1') return false;
      return el.offsetParent !== null; // visible
    });
  }
  function onStageKeydown(e){
    var key = e.key;
    if (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].indexOf(key) === -1) return;
    var group = e.target.closest ? e.target.closest('.choices, .countbox') : null;
    if (!group) return;
    var items = focusableIn(group);
    var idx = items.indexOf(e.target);
    if (idx === -1) return;
    var next = idx;
    if (key === 'ArrowRight' || key === 'ArrowDown') next = (idx + 1) % items.length;
    else if (key === 'ArrowLeft' || key === 'ArrowUp') next = (idx - 1 + items.length) % items.length;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = items.length - 1;
    if (next !== idx && items[next]){ e.preventDefault(); items[next].focus(); }
  }

  /* ---------- alternativa de teclado para el gate "mantén presionado" ----------
     #holdBtn solo escuchaba pointerdown/up/leave/cancel (gesto táctil/ratón). Se añade
     un equivalente de teclado/switch independiente (Espacio o Enter mantenidos ~1.2s
     abren el panel de adultos vía passGate(), ya global) sin tocar startHold/endHold. */
  function wireHoldKeyboard(){
    var hb = $('holdBtn'); if (!hb || hb._a11yKeyWired) return;
    hb._a11yKeyWired = true;
    var timer = null;
    function begin(e){
      if (e.repeat) return;
      hb.classList.add('holding');
      timer = setTimeout(function(){
        hb.classList.remove('holding');
        if (typeof passGate === 'function') passGate();
      }, 1200);
    }
    function cancel(){ hb.classList.remove('holding'); clearTimeout(timer); }
    hb.addEventListener('keydown', function(e){ if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') begin(e); });
    hb.addEventListener('keyup', function(e){ if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') cancel(); });
    hb.addEventListener('blur', cancel);
  }

  /* ---------- init ---------- */
  var stageObserver = new MutationObserver(onStageMutations);
  function init(){
    cfg(); applyClasses();
    applyStaticRoles();
    syncCoreToggles();
    ensureRows();
    wireHoldKeyboard();
    var stage = $('stage');
    if (stage){
      scan(stage);
      if (!stage._a11yObs){
        stage._a11yObs = true;
        stageObserver.observe(stage, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
        stage.addEventListener('keydown', onStageKeydown);
      }
    }
    var lb = $('langBtn');
    if (lb && !lb._a11yLangWired){ lb._a11yLangWired = true; lb.addEventListener('click', function(){ applyChromeLabels(); applyRowLang(); }); }
    var ts = $('tabSet');
    if (ts && !ts._a11yTabWired){ ts._a11yTabWired = true; ts.addEventListener('click', function(){ ensureRows(); syncCoreToggles(); }); }
  }

  /* ---------- API pública (tests / tooling) ---------- */
  window.__a11y = {
    isHighContrast: function(){ return document.documentElement.classList.contains('a11y-hc'); },
    isColorblindSafe: function(){ return document.documentElement.classList.contains('a11y-cb'); },
    enableHighContrast: function(){ cfg().highContrast = true; if (typeof saveDB === 'function') saveDB(); applyClasses(); syncRows(); },
    disableHighContrast: function(){ cfg().highContrast = false; if (typeof saveDB === 'function') saveDB(); applyClasses(); syncRows(); },
    enableColorblindSafe: function(){ cfg().colorblindSafe = true; if (typeof saveDB === 'function') saveDB(); applyClasses(); syncRows(); },
    disableColorblindSafe: function(){ cfg().colorblindSafe = false; if (typeof saveDB === 'function') saveDB(); applyClasses(); syncRows(); },
    scan: scan,
    focusableIn: focusableIn
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ try{ init(); }catch(e){} });
  else { try{ init(); }catch(e){} }
})();
