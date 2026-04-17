(function (global) {
    'use strict';

    function formatPop(n) {
        if (!n || n === 0) return 'Inhabité';
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M';
        if (n >= 1e3) return Math.round(n / 1e3) + ' k';
        return String(n);
    }

    function* coordsGen(geometry) {
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

    function calcProjection(geoData) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const f of geoData.features) {
            if (!f.geometry) continue;
            for (const [x, y] of coordsGen(f.geometry)) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
        const VW = 1200, VH = 600;
        const scale = Math.min(VW / (maxX - minX), VH / (maxY - minY));
        const offX = (VW - (maxX - minX) * scale) / 2;
        const offY = (VH - (maxY - minY) * scale) / 2;
        function proj([x, y]) { return [offX + (x - minX) * scale, offY + (maxY - y) * scale]; }
        return { proj, VW, VH };
    }

    function addPanZoom(svg, VW, VH, prefix) {
        const ZOOM_MIN = 1, ZOOM_MAX = 20, ZOOM_STEP = 1.25;
        let vx = 0, vy = 0, vw = VW, vh = VH;
        function setVB() { svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`); }
        function zoomAt(cx, cy, factor) {
            const nw = Math.min(Math.max(vw * factor, VW / ZOOM_MAX), VW / ZOOM_MIN);
            const nh = Math.min(Math.max(vh * factor, VH / ZOOM_MAX), VH / ZOOM_MIN);
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
        svg.addEventListener('mousedown', function (e) {
            if (e.button) return;
            drag = true; moved = false; lx = e.clientX; ly = e.clientY;
            svg.style.cursor = 'grabbing';
        });
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
        let touches = [];
        svg.addEventListener('touchstart', function (e) { touches = Array.from(e.touches); }, { passive: true });
        svg.addEventListener('touchmove', function (e) {
            e.preventDefault();
            const t = Array.from(e.touches);
            if (t.length === 1 && touches.length === 1) {
                const dx = t[0].clientX - touches[0].clientX;
                const dy = t[0].clientY - touches[0].clientY;
                const r = svg.getBoundingClientRect();
                vx -= dx / r.width * vw; vy -= dy / r.height * vh;
                vx = Math.max(0, Math.min(vx, VW - vw));
                vy = Math.max(0, Math.min(vy, VH - vh));
                setVB();
            } else if (t.length === 2 && touches.length === 2) {
                const pd = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
                const nd = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
                if (pd > 0) {
                    const [cx, cy] = c2s((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
                    zoomAt(cx, cy, pd / nd);
                }
            }
            touches = t;
        }, { passive: false });
        if (prefix) {
            const btnIn  = document.getElementById(prefix + '-zoom-in');
            const btnOut = document.getElementById(prefix + '-zoom-out');
            const btnRst = document.getElementById(prefix + '-zoom-reset');
            if (btnIn)  btnIn.addEventListener('click',  function () { zoomAt(vx + vw / 2, vy + vh / 2, 1 / ZOOM_STEP); });
            if (btnOut) btnOut.addEventListener('click',  function () { zoomAt(vx + vw / 2, vy + vh / 2, ZOOM_STEP); });
            if (btnRst) btnRst.addEventListener('click',  function () { vx = 0; vy = 0; vw = VW; vh = VH; setVB(); });
        }
        return {
            isMoved: function () { return moved; },
            resetMoved: function () { moved = false; }
        };
    }

    function showPopup(wrapper, content, clientX, clientY, popupId) {
        const existing = document.getElementById(popupId);
        if (existing) existing.remove();
        const pop = document.createElement('div');
        pop.id = popupId;
        pop.className = 'map-info-popup';
        pop.innerHTML = content;
        wrapper.appendChild(pop);
        const wRect = wrapper.getBoundingClientRect();
        const rawX = clientX - wRect.left;
        const rawY = clientY - wRect.top;
        const pw = pop.offsetWidth  || 240;
        const ph = pop.offsetHeight || 160;
        let left = rawX + 14;
        let top  = rawY - ph / 2;
        if (left + pw > wRect.width  - 8) left = rawX - pw - 14;
        if (top < 8)                       top  = 8;
        if (top + ph > wRect.height - 8)   top  = wRect.height - ph - 8;
        pop.style.left = left + 'px';
        pop.style.top  = top  + 'px';
        const closeBtn = pop.querySelector('.map-popup-close');
        if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); pop.remove(); });
        return pop;
    }

    /*
     * build(config)
     * config: { mapEl, wrapperEl, geoData, empireIds, mode, modeData,
     *           zoomPrefix, pathPrefix, onLeftClick, onRightClick }
     * Returns: { svg, pathMap, panZoom }
     */
    function build(config) {
        const { mapEl, wrapperEl, geoData, empireIds, mode, modeData,
                zoomPrefix, pathPrefix = '', onLeftClick = null, onRightClick = null } = config;
        if (!mapEl || !geoData) return null;

        const { proj, VW, VH } = calcProjection(geoData);
        const NS  = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
        svg.setAttribute('xmlns', NS);
        svg.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;';

        const panZoom  = addPanZoom(svg, VW, VH, zoomPrefix);
        const pathMap  = new Map();
        const popupId  = zoomPrefix + '-popup';

        function addFeature(f) {
            if (!f.geometry) return;
            const props = f.properties || {};
            const style = mode.getStyle(props, empireIds, modeData, geoData);

            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d',             geomToPath(f.geometry, proj));
            path.setAttribute('fill',          style.fill);
            path.setAttribute('stroke',        style.stroke);
            path.setAttribute('stroke-width',  style.strokeWidth);
            path.setAttribute('fill-opacity',  style.opacity);
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            path.style.cursor = 'pointer';

            if (props.region_id !== undefined) pathMap.set(props.region_id, path);

            path.addEventListener('mouseenter', function () {
                const hover = mode.getHoverFill(props, empireIds, modeData);
                path.setAttribute('fill', hover.fill);
                if (hover.opacity) path.setAttribute('fill-opacity', hover.opacity);
            });
            path.addEventListener('mouseleave', function () {
                const s = mode.getStyle(props, empireIds, modeData, geoData);
                path.setAttribute('fill', s.fill);
                path.setAttribute('fill-opacity', s.opacity);
            });
            path.addEventListener('click', function (e) {
                if (panZoom.isMoved()) { panZoom.resetMoved(); return; }
                e.stopPropagation();
                if (onLeftClick) {
                    onLeftClick(f, path, svg, panZoom);
                } else {
                    const content = mode.buildPopupContent(props, empireIds, modeData, geoData, pathPrefix);
                    showPopup(wrapperEl, content, e.clientX, e.clientY, popupId);
                }
            });
            path.addEventListener('contextmenu', function (e) {
                e.preventDefault(); e.stopPropagation();
                if (onRightClick) onRightClick(f, path, svg, panZoom);
            });

            svg.appendChild(path);
        }

        for (const f of geoData.features) {
            if (!empireIds.has((f.properties || {}).region_id)) addFeature(f);
        }
        for (const f of geoData.features) {
            if  (empireIds.has((f.properties || {}).region_id)) addFeature(f);
        }

        mapEl.appendChild(svg);
        svg.addEventListener('click', function () {
            if (panZoom.isMoved()) { panZoom.resetMoved(); return; }
            const pop = document.getElementById(popupId);
            if (pop) pop.remove();
        });
        svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });

        return { svg, pathMap, panZoom };
    }

    global.MapEngine = { build, formatPop, showPopup };
})(window);
