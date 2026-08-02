// ============================================================
//  TARGET PATH IN REPO:  api/schedule.js
//  Penjadwalan Tim Kerja — penyimpanan per-user dengan MERGE
//  di server (read-modify-write + retry) agar edit satu user
//  tidak menimpa data user lain.
//
//  Model payload data/schedule.json:
//  {
//    members:     { "<email>": {email,name,nik,dob,gender,photo,role,updatedAt} },
//    assignments: { "<email>": { "YYYY-MM-DD": "P|S|M|L|C" } },
//    tasks:       { "<email>": { "YYYY-MM-DD": { "<0..23>": {task, status} } } }
//  }
// ============================================================
import { ghGetFile, ghPutFile, readJSON, verifySecret, readBody, ok, fail, ENV } from './_lib.js';
import zlib from 'node:zlib';

const FILE  = 'data/schedule.json';
const BOARD = 'data/board.json';
const USERS = 'data/users.json';
const ROLES = ['Admin', 'Pick Pack', 'Data Support', 'Supervisor'];
const STATUSES = ['belum', 'berlangsung', 'tertunda', 'berkendala', 'selesai'];
const SHIFTS = ['P', 'S', 'M', 'L', 'C'];
const lc = s => String(s || '').toLowerCase().trim();

async function loadUsers(){ const { data } = await readJSON(USERS, []); return Array.isArray(data) ? data : []; }

// admin bila PIN = ADMIN_PIN atau PIN milik user ber-role admin
function isAdmin(users, pin){
  const p = String(pin || '');
  if(!p) return false;
  if(p === ENV.ADMIN_PIN) return true;
  return users.some(u => (u.role === 'admin' || u.role === 'owner') && verifySecret(p, u.pin));
}
// editor board = owner/admin/regular (bukan viewer), atau ADMIN_PIN
function isEditor(users, pin){
  const p = String(pin || '');
  if(!p) return false;
  if(p === ENV.ADMIN_PIN) return true;
  return users.some(u => (u.role==='owner'||u.role==='admin'||u.role==='regular') && verifySecret(p, u.pin));
}
// boleh edit target: admin/owner, atau (pin milik actor & actor === target)
function canEdit(users, actorEmail, pin, target){
  if(isAdmin(users, pin)) return true;
  const actor = users.find(u => u.email === lc(actorEmail));
  if(!actor || !verifySecret(String(pin || ''), actor.pin)) return false;
  return lc(actorEmail) === lc(target);
}

// read-modify-write dengan retry (hindari saling menimpa)
async function mutate(apply){
  let extra = {};
  for(let i = 0; i < 4; i++){
    const f = await ghGetFile(FILE);
    let payload = {};
    if(f){ try{ payload = (JSON.parse(Buffer.from(f.contentB64, 'base64').toString('utf8')) || {}).payload || {}; }catch(e){} }
    const s = { members: payload.members || {}, assignments: payload.assignments || {}, tasks: payload.tasks || {}, locks: payload.locks || {} };
    extra = apply(s) || {};
    const rec = { payload: { members: s.members, assignments: s.assignments, tasks: s.tasks, locks: s.locks }, updatedAt: new Date().toISOString() };
    const contentB64 = Buffer.from(JSON.stringify(rec, null, 2), 'utf8').toString('base64');
    try{ await ghPutFile(FILE, contentB64, 'schedule ' + (extra.msg || 'update'), f ? f.sha : undefined); return { updatedAt: rec.updatedAt, extra }; }
    catch(e){ if(i < 3 && /409|422|sha|conflict|Not Found/i.test(e.message)) { await new Promise(r => setTimeout(r, 120 * (i + 1))); continue; } throw e; }
  }
  throw new Error('Gagal menyimpan (konflik berulang). Coba lagi.');
}

export default async function handler(req, res){
  if(req.method !== 'POST') return fail(res, 'Gunakan POST.', 405);
  try{
    let b = await readBody(req);
    if(b && b.gz){ try{ b = JSON.parse(zlib.gunzipSync(Buffer.from(b.gz, 'base64')).toString('utf8')); }catch(e){ return fail(res, 'Gagal dekompres payload.'); } }
    const action = b.action;
    const actor = lc(b.email);
    const pin = b.pin;
    const users = await loadUsers();

    if(action === 'get'){
      const { data } = await readJSON(FILE, { payload: null });
      return ok(res, { payload: (data && data.payload) || null });
    }

    // ---- Board (jadwal.html): team + tasks bersama ----
    if(action === 'getBoard'){
      const { data } = await readJSON(BOARD, { payload: null });
      return ok(res, { payload: (data && data.payload) || null });
    }
    if(action === 'saveBoard'){
      if(!isEditor(users, pin)) return fail(res, 'Hanya Owner/Super Admin/Admin yang dapat menyimpan (Viewer hanya melihat).', 403);
      const team = Array.isArray(b.team) ? b.team : [];
      const tasks = Array.isArray(b.tasks) ? b.tasks : [];
      const rec = { payload: { team, tasks }, updatedAt: new Date().toISOString() };
      // tulis dengan retry sederhana
      let done = false, lastErr;
      for(let i=0;i<3 && !done;i++){
        const f = await ghGetFile(BOARD);
        const contentB64 = Buffer.from(JSON.stringify(rec, null, 2), 'utf8').toString('base64');
        try{ await ghPutFile(BOARD, contentB64, 'save board', f ? f.sha : undefined); done = true; }
        catch(e){ lastErr = e; if(/409|422|sha|conflict|Not Found/i.test(e.message)){ await new Promise(r=>setTimeout(r,120*(i+1))); continue; } throw e; }
      }
      if(!done) throw lastErr || new Error('Gagal menyimpan board.');
      return ok(res, { updatedAt: rec.updatedAt });
    }

    if(action === 'saveProfile'){
      const target = lc(b.target || actor);
      if(!canEdit(users, actor, pin, target)) return fail(res, 'Tidak diizinkan mengubah profil ini.', 403);
      const admin = isAdmin(users, pin);
      const pr = b.profile || {};
      const r = await mutate(s => {
        const m = s.members[target] || { email: target, role: '' };
        if(pr.name !== undefined) m.name = String(pr.name || '');
        if(pr.nik !== undefined) m.nik = String(pr.nik || '');
        if(pr.dob !== undefined) m.dob = String(pr.dob || '');
        if(pr.gender !== undefined) m.gender = String(pr.gender || '');
        if(pr.photo !== undefined) m.photo = String(pr.photo || '');
        if(admin && pr.role !== undefined && ROLES.includes(pr.role)) m.role = pr.role;
        m.updatedAt = new Date().toISOString();
        s.members[target] = m;
        return { msg: 'profile ' + target };
      });
      return ok(res, { updatedAt: r.updatedAt });
    }

    if(action === 'setRole'){
      if(!isAdmin(users, pin)) return fail(res, 'Hanya Super Admin dapat menetapkan fungsi/tugas.', 403);
      const target = lc(b.target);
      const role = ROLES.includes(b.role) ? b.role : '';
      const r = await mutate(s => {
        const m = s.members[target] || { email: target };
        m.role = role; m.updatedAt = new Date().toISOString();
        s.members[target] = m;
        return { msg: 'role ' + target };
      });
      return ok(res, { updatedAt: r.updatedAt });
    }

    if(action === 'saveDay'){
      const target = lc(b.target || actor);
      if(!canEdit(users, actor, pin, target)) return fail(res, 'Tidak diizinkan mengubah jadwal user ini.', 403);
      const date = String(b.date || '');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, 'Tanggal tidak valid.');
      // tanggal terkunci (approved) hanya boleh diubah oleh Super Admin/Owner
      const cur = await readJSON(FILE, { payload: null });
      const pl = (cur.data && cur.data.payload) || {};
      if(pl.locks && pl.locks[target] && pl.locks[target][date] && !isAdmin(users, pin))
        return fail(res, 'Tanggal ini sudah di-approve & terkunci. Minta Super Admin/Owner membuka kunci.', 403);
      const r = await mutate(s => {
        if(b.shift !== undefined){
          s.assignments[target] = s.assignments[target] || {};
          if(b.shift === '' || b.shift === null) delete s.assignments[target][date];
          else if(SHIFTS.includes(b.shift)) s.assignments[target][date] = b.shift;
        }
        if(b.dayTasks !== undefined && b.dayTasks !== null){
          s.tasks[target] = s.tasks[target] || {};
          const clean = {};
          Object.keys(b.dayTasks || {}).forEach(h => {
            const t = b.dayTasks[h] || {};
            const task = String(t.task || '').slice(0, 500);
            const status = STATUSES.includes(t.status) ? t.status : '';
            if(task || status) clean[h] = { task, status };
          });
          if(Object.keys(clean).length) s.tasks[target][date] = clean;
          else if(s.tasks[target]) delete s.tasks[target][date];
        }
        return { msg: 'day ' + target + ' ' + date };
      });
      return ok(res, { updatedAt: r.updatedAt });
    }

    if(action === 'setLock'){
      if(!isAdmin(users, pin)) return fail(res, 'Hanya Super Admin/Owner dapat approve/kunci tanggal.', 403);
      const target = lc(b.target || actor);
      const date = String(b.date || '');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, 'Tanggal tidak valid.');
      const r = await mutate(s => {
        s.locks[target] = s.locks[target] || {};
        if(b.locked) s.locks[target][date] = true; else delete s.locks[target][date];
        return { msg: 'lock ' + target + ' ' + date };
      });
      return ok(res, { updatedAt: r.updatedAt });
    }

    if(action === 'autoGenerate'){
      if(!isAdmin(users, pin)) return fail(res, 'Hanya Super Admin dapat generate otomatis.', 403);
      const emails = (b.emails || []).map(lc);
      const start = String(b.start || '');
      const days = Math.max(1, Math.min(366, parseInt(b.days || 7, 10)));
      const pattern = b.pattern || 'rotasi';   // 'rotasi' | 'pagi' | 'siang' | 'malam' | '5-2'
      const overwrite = !!b.overwrite;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(start)) return fail(res, 'Tanggal mulai tidak valid.');
      const r = await mutate(s => {
        const base = new Date(start + 'T00:00:00');
        emails.forEach((em, ei) => {
          s.assignments[em] = s.assignments[em] || {};
          for(let d = 0; d < days; d++){
            const dt = new Date(base); dt.setDate(dt.getDate() + d);
            const iso = dt.toISOString().slice(0, 10);
            const dow = (dt.getDay() + 6) % 7; // 0=Mon
            if(!overwrite && s.assignments[em][iso]) continue;
            let sh;
            if(pattern === 'pagi') sh = (dow >= 5) ? 'L' : 'P';
            else if(pattern === 'siang') sh = (dow >= 5) ? 'L' : 'S';
            else if(pattern === 'malam') sh = (dow >= 5) ? 'L' : 'M';
            else if(pattern === '5-2') sh = (dow >= 5) ? 'L' : 'P';
            else { // rotasi mingguan per orang: geser tiap minggu & per orang
              const wk = Math.floor(d / 7);
              const cyc = (wk + ei) % 3;
              sh = (dow >= 5) ? 'L' : (cyc === 0 ? 'P' : cyc === 1 ? 'S' : 'M');
            }
            s.assignments[em][iso] = sh;
          }
        });
        return { msg: 'auto-generate' };
      });
      return ok(res, { updatedAt: r.updatedAt });
    }

    if(action === 'deleteMember'){
      if(!isAdmin(users, pin)) return fail(res, 'Hanya Super Admin dapat menghapus anggota.', 403);
      const target = lc(b.target);
      const r = await mutate(s => {
        delete s.members[target]; delete s.assignments[target]; delete s.tasks[target];
        return { msg: 'delete ' + target };
      });
      return ok(res, { updatedAt: r.updatedAt });
    }

    return fail(res, 'Aksi tidak dikenal.');
  }catch(e){ return fail(res, e.message, 500); }
}

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };
