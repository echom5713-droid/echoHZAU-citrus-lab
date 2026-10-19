import { requestLanguage } from './src/lib/language.js';
import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {
  homePage, themePage, demoPage, loginPage, studentPage, teacherPage, adminPage,
  practicePage, resourcesPage, llmPage, curriculumPage, reportPage,
  DEMO_RECORDS, isDemo, analyticsFor, recordPayload, recordDiagnostics, answerFor, esc, trendSvg
} from './src/views/pages.js';
import {
  ensureData, readRecords, addRecord, updateRecord, deleteRecord, readUsers, saveUsers, updateUser, storageInfo,
  createSession, readSession, revokeSession, updateSessionForUser,
  checkLoginRateLimit, registerLoginFailure, clearLoginFailures,
  auditLog, metrics, classScopeFor
} from './src/lib/storage.js';
import { serveStatic, parseBody, sendHtml, sendJson, redirect, applySecurityHeaders } from './src/lib/http.js';
import {
  randomId, hashSid, cookieSid, setSessionCookie, clearSessionCookie,
  verifyPassword, hashPassword, originAllowed, nowIso,
  clientIp, userAgent, loginAttemptKey, routeKey
} from './src/lib/security.js';
import { validateLoginInput, validatePasswordChange, validateRecordPayload, errorResponse } from './src/lib/validators.js';

function loadEnvFile(fileName) {
  const fileUrl = new URL(fileName, import.meta.url);
  if (!existsSync(fileUrl)) return;
  const lines = readFileSync(fileUrl, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

// 允许直接在项目根目录填写 .env / .env.local，不需要额外安装 dotenv。
loadEnvFile('.env');
loadEnvFile('.env.local');

const PORT = Number(process.env.PORT || 3000);

// Practice answer storage (lightweight JSON file)
const PRACT_DIR = new URL('./data/', import.meta.url);
const PRACT_FILE = new URL('./data/practice_answers.json', import.meta.url);
async function readPracticeAnswers() {
  try { return JSON.parse(await readFile(PRACT_FILE, 'utf8')); } catch { return []; }
}
async function appendPracticeAnswer(entry) {
  await mkdir(PRACT_DIR, { recursive: true });
  const all = await readPracticeAnswers();
  all.push(entry);
  await writeFile(PRACT_FILE, JSON.stringify(all));
}
async function handlePracticeAnswer(req, res, session) {
  const body = await parseBody(req);
  const qid = String(body.qid || '').slice(0, 20);
  if (!qid) return sendJson(res, { error: '缺少题目ID' }, 400);
  const entry = {
    id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    student: session ? { id: session.id, name: session.name, class_name: session.class_name } : { id: 'guest', name: '游客', class_name: '—' },
    qid,
    level: Number(body.level) || 1,
    correct: Boolean(body.correct),
    selected: Number(body.selected),
    ts: nowIso()
  };
  await appendPracticeAnswer(entry);
  return sendJson(res, { ok: true });
}
async function handlePracticeResults(req, res, session) {
  if (!hasRole(session, ['teacher', 'admin'])) return sendJson(res, { error: '无权限' }, 403);
  const all = await readPracticeAnswers();
  const filtered = session.role === 'admin' ? all : all.filter(a => a.student?.class_name === session.class_name);
  return sendJson(res, { ok: true, answers: filtered });
}
const BUILD_TIME = new Date().toISOString();
const VERSION = '2.1.2-stable-admin-import';

function hasRole(session, roles) {
  return Boolean(session && roles.includes(session.role));
}

function canAccessClass(session, className) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return String(session.class_name || '') === String(className || session.class_name || '');
}

async function getSession(req) {
  const sid = cookieSid(req);
  if (!sid) return null;
  return readSession(hashSid(sid));
}

function failLoginPage(role, message, session) {
  const safeRole = ['student','teacher','admin'].includes(role) ? role : 'student';
  return homePage(session).replace('</main>', `<section class="section wrap"><div class="card"><h2>登录失败</h2><p>${esc(message)}</p><a class="btn btn-primary" href="/${safeRole}/login">返回登录</a></div></section></main>`);
}

async function setUserSession(req, res, user) {
  const sid = randomId(32);
  await createSession({ sidHash: hashSid(sid), user, ip: clientIp(req), ua: userAgent(req) });
  setSessionCookie(req, res, sid, 86400);
  return sid;
}

async function handleLogin(req, res, session) {
  const body = await parseBody(req);
  const parsed = validateLoginInput(body);
  if (!parsed.ok) return sendHtml(res, failLoginPage(body.role, parsed.errors.map(e => e.message).join('；'), session), 400);
  const { role, username, password } = parsed.value;
  const attemptKey = loginAttemptKey(req, username, routeKey(req));
  const limit = await checkLoginRateLimit({ key: attemptKey });
  if (!limit.ok) {
    await auditLog({ action: 'auth.login.rate_limited', targetType: 'user', targetId: username, ip: clientIp(req), ua: userAgent(req), ok: false, detail: { retryAfter: limit.retryAfter } });
    return sendHtml(res, failLoginPage(role, `尝试次数过多，请 ${limit.retryAfter} 秒后再试。`, session), 429);
  }
  const users = await readUsers({ includeAll: true });
  const user = users.find(u => u.username === username && u.role === role && u.status !== 'disabled');
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await registerLoginFailure({ key: attemptKey, ip: clientIp(req), username, route: routeKey(req) });
    await auditLog({ action: 'auth.login.failed', targetType: 'user', targetId: username, ip: clientIp(req), ua: userAgent(req), ok: false, detail: { role } });
    return sendHtml(res, failLoginPage(role, '账号或密码不正确。', session), 401);
  }
  await clearLoginFailures(attemptKey);
  await setUserSession(req, res, user);
  await auditLog({ actor: user, action: 'auth.login.success', targetType: 'user', targetId: user.id, className: user.class_name, ip: clientIp(req), ua: userAgent(req), ok: true });
  if (role === 'student') return redirect(res, '/submit');
  if (role === 'teacher') return redirect(res, '/admin');
  return redirect(res, '/admin/console');
}

async function handleChangePassword(req, res, session) {
  if (!session) return sendJson(res, { error: '未登录' }, 401);
  const body = await parseBody(req);
  const parsed = validatePasswordChange(body);
  if (!parsed.ok) return sendJson(res, errorResponse(parsed.errors), 400);
  const users = await readUsers({ includeAll: true });
  const user = users.find(u => u.id === session.id);
  if (!user || !verifyPassword(parsed.value.oldPassword, user.passwordHash)) {
    await auditLog({ actor: session, action: 'auth.password.change_failed', targetType: 'user', targetId: session.id, ip: clientIp(req), ua: userAgent(req), ok: false });
    return sendJson(res, { error: '当前密码不正确' }, 400);
  }
  await updateUser(user.id, { passwordHash: hashPassword(parsed.value.newPassword), defaultPassword: false, password_changed_at: nowIso() });
  await updateSessionForUser(user.id);
  await auditLog({ actor: session, action: 'auth.password.changed', targetType: 'user', targetId: user.id, className: user.class_name, ip: clientIp(req), ua: userAgent(req), ok: true });
  return sendJson(res, { ok: true, message: '密码已修改' });
}


function normalizeUserRole(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['student','stu','学生','同学'].includes(raw)) return 'student';
  if (['teacher','tea','教师','老师'].includes(raw)) return 'teacher';
  if (['admin','管理员'].includes(raw)) return 'admin';
  return '';
}
function splitUserLine(line) {
  const text = String(line || '').trim();
  if (!text) return [];
  if (text.includes('\t')) return text.split('\t').map(x => x.trim());
  if (text.includes(',')) return text.split(',').map(x => x.trim());
  if (text.includes('，')) return text.split('，').map(x => x.trim());
  return text.split(/\s+/).map(x => x.trim());
}
function isHeaderLine(cols) {
  const joined = cols.join('|').toLowerCase();
  return /role|username|账号|姓名|班级|小组|密码|身份|角色/.test(joined) && !/^(student|teacher|admin|学生|老师|教师)/i.test(String(cols[0] || ''));
}
function parseImportedUsers(rawText, fallbackRole = '') {
  const lines = String(rawText || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const users = [], errors = [];
  lines.forEach((line, index) => {
    const cols = splitUserLine(line);
    if (!cols.length || isHeaderLine(cols)) return;
    let role = normalizeUserRole(cols[0]);
    let offset = 0;
    if (!role) role = normalizeUserRole(fallbackRole) || 'student'; else offset = 1;
    const username = String(cols[offset] || '').trim();
    const name = String(cols[offset + 1] || username).trim();
    const className = String(cols[offset + 2] || '高二化学探究班').trim();
    const groupName = role === 'student' ? String(cols[offset + 3] || '').trim() : '';
    const password = String(cols[offset + 4] || (role === 'teacher' ? cols[offset + 3] : '') || '123456').trim() || '123456';
    if (!username) return errors.push('第 ' + (index + 1) + ' 行缺少账号');
    if (!['student','teacher','admin'].includes(role)) return errors.push('第 ' + (index + 1) + ' 行角色不正确');
    users.push({ role, username, name, class_name: className, group_name: groupName, password });
  });
  return { users, errors };
}
async function upsertUsers(imported, session, req) {
  const current = await readUsers({ includeAll: true });
  const byUsername = new Map(current.map((u, i) => [String(u.username), { user: u, index: i }]));
  let created = 0, updated = 0;
  for (const item of imported) {
    const existing = byUsername.get(item.username);
    const passwordText = String(item.password || '123456').trim() || '123456';
    const patch = { role:item.role, username:item.username, name:item.name || item.username, class_name:item.class_name || '', group_name:item.group_name || '', status:'active', passwordHash:hashPassword(passwordText), defaultPassword:passwordText==='123456', password_reset_at:nowIso() };
    if (existing) { current[existing.index] = { ...existing.user, ...patch, updated_at: nowIso() }; updated++; }
    else { const newUser={ id:'u-' + item.role + '-' + Date.now() + '-' + Math.random().toString(16).slice(2,8), ...patch, created_at: nowIso() }; current.push(newUser); byUsername.set(item.username,{user:newUser,index:current.length-1}); created++; }
  }
  await saveUsers(current);
  await auditLog({ actor: session, action: 'admin.users.upsert', targetType: 'users', targetId: '', className: session?.class_name, ip: clientIp(req), ua: userAgent(req), ok: true, detail: { created, updated } });
  return { created, updated, total: imported.length };
}
async function handleCreateUser(req, res, session) {
  if (!hasRole(session, ['admin'])) return sendJson(res, { error: '无权限' }, 403);
  const body = await parseBody(req);
  const role = normalizeUserRole(body.role), username = String(body.username || '').trim();
  if (!role || !username) return sendJson(res, { error: '请填写角色和账号' }, 400);
  const result = await upsertUsers([{ role, username, name:String(body.name || username).trim(), class_name:String(body.class_name || '').trim(), group_name:String(body.group_name || '').trim(), password:String(body.password || '123456').trim() || '123456' }], session, req);
  return sendJson(res, { ok:true, ...result, message: username + ' 已保存' });
}
async function handleImportUsers(req, res, session) {
  if (!hasRole(session, ['admin'])) return sendJson(res, { error: '无权限' }, 403);
  const body = await parseBody(req, 800000);
  const parsed = parseImportedUsers(body.text || body.raw || '', body.role || '');
  if (!parsed.users.length) return sendJson(res, { error: parsed.errors[0] || '没有识别到账号数据' }, 400);
  const result = await upsertUsers(parsed.users, session, req);
  return sendJson(res, { ok:true, ...result, errors:parsed.errors, message:'导入完成：新增 ' + result.created + ' 个，更新 ' + result.updated + ' 个' });
}

async function handleResetPassword(req, res, session) {
  if (!hasRole(session, ['admin'])) return sendJson(res, { error: '无权限' }, 403);
  const body = await parseBody(req);
  const username = String(body.username || '').trim();
  const users = await readUsers({ includeAll: true });
  const user = users.find(u => u.username === username);
  if (!user) return sendJson(res, { error: '账号不存在' }, 404);
  await updateUser(user.id, { passwordHash: hashPassword('123456'), defaultPassword: true, password_reset_at: nowIso() });
  await auditLog({ actor: session, action: 'admin.password.reset', targetType: 'user', targetId: user.id, className: user.class_name, ip: clientIp(req), ua: userAgent(req), ok: true, detail: { username } });
  return sendJson(res, { ok: true, message: `${user.username} 已重置为 123456` });
}

async function recordsForSession(session, demo = false) {
  if (demo) return DEMO_RECORDS;
  if (!session) return [];
  const scope = classScopeFor(session, { demo });
  return readRecords(scope);
}

async function usersForSession(session) {
  if (!session) return [];
  if (session.role === 'admin') return readUsers({ includeAll: true });
  return readUsers({ class_name: session.class_name, includeAll: false });
}

async function handleRecordManage(req, res, session) {
  if (!hasRole(session, ['teacher','admin'])) return sendJson(res, { error: '无权限' }, 403);
  const body = await parseBody(req);
  const id = String(body.id || '').trim();
  const action = String(body.action || '').trim();
  if (!id) return sendJson(res, { error: '缺少记录ID' }, 400);
  const all = await readRecords({ includeAll: true });
  const record = all.find(r => String(r.id) === id);
  if (!record) return sendJson(res, { error: '记录不存在' }, 404);
  if (!canAccessClass(session, record.class_name)) return sendJson(res, { error: '无权管理该班级数据' }, 403);
  if (action === 'delete') {
    await deleteRecord(id);
    await auditLog({ actor: session, action: 'record.delete', targetType: 'record', targetId: id, className: record.class_name, ip: clientIp(req), ua: userAgent(req), ok: true });
    return sendJson(res, { ok: true, deleted: true });
  }
  const map = { include: 'included', approve: 'included', exclude: 'excluded', review: 'review' };
  const status = map[action];
  if (!status) return sendJson(res, { error: '未知操作' }, 400);
  const next = await updateRecord(id, { review_status: status, review_note: String(body.note || ''), reviewed_by: session.username, reviewed_at: nowIso() });
  await auditLog({ actor: session, action: `record.${status}`, targetType: 'record', targetId: id, className: record.class_name, ip: clientIp(req), ua: userAgent(req), ok: true });
  return sendJson(res, { ok: true, record: next });
}


async function handleRecordPost(req, res, session) {
  const body = await parseBody(req, 2_500_000);
  const payload = recordPayload(body);
  if (body.mode === 'demo') {
    return sendJson(res, { record: payload, diagnosis: { status: 'demo', reasons: ['游客沙盒提交，不写入真实数据库'] }, mode: 'demo' });
  }
  if (!hasRole(session, ['student','teacher','admin'])) return sendJson(res, { error: '请先登录后提交真实课堂数据' }, 401);
  if (session.role !== 'admin') payload.class_name = session.class_name || payload.class_name;
  if (!canAccessClass(session, payload.class_name)) return sendJson(res, { error: '无权向该班级写入数据' }, 403);
  const validated = validateRecordPayload(payload);
  if (!validated.ok) return sendJson(res, errorResponse(validated.errors), 400);
  const cohort = await recordsForSession(session, false);
  const diagnosis = recordDiagnostics(payload, cohort);
  let diagText = diagnosis.reasons.join('；') || '数据处于常规范围，可进入班级统计。';

  const hasKey = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
  if (hasKey) {
    try {
      const studentCtx = `学生提交数据：NH₄Cl浓度=${payload.nh4cl_concentration}%，橘皮质量=${payload.peel_mass}g，精油质量=${payload.oil_mass}g，得率=${payload.yield_percent}%，分层清晰度=${payload.phase_clarity_score}/5，乳化=${payload.emulsification_level}，抑菌圈=${payload.inhibition_zone_diameter}mm，菌落评分=${payload.colony_growth_score}/5。规则诊断：${diagText}`;
      const aiResult = await answerFor(studentCtx, { scene: '_record_diagnosis', history: [], language: requestLanguage(req) });
      if (aiResult.answer && aiResult.mode !== 'local-fallback') {
        diagText = aiResult.answer;
      }
    } catch (e) {
      console.error('[AI diagnosis]', e?.message);
    }
  }
  payload.ai_diagnosis = diagText;
  payload.created_by = session.username;
  await addRecord(payload);
  await auditLog({ actor: session, action: 'records.create', targetType: 'record', targetId: payload.id, className: payload.class_name, ip: clientIp(req), ua: userAgent(req), ok: true, detail: { diagnosis: diagnosis.status } });
  return sendJson(res, { record: payload, diagnosis, mode: storageInfo.mode });
}

async function handleSync(req, res, session) {
  if (!hasRole(session, ['student','teacher','admin'])) return sendJson(res, { error: '请先登录后同步真实数据' }, 401);
  const body = await parseBody(req, 2_500_000);
  const incoming = Array.isArray(body.records) ? body.records : [];
  const existing = await recordsForSession(session, false);
  const existingIds = new Set(existing.map(r => r.id));
  let added = 0;
  for (const item of incoming) {
    const payload = recordPayload({ ...item, synced_from_offline: true });
    if (session.role !== 'admin') payload.class_name = session.class_name || payload.class_name;
    const valid = validateRecordPayload(payload);
    if (valid.ok && !existingIds.has(payload.id) && canAccessClass(session, payload.class_name)) {
      payload.created_by = session.username;
      await addRecord(payload);
      added++;
    }
  }
  await auditLog({ actor: session, action: 'records.offline_sync', targetType: 'records', targetId: '', className: session.class_name, ip: clientIp(req), ua: userAgent(req), ok: true, detail: { added } });
  return sendJson(res, { ok: true, added, mode: 'offline-sync' });
}

await ensureData();

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(req, res);
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const p = url.pathname;
    const session = await getSession(req);

    if (p.startsWith('/static/')) { if (await serveStatic(p, res, req)) return; }
    if (req.method === 'POST' && !originAllowed(req)) return sendJson(res, { error: '疑似跨站请求，已拒绝' }, 403);
    if (p === '/logout') {
      const sid = cookieSid(req);
      if (sid) await revokeSession(hashSid(sid));
      clearSessionCookie(req, res);
      return redirect(res, '/');
    }

    if (p === '/api/health') return sendJson(res, {
      ok: true,
      version: VERSION,
      buildTime: BUILD_TIME,
      uptime: +process.uptime().toFixed(1),
      storage: storageInfo.mode,
      dbMode: storageInfo.mode,
      security: { password_hashing: 'scrypt', persistent_sessions: storageInfo.mode === 'sqlite', http_only_cookie: true, same_site_cookie: 'Lax', origin_guard: true, login_rate_limit: true, security_headers: true },
      external_dependencies: false,
      mainland_ready: true,
      deepseek_proxy_ready: Boolean(process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY),
      deepseek_model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      generated_at: nowIso()
    });
    if (p === '/api/metrics') return sendJson(res, { ok: true, version: VERSION, buildTime: BUILD_TIME, ...(await metrics()) });
    if (p === '/api/llm/status') return sendJson(res, {
      ok: true,
      configured: Boolean(process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY),
      provider: 'deepseek',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      base: process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com',
      timeoutMs: Number(process.env.DEEPSEEK_API_TIMEOUT_MS || 20000)
    });

    if (p === '/api/auth/login' && req.method === 'POST') return handleLogin(req, res, session);
    if (p === '/api/auth/change-password' && req.method === 'POST') return handleChangePassword(req, res, session);
    if (p === '/api/admin/reset-password' && req.method === 'POST') return handleResetPassword(req, res, session);
    if (p === '/api/admin/create-user' && req.method === 'POST') return handleCreateUser(req, res, session);
    if (p === '/api/admin/import-users' && req.method === 'POST') return handleImportUsers(req, res, session);
    if (p === '/api/records' && req.method === 'GET') return sendJson(res, { records: await recordsForSession(session, isDemo(url)), mode: isDemo(url) ? 'demo' : storageInfo.mode });
    if (p === '/api/records' && req.method === 'POST') return handleRecordPost(req, res, session);
    if (p === '/api/records/manage' && req.method === 'POST') return handleRecordManage(req, res, session);
    if (p === '/api/sync' && req.method === 'POST') return handleSync(req, res, session);
    if (p === '/api/analytics') return sendJson(res, analyticsFor(await recordsForSession(session, isDemo(url) || !session)));
    if (p === '/api/trend-svg') {
      const records = await recordsForSession(session, !session);
      const svg = trendSvg(records, 3, null);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(svg);
    }
    if (p === '/api/llm/ask' && req.method === 'POST') {
      const body = await parseBody(req);
      const question = String(body.question || '').trim();
      if (!question) return sendJson(res, { error: '请输入问题' }, 400);
      const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
      const scene = String(body.scene || '').slice(0, 50);
      await auditLog({ actor: session, action: 'ai.ask', targetType: 'question', targetId: '', className: session?.class_name, ip: clientIp(req), ua: userAgent(req), ok: true, detail: { question: question.slice(0, 100), scene } });
      return sendJson(res, await answerFor(question, { history, scene, language: requestLanguage(req) }));
    }
    if (p === '/api/llm/class-summary' && req.method === 'POST') {
      if (!hasRole(session, ['teacher', 'admin'])) return sendJson(res, { error: '无权限' }, 403);
      const records = await recordsForSession(session, false);
      const practiceAll = await readPracticeAnswers();
      const analytics = analyticsFor(records);
      const classPractice = session.role === 'admin' ? practiceAll : practiceAll.filter(a => a.student?.class_name === session.class_name);
      const correctCount = classPractice.filter(a => a.correct).length;
      const totalPractice = classPractice.length;

      let ctx = `班级数据摘要：\n提交记录 ${analytics.count} 份，有效 ${analytics.validCount} 份，疑似异常 ${analytics.reviewCount} 份。\n`;
      for (const s of analytics.stats) {
        ctx += `NH₄Cl ${s.conc}% 组：n=${s.count}，平均得率 ${s.meanYield.toFixed(2)}%，标准差 ${s.stdYield.toFixed(2)}，平均抑菌圈 ${s.meanZone.toFixed(1)}mm\n`;
      }
      ctx += `\n习题作答：共 ${totalPractice} 次，正确 ${correctCount} 次，正确率 ${totalPractice ? (correctCount/totalPractice*100).toFixed(1) : 0}%\n`;
      const errEntries = Object.entries(analytics.errorCounts).filter(([k,v]) => k !== '无明显异常' && v > 0);
      if (errEntries.length) ctx += `主要误差类型：${errEntries.map(([k,v]) => k+'('+v+'次)').join('、')}\n`;

      const result = await answerFor(ctx, { scene: '_class_summary', history: [], language: requestLanguage(req) });
      await auditLog({ actor: session, action: 'ai.class_summary', targetType: 'class', targetId: session.class_name || '', className: session.class_name, ip: clientIp(req), ua: userAgent(req), ok: true });
      return sendJson(res, { ok: true, summary: result.answer, mode: result.mode, generated_at: nowIso() });
    }

    const records = await recordsForSession(session, false);
    const allRecords = session?.role === 'admin' ? await readRecords({ includeAll: true }) : records;
    const users = await usersForSession(session);

    if (p === '/') return sendHtml(res, homePage(session, await readRecords({ includeAll: true })));
    if (p === '/theme') return sendHtml(res, themePage(session, await readRecords({ includeAll: true })));
    if (p === '/demo') return sendHtml(res, demoPage(session));
    if (p === '/student/login') return sendHtml(res, loginPage('student', session));
    if (p === '/teacher/login') return sendHtml(res, loginPage('teacher', session));
    if (p === '/admin/login') return sendHtml(res, loginPage('admin', session));
    if (p === '/submit') {
      const demo = isDemo(url);
      if (!demo && !hasRole(session, ['student'])) return redirect(res, '/student/login');
      return sendHtml(res, studentPage(await recordsForSession(session, demo), session, demo));
    }
    if (p === '/admin') {
      const demo = isDemo(url);
      if (!demo && !hasRole(session, ['teacher','admin'])) return redirect(res, '/teacher/login');
      return sendHtml(res, teacherPage(demo ? DEMO_RECORDS : allRecords, session, demo));
    }
    if (p === '/admin/console' || p === '/admin/users') {
      if (!hasRole(session, ['admin'])) return redirect(res, '/admin/login');
      return sendHtml(res, adminPage(await readRecords({ includeAll: true }), await readUsers({ includeAll: true }), session));
    }
    if (p === '/dashboard') return sendHtml(res, teacherPage(await recordsForSession(session, true), session, true));
    if (p === '/report') {
      const demo = isDemo(url);
      if (!demo && !hasRole(session, ['teacher','admin'])) return redirect(res, '/teacher/login');
      return sendHtml(res, reportPage(demo ? DEMO_RECORDS : allRecords, session, demo));
    }
    if (p === '/api/practice/answer' && req.method === 'POST') return handlePracticeAnswer(req, res, session);
    if (p === '/api/practice/results' && req.method === 'GET') return handlePracticeResults(req, res, session);
    if (p === '/practice') {
      if (!session) { res.writeHead(302, { Location: '/student/login' }); return res.end(); }
      return sendHtml(res, practicePage(session));
    }
    if (p === '/llm-teaching') return sendHtml(res, llmPage(session));
    if (p === '/curriculum') return sendHtml(res, curriculumPage(session));
    if (p === '/resources') return sendHtml(res, resourcesPage(session));

    redirect(res, '/');
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: err?.message || 'server_error', stack: err?.stack, ts: nowIso() }));
    sendJson(res, { error: err?.message || '服务器错误' }, err?.status || 500);
  }
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用。`);
    console.error('请关闭占用该端口的程序，或使用其他端口启动：');
    console.error('  PORT=3001 npm run start');
    console.error('  PORT=3001 npm run dev\n');
    process.exit(1);
  }
  if (err?.code === 'EACCES') {
    console.error(`\n当前用户没有权限监听端口 ${PORT}。`);
    console.error('请改用大于 1024 的端口，例如：PORT=3001 npm run start\n');
    process.exit(1);
  }
  console.error(JSON.stringify({ level: 'fatal', message: err?.message || 'server_listen_error', code: err?.code, stack: err?.stack, ts: nowIso() }));
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => console.log(`Citrus Explore ${VERSION} running at http://localhost:${PORT} (${storageInfo.mode}) | DeepSeek: ${(process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY) ? 'configured' : 'not configured'}`));

function shutdown(signal) {
  server.close(() => {
    console.log(`Citrus Explore stopped by ${signal}`);
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1200).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
