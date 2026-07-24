/* ============================================
   GRAPH_THEORY // BDA — ebook-reader.js
   Chapter-jump PDF reader: TOC sync, toolbar
   controls, fullscreen. Zero dependencies.
   ============================================ */

(() => {
    'use strict';

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        const reader = document.getElementById('ebook-reader');
        if (!reader) return; // reader markup not present on this page — bail safely

        const viewer = document.getElementById('pdf-viewer');
        const viewerWrap = document.getElementById('reader-viewer-wrap');
        const fallback = document.getElementById('reader-fallback');
        const tocItems = Array.from(reader.querySelectorAll('.toc-item'));
        const prevBtn = document.getElementById('reader-prev');
        const nextBtn = document.getElementById('reader-next');
        const chapterLabel = document.getElementById('reader-chapter-label');
        const fullscreenBtn = document.getElementById('reader-fullscreen');

        // Chapters read straight from the TOC markup so the DOM stays the
        // single source of truth — no duplicated data to drift out of sync.
        const chapters = tocItems.map((item) => ({
            index: Number(item.dataset.index),
            page: Number(item.dataset.page),
            label: item.textContent.trim().replace(/\s+/g, ' '),
            el: item,
        }));

        let currentIndex = 0;

        /* ---------- Core navigation ---------- */
        function goToChapter(index) {
            if (index < 0 || index >= chapters.length) return; // out of range — ignore
            currentIndex = index;
            const chapter = chapters[index];

            // Jump the iframe via the PDF fragment spec (#page=N). Supported by
            // Chrome/Firefox/Edge's built-in viewer; Safari/mobile largely ignore
            // it, which is why the fallback panel exists below.
            viewer.src = `assets/graph-theory-ebook.pdf#page=${chapter.page}&toolbar=0&navpanes=0`;

            updateActiveState(chapter);
        }

        function updateActiveState(chapter) {
            tocItems.forEach((item) => item.classList.remove('is-active'));
            chapter.el.classList.add('is-active');

            chapterLabel.textContent = chapter.label;
            prevBtn.disabled = currentIndex === 0;
            nextBtn.disabled = currentIndex === chapters.length - 1;
        }

        /* ---------- Toolbar: prev / next arrows ---------- */
        prevBtn.addEventListener('click', () => goToChapter(currentIndex - 1));
        nextBtn.addEventListener('click', () => goToChapter(currentIndex + 1));

        /* ---------- TOC panel: direct chapter jump ---------- */
        tocItems.forEach((item) => {
            item.addEventListener('click', () => goToChapter(Number(item.dataset.index)));
        });

        /* ---------- Fullscreen toggle ---------- */
        // Fullscreens the viewer container (not just the iframe) so the
        // toolbar-less border and glow styling stay visible while expanded.
        fullscreenBtn.addEventListener('click', () => {
            const inFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

            if (!inFullscreen) {
                const request = viewerWrap.requestFullscreen || viewerWrap.webkitRequestFullscreen;
                if (request) {
                    request.call(viewerWrap).catch(() => {
                        // Fullscreen can be denied (e.g. iframe sandboxing, user gesture
                        // policy); fail silently rather than breaking the reader.
                    });
                }
            } else {
                const exit = document.exitFullscreen || document.webkitExitFullscreen;
                if (exit) exit.call(document);
            }
        });

        // Reflect actual fullscreen state on the button label (in case the user
        // exits via Esc rather than the button itself).
        ['fullscreenchange', 'webkitfullscreenchange'].forEach((evt) => {
            document.addEventListener(evt, () => {
                const active = document.fullscreenElement || document.webkitFullscreenElement;
                viewerWrap.classList.toggle('is-fullscreen', Boolean(active));
                fullscreenBtn.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
            });
        });

        /* ---------- Inline-render fallback ---------- */
        // There's no reliable 'this PDF failed to render' event for cross-origin
        // or blocked iframe content, so this is a best-effort check: give the
        // iframe a short window to load, and if nothing has fired by then on a
        // browser known to skip inline PDF rendering, reveal the fallback.
        const knownToSkipInlinePDF = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
        if (knownToSkipInlinePDF) {
            fallback.hidden = false;
            viewerWrap.classList.add('reader__viewer-wrap--fallback-active');
        }

        viewer.addEventListener('error', () => {
            fallback.hidden = false;
            viewerWrap.classList.add('reader__viewer-wrap--fallback-active');
        });

        /* ---------- Initial state ---------- */
        goToChapter(0);
    }
})();