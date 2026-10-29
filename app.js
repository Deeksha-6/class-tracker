'use strict';
/* Class Pouch — groups for classes and hobbies (art, dance, sports, music…).
   Each group has its own members, sessions, attendance, fees, gallery and books.
   Prototype: all data is stored in this browser (IndexedDB). Use Books → Backup to save a copy. */

const COL = ['#E4572E', '#2E86AB', '#76B041', '#F2A541', '#8E5BD9', '#E0568F', '#1FA39A'];
const METHODS = ['Cash', 'Card', 'Bank transfer', 'Zelle', 'Venmo', 'UPI', 'Other'];
const EXPENSE_CATS = ['Supplies', 'Rent', 'Utilities', 'Marketing', 'Salary', 'Other'];

const S = { students: [], classes: [], attendance: [], payments: [], expenses: [], works: [] };
const ALL = { groups: [], students: [], classes: [], attendance: [], payments: [], expenses: [], works: [] };
const ACTIVITIES = {
  art:      { label: 'Art',      member: 'Student', session: 'Class',    media: 'Gallery', work: 'artwork', color: '#E4572E' },
  dance:    { label: 'Dance',    member: 'Dancer',  session: 'Class',    media: 'Moments', work: 'photo',   color: '#E0568F' },
  sports:   { label: 'Sports',   member: 'Player',  session: 'Practice', media: 'Moments', work: 'photo',   color: '#2E86AB' },
  music:    { label: 'Music',    member: 'Student', session: 'Lesson',   media: 'Moments', work: 'photo',   color: '#8E5BD9' },
  fitness:  { label: 'Fitness',  member: 'Member',  session: 'Session',  media: 'Moments', work: 'photo',   color: '#76B041' },
  tutoring: { label: 'Tutoring', member: 'Student', session: 'Lesson',   media: 'Work',    work: 'work',    color: '#F2A541' },
  other:    { label: 'Other',    member: 'Member',  session: 'Session',  media: 'Gallery', work: 'photo',   color: '#1FA39A' },
};
let G = null, T = ACTIVITIES.art; // current group and its terms
const lc = (w) => w.toLowerCase();
const pl = (w) => /(s|sh|ch)$/i.test(w) ? w + 'es' : w + 's';
const ui = { group: null, preview: null, tab: 'home', studentId: null, q: '', payFilter: '', artFilter: '', month: '' };
const urls = new Map(); // work id -> object URL

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fd = (d) => d ? new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
const sum = (a) => a.reduce((t, n) => t + (Number(n) || 0), 0);
const byName = (a, b) => a.name.localeCompare(b.name);
const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');
let CUR = '$', TEACHER = '';
try { CUR = localStorage.getItem('ct-currency') || '$'; TEACHER = localStorage.getItem('ct-name') || ''; ui.group = localStorage.getItem('cp-group'); } catch (e) { /* storage unavailable */ }
function remember(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const fmtT = (t) => { if (!/^\d\d:\d\d$/.test(t || '')) return t || ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
const timeRange = (c) => c.start ? fmtT(c.start) + (c.end ? ' – ' + fmtT(c.end) : '') : (c.time || '');
const byStart = (a, b) => (a.start || a.time || '').localeCompare(b.start || b.time || '');
const daysSince = (d) => Math.floor((new Date(today() + 'T12:00') - new Date(d + 'T12:00')) / 864e5);
function classStatus(c) {
  const t = today();
  if (c.date < t) return 'done';
  if (c.date > t || !c.start) return 'upcoming';
  const n = nowHM();
  if (n < c.start) return 'upcoming';
  if (!c.end || n <= c.end) return 'live';
  return 'done';
}
const STATUS = { live: ['In progress', 'live'], upcoming: ['Upcoming', 'up'], done: ['Finished', 'done'] };
const ic = (d) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  home: ic('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  check: ic('<circle cx="9" cy="7" r="4"/><path d="M2 21v-1a6 6 0 0 1 9-5.2"/><path d="m15 18 2 2 4-4"/>'),
  users: ic('<circle cx="9" cy="7" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/><path d="M17 3.5a4 4 0 0 1 0 7"/><path d="M22 21v-1a6 6 0 0 0-3-5"/>'),
  addUser: ic('<circle cx="9" cy="7" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/><path d="M19 8v6M16 11h6"/>'),
  image: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  upload: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15l3-3 3 3"/>'),
  cash: ic('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'),
  shield: ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  book: ic('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'),
  clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  pin: ic('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
  coin: ic('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  arrow: ic('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  cal: ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  back: ic('<path d="M15 18l-6-6 6-6"/>'),
  gear: ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  link: ic('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  eye: ic('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  chat: ic('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>'),
  alert: ic('<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>'),
};
const money = (n) => (n < 0 ? '-' : '') + CUR + Math.abs(Number(n) || 0).toFixed(2);
const sById = (id) => S.students.find((s) => s.id === id);
const av = (s) => `<div class="av" style="background:${esc(s.color || COL[0])}">${esc((s.name || '?')[0].toUpperCase())}</div>`;
const isActive = (s) => s.active !== 'no';
const studentOptions = (sel, withAll) =>
  (withAll ? `<option value="">All ${lc(pl(T.member))}</option>` : '') +
  [...S.students].sort(byName).map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

function summary(s) {
  const attended = S.attendance.filter((a) => a.studentId === s.id).length;
  const pays = S.payments.filter((p) => p.studentId === s.id);
  const paid = sum(pays.map((p) => p.amount));
  const prepaid = sum(pays.filter((p) => p.timing === 'before').map((p) => p.classes));
  const charged = attended * (Number(s.fee) || 0);
  return { attended, paid, charged, balance: paid - charged, prepaid, prepaidLeft: prepaid - attended };
}
const balChip = (b) => b < -0.004 ? `<span class="chip bad">Owes ${money(-b)}</span>`
  : b > 0.004 ? `<span class="chip ok">Credit ${money(b)}</span>` : `<span class="chip ok">Paid up</span>`;
const stat = (label, val) => `<div class="stat"><span class="mu">${esc(label)}</span><b>${val}</b></div>`;
const table = (head, rows) => `<div class="tw"><table><thead><tr>${head.map((h) => `<th class="${h.num ? 'num' : ''}">${esc(h.t ?? h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${head[i] && head[i].num ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

/* ---------- data ---------- */
const mkcode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
async function load() {
  for (const k of Object.keys(ALL)) ALL[k] = await db.all(k);
  // one-time migration: Class Tracker data had no groups, so put it in a first group
  const loose = Object.keys(S).flatMap((k) => ALL[k].filter((r) => !r.groupId).map((r) => [k, r]));
  if (loose.length) {
    let g = ALL.groups[0];
    if (!g) { g = { id: nid(), name: 'My Art Class', activity: 'art', color: ACTIVITIES.art.color, code: mkcode(), role: 'organizer', created: today() }; await db.put('groups', g); ALL.groups.push(g); }
    for (const [k, r] of loose) { r.groupId = g.id; await db.put(k, r); }
    if (!ui.group) ui.group = g.id;
  }
  G = ALL.groups.find((g) => g.id === ui.group) || null;
  if (!G) { ui.group = null; ui.preview = null; }
  remember('cp-group', ui.group);
  T = ACTIVITIES[G?.activity] || ACTIVITIES.other;
  for (const k of Object.keys(S)) S[k] = G ? ALL[k].filter((r) => r.groupId === G.id) : [];
}
const put = (store, obj) => db.put(store, store === 'groups' ? obj : { groupId: G.id, ...obj });
async function save(store, obj) { await put(store, obj); await refresh(); }
async function remove(store, id) { await db.del(store, id); await refresh(); }
async function refresh() { await load(); render(); }

/* ---------- modal form ---------- */
function field(f, v) {
  v = v ?? f.default ?? '';
  const req = f.required ? 'required' : '';
  let input;
  if (f.type === 'select') {
    input = `<select name="${f.name}" ${req}>${f.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea name="${f.name}" rows="3">${esc(v)}</textarea>`;
  } else {
    const extra = f.type === 'number' ? `step="${f.step || 'any'}" min="0" inputmode="decimal"` : '';
    input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${req} ${extra}>`;
  }
  return `<label>${esc(f.label)}${f.required ? ' *' : ''}${input}${f.hint ? `<span class="mu">${esc(f.hint)}</span>` : ''}</label>`;
}
function formModal(title, fields, values = {}, okLabel = 'Save') {
  return new Promise((resolve) => {
    const dlg = $('#modal'), form = $('#modal-form');
    form.innerHTML = `<h2>${esc(title)}</h2>${fields.map((f) => field(f, values[f.name])).join('')}
      <div class="actions"><button value="cancel" formnovalidate>Cancel</button><button value="ok" class="pri">${esc(okLabel)}</button></div>`;
    dlg.returnValue = '';
    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return resolve(null);
      const out = {};
      for (const f of fields) {
        const v = form.elements[f.name].value;
        out[f.name] = f.type === 'number' ? (v === '' ? 0 : Number(v)) : v.trim();
      }
      resolve(out);
    };
    dlg.showModal();
  });
}


/* in-page confirm / message (browser pop-ups are blocked in some viewers) */
function ask(message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    const dlg = $('#modal'), form = $('#modal-form');
    form.innerHTML = `<p style="margin:0 0 12px">${esc(message)}</p>
      <div class="actions"><button value="cancel" formnovalidate>Cancel</button><button value="ok" class="pri danger">${esc(okLabel)}</button></div>`;
    dlg.returnValue = '';
    dlg.onclose = () => resolve(dlg.returnValue === 'ok');
    dlg.showModal();
  });
}
function notify(message) {
  const dlg = $('#modal'), form = $('#modal-form');
  form.innerHTML = `<p style="margin:0 0 12px">${esc(message)}</p><div class="actions"><button value="ok" class="pri">OK</button></div>`;
  dlg.onclose = null;
  dlg.showModal();
}

/* ---------- render ---------- */
const tabs = () => [['home', 'Dashboard', 'home'], ['classes', 'Attendance', 'check'], ['students', pl(T.member), 'users'], ['gallery', T.media, 'image'], ['payments', 'Fees', 'coin']];
const gav = (g, big) => `<div class="gav ${big ? 'big' : ''}" style="background:${esc(g.color)}">${esc((g.name || '?').trim()[0].toUpperCase())}</div>`;
function topbar() {
  return `<div class="topbar"><button class="x icon" data-act="leaveGroup" aria-label="All groups">${I.back}</button>
    ${gav(G)}<div class="grow"><b class="gname">${esc(G.name)}</b><span class="mu">${esc(ACTIVITIES[G.activity]?.label || 'Group')}${ui.preview ? ' · member preview' : ''}</span></div>
    ${ui.preview ? `<button class="soft" data-act="exitPreview">Exit preview</button>` : `<button class="x icon" data-go="group" aria-label="Group settings and invite">${I.gear}</button>`}</div>`;
}
function render() {
  const nav = $('#nav');
  if (!G) { nav.hidden = true; $('#app').innerHTML = vGroups(); return; }
  if (ui.preview) { nav.hidden = true; $('#app').innerHTML = topbar() + vMember(); return; }
  nav.hidden = false;
  const cur = ui.tab === 'books' ? 'payments' : ui.tab;
  nav.innerHTML = tabs().map(([k, l, i]) => `<button class="${cur === k ? 'on' : ''}" data-go="${k}" ${cur === k ? 'aria-current="page"' : ''}><span>${I[i]}</span>${esc(l)}</button>`).join('');
  const views = { home: vHome, classes: vClasses, students: ui.studentId ? vStudent : vStudents, payments: vPayments, gallery: vGallery, books: vBooks, group: vGroup };
  $('#app').innerHTML = topbar() + views[ui.tab]();
}
function go(tab) { ui.tab = tab; ui.studentId = null; render(); scrollTo(0, 0); }

/* ---------- groups ---------- */
const joinLink = (g) => location.origin + location.pathname + '#join-' + g.code;
function groupCard(g) {
  const n = ALL.students.filter((s) => s.groupId === g.id && isActive(s)).length;
  const next = ALL.classes.filter((c) => c.groupId === g.id && c.date >= today()).sort((a, b) => a.date.localeCompare(b.date) || byStart(a, b))[0];
  const a = ACTIVITIES[g.activity] || ACTIVITIES.other;
  return `<button class="card gcard" data-act="openGroup" data-id="${g.id}">${gav(g, true)}
    <span class="grow"><b>${esc(g.name)}</b><span class="mu" style="display:block">${a.label} · ${n} ${lc(n === 1 ? a.member : pl(a.member))}</span>
    <span class="mu" style="display:block">${next ? `Next: ${esc(next.topic || a.session)}, ${fd(next.date)}${next.start ? ' ' + fmtT(next.start) : ''}` : `No upcoming ${lc(pl(a.session))}`}</span></span>
    <span class="pill ${g.role === 'organizer' ? 'p-up' : 'p-live'}">${g.role === 'organizer' ? 'Organizer' : 'Member'}</span></button>`;
}
function vGroups() {
  const gs = [...ALL.groups].sort((a, b) => a.name.localeCompare(b.name));
  return `<header class="brand"><div class="logo">${I.book}</div><div><h1>Class Pouch</h1><p class="mu">Your classes and hobby groups in one place</p></div></header>
  <div class="actions-grid">
    <button class="act teal" data-act="addGroup"><span class="act-ic">${I.users}</span><span><b>Create a group</b><small>Art, dance, sports…</small></span></button>
    <button class="act peach" data-act="joinGroup"><span class="act-ic">${I.link}</span><span><b>Join a group</b><small>Use an invite code</small></span></button>
  </div>
  <div class="row sp sect"><h2>Your groups</h2><span class="mu">${gs.length}</span></div>
  ${gs.map(groupCard).join('') || `<div class="emptybox"><p>No groups yet. Create one for each class or team you run, then share its invite link instead of a WhatsApp group.</p></div>`}`;
}
const groupFields = () => [
  { name: 'name', label: 'Group name', required: true, placeholder: 'e.g. Saturday Kids Art' },
  { name: 'activity', label: 'Activity', type: 'select', default: 'art', options: Object.entries(ACTIVITIES).map(([value, a]) => ({ value, label: a.label })) },
  { name: 'about', label: 'About (optional)', type: 'textarea' },
];
function vGroup() {
  const link = joinLink(G);
  const wa = 'https://wa.me/?text=' + encodeURIComponent(`Join ${G.name} on Class Pouch: ${link} (code ${G.code})`);
  const members = S.students.filter(isActive).sort(byName);
  return `<p class="eyebrow">Group settings</p><h1>${esc(G.name)}</h1>
  ${G.about ? `<p class="sub">${esc(G.about)}</p>` : '<p class="sub">Share the invite so members can see schedules, attendance and dues for this group only.</p>'}
  <section class="tile aqua invite">
    <div class="row sp"><span class="label">Invite code</span><span class="tile-ic">${I.link}</span></div>
    <p class="code">${esc(G.code)}</p>
    <input id="joinlink" readonly value="${esc(link)}" aria-label="Invite link">
    <div class="row wrap"><button class="pri" data-act="copyLink">${I.link}Copy link</button>
    <a class="btn soft" href="${esc(wa)}" target="_blank" rel="noopener">${I.chat}Share on WhatsApp</a>
    <button class="x" data-act="newCode">New code</button></div>
    <p class="mu">Prototype: invites open groups saved on this device. Joining from other phones needs the online backend.</p>
  </section>
  <h2>Preview as a member</h2>
  <p class="sub">See exactly what one ${lc(T.member)} or their parent would see.</p>
  ${members.length ? `<div class="row"><select id="previewAs" aria-label="Member to preview">${members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
  <button class="soft" data-act="startPreview" style="margin-bottom:8px">${I.eye}Preview</button></div>` : `<p class="mu">Add ${lc(pl(T.member))} first.</p>`}
  <h2>Details</h2>
  <div class="row wrap"><button data-act="editGroup">Edit name and activity</button>
  <button class="x" data-act="delGroup" style="color:var(--bad)">Delete group</button></div>`;
}
function vMember() {
  const s = sById(ui.preview);
  if (!s) { ui.preview = null; return vHome(); }
  const x = summary(s);
  const next = S.classes.filter((c) => c.date >= today() && classStatus(c) !== 'done').sort((a, b) => a.date.localeCompare(b.date) || byStart(a, b))[0];
  const past = S.classes.filter((c) => c.date <= today()).sort(byDateDesc).slice(0, 12);
  const works = S.works.filter((w) => w.studentId === s.id).sort(byDateDesc);
  return `<p class="eyebrow">Member view</p><h1>${esc(s.name)}'s ${esc(G.name)}</h1>
  <p class="sub">Only ${esc(s.name)}'s own schedule, attendance, dues and ${esc(T.work)}s are shown.</p>
  <section class="tile teal-tile"><span class="label">Next ${lc(T.session)}</span>
    ${next ? `<p class="num">${esc(fd(next.date))}</p><span>${esc(next.topic || T.session)}${timeRange(next) ? ' · ' + esc(timeRange(next)) : ''}${next.location ? ' · ' + esc(next.location) : ''}</span>` : `<p class="num">Not scheduled yet</p>`}</section>
  <section class="tile peach"><div class="row sp"><span class="label">Fees</span><span class="tile-ic">${I.cash}</span></div>
    <p class="num">${x.balance < -0.004 ? money(-x.balance) : money(0)} <small>${x.balance < -0.004 ? 'due' : 'nothing due'}</small></p>
    <span class="mu">${x.attended} ${lc(x.attended === 1 ? T.session : pl(T.session))} attended · paid ${money(x.paid)}${x.prepaid ? ` · ${Math.max(0, x.prepaidLeft)} prepaid left` : ''}</span></section>
  <h2>Attendance</h2>
  ${past.length ? past.map((c) => { const p = S.attendance.some((a) => a.id === c.id + '_' + s.id);
    return `<div class="card row sp"><span>${esc(fd(c.date))} <span class="mu">${esc(c.topic)}</span></span><span class="chip ${p ? 'ok' : 'bad'}">${p ? 'Present' : 'Absent'}</span></div>`; }).join('') : '<p class="mu">Nothing recorded yet.</p>'}
  <h2>${esc(T.media)}</h2>${works.length ? gallery(works, true) : `<p class="mu">No ${esc(T.work)}s yet.</p>`}`;
}

/* ---------- dashboard ---------- */
function feeStatus() {
  const owing = S.students.filter(isActive).map((s) => {
    const x = summary(s);
    const last = S.payments.filter((p) => p.studentId === s.id).map((p) => p.date).sort().pop()
      || S.classes.filter((c) => S.attendance.some((a) => a.id === c.id + '_' + s.id)).map((c) => c.date).sort()[0] || today();
    return { s, ...x, overdue: daysSince(last) > 15 };
  }).filter((x) => x.balance < -0.004);
  return { owing, due: sum(owing.map((x) => -x.balance)), overdue: owing.filter((x) => x.overdue).length };
}
function schedItem(c) {
  const st = classStatus(c), [label, cls] = STATUS[st];
  const here = S.students.filter((s) => S.attendance.some((a) => a.id === c.id + '_' + s.id));
  const [h, ap] = c.start ? fmtT(c.start).replace(/:\d\d/, '').split(' ') : ['—', ''];
  return `<article class="tl ${cls}"><div class="row top">
    <div class="hour h-${cls}"><b>${esc(h.padStart(2, '0'))}</b><span>${ap}</span></div>
    <div class="grow"><h3>${esc(c.topic || T.session)}</h3><span class="pill p-${cls}">${label}</span>
    <div class="meta">${timeRange(c) ? `<span>${I.clock}${esc(timeRange(c))}</span>` : ''}${c.location ? `<span>${I.pin}${esc(c.location)}</span>` : ''}</div></div></div>
    <div class="row sp foot"><div class="stack">${here.slice(0, 2).map(av).join('')}${here.length > 2 ? `<div class="av more">+${here.length - 2}</div>` : ''}
    ${here.length ? '' : '<span class="mu">Nobody checked in yet</span>'}</div>
    <button class="${st === 'live' ? 'pri' : 'soft'}" data-act="openClass" data-id="${c.id}">${I.check}${st === 'done' ? 'Review' : st === 'live' ? 'Check-in' : 'Prepare'}</button></div></article>`;
}
function vHome() {
  const t = today(), h = new Date().getHours();
  const hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const fees = feeStatus();
  const todays = S.classes.filter((c) => c.date === t).sort(byStart);
  const active = S.students.filter(isActive).length;
  const slots = todays.length * active;
  const checked = sum(todays.map((c) => S.attendance.filter((a) => a.classId === c.id).length));
  const live = todays.filter((c) => classStatus(c) === 'live').length, up = todays.filter((c) => classStatus(c) === 'upcoming').length;
  const recent = [...S.works].sort(byDateDesc).slice(0, 4);
  return `<header class="hello">
    <div class="row"><div class="me">${esc((TEACHER || 'S')[0].toUpperCase())}</div><div class="grow"><p class="greet">${hi}${TEACHER ? ', ' + esc(TEACHER) : ''}</p>
    <p class="mu">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p></div></div>
    <p class="eyebrow"><i class="dot"></i>Today in ${esc(G.name)}</p><h1>Daily overview</h1>
    <span class="pill p-live">${active} active ${lc(active === 1 ? T.member : pl(T.member))}</span></header>

  <section class="tile peach">
    <div class="row sp"><span class="label">Pending fees</span><span class="tile-ic">${I.cash}</span></div>
    <p class="num">${money(fees.due)} <small>/ ${fees.owing.length} ${lc(fees.owing.length === 1 ? T.member : pl(T.member))}</small></p>
    <div class="row sp"><span class="${fees.overdue ? 'warn' : 'mu'}">${fees.overdue ? I.alert + fees.overdue + ' overdue over 15 days' : 'Nothing overdue'}</span>
    <button class="brown" data-go="payments">Follow up ${I.arrow}</button></div></section>

  <section class="tile aqua">
    <div class="row sp"><span class="label">Today's attendance</span><span class="tile-ic">${I.shield}</span></div>
    <p class="num">${slots ? Math.round(checked / slots * 100) + '%' : '—'} <small>rate</small></p>
    <span class="mu">${slots ? `${checked} checked in of ${slots}` : `No ${lc(pl(T.session))} scheduled today`}</span></section>

  <section class="tile lilac">
    <div class="row sp"><span class="label">Today's sessions</span><span class="tile-ic">${I.book}</span></div>
    <p class="num">${todays.length} <small>${lc(todays.length === 1 ? T.session : pl(T.session))} scheduled</small></p>
    <span class="mu">${live} ongoing · ${up} upcoming</span></section>

  <p class="eyebrow">Quick actions</p>
  <div class="actions-grid">
    <button class="act teal" data-go="classes"><span class="act-ic">${I.check}</span><span><b>Take attendance</b><small>Mark who's here</small></span></button>
    <button class="act peach" data-act="addStudent"><span class="act-ic">${I.addUser}</span><span><b>New ${lc(T.member)}</b><small>Add to the roster</small></span></button>
    <button class="act" data-go="gallery"><span class="act-ic">${I.upload}</span><span><b>Add ${esc(T.work)}</b><small>Upload photos</small></span></button>
    <button class="act" data-act="addPayment"><span class="act-ic lil">${I.coin}</span><span><b>Record payment</b><small>${fees.owing.length} with fees due</small></span></button>
  </div>

  <div class="row sp sect"><div><h2>Today's timeline</h2><p class="mu">Today's ${lc(pl(T.session))} and who has checked in.</p></div>
  <button class="link" data-act="addClass">${I.cal}Add ${lc(T.session)}</button></div>
  ${todays.map(schedItem).join('') || `<div class="emptybox"><p>Nothing scheduled today.</p><button class="pri" data-act="addClass">Schedule a ${lc(T.session)}</button></div>`}

  <div class="row sp sect"><div><h2>Showcase</h2><p class="mu">Latest ${esc(T.work)}s from this group.</p></div>
  <button class="link" data-go="gallery">${esc(T.media)} ${I.arrow}</button></div>
  ${recent.length ? gallery(recent, true) : `<div class="emptybox"><p>No ${esc(T.work)}s yet.</p><button class="soft" data-go="gallery">${I.upload}Upload photos</button></div>`}`;
}

/* ---------- classes & attendance ---------- */
function vClasses() {
  const active = S.students.filter(isActive).sort(byName);
  const cs = [...S.classes].sort((a, b) => b.date.localeCompare(a.date) || byStart(b, a));
  return `<div class="row sp"><div><p class="eyebrow">Attendance</p><h1>${pl(T.session)}</h1></div><button class="pri" data-act="addClass">+ Add ${lc(T.session)}</button></div>
  <p class="sub">Tap each ${lc(T.member)} to mark them present.</p>
  ${cs.map((c) => {
    const here = S.attendance.filter((a) => a.classId === c.id).length;
    const [label, cls] = STATUS[classStatus(c)];
    return `<div class="card" id="class-${c.id}"><div class="row sp top"><div><b>${esc(c.topic || T.session)}</b> <span class="pill p-${cls}">${label}</span>
      <div class="mu">${fd(c.date)}${timeRange(c) ? ' · ' + esc(timeRange(c)) : ''}${c.location ? ' · ' + esc(c.location) : ''}</div></div>
      <div class="row"><span class="chip neutral">${here} present</span><button class="x" data-act="editClass" data-id="${c.id}">Edit</button><button class="x" data-act="delClass" data-id="${c.id}" aria-label="Delete class">✕</button></div></div>
      <div style="margin-top:10px">${active.length ? active.map((s) => {
        const p = S.attendance.some((a) => a.id === c.id + '_' + s.id);
        return `<button class="tog" data-act="toggle" data-class="${c.id}" data-student="${s.id}">${av(s)}<span class="grow">${esc(s.name)}</span><span class="chip ${p ? 'ok' : 'neutral'}">${p ? 'Present' : 'Absent'}</span></button>`;
      }).join('') + `<button data-act="allPresent" data-id="${c.id}">Mark everyone present</button>` : `<p class="mu">Add ${lc(pl(T.member))} first.</p>`}</div></div>`;
  }).join('') || `<p class="empty">Nothing scheduled yet. Add your first ${lc(T.session)} above.</p>`}`;
}

const classFields = () => [
  { name: 'topic', label: `${T.session} name`, required: true },
  { name: 'date', label: 'Date', type: 'date', required: true, default: today() },
  { name: 'start', label: 'Starts', type: 'time' },
  { name: 'end', label: 'Ends', type: 'time' },
  { name: 'location', label: 'Room or location' },
];

/* ---------- students ---------- */
const studentFields = () => [
  { name: 'name', label: `${T.member} name`, required: true },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'guardian', label: 'Parent / guardian' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'fee', label: `Fee per ${lc(T.session)} (${CUR})`, type: 'number' },
  { name: 'joined', label: 'Joined on', type: 'date', default: today() },
  { name: 'active', label: 'Status', type: 'select', options: [{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }] },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
function vStudents() {
  const q = ui.q.toLowerCase();
  const list = S.students.filter((s) => !q || s.name.toLowerCase().includes(q)).sort((a, b) => (isActive(b) - isActive(a)) || byName(a, b));
  return `<div class="row sp"><h1>${pl(T.member)}</h1><button class="pri" data-act="addStudent">+ Add ${lc(T.member)}</button></div>
  <p class="sub">Tap a ${lc(T.member)} to see their attendance, payments and ${esc(T.work)}s.</p>
  <input id="search" placeholder="Search ${lc(pl(T.member))}" value="${esc(ui.q)}" aria-label="Search">
  ${list.map((s) => {
    const x = summary(s);
    return `<button class="card tog" data-open="${s.id}">${av(s)}<span class="grow"><b>${esc(s.name)}</b>${isActive(s) ? '' : ' <span class="chip neutral">Inactive</span>'}
      <span class="mu" style="display:block">${x.attended} attended · ${money(s.fee || 0)}/${lc(T.session)}${x.prepaid ? ` · ${x.prepaidLeft} prepaid left` : ''}</span></span>${balChip(x.balance)}</button>`;
  }).join('') || `<p class="empty">${S.students.length ? 'No match.' : `No ${lc(pl(T.member))} yet. Add your first one.`}</p>`}`;
}
function vStudent() {
  const s = sById(ui.studentId);
  if (!s) { ui.studentId = null; return vStudents(); }
  const x = summary(s);
  const past = S.classes.filter((c) => c.date <= today()).sort(byDateDesc);
  const pays = S.payments.filter((p) => p.studentId === s.id).sort(byDateDesc);
  const works = S.works.filter((w) => w.studentId === s.id).sort(byDateDesc);
  const info = [['Phone', s.phone], ['Parent / guardian', s.guardian], ['Email', s.email], ['Joined', fd(s.joined)]].filter(([, v]) => v);
  return `<button class="x" data-go="students">← All ${lc(pl(T.member))}</button>
  <div class="row sp" style="margin:8px 0 12px"><div class="row">${av(s)}<h1>${esc(s.name)}</h1></div>
  <div class="row"><button data-act="editStudent" data-id="${s.id}">Edit</button><button class="pri" data-act="addPayment" data-student="${s.id}">+ Payment</button></div></div>
  <div class="card">${info.map(([k, v]) => `<div class="row sp"><span class="mu">${k}</span><span>${esc(v)}</span></div>`).join('') || '<span class="mu">No contact details yet.</span>'}
  ${s.notes ? `<p style="margin:8px 0 0">${esc(s.notes)}</p>` : ''}</div>
  <div class="stats">${stat('Attended', x.attended)}${stat('Fee per ' + lc(T.session), money(s.fee || 0))}${stat('Total paid', money(x.paid))}${stat('Charged', money(x.charged))}
  ${x.prepaid ? stat('Prepaid classes', `${x.prepaidLeft} of ${x.prepaid} left`) : ''}${stat('Balance', balChip(x.balance))}</div>
  <h2>Attendance</h2>
  ${past.length ? table(['Date', 'Topic', 'Status'], past.slice(0, 60).map((c) => {
    const p = S.attendance.some((a) => a.id === c.id + '_' + s.id);
    return [esc(fd(c.date)), esc(c.topic), `<span class="chip ${p ? 'ok' : 'bad'}">${p ? 'Present' : 'Absent'}</span>`];
  })) : '<p class="mu">No classes recorded yet.</p>'}
  <h2>Payments</h2>${pays.length ? payTable(pays, false) : '<p class="mu">No payments yet.</p>'}
  <h2>${esc(T.media)}</h2>${works.length ? gallery(works) : `<p class="mu">No photos yet. Add them from the ${esc(T.media)} tab.</p>`}
  <div class="row wrap"><button class="soft" data-act="previewMember" data-id="${s.id}">${I.eye}See their member view</button>
  <button class="x" data-act="delStudent" data-id="${s.id}" style="color:var(--bad)">Delete ${lc(T.member)} and all their records</button></div>`;
}

/* ---------- payments ---------- */
const paymentFields = (studentId) => [
  { name: 'studentId', label: T.member, type: 'select', required: true, default: studentId,
    options: [...S.students].sort(byName).map((s) => ({ value: s.id, label: s.name })) },
  { name: 'date', label: 'Date paid', type: 'date', required: true, default: today() },
  { name: 'amount', label: `Amount (${CUR})`, type: 'number', required: true },
  { name: 'timing', label: 'Paid for', type: 'select', default: 'after',
    options: [{ value: 'before', label: `Before ${lc(pl(T.session))} (prepaid)` }, { value: 'after', label: `After ${lc(pl(T.session))} (for ones attended)` }] },
  { name: 'classes', label: `${pl(T.session)} covered`, type: 'number', step: '1', hint: `For prepaid payments: how many ${lc(pl(T.session))} this pays for.` },
  { name: 'method', label: 'Method', type: 'select', default: 'Cash', options: METHODS.map((m) => ({ value: m, label: m })) },
  { name: 'note', label: 'Note', placeholder: 'e.g. October classes' },
];
function payTable(pays, withStudent) {
  const head = ['Date', ...(withStudent ? [T.member] : []), 'For', 'Method', { t: 'Amount', num: true }, ''];
  return table(head, pays.map((p) => [
    esc(fd(p.date)),
    ...(withStudent ? [esc(sById(p.studentId)?.name || '—')] : []),
    p.timing === 'before' ? `Prepaid${p.classes ? ` · ${p.classes}` : ''}` : 'After attending',
    esc(p.method) + (p.note ? ` <span class="mu">${esc(p.note)}</span>` : ''),
    money(p.amount),
    `<button class="x" data-act="editPayment" data-id="${p.id}">Edit</button><button class="x" data-act="delPayment" data-id="${p.id}" aria-label="Delete payment">✕</button>`,
  ]));
}
function vPayments() {
  const pays = S.payments.filter((p) => !ui.payFilter || p.studentId === ui.payFilter).sort(byDateDesc);
  const owing = S.students.filter(isActive).map((s) => ({ s, ...summary(s) })).filter((x) => x.balance < -0.004).sort((a, b) => a.balance - b.balance);
  return `<div class="row sp"><div><p class="eyebrow">Fees</p><h1>Payments</h1></div><button class="pri" data-act="addPayment" ${S.students.length ? '' : 'disabled'}>+ Record payment</button></div>
  <p class="sub">Record each payment as prepaid or paid after attending. Tap Edit to change one.</p>
  <button class="act wide" data-go="books"><span class="act-ic lil">${I.book}</span><span><b>Books & expenses</b><small>Monthly income, expenses, export and backup</small></span>${I.arrow}</button>
  <h2>Payment due</h2>
  ${owing.length ? owing.map((x) => `<button class="card tog" data-open="${x.s.id}">${av(x.s)}<span class="grow"><b>${esc(x.s.name)}</b><span class="mu" style="display:block">${x.attended} attended · paid ${money(x.paid)}</span></span>${balChip(x.balance)}</button>`).join('') : '<p class="mu">Nobody owes anything right now.</p>'}
  <div class="row sp"><h2>History</h2><select id="payFilter" style="width:auto;margin:0" aria-label="Filter">${studentOptions(ui.payFilter, true)}</select></div>
  ${pays.length ? payTable(pays, true) + `<p class="mu" style="text-align:right">Total: <b>${money(sum(pays.map((p) => p.amount)))}</b></p>` : '<p class="empty">No payments recorded.</p>'}`;
}

/* ---------- gallery ---------- */
function urlFor(w) {
  if (!urls.has(w.id)) urls.set(w.id, URL.createObjectURL(w.blob));
  return urls.get(w.id);
}
function gallery(works, compact) {
  return `<div class="grid">${works.map((w) => {
    const s = sById(w.studentId);
    return `<figure class="art"><a href="${urlFor(w)}" target="_blank" rel="noopener"><img src="${urlFor(w)}" alt="${esc(w.title || 'Photo')}" loading="lazy"></a>
    <figcaption><div class="row sp"><span class="who">${s ? esc(s.name) : ''}</span><span class="mu">${esc(w.medium || '')}</span></div>
    <b>${esc(w.title || 'Untitled')}</b><div class="row sp"><span class="mu">${esc(fd(w.date))}</span>
    ${compact ? '' : `<button class="x" data-act="delWork" data-id="${w.id}">Delete</button>`}</div></figcaption></figure>`;
  }).join('')}</div>`;
}
function vGallery() {
  const works = S.works.filter((w) => !ui.artFilter || w.studentId === ui.artFilter).sort(byDateDesc);
  return `<h1>${esc(T.media)}</h1><p class="sub">Upload photos for each ${lc(T.member)}.</p>
  ${S.students.length ? `<div class="card"><select id="ws" aria-label="${T.member}">${studentOptions(ui.artFilter || '')}</select>
  <div class="two"><input id="wd" type="date" value="${today()}" aria-label="Date"><input id="wt" placeholder="Title (optional)" aria-label="Title"></div>
  <input id="wm" placeholder="${G.activity === 'art' ? 'Medium, e.g. Watercolor' : 'Tag, e.g. Recital, Match day'} (optional)" aria-label="Tag">
  <input id="wf" type="file" accept="image/*" multiple aria-label="Photos"><button class="pri" data-act="upload" id="wb">Upload photos</button></div>` : `<p class="mu">Add ${lc(pl(T.member))} first.</p>`}
  <div class="row sp"><h2>Photos</h2><select id="artFilter" style="width:auto;margin:0" aria-label="Filter">${studentOptions(ui.artFilter, true)}</select></div>
  ${works.length ? gallery(works) : '<p class="empty">No photos yet.</p>'}`;
}
async function shrink(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5e6) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b || file), 'image/jpeg', 0.85));
  } catch (e) { return file; }
}

/* ---------- bookkeeping ---------- */
const expenseFields = () => [
  { name: 'date', label: 'Date', type: 'date', required: true, default: today() },
  { name: 'category', label: 'Category', type: 'select', default: 'Supplies', options: EXPENSE_CATS.map((c) => ({ value: c, label: c })) },
  { name: 'amount', label: `Amount (${CUR})`, type: 'number', required: true },
  { name: 'note', label: 'Note' },
];
function ledger(month) {
  const inc = S.payments.filter((p) => p.date.startsWith(month)).map((p) => ({
    id: p.id, kind: 'pay', date: p.date, desc: `${sById(p.studentId)?.name || T.member} — ${p.timing === 'before' ? 'prepaid' : 'after attending'} (${p.method})${p.note ? ', ' + p.note : ''}`, inAmt: p.amount, outAmt: 0,
  }));
  const exp = S.expenses.filter((x) => x.date.startsWith(month)).map((x) => ({
    id: x.id, kind: 'exp', date: x.date, desc: `${x.category}${x.note ? ' — ' + x.note : ''}`, inAmt: 0, outAmt: x.amount,
  }));
  return [...inc, ...exp].sort(byDateDesc);
}
function vBooks() {
  const m = ui.month ||= today().slice(0, 7);
  const rows = ledger(m);
  const tin = sum(rows.map((r) => r.inAmt)), tout = sum(rows.map((r) => r.outAmt));
  const allIn = sum(S.payments.map((p) => p.amount)), allOut = sum(S.expenses.map((x) => x.amount));
  const owed = sum(S.students.map((s) => Math.max(0, -summary(s).balance)));
  return `<button class="x" data-go="payments">← Fees</button><div class="row sp"><h1>Books</h1><button class="pri" data-act="addExpense">+ Add expense</button></div>
  <p class="sub">Books for ${esc(G.name)}. Income comes from recorded payments; add this group's expenses here.</p>
  <input id="month" type="month" value="${m}" aria-label="Month">
  <div class="stats">${stat('Income', `<span class="in">${money(tin)}</span>`)}${stat('Expenses', `<span class="out">${money(tout)}</span>`)}${stat('Net', money(tin - tout))}</div>
  ${rows.length ? table(['Date', 'Description', { t: 'In', num: true }, { t: 'Out', num: true }, ''], rows.map((r) => [
    esc(fd(r.date)), esc(r.desc),
    r.inAmt ? `<span class="in">${money(r.inAmt)}</span>` : '', r.outAmt ? `<span class="out">${money(r.outAmt)}</span>` : '',
    r.kind === 'exp' ? `<button class="x" data-act="editExpense" data-id="${r.id}">Edit</button><button class="x" data-act="delExpense" data-id="${r.id}" aria-label="Delete expense">✕</button>`
      : `<button class="x" data-act="editPayment" data-id="${r.id}">Edit</button>`,
  ])) : '<p class="empty">Nothing recorded this month.</p>'}
  <button data-act="exportCsv" ${rows.length ? '' : 'disabled'}>Export month as CSV</button>
  <h2>All time</h2>
  <div class="stats">${stat('Total income', money(allIn))}${stat('Total expenses', money(allOut))}${stat('Net', money(allIn - allOut))}${stat('Still owed to you', money(owed))}</div>
  <h2>Settings & backup</h2>
  <div class="card"><label>Your name (shown on the dashboard)<input id="tname" value="${esc(TEACHER)}" maxlength="40"></label>
  <label>Currency symbol<input id="currency" value="${esc(CUR)}" maxlength="4" style="max-width:120px"></label>
  <p class="mu">Prototype: data for all your groups lives in this browser only. Download a backup regularly, and use Restore to move it to another device.</p>
  <div class="row wrap"><button data-act="backup">Download backup</button><label class="row" style="margin:0"><span class="chip neutral" style="padding:10px 14px">Restore from backup</span><input id="restore" type="file" accept="application/json,.json" hidden></label></div></div>`;
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = (v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const blobToDataUrl = (b) => new Promise((r, j) => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = j; f.readAsDataURL(b); });

/* ---------- actions ---------- */
const actions = {
  async addGroup() {
    const v = await formModal('Create a group', groupFields(), {}, 'Create');
    if (!v) return;
    const g = { id: nid(), ...v, color: (ACTIVITIES[v.activity] || ACTIVITIES.other).color, code: mkcode(), role: 'organizer', created: today() };
    await db.put('groups', g);
    ui.group = g.id; ui.tab = 'group';
    await refresh();
  },
  async editGroup() {
    const v = await formModal('Edit group', groupFields(), G);
    if (v) await db.put('groups', { ...G, ...v });
    await refresh();
  },
  async delGroup() {
    if (!await ask(`Delete ${G.name} with all its members, attendance, payments, photos and books? This can't be undone.`)) return;
    for (const k of Object.keys(S)) for (const r of S[k]) await db.del(k, r.id);
    await db.del('groups', G.id);
    ui.group = null; await refresh();
  },
  openGroup({ id }) { ui.group = id; ui.tab = 'home'; ui.studentId = null; ui.preview = null; ui.payFilter = ui.artFilter = ''; refresh(); scrollTo(0, 0); },
  leaveGroup() { ui.group = null; ui.preview = null; refresh(); scrollTo(0, 0); },
  async joinGroup(pre) {
    const v = pre?.code ? { code: pre.code } : await formModal('Join a group', [{ name: 'code', label: 'Invite code', required: true }], {}, 'Join');
    if (!v) return;
    const code = v.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const g = ALL.groups.find((x) => x.code === code);
    if (g) { actions.openGroup({ id: g.id }); return; }
    notify(`No group with code ${code} on this device. In this prototype, invites only open groups saved here; joining from another phone needs the online backend.`);
  },
  async copyLink() {
    const inp = $('#joinlink');
    try { await navigator.clipboard.writeText(inp.value); notify('Invite link copied.'); } catch (e) { inp.select(); }
  },
  async newCode() {
    if (!await ask('Make a new invite code? The old link will stop working.', 'New code')) return;
    await db.put('groups', { ...G, code: mkcode() }); await refresh();
  },
  startPreview() { ui.preview = $('#previewAs').value; render(); scrollTo(0, 0); },
  previewMember({ id }) { ui.preview = id; render(); scrollTo(0, 0); },
  exitPreview() { ui.preview = null; render(); scrollTo(0, 0); },
  async addClass() {
    const v = await formModal('Add ' + lc(T.session), classFields(), {}, 'Add');
    if (v) await save('classes', { id: nid(), ...v });
  },
  async editClass({ id }) {
    const c = S.classes.find((x) => x.id === id);
    const v = await formModal('Edit ' + lc(T.session), classFields(), c);
    if (v) { delete c.time; await save('classes', { ...c, ...v }); }
  },
  openClass({ id }) {
    go('classes');
    const el = document.getElementById('class-' + id);
    if (el) el.scrollIntoView({ block: 'start' });
  },
  async delClass({ id }) {
    if (!await ask(`Delete this ${lc(T.session)} and its attendance?`)) return;
    for (const a of S.attendance.filter((a) => a.classId === id)) await db.del('attendance', a.id);
    await remove('classes', id);
  },
  async toggle({ class: classId, student: studentId }) {
    const id = classId + '_' + studentId;
    if (S.attendance.some((a) => a.id === id)) await remove('attendance', id);
    else await save('attendance', { id, classId, studentId });
  },
  async allPresent({ id }) {
    for (const s of S.students.filter(isActive)) await put('attendance', { id: id + '_' + s.id, classId: id, studentId: s.id });
    await refresh();
  },
  async addStudent() {
    const v = await formModal('Add ' + lc(T.member), studentFields(), {}, 'Add');
    if (v) await save('students', { id: nid(), color: COL[S.students.length % COL.length], ...v });
  },
  async editStudent({ id }) {
    const s = sById(id);
    const v = await formModal('Edit ' + lc(T.member), studentFields(), s);
    if (v) await save('students', { ...s, ...v });
  },
  async delStudent({ id }) {
    const s = sById(id);
    if (!await ask(`Delete ${s.name} and all their attendance, payments and photos? This can't be undone.`)) return;
    for (const a of S.attendance.filter((a) => a.studentId === id)) await db.del('attendance', a.id);
    for (const p of S.payments.filter((p) => p.studentId === id)) await db.del('payments', p.id);
    for (const w of S.works.filter((w) => w.studentId === id)) await db.del('works', w.id);
    ui.studentId = null;
    await remove('students', id);
  },
  async addPayment({ student }) {
    if (!S.students.length) return;
    const v = await formModal('Record payment', paymentFields(student || ui.payFilter || ''), {}, 'Record');
    if (v) await save('payments', { id: nid(), ...v });
  },
  async editPayment({ id }) {
    const p = S.payments.find((x) => x.id === id);
    const v = await formModal('Edit payment', paymentFields(p.studentId), p);
    if (v) await save('payments', { ...p, ...v });
  },
  async delPayment({ id }) { if (await ask('Delete this payment?')) await remove('payments', id); },
  async upload() {
    const files = [...$('#wf').files], studentId = $('#ws').value;
    if (!files.length || !studentId) { notify(`Choose a ${lc(T.member)} and at least one photo.`); return; }
    const b = $('#wb'); b.disabled = true; b.textContent = 'Uploading…';
    try {
      for (const f of files) {
        const blob = await shrink(f);
        await put('works', { id: nid(), studentId, date: $('#wd').value || today(), title: $('#wt').value.trim(), medium: $('#wm').value.trim(), blob });
      }
    } catch (e) { notify('Upload failed: ' + (e.message || e)); }
    await refresh();
  },
  async delWork({ id }) {
    if (!await ask('Delete this photo?')) return;
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    await remove('works', id);
  },
  async addExpense() {
    const v = await formModal('Add expense', expenseFields(), {}, 'Add');
    if (v) await save('expenses', { id: nid(), ...v });
  },
  async editExpense({ id }) {
    const x = S.expenses.find((e) => e.id === id);
    const v = await formModal('Edit expense', expenseFields(), x);
    if (v) await save('expenses', { ...x, ...v });
  },
  async delExpense({ id }) { if (await ask('Delete this expense?')) await remove('expenses', id); },
  exportCsv() {
    const rows = ledger(ui.month);
    const lines = [['Date', 'Type', 'Description', 'In', 'Out'], ...rows.map((r) => [r.date, r.kind === 'pay' ? 'Income' : 'Expense', r.desc, r.inAmt || '', r.outAmt || ''])];
    download(`${G.name.replace(/[^\w-]+/g, '-')}-${ui.month}.csv`, lines.map((l) => l.map(csvCell).join(',')).join('\n'), 'text/csv');
  },
  async backup() {
    const data = { app: 'class-pouch', version: 2, exported: new Date().toISOString(), currency: CUR };
    for (const k of Object.keys(ALL)) data[k] = await db.all(k);
    data.works = await Promise.all(data.works.map(async (w) => ({ ...w, blob: undefined, dataUrl: await blobToDataUrl(w.blob) })));
    download(`class-pouch-backup-${today()}.json`, JSON.stringify(data), 'application/json');
  },
};

async function restore(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { notify('That file is not a valid backup.'); return; }
  if (data.app !== 'class-pouch' && data.app !== 'class-tracker') { notify('That file is not a Class Pouch backup.'); return; }
  if (!await ask('Replace ALL groups and data with this backup?', 'Replace')) return;
  for (const k of Object.keys(ALL)) {
    await db.clear(k);
    for (const item of data[k] || []) {
      if (k === 'works') {
        const { dataUrl, ...rest } = item;
        await db.put('works', { ...rest, blob: await (await fetch(dataUrl)).blob() });
      } else await db.put(k, item);
    }
  }
  if (data.currency) setCurrency(data.currency);
  urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear();
  await refresh();
  notify('Backup restored.');
}
function setCurrency(v) {
  CUR = v.trim() || '$';
  try { localStorage.setItem('ct-currency', CUR); } catch (e) { /* ignore */ }
}

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
  const o = e.target.closest('[data-open]'); if (o) { ui.tab = 'students'; ui.studentId = o.dataset.open; render(); scrollTo(0, 0); return; }
  const a = e.target.closest('[data-act]');
  if (a && actions[a.dataset.act]) actions[a.dataset.act](a.dataset);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    ui.q = e.target.value; render();
    const s = $('#search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length);
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'payFilter') { ui.payFilter = t.value; render(); }
  else if (t.id === 'artFilter') { ui.artFilter = t.value; render(); }
  else if (t.id === 'month') { ui.month = t.value || today().slice(0, 7); render(); }
  else if (t.id === 'currency') { setCurrency(t.value); render(); }
  else if (t.id === 'tname') { TEACHER = t.value.trim(); try { localStorage.setItem('ct-name', TEACHER); } catch (e) { /* ignore */ } render(); }
  else if (t.id === 'restore' && t.files[0]) restore(t.files[0]);
});

const joinHash = () => { const m = /^#join-([A-Za-z0-9]+)$/.exec(location.hash); if (m) { history.replaceState(null, '', location.pathname); actions.joinGroup({ code: m[1] }); } };
window.addEventListener('hashchange', joinHash);
refresh().then(joinHash).catch((e) => { $('#app').innerHTML = `<p class="empty">Could not open storage: ${esc(e.message || e)}</p>`; });
