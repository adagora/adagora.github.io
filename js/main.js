/* ═══════════════════════════════════════════════
   main.js — adagora.github.io
   Navigation, contribution graph, scroll effects
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Util ── */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  /* ── Mobile nav toggle ── */
  const nav = $('.nav');
  const toggle = $('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  /* ── Active nav link on scroll ── */
  const navLinks = $$('.nav-links a');
  const sections = $$('section[id]');

  function updateActiveNav() {
    const scrollY = window.scrollY + 120;
    let current = '';
    for (const s of sections) {
      if (s.offsetTop <= scrollY) current = s.id;
    }
    for (const a of navLinks) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    }
  }
  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  /* ── Scroll reveal ── */
  const revealObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) e.target.classList.add('visible');
    }
  }, { threshold: 0.12 });

  $$('.reveal').forEach(el => revealObserver.observe(el));

  /* ── Contribution Graph ── */
  function renderGraph(canvas, data) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.clientWidth;
    const H = 130;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const cellSize = 11;
    const cellGap = 3;
    const step = cellSize + cellGap;
    const cols = 53;
    const rows = 7;
    const totalW = cols * step;
    const startX = Math.max(0, (W - totalW) / 2);

    ctx.clearRect(0, 0, W, H);

    if (!data || !data.days || Object.keys(data.days).length === 0) {
      ctx.fillStyle = '#555570';
      ctx.font = '13px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Run the GitHub Action or generate-commit-stats.js to see commit data', W / 2, H / 2 + 5);
      return;
    }

    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    // Align to start of week (Sunday)
    const startDate = new Date(oneYearAgo);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Find max commits for normalization
    let maxCount = 0;
    for (const key in data.days) {
      if (data.days[key] > maxCount) maxCount = data.days[key];
    }

    const levels = [0, 1, 3, 6, Infinity]; // thresholds
    const colors = ['#12121c', '#0d3b2e', '#0a6e4c', '#0ea568', '#18efb1'];
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Draw month labels
    ctx.fillStyle = '#555570';
    ctx.font = '9px DM Sans, sans-serif';
    ctx.textAlign = 'start';

    for (let c = 0; c < cols; c++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + c * 7);
      const month = day.getMonth();
      const prevDay = new Date(day);
      prevDay.setDate(prevDay.getDate() - 7);
      if (c === 0 || month !== prevDay.getMonth()) {
        ctx.fillText(monthLabels[month], startX + c * step, 10);
      }
    }

    // Draw weekday labels
    ctx.fillStyle = '#555570';
    ctx.font = '9px DM Sans, sans-serif';
    ctx.textAlign = 'end';
    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    for (let r = 0; r < rows; r++) {
      if (dayLabels[r]) {
        ctx.fillText(dayLabels[r], startX - 4, 22 + r * step + 8);
      }
    }

    // Draw cells
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const day = new Date(startDate);
        day.setDate(day.getDate() + c * 7 + r);
        const key = day.toISOString().slice(0, 10);
        const count = data.days[key] || 0;

        let level = 0;
        for (let i = 0; i < levels.length; i++) {
          if (count <= levels[i]) { level = i; break; }
        }
        if (level > 4) level = 4;

        // Skip future dates
        if (day > today) continue;

        ctx.fillStyle = colors[level];
        ctx.fillRect(startX + c * step, 18 + r * step, cellSize, cellSize);
      }
    }

    // Draw total
    ctx.fillStyle = '#8888a0';
    ctx.font = '11px DM Sans, sans-serif';
    ctx.textAlign = 'start';
    // Total is shown in HTML title - no need to duplicate
  }

  function loadGraph() {
    const canvas = document.getElementById('activity-graph');
    if (!canvas) return;

    fetch('data/commit-stats.json')
      .then(r => r.json())
      .then(data => {
        renderGraph(canvas, data);
        const totalEl = document.getElementById('graph-total');
        if (totalEl && data.total > 0) {
          totalEl.innerHTML = `<strong>${data.total.toLocaleString()}</strong> contributions in the last year`;
        }
        const sourceEl = document.getElementById('graph-source');
        if (sourceEl && data.repos && data.repos.length > 0) {
          sourceEl.textContent = `Across ${data.repos.length} repositories`;
          sourceEl.innerHTML += ` · <a href="${window.location.origin}" target="_blank">adagora</a>`;
        }
      })
      .catch(() => {
        // No data yet — render empty state
        renderGraph(canvas, null);
      });
  }

  loadGraph();

  /* ── Re-render graph on resize ── */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(loadGraph, 300);
  });

  /* ── Shipstream Activity Feed ── */
  function timeAgo(dateStr) {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now - d;
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.round(diffDays / 30)}mo ago`;
    return `${Math.round(diffDays / 365)}y ago`;
  }

  function renderShipstream(data) {
    const feed = document.getElementById('shipstream-feed');
    if (!feed) return;

    if (!data || !data.items || data.items.length === 0) {
      feed.innerHTML = `<div class="shipstream-empty">
        No activity yet. The feed auto-populates once the GitHub Action runs with a configured PAT.
      </div>`;
      return;
    }

    feed.innerHTML = data.items.map(item => {
      const isPr = item.type === 'pr';
      const icon = isPr
        ? `<span class="shipstream-icon pr">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854v2.396h.775c1.766 0 3.225 1.312 3.225 2.93v3.188a2.251 2.251 0 1 1-1.5 0V6.18c0-.552-.492-.854-1.225-.854H10v2.396a.25.25 0 0 1-.427.177L7.177 5.427a.25.25 0 0 1 0-.354z"/></svg>
          </span>`
        : `<span class="shipstream-icon commit">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5H11.93zm-3.93-2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>
          </span>`;

      const badge = isPr
        ? `<span class="shipstream-badge merged">merged</span>`
        : '';

      const title = isPr
        ? `<a href="${item.url}" target="_blank" rel="noopener">${item.title}</a>`
        : `<a href="${item.url}" target="_blank" rel="noopener">${item.message}</a>`;

      const typeClass = isPr ? 'shipstream-item--pr' : 'shipstream-item--commit';
      return `<div class="shipstream-item ${typeClass}">
        ${icon}
        <div class="shipstream-body">
          <div class="shipstream-title">${title}</div>
          <div class="shipstream-meta">
            <span class="shipstream-repo">${item.repo}</span>
            ${badge}
            <span class="shipstream-time">${timeAgo(item.date)}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function loadShipstream() {
    fetch('data/recent-activity.json')
      .then(r => r.json())
      .then(data => {
        renderShipstream(data);
        const footer = document.getElementById('shipstream-footer');
        if (footer && data.generated) {
          const d = new Date(data.generated);
          footer.innerHTML = `Updated <a href="https://github.com/adagora/adagora.github.io/actions/workflows/commit-stats.yml" target="_blank" rel="noopener">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</a> · via GitHub Action`;
        }
      })
      .catch(() => {
        const feed = document.getElementById('shipstream-feed');
        if (feed) {
          feed.innerHTML = `<div class="shipstream-empty">
            Could not load activity feed. Run the GitHub Action to populate it.
          </div>`;
        }
      });
  }

  loadShipstream();

})();
