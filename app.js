'use strict';
/* Class Tracker — attendance, payments, student work photos and bookkeeping.
   All data is stored in this browser (IndexedDB). Use Books → Backup to save a copy. */

const COL = ['#E4572E', '#2E86AB', '#76B041', '#F2A541', '#8E5BD9', '#E0568F', '#1FA39A'];
const METHODS = ['Cash', 'Card', 'Bank transfer', 'Zelle', 'Venmo', 'UPI', 'Other'];
const EXPENSE_CATS = ['Supplies', 'Rent', 'Utilities', 'Marketing', 'Salary', 'Other'];

const S = { students: [], classes: [], attendance: [], payments: [], expenses: [], works: [] };
const ui = { tab: 'classes', studentId: null, q: '', payFilter: '', artFilter: '', month: '' };
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
let CUR = '$';
try { CUR = localStorage.getItem('ct-currency') || '$'; } catch (e) { /* storage unavailable */ }
const money = (n) => (n < 0 ? '-' : '') + CUR + Math.abs(Number(n) || 0).toFixed(2);
const sById = (id) => S.students.find((s) => s.id === id);
const av = (s) => `<div class="av" style="background:${esc(s.color || COL[0])}">${esc((s.name || '?')[0].toUpperCase())}</div>`;
const isActive = (s) => s.active !== 'no';
const studentOptions = (sel, withAll) =>
  (withAll ? `<option value="">All students</option>` : '') +
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
async function load() {
  for (const k of Object.keys(S)) S[k] = await db.all(k);
}
async function save(store, obj) { await db.put(store, obj); await refresh(); }
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

/* ---------- render ---------- */
const TABS = [['classes', 'Classes'], ['students', 'Students'], ['payments', 'Payments'], ['gallery', 'Gallery'], ['books', 'Books']];
function render() {
  $('#nav').innerHTML = TABS.map(([k, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-go="${k}">${l}</button>`).join('');
  const views = { classes: vClasses, students: ui.studentId ? vStudent : vStudents, payments: vPayments, gallery: vGallery, books: vBooks };
  $('#app').innerHTML = views[ui.tab]();
}
function go(tab) { ui.tab = tab; ui.studentId = null; render(); scrollTo(0, 0); }

/* ---------- classes & attendance ---------- */
function vClasses() {
  const active = S.students.filter(isActive).sort(byName);
  const cs = [...S.classes].sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
  return `<h1>Classes</h1><p class="sub">Add a class, then tap each student to mark them present.</p>
  <div class="card"><div class="two"><input id="cd" type="date" value="${today()}" aria-label="Class date"><input id="ct" placeholder="Time, e.g. 4:00 PM" aria-label="Class time"></div>
  <input id="cp" placeholder="Topic (optional)" aria-label="Topic"><button class="pri" data-act="addClass">Add class</button></div>
  ${cs.map((c) => {
    const here = S.attendance.filter((a) => a.classId === c.id).length;
    return `<div class="card"><div class="row sp"><div><b>${fd(c.date)}</b> <span class="mu">${esc(c.time)}</span><div class="mu">${esc(c.topic)}</div></div>
      <div class="row"><span class="chip neutral">${here} present</span><button class="x" data-act="editClass" data-id="${c.id}">Edit</button><button class="x" data-act="delClass" data-id="${c.id}" aria-label="Delete class">✕</button></div></div>
      <div style="margin-top:10px">${active.length ? active.map((s) => {
        const p = S.attendance.some((a) => a.id === c.id + '_' + s.id);
        return `<button class="tog" data-act="toggle" data-class="${c.id}" data-student="${s.id}">${av(s)}<span class="grow">${esc(s.name)}</span><span class="chip ${p ? 'ok' : 'neutral'}">${p ? 'Present' : 'Absent'}</span></button>`;
      }).join('') + `<button data-act="allPresent" data-id="${c.id}">Mark everyone present</button>` : '<p class="mu">Add students first.</p>'}</div></div>`;
  }).join('') || '<p class="empty">No classes yet. Add your first one above.</p>'}`;
}

/* ---------- students ---------- */
const studentFields = () => [
  { name: 'name', label: 'Student name', required: true },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'guardian', label: 'Parent / guardian' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'fee', label: `Fee per class (${CUR})`, type: 'number' },
  { name: 'joined', label: 'Joined on', type: 'date', default: today() },
  { name: 'active', label: 'Status', type: 'select', options: [{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }] },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
function vStudents() {
  const q = ui.q.toLowerCase();
  const list = S.students.filter((s) => !q || s.name.toLowerCase().includes(q)).sort((a, b) => (isActive(b) - isActive(a)) || byName(a, b));
  return `<div class="row sp"><h1>Students</h1><button class="pri" data-act="addStudent">+ Add student</button></div>
  <p class="sub">Tap a student to see their attendance, payments and work.</p>
  <input id="search" placeholder="Search students" value="${esc(ui.q)}" aria-label="Search students">
  ${list.map((s) => {
    const x = summary(s);
    return `<button class="card tog" data-open="${s.id}">${av(s)}<span class="grow"><b>${esc(s.name)}</b>${isActive(s) ? '' : ' <span class="chip neutral">Inactive</span>'}
      <span class="mu" style="display:block">${x.attended} classes · ${money(s.fee || 0)}/class${x.prepaid ? ` · ${x.prepaidLeft} prepaid left` : ''}</span></span>${balChip(x.balance)}</button>`;
  }).join('') || `<p class="empty">${S.students.length ? 'No match.' : 'No students yet. Add your first student.'}</p>`}`;
}
function vStudent() {
  const s = sById(ui.studentId);
  if (!s) { ui.studentId = null; return vStudents(); }
  const x = summary(s);
  const past = S.classes.filter((c) => c.date <= today()).sort(byDateDesc);
  const pays = S.payments.filter((p) => p.studentId === s.id).sort(byDateDesc);
  const works = S.works.filter((w) => w.studentId === s.id).sort(byDateDesc);
  const info = [['Phone', s.phone], ['Parent / guardian', s.guardian], ['Email', s.email], ['Joined', fd(s.joined)]].filter(([, v]) => v);
  return `<button class="x" data-go="students">← All students</button>
  <div class="row sp" style="margin:8px 0 12px"><div class="row">${av(s)}<h1>${esc(s.name)}</h1></div>
  <div class="row"><button data-act="editStudent" data-id="${s.id}">Edit</button><button class="pri" data-act="addPayment" data-student="${s.id}">+ Payment</button></div></div>
  <div class="card">${info.map(([k, v]) => `<div class="row sp"><span class="mu">${k}</span><span>${esc(v)}</span></div>`).join('') || '<span class="mu">No contact details yet.</span>'}
  ${s.notes ? `<p style="margin:8px 0 0">${esc(s.notes)}</p>` : ''}</div>
  <div class="stats">${stat('Classes attended', x.attended)}${stat('Fee per class', money(s.fee || 0))}${stat('Total paid', money(x.paid))}${stat('Charged', money(x.charged))}
  ${x.prepaid ? stat('Prepaid classes', `${x.prepaidLeft} of ${x.prepaid} left`) : ''}${stat('Balance', balChip(x.balance))}</div>
  <h2>Attendance</h2>
  ${past.length ? table(['Date', 'Topic', 'Status'], past.slice(0, 60).map((c) => {
    const p = S.attendance.some((a) => a.id === c.id + '_' + s.id);
    return [esc(fd(c.date)), esc(c.topic), `<span class="chip ${p ? 'ok' : 'bad'}">${p ? 'Present' : 'Absent'}</span>`];
  })) : '<p class="mu">No classes recorded yet.</p>'}
  <h2>Payments</h2>${pays.length ? payTable(pays, false) : '<p class="mu">No payments yet.</p>'}
  <h2>Work</h2>${works.length ? gallery(works) : '<p class="mu">No photos yet. Add them from the Gallery tab.</p>'}
  <p><button class="x" data-act="delStudent" data-id="${s.id}" style="color:var(--bad)">Delete student and all their records</button></p>`;
}

/* ---------- payments ---------- */
const paymentFields = (studentId) => [
  { name: 'studentId', label: 'Student', type: 'select', required: true, default: studentId,
    options: [...S.students].sort(byName).map((s) => ({ value: s.id, label: s.name })) },
  { name: 'date', label: 'Date paid', type: 'date', required: true, default: today() },
  { name: 'amount', label: `Amount (${CUR})`, type: 'number', required: true },
  { name: 'timing', label: 'Paid for', type: 'select', default: 'after',
    options: [{ value: 'before', label: 'Before classes (prepaid)' }, { value: 'after', label: 'After classes (for classes taken)' }] },
  { name: 'classes', label: 'Classes covered', type: 'number', step: '1', hint: 'For prepaid payments: how many classes this pays for.' },
  { name: 'method', label: 'Method', type: 'select', default: 'Cash', options: METHODS.map((m) => ({ value: m, label: m })) },
  { name: 'note', label: 'Note', placeholder: 'e.g. October classes' },
];
function payTable(pays, withStudent) {
  const head = ['Date', ...(withStudent ? ['Student'] : []), 'For', 'Method', { t: 'Amount', num: true }, ''];
  return table(head, pays.map((p) => [
    esc(fd(p.date)),
    ...(withStudent ? [esc(sById(p.studentId)?.name || '—')] : []),
    p.timing === 'before' ? `Prepaid${p.classes ? ` · ${p.classes} classes` : ''}` : 'After classes',
    esc(p.method) + (p.note ? ` <span class="mu">${esc(p.note)}</span>` : ''),
    money(p.amount),
    `<button class="x" data-act="editPayment" data-id="${p.id}">Edit</button><button class="x" data-act="delPayment" data-id="${p.id}" aria-label="Delete payment">✕</button>`,
  ]));
}
function vPayments() {
  const pays = S.payments.filter((p) => !ui.payFilter || p.studentId === ui.payFilter).sort(byDateDesc);
  const owing = S.students.filter(isActive).map((s) => ({ s, ...summary(s) })).filter((x) => x.balance < -0.004).sort((a, b) => a.balance - b.balance);
  return `<div class="row sp"><h1>Payments</h1><button class="pri" data-act="addPayment" ${S.students.length ? '' : 'disabled'}>+ Record payment</button></div>
  <p class="sub">Record each payment as paid before classes (prepaid) or after classes. Tap Edit to change one.</p>
  <h2>Payment due</h2>
  ${owing.length ? owing.map((x) => `<button class="card tog" data-open="${x.s.id}">${av(x.s)}<span class="grow"><b>${esc(x.s.name)}</b><span class="mu" style="display:block">${x.attended} classes · paid ${money(x.paid)}</span></span>${balChip(x.balance)}</button>`).join('') : '<p class="mu">Nobody owes anything right now.</p>'}
  <div class="row sp"><h2>History</h2><select id="payFilter" style="width:auto;margin:0" aria-label="Filter by student">${studentOptions(ui.payFilter, true)}</select></div>
  ${pays.length ? payTable(pays, true) + `<p class="mu" style="text-align:right">Total: <b>${money(sum(pays.map((p) => p.amount)))}</b></p>` : '<p class="empty">No payments recorded.</p>'}`;
}

/* ---------- gallery ---------- */
function urlFor(w) {
  if (!urls.has(w.id)) urls.set(w.id, URL.createObjectURL(w.blob));
  return urls.get(w.id);
}
function gallery(works) {
  return `<div class="grid">${works.map((w) => {
    const s = sById(w.studentId);
    return `<figure><a href="${urlFor(w)}" target="_blank" rel="noopener"><img src="${urlFor(w)}" alt="${esc(w.title || 'Student work')}" loading="lazy"></a>
    <figcaption><b>${esc(w.title || 'Untitled')}</b><div class="mu">${s ? esc(s.name) + ' · ' : ''}${esc(fd(w.date))}</div>
    <button class="x" data-act="delWork" data-id="${w.id}">Delete</button></figcaption></figure>`;
  }).join('')}</div>`;
}
function vGallery() {
  const works = S.works.filter((w) => !ui.artFilter || w.studentId === ui.artFilter).sort(byDateDesc);
  return `<h1>Gallery</h1><p class="sub">Upload photos of each student's work.</p>
  ${S.students.length ? `<div class="card"><select id="ws" aria-label="Student">${studentOptions(ui.artFilter || '')}</select>
  <div class="two"><input id="wd" type="date" value="${today()}" aria-label="Date"><input id="wt" placeholder="Title (optional)" aria-label="Title"></div>
  <input id="wf" type="file" accept="image/*" multiple aria-label="Photos"><button class="pri" data-act="upload" id="wb">Upload photos</button></div>` : '<p class="mu">Add students first.</p>'}
  <div class="row sp"><h2>Work</h2><select id="artFilter" style="width:auto;margin:0" aria-label="Filter by student">${studentOptions(ui.artFilter, true)}</select></div>
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
    id: p.id, kind: 'pay', date: p.date, desc: `${sById(p.studentId)?.name || 'Student'} — ${p.timing === 'before' ? 'prepaid' : 'after classes'} (${p.method})${p.note ? ', ' + p.note : ''}`, inAmt: p.amount, outAmt: 0,
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
  return `<div class="row sp"><h1>Books</h1><button class="pri" data-act="addExpense">+ Add expense</button></div>
  <p class="sub">Income comes from recorded payments. Add your class expenses here.</p>
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
  <div class="card"><label>Currency symbol<input id="currency" value="${esc(CUR)}" maxlength="4" style="max-width:120px"></label>
  <p class="mu">Your data lives in this browser only. Download a backup regularly, and use Restore to move it to another device.</p>
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
  async addClass() {
    const date = $('#cd').value; if (!date) return;
    await save('classes', { id: nid(), date, time: $('#ct').value.trim(), topic: $('#cp').value.trim() });
  },
  async editClass({ id }) {
    const c = S.classes.find((x) => x.id === id);
    const v = await formModal('Edit class', [{ name: 'date', label: 'Date', type: 'date', required: true }, { name: 'time', label: 'Time' }, { name: 'topic', label: 'Topic' }], c);
    if (v) await save('classes', { ...c, ...v });
  },
  async delClass({ id }) {
    if (!confirm('Delete this class and its attendance?')) return;
    for (const a of S.attendance.filter((a) => a.classId === id)) await db.del('attendance', a.id);
    await remove('classes', id);
  },
  async toggle({ class: classId, student: studentId }) {
    const id = classId + '_' + studentId;
    if (S.attendance.some((a) => a.id === id)) await remove('attendance', id);
    else await save('attendance', { id, classId, studentId });
  },
  async allPresent({ id }) {
    for (const s of S.students.filter(isActive)) await db.put('attendance', { id: id + '_' + s.id, classId: id, studentId: s.id });
    await refresh();
  },
  async addStudent() {
    const v = await formModal('Add student', studentFields(), {}, 'Add');
    if (v) await save('students', { id: nid(), color: COL[S.students.length % COL.length], ...v });
  },
  async editStudent({ id }) {
    const s = sById(id);
    const v = await formModal('Edit student', studentFields(), s);
    if (v) await save('students', { ...s, ...v });
  },
  async delStudent({ id }) {
    const s = sById(id);
    if (!confirm(`Delete ${s.name} and all their attendance, payments and photos? This can't be undone.`)) return;
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
  async delPayment({ id }) { if (confirm('Delete this payment?')) await remove('payments', id); },
  async upload() {
    const files = [...$('#wf').files], studentId = $('#ws').value;
    if (!files.length || !studentId) { alert('Choose a student and at least one photo.'); return; }
    const b = $('#wb'); b.disabled = true; b.textContent = 'Uploading…';
    try {
      for (const f of files) {
        const blob = await shrink(f);
        await db.put('works', { id: nid(), studentId, date: $('#wd').value || today(), title: $('#wt').value.trim(), blob });
      }
    } catch (e) { alert('Upload failed: ' + (e.message || e)); }
    await refresh();
  },
  async delWork({ id }) {
    if (!confirm('Delete this photo?')) return;
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
  async delExpense({ id }) { if (confirm('Delete this expense?')) await remove('expenses', id); },
  exportCsv() {
    const rows = ledger(ui.month);
    const lines = [['Date', 'Type', 'Description', 'In', 'Out'], ...rows.map((r) => [r.date, r.kind === 'pay' ? 'Income' : 'Expense', r.desc, r.inAmt || '', r.outAmt || ''])];
    download(`class-tracker-${ui.month}.csv`, lines.map((l) => l.map(csvCell).join(',')).join('\n'), 'text/csv');
  },
  async backup() {
    const data = { app: 'class-tracker', version: 1, exported: new Date().toISOString(), currency: CUR };
    for (const k of Object.keys(S)) data[k] = await db.all(k);
    data.works = await Promise.all(data.works.map(async (w) => ({ ...w, blob: undefined, dataUrl: await blobToDataUrl(w.blob) })));
    download(`class-tracker-backup-${today()}.json`, JSON.stringify(data), 'application/json');
  },
};

async function restore(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { alert('That file is not a valid backup.'); return; }
  if (data.app !== 'class-tracker') { alert('That file is not a Class Tracker backup.'); return; }
  if (!confirm('Replace ALL current data with this backup?')) return;
  for (const k of Object.keys(S)) {
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
  alert('Backup restored.');
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
  else if (t.id === 'restore' && t.files[0]) restore(t.files[0]);
});

refresh().catch((e) => { $('#app').innerHTML = `<p class="empty">Could not open storage: ${esc(e.message || e)}</p>`; });
