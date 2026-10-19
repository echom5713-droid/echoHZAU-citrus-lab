import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'docs/deployment-source-manifest.json'), 'utf8'));
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'data'].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p));
    else if (/\.(js|mjs|cjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}
const jsFiles = await walk(root);
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${path.relative(root, file)}: ${result.stderr}`);
}
for (const entry of manifest.files.filter(f => f.published)) {
  const b = await readFile(path.join(root, entry.path));
  assert.equal(createHash('sha256').update(b).digest('hex'), entry.sha256, `Deployment fingerprint: ${entry.path}`);
}
console.log(`PASS: ${jsFiles.length} JavaScript syntax checks; ${manifest.files.filter(f => f.published).length} deployment fingerprints`);

async function freePort() {
  const s = createServer();
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(0, '127.0.0.1', resolve); });
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return port;
}

async function checkMode(mode) {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'citrus-source-check-'));
  let child;
  let closed;
  try {
    for (const name of ['package.json', 'server.js', 'src', 'public', 'scripts']) {
      await cp(path.join(root, name), path.join(sandbox, name), { recursive: true });
    }
    const env = { ...process.env, STORAGE_MODE: mode === 'json' ? 'json' : '', DEEPSEEK_API_KEY: '', LLM_API_KEY: '' };
    const security = spawnSync(process.execPath, ['scripts/security-check.mjs'], { cwd: sandbox, env, encoding: 'utf8', timeout: 90000 });
    assert.equal(security.status, 0, `Security check (${mode}): ${security.error?.message || security.stderr || security.stdout}`);
    const port = await freePort();
    let logs = '';
    child = spawn(process.execPath, ['scripts/start-production.mjs'], { cwd: sandbox, env: { ...env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    closed = new Promise(resolve => child.once('exit', resolve));
    child.stdout.on('data', b => { logs = (logs + b).slice(-10000); });
    child.stderr.on('data', b => { logs = (logs + b).slice(-10000); });
    const request = (p, opts = {}) => fetch(`http://127.0.0.1:${port}${p}`, { ...opts, redirect: 'manual', signal: AbortSignal.timeout(5000) });
    let ready = false;
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) break;
      try { ready = (await request('/api/health')).status === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Server did not start (${mode}): ${logs}`);
    const health = await (await request('/api/health')).json();
    assert.equal(health.storage, mode === 'json' ? 'local-json-adapter' : 'sqlite');
    assert.equal(health.deepseek_proxy_ready, false);
    const pages = ['/', '/theme', '/demo', '/submit?demo=1', '/admin?demo=1', '/report?demo=1', '/dashboard', '/resources', '/curriculum', '/llm-teaching'];
    for (const p of pages) {
      const r = await request(p);
      assert.equal(r.status, 200, `${mode} ${p}`);
      assert.match(r.headers.get('content-type'), /text\/html/);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      const body = await r.text();
      assert.ok(body.includes('/static/i18n.js'), `Translation entry missing: ${p}`);
    }
    for (const [p, target] of [['/submit', '/student/login'], ['/admin', '/teacher/login'], ['/admin/console', '/admin/login'], ['/practice', '/student/login']]) {
      const r = await request(p);
      assert.equal(r.status, 302, `${mode} ${p}`);
      assert.equal(r.headers.get('location'), target);
    }
    for (const entry of manifest.files.filter(f => f.published && f.path.startsWith('public/'))) {
      const r = await request('/static/' + entry.path.slice('public/'.length));
      assert.equal(r.status, 200, `Static file ${entry.path}`);
      const hash = createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');
      assert.equal(hash, entry.sha256, `Served static fingerprint: ${entry.path}`);
    }
    const recordsPath = path.join(sandbox, 'data/records.json');
    const before = await readFile(recordsPath, 'utf8');
    const demo = await request('/api/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'demo', peel_mass: 50, oil_mass: 0.5 }) });
    assert.equal(demo.status, 200);
    assert.equal((await demo.json()).mode, 'demo');
    assert.equal(await readFile(recordsPath, 'utf8'), before, 'Demo wrote records.json');
    const post = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
    assert.equal((await request('/api/records', post)).status, 401);
    assert.equal((await request('/api/records', { ...post, headers: { ...post.headers, origin: 'https://example.invalid' } })).status, 403);
    for (const [language, question] of [['en', 'What does ammonium chloride do?'], ['zh', '氯化铵盐析的作用是什么？']]) {
      const r = await request('/api/llm/ask', { method: 'POST', headers: { 'content-type': 'application/json', cookie: `citrus_language=${language}` }, body: JSON.stringify({ question }) });
      assert.equal(r.status, 200);
      const answer = await r.json();
      assert.equal(answer.mode, 'local-fallback');
      assert.equal(typeof answer.answer, 'string');
      assert.ok(answer.answer.length > 20);
      if (language === 'en') assert.match(answer.answer, /aqueous|ionic|NH₄Cl/);
      else assert.match(answer.answer, /[\u4e00-\u9fff]/);
    }
    console.log(`PASS: ${mode} startup, security check, ${pages.length} public/demo pages, 4 login gates, static fingerprints, demo no-write, 401/403 guards and bilingual local AI`);
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([closed, new Promise(resolve => setTimeout(resolve, 2500))]);
      if (child.exitCode === null) { child.kill('SIGKILL'); await closed; }
    }
    await rm(sandbox, { recursive: true, force: true });
  }
}
await checkMode('sqlite');
await checkMode('json');
console.log(`NOTE: ${manifest.withheld_assets.length} teaching assets withheld; full media playback/downloads require authorized originals.`);
