/* ==================== Fase 4 · Mejora #23 "modo-aula" ====================
   Modo aula (LOCAL primero): un docente/adulto crea uno o más GRUPOS
   dentro del mismo dispositivo, asigna qué perfiles (niños) pertenecen a
   cada grupo y qué materias son el FOCO del grupo (Números/Letras/
   Animales), y ve un panel de cohorte agregado — mismo estilo visual y
   mismas fuentes de datos que el "Panel educador" ya integrado (#eduView/
   renderEducator), pero acotado a los miembros del grupo seleccionado en
   vez de TODOS los perfiles del dispositivo.

   Por qué "local primero": el backend Supabase está DISEÑADO pero OFF
   (window.PEQUE_FLAGS.backendSync=false, ver docs/backend-supabase.md).
   Este módulo no depende de red en ningún punto — los grupos, sus
   miembros y el "foco" de materias se guardan en DB.classroom vía la
   saveDB()/loadDB() ya existentes (localStorage con fallback en
   memoria). Cuando backendSync se active, DB.classroom es la misma forma
   de datos que se sincronizaría (ver integration.md §6).

   "Asigna materias/foco" es, a propósito, un dato de REPORTE, no un
   candado de juego: no oculta ni bloquea ninguna de las 3 materias en la
   pantalla Home (eso mantendría a #23 fuera de riesgo de romper el smoke
   test que espera `.subject` con 3 elementos siempre). El foco solo
   decide qué barras de precisión se muestran en el panel de cohorte —
   documentado como decisión de diseño consciente en integration.md §5.

   Patrón 100% aditivo (igual que AudioBank / bilingüe / co-juego / álbum
   de logros / informe semanal / metas semanales ya integrados en ship/):
   - Nueva 4ª pestaña dentro del área de adultos ya gateada (#tabAula),
     creada con document.createElement e insertada dentro de `.tabs`
     (mismo contenedor que ya usan #tabProg/#tabSet/#tabEdu), sin
     reescribir su HTML.
   - Nueva vista #aulaView, hermana de #eduView, creada del mismo modo.
   - Reutiliza aggregate()/eduEsc()/eduFaceOf()/eduSpark() ya definidas
     por el "Panel educador" (ship/app.js) en vez de reimplementarlas —
     con guardas typeof por si ese módulo no estuviera integrado en un
     ship distinto.
   - i18n aditivo con Object.assign(UI.es,{...}) / Object.assign(UI.en,{...}).
   - addEventListener SIEMPRE (nunca reasigna .onclick) sobre #langBtn y
     #tabSet, para no romper sus cadenas ya existentes. Para las demás
     pestañas (#tabProg/#tabEdu/#tabAula) también se usa addEventListener
     en vez de .onclick=, así conviven sin pisarse con cualquier otro
     módulo que ya haya hecho .onclick= sobre ellas (p.ej. el propio
     "Panel educador" del ship base).
   - No toca init() ni applyLang(). No reescribe ningún cuerpo de función
     existente. Animaciones solo transform/opacity (spec.css), respeta
     prefers-reduced-motion. No abre red bajo file:// ni en ningún
     entorno: todo el cálculo es local sobre DB, exportación CSV vía
     Blob local (mismo mecanismo que ya usa eduExportCSV). Texto de
     usuario (nombre de grupo) escapado con eduEsc()/fallback local.
   Evidencia: agrupar por aula/cohorte y ver progreso agregado es un
   patrón habitual en herramientas de aula (Seesaw, ClassDojo, Google
   Classroom) — aquí se ofrece 100% local y sin cuentas, coherente con la
   postura COPPA-friendly ya documentada en docs/backend-supabase.md. */
(function () {
  "use strict";

  var SUBJECTS = ['math', 'reading', 'science'];

  /* ---------- i18n aditivo (no toca literales UI.es/UI.en existentes) ---------- */
  if (typeof UI === 'object' && UI.es && UI.en) {
    Object.assign(UI.es, {
      tabAula: 'Aula',
      aulaTitle: 'Modo aula',
      aulaSub: 'Grupos y panel de cohorte — todo local en este dispositivo.',
      aulaGroupsLbl: 'Grupos',
      aulaNewGroupBtn: '+ Nuevo grupo',
      aulaNamePH: 'Nombre del grupo',
      aulaNoGroups: 'Aún no hay grupos. Crea uno para empezar.',
      aulaMembersLbl: 'Niños en el grupo',
      aulaNoProfiles: 'Crea perfiles de niños primero (pantalla ¿Quién juega?).',
      aulaFocusLbl: 'Materias de foco',
      aulaCohortLbl: 'Panel de cohorte',
      aulaNoCohortData: 'Sin datos aún para este grupo. Agrega niños y que jueguen una ronda.',
      aulaExportBtn: 'Exportar CSV del grupo',
      aulaDeleteBtn: 'Eliminar grupo',
      aulaDeleteConfirm: '¿Seguro? Toca de nuevo para eliminar',
      aulaGroupOf: 'Grupo de'
    });
    Object.assign(UI.en, {
      tabAula: 'Classroom',
      aulaTitle: 'Classroom mode',
      aulaSub: 'Groups and cohort panel — all local on this device.',
      aulaGroupsLbl: 'Groups',
      aulaNewGroupBtn: '+ New group',
      aulaNamePH: 'Group name',
      aulaNoGroups: 'No groups yet. Create one to get started.',
      aulaMembersLbl: 'Children in this group',
      aulaNoProfiles: 'Create child profiles first (the "Who is playing?" screen).',
      aulaFocusLbl: 'Focus subjects',
      aulaCohortLbl: 'Cohort panel',
      aulaNoCohortData: 'No data yet for this group. Add children and have them play a round.',
      aulaExportBtn: 'Export group CSV',
      aulaDeleteBtn: 'Delete group',
      aulaDeleteConfirm: 'Sure? Tap again to delete',
      aulaGroupOf: 'Group of'
    });
  }

  function L() { var lang = (typeof S === 'object' && S) ? S.lang : 'es'; return (typeof UI === 'object') ? (UI[lang] || UI.es) : null; }
  function esc(s) { return (typeof eduEsc === 'function') ? eduEsc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function agg(evArr) {
    if (typeof aggregate === 'function') return aggregate({ ev: evArr });
    var rounds = evArr.length, first = evArr.filter(function (e) { return e.ft; }).length;
    return { rounds: rounds, firstRate: rounds ? first / rounds : 0, avg: 0, byGame: { math: { r: 0, err: 0 }, reading: { r: 0, err: 0 }, science: { r: 0, err: 0 } }, topFails: [] };
  }
  function faceOf(k) { return (typeof eduFaceOf === 'function') ? eduFaceOf(k) : k; }
  function sparkOf(ev) { return (typeof eduSpark === 'function') ? eduSpark(ev) : ''; }

  /* ---------- modelo de datos: DB.classroom (aditivo sobre DB, persistido por saveDB() ya existente) ---------- */
  function ensureClassroom() {
    if (typeof DB !== 'object' || !DB) return { groups: [], currentGroupId: null };
    if (!DB.classroom || typeof DB.classroom !== 'object') DB.classroom = { groups: [], currentGroupId: null };
    if (!Array.isArray(DB.classroom.groups)) DB.classroom.groups = [];
    if (typeof DB.classroom.currentGroupId === 'undefined') DB.classroom.currentGroupId = null;
    return DB.classroom;
  }
  function ensureFocus(g) {
    if (!g.focus || typeof g.focus !== 'object') g.focus = { math: true, reading: true, science: true };
    SUBJECTS.forEach(function (s) { if (typeof g.focus[s] !== 'boolean') g.focus[s] = true; });
    return g.focus;
  }
  function groupNewId() { return 'aula' + Date.now().toString(36) + Math.floor(Math.random() * 1000); }
  function currentGroup() {
    var c = ensureClassroom();
    var g = c.groups.find(function (x) { return x.id === c.currentGroupId; });
    return g || null;
  }
  function createGroup(name) {
    var c = ensureClassroom();
    name = (name || '').trim();
    if (!name) { var t = L(); name = ((t && t.aulaGroupOf) || 'Grupo de') + ' ' + (c.groups.length + 1); }
    var g = { id: groupNewId(), name: name, memberIds: [], focus: { math: true, reading: true, science: true } };
    c.groups.push(g);
    c.currentGroupId = g.id;
    if (typeof saveDB === 'function') saveDB();
    return g;
  }
  function deleteGroup(id) {
    var c = ensureClassroom();
    c.groups = c.groups.filter(function (g) { return g.id !== id; });
    if (c.currentGroupId === id) c.currentGroupId = c.groups.length ? c.groups[0].id : null;
    if (typeof saveDB === 'function') saveDB();
  }
  function toggleMember(gid, pid) {
    var c = ensureClassroom();
    var g = c.groups.find(function (x) { return x.id === gid; }); if (!g) return;
    if (!Array.isArray(g.memberIds)) g.memberIds = [];
    var i = g.memberIds.indexOf(pid);
    if (i >= 0) g.memberIds.splice(i, 1); else g.memberIds.push(pid);
    if (typeof saveDB === 'function') saveDB();
  }
  function toggleFocus(gid, subject) {
    var c = ensureClassroom();
    var g = c.groups.find(function (x) { return x.id === gid; }); if (!g) return;
    var f = ensureFocus(g);
    f[subject] = !f[subject];
    if (typeof saveDB === 'function') saveDB();
  }
  function groupMembers(g) {
    var profs = (typeof DB === 'object' && DB && Array.isArray(DB.profiles)) ? DB.profiles : [];
    return profs.filter(function (p) { return g.memberIds.indexOf(p.id) >= 0; });
  }

  /* ---------- CSV local (Blob), mismo guard anti-fórmula que eduExportCSV ---------- */
  function csvCell(c) {
    var s = String(c == null ? '' : c);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportGroupCSV(g) {
    var members = groupMembers(g);
    var rows = [['group', 'child', 'avatar', 'game', 'item', 'first_try', 'attempts', 'ms', 'assisted']];
    members.forEach(function (p) {
      (p.ev || []).forEach(function (e) {
        rows.push([g.name, p.name, p.avatar, e.g, e.k, e.ft, e.at, e.ms, e.as]);
      });
    });
    var csv = rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
    try {
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'pequenautas-aula-' + (g.name || 'grupo').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { /* silencioso: no debe romper la UI si Blob/URL no está disponible */ }
  }

  /* ---------- construcción del DOM: pestaña #tabAula + vista #aulaView ---------- */
  var tabBtn = null, viewEl = null, armedDelete = null, armedTimer = null;

  function ensureAulaUI() {
    var tabs = document.querySelector('#sheet .tabs');
    if (tabs && !$('tabAula')) {
      tabBtn = document.createElement('button');
      tabBtn.type = 'button'; tabBtn.className = 'tab'; tabBtn.id = 'tabAula';
      tabBtn.innerHTML = '🏫 <span id="tabAulaTxt"></span>';
      tabs.appendChild(tabBtn);
    } else if (!tabBtn) { tabBtn = $('tabAula'); }

    if (!$('aulaView')) {
      var anchor = $('eduView') || $('adultView');
      if (anchor && anchor.parentNode) {
        viewEl = document.createElement('div');
        viewEl.id = 'aulaView'; viewEl.style.display = 'none';
        viewEl.innerHTML =
          '<h3 id="aulaTitle"></h3>' +
          '<p class="sub" id="aulaSub"></p>' +
          '<div id="aulaBody"></div>';
        anchor.parentNode.insertBefore(viewEl, anchor.nextSibling);
      }
    } else { viewEl = $('aulaView'); }
  }

  /* ---------- render ---------- */
  function groupChipsHtml(c, t) {
    if (!c.groups.length) return '';
    return '<div class="aulaGroupChips" id="aulaGroupChips">' + c.groups.map(function (g) {
      var on = g.id === c.currentGroupId;
      return '<button class="aulaGroupChip' + (on ? ' on' : '') + '" type="button" data-gid="' + esc(g.id) + '" aria-pressed="' + on + '">' + esc(g.name) + '</button>';
    }).join('') + '</div>';
  }
  function memberListHtml(g, t) {
    var profs = (typeof DB === 'object' && DB && Array.isArray(DB.profiles)) ? DB.profiles : [];
    if (!profs.length) return '<div class="empty">' + t.aulaNoProfiles + '</div>';
    return '<div class="aulaMembers" id="aulaMemberList">' + profs.map(function (p) {
      var on = g.memberIds.indexOf(p.id) >= 0;
      return '<button class="aulaMemberChip' + (on ? ' on' : '') + '" type="button" data-pid="' + esc(p.id) + '" aria-pressed="' + on + '">' +
        '<span class="av">' + esc(p.avatar) + '</span><span class="nm">' + esc(p.name) + '</span></button>';
    }).join('') + '</div>';
  }
  function focusChipHtml(g, t) {
    var f = ensureFocus(g);
    var labels = { math: t.math, reading: t.read, science: t.sci };
    return '<div class="choices aulaFocus" id="aulaFocusChoices">' + SUBJECTS.map(function (s) {
      var on = !!f[s];
      return '<button class="btn' + (on ? '' : ' ghost') + '" type="button" data-focus="' + s + '" aria-pressed="' + on + '">' + esc(labels[s]) + '</button>';
    }).join('') + '</div>';
  }
  function cohortStatsHtml(g, t) {
    var members = groupMembers(g);
    var allEv = [];
    members.forEach(function (p) { (p.ev || []).forEach(function (e) { allEv.push(e); }); });
    if (!members.length || !allEv.length) return '<div class="empty">' + t.aulaNoCohortData + '</div>';
    var a = agg(allEv);
    var secs = (a.avg / 1000).toFixed(1);
    var gname = { math: t.math, reading: t.read, science: t.sci };
    var f = ensureFocus(g);
    var html = '<div class="statgrid">' +
      '<div class="stat"><div class="n">' + members.length + '</div><div class="l">' + t.eduChildren + '</div></div>' +
      '<div class="stat"><div class="n">' + a.rounds + '</div><div class="l">' + t.stRounds + '</div></div>' +
      '<div class="stat"><div class="n">' + Math.round(a.firstRate * 100) + '%</div><div class="l">' + t.stFirst + '</div></div>' +
      '<div class="stat"><div class="n">' + secs + 's</div><div class="l">' + t.stTime + '</div></div>' +
      '</div>';
    SUBJECTS.forEach(function (gk) {
      if (!f[gk]) return; // solo materias marcadas como foco del grupo
      var gg = a.byGame[gk];
      if (gg && gg.r > 0) {
        var acc = Math.round((1 - gg.err / gg.r) * 100);
        var col = gk === 'math' ? 'var(--math)' : gk === 'reading' ? 'var(--read)' : 'var(--sci)';
        html += '<div class="bar"><div class="lab"><span>' + gname[gk] + '</span><span>' + acc + '% ' + t.mAcc.toLowerCase() + '</span></div><div class="track"><div class="fillb" style="width:' + acc + '%;background:' + col + '"></div></div></div>';
      }
    });
    if (a.topFails.length) {
      html += '<div class="eduHead">' + t.stFocus + '</div>';
      a.topFails.forEach(function (fEntry) {
        var face = faceOf(fEntry.k), em = face.split(' ')[0], rest = face.split(' ').slice(1).join(' ');
        html += '<div class="failitem"><span class="fx">' + em + '</span><span>' + rest + '</span><span class="fc">' + fEntry.c + ' ✗</span></div>';
      });
    }
    html += '<div class="eduHead">' + t.eduPerChild + '</div>';
    members.forEach(function (p) {
      var a2 = agg(p.ev || []), ev = p.ev || [];
      var sub = ev.length ? (a2.rounds + ' ' + t.stRounds.toLowerCase() + ' · ' + Math.round(a2.firstRate * 100) + '% ' + t.stFirst.toLowerCase()) : t.eduNoRounds;
      html += '<div class="eduChild">' +
        '<span class="eduAv">' + esc(p.avatar) + '</span>' +
        '<div class="eduMeta"><div class="eduName">' + esc(p.name) + '</div><div class="eduChildSub">' + sub + '</div></div>' +
        (ev.length ? sparkOf(ev) : '') +
        '</div>';
    });
    return html;
  }

  function renderAula() {
    var t = L(); if (!t) return;
    ensureAulaUI();
    var ttl = $('aulaTitle'); if (ttl) ttl.textContent = t.aulaTitle;
    var sub = $('aulaSub'); if (sub) sub.textContent = t.aulaSub;
    var host = $('aulaBody'); if (!host) return;
    var c = ensureClassroom();
    var g = currentGroup();

    var html = '<div class="eduHead">' + t.aulaGroupsLbl + '</div>';
    html += groupChipsHtml(c, t);
    html += '<div class="aulaNewRow">' +
      '<input class="nameinput" id="aulaNameInput" maxlength="24" placeholder="' + esc(t.aulaNamePH) + '">' +
      '<button class="btn ghost" id="aulaCreateBtn" type="button">' + esc(t.aulaNewGroupBtn) + '</button>' +
      '</div>';

    if (!g) {
      html += '<div class="empty">' + t.aulaNoGroups + '</div>';
      host.innerHTML = html;
      wireCreate();
      return;
    }

    html += '<div class="eduHead">' + t.aulaMembersLbl + '</div>' + memberListHtml(g, t);
    html += '<div class="eduHead">' + t.aulaFocusLbl + '</div>' + focusChipHtml(g, t);
    html += '<div class="eduHead">' + t.aulaCohortLbl + '</div>' + cohortStatsHtml(g, t);
    html += '<button class="btn ghost" id="aulaExportBtn" type="button" style="width:100%;margin-top:14px">' + esc(t.aulaExportBtn) + '</button>';
    html += '<button class="btn ghost" id="aulaDeleteBtn" type="button" style="width:100%;margin-top:10px">' + esc(t.aulaDeleteBtn) + '</button>';
    host.innerHTML = html;
    wireAll(g);
  }

  /* ---------- wiring (delegado, se re-cablea en cada render porque host.innerHTML se reemplaza) ---------- */
  function armDelete(btn, t) {
    if (armedTimer) { clearTimeout(armedTimer); armedTimer = null; }
    armedDelete = btn.getAttribute('data-gid') || null;
    btn.classList.add('armed');
    btn.textContent = t.aulaDeleteConfirm;
    armedTimer = setTimeout(function () { disarmDelete(btn, t); }, 3000);
  }
  function disarmDelete(btn, t) {
    armedDelete = null;
    if (armedTimer) { clearTimeout(armedTimer); armedTimer = null; }
    if (btn) { btn.classList.remove('armed'); btn.textContent = t.aulaDeleteBtn; }
  }

  function wireCreate() {
    var btn = $('aulaCreateBtn');
    if (btn) btn.addEventListener('click', function () {
      var inp = $('aulaNameInput');
      createGroup(inp ? inp.value : '');
      renderAula();
    });
    var inp = $('aulaNameInput');
    if (inp) inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { createGroup(inp.value); renderAula(); }
    });
  }
  function wireAll(g) {
    wireCreate();
    var chips = $('aulaGroupChips');
    if (chips) chips.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-gid]'); if (!b) return;
      ensureClassroom().currentGroupId = b.getAttribute('data-gid');
      if (typeof saveDB === 'function') saveDB();
      renderAula();
    });
    var mem = $('aulaMemberList');
    if (mem) mem.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-pid]'); if (!b) return;
      toggleMember(g.id, b.getAttribute('data-pid'));
      renderAula();
    });
    var foc = $('aulaFocusChoices');
    if (foc) foc.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-focus]'); if (!b) return;
      toggleFocus(g.id, b.getAttribute('data-focus'));
      renderAula();
    });
    var exp = $('aulaExportBtn');
    if (exp) exp.addEventListener('click', function () { exportGroupCSV(g); });
    var del = $('aulaDeleteBtn');
    if (del) {
      del.setAttribute('data-gid', g.id);
      del.addEventListener('click', function () {
        var t = L(); if (!t) return;
        if (armedDelete === g.id) { disarmDelete(del, t); deleteGroup(g.id); renderAula(); }
        else { armDelete(del, t); }
      });
    }
  }

  /* ---------- pestañas: mostrar/ocultar (mismo patrón que showEducator/eduHide del ship base) ---------- */
  function aulaHide() {
    var v = $('aulaView'); if (v) v.style.display = 'none';
    var tb = $('tabAula'); if (tb) tb.classList.remove('on');
  }
  function showAula() {
    var tp = $('tabProg'), ts = $('tabSet'), te = $('tabEdu'), ta = $('tabAula');
    if (tp) tp.classList.remove('on'); if (ts) ts.classList.remove('on'); if (te) te.classList.remove('on');
    if (ta) ta.classList.add('on');
    var pv = $('progView'), sv = $('setView'), ev = $('eduView'), av = $('aulaView');
    if (pv) pv.style.display = 'none'; if (sv) sv.style.display = 'none'; if (ev) ev.style.display = 'none';
    if (av) av.style.display = 'block';
    renderAula();
  }
  function applyAulaChrome() {
    var t = L(); if (!t) return;
    var e = $('tabAulaTxt'); if (e) e.textContent = t.tabAula;
  }

  function wireChrome() {
    ensureAulaUI();
    var tb = $('tabAula');
    if (tb && !tb._aulaWired) { tb._aulaWired = true; tb.addEventListener('click', showAula); }
    var tp = $('tabProg');
    if (tp && !tp._aulaWired) { tp._aulaWired = true; tp.addEventListener('click', aulaHide); }
    var te = $('tabEdu');
    if (te && !te._aulaWired) { te._aulaWired = true; te.addEventListener('click', aulaHide); }
    var ts = $('tabSet');
    if (ts && !ts._aulaWired) { ts._aulaWired = true; ts.addEventListener('click', aulaHide); }
    var cs = $('closeSheet');
    if (cs && !cs._aulaWired) { cs._aulaWired = true; cs.addEventListener('click', aulaHide); }
    var sh = $('sheet');
    if (sh && !sh._aulaWired) { sh._aulaWired = true; sh.addEventListener('click', function (e) { if (e.target === sh) aulaHide(); }); }
    var lb = $('langBtn');
    if (lb && !lb._aulaWired) {
      lb._aulaWired = true;
      lb.addEventListener('click', function () {
        applyAulaChrome();
        var av = $('aulaView'); if (av && av.style.display !== 'none') renderAula();
      });
    }
    applyAulaChrome();
  }

  function init() {
    try { ensureClassroom(); ensureAulaUI(); wireChrome(); } catch (e) {}
  }

  /* ---------- API pública para tests/tooling (no expone datos sensibles) ---------- */
  window.PequeAula = {
    ensureClassroom: ensureClassroom,
    groups: function () { return ensureClassroom().groups.slice(); },
    currentGroup: currentGroup,
    createGroup: createGroup,
    deleteGroup: deleteGroup,
    toggleMember: toggleMember,
    toggleFocus: toggleFocus,
    members: function (gid) { var c = ensureClassroom(); var g = c.groups.find(function (x) { return x.id === gid; }); return g ? groupMembers(g) : []; },
    selectGroup: function (gid) { ensureClassroom().currentGroupId = gid; if (typeof saveDB === 'function') saveDB(); },
    render: renderAula,
    exportCSV: exportGroupCSV
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { init(); } catch (e) {} });
  else { try { init(); } catch (e) {} }
})();
