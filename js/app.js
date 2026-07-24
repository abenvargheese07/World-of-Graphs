/* ============================================
   GRAPH_THEORY // BDA — app.js
   Vanilla JS micro-interactions, zero dependencies.
   Modules: cursor follower, card glow, tab router.
   ============================================ */

(() => {
    'use strict';

    // ---------- Shared environment checks ----------
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches; // touch / no fine cursor

    // Basic debounce helper used for resize handlers.
    const debounce = (fn, delay = 100) => {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), delay);
        };
    };

    /* ============================================
       1. CUSTOM RED CURSOR FOLLOWER
       A single dot that lerps toward the real cursor
       position every frame, and scales up on hover
       targets. Skipped entirely on touch devices and
       when the user prefers reduced motion.
       ============================================ */
    function initCursor() {
        if (isCoarsePointer || prefersReducedMotion) return;

        const cursor = document.createElement('div');
        cursor.id = 'cursor';
        cursor.setAttribute('aria-hidden', 'true');
        document.body.appendChild(cursor);
        document.body.classList.add('js-cursor-enabled'); // hides native cursor via CSS

        // Target = real mouse position. Current = rendered (lerped) position.
        let targetX = window.innerWidth / 2;
        let targetY = window.innerHeight / 2;
        let currentX = targetX;
        let currentY = targetY;
        const EASE = 0.2; // lerp factor: lower = laggier/smoother trail

        window.addEventListener('pointermove', (e) => {
            targetX = e.clientX;
            targetY = e.clientY;
        }, { passive: true });

        // Grow the dot when hovering anything interactive.
        const hoverTargets = 'a, button, .card, .nav__links a, .btn';
        document.addEventListener('pointerover', (e) => {
            if (e.target.closest(hoverTargets)) cursor.classList.add('cursor--active');
        });
        document.addEventListener('pointerout', (e) => {
            if (e.target.closest(hoverTargets)) cursor.classList.remove('cursor--active');
        });

        // Hide the dot entirely when the pointer leaves the viewport.
        document.addEventListener('pointerleave', () => cursor.classList.add('cursor--hidden'));
        document.addEventListener('pointerenter', () => cursor.classList.remove('cursor--hidden'));

        // Single shared rAF loop — avoids stacking multiple animation frames.
        function render() {
            currentX += (targetX - currentX) * EASE;
            currentY += (targetY - currentY) * EASE;
            cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);
    }

    /* ============================================
       2. MOUSE-TRACKING CARD GLOW
       Each .card tracks pointer position relative to
       itself and exposes it as CSS custom properties
       (--mx, --my) that drive a radial-gradient
       highlight in components.css. Throttled with a
       per-card rAF flag so fast mouse movement can't
       queue redundant layout reads.
       ============================================ */
    function initCardGlow() {
        if (isCoarsePointer) return; // no hover concept on touch — skip entirely

        const cards = document.querySelectorAll('.card');

        cards.forEach((card) => {
            let ticking = false;
            let lastX = 0;
            let lastY = 0;

            card.addEventListener('pointermove', (e) => {
                const rect = card.getBoundingClientRect();
                lastX = e.clientX - rect.left;
                lastY = e.clientY - rect.top;

                if (!ticking) {
                    ticking = true;
                    requestAnimationFrame(() => {
                        card.style.setProperty('--mx', `${lastX}px`);
                        card.style.setProperty('--my', `${lastY}px`);
                        ticking = false;
                    });
                }
            }, { passive: true });

            // Fade the glow in/out via a class rather than opacity in JS,
            // so CSS owns the transition timing.
            card.addEventListener('pointerenter', () => card.classList.add('card--glow'));
            card.addEventListener('pointerleave', () => card.classList.remove('card--glow'));
        });
    }

    /* ============================================
       3 & 4. TAB SWITCHER / NAV ROUTER
       Toggles visibility between .view sections
       (#modules, #lab, #ebook) without page reloads,
       animates a sliding active-link indicator, and
       fades in the newly shown section.
       ============================================ */
    function initRouter() {
        const navLinks = Array.from(document.querySelectorAll('.nav__links a'));
        const views = Array.from(document.querySelectorAll('main > .view'));

        if (!navLinks.length || !views.length) return; // nothing to route — bail safely

        // Build the sliding underline indicator once.
        const navList = document.querySelector('.nav__links');
        const indicator = document.createElement('span');
        indicator.className = 'nav__indicator';
        navList.appendChild(indicator);

        function moveIndicatorTo(link) {
            const navRect = navList.getBoundingClientRect();
            const linkRect = link.getBoundingClientRect();
            indicator.style.width = `${linkRect.width}px`;
            indicator.style.transform = `translateX(${linkRect.left - navRect.left}px)`;
        }

        function showView(targetId) {
            views.forEach((view) => {
                const isTarget = view.id === targetId;
                view.classList.toggle('is-active', isTarget);
                // Re-trigger the fade-in animation on every switch, not just first paint.
                if (isTarget) {
                    view.classList.remove('is-entering');
                    void view.offsetWidth; // force reflow so the animation restarts
                    view.classList.add('is-entering');
                }
            });
        }

        function setActiveLink(link) {
            navLinks.forEach((l) => l.classList.remove('is-active'));
            link.classList.add('is-active');
            moveIndicatorTo(link);
        }

        function handleNavClick(e) {
            const href = e.currentTarget.getAttribute('href');
            if (!href || !href.startsWith('#')) return; // let external links behave normally

            const targetId = href.slice(1);
            const targetView = document.getElementById(targetId);
            if (!targetView || !targetView.classList.contains('view')) return; // not a routed section

            e.preventDefault();
            showView(targetId);
            setActiveLink(e.currentTarget);
            history.replaceState(null, '', href); // keep URL in sync without adding history entries
        }

        navLinks.forEach((link) => link.addEventListener('click', handleNavClick));

        // Reposition the indicator on resize (layout shifts change link widths/offsets).
        window.addEventListener('resize', debounce(() => {
            const active = document.querySelector('.nav__links a.is-active');
            if (active) moveIndicatorTo(active);
        }, 120));

        // ---- Initial state: honor a real URL hash, else default to the first link ----
        const initialHash = window.location.hash.slice(1);
        const initialLink = navLinks.find((l) => l.getAttribute('href') === `#${initialHash}`)
            || navLinks[0];
        const initialId = initialLink.getAttribute('href').slice(1);

        showView(initialId);
        // Skip the indicator's own transition on first paint so it doesn't slide in from 0.
        indicator.style.transition = 'none';
        setActiveLink(initialLink);
        requestAnimationFrame(() => { indicator.style.transition = ''; });
    }

    // ---------- Bootstrap ----------
    document.addEventListener('DOMContentLoaded', () => {
        initCursor();
        initCardGlow();
        initRouter();
    });
})();