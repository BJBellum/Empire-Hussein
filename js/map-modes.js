(function (global) {
    'use strict';

    const COLOR_EMPIRE        = '#c4a95b';
    const COLOR_EMPIRE_STROKE = '#e6cc7a';
    const COLOR_EMPIRE_HOVER  = '#dbbf72';
    const COLOR_CLAIMS        = '#7A5C1E';
    const COLOR_CLAIMS_STROKE = '#5A3C0E';
    const COLOR_CLAIMS_HOVER  = '#9A7C3E';
    const COLOR_OTHER         = '#33251a';
    const COLOR_OTHER_STROKE  = '#4a3828';
    const COLOR_OTHER_HOVER   = '#4a3020';

    function adjustBrightness(hex, factor) {
        try {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgb(${Math.min(255, Math.round(r * factor))},${Math.min(255, Math.round(g * factor))},${Math.min(255, Math.round(b * factor))})`;
        } catch (e) { return hex; }
    }

    function defaultPopup(props, isEmpire) {
        const dot = isEmpire ? 'map-popup-dot--empire' : 'map-popup-dot--other';
        const countryRow = (!isEmpire && props.country_name)
            ? `<div class="map-popup-row"><span class="map-popup-label">Pays</span><span class="map-popup-value">${props.country_name}</span></div>`
            : '';
        const badge = isEmpire ? `<div class="map-popup-empire-badge">TERRITOIRE DE L'EMPIRE HUSSEIN</div>` : '';
        return `<button class="map-popup-close" aria-label="Fermer">✕</button>
            <div class="map-popup-header">
                <span class="map-popup-dot ${dot}"></span>
                <span class="map-popup-name">${props.name || '—'}</span>
            </div>
            <div class="map-popup-rows">
                ${countryRow}
                <div class="map-popup-row"><span class="map-popup-label">Région géo.</span><span class="map-popup-value">${props.geographical_area || '—'}</span></div>
                <div class="map-popup-row"><span class="map-popup-label">Continent</span><span class="map-popup-value">${props.continent || '—'}</span></div>
                <div class="map-popup-row"><span class="map-popup-label">Climat</span><span class="map-popup-value">${props.climate || '—'}</span></div>
                <div class="map-popup-row"><span class="map-popup-label">Population</span><span class="map-popup-value">${MapEngine.formatPop(props.population)}</span></div>
            </div>
            ${badge}`;
    }

    function findFederal(modeData, regionId) {
        if (!modeData || !modeData.regions) return null;
        return modeData.regions.find(r => r.member_ids.includes(regionId)) || null;
    }

    function countryActive(props, modeData, activeVal) {
        if (!props.country_id || !modeData || !modeData.countries) return false;
        return modeData.countries[props.country_id] === activeVal;
    }

    const ICON_EMPIRE     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M3 20l2.5-9 3.5 3 3-8 3 8 3.5-3L21 20"/></svg>`;
    const ICON_FEDERAL    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>`;
    const ICON_CLAIMS     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
    const ICON_DIPLOMACY  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    const ICON_ECONOMIC   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
    const ICON_SCIENTIFIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;

    const MODES = [

        /* ── 0. EMPIRE HUSSEIN (lecture seule) ────────── */
        {
            id: 'empire',
            label: 'EMPIRE HUSSEIN',
            dataFile: null,
            icon: ICON_EMPIRE,

            getStyle(props, empireIds) {
                if (empireIds.has(props.region_id))
                    return { fill: COLOR_EMPIRE, stroke: COLOR_EMPIRE_STROKE, strokeWidth: '1', opacity: '0.85' };
                return { fill: COLOR_OTHER, stroke: COLOR_OTHER_STROKE, strokeWidth: '0.5', opacity: '0.5' };
            },

            getHoverFill(props, empireIds) {
                if (empireIds.has(props.region_id)) return { fill: COLOR_EMPIRE_HOVER, opacity: '0.95' };
                return { fill: COLOR_OTHER_HOVER, opacity: '0.65' };
            },

            buildPopupContent(props, empireIds) {
                return defaultPopup(props, empireIds.has(props.region_id));
            }
        },

        /* ── 1. REGIONS FEDERALES ─────────────────────── */
        {
            id: 'federal',
            label: 'REGIONS FEDERALES',
            dataFile: 'data/federal-regions.json',
            icon: ICON_FEDERAL,

            getStyle(props, empireIds, modeData) {
                if (!empireIds.has(props.region_id)) {
                    return { fill: COLOR_OTHER, stroke: COLOR_OTHER_STROKE, strokeWidth: '0.5', opacity: '0.85' };
                }
                const fed = findFederal(modeData, props.region_id);
                if (fed) return { fill: fed.color, stroke: fed.color, strokeWidth: '0.5', opacity: '0.75' };
                return { fill: COLOR_EMPIRE, stroke: COLOR_EMPIRE_STROKE, strokeWidth: '1', opacity: '0.65' };
            },

            getHoverFill(props, empireIds, modeData) {
                if (!empireIds.has(props.region_id)) return { fill: COLOR_OTHER_HOVER, opacity: '0.85' };
                const fed = findFederal(modeData, props.region_id);
                return { fill: adjustBrightness(fed ? fed.color : COLOR_EMPIRE, 1.2), opacity: '0.9' };
            },

            buildPopupContent(props, empireIds, modeData, geoData, pathPrefix) {
                if (empireIds.has(props.region_id) && modeData) {
                    const fed = findFederal(modeData, props.region_id);
                    if (fed) {
                        const members = geoData.features
                            .filter(f => fed.member_ids.includes((f.properties || {}).region_id))
                            .map(f => f.properties || {});
                        const totalPop = members.reduce((s, p) => s + (p.population || 0), 0);
                        const climates = [...new Set(members.map(p => p.climate).filter(Boolean))];
                        const flagHtml = fed.flag_path
                            ? `<img src="${pathPrefix || ''}${fed.flag_path}" width="60" height="60" style="border-radius:4px;margin-bottom:8px;display:block;" alt="Drapeau">`
                            : '';
                        return `<button class="map-popup-close" aria-label="Fermer">✕</button>
                            ${flagHtml}
                            <div class="map-popup-header">
                                <span class="map-popup-dot" style="background:${fed.color}"></span>
                                <span class="map-popup-name">${fed.name || 'Région fédérale'}</span>
                            </div>
                            <div class="map-popup-rows">
                                <div class="map-popup-row"><span class="map-popup-label">Régions</span><span class="map-popup-value">${members.length}</span></div>
                                <div class="map-popup-row"><span class="map-popup-label">Population</span><span class="map-popup-value">${MapEngine.formatPop(totalPop)}</span></div>
                                <div class="map-popup-row"><span class="map-popup-label">Climat</span><span class="map-popup-value">${climates.join(' / ') || '—'}</span></div>
                            </div>
                            <div class="map-popup-empire-badge">TERRITOIRE DE L'EMPIRE HUSSEIN</div>`;
                    }
                }
                return defaultPopup(props, empireIds.has(props.region_id));
            }
        },

        /* ── 2. REVENDICATIONS ────────────────────────── */
        {
            id: 'claims',
            label: 'REVENDICATIONS',
            dataFile: 'data/claims.json',
            icon: ICON_CLAIMS,

            getStyle(props, empireIds, modeData) {
                const claimed = new Set((modeData || {}).region_ids || []);
                if (empireIds.has(props.region_id))
                    return { fill: COLOR_EMPIRE, stroke: COLOR_EMPIRE_STROKE, strokeWidth: '1', opacity: '0.65' };
                if (claimed.has(props.region_id))
                    return { fill: COLOR_CLAIMS, stroke: COLOR_CLAIMS_STROKE, strokeWidth: '0.75', opacity: '0.75' };
                return { fill: COLOR_OTHER, stroke: COLOR_OTHER_STROKE, strokeWidth: '0.5', opacity: '0.85' };
            },

            getHoverFill(props, empireIds, modeData) {
                const claimed = new Set((modeData || {}).region_ids || []);
                if (empireIds.has(props.region_id)) return { fill: COLOR_EMPIRE_HOVER, opacity: '0.85' };
                if (claimed.has(props.region_id))   return { fill: COLOR_CLAIMS_HOVER, opacity: '0.85' };
                return { fill: COLOR_OTHER_HOVER, opacity: '0.85' };
            },

            buildPopupContent(props, empireIds, modeData) {
                const claimed = new Set((modeData || {}).region_ids || []);
                const base = defaultPopup(props, empireIds.has(props.region_id));
                if (claimed.has(props.region_id))
                    return base + `<div class="map-popup-empire-badge" style="color:#c4893b;border-top-color:rgba(122,92,30,0.4);">TERRITOIRE REVENDIQUE</div>`;
                return base;
            }
        },

        /* ── 3. RECONNAISSANCES DIPLOMATIQUES ─────────── */
        {
            id: 'diplomacy',
            label: 'RECONNAISSANCES',
            dataFile: 'data/diplomacy.json',
            icon: ICON_DIPLOMACY,

            getStyle(props, empireIds, modeData) {
                if (empireIds.has(props.region_id))
                    return { fill: COLOR_EMPIRE, stroke: COLOR_EMPIRE_STROKE, strokeWidth: '1', opacity: '0.65' };
                const color  = props.country_color || COLOR_OTHER;
                const active = countryActive(props, modeData, 'recognized');
                return { fill: color, stroke: COLOR_OTHER_STROKE, strokeWidth: '0.5', opacity: active ? '1.0' : '0.2' };
            },

            getHoverFill(props, empireIds, modeData) {
                if (empireIds.has(props.region_id)) return { fill: COLOR_EMPIRE_HOVER, opacity: '0.85' };
                return { fill: adjustBrightness(props.country_color || COLOR_OTHER, 1.2), opacity: '1.0' };
            },

            buildPopupContent(props, empireIds, modeData) {
                if (empireIds.has(props.region_id)) return defaultPopup(props, true);
                const active = countryActive(props, modeData, 'recognized');
                return defaultPopup(props, false)
                    + `<div class="map-popup-empire-badge" style="color:${active ? '#6ab97a' : '#c06060'};border-top-color:rgba(255,255,255,0.08);">${active ? 'Reconnu' : 'Non-Reconnu'}</div>`;
            }
        },

        /* ── 4. ACCORDS ECONOMIQUES ───────────────────── */
        {
            id: 'economic',
            label: 'ACCORDS ECONOMIQUES',
            dataFile: 'data/economic-accords.json',
            icon: ICON_ECONOMIC,

            getStyle(props, empireIds, modeData) {
                if (empireIds.has(props.region_id))
                    return { fill: COLOR_EMPIRE, stroke: COLOR_EMPIRE_STROKE, strokeWidth: '1', opacity: '0.65' };
                const color  = props.country_color || COLOR_OTHER;
                const active = countryActive(props, modeData, 'accord');
                return { fill: color, stroke: COLOR_OTHER_STROKE, strokeWidth: '0.5', opacity: active ? '1.0' : '0.2' };
            },

            getHoverFill(props, empireIds, modeData) {
                if (empireIds.has(props.region_id)) return { fill: COLOR_EMPIRE_HOVER, opacity: '0.85' };
                return { fill: adjustBrightness(props.country_color || COLOR_OTHER, 1.2), opacity: '1.0' };
            },

            buildPopupContent(props, empireIds, modeData) {
                if (empireIds.has(props.region_id)) return defaultPopup(props, true);
                const active = countryActive(props, modeData, 'accord');
                return defaultPopup(props, false)
                    + `<div class="map-popup-empire-badge" style="color:${active ? '#6ab97a' : '#c06060'};border-top-color:rgba(255,255,255,0.08);">${active ? 'Accord économique' : 'Aucun accord'}</div>`;
            }
        },

        /* ── 5. ACCORDS SCIENTIFIQUES ─────────────────── */
        {
            id: 'scientific',
            label: 'ACCORDS SCIENTIFIQUES',
            dataFile: 'data/scientific-accords.json',
            icon: ICON_SCIENTIFIC,

            getStyle(props, empireIds, modeData) {
                if (empireIds.has(props.region_id))
                    return { fill: COLOR_EMPIRE, stroke: COLOR_EMPIRE_STROKE, strokeWidth: '1', opacity: '0.65' };
                const color  = props.country_color || COLOR_OTHER;
                const active = countryActive(props, modeData, 'accord');
                return { fill: color, stroke: COLOR_OTHER_STROKE, strokeWidth: '0.5', opacity: active ? '1.0' : '0.2' };
            },

            getHoverFill(props, empireIds, modeData) {
                if (empireIds.has(props.region_id)) return { fill: COLOR_EMPIRE_HOVER, opacity: '0.85' };
                return { fill: adjustBrightness(props.country_color || COLOR_OTHER, 1.2), opacity: '1.0' };
            },

            buildPopupContent(props, empireIds, modeData) {
                if (empireIds.has(props.region_id)) return defaultPopup(props, true);
                const active = countryActive(props, modeData, 'accord');
                return defaultPopup(props, false)
                    + `<div class="map-popup-empire-badge" style="color:${active ? '#6ab97a' : '#c06060'};border-top-color:rgba(255,255,255,0.08);">${active ? 'Accord scientifique' : 'Aucun accord'}</div>`;
            }
        }
    ];

    global.MapModes = MODES;
})(window);
