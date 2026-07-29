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
  const pass  = process.env.SEED_ADMIN_PASSWORD || '';
  const pin   = process.env.SEED_ADMIN_PIN || '';
  if(!email || !pass) return false;
  if(users.find(u => u.email === email)) return false;
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

    return fail(res, 'Aksi tidak dikenal.');
  }catch(e){ return fail(res, e.message, 500); }
}
