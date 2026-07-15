"use strict";
/* ==================== FASE 4 · #28 pwa-tiendas ====================
   PWA a tiendas: TWA (Android, vía Bubblewrap) + wrapper iOS (vía Capacitor).
   Esta IIFE es la parte de RUNTIME que sí es código hoy (detección de contexto
   empaquetado + arranque directo por atajo). El resto del punto #28 -config de
   empaquetado, assetlinks reales, cuentas de tienda- vive en archivos hermanos
   de este directorio (twa-manifest.json, capacitor.config.json, well-known/,
   icons/, tools/) y en 28-pwa-tiendas.md (candado real + pasos externos).

   Patrón de extensión respetado:
   - Aditiva: IIFE al final de app.js, ejecuta DESPUÉS del bloque de init.
   - Envuelve window.paintInstall por REASIGNACIÓN (no toca applyLang() ni
     wirePWAInstall(); ambos siguen invocando al `paintInstall` global, que
     tras cargar este script apunta a la versión envuelta).
   - Define namespace nuevo: window.PEQUE_STORE (no pisa nada existente).
   - Usa document.getElementById directamente (no depende del alias privado
     `$` del módulo principal) y NUNCA usa .onclick sobre #langBtn/#tabSet.
   - Bajo file:// no toca red: matchMedia/navigator.standalone/document.referrer/
     location.search son todo lecturas locales sin I/O.
   - No anima nada (no introduce estilos ni CSS nuevo): sólo detección + lógica.
   ===================================================================== */
(function () {
  "use strict";
  if (window.PEQUE_STORE) return; // idempotente si el script se carga más de una vez

  function detectStandalone() {
    try {
      if (window.matchMedia && matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && matchMedia('(display-mode: fullscreen)').matches) return true;
    } catch (e) {}
    // iOS Safari "Añadir a inicio" / wrapper iOS con shim de navigator.standalone
    if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
    return false;
  }
  function detectTWA() {
    // Trusted Web Activity (Android): Chrome añade este referrer al abrir la TWA.
    try { return typeof document !== 'undefined' && document.referrer.indexOf('android-app://') === 0; }
    catch (e) { return false; }
  }
  function detectPlatform() {
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    return 'web';
  }
  function searchParam(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  function launchGameParam() {
    var g = searchParam('game');
    return (g === 'math' || g === 'reading' || g === 'science') ? g : null;
  }

  var isStandalone = detectStandalone();
  var isTWA = detectTWA();

  window.PEQUE_STORE = {
    isStandalone: isStandalone,
    isTWA: isTWA,
    isPackaged: isStandalone || isTWA,   // corre como app instalada (TWA/wrapper/A2HS), no en pestaña normal
    platform: detectPlatform(),
    launchSource: searchParam('src'),    // p.ej. 'twa' / 'pwa' si vino de start_url con ?src=
    launchGame: launchGameParam(),       // 'math'|'reading'|'science' si vino de manifest.shortcuts

    /* Utilidad PURA (sin red/I/O) para componer el contenido de
       well-known/assetlinks.json a partir de datos reales (applicationId +
       huellas SHA-256 del keystore de firma) que hoy no existen en este
       entorno. Sirve como referencia/tests; la generación real en disco la
       hace tools/gen-assetlinks.mjs (Node, fuera del navegador). */
    buildAssetLinks: function (packageName, sha256Fingerprints) {
      if (!packageName || !Array.isArray(sha256Fingerprints) || !sha256Fingerprints.length) return null;
      return [{
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: sha256Fingerprints
        }
      }];
    }
  };

  /* ---- Ocultar el pill "Instalar app" (#installBtn) cuando la app YA corre
     empaquetada (TWA/wrapper/standalone): el prompt de instalación del
     navegador es redundante ahí, y en TWA normalmente 'beforeinstallprompt'
     ni siquiera dispara; esto es defensa en profundidad, aditiva por
     reasignación sobre el global existente. */
  if (typeof window.paintInstall === 'function') {
    var __origPaintInstall = window.paintInstall;
    window.paintInstall = function () {
      __origPaintInstall();
      if (window.PEQUE_STORE.isPackaged) {
        var btn = document.getElementById('installBtn');
        if (btn) btn.classList.remove('show');
      }
    };
  }

  /* ---- Arranque directo por atajo de tienda: manifest.shortcuts (Android,
     long-press del icono) y Home Screen Quick Actions del wrapper iOS apuntan
     a la misma URL con ?game=math|reading|science. Si hay un perfil activo
     (mismo requisito que los botones .subject de la pantalla Home: ac() +
     startGame(), sin gate de adulto porque jugar nunca lo requiere), salta
     directo al juego. Si no hay perfil, se queda en la pantalla que init()
     ya decidió (selección de perfil), sin interferir con loadDB/applyLang/show. */
  function tryLaunchShortcut() {
    var g = window.PEQUE_STORE.launchGame;
    if (!g) return;
    if (typeof window.currentProfile !== 'function' || typeof window.startGame !== 'function') return;
    var p = window.currentProfile();
    if (!p) return;
    if (typeof window.ac === 'function') { try { window.ac(); } catch (e) {} }
    window.startGame(g);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    tryLaunchShortcut();
  } else {
    document.addEventListener('DOMContentLoaded', tryLaunchShortcut);
  }
})();
