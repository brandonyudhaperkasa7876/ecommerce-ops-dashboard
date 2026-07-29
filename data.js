// ============================================================
//  TARGET PATH IN REPO:  api/data.js
//  GET  ?set=monitoring|sales   -> read shared dataset (any user)
//  POST {set,payload,pin}       -> publish dataset (Super Admin PIN)
//  Data disimpan di data/<set>.json pada repo GitHub.
// ============================================================
import { readJSON, writeJSON, readBody, ok, fail, ENV } from './_lib.js';

const ALLOWED = ['monitoring', 'sales'];
const pathFor = set => 'data/' + set + '.json';

export default async function handler(req, res){
  try{
    if(req.method === 'GET'){
      const set = String((req.query && req.query.set) || '').trim();
      if(!ALLOWED.includes(set)) return fail(res, 'Dataset tidak dikenal.');
      const { data } = await readJSON(pathFor(set), { payload:null, updatedAt:null });
      const rec = data || { payload:null, updatedAt:null };
      return ok(res, { set, payload: rec.payload ?? null, updatedAt: rec.updatedAt ?? null });
    }

    if(req.method === 'POST'){
      const body = await readBody(req);
      const set = String(body.set||'').trim();
      if(!ALLOWED.includes(set)) return fail(res, 'Dataset tidak dikenal.');
      if(String(body.pin||'') !== ENV.ADMIN_PIN) return fail(res, 'PIN publish salah (khusus Super Admin).', 401);
      const rec = { payload: body.payload ?? null, updatedAt: new Date().toISOString() };
      await writeJSON(pathFor(set), rec, 'publish dataset ' + set);
      return ok(res, { set, updatedAt: rec.updatedAt });
    }

    return fail(res, 'Method tidak didukung.', 405);
  }catch(e){ return fail(res, e.message, 500); }
}

// Payload untuk 'sales' bisa besar (workbook base64). Naikkan limit body.
export const config = { api: { bodyParser: { sizeLimit: '25mb' } } };
