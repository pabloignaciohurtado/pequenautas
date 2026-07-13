"use strict";
/* ==================== FASE 4 · #2: A/B testing de mecánicas (ab-testing) ====================
   Asigna a cada PERFIL una variante estable ('A' o 'B') derivada de un hash
   determinista de su `id` (persistida en `profile.ab` la primera vez que se
   calcula, para que sea estable incluso si el algoritmo de hash cambiara en
   el futuro). Registra esa variante en CADA evento de ronda (`profile.ev[].v`)
   y expone una comparación agregada A vs B dentro del Panel del educador ya
   existente (3ª pestaña del área de adultos).

   Mecánica bajo prueba (mínima y de bajo riesgo, ver justificación abajo):
   "Refuerzo visual extra" — Variante A (control): sin cambios, comportamiento
   actual de la app. Variante B (tratamiento): al acertar, además del pulso ya
   existente en #starBox (addStar(), sin tocar), se añade un segundo pulso
   breve sobre #profileChip (chip de perfil), solo transform/opacity, sujeto a
   S.anim y a prefers-reduced-motion. Hipótesis: un refuerzo visual algo más
   rico podría sostener mejor la atención/motivación sin cambiar la dificultad
   ni el ritmo del juego. El panel del educador permite comparar precisión al
   primer intento, tiempo medio y rondas jugadas entre ambos grupos.

   Por qué esta mecánica y no otra (para no romper los 19 tests existentes):
   - NO cambia S.totalRounds ni el nº de rondas por sesión: varios tests
     completan sesiones asumiendo el flujo estándar; variar la duración de
     sesión por variante rompería esos tests de forma no determinista (la
     variante depende de un hash sobre `profile.id`, que incluye Date.now(),
     por lo que un mismo test podría caer en A o en B según el momento en que
     corra). Por eso el efecto de la variante es 100% cosmético/audiovisual y
     nunca altera el nº de rondas, los ids del DOM, ni el flujo de clics.
   - NO reproduce audio adicional (para no pisar/cancelar con
     speechSynthesis.cancel() la narración ya en curso que dispara la propia
     app al acertar); solo anima transform/opacity sobre un elemento
     (#profileChip) que ninguna otra función anima hoy.

   100% ADITIVO y offline:
   - Envuelve window.afterCorrect (hook permitido por el patrón de extensión:
     window.speak/speakSeq/afterCorrect/nextRound) guardando la referencia
     original en `_afterCorrect` y llamándola siempre primero, sin tocar su
     cuerpo ni el de logRound/aggregate/renderEducator/renderProgress2.
   - La sección "Comparación A/B" se inyecta en runtime dentro de #eduBody
     (Panel del educador, ya existente) vía MutationObserver — mismo patrón
     que usa el Modo guiado padre-hijo con #stage y eval-pre-post con
     #progBody — por lo que aparece sin importar qué disparó el repintado de
     #eduBody (click en #tabEdu vía showEducator(), que ya existe y no se
     toca). No se define/edita renderEducator/showEducator/showTab/passGate.
   - i18n aditivo con Object.assign(UI.es,{...})/Object.assign(UI.en,{...}).
   - #langBtn se engancha solo con addEventListener (nunca .onclick=) para no
     romper la cadena de listeners ya registrados por otras extensiones.
   - Bajo file:// no se abre red: todo vive en profile.ab / profile.ev[].v +
     localStorage (mismo mecanismo de persistencia que DB, con fallback en
     memoria si falla). No se hace ninguna llamada fetch/XHR/WebSocket.

   Evidencia/marco: experimentación controlada de mecánicas de refuerzo en
   apps educativas infantiles (Lepper 1973, recompensas y motivación
   intrínseca) — la app ya mide precisión/ritmo por perfil (aggregate()); este
   paquete añade la capa de asignación de grupo + comparación, reutilizando
   esa misma telemetría.
   ============================================================================ */
(function(){
  "use strict";

  /* ---------- 1) Hash determinista + asignación estable por perfil ---------- */
  /* djb2 (xor variant), 32-bit sin signo. Determinista para una misma cadena. */
  function abHash(str){
    str = String(str == null ? '' : str);
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    }
    return h >>> 0;
  }

  /* Variante estable por perfil: se calcula una sola vez a partir del hash de
     profile.id y se persiste en profile.ab (no se recalcula después, aunque
     cambie el algoritmo de hash en una versión futura: la asignación ya hecha
     nunca se mueve de grupo). Perfiles sin `p` devuelven 'A' por defecto. */
  function abVariant(p){
    if(!p) return 'A';
    if(p.ab === 'A' || p.ab === 'B') return p.ab;
    var v = (abHash(p.id) % 2 === 0) ? 'A' : 'B';
    p.ab = v;
    try{ if(typeof saveDB === 'function') saveDB(); }catch(e){}
    return v;
  }

  /* ---------- 2) Mecánica bajo prueba: refuerzo visual extra (solo variante B) ---------- */
  function abFlourish(){
    try{
      if(typeof S === 'undefined' || !S.anim) return;
      var chip = (typeof $ === 'function') ? $('profileChip') : document.getElementById('profileChip');
      if(!chip) return;
      chip.classList.remove('abPulse');
      void chip.offsetWidth; /* reinicia la animación si se dispara seguido */
      chip.classList.add('abPulse');
      setTimeout(function(){ chip.classList.remove('abPulse'); }, 700);
    }catch(e){}
  }

  /* ---------- 3) Envoltura aditiva de afterCorrect (patrón permitido) ----------
     Etiqueta con `.v` el evento que la propia afterCorrect() original ya
     empujó a profile.ev[] (vía logRound()), sin tocar logRound ni afterCorrect. */
  if(!window.__abWrapped){
    window.__abWrapped = true;
    var _afterCorrect = window.afterCorrect;
    window.afterCorrect = function(key){
      var p = (typeof currentProfile === 'function') ? currentProfile() : null;
      var preLen = (p && p.ev) ? p.ev.length : -1;
      _afterCorrect(key);
      try{
        if(p && p.ev && p.ev.length > preLen){
          var v = abVariant(p);
          var last = p.ev[p.ev.length - 1];
          last.v = v;
          if(typeof saveDB === 'function') saveDB();
          if(v === 'B') abFlourish();
        }
      }catch(e){ /* nunca debe romper el flujo de juego */ }
    };
  }

  /* ---------- 4) i18n aditivo (no toca literales existentes) ---------- */
  Object.assign(UI.es, {
    abTitle:  'Comparación A/B',
    abSub:    'Mecánica en prueba: refuerzo visual extra al acertar (variante B). Variante asignada de forma estable por perfil.',
    abVarA:   'Variante A · control',
    abVarB:   'Variante B · refuerzo extra',
    abNoData: 'Aún no hay rondas con variante registrada. ¡A jugar para comparar!'
  });
  Object.assign(UI.en, {
    abTitle:  'A/B comparison',
    abSub:    'Mechanic under test: extra visual reinforcement on correct answers (variant B). Variant assigned stably per profile.',
    abVarA:   'Variant A · control',
    abVarB:   'Variant B · extra reinforcement',
    abNoData: 'No rounds with a recorded variant yet. Play a bit to compare!'
  });

  /* ---------- 5) Agregación por variante (reutiliza la forma de aggregate()) ---------- */
  function abAgg(ev){
    var rounds = ev.length;
    var first = ev.filter(function(e){ return e.ft; }).length;
    var avg = rounds ? ev.reduce(function(s,e){ return s + (e.ms||0); }, 0) / rounds : 0;
    return { rounds: rounds, firstRate: rounds ? first / rounds : 0, avg: avg };
  }

  /* ---------- 6) Construcción del bloque HTML (dentro de #eduBody) ---------- */
  function buildABSection(){
    var t = UI[S.lang] || UI.es;
    var profs = (typeof DB === 'object' && DB && DB.profiles) ? DB.profiles : [];
    if(!profs.length) return '';

    var byVariant = { A: { profiles:0, ev:[] }, B: { profiles:0, ev:[] } };
    profs.forEach(function(p){
      var v = abVariant(p);
      if(byVariant[v]) byVariant[v].profiles++;
      (p.ev || []).forEach(function(e){ if(e && (e.v === 'A' || e.v === 'B')) byVariant[e.v].ev.push(e); });
    });
    var tagged = byVariant.A.ev.length + byVariant.B.ev.length;

    var html = '<div id="abCompareBlock">'
      + '<div class="eduHead" id="abCompareHead">' + eduEsc(t.abTitle) + '</div>'
      + '<p class="sub abSub">' + eduEsc(t.abSub) + '</p>';

    if(!tagged){
      html += '<div class="empty" id="abCompareEmpty">' + eduEsc(t.abNoData) + '</div>';
    } else {
      html += '<div class="abGrid">';
      ['A','B'].forEach(function(v){
        var a = abAgg(byVariant[v].ev);
        var secs = (a.avg / 1000).toFixed(1);
        var label = v === 'A' ? t.abVarA : t.abVarB;
        html += '<div class="abCol abCol' + v + '">'
          + '<div class="abColHead">' + eduEsc(label) + '</div>'
          + '<div class="statgrid">'
            + '<div class="stat"><div class="n">' + byVariant[v].profiles + '</div><div class="l">' + eduEsc(t.eduChildren) + '</div></div>'
            + '<div class="stat"><div class="n">' + a.rounds + '</div><div class="l">' + eduEsc(t.stRounds) + '</div></div>'
            + '<div class="stat"><div class="n">' + Math.round(a.firstRate * 100) + '%</div><div class="l">' + eduEsc(t.stFirst) + '</div></div>'
            + '<div class="stat"><div class="n">' + secs + 's</div><div class="l">' + eduEsc(t.stTime) + '</div></div>'
          + '</div>'
        + '</div>';
      });
      html += '</div>';
    }

    html += '<div class="abChildren" id="abChildren">';
    profs.forEach(function(p){
      var v = abVariant(p);
      html += '<span class="abChip ab' + v + '">' + eduEsc(p.avatar) + ' ' + eduEsc(p.name) + ' · ' + v + '</span>';
    });
    html += '</div>';

    html += '</div>'; /* /#abCompareBlock */
    return html;
  }

  /* ---------- 7) Pintado idempotente + observador de #eduBody ----------
     Mismo patrón que la sección de eval-pre-post en #progBody: renderEducator()
     ya existente hace `host.innerHTML = html;` cada vez que se abre/actualiza
     el panel; observamos ese repintado y añadimos nuestro bloque AL FINAL,
     sin tocar renderEducator(). Guardas contra el caso "sin datos" y contra
     el auto-disparo del propio insertAdjacentHTML sobre el observer. */
  function paintAB(){
    var host = (typeof $ === 'function') ? $('eduBody') : document.getElementById('eduBody');
    if(!host) return;
    if(host.querySelector('.empty')) return;            /* sin datos globales: nada que comparar */
    if(host.querySelector('#abCompareHead')) return;     /* ya pintado para este render */
    var html = buildABSection();
    if(html) host.insertAdjacentHTML('beforeend', html);
  }

  function refreshAB(){
    var host = (typeof $ === 'function') ? $('eduBody') : document.getElementById('eduBody');
    if(!host) return;
    var blk = host.querySelector('#abCompareBlock');
    if(blk) blk.remove();
    paintAB();
  }

  var __abObsBound = false;
  function bindABObserver(){
    var host = (typeof $ === 'function') ? $('eduBody') : document.getElementById('eduBody');
    if(!host || __abObsBound) return;
    __abObsBound = true;
    var obs = new MutationObserver(function(){ paintAB(); });
    obs.observe(host, { childList: true });
  }

  /* #langBtn: SOLO addEventListener (nunca .onclick=) para no romper la
     cadena de listeners ya registrados por otras extensiones (regla del
     patrón de extensión). */
  var __lb = (typeof $ === 'function') ? $('langBtn') : document.getElementById('langBtn');
  if(__lb) __lb.addEventListener('click', function(){ requestAnimationFrame(refreshAB); });

  bindABObserver();

  /* ---------- 8) API pública (integración / tests) ---------- */
  window.abVariant = abVariant;
  window.__ab = {
    hash: abHash,
    variant: abVariant,
    mechanic: 'visual-reinforcement-v1',
    paint: paintAB,
    refresh: refreshAB,
    flourish: abFlourish /* expuesto para forzar el pulso en tests, sin depender de S.anim/timers reales */
  };
})();
