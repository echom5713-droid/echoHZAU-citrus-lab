(function () {
  'use strict';
  const dictionary = window.CitrusTranslations || {};
  const normalize = value => String(value).replace(/\s+/g, ' ').trim();
  const key = 'citrus_language';
  const cookieLanguage = () => /(?:^|;\s*)citrus_language=(en|zh)(?:;|$)/.exec(document.cookie)?.[1];
  let language = 'en';
  try { language = localStorage.getItem(key) || cookieLanguage() || 'en'; } catch (_) { language = cookieLanguage() || 'en'; }
  language = language === 'zh' ? 'zh' : 'en';
  const sources = new WeakMap();
  const attributes = new WeakMap();
  const skipSelector = 'script,style,textarea,[contenteditable], [translate="no"],[data-i18n-skip],.user-chip,.llm-msg-body,.admin-class-card h3';
  const dataHeaders = new Set(['姓名', 'Name', '学生', 'Student', '班级', 'Class', '小组', 'Group', '诊断 / 备注', 'Diagnosis / Notes', '实验备注', 'Experiment notes']);
  const patterns = [
    [/^当前提示：(\d+(?:\.\d+)?)% NH₄Cl 组均值最优，4% 组出现回落$/, (_, n) => `Current observation: ${n}% NH₄Cl has the highest mean; the 4% group declines.`],
    [/^当前有效数据提示：(\d+(?:\.\d+)?)% NH₄Cl 组表现较优。被标记为污染或异常的数据不参与均值推荐。$/, (_, n) => `Valid data favour the ${n}% NH₄Cl group. Flagged records are excluded from mean-based recommendations.`],
    [/^(\d+(?:\.\d+)?)% 组均值$/, (_, n) => `${n}% group mean`],
    [/^平均得率\s*([\d.]+%)$/, (_, n) => `Mean yield ${n}`],
    [/^记录 (\d+) 份｜账号 (\d+) 个｜疑似异常 (\d+) 份$/, (_, a, b, c) => `${a} records | ${b} accounts | ${c} suspected anomalies`],
    [/^离线暂存：(\d+) 条待同步$/, (_, n) => `Offline: ${n} records awaiting sync`],
    [/^待同步 (\d+) 条记录$/, (_, n) => `${n} records awaiting sync`],
    [/^已同步 (\d+) 条离线记录$/, (_, n) => `Synced ${n} offline records`],
    [/^二阶拟合基于有效数据，提示 ([\d.]+)% 附近可能具有较好表现，预测得率约 ([\d.]+)%。$/, (_, a, b) => `A quadratic fit to valid data suggests an optimum near ${a}%, with a predicted yield of about ${b}%.`],
    [/^(.+) 已重置为 123456$/, (_, name) => `${name} reset to 123456`],
    [/^上次更新 (.+)$/, (_, time) => `Last updated ${time}`],
    [/^实时数据 · 上次更新 (.+)$/, (_, time) => `Live data · Last updated ${time}`],
    [/^完成实验记录后，前往习题页面完成本节内容练习。AI 根据你的正确率推荐不同难度的题目，你的作答记录将关联至账号「(.+)」，供教师查阅。$/, (_, name) => `After recording your experiment, practise the lesson topics. AI recommends difficulty levels based on accuracy. Answers are linked to account “${name}” for teacher review.`],
    [/^框选测量值：$/, () => 'Selected measurement:'],
    [/^（圆直径 (\d+) px；培养皿 ([\d.]+) mm）。不准可重新框选或手动修改。$/, (_, px, mm) => `(Circle diameter ${px} px; dish ${mm} mm). Redraw or edit manually if needed.`],
    [/^共 (\d+) 条/, (_, n) => `${n} records`]
  ];
  function english(value) {
    const raw = String(value), trimmed = normalize(raw);
    if (Object.prototype.hasOwnProperty.call(dictionary, trimmed)) return raw.replace(raw.trim(), dictionary[trimmed]);
    for (const [pattern, replace] of patterns) if (pattern.test(trimmed)) return trimmed.replace(pattern, replace);
    return raw;
  }
  function t(value) { return language === 'en' ? english(value) : String(value); }
  function protectedElement(el) {
    if (!el || el.closest(skipSelector)) return true;
    const cell = el.closest('td');
    if (!cell) return false;
    const table = cell.closest('table');
    const heading = table?.querySelector('thead tr')?.children[cell.cellIndex];
    const originalHeading = heading && sources.get(heading.firstChild)?.source;
    return Boolean(heading && dataHeaders.has(normalize(originalHeading || heading.textContent)));
  }
  function updateText(node) {
    if (!node.parentElement || protectedElement(node.parentElement)) return;
    const current = node.nodeValue;
    let state = sources.get(node);
    if (!state || current !== state.last) state = { source: current, last: current };
    const next = t(state.source);
    state.last = next;
    sources.set(node, state);
    if (current !== next) node.nodeValue = next;
  }
  function updateAttributes(el) {
    if (protectedElement(el) && el.tagName !== 'TEXTAREA') return;
    if (el.tagName === 'OPTION' && !el.hasAttribute('value')) el.setAttribute('value', el.value);
    let states = attributes.get(el);
    if (!states) { states = {}; attributes.set(el, states); }
    for (const name of ['placeholder', 'title', 'alt', 'aria-label']) {
      if (!el.hasAttribute(name)) continue;
      const current = el.getAttribute(name);
      let state = states[name];
      if (!state || current !== state.last) state = { source: current, last: current };
      const next = t(state.source);
      state.last = next;
      states[name] = state;
      if (next !== current) el.setAttribute(name, next);
    }
  }
  function translateRoot(root) {
    if (!root || !root.isConnected) return;
    if (root.nodeType === 3) { updateText(root); return; }
    if (root.nodeType === 1) updateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === 1 && protectedElement(node) && node.tagName !== 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) updateText(node); else updateAttributes(node);
    }
  }
  function persist() {
    try { localStorage.setItem(key, language); } catch (_) { /* Storage may be unavailable in private mode. */ }
    document.cookie = `${key}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  function setLanguage(next) {
    language = next === 'zh' ? 'zh' : 'en';
    persist();
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    translateRoot(document.documentElement);
    document.querySelectorAll('[data-citrus-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.citrusLanguage === language)));
    window.dispatchEvent(new CustomEvent('citrus:languagechange', { detail: { language } }));
  }
  window.CitrusI18n = Object.freeze({ t, language: () => language, setLanguage });
  // These wrappers translate only displayed messages and canvas labels, preserving all arguments and results.
  for (const name of ['alert', 'confirm', 'prompt']) {
    const native = window[name].bind(window);
    window[name] = function (message, ...rest) { return native(t(message), ...rest); };
  }
  if (window.CanvasRenderingContext2D) {
    const native = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { return native.call(this, t(text), ...args); };
  }
  function start() {
    const nav = document.querySelector('.nav-actions');
    if (nav && !document.getElementById('citrus-language-switch')) {
      const group = document.createElement('span');
      group.id = 'citrus-language-switch';
      group.className = 'citrus-language-switch';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Language / 语言');
      group.setAttribute('translate', 'no');
      for (const [code, label] of [['en', 'EN'], ['zh', '中文']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.citrusLanguage = code;
        button.lang = code === 'zh' ? 'zh-CN' : 'en';
        button.textContent = label;
        button.setAttribute('aria-label', code === 'zh' ? '切换为中文' : 'Switch to English');
        button.addEventListener('click', () => setLanguage(code));
        group.append(button);
      }
      nav.append(group);
    }
    setLanguage(language);
    const pending = new Set();
    let scheduled = false;
    const observer = new MutationObserver(changes => {
      for (const change of changes) {
        if (change.type === 'childList') change.addedNodes.forEach(node => pending.add(node));
        else pending.add(change.target);
      }
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          const roots = [...pending]; pending.clear();
          roots.forEach(translateRoot);
        });
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'alt', 'aria-label'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.addEventListener('storage', event => { if (event.key === key) setLanguage(event.newValue); });
}());
