/* =========================================================================
   Vision 02 — Become AI-native
   Speaker storyboard : reveal-by-step, camera tracks last revealed element.
   ========================================================================= */

(() => {
  const stage    = document.getElementById('stage');
  const canvas   = document.getElementById('canvas');
  const arrows   = document.getElementById('arrows');
  const arrowsG  = document.getElementById('arrows-layer');
  const progressFill = document.getElementById('progress-fill');
  const stepCurrentEl = document.getElementById('step-current');
  const stepTotalEl   = document.getElementById('step-total');
  const stepPrevBtn   = document.getElementById('step-prev');
  const stepNextBtn   = document.getElementById('step-next');

  if (!stage || !canvas || !arrows || !arrowsG) return;

  /* ════════════════ WORLD CONFIG ════════════════ */
  const cs = getComputedStyle(document.documentElement);
  const WORLD_W = parseInt(cs.getPropertyValue('--world-w')) || 13800;
  const WORLD_H = parseInt(cs.getPropertyValue('--world-h')) || 1700;

  const view = { x: 0, y: 0, scale: 1 };
  const MIN_SCALE = 0.10;
  const MAX_SCALE = 2.0;

  /* ════════════════ TRANSFORM HELPERS ════════════════ */
  function applyTransform() {
    const t = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    canvas.style.transform = t;
    arrows.style.transform = t;
  }

  function animateTo(target, duration = 700) {
    if (duration === 0) {
      Object.assign(view, target);
      applyTransform();
      return;
    }
    const start = { ...view };
    const t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 4);
    function tick(now) {
      const t = Math.min(1, (now - t0) / duration);
      const e = ease(t);
      view.x = start.x + (target.x - start.x) * e;
      view.y = start.y + (target.y - start.y) * e;
      view.scale = start.scale + (target.scale - start.scale) * e;
      applyTransform();
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function getCanvasRect(el) {
    let x = 0, y = 0;
    let cur = el;
    while (cur && cur !== canvas) {
      x += cur.offsetLeft;
      y += cur.offsetTop;
      cur = cur.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function frameRect(r, animated = true, padding = 100, maxScale = 1.4) {
    if (!r) return;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const scale = Math.min((sw - padding * 2) / r.w, (sh - padding * 2) / r.h, maxScale);
    const x = (sw - r.w * scale) / 2 - r.x * scale;
    const y = (sh - r.h * scale) / 2 - r.y * scale;
    animateTo({ x, y, scale: Math.max(scale, MIN_SCALE) }, animated ? 750 : 0);
  }

  function fitWorld(animated = true) {
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const padding = 60;
    const scale = Math.min((sw - padding * 2) / WORLD_W, (sh - padding * 2) / WORLD_H);
    const x = (sw - WORLD_W * scale) / 2;
    const y = (sh - WORLD_H * scale) / 2;
    animateTo({ x, y, scale }, animated ? 800 : 0);
  }

  /* ════════════════ STEP REVEAL ENGINE ════════════════ */
  const reveals = Array.from(canvas.querySelectorAll('[data-reveal-at]'));
  const stepZoneCache = new Map(); // step → zone element
  let MAX_STEP = 0;

  reveals.forEach(el => {
    const s = parseInt(el.dataset.revealAt);
    if (!Number.isNaN(s)) {
      MAX_STEP = Math.max(MAX_STEP, s);
      // Cache the zone of the *latest* element at each step
      const zone = el.closest('[data-zone]');
      if (zone) stepZoneCache.set(s, zone);
    }
  });

  // Arrows revealed in sync with their target step
  const ARROW_PAIRS = [
    // [from, to, label, isCross, revealAt]

    // QUESTION internal — now 1-by-1
    ['z1-big',    'z1-rev',        'and you ?',          true,  3],
    ['z1-rev',    'z1-def',        "what's that ?",      true,  4],
    ['z1-def',    'z1-why',        '',                   true,  5],

    // QUESTION → BRIDGE
    ['z1-why',    'bridge-line',   '',                   false, 6],

    // BRIDGE internal
    ['bridge-line',      'bridge-facts',     '',         false, 7],
    ['bridge-facts',     'bridge-northstar', '',         true,  7],
    ['bridge-northstar', 'bridge-rl',        '',         true,  8],

    // BRIDGE → CHAPTER 1
    ['bridge-rl', 'ch1-inside',    'chapter one',        false, 9],

    // CHAPTER 1 internal
    ['ch1-inside',  'ch1-outside', 'and outside ?',      true,  10],
    ['ch1-outside', 'ch1-stamp',   '',                   false, 11],

    // CHAPTER 1 → CHAPTER 2
    ['ch1-stamp',   'ch2-flip',    'chapter two',        false, 12],

    // CHAPTER 2 internal
    ['ch2-flip',    'ch2-reasons', '',                   true,  13],
    ['ch2-reasons', 'ch2-alex',    '',                   true,  14],

    // CHAPTER 2 → MOVES
    ['ch2-alex',    'move-1',      'one answer to both', false, 15],

    // MOVES → CLOSING
    ['move-4',      'closing-line', '',                  false, 16],
  ];

  function drawArrow(fromEl, toEl, label, isCross, revealAt) {
    const a = getCanvasRect(fromEl);
    const b = getCanvasRect(toEl);
    const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
    const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
    const dx = bcx - acx, dy = bcy - acy;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    const aSize = Math.min(a.w, a.h) / 2 * 0.85;
    const bSize = Math.min(b.w, b.h) / 2 * 0.85;
    const ax = acx + (dx / dist) * aSize;
    const ay = acy + (dy / dist) * aSize;
    const bx = bcx - (dx / dist) * bSize;
    const by = bcy - (dy / dist) * bSize;

    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const px = -dy / dist, py = dx / dist;
    const wobble = Math.min(60, 18 + dist * 0.05);
    const sign = ((Math.round(acx + bcx) + Math.round(acy + bcy)) % 2 === 0) ? 1 : -1;
    const cx = mx + px * wobble * sign;
    const cy = my + py * wobble * sign;

    const d = `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;

    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', `arrow-draw ${isCross ? 'arrow-cross' : 'arrow-main'}`);
    g.dataset.from = fromEl.dataset.bloc || fromEl.dataset.zone || '';
    g.dataset.to   = toEl.dataset.bloc   || toEl.dataset.zone   || '';
    if (typeof revealAt === 'number') {
      g.dataset.revealAt = revealAt;
    }

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('marker-end', 'url(#arrowhead)');
    if (isCross) path.setAttribute('stroke-dasharray', '6 4');
    g.appendChild(path);

    if (label) {
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('class', 'arrow-label');
      text.setAttribute('x', cx);
      text.setAttribute('y', cy - 6);
      text.setAttribute('text-anchor', 'middle');
      const rot = ((Math.round(cx + cy) % 7) - 3);
      text.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
      text.textContent = label;
      g.appendChild(text);
    }

    g.style.setProperty('--len', Math.round(dist + 80));
    arrowsG.appendChild(g);
  }

  function buildArrows() {
    arrowsG.innerHTML = '';
    ARROW_PAIRS.forEach(([from, to, label, isCross, revealAt]) => {
      const f = canvas.querySelector(`[data-bloc="${from}"]`) || canvas.querySelector(`[data-zone="${from}"]`);
      const t = canvas.querySelector(`[data-bloc="${to}"]`)   || canvas.querySelector(`[data-zone="${to}"]`);
      if (f && t) drawArrow(f, t, label, isCross, revealAt);
    });
  }

  /* ────────────────────────────────────────────────────────────
     applyStep(N)
       N = -1 : nothing revealed, fit world
       N = 0..MAX_STEP : show all elements with data-reveal-at <= N,
                        camera frames the zone of the latest reveal.
     ──────────────────────────────────────────────────────────── */
  let currentStep = -1;

  // Map step → list of "anchor" elements (the new ones at that step)
  const stepAnchors = new Map();
  reveals.forEach(el => {
    const s = parseInt(el.dataset.revealAt);
    if (Number.isNaN(s)) return;
    if (!stepAnchors.has(s)) stepAnchors.set(s, []);
    stepAnchors.get(s).push(el);
  });

  function applyStep(N, animated = true) {
    N = Math.max(-1, Math.min(MAX_STEP, N));
    currentStep = N;

    // Reveal / hide elements
    document.querySelectorAll('[data-reveal-at]').forEach(el => {
      const s = parseInt(el.dataset.revealAt);
      el.classList.toggle('is-shown', s <= N);
    });
    // Arrows (live in #arrows-layer)
    arrowsG.querySelectorAll('g.arrow-draw[data-reveal-at]').forEach(g => {
      const s = parseInt(g.dataset.revealAt);
      g.classList.toggle('is-shown', s <= N);
    });

    // Camera : focus the zone of the latest revealed element
    if (N < 0) {
      fitWorld(animated);
    } else {
      const zone = stepZoneCache.get(N);
      if (zone) {
        const r = getCanvasRect(zone);
        frameRect(r, animated, 110, 1.25);
      }
    }

    // UI updates
    if (stepCurrentEl) stepCurrentEl.textContent = (N < 0 ? 0 : N + 1);
    if (stepPrevBtn) stepPrevBtn.disabled = (N < 0);
    if (stepNextBtn) stepNextBtn.disabled = (N >= MAX_STEP);

    // Progress bar : map current step to the zone's act index
    if (progressFill) {
      const total = MAX_STEP + 1;
      const fill = (N < 0) ? 0 : ((N + 1) / total) * 100;
      progressFill.style.width = `${fill}%`;
    }

    // Highlight current zone label in topbar
    const labels = document.querySelectorAll('.progress-labels span');
    let currentAct = -1;
    if (N >= 0) {
      const zone = stepZoneCache.get(N);
      if (zone) currentAct = parseInt(zone.dataset.step);
    }
    labels.forEach(s => {
      const step = parseInt(s.dataset.step);
      s.classList.toggle('is-current', step === currentAct);
    });
  }

  function next() { applyStep(currentStep + 1); }
  function prev() { applyStep(currentStep - 1); }

  /* ════════════════ POINTER PAN ════════════════ */
  let isDown = false, startX = 0, startY = 0, startVX = 0, startVY = 0, didDrag = false;

  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.progress-labels, .step-counter, .brand-back, a, button')) return;
    isDown = true; didDrag = false;
    startX = e.clientX; startY = e.clientY;
    startVX = view.x; startVY = view.y;
    stage.classList.add('is-panning');
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  });
  stage.addEventListener('pointermove', e => {
    if (!isDown) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!didDrag && Math.hypot(dx, dy) > 5) didDrag = true;
    if (didDrag) {
      view.x = startVX + dx;
      view.y = startVY + dy;
      applyTransform();
    }
  });
  function endPan(e) {
    isDown = false;
    stage.classList.remove('is-panning');
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  stage.addEventListener('pointerup', endPan);
  stage.addEventListener('pointercancel', endPan);

  /* ════════════════ WHEEL ════════════════ */
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = stage.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const delta = -e.deltaY * 0.015;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * (1 + delta)));
      if (newScale === view.scale) return;
      const wx = (px - view.x) / view.scale;
      const wy = (py - view.y) / view.scale;
      view.scale = newScale;
      view.x = px - wx * view.scale;
      view.y = py - wy * view.scale;
      applyTransform();
    } else {
      view.x -= e.deltaX;
      view.y -= e.deltaY;
      applyTransform();
    }
  }, { passive: false });

  /* ════════════════ KEYBOARD NAV ════════════════ */
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') {
      if (document.body.classList.contains('is-faq-open')) {
        toggleFaq(false);
        return;
      }
      applyStep(-1);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      next();
    }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      prev();
    }
    if (e.key === 'Home' || e.key === '0') applyStep(0);
    if (e.key === 'End') applyStep(MAX_STEP);
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      toggleFaq();
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePublicMode();
    }
  });

  /* ════════════════ MODE TOGGLE (speaker ↔ public) ════════════════ */
  const STORE_MODE = 'v02-public-mode';
  function applyPublicMode(isPublic) {
    document.body.classList.toggle('is-public-mode', isPublic);
    try { localStorage.setItem(STORE_MODE, isPublic ? '1' : '0'); } catch (_) {}
  }
  function togglePublicMode() {
    applyPublicMode(!document.body.classList.contains('is-public-mode'));
  }
  // Restore preference
  try {
    const stored = localStorage.getItem(STORE_MODE);
    if (stored === '1') applyPublicMode(true);
  } catch (_) {}

  const modeToggleBtn = document.getElementById('mode-toggle');
  if (modeToggleBtn) modeToggleBtn.addEventListener('click', togglePublicMode);

  /* ════════════════ FAQ TRAY (reserve answers) ════════════════ */
  const faqTray = document.getElementById('faq-tray');
  const faqBtn  = document.getElementById('faq-btn');
  const faqClose = document.getElementById('faq-close');

  function toggleFaq(force) {
    const open = typeof force === 'boolean' ? force : !document.body.classList.contains('is-faq-open');
    document.body.classList.toggle('is-faq-open', open);
    if (faqTray) faqTray.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  if (faqBtn)   faqBtn.addEventListener('click', () => toggleFaq());
  if (faqClose) faqClose.addEventListener('click', () => toggleFaq(false));

  /* ════════════════ PROGRESS LABELS CLICK ════════════════
     Click on a zone label → jump to the first step of that zone */
  document.querySelectorAll('.progress-labels span').forEach(s => {
    s.addEventListener('click', () => {
      const targetAct = parseInt(s.dataset.step);
      // Find the first step whose zone matches this act
      for (let step = 0; step <= MAX_STEP; step++) {
        const zone = stepZoneCache.get(step);
        if (zone && parseInt(zone.dataset.step) === targetAct) {
          applyStep(step);
          return;
        }
      }
    });
  });

  /* ════════════════ STEP COUNTER BUTTONS ════════════════ */
  if (stepPrevBtn) stepPrevBtn.addEventListener('click', prev);
  if (stepNextBtn) stepNextBtn.addEventListener('click', next);

  /* ════════════════ RESIZE ════════════════ */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Rebuild arrows for current geometry, then re-apply current step
      buildArrows();
      applyStep(currentStep, false);
    }, 200);
  });

  /* ════════════════ INIT ════════════════ */
  function init() {
    if (stepTotalEl) stepTotalEl.textContent = MAX_STEP + 1;
    fitWorld(false);
    requestAnimationFrame(() => {
      buildArrows();
      setTimeout(() => applyStep(0), 350);
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('load', init);
  } else {
    init();
  }
})();
