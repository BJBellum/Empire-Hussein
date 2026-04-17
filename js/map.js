(function () {
    'use strict';

    const EMPIRE_IDS = new Set([35, 38, 39, 40, 41, 42, 43, 44, 78, 169, 1152, 1194, 1195, 1198, 1199]);
    const GEOJSON_URL = 'assets/regions_mercator.geojson';

    const COLOR_EMPIRE        = '#c4a95b';
    const COLOR_EMPIRE_STROKE = '#e6cc7a';
    const COLOR_EMPIRE_HOVER  = '#dbbf72';
    const COLOR_OTHER         = '#33251a';
    const COLOR_OTHER_STROKE  = '#4a3828';
    const COLOR_OTHER_HOVER   = '#4a3020';

    const ZOOM_MIN = 1, ZOOM_MAX = 20, ZOOM_STEP = 1.25;

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

    function showPopup(wrapper, props, isEmpire, clientX, clientY) {
        const existing = document.getElementById('map-info-popup');
        if (existing) existing.remove();

        const pop = document.createElement('div');
        pop.id = 'map-info-popup';
        pop.className = 'map-info-popup';

        const dotCls = isEmpire ? 'map-popup-dot--empire' : 'map-popup-dot--other';

        const countryRow = (!isEmpire && props.country_name)
            ? `<div class="map-popup-row">
                   <span class="map-popup-label">Pays</span>
                   <span class="map-popup-value">${props.country_name}</span>
               </div>`
            : '';

        const badge = isEmpire
            ? '<div class="map-popup-empire-badge">TERRITOIRE DE L\'EMPIRE HUSSEIN</div>'
            : '';

        pop.innerHTML = `
            <button class="map-popup-close" aria-label="Fermer">✕</button>
            <div class="map-popup-header">
                <span class="map-popup-dot ${dotCls}"></span>
                <span class="map-popup-name">${props.name || '—'}</span>
            </div>
            <div class="map-popup-rows">
                ${countryRow}
                <div class="map-popup-row">
                    <span class="map-popup-label">Région géo.</span>
                    <span class="map-popup-value">${props.geographical_area || '—'}</span>
                </div>
                <div class="map-popup-row">
                    <span class="map-popup-label">Continent</span>
                    <span class="map-popup-value">${props.continent || '—'}</span>
                </div>
                <div class="map-popup-row">
                    <span class="map-popup-label">Climat</span>
                    <span class="map-popup-value">${props.climate || '—'}</span>
                </div>
                <div class="map-popup-row">
                    <span class="map-popup-label">Population</span>
                    <span class="map-popup-value">${formatPop(props.population)}</span>
                </div>
            </div>
            ${badge}`;

        wrapper.appendChild(pop);

        const wRect = wrapper.getBoundingClientRect();
        const rawX = clientX - wRect.left;
        const rawY = clientY - wRect.top;

        /* Force layout to get real dimensions */
        const pw = pop.offsetWidth  || 240;
        const ph = pop.offsetHeight || 160;

        let left = rawX + 14;
        let top  = rawY - ph / 2;
        if (left + pw > wRect.width  - 8) left = rawX - pw - 14;
        if (top < 8)                       top  = 8;
        if (top + ph > wRect.height - 8)   top  = wRect.height - ph - 8;

        pop.style.left = left + 'px';
        pop.style.top  = top  + 'px';

        pop.querySelector('.map-popup-close').addEventListener('click', function (e) {
            e.stopPropagation();
            pop.remove();
        });
    }

    /* ── Pan/zoom state ─────────────────────────────── */
    function addPanZoom(svg, VW, VH) {
        let vx = 0, vy = 0, vw = VW, vh = VH;

        function setVB() {
            svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
        }

        /* Zoom centred on SVG-coordinate point (cx, cy) */
        function zoomAt(cx, cy, factor) {
            const nw = Math.min(Math.max(vw * factor, VW / ZOOM_MAX), VW / ZOOM_MIN);
            const nh = Math.min(Math.max(vh * factor, VH / ZOOM_MAX), VH / ZOOM_MIN);
            /* Keep cx/cy fixed */
            vx = cx - (cx - vx) * (nw / vw);
            vy = cy - (cy - vy) * (nh / vh);
            vw = nw; vh = nh;
            /* Clamp to world bounds */
            vx = Math.max(0, Math.min(vx, VW - vw));
            vy = Math.max(0, Math.min(vy, VH - vh));
            setVB();
        }

        /* Convert client coords → SVG coords */
        function clientToSVG(cx, cy) {
            const r = svg.getBoundingClientRect();
            return [
                vx + (cx - r.left) / r.width  * vw,
                vy + (cy - r.top)  / r.height * vh
            ];
        }

        /* Wheel zoom */
        svg.addEventListener('wheel', function (e) {
            e.preventDefault();
            const [cx, cy] = clientToSVG(e.clientX, e.clientY);
            const factor = e.deltaY < 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
            zoomAt(cx, cy, factor);
        }, { passive: false });

        /* Drag pan */
        let dragging = false, lastX = 0, lastY = 0, moved = false;

        svg.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            dragging = true; moved = false;
            lastX = e.clientX; lastY = e.clientY;
            svg.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
            const r = svg.getBoundingClientRect();
            vx -= dx / r.width  * vw;
            vy -= dy / r.height * vh;
            vx = Math.max(0, Math.min(vx, VW - vw));
            vy = Math.max(0, Math.min(vy, VH - vh));
            lastX = e.clientX; lastY = e.clientY;
            setVB();
        });

        window.addEventListener('mouseup', function () {
            dragging = false;
            svg.style.cursor = '';
        });

        /* Touch pinch + pan */
        let touches = [];
        svg.addEventListener('touchstart', function (e) {
            touches = Array.from(e.touches);
        }, { passive: true });

        svg.addEventListener('touchmove', function (e) {
            e.preventDefault();
            const t = Array.from(e.touches);
            if (t.length === 1 && touches.length === 1) {
                const dx = t[0].clientX - touches[0].clientX;
                const dy = t[0].clientY - touches[0].clientY;
                const r = svg.getBoundingClientRect();
                vx -= dx / r.width  * vw;
                vy -= dy / r.height * vh;
                vx = Math.max(0, Math.min(vx, VW - vw));
                vy = Math.max(0, Math.min(vy, VH - vh));
                setVB();
            } else if (t.length === 2 && touches.length === 2) {
                const prevDist = Math.hypot(
                    touches[0].clientX - touches[1].clientX,
                    touches[0].clientY - touches[1].clientY);
                const newDist  = Math.hypot(
                    t[0].clientX - t[1].clientX,
                    t[0].clientY - t[1].clientY);
                if (prevDist > 0) {
                    const mx = (t[0].clientX + t[1].clientX) / 2;
                    const my = (t[0].clientY + t[1].clientY) / 2;
                    const [cx, cy] = clientToSVG(mx, my);
                    zoomAt(cx, cy, prevDist / newDist);
                }
            }
            touches = t;
        }, { passive: false });

        /* Zoom buttons */
        const btnIn  = document.getElementById('map-zoom-in');
        const btnOut = document.getElementById('map-zoom-out');
        const btnRst = document.getElementById('map-zoom-reset');
        if (btnIn)  btnIn.addEventListener('click',  function () { zoomAt(vx + vw/2, vy + vh/2, 1/ZOOM_STEP); });
        if (btnOut) btnOut.addEventListener('click',  function () { zoomAt(vx + vw/2, vy + vh/2, ZOOM_STEP);  });
        if (btnRst) btnRst.addEventListener('click',  function () { vx=0; vy=0; vw=VW; vh=VH; setVB(); });

        return { isMoved: function () { return moved; }, resetMoved: function () { moved = false; } };
    }

    function buildMap(data) {
        const el = document.getElementById('map-empire');
        if (!el) return;

        /* Bounding box */
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const f of data.features) {
            if (!f.geometry) continue;
            for (const [x, y] of coords(f.geometry)) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }

        const VW = 1200, VH = 600;
        const geoW = maxX - minX, geoH = maxY - minY;
        const scale = Math.min(VW / geoW, VH / geoH);
        const offX = (VW - geoW * scale) / 2;
        const offY = (VH - geoH * scale) / 2;

        function proj([x, y]) {
            return [offX + (x - minX) * scale, offY + (maxY - y) * scale];
        }

        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
        svg.setAttribute('xmlns', NS);
        svg.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;';

        const wrapper = el.closest('.carte-wrapper');

        const panZoom = addPanZoom(svg, VW, VH);

        function addRegion(f, isEmpire) {
            if (!f.geometry) return;
            const props = f.properties || {};
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', geomToPath(f.geometry, proj));
            path.setAttribute('fill',         isEmpire ? COLOR_EMPIRE : COLOR_OTHER);
            path.setAttribute('stroke',       isEmpire ? COLOR_EMPIRE_STROKE : COLOR_OTHER_STROKE);
            path.setAttribute('stroke-width', isEmpire ? '1' : '0.5');
            path.setAttribute('fill-opacity', isEmpire ? '0.65' : '0.85');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            path.style.cursor = 'pointer';

            path.addEventListener('mouseenter', function () {
                path.setAttribute('fill', isEmpire ? COLOR_EMPIRE_HOVER : COLOR_OTHER_HOVER);
                if (isEmpire) path.setAttribute('fill-opacity', '0.85');
            });
            path.addEventListener('mouseleave', function () {
                path.setAttribute('fill', isEmpire ? COLOR_EMPIRE : COLOR_OTHER);
                if (isEmpire) path.setAttribute('fill-opacity', '0.65');
            });
            path.addEventListener('click', function (e) {
                if (panZoom.isMoved()) { panZoom.resetMoved(); return; }
                e.stopPropagation();
                showPopup(wrapper, props, isEmpire, e.clientX, e.clientY);
            });

            svg.appendChild(path);
        }

        /* Pass 1: others */
        for (const f of data.features) {
            if (!EMPIRE_IDS.has((f.properties || {}).region_id)) addRegion(f, false);
        }
        /* Pass 2: empire on top */
        for (const f of data.features) {
            if (EMPIRE_IDS.has((f.properties || {}).region_id)) addRegion(f, true);
        }

        el.appendChild(svg);

        /* Click on map background closes popup */
        svg.addEventListener('click', function () {
            if (panZoom.isMoved()) { panZoom.resetMoved(); return; }
            const pop = document.getElementById('map-info-popup');
            if (pop) pop.remove();
        });
    }

    function initMap() {
        const el = document.getElementById('map-empire');
        if (!el) return;
        el.innerHTML = '<div class="map-loading">Chargement de la carte…</div>';

        fetch(GEOJSON_URL)
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) { el.innerHTML = ''; buildMap(data); })
            .catch(function (err) {
                console.error('Carte: GeoJSON load failed', err);
                el.innerHTML = '<div class="map-loading map-loading--error">Impossible de charger les données cartographiques.</div>';
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
    } else {
        initMap();
    }
}());
