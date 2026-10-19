import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

export function applySecurityHeaders(req, res) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // 温和 CSP：当前项目仍有少量内联样式/脚本，先建立基线，后续可逐步收紧为 nonce/hash CSP。
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (process.env.NODE_ENV === 'production' && proto === 'https') {
    // HSTS 仅在 HTTPS 反代完全可用后开启，避免锁死 HTTP 调试访问。
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
}

export async function serveStatic(urlPath, res, req) {
  const publicRoot = path.resolve(process.cwd(), 'public');
  const relativeUrl = urlPath.replace('/static/', '').replace(/^\/+/, '');

  let decodedRelative;
  try {
    decodedRelative = decodeURIComponent(relativeUrl);
  } catch {
    return false;
  }

  const filePath = path.resolve(publicRoot, decodedRelative);
  const relToPublic = path.relative(publicRoot, filePath);
  const escapesPublicRoot =
    relToPublic === '' ||
    relToPublic.startsWith('..') ||
    path.isAbsolute(relToPublic);

  if (escapesPublicRoot || !existsSync(filePath)) return false;
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.css':'text/css; charset=utf-8',
    '.js':'application/javascript; charset=utf-8',
    '.png':'image/png',
    '.jpg':'image/jpeg',
    '.jpeg':'image/jpeg',
    '.webp':'image/webp',
    '.svg':'image/svg+xml; charset=utf-8',
    '.glb':'model/gltf-binary',
    '.gltf':'model/gltf+json',
    '.doc':'application/msword',
    '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf':'application/pdf',
    '.mp4':'video/mp4'
  };
  const cacheControl = ext === '.js' ? 'no-cache' : 'public, max-age=3600';
  if (ext === '.mp4') {
    const size = statSync(filePath).size;
    const range = req?.headers?.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
      if (!match) {
        res.writeHead(416, {
          'Content-Range': `bytes */${size}`,
          'Accept-Ranges': 'bytes'
        });
        res.end();
        return true;
      }
      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : size - 1;
      if (!match[1] && match[2]) {
        const suffixLength = Number(match[2]);
        start = Math.max(size - suffixLength, 0);
        end = size - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
        res.writeHead(416, {
          'Content-Range': `bytes */${size}`,
          'Accept-Ranges': 'bytes'
        });
        res.end();
        return true;
      }
      end = Math.min(end, size - 1);
      res.writeHead(206, {
        'Content-Type': types[ext],
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl
      });
      createReadStream(filePath, { start, end }).pipe(res);
      return true;
    }
    res.writeHead(200, {
      'Content-Type': types[ext],
      'Content-Length': size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl
    });
    createReadStream(filePath).pipe(res);
    return true;
  }
  res.writeHead(200, {'Content-Type':types[ext]||'application/octet-stream','Cache-Control':cacheControl});
  res.end(await readFile(filePath));
  return true;
}

export async function parseBody(req, limitBytes = 16_000_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      const err = new Error('请求体过大');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function sendHtml(res, html, status=200) {
  res.writeHead(status, {'Content-Type':'text/html; charset=utf-8'});
  res.end(html);
}

export function sendJson(res, data, status=200) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}

export function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}
