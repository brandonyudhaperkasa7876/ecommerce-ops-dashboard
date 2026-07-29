// ============================================================
//  TARGET PATH IN REPO:  api/health.js
//  Liveness + DIAGNOSTIK konfigurasi (aman: hanya boolean/status,
//  tidak pernah menampilkan nilai token/password).
// ============================================================
import { readJSON, ENV, TOKEN_INFO } from './_lib.js';

export default async function handler(req, res){
  const diag = {
    ok: true,
    service: 'ecom-ops',
    ts: Date.now(),
    env: {
      GITHUB_OWNER: process.env.GITHUB_OWNER ? 'set' : 'MISSING',
      GITHUB_REPO: process.env.GITHUB_REPO ? 'set' : 'MISSING',
      GITHUB_BRANCH: process.env.GITHUB_BRANCH || '(default: main)',
      GITHUB_TOKEN: process.env.GITHUB_TOKEN ? 'set' : 'MISSING',
      SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL ? 'set' : 'MISSING',
      SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD ? 'set' : 'MISSING',
      SEED_ADMIN_PIN: process.env.SEED_ADMIN_PIN ? 'set' : 'MISSING'
    },
    tokenInfo: TOKEN_INFO
  };
  // Uji koneksi GitHub + status akun
  try {
    const { data } = await readJSON('data/users.json', []);
    const users = Array.isArray(data) ? data : [];
    diag.github = 'OK (repo terbaca & token valid)';
    diag.usersCount = users.length;
    diag.superAdminExists = !!users.find(u => u.email === (ENV.SUPER_ADMIN_EMAIL || ''));
    diag.canWriteHint = 'Jika superAdminExists=false tetapi semua env "set", coba login/daftar sekali (server akan membuat akun).';
  } catch (e) {
    diag.github = 'ERROR: ' + e.message;
    diag.hint = 'Cek GITHUB_TOKEN (izin Contents: Read and write), GITHUB_OWNER, GITHUB_REPO, dan pastikan file data/users.json ada di repo.';
  }
  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify(diag, null, 2));
}
