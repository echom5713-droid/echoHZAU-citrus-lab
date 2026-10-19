# Citrus Inquiry — Teaching Website

[Live teaching website](http://43.132.224.207/) · [Deployment evidence](docs/deployment-verification.md) · [Source fingerprints](docs/deployment-source-manifest.json)

A chemistry inquiry teaching application built around citrus essential oil extraction. Visitors can explore a micro-lesson, classroom demonstrations, a resource library and curriculum mapping. The interface defaults to English and offers a Chinese switch.

This repository contains the **application source copied from the running teaching deployment on 19 October 2026**. Nginx routes port 80 to the Node process on port 3001; that process runs `scripts/start-production.mjs` from `/home/ubuntu/site-v214`. The application files listed as published in the manifest were copied byte for byte. Production databases, secrets and media awaiting redistribution permission are excluded, so this is not a complete copy of the server's state or its teaching materials.

## Run locally

Use **Node.js 22 or later**. The inspected server runs Node.js 22.22.2. The application has no third-party npm dependencies and no compilation step.

```bash
git clone https://github.com/echom5713-droid/echoHZAU-citrus-lab.git
cd echoHZAU-citrus-lab
npm ci --ignore-scripts
npm start
```

Open `http://localhost:3000/`. `npm run dev` starts the same application without the production-mode wrapper. A fresh run creates a local `data/` directory and the demonstration users and records defined in the source; it does not retrieve live classroom data.

The demo flow needs no account: use `/demo`, `/submit?demo=1`, `/admin?demo=1` and `/report?demo=1`. Local sample credentials are intentionally defined in `src/lib/storage.js` for the original teaching workflow; they are not production account exports. Use the account-free demo for review. A fresh default installation requires account hardening before use with real students or public hosting.

## Configuration and content

The default AI path uses deterministic local teaching responses. To use DeepSeek, copy `.env.example` to `.env` and provide your own API key. The key is used by the server. External model connectivity, cost and output quality were not tested during this synchronization.

`PORT` defaults to `3000`. The source reads SQLite and session options while importing its storage module, before loading `.env`; export `STORAGE_MODE`, `SESSION_TTL_MS`, `LOGIN_WINDOW_MS` and `LOGIN_MAX_ATTEMPTS` in the process environment if overriding them. For example:

```bash
# POSIX shell; in PowerShell use: $env:STORAGE_MODE = "json"
STORAGE_MODE=json npm start
```

SQLite uses Node's built-in `node:sqlite` module; if unavailable, storage falls back to JSON. Schema creation and compatibility migrations live in `src/lib/storage.js`. `data/` is generated locally and excluded from Git. Practice answers use an additional JSON file.

**Videos, two laboratory images, raw Word documents and the molecular model are not bundled.** Their expected paths, sizes and SHA-256 fingerprints are retained in [the material inventory](docs/materials.md). Supply copies you are authorized to use at those exact paths to reproduce the media portions of the live site. The application starts without them, but the corresponding video, image, document or 3D resource will be unavailable locally. No stand-in scientific data or media were substituted.

## Implementation

| Area | Source |
| --- | --- |
| HTTP routes, role checks and server-side AI proxy | `server.js` |
| HTML views, classroom statistics, teaching prompts and demo fixtures | `src/views/pages.js` |
| SQLite schema, JSON fallback, accounts, sessions and audit storage | `src/lib/storage.js` |
| Password hashing, cookies, request validation and static serving | `src/lib/security.js`, `validators.js`, `http.js` |
| Browser interaction, diagrams and measurement UI | `public/client.js`, `public/styles.css` |
| English/Chinese presentation and language preferences | `public/i18n*`, `src/lib/language.js` |
| Startup and maintenance utilities | `scripts/` |

The source implements classroom record submission, teacher review and account management behind role checks. These signed-in workflows were identified in code; no live account was used during synchronization. Demonstration records and diagrams support teaching and are not a validated research dataset. Curriculum mapping is the project's authored content, not a certification of official syllabus compliance. Browser translations are applied after HTML loads; this is not a separately authored English server template for every page.

## Verify a clean checkout

```bash
node scripts/verify-public.mjs
```

This check copies the app into temporary directories, checks JavaScript syntax, runs the existing security check and exercises public/demo routes, access boundaries and offline AI responses in both SQLite and JSON modes. It never targets the live IP, uses no live credentials and removes its temporary databases. Missing licensed media are reported separately. The original `scripts/smoke-test.mjs` is retained for provenance; it logs into local seeded accounts and resets a local sample password, so it was not used for live validation. `scripts/prepare-release.mjs` deletes local data and configuration and is not part of installation or source synchronization.

The earlier Next.js/Supabase implementation remains in [Git history at the previous revision](https://github.com/echom5713-droid/echoHZAU-citrus-lab/tree/c0f059d30dad322a8bfe2289970388a36c818967). It has been removed from the current working tree to keep the active implementation clear. Existing version labels differ between `package.json`, the health endpoint and the server directory; they were preserved rather than treated as release verification.

The independent [EchoClass Scientific repository](https://github.com/echom5713-droid/echoclass-scientific) serves the [scientific engineering website on port 8080](http://43.132.224.207:8080/). It is outside this repository and was not modified.

## 中文说明

本仓库已切换为从腾讯云当前教学服务运行目录核实并复制的原生 Node.js 实现，保留全部 Git 历史；旧 Next.js/Supabase 实现可从上方历史链接查看。公开版本包含前后端、双语脚本、启动方式和建表逻辑，不包含生产数据库、账号会话、密钥、私人上传、日志或备份。

默认英文，可切换中文。视频、实验图片、原始文档及模型的仓库再分发权限尚未确认，因此保留清单和引用路径，需自行提供有权使用的素材。未更改线上代码、数据库、配置或服务，也未改动科学数值。配置密钥后才能启用外部模型；未配置时使用本地规则回答。
