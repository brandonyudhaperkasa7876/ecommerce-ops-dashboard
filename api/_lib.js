// ============================================================
//  TARGET PATH IN REPO:  api/_lib.js
//  Shared helper — GitHub storage + auth + JSON responses.
//  Runs as a Vercel Serverless Function (Node 18+). Token is
//  read from process.env and NEVER exposed to the browser.
// ============================================================
import crypto from 'node:crypto';

const clean = v => (v == null ? '' : String(v)).trim();
const OWNER  = clean(process.env.GITHUB_OWNER);
const REPO   = clean(process.env.GITHUB_REPO);
const BRANCH = clean(process.env.GITHUB_BRANCH) || 'main';
const TOKEN  = clean(process.env.GITHUB_TOKEN);

// Info aman untuk diagnostik (tidak membocorkan token)
export const TOKEN_INFO = {
  length: TOKEN.length,
  prefix: TOKEN.slice(0, 8),
  looksFineGrained: TOKEN.startsWith('github_pat_'),
  looksClassic: TOKEN.startsWith('ghp_'),
  hadWhitespace: clean(process.env.GITHUB_TOKEN).length !== String(process.env.GITHUB_TOKEN || '').length
};

export const ENV = {
  ADMIN_PIN: process.env.ADMIN_PIN || '10111976',
  SUPER_ADMIN_EMAIL: (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim()
};

function assertConfig(){
  if(!OWNER || !REPO || !TOKEN)
    throw new Error('Server belum dikonfigurasi (GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN).');
}

const GH = 'https://api.github.com';
function ghHeaders(){
  return {
    'Authorization': 'Bearer ' + TOKEN,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ecom-ops-dashboard'
  };
}

// ---- low-level file get: returns {sha, contentB64} or null (404) ----
export async function ghGetFile(path){
  assertConfig();
  const url = `${GH}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(BRANCH)}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if(r.status === 404) return null;
  if(!r.ok){ const t = await r.text(); throw new Error('GitHub GET gagal: ' + r.status + ' ' + t.slice(0,200)); }
  const j = await r.json();
  return { sha: j.sha, contentB64: (j.content || '').replace(/\n/g,'') };
}

// ---- nilai konfigurasi (bukan rahasia) untuk cek salah-ketik ----
export const CFG_VALUES = { owner: OWNER, repo: REPO, branch: BRANCH, expectedPath: `${OWNER}/${REPO}` };

// ---- identitas token: akun pemilik token ----
export async function ghWhoAmI(){
  const r = await fetch(`${GH}/user`, { headers: ghHeaders() });
  let j = {}; try{ j = await r.json(); }catch(e){}
  return { status: r.status, login: j.login || null };
}

// ---- diagnostik: info repo + izin token (permissions.push = akses tulis) ----
export async function ghRepoInfo(){
  const url = `${GH}/repos/${OWNER}/${REPO}`;
  const r = await fetch(url, { headers: ghHeaders() });
  let j = {}; try{ j = await r.json(); }catch(e){}
  return {
    status: r.status,
    full_name: j.full_name || null,
    default_branch: j.default_branch || null,
    private: j.private,
    permissions: j.permissions || null,
    owner_type: j.owner ? j.owner.type : null
  };
}

// ---- low-level file put (create or update) ----
export async function ghPutFile(path, contentB64, message, sha){
  assertConfig();
  const url = `${GH}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}`;
  const body = { message: message || ('update ' + path), content: contentB64, branch: BRANCH };
  if(sha) body.sha = sha;
  const r = await fetch(url, { method:'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
  if(!r.ok){ const t = await r.text(); throw new Error('GitHub PUT gagal: ' + r.status + ' ' + t.slice(0,200)); }
  return await r.json();
}

// ---- JSON convenience ----
export async function readJSON(path, fallback){
  const f = await ghGetFile(path);
  if(!f) return { data: (fallback ?? null), sha: null };
  try{
    const txt = Buffer.from(f.contentB64, 'base64').toString('utf8');
    return { data: JSON.parse(txt), sha: f.sha };
  }catch(e){ return { data: (fallback ?? null), sha: f.sha }; }
}
export async function writeJSON(path, obj, message){
  const cur = await ghGetFile(path);
  const contentB64 = Buffer.from(JSON.stringify(obj, null, 2), 'utf8').toString('base64');
  return await ghPutFile(path, contentB64, message, cur ? cur.sha : undefined);
}

// ---- password / pin hashing (scrypt) ----
export function hashSecret(secret){
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 32).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}
export function verifySecret(secret, stored){
  if(!stored) return false;
  const parts = String(stored).split('$');
  if(parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const hash = crypto.scryptSync(String(secret), parts[1], 32).toString('hex');
  try{ return crypto.timingSafeEqual(Buffer.from(hash,'hex'), Buffer.from(parts[2],'hex')); }
  catch(e){ return false; }
}

// ---- request / response helpers ----
export async function readBody(req){
  if(req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve)=>{
    let s=''; req.on('data', c=> s+=c); req.on('end', ()=>{ try{ resolve(s?JSON.parse(s):{}); }catch(e){ resolve({}); } });
  });
}
export function ok(res, obj){ res.setHeader('Content-Type','application/json'); res.status(200).end(JSON.stringify(Object.assign({ok:true}, obj||{}))); }
export function fail(res, msg, code){ res.setHeader('Content-Type','application/json'); res.status(code||400).end(JSON.stringify({ok:false, error: msg || 'Permintaan gagal.'})); }
