// ============================================================
//  TARGET PATH IN REPO:  api/berita.js
//  list / save / update / delete Berita Acara (arsip cloud).
//  Disimpan di data/berita.json (array dokumen, lampiran inline).
// ============================================================
import { readJSON, writeJSON, verifySecret, readBody, ok, fail, ENV } from './_lib.js';

const DOCS = 'data/berita.json';
const USERS = 'data/users.json';
const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

function makeNomor(seq, tanggal){
  const d = tanggal ? new Date(tanggal) : new Date();
  return `BA/E-COM/${String(seq).padStart(4,'0')}/${ROMAN[d.getMonth()+1]}/${d.getFullYear()}`;
}
async function pinOK(email, pin){
  if(String(pin) === ENV.ADMIN_PIN) return true;
  const { data } = await readJSON(USERS, []);
  const u = (Array.isArray(data)?data:[]).find(x => x.email === String(email||'').toLowerCase().trim());
  return !!(u && verifySecret(String(pin||''), u.pin));
}

export default async function handler(req, res){
  if(req.method !== 'POST') return fail(res, 'Gunakan POST.', 405);
  try{
    const body = await readBody(req);
    const action = body.action;
    const { data: raw, sha } = await readJSON(DOCS, []);
    let docs = Array.isArray(raw) ? raw : [];

    if(action === 'list'){
      docs.sort((a,b)=>(b.seq||0)-(a.seq||0));
      return ok(res, { docs });
    }

    if(action === 'save'){
      if(!await pinOK(body.email, body.pin)) return fail(res, 'PIN salah.', 401);
      const seq = docs.reduce((m,d)=>Math.max(m, d.seq||0), 0) + 1;
      const nomor = makeNomor(seq, body.data && body.data.tanggal);
      const id = 'BA' + Date.now() + Math.floor(Math.random()*1000);
      docs.push({ id, seq, nomor, ownerEmail: body.email, data: body.data || {}, ts: Date.now() });
      await writeJSON(DOCS, docs, 'save ' + nomor);
      return ok(res, { id, nomor, seq, attachments: [] });
    }

    if(action === 'update'){
      if(!await pinOK(body.email, body.pin)) return fail(res, 'PIN salah.', 401);
      const d = docs.find(x => x.id === body.id);
      if(!d) return fail(res, 'Dokumen tidak ditemukan.', 404);
      d.data = body.data || {}; d.ts = Date.now();
      await writeJSON(DOCS, docs, 'update ' + d.nomor);
      return ok(res, { attachments: [] });
    }

    if(action === 'delete'){
      if(!await pinOK(body.email, body.pin)) return fail(res, 'PIN salah.', 401);
      docs = docs.filter(x => x.id !== body.id);
      await writeJSON(DOCS, docs, 'delete ' + body.id);
      return ok(res, {});
    }

    return fail(res, 'Aksi tidak dikenal.');
  }catch(e){ return fail(res, e.message, 500); }
}

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };
