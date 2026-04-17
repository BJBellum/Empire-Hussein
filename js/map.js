(function () {
    'use strict';

    const EMPIRE_IDS = new Set([35, 38, 39, 40, 41, 42, 43, 44, 78, 169, 1152, 1194, 1195, 1198, 1199]);
    const GEOJSON_URL = 'https://map.projet-resurgence.fr/data/regions_mercator.geojson';

    const COLOR_EMPIRE        = '#c4a95b';
    const COLOR_EMPIRE_STROKE = '#e6cc7a';
    const COLOR_OTHER         = '#1a2214';
    const COLOR_OTHER_STROKE  = '#252f1e';
    const COLOR_EMPIRE_HOVER  = '#dbbf72';
    const COLOR_OTHER_HOVER   = '#243018';

    function formatPop(n) {
        if (!n || n === 0) return 'Inhabité';
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M';
        if (n >= 1e3) return Math.round(n / 1e3) + ' k';
        return String(n);
    }

    /* Flatten all coordinate rings from a geometry into [x,y] pairs */
    function* coords(geometry) {
        function* ring(r) { for (const p of r) yield p; }
        if (geometry.type === 'Polygon') {
            for (const r of geometry.coordinates) yield* ring(r);
        } else if (geometry.type === 'MultiPolygon') {
            for (const poly of geometry.coordinates)
                for (const r of poly) yield* ring(r);
        }
    }

    /* Build an SVG path string from a geometry + projection fn */
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

    /* Show info popup next to click */
    function showPopup(svg, props, isEmpire, svgX, svgY) {
        const existing = document.getElementById('map-info-popup');
        if (existing) existing.remove();

        const pop = document.createElement('div');
        pop.id = 'map-info-popup';
        pop.className = 'map-info-popup';

        const badge = isEmpire
            ? '<div class="map-popup-empire-badge">TERRITOIRE DE L\'EMPIRE HUSSEIN</div>'
            : '';
        const dotCls = isEmpire ? 'map-popup-dot--empire' : 'map-popup-dot--other';

        pop.innerHTML = `
            <button class="map-popup-close" aria-label="Fermer">✕</button>
            <div class="map-popup-header">
                <span class="map-popup-dot ${dotCls}"></span>
                <span class="map-popup-name">${props.name || '—'}</span>
            </div>
            <div class="map-popup-rows">
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

        const wrapper = svg.closest('.carte-wrapper');
        wrapper.style.position = 'relative';
        wrapper.appendChild(pop);

        /* Position popup relative to wrapper */
        const wRect = wrapper.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const scaleX = svgRect.width / vb.width;
        const scaleY = svgRect.height / vb.height;
        const absX = svgRect.left - wRect.left + svgX * scaleX;
        const absY = svgRect.top  - wRect.top  + svgY * scaleY;

        pop.style.left = Math.min(absX + 12, wRect.width - 260) + 'px';
        pop.style.top  = Math.max(absY - pop.offsetHeight / 2, 8) + 'px';

        pop.querySelector('.map-popup-close').addEventListener('click', function () {
            pop.remove();
        });
    }

    function buildMap(data) {
        const el = document.getElementById('map-empire');
        if (!el) return;

        /* Compute bounding box over all feature coordinates */
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const f of data.features) {
            if (!f.geometry) continue;
            for (const [x, y] of coords(f.geometry)) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        const VW = 1200, VH = 600;
        const geoW = maxX - minX, geoH = maxY - minY;
        const scaleX = VW / geoW, scaleY = VH / geoH;
        const scale = Math.min(scaleX, scaleY);
        const offX = (VW - geoW * scale) / 2;
        const offY = (VH - geoH * scale) / 2;

        function proj([x, y]) {
            return [
                offX + (x - minX) * scale,
                offY + (maxY - y) * scale   /* flip Y */
            ];
        }

        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
        svg.setAttribute('xmlns', NS);
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.display = 'block';

        for (const f of data.features) {
            if (!f.geometry) continue;
            const props = f.properties || {};
            const isEmpire = EMPIRE_IDS.has(props.region_id);
            if (!isEmpire) continue; /* draw other regions first in separate pass */

            /* Skip — empire drawn in second pass on top */
        }

        /* Pass 1: non-empire */
        for (const f of data.features) {
            if (!f.geometry) continue;
            const props = f.properties || {};
            if (EMPIRE_IDS.has(props.region_id)) continue;

            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', geomToPath(f.geometry, proj));
            path.setAttribute('fill', COLOR_OTHER);
            path.setAttribute('stroke', COLOR_OTHER_STROKE);
            path.setAttribute('stroke-width', '0.5');
            path.setAttribute('fill-opacity', '0.7');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            path.style.cursor = 'pointer';

            path.addEventListener('mouseenter', function () {
                path.setAttribute('fill', COLOR_OTHER_HOVER);
            });
            path.addEventListener('mouseleave', function () {
                path.setAttribute('fill', COLOR_OTHER);
            });
            path.addEventListener('click', function (e) {
                const pt = svg.createSVGPoint();
                pt.x = e.clientX; pt.y = e.clientY;
                const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
                showPopup(svg, props, false, svgPt.x, svgPt.y);
                e.stopPropagation();
            });

            svg.appendChild(path);
        }

        /* Pass 2: empire regions on top */
        for (const f of data.features) {
            if (!f.geometry) continue;
            const props = f.properties || {};
            if (!EMPIRE_IDS.has(props.region_id)) continue;

            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', geomToPath(f.geometry, proj));
            path.setAttribute('fill', COLOR_EMPIRE);
            path.setAttribute('stroke', COLOR_EMPIRE_STROKE);
            path.setAttribute('stroke-width', '1');
            path.setAttribute('fill-opacity', '0.65');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            path.style.cursor = 'pointer';

            path.addEventListener('mouseenter', function () {
                path.setAttribute('fill', COLOR_EMPIRE_HOVER);
                path.setAttribute('fill-opacity', '0.85');
            });
            path.addEventListener('mouseleave', function () {
                path.setAttribute('fill', COLOR_EMPIRE);
                path.setAttribute('fill-opacity', '0.65');
            });
            path.addEventListener('click', function (e) {
                const pt = svg.createSVGPoint();
                pt.x = e.clientX; pt.y = e.clientY;
                const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
                showPopup(svg, props, true, svgPt.x, svgPt.y);
                e.stopPropagation();
            });

            svg.appendChild(path);
        }

        el.appendChild(svg);

        /* Click outside closes popup */
        svg.addEventListener('click', function () {
            const pop = document.getElementById('map-info-popup');
            if (pop) pop.remove();
        });
    }

    function initMap() {
        const el = document.getElementById('map-empire');
        if (!el) return;

        el.innerHTML = '<div class="map-loading">Chargement de la carte…</div>';

        fetch(GEOJSON_URL)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                el.innerHTML = '';
                buildMap(data);
            })
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
