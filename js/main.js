/* Mist Tech — interactions & motion */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  /* ---------- Intro: wait for the hero image, then play the load sequence ---------- */
  const heroImg = document.querySelector('.hero__img');
  const start = () => requestAnimationFrame(() => root.classList.add('is-loaded'));
  if (!heroImg || heroImg.complete) start();
  else {
    heroImg.addEventListener('load', start, { once: true });
    heroImg.addEventListener('error', start, { once: true });
    setTimeout(start, 1500);
  }

  /* ---------- Word-by-word reveal (Overview card) ---------- */
  document.querySelectorAll('[data-reveal-words]').forEach((el) => {
    el.querySelectorAll(':scope > span').forEach((line) => {
      const words = line.textContent.trim().split(/\s+/);
      line.textContent = '';
      words.forEach((word, i) => {
        const w = document.createElement('span');
        w.className = 'w';
        w.textContent = word;
        line.append(w, i < words.length - 1 ? ' ' : '');
      });
    });
  });

  /* ---------- Scroll reveals ---------- */
  const revealTargets = document.querySelectorAll('[data-reveal], [data-reveal-line], [data-reveal-gallery]');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-in');
      revealObserver.unobserve(el);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
  revealTargets.forEach((el) => revealObserver.observe(el));

  /* ---------- Stats counter (+12k) ---------- */
  const counter = document.querySelector('[data-count-to]');
  if (counter && !reduceMotion) {
    const target = Number(counter.dataset.countTo);
    counter.textContent = '+0';
    const run = () => {
      const t0 = performance.now();
      const dur = 1800;
      const tick = (now) => {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        counter.textContent = '+' + Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    setTimeout(run, 900);
  }

  /* ---------- Nav Bar: active dot follows hover / current section ---------- */
  const nav = document.querySelector('[data-nav]');
  const links = nav ? [...nav.querySelectorAll('.nav__link')] : [];
  const moveDot = (link) => {
    if (!link) return;
    const x = link.offsetLeft + link.offsetWidth / 2 - 3;
    nav.style.setProperty('--dot-x', x + 'px');
  };
  const activeLink = () => links.find((l) => l.classList.contains('is-active'));
  const setActive = (id) => {
    if (!links.some((l) => l.dataset.target === id)) return; // sections without a nav link keep the current one
    links.forEach((l) => l.classList.toggle('is-active', l.dataset.target === id));
    moveDot(activeLink());
  };
  links.forEach((link) => {
    link.addEventListener('mouseenter', () => moveDot(link));
    link.addEventListener('focus', () => moveDot(link));
  });
  nav?.addEventListener('mouseleave', () => moveDot(activeLink()));
  document.fonts?.ready.then(() => moveDot(activeLink()));
  window.addEventListener('resize', () => moveDot(activeLink()));

  // Scroll-spy: the section crossing the upper third of the viewport wins
  const spyTargets = [...document.querySelectorAll('[data-section]')];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  }, { rootMargin: '-35% 0px -60% 0px' });
  spyTargets.forEach((s) => spy.observe(s));

  /* ---------- Header: glass after the hero top, hide on scroll down ---------- */
  const header = document.querySelector('[data-header]');
  let lastY = window.scrollY;

  /* ---------- Parallax ---------- */
  const heroMedia = document.querySelector('.hero__media');
  const parallaxEls = [...document.querySelectorAll('.pipeline__media > img[data-parallax]')];

  /* ---------- Scroll-linked word reveal (Overview card) ----------
     Words light up one by one as the paragraph travels from 85% to 35% of the
     viewport height, and fade back if you scroll up. */
  const wordBlocks = [...document.querySelectorAll('[data-reveal-words]')]
    .map((el) => ({ el, words: [...el.querySelectorAll('.w')], scrub: el.closest('[data-scrub]') }));
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const updateWords = () => {
    if (reduceMotion) return;
    const vh = window.innerHeight;
    const start = vh * 0.85;
    const end = vh * 0.35;
    wordBlocks.forEach(({ el, words, scrub }) => {
      let progress;
      if (scrub) {
        // Pinned section (Contact): p = how far we've scrolled through it (0–1).
        // Each text lights its words over its data-words-range, its layer fades in/out over data-layer,
        // and the buttons appear past data-done.
        const r = scrub.getBoundingClientRect();
        const p = clamp01(-r.top / (r.height - vh));
        const [a, b] = (el.dataset.wordsRange || '0,0.7').split(',').map(Number);
        progress = clamp01((p - a) / (b - a));
        const layer = el.closest('[data-layer]');
        if (layer) {
          const [i0, i1, o0, o1] = layer.dataset.layer.split(',').map(Number);
          const fadeIn = clamp01((p - i0) / (i1 - i0));
          const fadeOut = clamp01((p - o0) / (o1 - o0));
          layer.style.opacity = (fadeIn * (1 - fadeOut)).toFixed(3);
          layer.style.transform = `translateY(${((1 - fadeIn) * 30 - fadeOut * 40).toFixed(1)}px)`;
          layer.style.visibility = fadeIn * (1 - fadeOut) > 0 ? 'visible' : 'hidden';
        }
        scrub.classList.toggle('is-done', p > Number(scrub.dataset.done || 0.75));
      } else {
        progress = clamp01((start - el.getBoundingClientRect().top) / (start - end));
      }
      const lit = progress * words.length;
      words.forEach((w, i) => {
        const t = Math.min(Math.max(lit - i, 0), 1); // 0..1 for this word
        w.style.opacity = (0.12 + t * 0.88).toFixed(3);
      });
    });
  };

  let ticking = false;
  const onScroll = () => {
    updateWords();
    const y = window.scrollY;
    if (header) {
      header.classList.toggle('is-scrolled', y > 40);
      const goingDown = y > lastY && y > 400;
      const menuOpen = document.body.classList.contains('menu-open');
      header.classList.toggle('is-hidden', goingDown && !menuOpen);
    }
    lastY = y;

    if (!reduceMotion) {
      if (heroMedia && y < window.innerHeight * 1.5) {
        heroMedia.style.transform = `translate3d(0, ${y * 0.25}px, 0)`;
      }
      parallaxEls.forEach((img) => {
        const rect = img.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
        img.style.transform = `translate3d(0, ${progress * 60}px, 0)`;
      });
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', updateWords);
  onScroll();

  /* ---------- Values: 4:5 image follows the cursor over each value's text ---------- */
  const float = document.querySelector('[data-hover-float]');
  const hoverTexts = [...document.querySelectorAll('[data-hover-img]')];
  if (float && hoverTexts.length && window.matchMedia('(hover: hover)').matches) {
    const floatImg = float.querySelector('img');
    hoverTexts.forEach((t) => { new Image().src = t.dataset.hoverImg; }); // preload

    let tx = 0, ty = 0, cx = 0, cy = 0, rafId = null, active = false;
    const follow = () => {
      const ease = reduceMotion ? 1 : 0.16;
      cx += (tx - cx) * ease;
      cy += (ty - cy) * ease;
      const tilt = reduceMotion ? 0 : Math.max(-10, Math.min(10, (tx - cx) * 0.08));
      float.style.setProperty('--fx', cx + 'px');
      float.style.setProperty('--fy', cy + 'px');
      float.style.setProperty('--tilt', tilt + 'deg');
      const settled = Math.abs(tx - cx) < 0.1 && Math.abs(ty - cy) < 0.1;
      rafId = active || !settled ? requestAnimationFrame(follow) : null;
    };
    const kick = () => { if (!rafId) rafId = requestAnimationFrame(follow); };

    hoverTexts.forEach((text) => {
      text.addEventListener('mouseenter', (e) => {
        if (!active) { cx = tx = e.clientX; cy = ty = e.clientY; } // appear at the cursor, no fly-in
        floatImg.src = text.dataset.hoverImg;
        active = true;
        float.classList.add('is-visible');
        kick();
      });
      text.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; kick(); });
      text.addEventListener('mouseleave', () => {
        active = false;
        float.classList.remove('is-visible');
      });
    });
    // Scrolling moves the text out from under a still cursor
    window.addEventListener('scroll', () => {
      if (active && !hoverTexts.some((t) => t.matches(':hover'))) {
        active = false;
        float.classList.remove('is-visible');
      }
    }, { passive: true });
  }

  /* ---------- Gallery accordion: hover/focus expands a panel, click opens the project ---------- */
  const gallery = document.querySelector('[data-gallery]');
  const view = document.querySelector('[data-project-view]');
  if (gallery && view) {
    const panels = [...gallery.querySelectorAll('[data-project]')];
    const defaultPanel = gallery.querySelector('[data-default]') || panels[panels.length - 1];
    const canHover = window.matchMedia('(hover: hover)');
    const isPhone = window.matchMedia('(max-width: 1100px)'); // grid layouts: a tap opens the project directly

    const openPanel = (panel) => panels.forEach((p) => p.classList.toggle('is-open', p === panel));

    panels.forEach((panel) => {
      panel.addEventListener('mouseenter', () => openPanel(panel));
      panel.addEventListener('focus', () => openPanel(panel));
      panel.addEventListener('click', (e) => {
        e.preventDefault();
        // Touch screens (tablet layout): first tap expands, second tap opens
        if (!canHover.matches && !isPhone.matches && !panel.classList.contains('is-open')) {
          openPanel(panel);
          return;
        }
        openProject(panel);
      });
    });
    gallery.addEventListener('mouseleave', () => openPanel(defaultPanel));
    gallery.addEventListener('focusout', (e) => {
      if (!gallery.contains(e.relatedTarget)) openPanel(defaultPanel);
    });

    /* Project view */
    const pvImg = view.querySelector('[data-pv-img]');
    const pvTitle = view.querySelector('[data-pv-title]');
    const pvLabel = view.querySelector('[data-pv-label]');
    const pvClose = view.querySelector('[data-pv-close]');
    const pvBody = view.querySelector('[data-pv-body]');
    const pvScroll = view.querySelector('[data-pv-scroll]');
    let lastPanel = null;

    function openProject(panel) {
      lastPanel = panel;
      const img = panel.querySelector('.gallery__img');
      pvImg.src = img.src;
      pvImg.alt = img.alt;
      pvTitle.textContent = panel.querySelector('.image-card__title').textContent;
      pvLabel.textContent = panel.querySelector('.image-card__label').textContent;
      // Project write-up: the <template data-project-details="…"> matching the panel
      const details = document.querySelector(`template[data-project-details="${panel.dataset.projectId}"]`);
      pvBody.replaceChildren(details ? details.content.cloneNode(true) : '');
      pvScroll.scrollTop = 0;
      view.scrollTop = 0;
      view.hidden = false;
      document.body.style.overflow = 'hidden';
      header?.classList.add('is-hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => view.classList.add('is-open')));
      pvClose.focus({ preventScroll: true });
    }
    function closeProject() {
      if (view.hidden) return;
      view.classList.remove('is-open');
      document.body.style.overflow = '';
      header?.classList.remove('is-hidden');
      setTimeout(() => { if (!view.classList.contains('is-open')) view.hidden = true; }, reduceMotion ? 0 : 800);
      lastPanel?.focus({ preventScroll: true });
    }
    pvClose.addEventListener('click', closeProject);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProject(); });
  }

  /* ---------- Partner logos: seamless infinite marquee ----------
     Clone the logo set until the strip is covered plus one spare set, then loop
     the track by exactly one set width, so the end is never visible. */
  const track = document.querySelector('[data-marquee]');
  if (track) {
    const set = track.querySelector('.logos__set');
    const SPEED = 55; // px per second
    const buildMarquee = () => {
      track.querySelectorAll('[data-clone]').forEach((c) => c.remove());
      const setW = set.getBoundingClientRect().width;
      if (!setW) return;
      const copies = Math.ceil(track.parentElement.clientWidth / setW) + 1;
      for (let i = 1; i < copies; i++) {
        const clone = set.cloneNode(true);
        clone.setAttribute('data-clone', '');
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      }
      track.style.setProperty('--set-w', setW + 'px');
      track.style.setProperty('--marquee-dur', (setW / SPEED).toFixed(2) + 's');
    };
    buildMarquee();
    window.addEventListener('load', buildMarquee); // logo widths are final once images load
    let resizeTimer;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildMarquee, 200); });
  }

  /* ---------- Phones: the stats pill pops the paragraph open ---------- */
  const statsToggle = document.querySelector('[data-stats-toggle]');
  if (statsToggle) {
    const stats = statsToggle.closest('.stats');
    const pillEl = statsToggle.closest('.stats__num');
    const setStats = (open) => {
      stats.classList.toggle('is-open', open);
      statsToggle.setAttribute('aria-expanded', String(open));
    };
    pillEl.addEventListener('click', (e) => {
      if (getComputedStyle(statsToggle).display === 'none') return;   // not in phone layout
      e.stopPropagation();
      setStats(!stats.classList.contains('is-open'));
    });
    document.addEventListener('click', (e) => {
      if (stats.classList.contains('is-open') && !e.target.closest('.stats__desc')) setStats(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setStats(false); });
  }

  /* ---------- Badges: ZT90 / N'TX80 toggle ---------- */
  document.querySelectorAll('[data-badges]').forEach((group) => {
    const badges = [...group.querySelectorAll('.badge')];
    badges.forEach((badge) => {
      badge.addEventListener('click', () => {
        badges.forEach((b) => {
          const on = b === badge;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
      });
    });
  });

  /* ---------- Mobile menu ---------- */
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      document.body.style.overflow = 'hidden';
    } else {
      menu.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 700);
    }
  };
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') setMenu(false);
  });

  /* ---------- Links to #contact land at the end of the pinned section, so the buttons are showing ---------- */
  const contact = document.getElementById('contact');
  if (contact) {
    document.querySelectorAll('a[href="#contact"]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = contact.offsetTop + Math.max(contact.offsetHeight - window.innerHeight, 0);
      window.scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#contact');
    }));
  }

  /* ---------- Placeholder links (#) shouldn't jump to top ---------- */
  document.querySelectorAll('a[href="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
})();
