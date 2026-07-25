/* ============================================
   WORLD OF GRAPHS — app.js
   Interactive graph engine with drag, node count
   slider, hover tooltips, and smooth animations.
   ============================================ */

/* ==========================================================================
   GRAPH ENGINE
   ========================================================================== */
class GraphEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.animating = true;
        this.currentTopic = 'simple';
        this.nodeCount = 5;
        this.time = 0;

        // Cyber-teal palette
        this.ACCENT = '#00d4ff';
        this.ACCENT_RGB = '0, 212, 255';
        this.ACCENT_SOFT = '#67e8f9';
        this.NODE_COLOR = '#dfe6f0';
        this.NODE_DIM = '#6b7a90';
        this.EDGE_COLOR = 'rgba(255, 255, 255, 0.08)';
        this.EDGE_HIGHLIGHT = 'rgba(0, 212, 255, 0.5)';
        this.LABEL_BG = 'rgba(5, 5, 16, 0.85)';

        // Drag state
        this.dragNode = null;
        this.isDragging = false;
        this.hoveredNode = null;

        this.resize();
        this.bindEvents();
        this.initTopic('simple');
        this.loop();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.scale(dpr, dpr);
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());

        // Mouse events for dragging & hover
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('mouseleave', () => {
            this.onMouseUp();
            this.hoveredNode = null;
            this.updateTooltip(null);
        });

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
            e.preventDefault();
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            e.preventDefault();
        }, { passive: false });
        this.canvas.addEventListener('touchend', () => this.onMouseUp());
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    findNodeAt(pos) {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const n = this.nodes[i];
            const dx = pos.x - n.x;
            const dy = pos.y - n.y;
            if (Math.sqrt(dx * dx + dy * dy) < 16) return n;
        }
        return null;
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        const node = this.findNodeAt(pos);
        if (node) {
            this.dragNode = node;
            this.isDragging = true;
            node.vx = 0;
            node.vy = 0;
        }
    }

    onMouseMove(e) {
        const pos = this.getMousePos(e);
        if (this.isDragging && this.dragNode) {
            this.dragNode.x = pos.x;
            this.dragNode.y = pos.y;
        }

        // Hover detection
        const node = this.findNodeAt(pos);
        if (node !== this.hoveredNode) {
            this.hoveredNode = node;
            this.updateTooltip(node, e);
        } else if (node) {
            this.updateTooltipPosition(e);
        }

        this.canvas.style.cursor = node ? 'grab' : 'none';
        if (this.isDragging) this.canvas.style.cursor = 'grabbing';
    }

    onMouseUp() {
        if (this.dragNode) {
            // Give a tiny random velocity so it rejoins animation
            this.dragNode.vx = (Math.random() - 0.5) * 0.2;
            this.dragNode.vy = (Math.random() - 0.5) * 0.2;
        }
        this.dragNode = null;
        this.isDragging = false;
    }

    updateTooltip(node, e) {
        const tooltip = document.getElementById('node-tooltip');
        if (!tooltip) return;
        if (!node) {
            tooltip.classList.remove('visible');
            return;
        }
        const degree = this.edges.filter(([a, b]) => a === node.id || b === node.id).length;
        const group = node.group ? ` · Set ${node.group}` : '';
        tooltip.textContent = `v${node.id}  deg=${degree}${group}`;
        tooltip.classList.add('visible');
        if (e) this.updateTooltipPosition(e);
    }

    updateTooltipPosition(e) {
        const tooltip = document.getElementById('node-tooltip');
        if (!tooltip) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        tooltip.style.left = (e.clientX - canvasRect.left + 14) + 'px';
        tooltip.style.top = (e.clientY - canvasRect.top - 10) + 'px';
    }

    getDegree(nodeId) {
        return this.edges.filter(([a, b]) => a === nodeId || b === nodeId).length;
    }

    /* ──────── TOPIC INIT ──────── */
    initTopic(topicKey) {
        this.currentTopic = topicKey;
        this.nodes = [];
        this.edges = [];

        const w = this.displayWidth || 600;
        const h = this.displayHeight || 400;
        const cx = w / 2;
        const cy = h / 2 - 20;
        const r = Math.min(w, h) * 0.25;
        const n = this.nodeCount;

        switch (topicKey) {
            case 'simple':
                this.makeCircle(n, cx, cy, r);
                // Random subset of edges (no duplicates, no self-loops)
                for (let i = 0; i < n; i++) {
                    for (let j = i + 1; j < n; j++) {
                        if (Math.random() < 0.4 || j === i + 1 || (i === 0 && j === n - 1))
                            this.edges.push([i, j]);
                    }
                }
                this.setDesc(`Simple Graph — ${n} vertices connected by undirected edges. No self-loops, no parallel edges. Click a card above to switch topics.`);
                break;

            case 'empty_null':
                this.makeCircle(n, cx, cy, r * 1.1);
                this.edges = [];
                this.setDesc(`Empty Graph — ${n} isolated vertices with no edges. Every vertex has degree 0. The edge set E = ∅.`);
                break;

            case 'connected_complete':
                this.makeCircle(n, cx, cy, r);
                for (let i = 0; i < n; i++)
                    for (let j = i + 1; j < n; j++)
                        this.edges.push([i, j]);
                this.setDesc(`Complete Graph K${n} — Every pair of ${n} vertices is connected. Total edges: ${n * (n - 1) / 2}. Every vertex has degree ${n - 1}.`);
                break;

            case 'subgraph': {
                this.makeCircle(n, cx, cy, r * 1.1);
                // Full graph edges
                for (let i = 0; i < n; i++) {
                    if (i < n - 1) this.edges.push([i, i + 1]);
                }
                this.edges.push([0, n - 1]);
                // Highlight first half as subgraph
                const halfN = Math.ceil(n / 2);
                this.nodes.forEach((nd, idx) => nd.highlight = idx < halfN);
                this.setDesc(`Subgraph — The highlighted ${halfN} vertices and their connecting edges form a subgraph H ⊆ G. Spanning subgraphs keep all ${n} vertices.`);
                break;
            }

            case 'complement_bipartite': {
                const half = Math.ceil(n / 2);
                const rest = n - half;
                for (let i = 0; i < half; i++) {
                    this.nodes.push({
                        id: i, x: cx - r * 0.8, y: cy - ((half - 1) * 35) / 2 + i * 35,
                        vx: 0, vy: 0, group: 1
                    });
                }
                for (let i = 0; i < rest; i++) {
                    this.nodes.push({
                        id: half + i, x: cx + r * 0.8,
                        y: cy - ((rest - 1) * 35) / 2 + i * 35,
                        vx: 0, vy: 0, group: 2
                    });
                }
                // Connect across sets
                for (let i = 0; i < half; i++)
                    for (let j = half; j < n; j++)
                        if (Math.random() < 0.55) this.edges.push([i, j]);
                if (this.edges.length === 0) this.edges.push([0, half]);
                this.setDesc(`Bipartite Graph — ${half} vertices in Set 1, ${rest} in Set 2. Edges only connect across sets V₁ → V₂. No edges within the same set.`);
                break;
            }

            case 'size_order_classes':
                this.makeCircle(n, cx, cy, r * 1.05);
                for (let i = 0; i < n; i++) this.edges.push([i, (i + 1) % n]);
                this.setDesc(`Cycle Graph C${n} — Order |V| = ${n}, Size |E| = ${n}. A single cycle through all vertices. Every vertex has degree 2.`);
                break;

            case 'regular_adjacency': {
                this.makeCircle(n, cx, cy, r * 1.05);
                // Try to make k-regular. For even n, 2-regular = cycle
                for (let i = 0; i < n; i++) {
                    this.edges.push([i, (i + 1) % n]);
                    if (n > 4) this.edges.push([i, (i + 2) % n]);
                }
                // Deduplicate
                const edgeSet = new Set();
                this.edges = this.edges.filter(([a, b]) => {
                    const key = Math.min(a, b) + ',' + Math.max(a, b);
                    if (edgeSet.has(key)) return false;
                    edgeSet.add(key);
                    return true;
                });
                const k = n > 4 ? 4 : 2;
                this.setDesc(`${k}-Regular Graph — Every vertex has exactly degree ${k}. Total edges: ${this.edges.length}. Regular graphs have uniform degree distribution.`);
                break;
            }

            case 'degree_sequence': {
                this.makeCircle(n, cx, cy, r);
                // Star-like: node 0 connects to all, then a few extras
                for (let i = 1; i < n; i++) this.edges.push([0, i]);
                if (n > 3) this.edges.push([1, 2]);
                const degrees = this.nodes.map(nd => this.getDegree(nd.id)).sort((a, b) => b - a);
                const sumDeg = degrees.reduce((s, d) => s + d, 0);
                this.setDesc(`Degree Sequence: (${degrees.join(', ')}). Sum of degrees = ${sumDeg} = 2 × ${this.edges.length} edges. Handshaking Lemma verified.`);
                break;
            }
        }

        // Sync slider
        const slider = document.getElementById('node-slider');
        const display = document.getElementById('node-count-display');
        if (slider) slider.value = this.nodeCount;
        if (display) display.textContent = this.nodeCount;
    }

    makeCircle(count, cx, cy, radius) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
            this.nodes.push({
                id: i,
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                highlight: false
            });
        }
    }

    setDesc(text) {
        const el = document.getElementById('topic-description');
        if (el) el.innerText = text;
    }

    /* ──────── UPDATE & DRAW ──────── */
    update() {
        this.time += 0.016;
        if (!this.animating) return;

        const w = this.displayWidth;
        const h = this.displayHeight;

        this.nodes.forEach(node => {
            if (this.dragNode === node) return;
            node.x += node.vx;
            node.y += node.vy;
            if (node.x < 30 || node.x > w - 30) node.vx *= -1;
            if (node.y < 30 || node.y > h - 50) node.vy *= -1;
        });
    }

    draw() {
        const dpr = window.devicePixelRatio || 1;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = this.displayWidth;
        const h = this.displayHeight;
        this.ctx.clearRect(0, 0, w, h);

        // Edges
        this.edges.forEach(([i, j]) => {
            const n1 = this.nodes[i];
            const n2 = this.nodes[j];
            if (!n1 || !n2) return;

            const bothHighlighted = n1.highlight && n2.highlight;

            if (bothHighlighted) {
                this.ctx.save();
                this.ctx.shadowColor = this.ACCENT;
                this.ctx.shadowBlur = 10;
                this.ctx.strokeStyle = this.EDGE_HIGHLIGHT;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(n1.x, n1.y);
                this.ctx.lineTo(n2.x, n2.y);
                this.ctx.stroke();
                this.ctx.restore();
            } else {
                this.ctx.strokeStyle = this.EDGE_COLOR;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(n1.x, n1.y);
                this.ctx.lineTo(n2.x, n2.y);
                this.ctx.stroke();
            }
        });

        // Nodes
        this.nodes.forEach(node => {
            const isHL = node.highlight;
            const isGroup2 = node.group === 2;
            const isHovered = this.hoveredNode === node;
            const nr = isHovered ? 9 : 7;

            // Pulse for highlighted
            if (isHL) {
                const pr = nr + 6 + Math.sin(this.time * 3) * 3;
                const grad = this.ctx.createRadialGradient(node.x, node.y, nr, node.x, node.y, pr);
                grad.addColorStop(0, `rgba(${this.ACCENT_RGB}, 0.3)`);
                grad.addColorStop(1, `rgba(${this.ACCENT_RGB}, 0)`);
                this.ctx.fillStyle = grad;
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, pr, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Hover glow
            if (isHovered) {
                const hg = this.ctx.createRadialGradient(node.x, node.y, nr, node.x, node.y, nr + 12);
                hg.addColorStop(0, `rgba(${this.ACCENT_RGB}, 0.25)`);
                hg.addColorStop(1, `rgba(${this.ACCENT_RGB}, 0)`);
                this.ctx.fillStyle = hg;
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, nr + 12, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Shadow
            this.ctx.save();
            this.ctx.shadowColor = isHL ? this.ACCENT : 'rgba(255,255,255,0.12)';
            this.ctx.shadowBlur = isHL ? 14 : 6;

            // Fill
            this.ctx.fillStyle = isHL ? this.ACCENT : (isGroup2 ? this.NODE_DIM : this.NODE_COLOR);
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, nr, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            // Border
            this.ctx.strokeStyle = isHL ? this.ACCENT : 'rgba(255,255,255,0.06)';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();

            // Label chip
            const label = `v${node.id}`;
            this.ctx.font = '500 10px "JetBrains Mono", monospace';
            const tm = this.ctx.measureText(label);
            const lx = node.x + nr + 8;
            const ly = node.y + 3;
            const px = 5, py = 3;

            this.ctx.fillStyle = this.LABEL_BG;
            this.ctx.beginPath();
            this.ctx.roundRect(lx - px, ly - 8 - py, tm.width + px * 2, 12 + py * 2, 3);
            this.ctx.fill();

            this.ctx.fillStyle = isHL ? this.ACCENT_SOFT : this.NODE_DIM;
            this.ctx.fillText(label, lx, ly);
        });
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}


/* ==========================================================================
   CUSTOM CURSOR
   ========================================================================== */
function initCursor() {
    const dot = document.getElementById('cursor-dot');
    const glow = document.getElementById('cursor-glow');
    if (!dot || !glow) return;

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        dot.style.display = 'none';
        glow.style.display = 'none';
        document.body.style.cursor = 'auto';
        return;
    }

    let mx = -100, my = -100, dx = -100, dy = -100, gx = -100, gy = -100;

    document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });

    function anim() {
        dx += (mx - dx) * 0.5;
        dy += (my - dy) * 0.5;
        dot.style.transform = `translate(${dx - 3}px, ${dy - 3}px)`;

        gx += (mx - gx) * 0.12;
        gy += (my - gy) * 0.12;
        glow.style.transform = `translate(${gx - 90}px, ${gy - 90}px)`;

        requestAnimationFrame(anim);
    }
    anim();
}


/* ==========================================================================
   NAVBAR SCROLL
   ========================================================================== */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    let t = false;
    window.addEventListener('scroll', () => {
        if (!t) {
            requestAnimationFrame(() => {
                navbar.classList.toggle('scrolled', window.scrollY > 20);
                t = false;
            });
            t = true;
        }
    });
}


/* ==========================================================================
   CARD STATE
   ========================================================================== */
const topicMap = {
    'simple': 0, 'empty_null': 1, 'connected_complete': 2, 'subgraph': 3,
    'complement_bipartite': 4, 'size_order_classes': 5, 'regular_adjacency': 6, 'degree_sequence': 7
};

function setActiveCard(key) {
    document.querySelectorAll('.cards-grid .card').forEach((c, i) => {
        c.classList.toggle('card-active', i === topicMap[key]);
    });
}


/* ==========================================================================
   KATEX
   ========================================================================== */
function initKaTeX() {
    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(document.body, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        });
    }
}


/* ==========================================================================
   INIT
   ========================================================================== */
let engine;

document.addEventListener('DOMContentLoaded', () => {
    engine = new GraphEngine('graphCanvas');
    setActiveCard('simple');

    // Anim toggle
    document.getElementById('btn-toggle-anim').addEventListener('click', (e) => {
        engine.animating = !engine.animating;
        e.target.innerText = engine.animating ? 'Pause' : 'Resume';
    });

    // Reset
    document.getElementById('btn-reset').addEventListener('click', () => {
        engine.initTopic(engine.currentTopic);
    });

    // Node slider
    const slider = document.getElementById('node-slider');
    const display = document.getElementById('node-count-display');
    if (slider) {
        slider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            display.textContent = val;
            engine.nodeCount = val;
            engine.initTopic(engine.currentTopic);
        });
    }

    initCursor();
    initNavbar();
    window.addEventListener('load', initKaTeX);
});


/* ==========================================================================
   SELECT TOPIC (global, called from card onclick)
   ========================================================================== */
function selectTopic(topicKey) {
    const titles = {
        'simple': 'Simple Graph',
        'empty_null': 'Empty & Null Graphs',
        'connected_complete': 'Complete Graph',
        'subgraph': 'Subgraphs',
        'complement_bipartite': 'Bipartite Graph',
        'size_order_classes': 'Cycle Graph',
        'regular_adjacency': 'Regular Graph',
        'degree_sequence': 'Degree Sequences'
    };

    document.getElementById('current-topic-title').innerText = titles[topicKey] || 'Graph Visualizer';
    setActiveCard(topicKey);

    // Transition
    const container = document.querySelector('.visualizer-container');
    container.classList.add('transitioning');
    setTimeout(() => {
        engine.initTopic(topicKey);
        container.classList.remove('transitioning');
    }, 180);

    document.getElementById('lab').scrollIntoView({ behavior: 'smooth' });
}