/* Bisaya Buddy — app logic (no build step, no server) */
(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const CODES = Object.keys(LANGS);
  const LIDX = { en: 1, nl: 2, ceb: 3 };
  const first = s => s.split('|')[0];
  const w = (item, lang) => first(item[LIDX[lang]]);
  const isNum = s => /^\d+$/.test(s);

  /* ---------- state ---------- */
  const KEY = 'bisaya-buddy-v1';
  const S = { native: 'en', target: 'ceb', from: 'en', to: 'ceb', rate: 0.85, level: 1, progress: {} };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* private mode */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const t = k => (I18N[S.native] && I18N[S.native][k]) || I18N.en[k] || k;
  const nm = obj => (obj && (obj[S.native] || obj.en)) || '';

  const view = $('#view');
  const nav = $('.modes');

  /* ---------- text to speech ---------- */
  const synth = window.speechSynthesis;
  let voices = [];
  const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
  if (synth) {
    loadVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
  }

  function pickVoice(lang) {
    for (const code of LANGS[lang].tts) {
      const c = code.toLowerCase();
      const m = voices.filter(v => {
        const vl = v.lang.toLowerCase().replace('_', '-');
        return vl === c || vl.startsWith(c + '-');
      });
      if (m.length) return m.find(v => /google|natural|enhanced|premium|neural/i.test(v.name)) || m[0];
    }
    return null;
  }

  function voiceStatus(lang) {
    const v = pickVoice(lang);
    if (!v) return 'none';
    const primary = LANGS[lang].tts[0].split('-')[0];
    return v.lang.toLowerCase().startsWith(primary) ? 'native' : 'approx';
  }

  function speak(text, lang, btn) {
    if (!synth) { toast(t('noTts')); return; }
    const clean = first(text).replace(/…|\.\.\./g, '').trim();
    if (!clean) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const v = pickVoice(lang);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = LANGS[lang].tts[0]; }
    u.rate = S.rate;
    if (btn) {
      btn.classList.add('speaking');
      const off = () => btn.classList.remove('speaking');
      u.onend = off; u.onerror = off;
      setTimeout(off, 6000);
    }
    synth.speak(u);
  }

  const speakerSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ---------- dictionary / translator ---------- */
  const norm = s => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/(^|\s)-+|-+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ').trim();

  const ENTRIES = [];
  LEVELS.forEach(L => L.topics.forEach(T => T.items.forEach(it =>
    ENTRIES.push({ e: it[0], en: it[1], nl: it[2], ceb: it[3], L, T }))));
  EXTRA_WORDS.forEach(x => ENTRIES.push({ e: '', en: x[0], nl: x[1], ceb: x[2] }));
  const LESSON_ENTRIES = ENTRIES.filter(e => e.T);

  const INDEX = {};
  CODES.forEach(c => {
    INDEX[c] = new Map();
    ENTRIES.forEach(en => en[c].split('|').forEach((alt, ai) => {
      const k = norm(alt);
      if (k && !INDEX[c].has(k)) INDEX[c].set(k, { e: en, ai });
    }));
  });

  function pickOut(hit, from, to) {
    const src = hit.e[from].split('|'), dst = hit.e[to].split('|');
    return src.length === dst.length ? dst[hit.ai] : dst[0];
  }

  function translate(text, from, to) {
    const n = norm(text);
    if (!n) return null;
    const hit = INDEX[from].get(n);
    if (hit) return { kind: 'exact', out: pickOut(hit, from, to), entry: hit.e };

    const toks = n.split(' ');
    const skip = to === 'ceb' ? (SKIP_WORDS[from] || []) : [];
    const parts = [];
    let i = 0;
    while (i < toks.length) {
      let found = null;
      for (let j = Math.min(toks.length, i + 8); j > i; j--) {
        const src = toks.slice(i, j).join(' ');
        const e = INDEX[from].get(src);
        if (e) { found = { src, out: pickOut(e, from, to).toLowerCase(), ok: true }; i = j; break; }
      }
      if (!found) {
        if (skip.includes(toks[i])) { i++; continue; }
        found = { src: toks[i], out: toks[i], ok: false };
        i++;
      }
      parts.push(found);
    }
    const okN = parts.filter(p => p.ok).length;
    const kind = okN === 0 ? 'none' : okN === parts.length ? 'words' : 'partial';
    const end = (text.trim().match(/[?!.]$/) || [''])[0];
    return { kind, parts, end };
  }

  function similar(text, from, exclude, limit = 5) {
    const toks = norm(text).split(' ').filter(x => x.length > 1);
    if (!toks.length) return [];
    const out = [];
    for (const e of LESSON_ENTRIES) {
      if (e === exclude) continue;
      let best = 0;
      for (const alt of e[from].split('|')) {
        const at = norm(alt).split(' ');
        let s = 0;
        for (const tk of toks) {
          if (at.includes(tk)) s += 1;
          else if (tk.length >= 3 && at.some(x => x.length >= 3 && (x.startsWith(tk) || tk.startsWith(x)))) s += 0.7;
        }
        best = Math.max(best, s / Math.sqrt(at.length * toks.length));
      }
      if (best >= 0.35) out.push([best, e]);
    }
    return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map(x => x[1]);
  }

  /* ---------- translate view ---------- */
  let trText = '';
  let trTimer;

  const langSelect = (id, val) => `
    <label class="lang-select">
      <span class="sr">${id === 'from' ? t('from') : t('to')}</span>
      <select id="${id}">${CODES.map(c => `<option value="${c}" ${c === val ? 'selected' : ''}>${LANGS[c].flag} ${LANGS[c].name}</option>`).join('')}</select>
    </label>`;

  function renderTranslate() {
    view.innerHTML = `
      <section class="card tr-card">
        <div class="lang-row">
          ${langSelect('from', S.from)}
          <button class="icon-btn swap" id="swap" aria-label="Swap languages">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/></svg>
          </button>
          ${langSelect('to', S.to)}
        </div>
        <div class="tr-input">
          <textarea id="trIn" rows="3" placeholder="${esc(t('typeHere'))}" autocomplete="off" autocapitalize="sentences" spellcheck="false" lang="${S.from}">${esc(trText)}</textarea>
          <div class="tr-tools">
            <button class="round-btn" id="trSpeakIn" aria-label="${esc(t('listen'))}">${speakerSvg}</button>
            <button class="round-btn" id="trClear" aria-label="${esc(t('clear'))}">✕</button>
          </div>
        </div>
        <div id="trOut" class="tr-out" aria-live="polite"></div>
      </section>
      <section id="trSugg"></section>
      <p class="foot-note">📚 ${ENTRIES.length} ${esc(t('dictSize'))}</p>`;

    const inp = $('#trIn');
    inp.addEventListener('input', () => { trText = inp.value; clearTimeout(trTimer); trTimer = setTimeout(updateTranslation, 180); });
    $('#from').addEventListener('change', e => setPair(e.target.value, S.to, 'from'));
    $('#to').addEventListener('change', e => setPair(S.from, e.target.value, 'to'));
    $('#swap').addEventListener('click', () => {
      const r = translate(trText, S.from, S.to);
      if (r && r.kind === 'exact') trText = r.out;
      setPair(S.to, S.from);
    });
    $('#trSpeakIn').addEventListener('click', e => speak(trText, S.from, e.currentTarget));
    $('#trClear').addEventListener('click', () => { trText = ''; inp.value = ''; inp.focus(); updateTranslation(); });
    updateTranslation();
  }

  function setPair(from, to, changed) {
    if (from === to) {
      // keep the newly chosen side, flip the other one
      if (changed === 'from') to = S.from; else from = S.to;
    }
    S.from = from; S.to = to; save();
    renderTranslate();
  }

  function updateTranslation() {
    const out = $('#trOut'), sug = $('#trSugg');
    if (!out) return;
    const r = translate(trText, S.from, S.to);

    if (!r) {
      const samples = shuffle(LESSON_ENTRIES.filter(e => e.L.id <= 2)).slice(0, 6);
      out.innerHTML = '';
      sug.innerHTML = `<div class="chips">${samples.map(e => `<button class="chip" data-fill="${esc(first(e[S.from]))}">${e.e} ${esc(first(e[S.from]))}</button>`).join('')}</div>`;
      bindFill(sug);
      return;
    }

    let textHtml, plain, badge;
    if (r.kind === 'exact') {
      plain = r.out;
      textHtml = esc(r.out);
      badge = `<span class="badge ok">✓ ${esc(t('exact'))}</span>`;
    } else {
      const words = r.parts.map(p => p.out);
      if (words.length) words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      plain = words.join(' ') + (r.end || '');
      textHtml = r.parts.map((p, i) => p.ok ? esc(words[i]) : `<span class="miss" title="?">${esc(words[i])}</span>`).join(' ') + esc(r.end || '');
      badge = r.kind === 'words' ? `<span class="badge mid">≈ ${esc(t('words'))}</span>`
        : r.kind === 'partial' ? `<span class="badge warn">◐ ${esc(t('partial'))}</span>`
        : `<span class="badge bad">✕ ${esc(t('none'))}</span>`;
    }
    const gUrl = `https://translate.google.com/?sl=${S.from}&tl=${S.to}&text=${encodeURIComponent(trText)}&op=translate`;
    const lessonLink = r.entry && r.entry.T
      ? `<a class="lesson-link" href="#learn/${r.entry.L.id}/${r.entry.T.id}/cards">${r.entry.L.emoji} ${esc(t('level'))} ${r.entry.L.id} · ${r.entry.T.emoji} ${esc(nm(r.entry.T.name))} →</a>` : '';

    out.innerHTML = `
      <div class="tr-result">
        ${badge}
        <div class="tr-text-row">
          ${r.entry && r.entry.e ? `<span class="tr-emoji${isNum(r.entry.e) ? ' num' : ''}">${r.entry.e}</span>` : ''}
          <p class="tr-text" lang="${S.to}">${r.kind === 'none' ? '—' : textHtml}</p>
        </div>
        <div class="tr-actions">
          ${r.kind !== 'none' ? `<button class="btn soft" id="trSpeak">${speakerSvg} ${esc(t('listen'))}</button>
          <button class="btn soft" id="trCopy">⧉ ${esc(t('copy'))}</button>` : ''}
        </div>
        ${lessonLink}
        ${r.kind !== 'exact' ? `<a class="g-link" href="${gUrl}" target="_blank" rel="noopener">↗ ${esc(t('tryGoogle'))}</a>` : ''}
      </div>`;

    const sp = $('#trSpeak');
    if (sp) sp.addEventListener('click', e => speak(plain, S.to, e.currentTarget));
    const cp = $('#trCopy');
    if (cp) cp.addEventListener('click', () => {
      (navigator.clipboard ? navigator.clipboard.writeText(plain) : Promise.reject())
        .then(() => toast(t('copied')), () => {});
    });

    const sims = similar(trText, S.from, r.entry);
    sug.innerHTML = sims.length ? `
      <h3 class="section-title">${esc(t('similar'))}</h3>
      <div class="sugg-list">${sims.map(e => `
        <button class="sugg" data-fill="${esc(first(e[S.from]))}">
          <span class="sugg-emoji${isNum(e.e) ? ' num' : ''}">${e.e}</span>
          <span class="sugg-txt"><b>${esc(first(e[S.from]))}</b><small lang="${S.to}">${esc(first(e[S.to]))}</small></span>
        </button>`).join('')}</div>` : '';
    bindFill(sug);
  }

  function bindFill(root) {
    $$('[data-fill]', root).forEach(b => b.addEventListener('click', () => {
      trText = b.dataset.fill;
      const inp = $('#trIn');
      if (inp) inp.value = trText;
      updateTranslation();
    }));
  }

  /* ---------- learn view ---------- */
  const stars = n => [1, 2, 3].map(i => `<span class="star ${i <= n ? 'on' : ''}">★</span>`).join('');
  const pkey = (L, T) => `${L.id}/${T.id}`;

  function phraseOfDay() {
    const day = Math.floor(Date.now() / 864e5);
    const e = LESSON_ENTRIES[(day * 7919) % LESSON_ENTRIES.length];
    return `
      <section class="card potd" style="--c:${e.L.color}">
        <div class="potd-emoji${isNum(e.e) ? ' num' : ''}">${e.e}</div>
        <div class="potd-body">
          <span class="eyebrow">${esc(t('phraseOfDay'))}</span>
          <strong lang="${S.target}">${esc(first(e[S.target]))}</strong>
          <small>${esc(first(e[S.native]))}</small>
        </div>
        <button class="round-btn big" data-say="${esc(first(e[S.target]))}" aria-label="${esc(t('listen'))}">${speakerSvg}</button>
      </section>`;
  }

  function renderLearn() {
    const L = LEVELS.find(l => l.id === S.level) || LEVELS[0];
    view.innerHTML = `
      ${phraseOfDay()}
      <h2 class="section-title">${esc(t('age'))}</h2>
      <div class="levels" role="tablist">
        ${LEVELS.map(l => `
          <button class="level ${l.id === L.id ? 'active' : ''}" style="--c:${l.color}" data-level="${l.id}" role="tab" aria-selected="${l.id === L.id}">
            <span class="lv-emoji">${l.emoji}</span>
            <span class="lv-age">${l.ages}</span>
            <span class="lv-name">${esc(nm(l.name))}</span>
          </button>`).join('')}
      </div>
      <div class="topics" style="--c:${L.color}">
        ${L.topics.map(T => `
          <a class="topic" href="#learn/${L.id}/${T.id}/cards">
            <span class="tp-emoji">${T.emoji}</span>
            <span class="tp-name">${esc(nm(T.name))}</span>
            <span class="tp-meta">${T.items.length} ${esc(t('words_n'))}</span>
            <span class="tp-stars">${stars(S.progress[pkey(L, T)] || 0)}</span>
          </a>`).join('')}
      </div>`;

    $$('[data-level]').forEach(b => b.addEventListener('click', () => {
      S.level = +b.dataset.level; save(); renderLearn();
      const a = $('.level.active'); if (a && a.scrollIntoView) a.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }));
    bindSay(view);
  }

  function bindSay(root) {
    $$('[data-say]', root).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      speak(b.dataset.say, b.dataset.lang || S.target, b);
    }));
  }

  /* ---------- topic view ---------- */
  let cardIdx = 0, curTopic = '', quiz = null;

  function renderTopic(L, T, tab) {
    const key = pkey(L, T);
    if (key !== curTopic) { curTopic = key; cardIdx = 0; quiz = null; }
    if (tab !== 'quiz') quiz = null;
    S.level = L.id; save();

    view.innerHTML = `
      <div class="topic-head" style="--c:${L.color}">
        <a class="icon-btn" href="#learn" aria-label="${esc(t('back'))}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </a>
        <div class="th-text">
          <h2>${T.emoji} ${esc(nm(T.name))}</h2>
          <p>${L.emoji} ${esc(nm(L.name))} · ${esc(t('age'))} ${L.ages}</p>
        </div>
        <span class="tp-stars">${stars(S.progress[key] || 0)}</span>
      </div>
      <div class="tabs" style="--c:${L.color}">
        ${['cards', 'list', 'quiz'].map(x => `<a href="#learn/${L.id}/${T.id}/${x}" class="${x === tab ? 'active' : ''}">${esc(t(x))}</a>`).join('')}
      </div>
      <div id="tabBody" style="--c:${L.color}"></div>`;

    const body = $('#tabBody');
    if (tab === 'list') renderList(L, T, body);
    else if (tab === 'quiz') renderQuiz(L, T, body);
    else renderCards(L, T, body, false);
  }

  function tipHtml(T) {
    return T.tip ? `<div class="tip"><b>💡 ${esc(t('tip'))}</b> ${esc(nm(T.tip))}</div>` : '';
  }

  function renderCards(L, T, body, autoSpeak) {
    const n = T.items.length;
    const it = T.items[cardIdx];
    body.innerHTML = `
      <div class="flash" id="flash" role="button" tabindex="0" aria-label="${esc(t('listen'))}">
        <div class="flash-emoji${isNum(it[0]) ? ' num' : ''}">${it[0]}</div>
        <div class="flash-word" lang="${S.target}">${esc(w(it, S.target))}</div>
        <div class="flash-native" lang="${S.native}">${esc(w(it, S.native))}</div>
        <div class="flash-hint">${speakerSvg} ${esc(t('tapCard'))}</div>
      </div>
      <div class="card-nav">
        <button class="round-btn big" id="prev" aria-label="${esc(t('prev'))}" ${cardIdx === 0 ? 'disabled' : ''}>←</button>
        <div class="dots">${T.items.map((_, i) => `<span class="${i === cardIdx ? 'on' : ''}"></span>`).join('')}</div>
        <button class="round-btn big" id="next" aria-label="${esc(t('next'))}" ${cardIdx === n - 1 ? 'disabled' : ''}>→</button>
      </div>
      ${cardIdx === n - 1 ? `<a class="btn primary wide" href="#learn/${L.id}/${T.id}/quiz">🎯 ${esc(t('start'))}</a>` : ''}
      ${tipHtml(T)}`;

    const flash = $('#flash');
    const sayIt = () => { flash.classList.remove('pop'); void flash.offsetWidth; flash.classList.add('pop'); speak(w(it, S.target), S.target); };
    flash.addEventListener('click', sayIt);
    flash.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sayIt(); } });
    const go = d => {
      const ni = cardIdx + d;
      if (ni < 0 || ni >= n) return;
      cardIdx = ni;
      renderCards(L, T, body, true);
    };
    $('#prev').addEventListener('click', () => go(-1));
    $('#next').addEventListener('click', () => go(1));

    let sx = null, sy = null;
    flash.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    flash.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { e.preventDefault(); go(dx < 0 ? 1 : -1); }
    });
    if (autoSpeak) speak(w(it, S.target), S.target);
  }

  function renderList(L, T, body) {
    body.innerHTML = `
      <ul class="word-list">
        ${T.items.map(it => `
          <li>
            <span class="wl-emoji${isNum(it[0]) ? ' num' : ''}">${it[0]}</span>
            <span class="wl-txt"><b lang="${S.target}">${esc(w(it, S.target))}</b><small lang="${S.native}">${esc(w(it, S.native))}</small></span>
            <button class="round-btn" data-say="${esc(w(it, S.target))}" aria-label="${esc(t('listen'))}">${speakerSvg}</button>
          </li>`).join('')}
      </ul>
      ${tipHtml(T)}`;
    bindSay(body);
  }

  /* ---------- quiz ---------- */
  function buildQuiz(L, T) {
    const items = T.items;
    const levelPool = L.topics.flatMap(x => x.items).filter(x => !items.includes(x));
    const pictureMode = L.id <= 2 && new Set(items.map(x => x[0])).size === items.length;
    const types = pictureMode ? ['pic'] : ['say', 'mean', 'hear'];
    const order = shuffle([...items]).slice(0, Math.min(8, items.length));
    const typeSeq = shuffle(order.map((_, k) => types[k % types.length]));

    const qs = order.map((ans, k) => {
      const type = typeSeq[k];
      const key = type === 'pic' ? x => x[0] : type === 'mean' ? x => w(x, S.native) : x => w(x, S.target);
      const opts = [ans];
      const seen = new Set([key(ans)]);
      for (const x of [...shuffle(items.filter(i => i !== ans)), ...shuffle([...levelPool])]) {
        if (opts.length >= 4) break;
        if (type === 'pic' && !items.includes(x)) continue;
        if (!seen.has(key(x))) { seen.add(key(x)); opts.push(x); }
      }
      return { type, ans, opts: shuffle(opts) };
    });
    return { qs, i: 0, score: 0, answered: false, started: false, pictureMode };
  }

  function renderQuiz(L, T, body) {
    if (!quiz) quiz = buildQuiz(L, T);

    if (!quiz.started) {
      body.innerHTML = `
        <div class="quiz-start card">
          <div class="big-emoji">🎯</div>
          <h3>${esc(nm(T.name))}</h3>
          <p>${quiz.qs.length} × ${esc(quiz.pictureMode ? t('whichPicture') : t('question'))}</p>
          <button class="btn primary wide" id="qStart">${esc(t('start'))}</button>
        </div>`;
      $('#qStart').addEventListener('click', () => { quiz.started = true; renderQuiz(L, T, body); });
      return;
    }
    if (quiz.i >= quiz.qs.length) return renderQuizEnd(L, T, body);

    const q = quiz.qs[quiz.i];
    const target = w(q.ans, S.target);
    let prompt;
    if (q.type === 'pic') {
      prompt = `<p class="q-label">${esc(t('whichPicture'))}</p>
        <button class="say-big" data-say="${esc(target)}">${speakerSvg}<span lang="${S.target}">${esc(target)}</span></button>`;
    } else if (q.type === 'say') {
      prompt = `<p class="q-label">${esc(t('howSay'))}</p>
        <div class="q-prompt"><span class="q-emoji${isNum(q.ans[0]) ? ' num' : ''}">${q.ans[0]}</span><b lang="${S.native}">${esc(w(q.ans, S.native))}</b></div>`;
    } else if (q.type === 'mean') {
      prompt = `<p class="q-label">${esc(t('whatMeans'))}</p>
        <button class="say-big" data-say="${esc(target)}">${speakerSvg}<span lang="${S.target}">${esc(target)}</span></button>`;
    } else {
      prompt = `<p class="q-label">${esc(t('whatHear'))}</p>
        <button class="say-big only" data-say="${esc(target)}" aria-label="${esc(t('listen'))}">${speakerSvg}</button>`;
    }

    const optLabel = o => q.type === 'pic' ? `<span class="opt-emoji${isNum(o[0]) ? ' num' : ''}">${o[0]}</span>`
      : q.type === 'mean' ? `<span lang="${S.native}">${esc(w(o, S.native))}</span>`
      : `<span lang="${S.target}">${esc(w(o, S.target))}</span>`;

    body.innerHTML = `
      <div class="quiz card">
        <div class="q-progress"><span style="width:${(quiz.i / quiz.qs.length) * 100}%"></span></div>
        <div class="q-count">${esc(t('question'))} ${quiz.i + 1} / ${quiz.qs.length} · ⭐ ${quiz.score}</div>
        ${prompt}
        <div class="opts ${q.type === 'pic' ? 'pics' : ''}">
          ${q.opts.map((o, k) => `<button class="opt" data-k="${k}">${optLabel(o)}</button>`).join('')}
        </div>
        <div class="q-feedback" id="qFb" aria-live="polite"></div>
      </div>`;

    bindSay(body);
    if (q.type !== 'say') speak(target, S.target);

    $$('.opt', body).forEach(b => b.addEventListener('click', () => {
      if (quiz.answered) return;
      quiz.answered = true;
      const chosen = q.opts[+b.dataset.k];
      const ok = chosen === q.ans;
      if (ok) quiz.score++;
      $$('.opt', body).forEach(x => {
        const o = q.opts[+x.dataset.k];
        x.disabled = true;
        if (o === q.ans) x.classList.add('right');
        else if (x === b) x.classList.add('wrong');
      });
      const fb = $('#qFb');
      fb.className = 'q-feedback show ' + (ok ? 'good' : 'bad');
      fb.innerHTML = `
        <span>${ok ? '🎉 ' + esc(t('correct')) : '💪 ' + esc(t('wrong')) + ` <b lang="${S.target}">${esc(target)}</b>`}</span>
        <button class="btn primary" id="qNext">${esc(t('next'))} →</button>`;
      speak(target, S.target);
      $('#qNext').addEventListener('click', () => { quiz.i++; quiz.answered = false; renderQuiz(L, T, body); });
      $('#qNext').focus({ preventScroll: true });
    }));
  }

  function renderQuizEnd(L, T, body) {
    const total = quiz.qs.length, sc = quiz.score, r = sc / total;
    const st = r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.4 ? 1 : 0;
    const key = pkey(L, T);
    if (st > (S.progress[key] || 0)) { S.progress[key] = st; save(); }
    const headStars = $('.topic-head .tp-stars');
    if (headStars) headStars.innerHTML = stars(S.progress[key] || 0);

    const idx = L.topics.indexOf(T);
    const nextT = L.topics[idx + 1];
    body.innerHTML = `
      <div class="quiz-end card">
        <div class="big-emoji">${st >= 2 ? '🏆' : st === 1 ? '🌟' : '💪'}</div>
        <div class="end-stars">${stars(st)}</div>
        <h3>${esc(st >= 2 ? t('greatJob') : t('keepGoing'))}</h3>
        <p>${esc(t('score'))}: <b>${sc} / ${total}</b></p>
        <div class="end-actions">
          <button class="btn soft" id="qAgain">↻ ${esc(t('again'))}</button>
          ${nextT ? `<a class="btn primary" href="#learn/${L.id}/${nextT.id}/cards">${nextT.emoji} ${esc(nm(nextT.name))} →</a>`
            : `<a class="btn primary" href="#learn">${esc(t('done'))} ✓</a>`}
        </div>
      </div>`;
    $('#qAgain').addEventListener('click', () => { quiz = buildQuiz(L, T); quiz.started = true; renderQuiz(L, T, body); });
    if (st >= 2) confetti();
    speak(st >= 2 ? I18N[S.target].greatJob : I18N[S.target].keepGoing, S.target);
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const bits = ['🎉', '⭐', '🌺', '✨', '🎈', '💛'];
    for (let i = 0; i < 28; i++) {
      const s = document.createElement('span');
      s.textContent = bits[i % bits.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDelay = Math.random() * 0.6 + 's';
      s.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
      s.style.fontSize = 16 + Math.random() * 18 + 'px';
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3800);
  }

  /* ---------- settings ---------- */
  const dlg = $('#settings');
  let resetArmed = false;

  function renderSettings() {
    const seg = key => `
      <div class="seg" data-key="${key}">
        ${CODES.map(c => `<button type="button" data-val="${c}" class="${S[key] === c ? 'on' : ''}">${LANGS[c].flag} ${LANGS[c].name}</button>`).join('')}
      </div>`;
    const vs = c => {
      const s = voiceStatus(c);
      const label = s === 'native' ? t('voiceNative') : s === 'approx' ? t('voiceApprox') : t('voiceNone');
      return `<li><span>${LANGS[c].flag} ${LANGS[c].name}</span><span class="vs ${s}">${esc(label)}</span>
        <button type="button" class="round-btn" data-say="${esc(first(LESSON_ENTRIES[0][c]))}" data-lang="${c}" aria-label="${esc(t('listen'))}">${speakerSvg}</button></li>`;
    };
    dlg.innerHTML = `
      <div class="sheet-inner">
        <div class="sheet-head">
          <h2>${esc(t('settings'))}</h2>
          <button type="button" class="icon-btn" id="closeSettings" aria-label="Close">✕</button>
        </div>
        <label class="field-label">${esc(t('iSpeak'))}</label>
        ${seg('native')}
        <label class="field-label">${esc(t('iLearn'))}</label>
        ${seg('target')}
        <label class="field-label" for="rate">${esc(t('speed'))} <output id="rateOut">${S.rate.toFixed(2)}×</output></label>
        <input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${S.rate}">
        <label class="field-label">${esc(t('voices'))}</label>
        <ul class="voice-list">${CODES.map(vs).join('')}</ul>
        <button type="button" class="btn danger wide" id="reset">${esc(t('resetProgress'))}</button>
        <p class="about">${esc(t('about'))}</p>
      </div>`;

    $('#closeSettings').addEventListener('click', () => dlg.close());
    $$('.seg', dlg).forEach(sg => sg.addEventListener('click', e => {
      const b = e.target.closest('[data-val]');
      if (!b) return;
      const key = sg.dataset.key, val = b.dataset.val;
      if (key === 'native') {
        S.native = val;
        if (S.target === val) S.target = val === 'ceb' ? 'en' : 'ceb';
      } else {
        if (val === S.native) { toast(t('sameLang')); return; }
        S.target = val;
      }
      S.from = S.native; S.to = S.target;
      save(); applyChrome(); renderSettings(); route();
    }));
    const rate = $('#rate');
    rate.addEventListener('input', () => { S.rate = +rate.value; $('#rateOut').textContent = S.rate.toFixed(2) + '×'; save(); });
    $('#reset').addEventListener('click', e => {
      if (!resetArmed) { resetArmed = true; e.currentTarget.textContent = t('confirmReset'); setTimeout(() => { resetArmed = false; }, 3000); return; }
      resetArmed = false; S.progress = {}; save(); toast(t('progressReset')); renderSettings(); route();
    });
    bindSay(dlg);
  }

  $('#settingsBtn').addEventListener('click', () => {
    loadVoices(); renderSettings();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  /* ---------- chrome & routing ---------- */
  function applyChrome() {
    document.documentElement.lang = S.native;
    $('#tabTranslate').textContent = '🔤 ' + t('translate');
    $('#tabLearn').textContent = '🎓 ' + t('learn');
    $('#settingsBtn').setAttribute('aria-label', t('settings'));
  }

  function route() {
    const h = decodeURIComponent(location.hash.slice(1)).split('/');
    const mode = h[0] === 'translate' ? 'translate' : 'learn';
    nav.dataset.active = mode;
    $$('[data-mode]', nav).forEach(b => b.setAttribute('aria-selected', b.dataset.mode === mode));
    if (mode === 'translate') return renderTranslate();
    const L = LEVELS.find(l => String(l.id) === h[1]);
    const T = L && L.topics.find(x => x.id === h[2]);
    if (L && T) renderTopic(L, T, ['cards', 'list', 'quiz'].includes(h[3]) ? h[3] : 'cards');
    else renderLearn();
  }

  $$('[data-mode]', nav).forEach(b => b.addEventListener('click', () => {
    location.hash = '#' + b.dataset.mode;
  }));

  let lastHash = location.hash;
  window.addEventListener('hashchange', () => {
    const sameTopic = lastHash.split('/').slice(0, 3).join('/') === location.hash.split('/').slice(0, 3).join('/');
    lastHash = location.hash;
    route();
    if (!sameTopic) window.scrollTo({ top: 0 });
  });

  applyChrome();
  route();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
