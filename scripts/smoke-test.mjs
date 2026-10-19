process.env.PORT = process.env.PORT || String(3100 + Math.floor(Math.random() * 4000));
setTimeout(() => {
  console.error('SMOKE_TEST_TIMEOUT');
  process.exit(2);
}, 25000);

await import('../server.js');
import http from 'node:http';

const basePort = Number(process.env.PORT);

function request(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const body = opts.body || '';
    const headers = { Connection: 'close', ...(opts.headers || {}) };
    if (body && !headers['Content-Length']) headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request({ hostname: '127.0.0.1', port: basePort, path, method: opts.method || 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body: text });
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error(`request timeout: ${path}`)));
    req.on('error', reject);
    req.end(body);
  });
}
function form(obj){ return new URLSearchParams(obj).toString(); }
async function waitReady(){
  const start = Date.now();
  while(Date.now() - start < 10000){
    try { const r = await request('/api/health'); if(r.status === 200) return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('server not ready');
}
async function assertPath(path){
  console.log(`smoke: GET ${path}`);
  const r = await request(path);
  if (r.status < 200 || r.status >= 400) throw new Error(`${path} ${r.status}`);
}
try {
  await waitReady();
  const paths = ['/', '/theme', '/demo', '/student/login', '/teacher/login', '/admin/login', '/practice', '/resources', '/api/health', '/api/analytics', '/static/materials/ir-spectrum.png', '/static/materials/ecoli-inhibition.png', '/static/models/limonene.glb'];
  for (const p of paths) await assertPath(p);
  console.log('smoke: student login');
  const auth = await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form({role:'student',username:'student001',password:'123456'})});
  if(auth.status !== 302 || !String(auth.headers.location||'').includes('/submit')) throw new Error('student login failed');
  const cookie = Array.isArray(auth.headers['set-cookie']) ? auth.headers['set-cookie'][0].split(';')[0] : String(auth.headers['set-cookie']||'').split(';')[0];
  console.log('smoke: student workspace');
  const submit = await request('/submit',{headers:{Cookie:cookie}});
  if(submit.status !== 200 || !submit.body.includes('学生探究工作台')) throw new Error('student workspace failed');
  console.log('smoke: teacher login');
  const teacherAuth = await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form({role:'teacher',username:'teacher001',password:'123456'})});
  if(teacherAuth.status !== 302 || !String(teacherAuth.headers.location||'').includes('/admin')) throw new Error('teacher login failed');
  console.log('smoke: admin login');
  const adminAuth = await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form({role:'admin',username:'admin',password:'123456'})});
  if(adminAuth.status !== 302) throw new Error('admin login failed');
  const adminCookie = Array.isArray(adminAuth.headers['set-cookie']) ? adminAuth.headers['set-cookie'][0].split(';')[0] : String(adminAuth.headers['set-cookie']||'').split(';')[0];
  console.log('smoke: admin reset password');
  const reset = await request('/api/admin/reset-password',{method:'POST',headers:{'Content-Type':'application/json',Cookie:adminCookie},body:JSON.stringify({username:'student001'})});
  if(reset.status !== 200 || !reset.body.includes('ok')) throw new Error(`admin reset password failed: ${reset.status} ${reset.body}`);
  console.log('SMOKE_TEST_PASS');
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
