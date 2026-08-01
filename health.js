// ============================================================
//  TARGET PATH IN REPO:  api/health.js
//  Versi BERSIH untuk produksi — hanya cek "hidup", tanpa
//  membocorkan konfigurasi. Frontend memakainya untuk deteksi
//  mode Cloud vs Lokal.
// ============================================================
export default async function handler(req, res){
  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify({ ok: true, service: 'ecom-ops', ts: Date.now() }));
}
