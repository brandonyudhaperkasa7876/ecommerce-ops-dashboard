// ============================================================
//  TARGET PATH IN REPO:  api/health.js
//  Simple liveness check — frontend uses this to detect cloud.
// ============================================================
export default async function handler(req, res){
  res.setHeader('Content-Type','application/json');
  res.status(200).end(JSON.stringify({ ok:true, service:'ecom-ops', ts: Date.now() }));
}
