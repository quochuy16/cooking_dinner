(() => {
  'use strict';

  const KEY_HISTORY = 'tnag.history.v1';
  const KEY_CUSTOM = 'tnag.custom.v1';

  const load = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* bỏ qua khi trình duyệt chặn storage */ }
  };

  const STEPS = [
    { key: 'man', label: 'Món mặn', icon: '🍖', question: 'Vợ ơi, món chính tối nay là gì?', hint: 'Chọn 1 món mặn để ăn với cơm' },
    { key: 'canh', label: 'Canh', icon: '🥣', question: 'Thêm bát canh cho dễ ăn nhé?', hint: 'Bữa cơm Việt sao thiếu canh được' },
    { key: 'rau', label: 'Rau', icon: '🥬', question: 'Rau gì cho mát hả vợ?', hint: 'Xào, luộc hay ăn sống đều được' },
    { key: 'trang', label: 'Tráng miệng', icon: '🍉', question: 'Tráng miệng chút không vợ?', hint: 'Không thích thì bỏ qua cũng được', optional: true },
  ];

  const MOODS = [
    { id: 'nhanh', emoji: '⚡', label: 'Nhanh gọn', sub: 'Món dưới 25 phút, mệt thì ăn nhẹ', max: 25 },
    { id: 'thuong', emoji: '🏠', label: 'Cơm nhà', sub: 'Món dưới 45 phút, bình thường như mọi ngày', max: 45 },
    { id: 'sang', emoji: '🎉', label: 'Thịnh soạn', sub: 'Tất cả các món, hôm nay có dịp', max: Infinity },
  ];

  const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

  let history = load(KEY_HISTORY, []);
  let custom = load(KEY_CUSTOM, []);

  const state = {
    view: 'home',     // home | mood | step | summary | history
    step: 0,
    mood: 'thuong',
    people: 2,
    picks: {},
    checked: {},
    adding: false,
    returnToSummary: false,
    flowView: 'home', // view của tab "Chọn món" để quay lại sau khi xem nhật ký
  };

  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  // ---------- Helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
  const prettyDate = (key) => { const d = parseKey(key); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`; };
  const moodOf = (id) => MOODS.find((m) => m.id === id) || MOODS[1];

  const allDishes = (cat) => [...window.DISHES[cat], ...custom.filter((c) => c.cat === cat)];
  const findDish = (id) => {
    for (const cat of Object.keys(window.DISHES)) {
      const d = allDishes(cat).find((x) => x.id === id);
      if (d) return d;
    }
    return null;
  };

  function options(cat) {
    const max = moodOf(state.mood).max;
    const all = allDishes(cat);
    const fit = all.filter((d) => d.custom || d.time <= max);
    return fit.length >= 4 ? fit : all;
  }

  function lastEatenMap() {
    const map = {};
    const today = todayKey();
    for (const h of history) {
      const ago = daysBetween(h.date, today);
      for (const id of Object.values(h.picks)) {
        if (id && (map[id] === undefined || ago < map[id])) map[id] = ago;
      }
    }
    return map;
  }

  function recentLabel(ago) {
    if (ago === undefined) return '';
    if (ago <= 0) return 'Hôm nay đã chốt';
    if (ago === 1) return 'Hôm qua vừa ăn';
    if (ago <= 6) return `${ago} ngày trước`;
    return '';
  }

  function randomPick(cat) {
    const opts = options(cat);
    const recent = lastEatenMap();
    const fresh = opts.filter((d) => !(recent[d.id] <= 3) && d.id !== state.picks[cat]);
    const pool = fresh.length ? fresh : opts;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  function chosenItems() {
    return STEPS.map((s) => ({ s, d: state.picks[s.key] ? findDish(state.picks[s.key]) : null }));
  }

  function ingredients() {
    const seen = new Set();
    for (const { d } of chosenItems()) if (d) d.ing.forEach((i) => seen.add(i));
    return [...seen];
  }

  function cookTime() {
    const times = chosenItems().filter((x) => x.d).map((x) => x.d.time || 0);
    if (!times.length) return 0;
    const max = Math.max(...times);
    const sum = times.reduce((a, b) => a + b, 0);
    // Nấu song song: món lâu nhất + một phần thời gian các món còn lại
    return Math.round((max + (sum - max) * 0.4) / 5) * 5;
  }

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  function go(view, extra = {}) {
    Object.assign(state, extra, { view });
    if (view !== 'history') state.flowView = view;
    render(true);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  // ---------- Views ----------
  function viewHome() {
    const today = history.find((h) => h.date === todayKey());
    const todayNames = today ? Object.values(today.picks).map(findDish).filter(Boolean).map((d) => d.name) : [];
    return `
      <section class="hero">
        <div class="hero-emoji" aria-hidden="true">🍲</div>
        <p class="eyebrow">${prettyDate(todayKey())}</p>
        <h1>Tối nay ăn gì<br>hả vợ? 💕</h1>
        <p class="lead">Vợ chỉ cần chọn lần lượt từng món. Chồng lo đi chợ và phụ nấu.</p>
      </section>
      ${today ? `
        <div class="card today">
          <span class="emo">✅</span>
          <p><b>Tối nay đã chốt:</b><br>${esc(todayNames.join(', '))}</p>
          <button class="chip" data-action="open-today">Xem</button>
        </div>` : ''}
      <div class="stack">
        <button class="btn btn-primary btn-lg" data-action="start">Bắt đầu chọn món →</button>
        <button class="btn btn-soft btn-lg" data-action="random-all">🎲 Chọn đại giùm em</button>
      </div>
      <div class="how" aria-label="Cách dùng">
        <div><b>🍽️</b>Chọn kiểu bữa tối</div>
        <div><b>👆</b>Chọn từng món một</div>
        <div><b>🛵</b>Gửi chồng đi chợ</div>
      </div>`;
  }

  function viewMood() {
    return `
      <div class="head">
        <p class="eyebrow">Khởi động</p>
        <h2>Hôm nay vợ muốn bữa tối thế nào?</h2>
      </div>
      <div class="moods">
        ${MOODS.map((m) => `
          <button class="mood ${state.mood === m.id ? 'selected' : ''}" data-action="mood" data-id="${m.id}">
            <span class="emo">${m.emoji}</span>
            <span><b>${m.label}</b><small>${m.sub}</small></span>
          </button>`).join('')}
      </div>
      <div class="people">
        <span><b>👥 Mấy người ăn?</b></span>
        <div class="stepper">
          <button data-action="people" data-delta="-1" aria-label="Bớt người">−</button>
          <output>${state.people}</output>
          <button data-action="people" data-delta="1" aria-label="Thêm người">+</button>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" data-action="home">←</button>
        <button class="btn btn-primary" data-action="to-steps">Chọn món thôi →</button>
      </div>`;
  }

  function viewStep() {
    const s = STEPS[state.step];
    const recent = lastEatenMap();
    const picked = state.picks[s.key];
    const isLast = state.step === STEPS.length - 1;
    const nextLabel = state.returnToSummary ? 'Xong ✓' : isLast ? 'Xem thực đơn' : 'Tiếp →';

    return `
      <div class="progress">${STEPS.map((_, i) => `<span class="${i <= state.step ? 'on' : ''}"></span>`).join('')}</div>
      <div class="head">
        <p class="eyebrow">Bước ${state.step + 1}/${STEPS.length} · ${s.icon} ${s.label}</p>
        <h2>${s.question}</h2>
        <p class="muted">${s.hint}</p>
      </div>
      <div class="toolbar">
        <button class="chip" data-action="shuffle">🎲 Chọn hộ</button>
        <button class="chip" data-action="toggle-add">${state.adding ? '✕ Đóng' : '✍️ Món khác'}</button>
      </div>
      ${state.adding ? `
        <form class="add-form" data-form="add">
          <input name="name" maxlength="40" placeholder="Tên món, ví dụ: Bún chả" autocomplete="off" required>
          <button class="btn btn-primary" type="submit">Thêm</button>
        </form>` : ''}
      <div class="grid">
        ${options(s.key).map((d) => {
          const label = recentLabel(recent[d.id]);
          return `
            <button class="dish ${picked === d.id ? 'selected' : ''}" data-action="pick" data-id="${esc(d.id)}" aria-pressed="${picked === d.id}">
              <span class="emo">${d.emoji}</span>
              <span class="name">${esc(d.name)}</span>
              ${label ? `<span class="badge">${label}</span>` : ''}
              <span class="meta">${d.custom ? '⭐ Món nhà mình' : `⏱ ${d.time ? d.time + ' phút' : 'Có sẵn'}`}</span>
            </button>`;
        }).join('')}
      </div>
      <div class="actions">
        <button class="btn btn-ghost" data-action="back">←</button>
        ${s.optional ? '<button class="btn btn-ghost" data-action="skip">Bỏ qua</button>' : ''}
        <button class="btn btn-primary" data-action="next" ${picked ? '' : 'disabled'}>${nextLabel}</button>
      </div>`;
  }

  function viewSummary() {
    const mood = moodOf(state.mood);
    const ing = ingredients();
    const doneCount = ing.filter((i) => state.checked[i]).length;
    return `
      <div class="card menu-card">
        <div class="head">
          <p class="eyebrow">Thực đơn tối nay</p>
          <h2>${prettyDate(todayKey())}</h2>
          <p class="muted">${mood.emoji} ${mood.label} · 👥 ${state.people} người · ⏱ ~${cookTime()} phút</p>
        </div>
        <ul class="menu-list">
          ${chosenItems().map(({ s, d }, i) => `
            <li>
              <button class="${d ? '' : 'none'}" data-action="edit" data-step="${i}">
                <span class="emo">${d ? d.emoji : s.icon}</span>
                <span><small>${s.label}</small><b>${d ? esc(d.name) : 'Không có'}</b></span>
                <span class="edit">Đổi</span>
              </button>
            </li>`).join('')}
        </ul>
      </div>
      ${ing.length ? `
        <section class="card shopping">
          <h3>🛒 Đi chợ cần mua <small>${doneCount}/${ing.length}</small></h3>
          <ul class="checklist">
            ${ing.map((i) => `
              <li><label>
                <input type="checkbox" data-action="check" data-ing="${esc(i)}" ${state.checked[i] ? 'checked' : ''}>
                <span>${esc(i)}</span>
              </label></li>`).join('')}
          </ul>
          <p class="muted" style="font-size:13px;margin-top:8px">Gia vị cơ bản (mắm, muối, dầu ăn…) nhà mình tự có nhé.</p>
        </section>` : ''}
      <div class="center">
        <button class="btn-link" data-action="restart">Chọn lại từ đầu</button>
      </div>
      <div class="actions">
        <button class="btn btn-soft" data-action="share">💌 Gửi chồng</button>
        <button class="btn btn-primary" data-action="commit">✅ Chốt thực đơn</button>
      </div>`;
  }

  function viewHistory() {
    if (!history.length) {
      return `
        <div class="head"><h2>📒 Nhật ký bữa tối</h2></div>
        <div class="empty">
          <span class="emo">🍚</span>
          <p>Chưa có bữa nào được chốt.<br>Chọn món xong bấm “Chốt thực đơn” để lưu lại nhé.</p>
          <button class="btn btn-primary" data-action="tab" data-tab="flow">Chọn món ngay</button>
        </div>`;
    }

    const counts = {};
    history.forEach((h) => Object.values(h.picks).forEach((id) => { if (id) counts[id] = (counts[id] || 0) + 1; }));
    const topId = Object.keys(counts).filter((id) => findDish(id)).sort((a, b) => counts[b] - counts[a])[0];
    const top = topId ? findDish(topId) : null;

    return `
      <div class="head"><h2>📒 Nhật ký bữa tối</h2><p class="muted">Xem lại để khỏi ăn trùng món nhé.</p></div>
      <div class="stats">
        <div class="stat"><small>Số bữa đã chốt</small><b>${history.length} bữa</b></div>
        <div class="stat"><small>Món hay ăn nhất</small><b>${top ? `${top.emoji} ${esc(top.name)}` : '—'}</b></div>
      </div>
      <div class="entries">
        ${history.map((h, idx) => {
          const dishes = STEPS.map((s) => h.picks[s.key] && findDish(h.picks[s.key])).filter(Boolean);
          const ago = daysBetween(h.date, todayKey());
          const when = ago === 0 ? 'Hôm nay' : ago === 1 ? 'Hôm qua' : `${ago} ngày trước`;
          return `
            <article class="card entry">
              <div class="entry-head"><h3>${prettyDate(h.date)}</h3><small>${when}</small></div>
              <div class="entry-dishes">${dishes.map((d) => `<span>${d.emoji} ${esc(d.name)}</span>`).join('')}</div>
              <div class="entry-actions">
                <button class="chip" data-action="reuse" data-idx="${idx}">🔁 Ăn lại bữa này</button>
                <button class="chip" data-action="remove" data-idx="${idx}">🗑️ Xoá</button>
              </div>
            </article>`;
        }).join('')}
      </div>`;
  }

  const VIEWS = { home: viewHome, mood: viewMood, step: viewStep, summary: viewSummary, history: viewHistory };

  function render(animate = false) {
    app.innerHTML = `<div class="view ${animate ? 'animate' : ''}">${VIEWS[state.view]()}</div>`;
    // Đưa thanh nút ra ngoài .view: transform của hiệu ứng chuyển cảnh làm position:fixed bám theo .view thay vì màn hình
    const bar = app.querySelector('.view .actions');
    if (bar) app.appendChild(bar);
    const tab = state.view === 'history' ? 'history' : 'flow';
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    if (state.view === 'step' && state.adding) app.querySelector('.add-form input')?.focus();
  }

  // ---------- Flow ----------
  function nextStep() {
    state.adding = false;
    if (state.returnToSummary || state.step >= STEPS.length - 1) {
      go('summary', { returnToSummary: false });
    } else {
      go('step', { step: state.step + 1 });
    }
  }

  function menuText() {
    const lines = [`🍚 Thực đơn tối ${prettyDate(todayKey())} (${state.people} người)`, ''];
    chosenItems().forEach(({ s, d }) => { if (d) lines.push(`${s.icon} ${s.label}: ${d.name}`); });
    const ing = ingredients().filter((i) => !state.checked[i]);
    if (ing.length) {
      lines.push('', '🛒 Chồng đi chợ mua giúp vợ:');
      ing.forEach((i) => lines.push(`• ${i}`));
    }
    lines.push('', 'Cảm ơn chồng iu 💕');
    return lines.join('\n');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('📋 Đã sao chép, dán vào Zalo gửi chồng nhé!');
  }

  async function shareMenu() {
    const text = menuText();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Thực đơn tối nay', text });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    copyText(text);
  }

  function commit() {
    const entry = { date: todayKey(), picks: { ...state.picks }, mood: state.mood, people: state.people };
    history = [entry, ...history.filter((h) => h.date !== entry.date)].slice(0, 90);
    save(KEY_HISTORY, history);
    toast('✅ Đã chốt! Chồng chuẩn bị đi chợ thôi 🛵');
    go('home');
  }

  // ---------- Events ----------
  const actions = {
    start: () => go('mood'),
    home: () => go('home'),
    'random-all': () => {
      STEPS.forEach((s) => { state.picks[s.key] = randomPick(s.key); });
      state.checked = {};
      go('summary');
      toast('🎲 Ông trời đã chọn cho vợ rồi đó!');
    },
    'open-today': () => {
      const today = history.find((h) => h.date === todayKey());
      if (!today) return;
      go('summary', { picks: { ...today.picks }, mood: today.mood, people: today.people, checked: {} });
    },
    mood: (el) => { state.mood = el.dataset.id; render(); },
    people: (el) => { state.people = Math.min(20, Math.max(1, state.people + Number(el.dataset.delta))); render(); },
    'to-steps': () => go('step', { step: 0, picks: {}, checked: {}, returnToSummary: false, adding: false }),
    pick: (el) => {
      const s = STEPS[state.step];
      state.picks[s.key] = el.dataset.id;
      render();
      const step = state.step;
      setTimeout(() => { if (state.view === 'step' && state.step === step) nextStep(); }, 380);
    },
    shuffle: () => {
      const s = STEPS[state.step];
      state.picks[s.key] = randomPick(s.key);
      render();
      app.querySelector('.dish.selected')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    'toggle-add': () => { state.adding = !state.adding; render(); },
    next: () => nextStep(),
    skip: () => { delete state.picks[STEPS[state.step].key]; nextStep(); },
    back: () => {
      state.adding = false;
      if (state.returnToSummary) go('summary', { returnToSummary: false });
      else if (state.step === 0) go('mood');
      else go('step', { step: state.step - 1 });
    },
    edit: (el) => go('step', { step: Number(el.dataset.step), returnToSummary: true, adding: false }),
    check: (el) => {
      state.checked[el.dataset.ing] = el.checked;
      const ing = ingredients();
      const small = app.querySelector('.shopping h3 small');
      if (small) small.textContent = `${ing.filter((i) => state.checked[i]).length}/${ing.length}`;
    },
    restart: () => go('mood', { picks: {}, checked: {} }),
    share: () => shareMenu(),
    commit: () => commit(),
    reuse: (el) => {
      const h = history[Number(el.dataset.idx)];
      if (!h) return;
      go('summary', { picks: { ...h.picks }, mood: h.mood, people: h.people, checked: {} });
    },
    remove: (el) => {
      const idx = Number(el.dataset.idx);
      if (!history[idx] || !confirm(`Xoá bữa ${prettyDate(history[idx].date)} khỏi nhật ký?`)) return;
      history.splice(idx, 1);
      save(KEY_HISTORY, history);
      render();
    },
    tab: (el) => {
      if (el.dataset.tab === 'history') {
        if (state.view !== 'history') go('history');
      } else {
        go(state.view === 'history' ? state.flowView : 'home');
      }
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !actions[el.dataset.action]) return;
    actions[el.dataset.action](el, e);
  });

  app.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form="add"]');
    if (!form) return;
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) return;
    const cat = STEPS[state.step].key;
    const dish = { id: `c-${Date.now()}`, cat, name, emoji: '🍽️', time: 30, ing: [], custom: true };
    custom.push(dish);
    save(KEY_CUSTOM, custom);
    state.picks[cat] = dish.id;
    state.adding = false;
    render();
    toast(`⭐ Đã thêm “${name}” vào món nhà mình`);
  });

  render(true);
})();
