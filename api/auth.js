// ============================================================
//  TARGET PATH IN REPO:  api/auth.js
//  register / login / verifyPin — users stored in data/users.json
// ============================================================
import { readJSON, writeJSON, hashSecret, verifySecret, readBody, ok, fail, ENV } from './_lib.js';

const USERS = 'data/users.json';

// Auto-seed Super Admin dari Environment Variables (aman: kredensial tidak
// disimpan di repo). Butuh: SUPER_ADMIN_EMAIL + SEED_ADMIN_PASSWORD
// (opsional: SEED_ADMIN_PIN, SEED_ADMIN_NAME).
async function ensureSeed(users){
  const email = ENV.SUPER_ADMIN_EMAIL;
  if(!email) return false;
  // Jika user sudah ada: pastikan perannya admin (naikkan bila masih viewer).
  const existing = users.find(u => u.email === email);
  if(existing){
    if(existing.role !== 'admin'){
      existing.role = 'admin';
      await writeJSON(USERS, users, 'promote super admin ' + email);
      return true;
    }
    return false;
  }
  // Belum ada: buat akun Super Admin dari env.
  const pass = process.env.SEED_ADMIN_PASSWORD || '';
  const pin  = process.env.SEED_ADMIN_PIN || '';
  if(!pass) return false;
  users.push({
    email,
    name: process.env.SEED_ADMIN_NAME || 'Super Admin',
    role: 'admin',
    pass: hashSecret(pass),
    pin:  hashSecret(pin || ENV.ADMIN_PIN),
    createdAt: new Date().toISOString(),
    seeded: true
  });
  await writeJSON(USERS, users, 'seed super admin ' + email);
  return true;
}

function isAdminPin(users, pin){
  const p = String(pin || '');
  if(!p) return false;
  if(p === ENV.ADMIN_PIN) return true;
  return users.some(u => u.role === 'admin' && verifySecret(p, u.pin));
}

export default async function handler(req, res){
  if(req.method !== 'POST') return fail(res, 'Gunakan POST.', 405);
  let body;
  try{ body = await readBody(req); }catch(e){ return fail(res, 'Body tidak valid.'); }
  const action = body.action;
  try{
    const { data: usersRaw } = await readJSON(USERS, []);
    const users = Array.isArray(usersRaw) ? usersRaw : [];
    await ensureSeed(users);

    if(action === 'register'){
      const email = String(body.email||'').toLowerCase().trim();
      const name  = String(body.name||'').trim();
      const password = String(body.password||'');
      const pin = String(body.pin||'');
      if(!email || !name) return fail(res, 'Nama & email wajib.');
      if(password.length < 6) return fail(res, 'Password minimal 6 karakter.');
      if(!/^\d{4,8}$/.test(pin)) return fail(res, 'PIN harus 4–8 digit.');
      if(users.find(u => u.email === email)) return fail(res, 'Email sudah terdaftar.');
      const isFirst = users.length === 0;
      const role = (ENV.SUPER_ADMIN_EMAIL && email === ENV.SUPER_ADMIN_EMAIL) || isFirst ? 'admin' : 'viewer';
      const user = { email, name, role, pass: hashSecret(password), pin: hashSecret(pin), createdAt: new Date().toISOString() };
      users.push(user);
      await writeJSON(USERS, users, 'register ' + email);
      return ok(res, { user: { email, name, role } });
    }

    if(action === 'login'){
      const email = String(body.email||'').toLowerCase().trim();
      const u = users.find(x => x.email === email);
      if(!u || !verifySecret(String(body.password||''), u.pass)) return fail(res, 'Email atau password salah.', 401);
      return ok(res, { user: { email: u.email, name: u.name, role: u.role } });
    }

    if(action === 'verifyPin'){
      const email = String(body.email||'').toLowerCase().trim();
      const pin = String(body.pin||'');
      const u = users.find(x => x.email === email);
      const valid = (u && verifySecret(pin, u.pin)) || (pin === ENV.ADMIN_PIN);
      return ok(res, { valid: !!valid });
    }

    // ---- Sinkron peran terkini dari server (untuk menyegarkan sesi lama) ----
    if(action === 'getRole'){
      const email = String(body.email||'').toLowerCase().trim();
      const u = users.find(x => x.email === email);
      return ok(res, { exists: !!u, role: u ? u.role : null, name: u ? u.name : null });
    }

    // ---- Lupa password: reset mandiri memakai PIN sebagai kunci pemulihan ----
    if(action === 'resetPassword'){
      const email = String(body.email||'').toLowerCase().trim();
      const pin = String(body.pin||'');
      const np = String(body.newPassword||'');
      const u = users.find(x => x.email === email);
      if(!u) return fail(res, 'Email tidak terdaftar.', 404);
      if(!verifySecret(pin, u.pin) && pin !== ENV.ADMIN_PIN) return fail(res, 'PIN tidak cocok.', 401);
      if(np.length < 6) return fail(res, 'Password baru minimal 6 karakter.');
      u.pass = hashSecret(np);
      await writeJSON(USERS, users, 'reset password ' + email);
      return ok(res, {});
    }

    // ---- Kelola user (khusus admin): butuh PIN admin (ADMIN_PIN atau PIN akun admin) ----
    if(action === 'listUsers'){
      if(!isAdminPin(users, body.pin)) return fail(res, 'PIN admin salah.', 401);
      return ok(res, { users: users.map(u => ({ email:u.email, name:u.name, role:u.role, createdAt:u.createdAt||null, seeded:!!u.seeded })) });
    }
    if(action === 'setRole'){
      if(!isAdminPin(users, body.pin)) return fail(res, 'PIN admin salah.', 401);
      const email = String(body.email||'').toLowerCase().trim();
      const role = body.role === 'admin' ? 'admin' : 'viewer';
      const u = users.find(x => x.email === email);
      if(!u) return fail(res, 'User tidak ditemukan.', 404);
      if(u.role === 'admin' && role !== 'admin' && users.filter(x => x.role === 'admin').length <= 1)
        return fail(res, 'Tidak bisa menurunkan Super Admin terakhir.');
      u.role = role;
      await writeJSON(USERS, users, 'set role ' + email + ' -> ' + role);
      return ok(res, { email, role });
    }
    if(action === 'deleteUser'){
      if(!isAdminPin(users, body.pin)) return fail(res, 'PIN admin salah.', 401);
      const email = String(body.email||'').toLowerCase().trim();
      const target = users.find(x => x.email === email);
      if(target && target.role === 'admin' && users.filter(x => x.role === 'admin').length <= 1)
        return fail(res, 'Tidak bisa menghapus Super Admin terakhir.');
      const filtered = users.filter(x => x.email !== email);
      await writeJSON(USERS, filtered, 'delete user ' + email);
      return ok(res, {});
    }

    return fail(res, 'Aksi tidak dikenal.');
  }catch(e){ return fail(res, e.message, 500); }
}
