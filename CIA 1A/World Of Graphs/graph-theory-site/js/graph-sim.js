/* ============================================
   GRAPH_THEORY // BDA — graph-sim.js
   Canvas-based interactive graph: build nodes/edges
   by hand, then animate BFS / Dijkstra / Kruskal MST
   over them. Zero dependencies, single rAF loop.
   ============================================ */

(() => {
    'use strict';

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        const canvas = document.getElementById('lab-canvas');
        const wrap = document.getElementById('lab-canvas-wrap');
        if (!canvas || !wrap) return; // lab markup not present — bail safely

        const ctx = canvas.getContext('2d');
        const statusEl = document.getElementById('lab-status');

        const NODE_RADIUS = 16;
        const ACCENT = '#FF2E2E';
        const EDGE_IDLE = 'rgba(255, 255, 255, 0.22)';
        const EDGE_ACTIVE = ACCENT;
        const NODE_IDLE_FILL = '#121215';
        const NODE_IDLE_STROKE = 'rgba(255, 255, 255, 0.35)';
        const TEXT_MUTED = '#888888';
        const TEXT_PRIMARY = '#E6E6E6';

        // ---------- State ----------
        let nodes = [];      // { id, x, y }
        let edges = [];      // { a, b, weight }
        let nextId = 1;

        let startNodeId = null;
        let edgeSourceId = null;   // node awaiting a shift-click partner
        let draggingId = null;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        // Visual state driven by the current algorithm animation.
        // visited: Set of node ids to paint red. activeEdges: Set of "a-b" keys to paint red.
        let visited = new Set();
        let activeEdges = new Set();
        let animationTimer = null; // handle for the current step sequence, so a new run can cancel it

        // ---------- Canvas sizing (crisp on high-DPI screens) ----------
        function resizeCanvas() {
            const rect = wrap.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            render();
        }
        window.addEventListener('resize', debounce(resizeCanvas, 150));

        function debounce(fn, delay) {
            let t;
            return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
        }

        // ---------- Geometry helpers ----------
        function edgeKey(a, b) {
            return a < b ? `${a}-${b}` : `${b}-${a}`; // undirected, order-independent key
        }

        function findNodeAt(x, y) {
            // Iterate in reverse so the most recently drawn (topmost) node wins on overlap.
            for (let i = nodes.length - 1; i >= 0; i--) {
                const n = nodes[i];
                if (Math.hypot(n.x - x, n.y - y) <= NODE_RADIUS) return n;
            }
            return null;
        }

        function neighborsOf(id) {
            // Returns [{ id, weight }] for every node connected to `id`.
            return edges
                .filter((e) => e.a === id || e.b === id)
                .map((e) => ({ id: e.a === id ? e.b : e.a, weight: e.weight }));
        }

        // ---------- Rendering ----------
        function render() {
            const rect = wrap.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);

            // Edges first, so nodes draw on top.
            edges.forEach((e) => {
                const a = nodes.find((n) => n.id === e.a);
                const b = nodes.find((n) => n.id === e.b);
                if (!a || !b) return;

                const isActive = activeEdges.has(edgeKey(e.a, e.b));
                ctx.strokeStyle = isActive ? EDGE_ACTIVE : EDGE_IDLE;
                ctx.lineWidth = isActive ? 2.5 : 1.5;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();

                // Weight label at midpoint.
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                ctx.fillStyle = isActive ? ACCENT : TEXT_MUTED;
                ctx.font = '11px "Space Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(e.weight, mx, my - 6);
            });

            // Pending edge preview: dashed line from edgeSource to cursor is skipped
            // for simplicity — the source node's ring (below) is sufficient feedback.

            // Nodes.
            nodes.forEach((n) => {
                const isVisited = visited.has(n.id);
                const isSource = n.id === edgeSourceId;

                ctx.beginPath();
                ctx.arc(n.x, n.y, NODE_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = isVisited ? ACCENT : NODE_IDLE_FILL;
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = isVisited ? ACCENT : NODE_IDLE_STROKE;
                ctx.stroke();

                // Start-node ring.
                if (n.id === startNodeId) {
                    ctx.beginPath();
                    ctx.setLineDash([3, 3]);
                    ctx.arc(n.x, n.y, NODE_RADIUS + 5, 0, Math.PI * 2);
                    ctx.strokeStyle = TEXT_PRIMARY;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Pending-edge-source ring (distinct from start ring).
                if (isSource) {
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, NODE_RADIUS + 5, 0, Math.PI * 2);
                    ctx.strokeStyle = ACCENT;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                ctx.fillStyle = isVisited ? '#0A0A0C' : TEXT_PRIMARY;
                ctx.font = 'bold 11px "Space Mono", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(n.id, n.x, n.y);
            });
        }

        function setStatus(msg) {
            statusEl.textContent = msg;
        }

        // ---------- Pointer interaction ----------
        // click = add node · drag existing node = move · shift+click two nodes = edge
        // double-click node = set start
        let pointerDownPos = null;
        let didDrag = false;

        canvas.addEventListener('pointerdown', (e) => {
            const { x, y } = toCanvasPoint(e);
            const hit = findNodeAt(x, y);
            pointerDownPos = { x, y };
            didDrag = false;

            if (hit) {
                draggingId = hit.id;
                dragOffsetX = x - hit.x;
                dragOffsetY = y - hit.y;
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            if (draggingId === null) return;
            const { x, y } = toCanvasPoint(e);
            if (Math.hypot(x - pointerDownPos.x, y - pointerDownPos.y) > 3) didDrag = true;

            const node = nodes.find((n) => n.id === draggingId);
            if (node) {
                node.x = x - dragOffsetX;
                node.y = y - dragOffsetY;
                render();
            }
        });

        canvas.addEventListener('pointerup', (e) => {
            const { x, y } = toCanvasPoint(e);
            const hit = findNodeAt(x, y);

            // A drag that actually moved the node ends here — don't also treat it as a click.
            if (didDrag) {
                draggingId = null;
                return;
            }
            draggingId = null;

            if (hit && e.shiftKey) {
                handleShiftClick(hit);
            } else if (hit && !e.shiftKey) {
                // Clicked an existing node without shift and without dragging — no-op,
                // reserved for potential future selection behavior.
            } else if (!hit) {
                addNode(x, y);
            }
            render();
        });

        canvas.addEventListener('dblclick', (e) => {
            const { x, y } = toCanvasPoint(e);
            const hit = findNodeAt(x, y);
            if (hit) {
                startNodeId = hit.id;
                setStatus(`Start node set to [${hit.id}]. Choose an algorithm to run.`);
                render();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && edgeSourceId !== null) {
                edgeSourceId = null;
                setStatus('Edge selection cancelled.');
                render();
            }
        });

        function toCanvasPoint(e) {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        function addNode(x, y) {
            const id = nextId++;
            nodes.push({ id, x, y });
            if (startNodeId === null) startNodeId = id; // first node defaults to start
            setStatus(`Node [${id}] added. Shift-click two nodes to connect them.`);
        }

        function handleShiftClick(node) {
            if (edgeSourceId === null) {
                edgeSourceId = node.id;
                setStatus(`Node [${node.id}] selected. Shift-click another node to connect, or Esc to cancel.`);
                return;
            }
            if (edgeSourceId === node.id) {
                edgeSourceId = null; // clicked the same node twice — cancel
                setStatus('Edge selection cancelled.');
                return;
            }

            const exists = edges.some((e) => edgeKey(e.a, e.b) === edgeKey(edgeSourceId, node.id));
            if (!exists) {
                const weight = Math.floor(Math.random() * 9) + 1; // 1–9, used by Dijkstra/Kruskal
                edges.push({ a: edgeSourceId, b: node.id, weight });
                setStatus(`Edge [${edgeSourceId}]–[${node.id}] added (weight ${weight}).`);
            } else {
                setStatus('That edge already exists.');
            }
            edgeSourceId = null;
        }

        // ---------- Animation engine ----------
        // Steps run on a simple interval so a new algorithm run can cleanly
        // cancel a previous one still mid-animation.
        function playSteps(steps, onDone) {
            clearInterval(animationTimer);
            visited = new Set();
            activeEdges = new Set();
            let i = 0;

            animationTimer = setInterval(() => {
                if (i >= steps.length) {
                    clearInterval(animationTimer);
                    if (onDone) onDone();
                    return;
                }
                steps[i](); // each step mutates `visited` / `activeEdges` and sets status
                render();
                i++;
            }, 550);
        }

        function requireGraph(minNodes = 2) {
            if (nodes.length < minNodes) {
                setStatus(`Add at least ${minNodes} nodes first.`);
                return false;
            }
            return true;
        }

        // ---------- BFS ----------
        function runBFS() {
            if (!requireGraph()) return;
            const start = startNodeId ?? nodes[0].id;
            const seen = new Set([start]);
            const queue = [start];
            const steps = [];

            steps.push(() => { visited.add(start); setStatus(`BFS start: [${start}]`); });

            while (queue.length) {
                const current = queue.shift();
                neighborsOf(current)
                    .filter((nb) => !seen.has(nb.id))
                    .forEach((nb) => {
                        seen.add(nb.id);
                        queue.push(nb.id);
                        steps.push(() => {
                            activeEdges.add(edgeKey(current, nb.id));
                            visited.add(nb.id);
                            setStatus(`BFS visiting [${nb.id}] from [${current}]`);
                        });
                    });
            }

            playSteps(steps, () => setStatus(`BFS complete — ${seen.size}/${nodes.length} nodes reachable from [${start}].`));
        }

        // ---------- Dijkstra ----------
        function runDijkstra() {
            if (!requireGraph()) return;
            const start = startNodeId ?? nodes[0].id;
            const dist = new Map(nodes.map((n) => [n.id, Infinity]));
            const prevEdge = new Map(); // nodeId -> the edgeKey that finalized it
            const finalized = new Set();
            dist.set(start, 0);

            const steps = [];
            steps.push(() => { visited.add(start); setStatus(`Dijkstra start: [${start}] (distance 0)`); });

            // O(n^2) selection — plenty fast for a teaching-scale graph.
            while (finalized.size < nodes.length) {
                let currentId = null;
                let currentDist = Infinity;
                dist.forEach((d, id) => {
                    if (!finalized.has(id) && d < currentDist) { currentDist = d; currentId = id; }
                });
                if (currentId === null) break; // remaining nodes are unreachable

                finalized.add(currentId);
                const edgeToHere = prevEdge.get(currentId);

                neighborsOf(currentId).forEach((nb) => {
                    const candidate = currentDist + nb.weight;
                    if (candidate < dist.get(nb.id)) {
                        dist.set(nb.id, candidate);
                        prevEdge.set(nb.id, edgeKey(currentId, nb.id));
                    }
                });

                if (currentId !== start) {
                    steps.push(() => {
                        visited.add(currentId);
                        if (edgeToHere) activeEdges.add(edgeToHere);
                        setStatus(`Dijkstra finalized [${currentId}] — shortest distance ${currentDist}`);
                    });
                }
            }

            playSteps(steps, () => setStatus(`Dijkstra complete from [${start}]. Distances shown via visit order.`));
        }

        // ---------- Kruskal's MST ----------
        function runMST() {
            if (!requireGraph()) return;
            if (!edges.length) { setStatus('Add some edges before finding an MST.'); return; }

            const parent = new Map(nodes.map((n) => [n.id, n.id]));
            function find(id) {
                while (parent.get(id) !== id) id = parent.get(id);
                return id;
            }
            function union(a, b) {
                parent.set(find(a), find(b));
            }

            const sorted = [...edges].sort((e1, e2) => e1.weight - e2.weight);
            const steps = [];
            let totalWeight = 0;
            let edgesUsed = 0;

            sorted.forEach((e) => {
                const rootA = find(e.a);
                const rootB = find(e.b);
                if (rootA !== rootB) {
                    union(rootA, rootB);
                    totalWeight += e.weight;
                    edgesUsed++;
                    const w = totalWeight; // capture for the closure
                    const used = edgesUsed;
                    steps.push(() => {
                        visited.add(e.a);
                        visited.add(e.b);
                        activeEdges.add(edgeKey(e.a, e.b));
                        setStatus(`MST: added edge [${e.a}]–[${e.b}] (weight ${e.weight}) — running total ${w}`);
                    });
                }
            });

            playSteps(steps, () => setStatus(
                edgesUsed === nodes.length - 1
                    ? `MST complete — ${edgesUsed} edges, total weight ${totalWeight}.`
                    : `Forest complete (graph is disconnected) — ${edgesUsed} edges, total weight ${totalWeight}.`
            ));
        }

        // ---------- Toolbar wiring ----------
        document.getElementById('lab-run-bfs')?.addEventListener('click', runBFS);
        document.getElementById('lab-run-dijkstra')?.addEventListener('click', runDijkstra);
        document.getElementById('lab-run-mst')?.addEventListener('click', runMST);
        document.getElementById('lab-clear')?.addEventListener('click', () => {
            clearInterval(animationTimer);
            nodes = [];
            edges = [];
            nextId = 1;
            startNodeId = null;
            edgeSourceId = null;
            visited = new Set();
            activeEdges = new Set();
            setStatus('Graph cleared. Click to add nodes.');
            render();
        });

        // ---------- Boot ----------
        resizeCanvas();
    }
})();