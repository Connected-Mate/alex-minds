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
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

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

  function unionRects(els) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let count = 0;
    els.forEach(el => {
      if (!el) return;
      const r = getCanvasRect(el);
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
      count++;
    });
    if (!count) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
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

    // QUESTION internal — removed cluttered arrows that crossed through stickies;
    // the 2x2 grid is clear on its own and reveals one sticky at a time anyway.

    // QUESTION → OPENING (Alex introduces himself after the silence question)
    ['z1-why',    'opening-hero',  'now — me',           false, 4],

    // OPENING → BRIDGE (Alex finishes his story, the room moves to the why)
    ['alex-critic', 'bridge-line', 'so why DN ?',        false, 9],

    // CH.1 close → CH.2 BECOME (sa-punch closes Ch.1, TGV senior opens the duo story)
    ['sa-punch',     'ch2-tge-senior', 'how we did it', false, 34],

    // CH.2 BECOME → CH.3 KEEP (readiness/deployment stamp closes ch.2, flip opens ch.3)
    ['ch1-stamp',    'ch2-flip', 'chapter three — keep them', false, 41],

    // CH.3 → MOVES (duos-everywhere closes ch.3, the named-pair move opens)
    ['ch3-duos-everywhere', 'move-2', 'the three moves', false, 53],

    // MOVES → CLOSING
    ['move-4',      'closing-line', 'closing',           false, 56],
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
    // Elements with data-hide-at disappear once we reach that step
    document.querySelectorAll('[data-hide-at]').forEach(el => {
      const h = parseInt(el.dataset.hideAt);
      el.classList.toggle('is-hidden', !Number.isNaN(h) && N >= h);
    });
    // Bridge pivot : AI-native gets struck through once the "Digital-native first"
    // correction reveals (step 10). Driven by the same step engine.
    document.querySelectorAll('.ai-native-target').forEach(el => {
      el.classList.toggle('struck', N >= 10);
    });
    // Split stage : phones land at step 29, THEN tiles fly to their columns at step 30
    const splitStage = document.getElementById('split-stage');
    if (splitStage) {
      splitStage.classList.toggle('is-split', N >= 30);
    }
    // Arrows (live in #arrows-layer)
    arrowsG.querySelectorAll('g.arrow-draw[data-reveal-at]').forEach(g => {
      const s = parseInt(g.dataset.revealAt);
      g.classList.toggle('is-shown', s <= N);
    });

    // Camera : tight on the elements newly revealed AT this step
    // (not the whole zone — fixes the "ultra-dezoomed" problem when zones are tall)
    // Mobile : allow higher max-scale + smaller padding to fit stickies in narrow viewport.
    const isMobileVw = window.innerWidth < 768;
    const camPadding  = isMobileVw ? 20 : 100;
    const camMaxScale = isMobileVw ? 2.8 : 1.4;
    if (N < 0) {
      fitWorld(animated);
    } else {
      const zone = stepZoneCache.get(N);
      // If the zone is marked as "frame whole zone", keep the camera on the full
      // zone-marker instead of zooming on the just-revealed element. Lets a 2x2
      // grid stay readable as items appear one by one.
      if (zone && zone.dataset.frameMode === 'zone') {
        const zr = getCanvasRect(zone);
        frameRect(zr, animated, camPadding, isMobileVw ? 2.0 : 1.05);
      } else {
        const newAtStep = Array.from(canvas.querySelectorAll(`[data-reveal-at="${N}"]`));
        const r = unionRects(newAtStep);
        if (r) {
          frameRect(r, animated, camPadding, camMaxScale);
        } else if (zone) {
          const zr = getCanvasRect(zone);
          frameRect(zr, animated, camPadding, isMobileVw ? 2.2 : 1.25);
        }
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

  /* ════════════════ TOUCH GESTURES (mobile) ════════════════
     Coexist with the existing single-finger pan above.
     Hook only pointerType === 'touch'. Pinch with 2 fingers,
     swipe horizontal for next/prev step, double-tap for fitWorld. */
  const activePointers = new Map();
  let pinchStartDist = 0, pinchStartScale = 1, pinchStartMid = null, pinchStartView = null;
  let isPinching = false;
  let swipeStartX = 0, swipeStartY = 0, swipeStartT = 0, swipeCandidate = false;
  let lastTapT = 0, lastTapX = 0, lastTapY = 0;
  const SWIPE_MIN_DX = 80, SWIPE_MAX_DY = 60, SWIPE_MIN_VEL = 0.3;
  const DOUBLE_TAP_MS = 300, DOUBLE_TAP_DIST = 30;

  stage.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    if (e.target.closest('.progress-labels, .step-counter, .brand-back, a, button')) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      isDown = false; stage.classList.remove('is-panning');
      const pts = Array.from(activePointers.values());
      const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
      pinchStartDist = Math.hypot(dx, dy) || 1;
      pinchStartScale = view.scale;
      pinchStartMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      pinchStartView = { x: view.x, y: view.y };
      isPinching = true;
      swipeCandidate = false;
    } else if (activePointers.size === 1) {
      swipeStartX = e.clientX; swipeStartY = e.clientY; swipeStartT = performance.now();
      swipeCandidate = true;
    }
  });

  stage.addEventListener('pointermove', e => {
    if (e.pointerType !== 'touch') return;
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (isPinching && activePointers.size >= 2) {
      const pts = Array.from(activePointers.values()).slice(0, 2);
      const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy) || 1;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStartScale * (dist / pinchStartDist)));
      const rect = stage.getBoundingClientRect();
      const px = pinchStartMid.x - rect.left, py = pinchStartMid.y - rect.top;
      const wx = (px - pinchStartView.x) / pinchStartScale;
      const wy = (py - pinchStartView.y) / pinchStartScale;
      view.scale = newScale;
      view.x = px - wx * newScale;
      view.y = py - wy * newScale;
      applyTransform();
    }
  });

  function endTouch(e) {
    if (e.pointerType !== 'touch') return;
    const had = activePointers.get(e.pointerId);
    activePointers.delete(e.pointerId);

    if (isPinching && activePointers.size < 2) { isPinching = false; swipeCandidate = false; }

    if (!isPinching && activePointers.size === 0 && swipeCandidate && had) {
      const dt = performance.now() - swipeStartT;
      const dx = e.clientX - swipeStartX, dy = e.clientY - swipeStartY;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const vel = adx / Math.max(1, dt);
      if (dt < 250 && adx < 10 && ady < 10) {
        const now = performance.now();
        if (now - lastTapT < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < DOUBLE_TAP_DIST) {
          fitWorld(true); lastTapT = 0;
        } else {
          lastTapT = now; lastTapX = e.clientX; lastTapY = e.clientY;
        }
      } else if (adx > SWIPE_MIN_DX && ady < SWIPE_MAX_DY && vel > SWIPE_MIN_VEL && adx > ady * 1.5) {
        if (dx < 0) next(); else prev();
      }
      swipeCandidate = false;
    }
  }
  stage.addEventListener('pointerup', endTouch);
  stage.addEventListener('pointercancel', endTouch);

  /* ════════════════ KEYBOARD NAV ════════════════ */
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') { applyStep(-1); return; }
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
  try {
    const stored = localStorage.getItem(STORE_MODE);
    if (stored === '1') applyPublicMode(true);
  } catch (_) {}

  /* ════════════════ PROGRESS LABELS CLICK ════════════════
     Click on a zone label → jump to the first step of that zone */
  document.querySelectorAll('.progress-labels span').forEach(s => {
    s.addEventListener('pointerdown', (e) => { e.stopPropagation(); }, { passive: true });
    s.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetAct = parseInt(s.dataset.step);
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
  function bindNavBtn(btn, fn) {
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); }, { passive: true });
    btn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    btn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); fn(); });
  }
  bindNavBtn(stepPrevBtn, prev);
  bindNavBtn(stepNextBtn, next);

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
