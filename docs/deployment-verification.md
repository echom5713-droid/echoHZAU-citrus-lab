# Teaching deployment source verification — 19 October 2026

## What was inspected

The running server was inspected through its authenticated Tencent Cloud terminal after the owner completed MFA. The synchronization did not deploy or restart an application.

| Evidence | Observation |
| --- | --- |
| Public teaching entry | `http://43.132.224.207/` |
| Active Nginx teaching configuration | `/etc/nginx/sites-enabled/default`, port 80, upstream `http://127.0.0.1:3001` |
| Process listening on 3001 | Node PID 3244335 at inspection |
| `/proc/3244335/cwd` | `/home/ubuntu/site-v214` |
| Process entry | `node scripts/start-production.mjs` |
| Runtime | Node.js `v22.22.2` |
| Public health endpoint | HTTP 200; `storage: sqlite`; version label `2.1.2-stable-admin-import` |
| Separate scientific service | Nginx port 8080 forwards to port 3002; excluded from synchronization |

These observations established the source location from the running process and active proxy configuration. A similarly named directory, older archive or build output was not substituted.

## Source correspondence

The server inventory contains 41 copied text/configuration/image files plus separately fingerprinted media. All 28 application/configuration files published from that inventory match the copied server bytes exactly. This includes every relative application import, the front-end JS/CSS, translation dictionary and language code, startup wrapper, schema creation and maintenance scripts. The remaining copied files are historical server documents or withheld laboratory images; none is needed to resolve an application import.

The five front-end files requested directly from the public teaching website also matched the copied source byte for byte: `client.js`, `i18n-dictionary.js`, `i18n.js`, `i18n.css` and `styles.css`. Their SHA-256 fingerprints are included in the [machine-readable manifest](deployment-source-manifest.json).

`package.json` is the deployed file and declares zero third-party dependencies. There was no lockfile in the running application directory; the public `package-lock.json` was generated from that package with scripts disabled and no downloaded packages. There is no transpilation/bundling build step. The README, material inventory, safe configuration example, ignore files, isolated verification script and CI workflow were added for this public source release.

The old repository head was `c0f059d30dad322a8bfe2289970388a36c818967`. Its Next.js/Supabase tree remains available through ordinary Git history; it is not mixed into the current application directory.

## Reproduction boundary

- No production `data/` files, SQLite database/WAL/SHM files, accounts, sessions, practice answers, login attempts, audit logs, private uploads or backups were exported into Git.
- No `.env` values, API keys, tokens, passwords or authentication cookies were included. Only environment variable names were extracted for the new configuration example. The source's bundled demonstration users and records are retained; they are not a production account/data dump.
- Seven teaching assets are withheld pending redistribution authorization. Their paths and fingerprints are retained in [materials.md](materials.md). The application can start without them; reproducing the corresponding media views/downloads requires authorized copies.
- No scientific numbers or numerical algorithms were edited. The public homepage can reflect live stored records, whereas a clean local installation uses bundled demo records. The two need not display identical numerical summaries.
- No live administrator, teacher or student login was attempted. External model requests and signed-in classroom workflows were not exercised against the live website.
- The active production source, databases, Nginx configuration, firewall and services were not changed. Work on the server was confined to reads and a separate temporary source-review directory.

## Checks

The isolated verification completed successfully on Node.js `v24.19.0`; CI is configured for the inspected server version `22.22.2`.

| Check | Result |
| --- | --- |
| Dependency installation | `npm ci --ignore-scripts --offline` passed; zero third-party packages |
| Syntax | 19 JavaScript files passed `node --check` |
| Deployment correspondence | All 28 published deployment files matched their recorded SHA-256 hashes |
| SQLite mode | Startup, existing security check, 10 public/demo pages, four unauthenticated login gates, static fingerprints, demo submission, 401/403 write guards and bilingual local AI checks passed |
| JSON fallback mode | The same isolated checks passed; health reports `local-json-adapter` |
| Production source recheck | All 41 sampled files remained unchanged; the same running process retained the source working directory |
| Public front-end | All five fetched JS/CSS files returned 200 and matched server source |
| Secret review | No key-format matches found in the publication files; `.env`, runtime data, uploads, logs, backups and withheld media are ignored |

The original historical `TEST_REPORT.md` was not reused as evidence for this release. The new check does not log into the live site or use the default credentials. The full original account smoke script was retained but not executed during this synchronization. The checks do not validate external DeepSeek connectivity, browser playback of withheld media, or live signed-in classroom workflows.

中文：通过 Nginx → 监听进程 → 进程工作目录和启动入口定位当前教学源码，并保留文件指纹。公开版与应用源码一致，不包含生产状态和未确认再分发权限的素材。同步仅更新教学 GitHub 仓库，不改变公网网址或线上服务。
