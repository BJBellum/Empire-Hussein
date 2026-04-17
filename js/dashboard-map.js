(function () {
    'use strict';

    const GEOJSON_URL  = 'https://api.projet-resurgence.fr/geojson/regions?projection=mercator';
    const REGIONS_PATH = 'data/empire-regions.json';
    const REGIONS_SHA_KEY = 'empire_regions_sha';
    const FALLBACK_IDS = [35, 38, 39, 40, 41, 42, 43, 44, 78, 169, 1152, 1194, 1195, 1198, 1199];

    const COLOR_EMPIRE        = '#c4a95b';
    const COLOR_EMPIRE_STROKE = '#e6cc7a';
    const COLOR_EMPIRE_HOVER  = '#dbbf72';
    const COLOR_OTHER         = '#33251a';
    const COLOR_OTHER_STROKE  = '#4a3828';
    const COLOR_OTHER_HOVER   = '#4a3020';
    const ZOOM_MIN = 1, ZOOM_MAX = 20, ZOOM_STEP = 1.25;

    let _geoData    = null;
    let _empireIds  = new Set();
    let _savedIds   = new Set();
    let _pathMap    = new Map(); /* region_id → SVG path element */
    let _mapBuilt   = false;

    /* ── Utilities ──────────────────────────────── */
    function formatPop(n) {
        if (!n || n === 0) return 'Inhabité';
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M';
        if (n >= 1e3) return Math.round(n / 1e3) + ' k';
        return String(n);
    }

    function* coords(geometry) {
        function* ring(r) { for (const p of r) yield p; }
        if (geometry.type === 'Polygon') {
            for (const r of geometry.coordinates) yield* ring(r);
        } else if (geometry.type === 'MultiPolygon') {
            for (const poly of geometry.coordinates)
                for (const r of poly) yield* ring(r);
        }
    }

    function geomToPath(geometry, proj) {
        const parts = [];
        function ringPath(ring) {
            let d = '';
            for (let i = 0; i < ring.length; i++) {
                const [px, py] = proj(ring[i]);
                d += (i === 0 ? 'M' : 'L') + px.toFixed(2) + ' ' + py.toFixed(2);
            }
            return d + 'Z';
        }
        if (geometry.type === 'Polygon') {
            for (const r of geometry.coordinates) parts.push(ringPath(r));
        } else if (geometry.type === 'MultiPolygon') {
            for (const poly of geometry.coordinates)
                for (const r of poly) parts.push(ringPath(r));
        }
        return parts.join(' ');
    }

    function getGH() {
        try { return JSON.parse(localStorage.getItem('empire_github_config') || 'null'); } catch { return null; }
    }

    function showCartoStatus(msg, type) {
        const el = document.getElementById('carto-push-status');
        if (!el) return;
        el.style.display = 'flex';
        el.className = 'github-status github-status--' + (type || 'info');
        el.textContent = msg;
    }

    /* ── UI state ───────────────────────────────── */
    function updateUI() {
        const countEl   = document.getElementById('carto-count');
        const pushBtn   = document.getElementById('carto-btn-push');
        const indicator = document.getElementById('carto-unsaved-indicator');
        if (!countEl) return;

        const dirty = !setsEqual(_empireIds, _savedIds);
        countEl.textContent = _empireIds.size;
        if (pushBtn) pushBtn.disabled = !dirty;
        if (indicator) indicator.style.display = dirty ? 'flex' : 'none';
    }

    function setsEqual(a, b) {
        if (a.size !== b.size) return false;
        for (const v of a) if (!b.has(v)) return false;
        return true;
    }

    /* ── Region styling ─────────────────────────── */
    function applyStyle(path, isEmpire) {
        path.setAttribute('fill',         isEmpire ? COLOR_EMPIRE : COLOR_OTHER);
        path.setAttribute('stroke',       isEmpire ? COLOR_EMPIRE_STROKE : COLOR_OTHER_STROKE);
        path.setAttribute('stroke-width', isEmpire ? '1' : '0.5');
        path.setAttribute('fill-opacity', isEmpire ? '0.65' : '0.85');
    }

    /* ── Popup ──────────────────────────────────── */
    function showPopup(wrapper, props, isEmpire, clientX, clientY) {
        const existing = document.getElementById('carto-popup');
        if (existing) existing.remove();

        const pop = document.createElement('div');
        pop.id = 'carto-popup';
        pop.className = 'map-info-popup';

        const dotCls = isEmpire ? 'map-popup-dot--empire' : 'map-popup-dot--other';
        const countryRow = (!isEmpire && props.country_name)
            ? `<div class="map-popup-row"><span class="map-popup-label">Pays</span><span class="map-popup-value">${props.country_name}</span></div>`
            : '';
        const action = isEmpire
            ? '<div class="map-popup-empire-badge map-popup-action--remove">Clic droit pour retirer du territoire</div>'
            : '<div class="map-popup-action--add">Clic gauche pour annexer à l\'Empire</div>';

        pop.innerHTML = `
            <button class="map-popup-close" aria-label="Fermer">✕</button>
            <div class="map-popup-header">
                <span class="map-popup-dot ${dotCls}"></span>
                <span class="map-popup-name">${props.name || '—'}</span>
            </div>
            <div class="map-popup-rows">
                ${countryRow}
                <div class="map-popup-row"><span class="map-popup-label">Région géo.</span><span class="map-popup-value">${props.geographical_area || '—'}</span></div>
                <div class="map-popup-row"><span class="map-popup-label">Continent</span><span class="map-popup-value">${props.continent || '—'}</span></div>
                <div class="map-popup-row"><span class="map-popup-label">Climat</span><span class="map-popup-value">${props.climate || '—'}</span></div>
                <div class="map-popup-row"><span class="map-popup-label">Population</span><span class="map-popup-value">${formatPop(props.population)}</span></div>
            </div>
            ${action}`;

        wrapper.appendChild(pop);

        const wRect = wrapper.getBoundingClientRect();
        const rawX  = clientX - wRect.left;
        const rawY  = clientY - wRect.top;
        const pw    = pop.offsetWidth  || 240;
        const ph    = pop.offsetHeight || 160;
        let left = rawX + 14;
        let top  = rawY - ph / 2;
        if (left + pw > wRect.width  - 8) left = rawX - pw - 14;
        if (top < 8)                       top  = 8;
        if (top + ph > wRect.height - 8)   top  = wRect.height - ph - 8;
        pop.style.left = left + 'px';
        pop.style.top  = top  + 'px';

        pop.querySelector('.map-popup-close').addEventListener('click', function (e) {
            e.stopPropagation(); pop.remove();
        });
    }

    /* ── Pan/zoom ───────────────────────────────── */
    function addPanZoom(svg, VW, VH, prefix) {
        let vx = 0, vy = 0, vw = VW, vh = VH;
        function setVB() { svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`); }
        function zoomAt(cx, cy, f) {
            const nw = Math.min(Math.max(vw * f, VW / ZOOM_MAX), VW / ZOOM_MIN);
            const nh = Math.min(Math.max(vh * f, VH / ZOOM_MAX), VH / ZOOM_MIN);
            vx = cx - (cx - vx) * (nw / vw);
            vy = cy - (cy - vy) * (nh / vh);
            vw = nw; vh = nh;
            vx = Math.max(0, Math.min(vx, VW - vw));
            vy = Math.max(0, Math.min(vy, VH - vh));
            setVB();
        }
        function c2s(cx, cy) {
            const r = svg.getBoundingClientRect();
            return [vx + (cx - r.left) / r.width * vw, vy + (cy - r.top) / r.height * vh];
        }
        svg.addEventListener('wheel', function (e) {
            e.preventDefault();
            const [cx, cy] = c2s(e.clientX, e.clientY);
            zoomAt(cx, cy, e.deltaY < 0 ? 1 / ZOOM_STEP : ZOOM_STEP);
        }, { passive: false });

        let drag = false, lx = 0, ly = 0, moved = false;
        svg.addEventListener('mousedown', function (e) { if (e.button) return; drag = true; moved = false; lx = e.clientX; ly = e.clientY; svg.style.cursor = 'grabbing'; });
        window.addEventListener('mousemove', function (e) {
            if (!drag) return;
            const dx = e.clientX - lx, dy = e.clientY - ly;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
            const r = svg.getBoundingClientRect();
            vx -= dx / r.width * vw; vy -= dy / r.height * vh;
            vx = Math.max(0, Math.min(vx, VW - vw));
            vy = Math.max(0, Math.min(vy, VH - vh));
            lx = e.clientX; ly = e.clientY; setVB();
        });
        window.addEventListener('mouseup', function () { drag = false; svg.style.cursor = ''; });

        const btnIn  = document.getElementById(prefix + '-zoom-in');
        const btnOut = document.getElementById(prefix + '-zoom-out');
        const btnRst = document.getElementById(prefix + '-zoom-reset');
        if (btnIn)  btnIn.addEventListener('click',  function () { zoomAt(vx + vw/2, vy + vh/2, 1/ZOOM_STEP); });
        if (btnOut) btnOut.addEventListener('click',  function () { zoomAt(vx + vw/2, vy + vh/2, ZOOM_STEP);  });
        if (btnRst) btnRst.addEventListener('click',  function () { vx=0; vy=0; vw=VW; vh=VH; setVB(); });

        return { isMoved: function () { return moved; }, resetMoved: function () { moved = false; } };
    }

    /* ── Build editable map ─────────────────────── */
    function buildCartoMap() {
        const el = document.getElementById('carto-map');
        if (!el || !_geoData) return;
        el.innerHTML = '';
        _pathMap.clear();

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const f of _geoData.features) {
            if (!f.geometry) continue;
            for (const [x, y] of coords(f.geometry)) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
        const VW = 1200, VH = 600;
        const scale = Math.min(VW / (maxX - minX), VH / (maxY - minY));
        const offX  = (VW - (maxX - minX) * scale) / 2;
        const offY  = (VH - (maxY - minY) * scale) / 2;
        function proj([x, y]) { return [offX + (x - minX) * scale, offY + (maxY - y) * scale]; }

        const NS  = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
        svg.setAttribute('xmlns', NS);
        svg.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;';

        const wrapper = document.getElementById('carto-map-wrapper');
        const pz      = addPanZoom(svg, VW, VH, 'carto');

        function addRegion(f) {
            if (!f.geometry) return;
            const props    = f.properties || {};
            const id       = props.region_id;
            const isEmpire = _empireIds.has(id);

            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', geomToPath(f.geometry, proj));
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            path.style.cursor = 'pointer';
            applyStyle(path, isEmpire);

            if (id !== undefined) _pathMap.set(id, path);

            path.addEventListener('mouseenter', function () {
                path.setAttribute('fill', _empireIds.has(id) ? COLOR_EMPIRE_HOVER : COLOR_OTHER_HOVER);
                if (_empireIds.has(id)) path.setAttribute('fill-opacity', '0.85');
            });
            path.addEventListener('mouseleave', function () {
                applyStyle(path, _empireIds.has(id));
            });
            path.addEventListener('click', function (e) {
                if (pz.isMoved()) { pz.resetMoved(); return; }
                e.stopPropagation();

                /* Left click: add if not empire, show info if already empire */
                if (!_empireIds.has(id)) {
                    _empireIds.add(id);
                    applyStyle(path, true);
                    svg.appendChild(path); /* move to top */
                    updateUI();
                }
                showPopup(wrapper, props, _empireIds.has(id), e.clientX, e.clientY);
            });

            path.addEventListener('contextmenu', function (e) {
                e.preventDefault();
                e.stopPropagation();

                /* Right click: remove from empire */
                if (_empireIds.has(id)) {
                    _empireIds.delete(id);
                    applyStyle(path, false);
                    updateUI();
                    showPopup(wrapper, props, false, e.clientX, e.clientY);
                }
            });

            svg.appendChild(path);
        }

        /* Pass 1: non-empire first */
        for (const f of _geoData.features) { if (!_empireIds.has((f.properties || {}).region_id)) addRegion(f); }
        /* Pass 2: empire on top */
        for (const f of _geoData.features) { if ( _empireIds.has((f.properties || {}).region_id)) addRegion(f); }

        el.appendChild(svg);
        svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        svg.addEventListener('click', function () {
            if (pz.isMoved()) { pz.resetMoved(); return; }
            const pop = document.getElementById('carto-popup');
            if (pop) pop.remove();
        });

        _mapBuilt = true;
        updateUI();
    }

    /* ── Push to GitHub ─────────────────────────── */
    async function pushRegions() {
        const cfg = getGH();
        if (!cfg || !cfg.repo || !cfg.pat) {
            showCartoStatus('Configuration GitHub requise — allez dans l\'onglet CONFIGURATION', 'error');
            return;
        }

        const pushBtn = document.getElementById('carto-btn-push');
        if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = 'Envoi…'; }

        try {
            /* Fetch latest SHA */
            let sha = localStorage.getItem(REGIONS_SHA_KEY);
            try {
                const probe = await fetch(
                    `https://api.github.com/repos/${cfg.repo}/contents/${REGIONS_PATH}?ref=${cfg.branch || 'main'}`,
                    { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
                );
                if (probe.ok) { sha = (await probe.json()).sha; localStorage.setItem(REGIONS_SHA_KEY, sha); }
            } catch {}

            const json = JSON.stringify({ region_ids: Array.from(_empireIds).sort(function(a,b){return a-b;}) }, null, 2);
            const body = {
                message: 'feat(carte): mise à jour des territoires de l\'Empire Hussein',
                content: btoa(unescape(encodeURIComponent(json))),
                branch:  cfg.branch || 'main'
            };
            if (sha) body.sha = sha;

            const res  = await fetch(
                `https://api.github.com/repos/${cfg.repo}/contents/${REGIONS_PATH}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization:  `token ${cfg.pat}`,
                        Accept:         'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Erreur push');

            /* Update saved SHA */
            if (data.content && data.content.sha) localStorage.setItem(REGIONS_SHA_KEY, data.content.sha);

            /* Sync saved state */
            _savedIds = new Set(_empireIds);
            showCartoStatus('✓ Territoires mis à jour sur GitHub (' + _empireIds.size + ' régions)', 'success');
            updateUI();

        } catch (err) {
            showCartoStatus('Erreur : ' + err.message, 'error');
        } finally {
            const btn = document.getElementById('carto-btn-push');
            if (btn) {
                btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 12V4M4 8l4-4 4 4" stroke-linecap="round" stroke-linejoin="round"/></svg> Pousser sur GitHub';
            }
        }
    }

    /* ── Init panel ─────────────────────────────── */
    function initCartoPanel() {
        const el = document.getElementById('carto-map');
        if (!el) return;

        el.innerHTML = '<div class="map-loading">Chargement de la carte…</div>';

        Promise.all([
            _geoData
                ? Promise.resolve(_geoData)
                : fetch(GEOJSON_URL).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        ]).then(function (results) {
            _geoData = results[0];

            _empireIds = new Set();
            _savedIds  = new Set();

            el.innerHTML = '';
            buildCartoMap();
        }).catch(function (err) {
            console.error('CartoPanel: load failed', err);
            el.innerHTML = '<div class="map-loading map-loading--error">Impossible de charger les données.</div>';
        });
    }

    /* ── Wire up buttons ────────────────────────── */
    function wireButtons() {
        const pushBtn  = document.getElementById('carto-btn-push');
        const resetBtn = document.getElementById('carto-btn-reset');

        if (pushBtn) pushBtn.addEventListener('click', function () { pushRegions(); });

        if (resetBtn) resetBtn.addEventListener('click', function () {
            _empireIds = new Set(_savedIds);
            /* Re-apply styles to all paths */
            _pathMap.forEach(function (path, id) { applyStyle(path, _empireIds.has(id)); });
            updateUI();
            const pop = document.getElementById('carto-popup');
            if (pop) pop.remove();
        });
    }

    /* ── Hook into dashboard panel navigation ───── */
    function observePanelActivation() {
        /* dashboard.js activates panels by toggling .hidden class */
        const wrapper = document.getElementById('panels-wrapper');
        if (!wrapper) return;

        const observer = new MutationObserver(function () {
            const panel = document.getElementById('panel-cartographie');
            if (panel && !panel.classList.contains('hidden') && !_mapBuilt) {
                initCartoPanel();
            }
        });
        observer.observe(wrapper, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    /* Fallback: nav click direct listener */
    document.addEventListener('click', function (e) {
        const item = e.target.closest('[data-panel="cartographie"]');
        if (item && !_mapBuilt) {
            setTimeout(initCartoPanel, 50);
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        wireButtons();
        observePanelActivation();
    });

}());
