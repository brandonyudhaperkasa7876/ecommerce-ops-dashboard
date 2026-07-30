// ============================================================
//  TARGET PATH IN REPO:  api/health.js
//  Liveness + DIAGNOSTIK konfigurasi (aman: hanya boolean/status,
//  tidak pernah menampilkan nilai token/password).
// ============================================================
import { readJSON, writeJSON, ENV, TOKEN_INFO, ghRepoInfo } from './_lib.js';

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
  // Info repo + izin token (permissions.push harus true untuk bisa menulis)
  try {
    diag.repoInfo = await ghRepoInfo();
    if (diag.repoInfo && diag.repoInfo.permissions) {
      diag.canPush = diag.repoInfo.permissions.push === true;
      diag.pushHint = diag.canPush
        ? 'Token punya akses tulis (push=true).'
        : 'Token TIDAK punya akses tulis (push=false) → inilah penyebab 404. Perbaiki izin/token di Vercel.';
    }
  } catch (e) { diag.repoInfo = 'ERROR: ' + e.message; }
  // Uji tulis: buka /api/health?writetest=1
  if (req.query && (req.query.writetest === '1' || req.query.writetest === 'true')) {
    try {
      await writeJSON('data/_writetest.json', { ok: true, ts: Date.now() }, 'write test');
      diag.writeTest = 'OK — token runtime BISA menulis ke repo.';
    } catch (e) {
      diag.writeTest = 'GAGAL — ' + e.message;
      diag.writeHint = 'Token yang dipakai Vercel tidak punya izin tulis. Pastikan GITHUB_TOKEN di Vercel = token dengan Contents: Read and write, lalu Redeploy.';
    }
  }
  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify(diag, null, 2));
}
