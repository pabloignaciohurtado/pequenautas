/* Fase 4 #48 - Avatares papercraft.
   Este modulo NO pinta: solo etiqueta cada nodo de avatar con
   data-pa48="<nombre>" para que spec.css le aplique el retrato.

   Un avatar puede llegar de dos formas segun el orden de ejecucion:
     a) todavia con el emoji original de app.js en textContent, o
     b) ya convertido por el modulo #31 en un SVG plano, que deja el
        rastro data-pa31-swapped="<nombre>" en el propio nodo.
   Se leen las dos, asi que el resultado es el mismo caiga como caiga la
   carrera entre #31 y #48.

   Aditivo: no se modifica app.js ni index.html ni STORE_KEY. */
(function () {
  "use strict";

  function cp(n) { return String.fromCodePoint(n); }

  // AVATARS de app.js (L22), en orden: zorro, panda, conejo, rana, leon,
  // tigre, pinguino, koala, mono, cerdo.
  var BY_EMOJI = {};
  BY_EMOJI[cp(0x1F98A)] = "zorro";
  BY_EMOJI[cp(0x1F43C)] = "panda";
  BY_EMOJI[cp(0x1F430)] = "conejo";
  BY_EMOJI[cp(0x1F438)] = "rana";
  BY_EMOJI[cp(0x1F981)] = "leon";
  BY_EMOJI[cp(0x1F42F)] = "tigre";
  BY_EMOJI[cp(0x1F427)] = "pinguino";
  BY_EMOJI[cp(0x1F428)] = "koala";
  BY_EMOJI[cp(0x1F435)] = "mono";
  BY_EMOJI[cp(0x1F437)] = "cerdo";

  var KNOWN = {};
  for (var k in BY_EMOJI) { if (BY_EMOJI.hasOwnProperty(k)) KNOWN[BY_EMOJI[k]] = 1; }

  var TARGETS = ".avopt,.av,.eduAv";

  function nameOf(el) {
    // 1) rastro del modulo #31 (ya sustituido por SVG)
    var n = el.getAttribute("data-pa31-swapped");
    if (n && KNOWN[n]) return n;
    // 2) emoji original de app.js
    var t = (el.textContent || "").trim();
    if (BY_EMOJI[t]) return BY_EMOJI[t];
    // 3) el nodo pudo perder el texto tras la sustitucion; conservar lo ya puesto
    var prev = el.getAttribute("data-pa48");
    return (prev && KNOWN[prev]) ? prev : null;
  }

  function tag(el) {
    if (!el || el.nodeType !== 1) return;
    var n = nameOf(el);
    if (!n) return;
    if (el.getAttribute("data-pa48") !== n) el.setAttribute("data-pa48", n);
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    try {
      if (root.matches && root.matches(TARGETS)) tag(root);
      var list = root.querySelectorAll ? root.querySelectorAll(TARGETS) : [];
      for (var i = 0; i < list.length; i++) tag(list[i]);
    } catch (e) {}
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; scan(document.body); }, 0);
  }

  function boot() {
    if (!document.body) { setTimeout(boot, 30); return; }
    scan(document.body);
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === "attributes") {
            // #31 acaba de marcar un nodo: etiquetarlo sin barrer todo
            tag(m.target);
          } else {
            schedule();
            return;
          }
        }
      }).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["data-pa31-swapped"]
      });
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
