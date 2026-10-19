import crypto from 'node:crypto';

const HASH_PREFIX = 'scrypt';

export function randomId(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function nowIso() {
  return new Date().toISOString();
}

export function hashPassword(password, salt = randomId(16)) {
  const normalized = String(password || '');
  const key = crypto.scryptSync(normalized, salt, 64);
  return `${HASH_PREFIX}$${salt}$${key.toString('hex')}`;
}

export function isPasswordHash(value) {
  return typeof value === 'string' && value.startsWith(`${HASH_PREFIX}$`);
}

export function verifyPassword(password, storedHash) {
  if (!isPasswordHash(storedHash)) return false;
  const [, salt, hex] = storedHash.split('$');
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = crypto.scryptSync(String(password || ''), salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function hashSid(sid) {
  return crypto.createHash('sha256').update(String(sid || '')).digest('hex');
}

export function cookieMap(req) {
  const parsed = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const item = part.trim();
    if (!item) continue;
    const i = item.indexOf('=');
    if (i <= 0) continue;
    try {
      const key = decodeURIComponent(item.slice(0, i));
      const value = decodeURIComponent(item.slice(i + 1));
      if (key) parsed[key] = value;
    } catch {
      // 忽略畸形 Cookie 项，避免非法 % 编码导致请求进入 500。
    }
  }
  return parsed;
}

export function cookieSid(req) {
  return cookieMap(req).citrus_sid || '';
}

function secureCookieFlag(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const encrypted = Boolean(req.socket && req.socket.encrypted);
  // 只在真实 HTTPS 请求上写入 Secure。HTTP + Nginx 反代调试时不能强制 Secure，
  // 否则浏览器不会保存 citrus_sid，表现为登录成功后又回到登录页。
  return forwarded === 'https' || encrypted ? '; Secure' : '';
}

export function setSessionCookie(req, res, sid, maxAgeSeconds = 86400) {
  res.setHeader('Set-Cookie', `citrus_sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureCookieFlag(req)}`);
}

export function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', `citrus_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieFlag(req)}`);
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

export function userAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 500);
}

export function routeKey(req) {
  try { return new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname; }
  catch { return req.url || '/'; }
}

export function loginAttemptKey(req, username, route = '/api/auth/login') {
  return `${clientIp(req)}:${String(username || '').toLowerCase()}:${route}`;
}

export function originAllowed(req) {
  // Baseline CSRF guard for state-changing requests. SameSite=Lax handles common browser cases;
  // this rejects explicit cross-origin POSTs while still allowing CLI smoke tests with no Origin.
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const check = origin || referer;
  if (!check || !host) return true;
  try {
    const u = new URL(check);
    return u.host === host;
  } catch {
    return false;
  }
}
