/* ============================================
   WORLD OF GRAPHS — ebook-reader.js
   PDF viewer with page navigation.
   Uses cache-bust to force iframe reload on
   each chapter click so #page=N actually works.
   ============================================ */

(() => {
    'use strict';

    const PDF_PATH = 'assets/ebook/World%20of%20Graphs.pdf';
    const TOTAL_PAGES = 17;

    // Chapters mapped to actual PDF page numbers (verified page-by-page)
    const chapters = [
        { index: 0,  page: 1,  label: 'Cover' },
        { index: 1,  page: 2,  label: 'Table of Contents' },
        { index: 2,  page: 3,  label: 'Acknowledgements' },
        { index: 3,  page: 4,  label: 'Preface' },
        { index: 4,  page: 5,  label: 'Unit 1 — Introduction to Graphs' },
        { index: 5,  page: 6,  label: '1.2 Terminology & 1.3 Types' },
        { index: 6,  page: 7,  label: '1.4 Degree Sequences' },
        { index: 7,  page: 8,  label: '1.5 Matrices & 1.6 Isomorphism' },
        { index: 8,  page: 9,  label: 'Worked Examples' },
        { index: 9,  page: 10, label: 'Review Questions' },
        { index: 10, page: 11, label: 'Unit 2 — Connectivity & Traversability' },
        { index: 11, page: 12, label: '2.3 Spanning Trees & MSTs' },
        { index: 12, page: 13, label: '2.4 Blocks & Block-Cut Trees' },
        { index: 13, page: 14, label: '2.5 Eulerian & 2.6 Hamiltonian' },
        { index: 14, page: 15, label: '2.7 Digraphs' },
        { index: 15, page: 16, label: 'Applications' },
        { index: 16, page: 17, label: 'About the Authors' },
    ];

    let currentIndex = 0;

    function isDeployed() {
        const h = window.location.hostname;
        return h !== 'localhost' && h !== '127.0.0.1' && h !== '';
    }

    function getFullPdfUrl() {
        return window.location.origin + '/' + PDF_PATH;
    }

    function buildSrc(page) {
        // Cache-bust query string forces the iframe to fully reload,
        // which makes the #page=N fragment actually take effect.
        const bust = '_t=' + Date.now();

        if (isDeployed()) {
            // Google Docs Viewer for Firebase (doesn't support page jump,
            // but at least renders the PDF cross-browser)
            return 'https://docs.google.com/gview?url='
                + encodeURIComponent(getFullPdfUrl())
                + '&embedded=true';
        }
        // Chrome / Firefox built-in PDF viewer supports #page=N
        return PDF_PATH + '?' + bust + '#page=' + page;
    }

    function init() {
        const viewer   = document.getElementById('pdf-viewer');
        const fallback = document.getElementById('reader-fallback');
        const gdLink   = document.getElementById('gdocs-link');
        const prevBtn  = document.getElementById('reader-prev');
        const nextBtn  = document.getElementById('reader-next');
        const fsBtn    = document.getElementById('reader-fullscreen');
        const label    = document.getElementById('reader-chapter-label');
        const tocItems = document.querySelectorAll('.toc-item');

        if (!viewer) return;

        // Set Google Docs link
        if (gdLink) {
            gdLink.href = 'https://docs.google.com/gview?url='
                + encodeURIComponent(getFullPdfUrl());
        }

        // Load first chapter
        loadChapter(0);

        function loadChapter(idx) {
            if (idx < 0 || idx >= chapters.length) return;
            currentIndex = idx;
            const ch = chapters[idx];

            // Set iframe src (cache-bust forces full reload)
            viewer.src = buildSrc(ch.page);
            viewer.style.display = 'block';
            if (fallback) fallback.classList.remove('visible');

            // Update TOC active state
            tocItems.forEach(item => {
                const i = parseInt(item.dataset.index, 10);
                item.classList.toggle('is-active', i === idx);
            });

            // Update toolbar label
            if (label) label.textContent = ch.label;

            // Update prev/next buttons
            if (prevBtn) prevBtn.disabled = (idx === 0);
            if (nextBtn) nextBtn.disabled = (idx === chapters.length - 1);
        }

        // TOC clicks
        tocItems.forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index, 10);
                loadChapter(idx);
            });
        });

        // Prev / Next
        if (prevBtn) prevBtn.addEventListener('click', () => loadChapter(currentIndex - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => loadChapter(currentIndex + 1));

        // Fullscreen
        if (fsBtn) {
            fsBtn.addEventListener('click', () => {
                const wrap = document.getElementById('reader-viewer-wrap');
                if (wrap) {
                    if (wrap.requestFullscreen) wrap.requestFullscreen();
                    else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();