/* =========================================================================
   Méthode Digital Natif — canvas pan/zoom + chronologie 25 stations
   Chaque section a une "vue globale" + zoom sur chaque sous-phase.
   Code organisé en sections logiques pour modification facile.
   ========================================================================= */

(() => {
  /* ════════════════ DOM REFS ════════════════ */
  const stage    = document.getElementById('stage');
  const canvas   = document.getElementById('canvas');
  const arrows   = document.getElementById('arrows');
  const arrowsG  = document.getElementById('arrows-layer');
  const help     = document.getElementById('help');
  const minimapFrame = document.getElementById('minimap-frame');
  const progressFill = document.getElementById('progress-fill');
  const chronoCurrent = document.getElementById('chrono-current');
  const chronoPrev = document.getElementById('chrono-prev');
  const chronoNext = document.getElementById('chrono-next');
  const chronoNav = document.querySelector('.chrono-nav');
  const revealBanner = document.getElementById('reveal-banner');
  const revealName = document.getElementById('reveal-name');
  const revealTargets = document.getElementById('reveal-targets');
  const revealClose = document.getElementById('reveal-close');
  const storyHint = document.getElementById('story-hint');
  const storyHintText = document.getElementById('story-hint-text');

  /* Hints par station — guide l'utilisateur vers le bouton "suivant"
     pendant la séquence storyboard (Partie 2). */
  const STORY_HINTS = {
    '2.2': "clique pour voir le PO annoter",
    '2.3': "clique pour voir les notes descendre",
    '2.4': "clique pour voir l'IA prendre",
    '2.5': "clique pour voir 'OK je review ça'",
    '2.6': "clique pour remonter voir les détails review",
    '2.6a': "clique pour redescendre confirmer en Fait",
    '2.7': "clique pour l'envoi GitHub final",
  };

  /* ════════════════ WORLD CONFIG ════════════════ */
  const cs = getComputedStyle(document.documentElement);
  const WORLD_W = parseInt(cs.getPropertyValue('--world-w')) || 10000;
  const WORLD_H = parseInt(cs.getPropertyValue('--world-h')) || 1500;

  const view = { x: 0, y: 0, scale: 1 };
  const MIN_SCALE = 0.10;
  const MAX_SCALE = 2.0;

  /* ════════════════ STATIONS (chronologie complète)
     Chaque section commence par sa "vue globale" (dézoom) puis enchaîne
     les sous-phases zoomées une par une. Total : 25 stations.
     Pour modifier la séquence, ajoute/retire des entrées de cet array.
     ════════════════ */
  const ACTS = [
    // Section 0 — Amorce
    { name: 'Amorce', section: 0, step: 'INTRO',
      target: { kind: 'zone', id: 'opening' } },

    // Section 1 — Postulat
    { name: 'Postulat', section: 1, step: '01',
      target: { kind: 'zone', id: 'postulate' } },

    // Section 2 — PARTIE 1 (1 vue globale + 8 phases)
    { name: 'Partie 1 · vue globale', section: 2, step: 'P1',
      target: { kind: 'group', ids: ['part1-header', 'f-brief', 'f-live', 'f-wireframes'] } },
    { name: '1.1 Brief — tous profils', section: 2, step: '1.1',
      target: { kind: 'bloc', id: 'f-brief' }, pad: 100 },
    { name: '1.2 Spec-driven', section: 2, step: '1.2',
      target: { kind: 'bloc', id: 'f-spec' }, pad: 100 },
    { name: '1.3 Specs détaillées', section: 2, step: '1.3',
      target: { kind: 'bloc', id: 'f-spec-detail' }, pad: 100 },
    { name: '1.4 Wireframes', section: 2, step: '1.4',
      target: { kind: 'bloc', id: 'f-wireframes' } },
    { name: '1.5 Pré-développement', section: 2, step: '1.5',
      target: { kind: 'bloc', id: 'f-predev' } },
    { name: '1.6 Le split (design + dev + Vibe + DS, en parallèle)', section: 2, step: '1.6',
      target: { kind: 'group', ids: ['f-split', 'f-design-artist', 'f-handoff', 'f-vibe', 'f-dev-socle', 'f-branches', 'f-components'] } },
    { name: '1.7 Convergence — front × back', section: 2, step: '1.7',
      target: { kind: 'group', ids: ['f-converge', 'f-backend'] } },
    { name: '1.8 Le produit vit', section: 2, step: '1.8',
      target: { kind: 'bloc', id: 'f-live' } },

    // Section 3 — PARTIE 2 (1 vue globale + 7 phases)
    { name: 'Partie 2 · vue globale', section: 3, step: 'P2',
      target: { kind: 'group', ids: ['part2-header', 'prod-tool', 'prod-app-live'] }, pad: 140 },
    { name: '2.1 L\'outil qui voit le code', section: 3, step: '2.1',
      target: { kind: 'bloc', id: 'prod-tool' } },
    { name: '2.2 Le PO arrive sur l\'app', section: 3, step: '2.2',
      target: { kind: 'bloc', id: 'prod-app-live' } },
    { name: '2.3 Il annote ce qui cloche', section: 3, step: '2.3',
      target: { kind: 'bloc', id: 'prod-app-live' } },
    { name: '2.4 Les notes descendent dans le Kanban', section: 3, step: '2.4',
      target: { kind: 'bloc', id: 'prod-kanban' }, pad: 80 },
    { name: '2.5 L\'IA prend, code, finit en Review', section: 3, step: '2.5',
      target: { kind: 'bloc', id: 'prod-kanban' }, pad: 80 },
    { name: '2.6 « OK je review ça »', section: 3, step: '2.6',
      target: { kind: 'bloc', id: 'prod-kanban' }, pad: 80 },
    { name: '2.6a On remonte voir la review (détails)', section: 3, step: '2.6a',
      target: { kind: 'group', ids: ['prod-review-arrive', 'prod-github-branch', 'prod-preview', 'prod-verifs', 'prod-techlead'] }, pad: 100 },
    { name: '2.7 Redescente → carte passe en Fait', section: 3, step: '2.7',
      target: { kind: 'bloc', id: 'prod-kanban' }, pad: 80 },

    // Section 4 — PILIERS (1 vue globale + 3 sous-piliers)
    { name: 'Piliers · vue globale', section: 4, step: 'PIL',
      target: { kind: 'group', ids: ['pillars-agents-center', 'pillars-profiles-center', 'pillars-principles-center', 'pr5'] } },
    { name: 'Les 20 agents', section: 4, step: '4.1',
      target: { kind: 'cluster', selectors: ['[data-bloc="pillars-agents-center"]', '.agent-cloud'] } },
    { name: 'Les 5 profils', section: 4, step: '4.2',
      target: { kind: 'group', ids: ['pillars-profiles-center', 'prof-po', 'prof-da', 'prof-vd', 'prof-fp', 'prof-tl'] } },
    { name: 'Les 5 invariants', section: 4, step: '4.3',
      target: { kind: 'group', ids: ['pillars-principles-center', 'pr1', 'pr2', 'pr3', 'pr4', 'pr5'] } },

    // Section 5 — Pitch
    { name: 'Pitch', section: 5, step: 'PIT',
      target: { kind: 'zone', id: 'pitch' } },

    // Section 6 — Conclusion (la boucle)
    { name: 'Fais tourner la boucle', section: 6, step: 'FIN',
      target: { kind: 'zone', id: 'end' } },
  ];
  let currentAct = 0;
  let lastFocusedAct = 0;

  /* ════════════════ TRANSFORM HELPERS ════════════════ */
  function applyTransform() {
    const t = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    canvas.style.transform = t;
    arrows.style.transform = t;
    updateMinimap();
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

  /* Resolves a station target to a bounding rectangle in canvas coords */
  function resolveTargetRect(target) {
    if (target.kind === 'bloc') {
      const el = canvas.querySelector(`[data-bloc="${target.id}"]`);
      return el ? getCanvasRect(el) : null;
    }
    if (target.kind === 'zone') {
      const el = canvas.querySelector(`[data-zone="${target.id}"]`);
      return el ? getCanvasRect(el) : null;
    }
    if (target.kind === 'group') {
      const els = target.ids.map(id =>
        canvas.querySelector(`[data-bloc="${id}"]`) || canvas.querySelector(`[data-zone="${id}"]`));
      return unionRects(els);
    }
    if (target.kind === 'cluster') {
      const els = target.selectors.flatMap(sel => Array.from(canvas.querySelectorAll(sel)));
      return unionRects(els);
    }
    return null;
  }

  /* Frame a rectangle into the viewport, with padding */
  function frameRect(r, animated = true, padding = 100, maxScale = 1.4) {
    if (!r) return;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const scale = Math.min((sw - padding * 2) / r.w, (sh - padding * 2) / r.h, maxScale);
    const x = (sw - r.w * scale) / 2 - r.x * scale;
    const y = (sh - r.h * scale) / 2 - r.y * scale;
    animateTo({ x, y, scale: Math.max(scale, MIN_SCALE) }, animated ? 700 : 0);
  }

  /* Navigate to act idx */
  function focusAct(idx, animated = true) {
    const act = ACTS[idx];
    if (!act) return;
    const r = resolveTargetRect(act.target);
    if (!r) return;
    // Vue globale → padding plus généreux et scale max plus permissif
    const isOverview = act.step === 'P1' || act.step === 'P2' || act.step === 'PIL';
    // Override par station possible via act.pad (zoom serré sur scènes clés)
    const padding = (typeof act.pad === 'number') ? act.pad : (isOverview ? 80 : 120);
    const maxScale = isOverview ? 0.9 : 1.4;
    frameRect(r, animated, padding, maxScale);
    setCurrentAct(idx);
    updateStoryboardReveals(act.step);
  }

  /* ════════════════ STORYBOARD REVEALS (Partie 2)
     Coreographie progressive (chaine narrative T16/T17) :
       2.1   → rien (focus Browser 2 propre)
       2.2   → rien (focus Browser 2 propre, pas d'annotation encore)
       2.3   → annotations PO sur Browser 2 (prod-app-live)
       2.4   → + cards "To Do" (colonne 1)
       2.5   → + hero card transit-passage-review → arrive en Review
       2.6   → + sticky "OK je review ça" (T16) + flèche montée Kanban→cluster review (T16)
       2.6a  → caméra remonte sur cluster review (prod-review-arrive, prod-github-branch,
               prod-preview, prod-verifs, prod-techlead) — détails review
       2.7   → caméra redescend Kanban + transit-done (carte → colonne Fait) + bouton
               ENVOYER + visuels GitHub flow (T17)
     Tout autre step (ou retour avant 2.3) → tout reset.
     ════════════════ */
  function setReveal(selector, revealed, revealedClass) {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.toggle(revealedClass, revealed);
    });
  }
  function updateStoryboardReveals(step) {
    // Sets d'appartenance par seuil (plus lisible que niveaux numeriques)
    const annotSteps    = ['2.3', '2.4', '2.5', '2.6', '2.6a', '2.7'];
    const todoSteps     = ['2.4', '2.5', '2.6', '2.6a', '2.7'];
    const doingSteps    = ['2.5', '2.6', '2.6a', '2.7'];
    const reviewSteps   = ['2.6', '2.6a', '2.7'];
    const doneSteps     = ['2.7'];
    const changeSteps   = ['2.6', '2.6a', '2.7'];
    const sendSteps     = ['2.7'];
    const githubSteps   = ['2.7'];
    // T16/T17 — Chaine narrative review
    const reviewStickSteps = ['2.6', '2.6a']; // sticky "OK je review ça"
    const reviewArrowUpSteps = ['2.6', '2.6a']; // flèche montée Kanban → cluster review
    const transitDoneSteps = ['2.7']; // hero card translate vers colonne Fait

    // FX-BAZAR : pensées qui fusent autour du PO — uniquement à 2.2
    // (le PO vient d'arriver devant son écran, ça part dans tous les sens)
    setReveal(
      '.po-bazar-hidden',
      step === '2.2',
      'po-bazar-revealed'
    );

    // Browser 2 annotations PO (apparaissent a 2.3)
    setReveal(
      '.app-live-annotated .app-annot-hidden',
      annotSteps.includes(step),
      'app-annot-revealed'
    );
    // Step 2.4+ : les annotations "tombent" vers le bas pour donner
    // l'impression qu'elles deviennent les cards Kanban en dessous.
    setReveal(
      '.app-live-annotated .app-annot-hidden',
      todoSteps.includes(step),
      'app-annot-falling'
    );

    // Kanban : reveal par colonne (3 cols)
    // nth-child(1) = À faire, 2 = En cours, 3 = Fait
    // (la phase Review est portée visuellement par le kcard-hero en transit-review
    //  qui glisse jusqu'en colonne 3 avec halo carmillon "tu reviews ÇA")
    setReveal(
      '.kanban-annotated .kanban-real-col:nth-child(1) .kcard-hidden',
      todoSteps.includes(step),
      'kcard-revealed'
    );
    setReveal(
      '.kanban-annotated .kanban-real-col:nth-child(2) .kcard-hidden',
      doingSteps.includes(step),
      'kcard-revealed'
    );
    setReveal(
      '.kanban-annotated .kanban-real-col:nth-child(3) .kcard-hidden',
      doneSteps.includes(step),
      'kcard-revealed'
    );

    // Browser 2 "ce qui a change" : halo visible a 2.6 et 2.7
    setReveal(
      '.app-live-annotated .app-change-hidden',
      changeSteps.includes(step),
      'app-change-revealed'
    );

    // FX7 — Sticky "Je valide" (2.6) → "Je vois validé" (2.7)
    // Cycle : avant 2.6 caché, 2.6 le bouton apparaît, 2.7 swap état validé.
    setReveal(
      '.app-live-annotated .app-validate-hidden',
      changeSteps.includes(step),
      'app-validate-revealed'
    );
    setReveal(
      '.app-live-annotated .app-validate-overlay',
      step === '2.7',
      'app-validate-done'
    );

    // FX6 (legacy) : fleche ascendante Kanban (Review) → Browser 2 (app).
    // DÉPRÉCIÉE : remplacée par .kanban-to-review-up (T16) qui pointe vers le
    // cluster review (en haut-droite). On garde caché tant que pas nécessaire.
    setReveal(
      '.kanban-up-hidden',
      false,
      'kanban-up-revealed'
    );

    // T16 — Sticky "OK je review ça" : apparait à 2.6 / 2.6a (le humain prend
    // la PR en main avant qu'elle parte en GitHub). Ancré sur le Kanban,
    // au-dessus de la colonne Review (hero card transit-review).
    setReveal(
      '.review-stick-hidden',
      reviewStickSteps.includes(step),
      'review-stick-revealed'
    );

    // T16 — Flèche verticale Kanban (y≈960) → cluster review (y≈540).
    // Se trace de bas en haut (stroke-dashoffset). Apparait à 2.6 / 2.6a.
    setReveal(
      '.kanban-to-review-up-hidden',
      reviewArrowUpSteps.includes(step),
      'kanban-to-review-up-revealed'
    );

    // FX8 : trait latéral droit + sticky vert "OK · review arrive".
    // Apparait a 2.7 (apres "Je vois validé ✓") : la PR part en review.
    setReveal(
      '.node-review-arrive-hidden',
      step === '2.7',
      'node-review-arrive-revealed'
    );
    setReveal(
      '.review-arrive-hidden',
      step === '2.7',
      'review-arrive-revealed'
    );

    // ── Hero card transit : UNE carte (#kcard-cta) glisse To-Do → Review → Fait
    // 2.4    : visible dans To-Do (etat de base, aucun modifier)
    // 2.5    : transit-passage-review (passage explicite To-Do → Review, keyframe
    //          long 1400ms + ghost trail — voir styles.css)
    // 2.6/2.6a : transit-review → la carte est arrivée en Review (halo focus)
    // 2.7    : transit-done → la carte glisse Review → Fait (colonne 3) — T17
    // Toute autre step → on retire tout, la carte reste en To-Do.
    const hero = document.getElementById('kcard-cta');
    if (hero) {
      const inDoing      = false; // legacy 2.5 doing → réécrit en passage
      // En review tant qu'on est à 2.5/2.6/2.6a (la carte est dans la colonne Review).
      // À 2.7 la carte passe en Fait → on RETIRE transit-review pour laisser
      // transit-done gagner avec sa translation finale vers colonne 3.
      const inReview     = (step === '2.5' || step === '2.6' || step === '2.6a');
      const inPassage    = (step === '2.5'); // déclenche la classe d'anim longue
      // Focus "tu reviews ÇA" : à 2.5/2.6/2.6a uniquement, pas à 2.7 (carte part en Fait)
      const inReviewFocus = (step === '2.5' || step === '2.6' || step === '2.6a');
      // T17 — Passage Review → Fait à 2.7
      const inDone        = transitDoneSteps.includes(step);
      hero.classList.toggle('transit-doing',          inDoing);
      hero.classList.toggle('transit-review',         inReview);
      hero.classList.toggle('transit-passage-review', inPassage);
      hero.classList.toggle('in-review-focus',        inReviewFocus);
      hero.classList.toggle('transit-done',           inDone);
    }

    // ── 2.7 : bouton ENVOYER + flow GitHub
    // TODO(N3/N4) : implementer les styles .send-button-revealed et .github-flow-active
    // - .send-button-revealed : reveal du CTA "ENVOYER" (PR vers GitHub)
    // - .github-flow-active   : activation des visuels GitHub (commit/push/PR/merge anim)
    setReveal(
      '.send-button-hidden',
      sendSteps.includes(step),
      'send-button-revealed'
    );
    setReveal(
      '.github-flow-hidden',
      githubSteps.includes(step),
      'github-flow-active'
    );

    // ── 2.7 : tech lead validation finale (checklist + décision push main)
    // Révèle la mini-checklist (stagger items) + le chip décision carmillon
    // dans le bloc prod-techlead lorsque l'utilisateur arrive à 2.7.
    // FX11 : le sélecteur .techlead-decision-hidden cible AUSSI le nouveau
    // bloc .node-techlead-decision (prod-techlead-final, x=7780 y=560) qui
    // expose les 2 options "retour à dev" / "push main ✓" côte à côte
    // avec un pulse alterné. Une seule classe → reveal cohérent.
    const techleadSteps = ['2.7'];
    setReveal(
      '.techlead-checklist-hidden',
      techleadSteps.includes(step),
      'techlead-checklist-revealed'
    );
    setReveal(
      '.techlead-decision-hidden',
      techleadSteps.includes(step),
      'techlead-decision-revealed'
    );

    // ── 2.7 : 3 agents check (Design / Règles / Stabilité) — halo + badge
    // Révèle les badges "checking… → ✓ OK" staggered (0ms / 600ms / 1200ms)
    setReveal(
      '.agent-check-hidden',
      step === '2.7',
      'agent-check-revealed'
    );

    // ── 2.7 : FX10 — Cluster 5 vérifications IA séquentielles (sous tech lead)
    // Révèle le cluster verifs (5 mini-étapes : design / code / maquette /
    // impact / test) avec animation séquentielle stagger 600ms.
    // Chaque verif-step passe par queued → checking… → ✓ done.
    setReveal(
      '.verifs-hidden',
      step === '2.7',
      'verifs-revealed'
    );

    // ── 2.7 : FX9 — Branche GitHub faite + Preview live (post-OK review)
    // Révèle les 2 mini-blocs (x=7000/7250 y=560) sous prod-review avec stagger
    // 200ms (Branche → Preview) + trait griffonné horizontal qui les relie.
    // Pattern : "review OK → branche poussée → preview live pour la review".
    setReveal(
      '.node-github-branch-hidden',
      step === '2.7',
      'node-github-branch-revealed'
    );
    setReveal(
      '.node-preview-hidden',
      step === '2.7',
      'node-preview-revealed'
    );
    setReveal(
      '.fx9-trait-hidden',
      step === '2.7',
      'fx9-trait-revealed'
    );

    // ── 2.7 : FX12 — Trail d'approbation Tech Lead → Merge main
    // Trait griffonné carmillon → mint qui jaillit du chip "push main ✓"
    // (bloc prod-techlead-final) et monte en arc dans le bas de
    // prod-merge-main. Matérialise "validation crée un chemin vers la
    // DROITE" (push prod / merge main). Label hand "validé !" en cours.
    setReveal(
      '.fx12-approve-hidden',
      step === '2.7',
      'fx12-approve-revealed'
    );

    // ── T20 : Chaîne finale push prod → live (3 flèches cascade)
    // Révèle la chaîne techlead-final → push → merge → live au step 2.7.
    // Cascade stagger 240ms entre F1/F2/F3 gérée en CSS.
    setReveal(
      '.final-chain-hidden',
      step === '2.7',
      'final-chain-revealed'
    );

    // ── T20 : Badge "v1.1 live" sur Browser 2 (prod-app-live) au step 2.7.
    // Apparaît après l'arrivée de la pointe F3 (≈ 2.1s delay côté CSS).
    setReveal(
      '.live-ping-hidden',
      step === '2.7',
      'live-ping-revealed'
    );

    // ── T21 : Conclusion "2 profils uniquement font vivre l'app"
    // Reveal à l'arrivée à 2.7 ET conservation sur les steps suivants (PIT, FIN).
    // Ferme la narration de la Partie 2 avant le pitch.
    const conclusionSteps = ['2.7', 'PIT', 'FIN'];
    setReveal(
      '.final-claim-hidden',
      conclusionSteps.includes(step),
      'final-claim-revealed'
    );

    // ── Hint "↓ clique suivant" — visible sur les transitions 2.2 → 2.6
    if (storyHint && storyHintText) {
      const hintText = STORY_HINTS[step];
      if (hintText) {
        storyHintText.textContent = hintText;
        storyHint.classList.add('is-visible');
      } else {
        storyHint.classList.remove('is-visible');
      }
    }
  }

  function focusOnBloc(el, animated = true, padding = 200) {
    const r = getCanvasRect(el);
    frameRect(r, animated, padding, 1.4);
  }

  function fitWorld(animated = true) {
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const padding = 60;
    const scale = Math.min((sw - padding * 2) / WORLD_W, (sh - padding * 2) / WORLD_H);
    const x = (sw - WORLD_W * scale) / 2;
    const y = (sh - WORLD_H * scale) / 2;
    animateTo({ x, y, scale }, animated ? 800 : 0);
    setCurrentAct(-1);
  }

  /* ════════════════ CHRONO UI ════════════════ */
  // T22 — pulse de la chrono-nav : feedback visuel "tu es passé à X"
  let chronoPulseTimer = null;
  function pulseChrono() {
    if (!chronoNav) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    chronoNav.classList.remove('is-pulsing');
    // force reflow pour relancer l'animation si déclenchée 2x rapidement
    void chronoNav.offsetWidth;
    chronoNav.classList.add('is-pulsing');
    if (chronoPulseTimer) clearTimeout(chronoPulseTimer);
    chronoPulseTimer = setTimeout(() => chronoNav.classList.remove('is-pulsing'), 720);
  }

  // T22 — fade-curtain à l'arrivée sur FIN (step === 'FIN')
  let stageCurtain = null;
  let curtainTimer = null;
  function ensureCurtain() {
    if (stageCurtain) return stageCurtain;
    stageCurtain = document.createElement('div');
    stageCurtain.className = 'stage-curtain';
    stageCurtain.setAttribute('aria-hidden', 'true');
    const cap = document.createElement('span');
    cap.className = 'stage-curtain__caption hand';
    cap.textContent = 'fin de l’histoire — et début de la suivante.';
    stageCurtain.appendChild(cap);
    document.body.appendChild(stageCurtain);
    return stageCurtain;
  }
  function playEndCurtain() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = ensureCurtain();
    if (curtainTimer) clearTimeout(curtainTimer);
    c.classList.remove('is-fading-out');
    c.classList.add('is-fading-in');
    curtainTimer = setTimeout(() => {
      c.classList.remove('is-fading-in');
      c.classList.add('is-fading-out');
    }, 620);
  }

  function setCurrentAct(idx) {
    const prevIdx = currentAct;
    currentAct = idx;
    if (idx >= 0) lastFocusedAct = idx;
    if (idx < 0) progressFill.style.width = '0%';
    else progressFill.style.width = `${((idx + 1) / ACTS.length) * 100}%`;

    // Highlight the section label corresponding to currentAct.section
    const section = idx >= 0 ? ACTS[idx].section : -1;
    const labels = document.querySelectorAll('.progress-labels span');
    labels.forEach((s, i) => s.classList.toggle('is-current', i === section));

    if (idx >= 0 && ACTS[idx]) {
      chronoCurrent.querySelector('.chrono-step').textContent = ACTS[idx].step;
      chronoCurrent.querySelector('.chrono-name').textContent = ACTS[idx].name;
    } else {
      chronoCurrent.querySelector('.chrono-step').textContent = '—';
      chronoCurrent.querySelector('.chrono-name').textContent = "Vue d'ensemble";
    }
    chronoPrev.disabled = idx <= 0;
    chronoNext.disabled = idx >= ACTS.length - 1;

    // T22 — pulse à chaque changement de station (sauf no-op)
    if (idx >= 0 && idx !== prevIdx) pulseChrono();

    // T22 — voile fade-in/out à l'arrivée sur FIN (step "FIN")
    if (idx >= 0 && prevIdx !== idx && ACTS[idx] && ACTS[idx].step === 'FIN') {
      playEndCurtain();
    }
  }

  chronoPrev.addEventListener('click', () => {
    if (currentAct === -1) {
      // Après un dézoom : revenir à la station précédente par rapport à la dernière visitée
      if (lastFocusedAct > 0) focusAct(lastFocusedAct - 1);
      else focusAct(0);
    } else if (currentAct > 0) {
      focusAct(currentAct - 1);
    }
  });
  chronoNext.addEventListener('click', () => {
    if (currentAct === -1) {
      // Après un dézoom : avancer à partir de la dernière station visitée
      if (lastFocusedAct < ACTS.length - 1) focusAct(lastFocusedAct + 1);
    } else if (currentAct < ACTS.length - 1) {
      focusAct(currentAct + 1);
    }
  });
  /* Click on a progress label → jump to first station of that section
     The label's data-step attribute holds the target station index. */
  document.querySelectorAll('.progress-labels span').forEach(s => {
    s.addEventListener('click', () => focusAct(parseInt(s.dataset.step)));
  });

  /* ════════════════ PAN ════════════════ */
  let isDown = false, startX = 0, startY = 0, startVX = 0, startVY = 0, didDrag = false;

  stage.addEventListener('pointerdown', e => {
    isDown = true; didDrag = false;
    startX = e.clientX; startY = e.clientY;
    startVX = view.x; startVY = view.y;
    stage.classList.add('is-panning');
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!isDown) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!didDrag && Math.hypot(dx, dy) > 5) didDrag = true;
    if (didDrag) {
      view.x = startVX + dx;
      view.y = startVY + dy;
      applyTransform();
      hideHelp();
      setCurrentAct(-1);
    }
  });
  stage.addEventListener('pointerup', e => {
    isDown = false;
    stage.classList.remove('is-panning');
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
  });
  stage.addEventListener('pointercancel', () => { isDown = false; stage.classList.remove('is-panning'); });

  /* ════════════════ WHEEL ════════════════ */
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    hideHelp();
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
      const dx = e.shiftKey ? (e.deltaX || e.deltaY) : (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
      const dy = e.shiftKey ? 0 : (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? 0 : e.deltaY);
      view.x -= dx;
      view.y -= dy;
      applyTransform();
      setCurrentAct(-1);
    }
  }, { passive: false });

  /* ════════════════ BLOC LABEL ════════════════ */
  function blocLabel(el) {
    if (!el) return '—';
    const sels = ['.punch', 'h3', 'h4', 'h5', '.zone-title', '.kanban-real-title', '.pillar-tag', '.part-title'];
    for (const sel of sels) {
      const found = el.querySelector(sel);
      if (found) {
        const text = (found.textContent || '').trim().replace(/\s+/g, ' ');
        if (text) return text.length > 50 ? text.slice(0, 48) + '…' : text;
      }
    }
    return el.dataset.bloc || el.dataset.zone || '—';
  }

  /* ════════════════ CLICK REVEAL ════════════════ */
  function onBlocClick(el, e) {
    if (didDrag) return;
    e.stopPropagation();

    const linkIds = (el.dataset.links || '').split(',').map(s => s.trim()).filter(Boolean);
    const wasActive = el.classList.contains('is-active');
    clearActive();
    if (wasActive) return;

    canvas.classList.add('has-active');
    el.classList.add('is-active');

    const targetEls = [];
    linkIds.forEach(id => {
      const t = canvas.querySelector(`[data-bloc="${id}"]`) || canvas.querySelector(`[data-zone="${id}"]`);
      if (!t) return;
      if (t.dataset.bloc) {
        t.classList.add('is-related');
        targetEls.push(t);
      } else {
        t.querySelectorAll('[data-bloc]').forEach(b => b.classList.add('is-related'));
        targetEls.push(t);
      }
      highlightArrowBetween(el, t);
    });

    revealName.textContent = blocLabel(el);
    revealTargets.textContent = targetEls.length
      ? targetEls.map(blocLabel).join(' · ')
      : "ce bloc n'a pas de lien sortant";
    revealBanner.classList.add('is-visible');

    focusOnBloc(el);
    setCurrentAct(-1);
  }

  function clearActive() {
    canvas.classList.remove('has-active');
    canvas.querySelectorAll('.is-active, .is-related').forEach(el => el.classList.remove('is-active', 'is-related'));
    arrowsG.querySelectorAll('.arrow-active').forEach(g => g.classList.remove('arrow-active'));
    revealBanner.classList.remove('is-visible');
  }

  revealClose.addEventListener('click', () => clearActive());

  stage.addEventListener('click', e => {
    if (didDrag) return;
    if (!e.target.closest('[data-bloc]')) clearActive();
  });
  canvas.addEventListener('click', e => {
    const bloc = e.target.closest('[data-bloc]');
    if (bloc) onBlocClick(bloc, e);
  });

  /* ════════════════ BING-BONG CROSS-CANVAS ════════════════
     Hover sur un node humain → pulse le pillar IA (20 agents).
     Event delegation + cooldown pour éviter de spammer l'animation. */
  const aiPillar = canvas.querySelector('.pillar-center[data-bloc="pillars-agents-center"]');
  let aiPulseCooldown = false;
  if (aiPillar) {
    canvas.addEventListener('mouseover', e => {
      const human = e.target.closest('.node[data-actor="human"]');
      if (!human || aiPulseCooldown) return;
      aiPulseCooldown = true;
      aiPillar.classList.remove('ai-listening');
      void aiPillar.offsetWidth; // reflow pour rejouer l'anim
      aiPillar.classList.add('ai-listening');
      setTimeout(() => aiPillar.classList.remove('ai-listening'), 1500);
      setTimeout(() => { aiPulseCooldown = false; }, 1600);
    });
  }

  /* ════════════════ W2 — PILIERS : EXPLODE + CLICK → ACTS ════════════════
     Hover sur un pillar-center → on "explose" le cluster voisin (même bande
     horizontale). Click sur un pillar-center (data-pillar-act) → focusAct(step).
     Logique stagger 80ms portée par le CSS via .is-exploding. */
  const pillarClusterMap = {
    'pillars-agents-center':     canvas.querySelector('.agent-cloud'),
    'pillars-profiles-center':   canvas.querySelector('.profile-cluster'),
    'pillars-principles-center': canvas.querySelector('.principle-cluster'),
  };

  canvas.querySelectorAll('.pillar-center[data-pillar-act]').forEach(pillar => {
    const cluster = pillarClusterMap[pillar.dataset.bloc];
    if (!cluster) return;

    pillar.addEventListener('mouseenter', () => {
      cluster.classList.add('is-exploding');
    });
    pillar.addEventListener('mouseleave', () => {
      cluster.classList.remove('is-exploding');
    });
    // Symétrique : hover du cluster aussi → explode (pour que le hover sur un
    // sous-node ne coupe pas l'effet d'ensemble).
    cluster.addEventListener('mouseenter', () => {
      cluster.classList.add('is-exploding');
    });
    cluster.addEventListener('mouseleave', () => {
      cluster.classList.remove('is-exploding');
    });
  });

  // Click → focus l'ACTS correspondante (4.1, 4.2, 4.3). On capture en phase
  // capture pour passer DEVANT onBlocClick qui déclenche le reveal banner
  // (le click sur le pillar doit zoomer, pas afficher la flèche reveal).
  canvas.addEventListener('click', e => {
    const pillar = e.target.closest('.pillar-center[data-pillar-act]');
    if (!pillar || didDrag) return;
    const step = pillar.dataset.pillarAct; // "4.1" | "4.2" | "4.3"
    const idx = ACTS.findIndex(a => a.step === step);
    if (idx < 0) return;
    e.stopPropagation();
    e.preventDefault();
    clearActive();
    pillar.classList.add('pillar-focused');
    setTimeout(() => pillar.classList.remove('pillar-focused'), 700);
    focusAct(idx);
  }, true); // capture = true → court-circuite le canvas click bubble

  // Clavier : Enter/Space sur un pillar-center → même comportement
  canvas.querySelectorAll('.pillar-center[data-pillar-act]').forEach(pillar => {
    pillar.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const step = pillar.dataset.pillarAct;
      const idx = ACTS.findIndex(a => a.step === step);
      if (idx < 0) return;
      pillar.classList.add('pillar-focused');
      setTimeout(() => pillar.classList.remove('pillar-focused'), 700);
      focusAct(idx);
    });
  });

  /* ════════════════ ARROW PAIRS ════════════════
     [from, to, label, isCross]
     isCross = true → flèche pointillée subtile (relations transverses) */
  const ARROW_PAIRS = [
    // Postulat → Partie 1
    ['p1', 'part1-header', 'remplace', true],
    ['p2', 'pillars-principles-center', '', true],
    ['p3', 'pillars-agents-center', '', true],
    ['p4', 'pillars-profiles-center', '', true],

    // PARTIE 1 — chaîne principale gérée par les petites flèches manuscrites HTML
    // (zone canvas .phase-arrow). Seuls les liens cross subsistent ici.
    // Exception : 1.3 Specs détaillées → 1.5 Pré-dev (flux logique : le pré-dev
    // se base sur les specs détaillées, pas sur la spec courte 1.2).
    ['f-spec-detail', 'f-predev', '', false],
    ['f-live', 'prod-tool', 'partie 2 →', true],

    // (Les agents IA ne sont plus des nodes séparés — ils figurent en footer
    // de chaque bloc-lego concerné, mode "qui agit ici" plutôt qu'une bande)

    // PARTIE 2 — Phases
    ['prod-tool', 'prod-po', '', false],
    ['prod-po', 'prod-kanban', '', false],
    ['prod-kanban', 'prod-demande', '', false],
    ['prod-demande', 'prod-branche', '', false],
    ['prod-branche', 'prod-agent-design', '', false],
    ['prod-branche', 'prod-agent-rules', '', false],
    ['prod-branche', 'prod-agent-stab', '', false],
    ['prod-agent-design', 'prod-review', '', false],
    ['prod-agent-rules', 'prod-review', '', false],
    ['prod-agent-stab', 'prod-review', '', false],
    ['prod-review', 'prod-techlead', '', false],
    ['prod-techlead', 'prod-push', '', false],
    // ['prod-push', 'prod-tool', 'recommence ↺', false], // SUPPRIMÉ Wave 1 :
    //   le générateur drawArrow tirait un Bézier ~horizontal entre les centres
    //   (canvas 8175,320 → 5795,320), coupant prod-techlead, prod-review,
    //   prod-branche, prod-demande, prod-po et la bannière Partie 2.
    //   Le retour ↺ est déjà matérialisé par .loop-back-arrow (SVG dédié qui
    //   plonge sous y≈1500 puis remonte) + .loop-title-sticky (étiquette).
    ['prod-bonus', 'prod-tool', '', true],
    ['prod-logs', 'prod-branche', '', true],

    // Piliers → leurs sous-nodes
    ['pillars-profiles-center', 'prof-po', '', true],
    ['pillars-profiles-center', 'prof-da', '', true],
    ['pillars-profiles-center', 'prof-vd', '', true],
    ['pillars-profiles-center', 'prof-fp', '', true],
    ['pillars-profiles-center', 'prof-tl', '', true],
    ['pillars-principles-center', 'pr1', '', true],
    ['pillars-principles-center', 'pr2', '', true],
    ['pillars-principles-center', 'pr3', '', true],
    ['pillars-principles-center', 'pr4', '', true],
    ['pillars-principles-center', 'pr5', '', true],

    // Profils → flots (où ils interviennent)
    ['prof-po', 'prod-po', '', true],
    ['prof-da', 'f-design-artist', '', true],
    ['prof-vd', 'f-vibe', '', true],
    ['prof-fp', 'f-handoff', '', true],
    ['prof-tl', 'prod-techlead', '', true],

    // Principes → flots (où ils gouvernent)
    ['pr1', 'f-branches', '', true],
    ['pr2', 'prod-branche', '', true],
    ['pr3', 'f-components', '', true],
    ['pr4', 'f-converge', '', true],
    ['pr5', 'prod-bonus', '', true],
  ];

  function drawArrow(fromEl, toEl, label = '', isCross = false) {
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
    const wobble = Math.min(50, 14 + dist * 0.04);
    // déterministe mais varié : signe basé sur somme x+y des centres
    const sign = ((Math.round(acx + bcx) + Math.round(acy + bcy)) % 2 === 0) ? 1 : -1;
    const cx = mx + px * wobble * sign;
    const cy = my + py * wobble * sign;

    const d = `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;

    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', `arrow-draw ${isCross ? 'arrow-cross' : 'arrow-main'}`);
    g.dataset.from = fromEl.dataset.bloc || fromEl.dataset.zone || '';
    g.dataset.to = toEl.dataset.bloc || toEl.dataset.zone || '';

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
      // rotation déterministe basée sur position
      const rot = ((Math.round(cx + cy) % 7) - 3);
      text.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
      text.textContent = label;
      g.appendChild(text);
    }

    g.style.setProperty('--len', Math.round(dist + 80));
    arrowsG.appendChild(g);
  }

  function highlightArrowBetween(fromEl, toEl) {
    const f = fromEl.dataset.bloc || fromEl.dataset.zone;
    const t = toEl.dataset.bloc || toEl.dataset.zone;
    arrowsG.querySelectorAll('g').forEach(g => {
      if ((g.dataset.from === f && g.dataset.to === t) || (g.dataset.from === t && g.dataset.to === f)) {
        g.classList.add('arrow-active');
      }
    });
  }

  function buildArrows() {
    arrowsG.innerHTML = '';
    ARROW_PAIRS.forEach(([from, to, label, isCross]) => {
      const f = canvas.querySelector(`[data-bloc="${from}"]`) || canvas.querySelector(`[data-zone="${from}"]`);
      const t = canvas.querySelector(`[data-bloc="${to}"]`) || canvas.querySelector(`[data-zone="${to}"]`);
      if (f && t) drawArrow(f, t, label, isCross);
    });
  }

  /* ════════════════ CONTROLS ════════════════ */
  document.querySelectorAll('.ctrl').forEach(b => {
    b.addEventListener('click', () => {
      const action = b.dataset.action;
      if (action === 'reset') { clearActive(); return fitWorld(); }
      const factor = action === 'zoom-in' ? 1.3 : 0.77;
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const px = sw / 2, py = sh / 2;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor));
      const wx = (px - view.x) / view.scale;
      const wy = (py - view.y) / view.scale;
      animateTo({
        scale: newScale,
        x: px - wx * newScale,
        y: py - wy * newScale,
      }, 350);
    });
  });

  function updateMinimap() {
    if (!minimapFrame) return;
    const sw = stage.clientWidth;
    const mw = minimapFrame.parentElement.clientWidth;
    const wx = -view.x / view.scale;
    const ww = sw / view.scale;
    const fx = Math.max(0, (wx / WORLD_W) * mw);
    const fw = Math.min(mw - fx, (ww / WORLD_W) * mw);
    minimapFrame.style.left = `${fx}px`;
    minimapFrame.style.width = `${Math.max(20, fw)}px`;
  }

  let helpHidden = false;
  function hideHelp() {
    if (helpHidden || !help) return;
    helpHidden = true;
    setTimeout(() => help.classList.add('is-hidden'), 200);
  }
  setTimeout(hideHelp, 8000);

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') { clearActive(); fitWorld(); }
    if (e.key === 'ArrowRight') chronoNext.click();
    if (e.key === 'ArrowLeft') chronoPrev.click();
    if (e.key === 'Home' || e.key === '0') focusAct(0);
    if (e.key === 'End') focusAct(ACTS.length - 1);
    if (e.key === '+' || e.key === '=') document.querySelector('[data-action="zoom-in"]').click();
    if (e.key === '-') document.querySelector('[data-action="zoom-out"]').click();
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentAct >= 0) focusAct(currentAct, false);
      else updateMinimap();
    }, 200);
  });

  /* ════════════════ INIT ════════════════ */
  function init() {
    fitWorld(false);
    requestAnimationFrame(() => {
      buildArrows();
      setTimeout(() => focusAct(0), 400);
    });
    initWfDeviceToggle();
    initIntroSecret();
    initStickyMicroInfo();
    initBriefPersonaBubble();
    initCartBump();
  }

  /* 2.2 Browser 2 FOULÉE · click sur le panier (top-right) déclenche un
     mini "+1" flottant + bump sur le compteur. 3 articles déjà visibles. */
  function initCartBump() {
    const carts = document.querySelectorAll('.app-cart');
    if (!carts.length) return;
    carts.forEach(cart => {
      const plus = cart.querySelector('.app-cart-plus');
      const trigger = (e) => {
        if (e) e.stopPropagation();
        if (cart.classList.contains('is-bump')) return;
        cart.classList.add('is-bump');
        const clean = () => cart.classList.remove('is-bump');
        if (plus) {
          plus.addEventListener('animationend', clean, { once: true });
        } else {
          setTimeout(clean, 950);
        }
      };
      cart.addEventListener('click', trigger);
      cart.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          trigger(e);
        }
      });
    });
  }

  /* 1.1 BRIEF · hover sur une persona → affiche une bulle "j'apporte X"
     positionnée au-dessus de l'icône, texte personnalisé par profil. */
  function initBriefPersonaBubble() {
    const table = document.querySelector('.brief-table');
    const bubble = table && table.querySelector('.person-bubble');
    if (!table || !bubble) return;

    // Custom snippet par persona : ce qu'elle apporte au brief
    const CONTRIB = {
      'p-po':         "j'apporte le besoin",
      'p-pm':         "j'apporte le scope",
      'p-ux':         "j'apporte les parcours",
      'p-ui':         "j'apporte le visuel",
      'p-innov':      "j'apporte l'idée folle",
      'p-tech':       "j'apporte la faisabilité",
      'p-direction':  "j'apporte la vision",
      'p-marketing':  "j'apporte la promesse",
      'p-crm':        "j'apporte la voix client",
    };

    table.querySelectorAll('.person').forEach(person => {
      person.addEventListener('mouseenter', () => {
        // Trouver la classe p-* pour identifier le profil
        const key = Array.from(person.classList).find(c => c.startsWith('p-'));
        if (!key || !CONTRIB[key]) return;
        bubble.textContent = CONTRIB[key];
        // Position : centre horizontal + top de l'emoji
        const tableRect = table.getBoundingClientRect();
        const emoji = person.querySelector('.person-emoji');
        const er = (emoji || person).getBoundingClientRect();
        const cx = er.left + er.width / 2 - tableRect.left;
        const cy = er.top - tableRect.top;
        bubble.style.setProperty('--bx', cx + 'px');
        bubble.style.setProperty('--by', cy + 'px');
        bubble.classList.add('is-visible');
      });
      person.addEventListener('mouseleave', () => {
        bubble.classList.remove('is-visible');
      });
    });
  }

  /* INTRO · clic sur le bouton "v.1 · 2026" → révèle un credo manuscrit */
  function initIntroSecret() {
    const btn = document.querySelector('.intro-secret');
    if (!btn) return;
    btn.addEventListener('mousedown', e => e.stopPropagation());
    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const open = btn.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* POSTULAT · injecte une mini-annotation manuscrite par sticky (révélée au hover via CSS) */
  function initStickyMicroInfo() {
    document.querySelectorAll('.sticky[data-mini]').forEach(s => {
      if (s.querySelector('.sticky-mini')) return;
      const span = document.createElement('span');
      span.className = 'sticky-mini hand';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = s.dataset.mini || '';
      s.appendChild(span);
    });
  }

  function initWfDeviceToggle() {
    const body = document.querySelector('.wf-body-tree');
    const btns = document.querySelectorAll('.wf-device-toggle .wf-device-btn');
    const toggle = document.querySelector('.wf-device-toggle');
    if (!body || !btns.length) return;
    if (toggle) {
      // Bloque le pan/zoom du canvas qui capture le pointer au stage level
      toggle.addEventListener('pointerdown', e => e.stopPropagation());
      toggle.addEventListener('mousedown', e => e.stopPropagation());
      toggle.addEventListener('click', e => e.stopPropagation());
    }
    btns.forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        const dev = btn.dataset.device;
        if (!dev || body.dataset.device === dev) return;
        body.dataset.device = dev;
        btns.forEach(b => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-checked', active ? 'true' : 'false');
        });
        // Marque le toggle comme utilisé → estompe le hint hand-written
        if (toggle) toggle.classList.add('is-used');
        // Pulse les vignettes : retire la classe pour pouvoir la rejouer
        body.classList.remove('is-switching');
        // force reflow pour relancer l'animation CSS
        void body.offsetWidth;
        body.classList.add('is-switching');
        window.setTimeout(() => body.classList.remove('is-switching'), 700);
      });
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init);
  } else {
    window.addEventListener('load', init);
  }
})();
