/* ============================================
   WORLD OF GRAPHS — ebook-reader.js
   HTML-based ebook reader with TOC navigation.
   Content is fetched from ebook-content.html and
   rendered inline. Download button links to PDF.
   ============================================ */

(() => {
    'use strict';

    let pages = [];        // All .ebook-page sections
    let currentIdx = 0;
    let tocItems = [];
    let scrollArea = null;
    let label = null;
    let prevBtn = null;
    let nextBtn = null;

    async function init() {
        scrollArea = document.getElementById('ebook-scroll-area');
        label      = document.getElementById('reader-chapter-label');
        prevBtn    = document.getElementById('reader-prev');
        nextBtn    = document.getElementById('reader-next');
        tocItems   = Array.from(document.querySelectorAll('#toc-panel .toc-item'));

        if (!scrollArea) return;

        // Fetch HTML content
        try {
            const resp = await fetch('ebook-content.html');
            if (!resp.ok) throw new Error(resp.status);
            const html = await resp.text();
            scrollArea.innerHTML = html;
        } catch (err) {
            scrollArea.innerHTML = `
                <div style="padding:48px;text-align:center;color:var(--text-muted);">
                    <p>Could not load ebook content.</p>
                    <p><a href="assets/ebook/World%20of%20Graphs.pdf" download 
                          style="color:var(--accent);text-decoration:underline;">Download the PDF instead</a></p>
                </div>`;
            return;
        }

        // Collect all page sections
        pages = Array.from(scrollArea.querySelectorAll('.ebook-page'));

        // Wire TOC clicks
        tocItems.forEach((item, i) => {
            item.addEventListener('click', () => {
                navigateTo(i);
            });
        });

        // Wire prev/next
        if (prevBtn) prevBtn.addEventListener('click', () => navigateTo(currentIdx - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => navigateTo(currentIdx + 1));

        // Track scroll position to update TOC active state
        scrollArea.addEventListener('scroll', onScroll);

        // Initial state
        navigateTo(0);
    }

    function navigateTo(idx) {
        if (idx < 0 || idx >= tocItems.length) return;
        currentIdx = idx;

        // Find target section
        const target = tocItems[idx].dataset.target;
        const section = scrollArea.querySelector('#' + target);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        updateUI(idx);
    }

    function updateUI(idx) {
        // Highlight active TOC item
        tocItems.forEach((item, i) => {
            item.classList.toggle('is-active', i === idx);
        });

        // Update toolbar label
        if (label) label.textContent = tocItems[idx]?.textContent || '';

        // Update prev/next
        if (prevBtn) prevBtn.disabled = (idx === 0);
        if (nextBtn) nextBtn.disabled = (idx === tocItems.length - 1);
    }

    function onScroll() {
        if (!pages.length) return;

        const scrollTop = scrollArea.scrollTop;
        const threshold = 100; // px from top of scroll area

        let activeIdx = 0;
        for (let i = 0; i < pages.length; i++) {
            const offset = pages[i].offsetTop - scrollArea.offsetTop;
            if (offset <= scrollTop + threshold) {
                activeIdx = i;
            }
        }

        if (activeIdx !== currentIdx) {
            currentIdx = activeIdx;
            updateUI(activeIdx);

            // Keep TOC item in view
            const activeItem = tocItems[activeIdx];
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();