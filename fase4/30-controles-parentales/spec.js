/* ==================== Fase 4 · Mejora #30 "controles-parentales" ====================
   Controles parentales REALES, todos alojados detrás del parent gate ya
   existente (mantén presionado 1.2s → #holdBtn → passGate()):
     1) PIN de adulto (opcional, 4 dígitos): capa EXTRA sobre el gate físico.
        Si está activo, pasar el hold-gate ya NO abre directo el panel de
        adultos: primero pide el PIN (teclado numérico dentro del mismo
        #sheet). "Olvidé mi PIN" lo restablece resolviendo una suma simple
        (mismo patrón ya usado por el gate de reanudar tras la pausa de
        sesión saludable, renderBreakGate en ship/app.js).
     2) Límite DIARIO de juego (distinto del "límite de sesión saludable" ya
        integrado en ship/app.js, que solo sugiere PAUSAS durante el juego
        seguido y se reinicia con cada sentada). Este es un total de
        minutos por día natural, persistido por perfil (profile.dailyPlay),
        que bloquea el juego con una pantalla propia al agotarse; un adulto
        puede conceder +15 min pasando el mismo gate (hold + PIN si aplica).
     3) Habilitar/deshabilitar materias (Números/Letras/Animales) a nivel de
        dispositivo (DB.settings.parental.subjects), ocultando las tarjetas
        correspondientes en Inicio. Siempre debe quedar al menos una activa.
     4) Andamiaje i18n para más idiomas: window.registerLocale(code, dict,
        meta) crea/actualiza UI[code] como un Proxy que resuelve claves no
        traducidas cayendo a UI.es en vivo (incluye claves que otros
        módulos de fase4 agreguen a UI.es DESPUÉS de este registro, porque
        el fallback lee la referencia viva de UI.es, no una copia). Se
        registra un locale de DEMOSTRACIÓN ('pt', parcial e intencionalmente
        incompleto) solo para probar el mecanismo — ver integration.md.

   Patrón 100% aditivo (mismo mecanismo que AudioBank / bilingüe / co-juego /
   álbum de logros / informe semanal / meta semanal / panel educador, ya
   integrados en ship/app.js):
   - Envuelve window.passGate, window.refreshHome y window.startGame por
     reasignación (chain-of-responsibility, delega primero a la versión
     anterior salvo cuando el propio candado parental decide interceptar
     el flujo, p.ej. pedir el PIN antes de continuar).
   - Crea una 4ª pestaña ("🔒 Control parental") dentro del área de adultos
     ya gateada, con document.createElement — mismo patrón que usa la
     pestaña "🧑‍🏫 Educador" ya existente en el ship base (vista hermana de
     #adultView dentro de #panel, alternada por show/hide propios).
   - i18n aditivo con Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   - addEventListener SIEMPRE (nunca reasigna .onclick=) sobre #langBtn,
     #tabSet, #tabProg, #tabEdu y el resto de elementos ya existentes, para
     no romper sus cadenas ya existentes.
   - No toca init() ni applyLang(). No reescribe ningún cuerpo de función
     existente de ship/app.js. Animaciones solo transform/opacity
     (spec.css), respeta prefers-reduced-motion. No abre red bajo file://
     ni en ningún entorno: todo el cálculo es local sobre DB (localStorage
     con fallback en memoria, vía saveDB() ya existente).
   - El hash del PIN NO es criptográfico (es un hash tipo djb2 solo para no
     guardar el PIN en texto plano en localStorage): mismo modelo de
     amenaza que el propio hold-gate físico ya existente — un disuasivo
     razonable para un preescolar, no una caja fuerte. Documentado también
     en integration.md. */
(function () {
  "use strict";

  /* ---------- i18n aditivo (no toca literales UI.es/UI.en existentes) ---------- */
  if (typeof UI === 'object' && UI.es && UI.en) {
    Object.assign(UI.es, {
      parentalTitle: 'Control parental',
      parentalSub: 'Ajustes avanzados para cuidadores, dentro del acceso ya protegido.',
      pinToggleN: 'PIN de adulto',
      pinToggleD: 'Pide un PIN de 4 dígitos además del botón, para entrar aquí',
      pinChangeBtn: 'Cambiar PIN',
      pinSetTitle: 'Crea un PIN',
      pinSetSub: '4 dígitos, solo para personas adultas.',
      pinConfirmTitle: 'Confirma el PIN',
      pinConfirmSub: 'Ingresa el mismo PIN otra vez.',
      pinGateTitle: 'Ingresa el PIN',
      pinGateSub: 'El PIN de 4 dígitos que configuraste.',
      pinForgot: '¿Olvidaste el PIN?',
      pinForgotQ: 'Para restablecerlo, resuelve:',
      pinCancel: 'Cancelar',
      dailyToggleN: 'Límite diario de juego',
      dailyToggleD: 'Bloquea el juego al llegar al tiempo total permitido hoy',
      dailyMinsN: 'Minutos por día',
      dailyMinsD: 'Tiempo total de juego permitido cada día',
      dailyTitle: '¡Se acabó el tiempo de hoy!',
      dailyMsg: 'Jugaste muy bien hoy. Vuelve mañana para seguir aprendiendo.',
      dailyBye: 'Está bien',
      dailyAdult: 'Un adulto continúa',
      subjectsN: 'Materias habilitadas',
      subjectsD: 'Elige qué materias puede jugar tu peque. Debe quedar al menos una.',
      localeN: 'Idioma (beta)',
      localeD: 'Traducciones adicionales parciales; usan español donde falta texto.',
      parentalTip: '💡 El límite diario bloquea el juego al llegar al total de minutos de hoy; es distinto del límite de sesión, que solo sugiere pausas durante el juego seguido.'
    });
    Object.assign(UI.en, {
      parentalTitle: 'Parental controls',
      parentalSub: 'Advanced settings for caregivers, inside the already-protected area.',
      pinToggleN: 'Adult PIN',
      pinToggleD: 'Ask for a 4-digit PIN on top of the button, to enter here',
      pinChangeBtn: 'Change PIN',
      pinSetTitle: 'Create a PIN',
      pinSetSub: '4 digits, for grown-ups only.',
      pinConfirmTitle: 'Confirm the PIN',
      pinConfirmSub: 'Enter the same PIN again.',
      pinGateTitle: 'Enter the PIN',
      pinGateSub: 'The 4-digit PIN you set up.',
      pinForgot: 'Forgot your PIN?',
      pinForgotQ: 'To reset it, solve:',
      pinCancel: 'Cancel',
      dailyToggleN: 'Daily play limit',
      dailyToggleD: 'Blocks play once today’s total allowed time is reached',
      dailyMinsN: 'Minutes per day',
      dailyMinsD: 'Total play time allowed each day',
      dailyTitle: 'Time’s up for today!',
      dailyMsg: 'You played so well today. Come back tomorrow to keep learning.',
      dailyBye: 'Okay',
      dailyAdult: 'A grown-up continues',
      subjectsN: 'Enabled subjects',
      subjectsD: 'Choose which subjects your child can play. At least one must stay on.',
      localeN: 'Language (beta)',
      localeD: 'Extra translations are partial; missing text falls back to Spanish.',
      parentalTip: '\u{1F4A1} The daily limit blocks play once today’s total minutes are reached; it is different from the session limit, which only suggests breaks during continuous play.'
    });
  }

  function L() { var lang = (typeof S === 'object' && S) ? S.lang : 'es'; return (typeof UI === 'object') ? (UI[lang] || UI.es) : null; }
  function P() { return (typeof currentProfile === 'function') ? currentProfile() : null; }

  /* ==================== 0) configuración parental (device-level, en DB.settings) ==================== */
  function parentalCfg() {
    var fallback = { pinEnabled: false, pinHash: '', dailyLimitOn: false, dailyLimitMins: 30, subjects: { math: true, reading: true, science: true } };
    if (typeof DB !== 'object' || !DB) return fallback;
    if (!DB.settings) DB.settings = {};
    if (!DB.settings.parental || typeof DB.settings.parental !== 'object') DB.settings.parental = fallback;
    var c = DB.settings.parental;
    if (typeof c.pinEnabled !== 'boolean') c.pinEnabled = false;
    if (typeof c.pinHash !== 'string') c.pinHash = '';
    if (typeof c.dailyLimitOn !== 'boolean') c.dailyLimitOn = false;
    if ([15, 30, 45, 60].indexOf(c.dailyLimitMins) < 0) c.dailyLimitMins = 30;
    if (!c.subjects || typeof c.subjects !== 'object') c.subjects = { math: true, reading: true, science: true };
    ['math', 'reading', 'science'].forEach(function (g) { if (typeof c.subjects[g] !== 'boolean') c.subjects[g] = true; });
    return c;
  }

  /* Hash NO criptográfico (djb2): evita texto plano en localStorage, no es
     seguridad real — mismo modelo de amenaza que el hold-gate físico. */
  function hashPin(pin) {
    var s = String(pin || ''), h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; }
    return 'p' + h.toString(36);
  }

  /* ==================== 1) PIN de adulto: vista compartida (gate / setup / confirm) ==================== */
  var pinState = { mode: null, buffer: '', firstEntry: null, onDone: null, onCancel: null, restoreAdult: false };

  function buildPinPad() {
    var pad = $('pinPad'); if (!pad || pad.childElementCount) return;
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];
    keys.forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button';
      if (k === 'back') { b.className = 'pinKey pinKeyBack'; b.innerHTML = '⌫'; b.setAttribute('aria-label', 'backspace'); b.addEventListener('click', pinBackspace); }
      else if (k === '') { b.className = 'pinKey pinKeyBlank'; b.disabled = true; b.tabIndex = -1; }
      else { b.className = 'pinKey'; b.textContent = k; b.addEventListener('click', function () { pinDigit(k); }); }
      pad.appendChild(b);
    });
  }

  function buildPinView() {
    var existing = $('pinView'); if (existing) return existing;
    var panel = $('panel'); if (!panel) return null;
    var v = document.createElement('div'); v.id = 'pinView'; v.style.display = 'none';
    v.innerHTML =
      '<h3 id="pinViewTitle"></h3>'
      + '<p class="sub" id="pinViewSub"></p>'
      + '<div class="pinDots" id="pinDots"><span class="pinDot"></span><span class="pinDot"></span><span class="pinDot"></span><span class="pinDot"></span></div>'
      + '<div class="pinPad" id="pinPad"></div>'
      + '<div id="pinForgotWrap">'
      + '<button class="btn ghost" id="pinForgotBtn" style="width:100%;margin-top:10px"></button>'
      + '<div id="pinForgotCaptcha" style="display:none">'
      + '<p class="breakGateQ" id="pinForgotQ"></p>'
      + '<div class="choices" id="pinForgotChoices"></div>'
      + '</div>'
      + '</div>'
      + '<button class="btn ghost" id="pinCancelBtn" style="width:100%;margin-top:10px"></button>';
    var closeBtn = $('closeSheet');
    if (closeBtn && closeBtn.parentNode === panel) panel.insertBefore(v, closeBtn); else panel.appendChild(v);
    buildPinPad();
    var fb = $('pinForgotBtn'); if (fb && !fb._pcWired) { fb._pcWired = true; fb.addEventListener('click', showForgotCaptcha); }
    var cb = $('pinCancelBtn'); if (cb && !cb._pcWired) { cb._pcWired = true; cb.addEventListener('click', pinCancel); }
    return v;
  }

  function paintPinDots() {
    var dots = document.querySelectorAll('#pinDots .pinDot');
    dots.forEach(function (d, i) { d.classList.toggle('on', i < pinState.buffer.length); });
  }
  function pinShakeFx() {
    var d = $('pinDots'); if (!d) return;
    d.classList.remove('pinShakeDots'); void d.offsetWidth; d.classList.add('pinShakeDots');
  }
  function paintPinView() {
    var t = L(); if (!t) return;
    var title = $('pinViewTitle'), sub = $('pinViewSub'), forgotWrap = $('pinForgotWrap'), forgotBtn = $('pinForgotBtn'), cancelBtn = $('pinCancelBtn');
    if (pinState.mode === 'gate') { if (title) title.textContent = t.pinGateTitle; if (sub) sub.textContent = t.pinGateSub; if (forgotWrap) forgotWrap.style.display = 'block'; }
    else if (pinState.mode === 'setup1') { if (title) title.textContent = t.pinSetTitle; if (sub) sub.textContent = t.pinSetSub; if (forgotWrap) forgotWrap.style.display = 'none'; }
    else if (pinState.mode === 'setup2') { if (title) title.textContent = t.pinConfirmTitle; if (sub) sub.textContent = t.pinConfirmSub; if (forgotWrap) forgotWrap.style.display = 'none'; }
    if (forgotBtn) forgotBtn.textContent = t.pinForgot;
    if (cancelBtn) cancelBtn.textContent = t.pinCancel;
    var cap = $('pinForgotCaptcha'); if (cap) cap.style.display = 'none';
    paintPinDots();
  }

  function openPinView(mode, onDone, onCancel) {
    buildPinView();
    var av = $('adultView');
    var wasAdultVisible = !!(av && av.style.display === 'block');
    pinState.mode = mode; pinState.buffer = ''; pinState.firstEntry = null;
    pinState.onDone = onDone || null; pinState.onCancel = onCancel || null; pinState.restoreAdult = wasAdultVisible;
    if (wasAdultVisible) av.style.display = 'none';
    ['gateView', 'newView'].forEach(function (id) { var v = $(id); if (v) v.style.display = 'none'; });
    var pv = $('pinView'); if (pv) pv.style.display = 'block';
    paintPinView();
  }
  function closePinView(restore) {
    var pv = $('pinView'); if (pv) pv.style.display = 'none';
    if (restore !== false && pinState.restoreAdult) { var av = $('adultView'); if (av) av.style.display = 'block'; }
  }

  function pinDigit(d) {
    if (pinState.buffer.length >= 4) return;
    pinState.buffer += d; paintPinDots();
    if (pinState.buffer.length === 4) setTimeout(pinSubmit, 120);
  }
  function pinBackspace() { pinState.buffer = pinState.buffer.slice(0, -1); paintPinDots(); }
  function pinSubmit() {
    var cfg = parentalCfg();
    if (pinState.mode === 'gate') {
      if (hashPin(pinState.buffer) === cfg.pinHash) { var done = pinState.onDone; closePinView(); if (done) done(); }
      else { pinShakeFx(); pinState.buffer = ''; paintPinDots(); }
    } else if (pinState.mode === 'setup1') {
      pinState.firstEntry = pinState.buffer; pinState.mode = 'setup2'; pinState.buffer = ''; paintPinView();
    } else if (pinState.mode === 'setup2') {
      if (pinState.buffer === pinState.firstEntry) {
        cfg.pinHash = hashPin(pinState.buffer); cfg.pinEnabled = true; if (typeof saveDB === 'function') saveDB();
        var done2 = pinState.onDone; closePinView(); if (done2) done2();
      } else { pinShakeFx(); pinState.mode = 'setup1'; pinState.buffer = ''; pinState.firstEntry = null; paintPinView(); }
    }
  }
  function pinCancel() { var c = pinState.onCancel; closePinView(); if (c) c(); }

  function showForgotCaptcha() {
    var t = L(); var cap = $('pinForgotCaptcha'); if (!cap) return;
    cap.style.display = 'block';
    var a = 2 + rnd(6), b = 2 + rnd(6), ans = a + b;
    var q = $('pinForgotQ'); if (q) q.textContent = (t && t.pinForgotQ ? t.pinForgotQ + ' ' : '') + a + ' + ' + b + ' = ?';
    var set = [ans]; while (set.length < 3) { var dd = ans + (rnd(5) - 2); if (dd > 0 && set.indexOf(dd) < 0) set.push(dd); }
    var opts = shuffle(set), wrap = $('pinForgotChoices'); if (!wrap) return; wrap.innerHTML = '';
    opts.forEach(function (val) {
      var b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = val;
      b.addEventListener('click', function () {
        if (val === ans) {
          var cfg = parentalCfg(); cfg.pinEnabled = false; cfg.pinHash = ''; if (typeof saveDB === 'function') saveDB();
          var done = pinState.onDone; closePinView(); if (done) done();
        } else { b.classList.remove('shakeNo'); void b.offsetWidth; b.classList.add('shakeNo'); }
      });
      wrap.appendChild(b);
    });
  }

  /* Punto de entrada del gate físico → PIN (llamado desde el wrap de window.passGate) */
  function openPinGate() {
    var act = (typeof S === 'object' && S) ? S.gatePending : null;
    if (typeof S === 'object' && S) S.gatePending = null;
    openPinView('gate',
      function () { if (act) { act(); } else { if (typeof showSheetView === 'function') showSheetView('adultView'); if (typeof showTab === 'function') showTab('prog'); } },
      function () { var sh = $('sheet'); if (sh) sh.classList.remove('show'); }
    );
  }

  /* ---------- wrap de window.passGate (chain-of-responsibility) ---------- */
  if (!window.__parentalPassGateWrapped) {
    window.__parentalPassGateWrapped = true;
    var _passGate = window.passGate;
    if (typeof _passGate === 'function') {
      window.passGate = function () {
        var cfg = parentalCfg();
        if (cfg.pinEnabled && cfg.pinHash) { openPinGate(); return; }
        return _passGate.apply(this, arguments);
      };
    }
  }

  /* ==================== 2) límite diario de juego ==================== */
  var DL_TICK_MS = 1000, DL_SAVE_EVERY = 5;
  var dlLast = Date.now(), dlTickCount = 0, dlOverlayShown = false;

  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function dailyState(p) {
    if (!p) return null;
    if (!p.dailyPlay || typeof p.dailyPlay !== 'object' || p.dailyPlay.date !== todayKey()) {
      p.dailyPlay = { date: todayKey(), ms: 0, grantedExtraMs: 0 };
    }
    if (typeof p.dailyPlay.grantedExtraMs !== 'number') p.dailyPlay.grantedExtraMs = 0;
    return p.dailyPlay;
  }

  function dailyTick() {
    var now = Date.now();
    var cfg = parentalCfg();
    if (!cfg.dailyLimitOn) { dlLast = now; return; }
    if (typeof S === 'undefined' || S.screen === 'profiles' || document.hidden || dlOverlayShown) { dlLast = now; return; }
    var p = P(); if (!p) { dlLast = now; return; }
    var st = dailyState(p);
    st.ms += Math.max(0, now - dlLast);
    dlLast = now;
    dlTickCount++;
    if (dlTickCount >= DL_SAVE_EVERY) { dlTickCount = 0; if (typeof saveDB === 'function') saveDB(); }
    var limitMs = cfg.dailyLimitMins * 60000 + (st.grantedExtraMs || 0);
    if (st.ms >= limitMs) triggerDailyLimit();
  }

  function applyLangDaily() {
    var t = L(); if (!t) return;
    var set = function (id, txt) { var el = $(id); if (el && txt != null) el.textContent = txt; };
    set('dailyLimitTitle', t.dailyTitle); set('dailyLimitMsg', t.dailyMsg);
    set('dailyLimitByeBtn', t.dailyBye); set('dailyLimitAdultBtn', t.dailyAdult);
  }
  function buildDailyOverlay() {
    if ($('dailyLimitOverlay')) return;
    var o = document.createElement('div');
    o.id = 'dailyLimitOverlay'; o.className = 'dailyLimitOverlay'; o.hidden = true;
    o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'dailyLimitTitle');
    o.innerHTML =
      '<div class="panel dailyLimitPanel">'
      + '<div class="dailyLimitEmoji" aria-hidden="true">⏳</div>'
      + '<h2 id="dailyLimitTitle"></h2>'
      + '<p id="dailyLimitMsg" class="breakMsg"></p>'
      + '<button class="btn" id="dailyLimitByeBtn"></button>'
      + '<button class="btn ghost" id="dailyLimitAdultBtn"></button>'
      + '</div>';
    document.body.appendChild(o);
    $('dailyLimitByeBtn').addEventListener('click', function () {
      hideDailyOverlay();
      if (typeof show === 'function') show('profiles'); else if (typeof goHome === 'function') goHome();
    });
    $('dailyLimitAdultBtn').addEventListener('click', function () {
      if (typeof requireGate === 'function') requireGate(grantDailyExtra);
    });
    applyLangDaily();
  }
  function triggerDailyLimit() {
    if (dlOverlayShown) return;
    buildDailyOverlay(); dlOverlayShown = true; applyLangDaily();
    var o = $('dailyLimitOverlay'); o.hidden = false;
    requestAnimationFrame(function () { o.classList.add('show'); });
    if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
    var t = L(); if (t && typeof speak === 'function') speak(t.dailyMsg, { lang: (typeof S === 'object' ? S.lang : 'es') });
  }
  function hideDailyOverlay() {
    var o = $('dailyLimitOverlay'); if (!o) return;
    o.classList.remove('show'); o.hidden = true; dlOverlayShown = false; dlLast = Date.now();
  }
  function grantDailyExtra() {
    var p = P(); if (p) { var st = dailyState(p); st.grantedExtraMs = (st.grantedExtraMs || 0) + 15 * 60000; if (typeof saveDB === 'function') saveDB(); }
    var sh = $('sheet'); if (sh) sh.classList.remove('show');
    hideDailyOverlay();
  }

  /* ==================== 3) habilitar/deshabilitar materias ==================== */
  function applySubjectVisibility() {
    var cfg = parentalCfg();
    var subs = cfg.subjects;
    var anyOn = subs.math || subs.reading || subs.science;
    if (!anyOn) { subs.math = true; subs.reading = true; subs.science = true; if (typeof saveDB === 'function') saveDB(); } // salvaguarda: nunca todas apagadas
    document.querySelectorAll('.subject[data-game]').forEach(function (btn) {
      var g = btn.dataset.game; btn.hidden = (subs[g] === false);
    });
  }

  if (typeof window.refreshHome === 'function' && !window.__parentalRefreshWrapped) {
    window.__parentalRefreshWrapped = true;
    var _refreshHome = window.refreshHome;
    window.refreshHome = function () { var r = _refreshHome.apply(this, arguments); try { applySubjectVisibility(); } catch (e) {} return r; };
  }
  if (typeof window.startGame === 'function' && !window.__parentalStartWrapped) {
    window.__parentalStartWrapped = true;
    var _startGame = window.startGame;
    window.startGame = function (g) {
      try { var cfg = parentalCfg(); if (cfg.subjects && cfg.subjects[g] === false) return; } catch (e) {}
      return _startGame.apply(this, arguments);
    };
  }

  /* ==================== 4) andamiaje i18n a más idiomas ==================== */
  window.UI_LOCALES = window.UI_LOCALES || { es: { name: 'Español' }, en: { name: 'English' } };
  window.registerLocale = function (code, dict, meta) {
    if (!code || typeof code !== 'string' || typeof UI !== 'object') return false;
    var base = UI.es; // fuente canónica de fallback; se lee EN VIVO (no una copia)
    if (!UI[code] || UI[code].__isLocaleProxy !== true) {
      var store = Object.assign({}, dict || {});
      UI[code] = new Proxy(store, {
        get: function (target, prop) {
          if (prop === '__isLocaleProxy') return true;
          if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
          return base[prop]; // clave no traducida → cae a español, incluso si se agrega a UI.es después
        },
        set: function (target, prop, value) { target[prop] = value; return true; }
      });
    } else { Object.assign(UI[code], dict || {}); }
    window.UI_LOCALES[code] = Object.assign({ name: code }, meta || {});
    return true;
  };
  /* Locale de DEMOSTRACIÓN, deliberadamente parcial (~15 claves) — prueba el
     mecanismo de fallback, no pretende ser una traducción completa. Ver
     integration.md §5 para el alcance real y sus límites conocidos. */
  window.registerLocale('pt', {
    tagline: 'Aprenda brincando', math: 'Números', read: 'Letras', sci: 'Animais', adult: 'Para adultos',
    gateTitle: 'Só para adultos', gateSub: 'Toque e segure o botão para entrar.', hold: 'Toque e segure', holdNum: 'Toque e segure \u{1F447}',
    tabProg: 'Progresso', tabSet: 'Ajustes', progTitle: 'Progresso', progSub: 'Como vai seu pequeno.',
    close: 'Pronto', switch: 'Trocar de criança', pTitle: 'Quem vai jogar?', pSub: 'Escolha seu perfil',
    parentalTitle: 'Controle parental', parentalSub: 'Ajustes avançados para responsáveis.'
  }, { name: 'Português (beta)' });

  function chooseLocale(code) {
    if (typeof UI !== 'object' || !UI[code] || typeof S !== 'object') return;
    S.lang = code;
    if (typeof applyLang === 'function') applyLang(); // ya existente, solo se LLAMA, no se edita
    applyLangParental(); paintPinView(); syncLocaleChips();
  }
  function renderLocaleChips() {
    var box = $('localeChoices'); if (!box) return;
    box.innerHTML = '';
    Object.keys(window.UI_LOCALES || {}).forEach(function (code) {
      var meta = window.UI_LOCALES[code] || {};
      var b = document.createElement('button'); b.className = 'btn ghost'; b.setAttribute('data-locale', code);
      b.textContent = meta.name || code; b.setAttribute('aria-pressed', String(code === S.lang));
      box.appendChild(b);
    });
    syncLocaleChips();
  }
  function syncLocaleChips() {
    var box = $('localeChoices'); if (!box) return;
    box.querySelectorAll('button[data-locale]').forEach(function (b) {
      var sel = b.getAttribute('data-locale') === S.lang;
      b.classList.toggle('ghost', !sel); b.setAttribute('aria-pressed', String(sel));
    });
  }

  /* ==================== pestaña "🔒 Control parental" (vista hermana de #adultView) ==================== */
  function ensureParentalTabButton() {
    var tabs = document.querySelector('#adultView .tabs'); if (!tabs) return null;
    var b = $('tabParental');
    if (!b) { b = document.createElement('button'); b.className = 'tab'; b.id = 'tabParental'; b.innerHTML = '\u{1F512} <span id="tabParentalTxt"></span>'; tabs.appendChild(b); }
    return b;
  }
  function buildSubjRows() {
    var host = $('subjRows'); if (!host || host.childElementCount) return;
    var order = [{ g: 'math', emoji: '\u{1F522}' }, { g: 'reading', emoji: '\u{1F524}' }, { g: 'science', emoji: '\u{1F422}' }];
    order.forEach(function (it) {
      var row = document.createElement('div'); row.className = 'setting subjRow'; row.id = 'setSubj_' + it.g;
      row.innerHTML = '<div class="txt"><div class="name"><span aria-hidden="true">' + it.emoji + '</span> <span id="subjLbl_' + it.g + '"></span></div></div>'
        + '<button class="toggle on" id="tgSubj_' + it.g + '" role="switch" aria-checked="true" data-subj="' + it.g + '"><span class="knob"></span></button>';
      host.appendChild(row);
    });
  }
  function ensureParentalView() {
    var v = $('parentalView'); if (v) return v;
    var panel = $('panel'); if (!panel) return null;
    v = document.createElement('div'); v.id = 'parentalView'; v.style.display = 'none';
    v.innerHTML =
      '<h3 id="parentalTitleTxt"></h3>'
      + '<p class="sub" id="parentalSubTxt"></p>'
      + '<div class="setting" id="setParentalPin">'
      + '<div class="txt"><div class="name" id="pinToggleN"></div><div class="desc" id="pinToggleD"></div></div>'
      + '<button class="toggle" id="tgParentalPin" role="switch"><span class="knob"></span></button>'
      + '</div>'
      + '<div class="setting" id="pinChangeRow" hidden>'
      + '<div class="txt"><div class="name" id="pinChangeLbl"></div></div>'
      + '<button class="btn ghost" id="pinChangeBtn"></button>'
      + '</div>'
      + '<div class="setting" id="setDailyLimit">'
      + '<div class="txt"><div class="name" id="dailyToggleN"></div><div class="desc" id="dailyToggleD"></div></div>'
      + '<button class="toggle" id="tgDailyLimit" role="switch"><span class="knob"></span></button>'
      + '</div>'
      + '<div class="setting" id="setDailyLimitMins">'
      + '<div class="txt"><div class="name" id="dailyMinsN"></div><div class="desc" id="dailyMinsD"></div></div>'
      + '<div class="choices dailyMins" id="dailyMinsChoices">'
      + '<button class="btn ghost" data-mins="15" aria-pressed="false">15</button>'
      + '<button class="btn ghost" data-mins="30" aria-pressed="false">30</button>'
      + '<button class="btn ghost" data-mins="45" aria-pressed="false">45</button>'
      + '<button class="btn ghost" data-mins="60" aria-pressed="false">60</button>'
      + '</div>'
      + '</div>'
      + '<div class="setting subjSetting" id="setSubjects">'
      + '<div class="txt"><div class="name" id="subjectsN"></div><div class="desc" id="subjectsD"></div></div>'
      + '</div>'
      + '<div class="subjRows" id="subjRows"></div>'
      + '<div class="setting" id="setLocale">'
      + '<div class="txt"><div class="name" id="localeN"></div><div class="desc" id="localeD"></div></div>'
      + '</div>'
      + '<div class="choices localeChoices" id="localeChoices"></div>'
      + '<div class="tip" id="parentalTip"></div>';
    var closeBtn = $('closeSheet');
    if (closeBtn && closeBtn.parentNode === panel) panel.insertBefore(v, closeBtn); else panel.appendChild(v);
    buildSubjRows();
    wireParentalControls();
    return v;
  }

  function onPinToggleClick() {
    var cfg = parentalCfg();
    if (!cfg.pinEnabled) {
      openPinView('setup1', function () { showParental(); }, function () { showParental(); });
    } else {
      cfg.pinEnabled = false; cfg.pinHash = ''; if (typeof saveDB === 'function') saveDB(); syncParentalRows();
    }
  }
  function wireParentalControls() {
    var tg = $('tgParentalPin'); if (tg && !tg._pcWired) { tg._pcWired = true; tg.addEventListener('click', onPinToggleClick); }
    var cb = $('pinChangeBtn'); if (cb && !cb._pcWired) { cb._pcWired = true; cb.addEventListener('click', function () { openPinView('setup1', function () { showParental(); }, function () { showParental(); }); }); }
    var tdl = $('tgDailyLimit');
    if (tdl && !tdl._pcWired) {
      tdl._pcWired = true;
      tdl.addEventListener('click', function () {
        var cfg = parentalCfg(); cfg.dailyLimitOn = !cfg.dailyLimitOn; if (cfg.dailyLimitOn) dlLast = Date.now();
        if (typeof saveDB === 'function') saveDB(); syncParentalRows();
      });
    }
    var dm = $('dailyMinsChoices');
    if (dm && !dm._pcWired) {
      dm._pcWired = true;
      dm.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-mins]'); if (!b) return;
        var cfg = parentalCfg(); cfg.dailyLimitMins = Number(b.dataset.mins);
        if (typeof saveDB === 'function') saveDB(); syncParentalRows();
      });
    }
    var sr = $('subjRows');
    if (sr && !sr._pcWired) {
      sr._pcWired = true;
      sr.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-subj]'); if (!b) return;
        var g = b.dataset.subj; var cfg = parentalCfg();
        var onCount = ['math', 'reading', 'science'].filter(function (k) { return cfg.subjects[k]; }).length;
        if (cfg.subjects[g] && onCount <= 1) { b.classList.remove('shakeNo'); void b.offsetWidth; b.classList.add('shakeNo'); return; } // al menos una activa
        cfg.subjects[g] = !cfg.subjects[g];
        if (typeof saveDB === 'function') saveDB();
        syncParentalRows(); applySubjectVisibility();
      });
    }
    var lc = $('localeChoices');
    if (lc && !lc._pcWired) { lc._pcWired = true; lc.addEventListener('click', function (e) { var b = e.target.closest('button[data-locale]'); if (!b) return; chooseLocale(b.dataset.locale); }); }
  }

  function syncParentalRows() {
    var cfg = parentalCfg();
    var tg = $('tgParentalPin'); if (tg) { tg.classList.toggle('on', cfg.pinEnabled); tg.setAttribute('aria-checked', String(cfg.pinEnabled)); }
    var pcr = $('pinChangeRow'); if (pcr) pcr.hidden = !cfg.pinEnabled;
    var tdl = $('tgDailyLimit'); if (tdl) { tdl.classList.toggle('on', cfg.dailyLimitOn); tdl.setAttribute('aria-checked', String(cfg.dailyLimitOn)); }
    var dmBox = $('dailyMinsChoices');
    if (dmBox) {
      dmBox.querySelectorAll('button[data-mins]').forEach(function (b) { var sel = Number(b.dataset.mins) === cfg.dailyLimitMins; b.classList.toggle('ghost', !sel); b.setAttribute('aria-pressed', String(sel)); });
      dmBox.classList.toggle('disabled', !cfg.dailyLimitOn);
    }
    ['math', 'reading', 'science'].forEach(function (g) { var t = $('tgSubj_' + g); if (t) { var on = cfg.subjects[g] !== false; t.classList.toggle('on', on); t.setAttribute('aria-checked', String(on)); } });
    syncLocaleChips();
  }
  function applyLangParental() {
    var t = L(); if (!t) return;
    var set = function (id, txt) { var el = $(id); if (el && txt != null) el.textContent = txt; };
    set('tabParentalTxt', t.parentalTitle);
    set('parentalTitleTxt', t.parentalTitle); set('parentalSubTxt', t.parentalSub);
    set('pinToggleN', t.pinToggleN); set('pinToggleD', t.pinToggleD);
    set('pinChangeLbl', t.pinToggleN); set('pinChangeBtn', t.pinChangeBtn);
    set('dailyToggleN', t.dailyToggleN); set('dailyToggleD', t.dailyToggleD);
    set('dailyMinsN', t.dailyMinsN); set('dailyMinsD', t.dailyMinsD);
    set('subjectsN', t.subjectsN); set('subjectsD', t.subjectsD);
    set('subjLbl_math', t.math); set('subjLbl_reading', t.read); set('subjLbl_science', t.sci);
    set('localeN', t.localeN); set('localeD', t.localeD);
    set('parentalTip', t.parentalTip);
    applyLangDaily();
  }
  function renderParental() { ensureParentalView(); applyLangParental(); renderLocaleChips(); syncParentalRows(); }

  function hideParental() {
    var pv = $('parentalView'); if (pv) pv.style.display = 'none';
    var tp = $('tabParental'); if (tp) tp.classList.remove('on');
  }
  function showParental() {
    ['progView', 'setView'].forEach(function (id) { var v = $(id); if (v) v.style.display = 'none'; });
    if (typeof eduHide === 'function') eduHide();
    ['tabProg', 'tabSet', 'tabEdu'].forEach(function (id) { var b = $(id); if (b) b.classList.remove('on'); });
    var tp = $('tabParental'); if (tp) tp.classList.add('on');
    var pv = ensureParentalView(); pv.style.display = 'block';
    renderParental();
  }

  function wireChrome() {
    var tp = $('tabProg'); if (tp && !tp._parentalWired) { tp._parentalWired = true; tp.addEventListener('click', hideParental); }
    var ts = $('tabSet'); if (ts && !ts._parentalWired) { ts._parentalWired = true; ts.addEventListener('click', hideParental); }
    var te = $('tabEdu'); if (te && !te._parentalWired) { te._parentalWired = true; te.addEventListener('click', hideParental); }
    var tPar = $('tabParental'); if (tPar && !tPar._parentalWired) { tPar._parentalWired = true; tPar.addEventListener('click', showParental); }
    var cs = $('closeSheet'); if (cs && !cs._parentalWired) { cs._parentalWired = true; cs.addEventListener('click', hideParental); }
    var sh = $('sheet'); if (sh && !sh._parentalWired) { sh._parentalWired = true; sh.addEventListener('click', function (e) { if (e.target === sh) hideParental(); }); }
    var lb = $('langBtn');
    if (lb && !lb._parentalWired) {
      lb._parentalWired = true;
      lb.addEventListener('click', function () {
        applyLangParental(); paintPinView();
        var pv = $('parentalView'); if (pv && pv.style.display !== 'none') renderParental();
      });
    }
  }

  /* ==================== init ==================== */
  function initDailyLimit() {
    document.addEventListener('visibilitychange', function () { dlLast = Date.now(); });
    setInterval(dailyTick, DL_TICK_MS);
  }
  function init() {
    try {
      ensureParentalTabButton();
      ensureParentalView();
      buildDailyOverlay();
      initDailyLimit();
      wireChrome();
      applyLangParental();
      renderLocaleChips();
      syncParentalRows();
      applySubjectVisibility();
    } catch (e) {}
  }

  /* ---------- API pública para tests/tooling (no expone el PIN en claro) ---------- */
  window.__parentalControls = {
    cfg: parentalCfg,
    hashPin: hashPin,
    setPin: function (pin) { var cfg = parentalCfg(); cfg.pinHash = hashPin(pin); cfg.pinEnabled = true; if (typeof saveDB === 'function') saveDB(); },
    clearPin: function () { var cfg = parentalCfg(); cfg.pinEnabled = false; cfg.pinHash = ''; if (typeof saveDB === 'function') saveDB(); },
    setSubject: function (g, on) { var cfg = parentalCfg(); if (!cfg.subjects || !(g in cfg.subjects)) return false; cfg.subjects[g] = !!on; if (typeof saveDB === 'function') saveDB(); applySubjectVisibility(); return true; },
    setDailyLimit: function (on, mins) { var cfg = parentalCfg(); cfg.dailyLimitOn = !!on; if (mins) cfg.dailyLimitMins = mins; if (typeof saveDB === 'function') saveDB(); },
    dailyState: function () { var p = P(); return p ? dailyState(p) : null; },
    triggerDailyLimit: triggerDailyLimit,
    hideDailyOverlay: hideDailyOverlay,
    grantDailyExtra: grantDailyExtra,
    openPinGate: openPinGate,
    openPinView: openPinView,
    showParental: showParental,
    locales: function () { return Object.keys(window.UI_LOCALES || {}); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { init(); } catch (e) {} });
  else { try { init(); } catch (e) {} }
})();
