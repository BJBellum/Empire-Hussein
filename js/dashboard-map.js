(function () {
    'use strict';

    const GEOJSON_URL = 'https://api.projet-resurgence.fr/geojson/regions?projection=mercator';
    const DATA_PREFIX = '../';

    const DATA_PATHS = {
        federal:    'data/federal-regions.json',
        claims:     'data/claims.json',
        diplomacy:  'data/diplomacy.json',
        economic:   'data/economic-accords.json',
        scientific: 'data/scientific-accords.json'
    };

    const SHA_KEYS = {
        federal:    'empire_federal_sha',
        claims:     'empire_claims_sha',
        diplomacy:  'empire_diplomacy_sha',
        economic:   'empire_economic_sha',
        scientific: 'empire_scientific_sha'
    };

    let _geoData    = null;
    let _empireIds  = new Set();
    let _currentIdx = 0;
    let _modeData   = {};
    let _savedData  = {};
    let _mapBuilt   = false;

    function currentMode() { return MapModes[_currentIdx]; }

    function defaultData(id) {
        if (id === 'claims')  return { region_ids: [] };
        if (id === 'federal') return { regions: [] };
        return { countries: {} };
    }

    function getGH() {
        try { return JSON.parse(localStorage.getItem('empire_github_config') || 'null'); } catch { return null; }
    }

    function showStatus(msg, type) {
        const el = document.getElementById('carto-push-status');
        if (!el) return;
        el.style.display = 'flex';
        el.className = 'github-status github-status--' + (type || 'info');
        el.textContent = msg;
    }

    function isDirty(id) {
        return JSON.stringify(_modeData[id] || {}) !== JSON.stringify(_savedData[id] || {});
    }

    function updatePushBtn() {
        const btn = document.getElementById('carto-btn-push');
        if (!btn) return;
        btn.disabled = !isDirty(currentMode().id);
    }

    /* ── Map rebuild ──────────────────────────────── */
    function rebuildMap() {
        const el      = document.getElementById('carto-map');
        const wrapper = document.getElementById('carto-map-wrapper');
        if (!el || !_geoData) return;
        el.innerHTML = '';

        const mode    = currentMode();
        const data    = _modeData[mode.id] || defaultData(mode.id);
        const { onLeftClick, onRightClick } = getModeHandlers(mode, data);

        MapEngine.build({
            mapEl:       el,
            wrapperEl:   wrapper,
            geoData:     _geoData,
            empireIds:   _empireIds,
            mode:        mode,
            modeData:    data,
            zoomPrefix:  'carto',
            pathPrefix:  DATA_PREFIX,
            onLeftClick,
            onRightClick
        });
    }

    /* ── Click handlers per mode ──────────────────── */
    function getModeHandlers(mode, data) {
        if (mode.id === 'federal') {
            return {
                onLeftClick(f) {
                    const props = f.properties || {};
                    if (!_empireIds.has(props.region_id)) return;
                    openFederalPanel(props);
                },
                onRightClick: null
            };
        }

        if (mode.id === 'claims') {
            return {
                onLeftClick(f, path, svg) {
                    const props = f.properties || {};
                    if (_empireIds.has(props.region_id)) return;
                    const d = _modeData['claims'] || defaultData('claims');
                    if (!d.region_ids.includes(props.region_id)) {
                        d.region_ids.push(props.region_id);
                        _modeData['claims'] = d;
                        const s = mode.getStyle(props, _empireIds, d);
                        path.setAttribute('fill', s.fill);
                        path.setAttribute('stroke', s.stroke);
                        path.setAttribute('fill-opacity', s.opacity);
                        svg.appendChild(path);
                        updatePushBtn();
                    }
                },
                onRightClick(f, path) {
                    const props = f.properties || {};
                    const d = _modeData['claims'] || defaultData('claims');
                    const idx = d.region_ids.indexOf(props.region_id);
                    if (idx !== -1) {
                        d.region_ids.splice(idx, 1);
                        _modeData['claims'] = d;
                        const s = mode.getStyle(props, _empireIds, d);
                        path.setAttribute('fill', s.fill);
                        path.setAttribute('stroke', s.stroke);
                        path.setAttribute('fill-opacity', s.opacity);
                        updatePushBtn();
                    }
                }
            };
        }

        return { onLeftClick: null, onRightClick: null };
    }

    /* ── Mode switch ──────────────────────────────── */
    function switchMode(idx) {
        _currentIdx = idx;

        document.querySelectorAll('#carto-mode-switcher .map-mode-btn').forEach(function (btn, i) {
            btn.classList.toggle('active', i === idx);
        });

        const mode   = MapModes[idx];
        const hintEl = document.getElementById('carto-hint');
        const hints  = {
            empire:     'Lecture seule — territoire de l\'Empire Hussein',
            federal:    'Clic : éditer la région fédérale',
            claims:     'Clic gauche : revendiquer — Clic droit : retirer',
            diplomacy:  'Éditer les reconnaissances ci-dessous',
            economic:   'Éditer les accords économiques ci-dessous',
            scientific: 'Éditer les accords scientifiques ci-dessous'
        };
        if (hintEl) hintEl.textContent = hints[mode.id] || '';

        const fedPanel = document.getElementById('carto-federal-panel');
        if (fedPanel) fedPanel.style.display = 'none';

        const relPanel = document.getElementById('carto-relations-panel');
        if (relPanel) {
            const show = ['diplomacy', 'economic', 'scientific'].includes(mode.id);
            relPanel.style.display = show ? 'block' : 'none';
            if (show) buildRelationsPanel(mode);
        }

        rebuildMap();
        updatePushBtn();
    }

    /* ── Federal panel ────────────────────────────── */
    function openFederalPanel(props) {
        const panel = document.getElementById('carto-federal-panel');
        if (!panel) return;
        panel.style.display = 'block';

        const data = _modeData['federal'] || defaultData('federal');
        const fed  = data.regions.find(r => r.member_ids.includes(props.region_id)) || null;

        document.getElementById('federal-region-name').value     = fed ? fed.name  : '';
        document.getElementById('federal-color-picker').value    = fed ? fed.color : '#c4a95b';
        document.getElementById('federal-panel-region-id').value = props.region_id;
        document.getElementById('federal-panel-region-name').textContent = props.name || '—';

        const preview = document.getElementById('federal-flag-preview');
        if (preview) {
            if (fed && fed.flag_path) { preview.src = DATA_PREFIX + fed.flag_path; preview.style.display = 'block'; }
            else                      { preview.src = ''; preview.style.display = 'none'; }
        }
        updateFederalMergeHint();
    }

    function updateFederalMergeHint() {
        const colorEl = document.getElementById('federal-color-picker');
        if (!colorEl) return;
        const data  = _modeData['federal'] || defaultData('federal');
        const match = data.regions.find(r => r.color === colorEl.value) || null;
        const hint  = document.getElementById('federal-merge-hint');
        if (hint) hint.textContent = match ? `Fusion avec : ${match.name}` : '';
    }

    function saveFederalRegion() {
        const regionId = parseInt(document.getElementById('federal-panel-region-id').value);
        const name     = (document.getElementById('federal-region-name').value || '').trim() || 'Région fédérale';
        const color    = document.getElementById('federal-color-picker').value;

        const data = _modeData['federal'] || defaultData('federal');

        /* Remove regionId from all federal regions */
        data.regions.forEach(r => { r.member_ids = r.member_ids.filter(id => id !== regionId); });
        data.regions = data.regions.filter(r => r.member_ids.length > 0);

        /* Find or create by color */
        let fed = data.regions.find(r => r.color === color) || null;
        if (fed) {
            fed.member_ids.push(regionId);
            fed.name = name;
        } else {
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'region-' + Date.now();
            fed = { id: Date.now(), name, color, flag_path: null, slug, member_ids: [regionId] };
            data.regions.push(fed);
        }

        _modeData['federal'] = data;
        rebuildMap();
        updatePushBtn();
    }

    /* ── Relations panel ──────────────────────────── */
    function buildRelationsPanel(mode) {
        const panel = document.getElementById('carto-relations-panel');
        if (!panel || !_geoData) return;

        const data    = _modeData[mode.id] || defaultData(mode.id);
        const isAccord = mode.id !== 'diplomacy';
        const optA = isAccord ? 'Accord'      : 'Reconnu';
        const optB = isAccord ? 'Aucun accord' : 'Non-Reconnu';
        const valA = isAccord ? 'accord'       : 'recognized';
        const valB = isAccord ? 'none'          : 'not_recognized';

        const cMap = new Map();
        for (const f of _geoData.features) {
            const p = f.properties || {};
            if (p.country_id && p.country_name && !_empireIds.has(p.region_id))
                cMap.set(p.country_id, { id: p.country_id, name: p.country_name, color: p.country_color });
        }
        const countries = [...cMap.values()].sort((a, b) => a.name.localeCompare(b.name));

        const rows = countries.map(c => {
            const status = (data.countries && data.countries[c.id]) || valB;
            return `<div class="relations-row" data-country-id="${c.id}">
                <span class="relations-dot" style="background:${c.color || '#888'}"></span>
                <span class="relations-name">${c.name}</span>
                <label class="relations-toggle"><input type="radio" name="rel-${c.id}" value="${valA}"${status === valA ? ' checked' : ''}> ${optA}</label>
                <label class="relations-toggle"><input type="radio" name="rel-${c.id}" value="${valB}"${status !== valA ? ' checked' : ''}> ${optB}</label>
            </div>`;
        }).join('');

        panel.innerHTML = `
            <div class="relations-panel-header">
                <span class="relations-panel-title">${mode.label}</span>
                <input type="text" class="relations-search" id="relations-search" placeholder="Rechercher un pays…">
            </div>
            <div id="relations-list">${rows}</div>`;

        panel.querySelectorAll('input[type=radio]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                if (!radio.checked) return;
                const row = radio.closest('.relations-row');
                const countryId = parseInt(row.dataset.countryId);
                const d = _modeData[mode.id] || defaultData(mode.id);
                if (!d.countries) d.countries = {};
                d.countries[countryId] = radio.value;
                _modeData[mode.id] = d;
                rebuildMap();
                updatePushBtn();
            });
        });

        const searchEl = document.getElementById('relations-search');
        if (searchEl) {
            searchEl.addEventListener('input', function () {
                const q = searchEl.value.toLowerCase();
                panel.querySelectorAll('.relations-row').forEach(function (row) {
                    row.style.display = row.querySelector('.relations-name').textContent.toLowerCase().includes(q) ? '' : 'none';
                });
            });
        }
    }

    /* ── GitHub push ──────────────────────────────── */
    async function pushCurrentMode() {
        const mode = currentMode();
        const cfg  = getGH();
        if (!cfg || !cfg.repo || !cfg.pat) {
            showStatus("Configuration GitHub requise — allez dans l'onglet CONFIGURATION", 'error');
            return;
        }

        const btn = document.getElementById('carto-btn-push');
        if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }

        try {
            if (mode.id === 'federal') await pushFederalFlags(cfg);

            const dataPath = DATA_PATHS[mode.id];
            const shaKey   = SHA_KEYS[mode.id];

            const raw    = _modeData[mode.id] || defaultData(mode.id);
            const toSave = Object.assign({}, raw);
            delete toSave._pendingFlags;

            let sha = localStorage.getItem(shaKey);
            try {
                const probe = await fetch(
                    `https://api.github.com/repos/${cfg.repo}/contents/${dataPath}?ref=${cfg.branch || 'main'}`,
                    { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
                );
                if (probe.ok) { sha = (await probe.json()).sha; localStorage.setItem(shaKey, sha); }
            } catch (_) {}

            const body = {
                message: `feat(carte): mise à jour ${mode.label.toLowerCase()}`,
                content: btoa(unescape(encodeURIComponent(JSON.stringify(toSave, null, 2)))),
                branch:  cfg.branch || 'main'
            };
            if (sha) body.sha = sha;

            const res    = await fetch(
                `https://api.github.com/repos/${cfg.repo}/contents/${dataPath}`,
                {
                    method: 'PUT',
                    headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }
            );
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Erreur push');
            if (result.content && result.content.sha) localStorage.setItem(shaKey, result.content.sha);

            _savedData[mode.id] = JSON.parse(JSON.stringify(toSave));
            showStatus(`✓ ${mode.label} mis à jour sur GitHub`, 'success');
            updatePushBtn();

        } catch (err) {
            showStatus('Erreur : ' + err.message, 'error');
        } finally {
            const b = document.getElementById('carto-btn-push');
            if (b) {
                b.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 12V4M4 8l4-4 4 4" stroke-linecap="round" stroke-linejoin="round"/></svg> Pousser sur GitHub';
                b.disabled = !isDirty(currentMode().id);
            }
        }
    }

    async function pushFederalFlags(cfg) {
        const data = _modeData['federal'];
        if (!data || !data._pendingFlags) return;
        for (const [slug, b64] of Object.entries(data._pendingFlags)) {
            const path   = `assets/flags/${slug}.png`;
            const shaKey = `empire_flags_sha_${slug}`;
            let sha = localStorage.getItem(shaKey);
            try {
                const probe = await fetch(
                    `https://api.github.com/repos/${cfg.repo}/contents/${path}?ref=${cfg.branch || 'main'}`,
                    { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
                );
                if (probe.ok) { sha = (await probe.json()).sha; localStorage.setItem(shaKey, sha); }
            } catch (_) {}
            const body = { message: `feat(carte): drapeau ${slug}`, content: b64, branch: cfg.branch || 'main' };
            if (sha) body.sha = sha;
            try {
                const res = await fetch(
                    `https://api.github.com/repos/${cfg.repo}/contents/${path}`,
                    {
                        method: 'PUT',
                        headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    }
                );
                const result = await res.json();
                if (res.ok && result.content) localStorage.setItem(shaKey, result.content.sha);
            } catch (_) {}
        }
        delete data._pendingFlags;
    }

    /* ── Init buttons ─────────────────────────────── */
    function initButtons() {
        const switcher = document.getElementById('carto-mode-switcher');
        if (!switcher) return;
        switcher.innerHTML = '';
        MapModes.forEach(function (mode, i) {
            const btn = document.createElement('button');
            btn.className = 'map-mode-btn' + (i === 0 ? ' active' : '');
            btn.title = mode.label.charAt(0) + mode.label.slice(1).toLowerCase();
            btn.setAttribute('aria-label', btn.title);
            btn.innerHTML = mode.icon;
            btn.addEventListener('click', function () { switchMode(i); });
            switcher.appendChild(btn);
        });
    }

    /* ── Wire static buttons ──────────────────────── */
    function wireButtons() {
        const pushBtn  = document.getElementById('carto-btn-push');
        const resetBtn = document.getElementById('carto-btn-reset');

        if (pushBtn)  pushBtn.addEventListener('click',  function () { pushCurrentMode(); });
        if (resetBtn) resetBtn.addEventListener('click', function () {
            const id = currentMode().id;
            _modeData[id] = JSON.parse(JSON.stringify(_savedData[id] || defaultData(id)));
            rebuildMap();
            updatePushBtn();
            const fedPanel = document.getElementById('carto-federal-panel');
            if (fedPanel) fedPanel.style.display = 'none';
            const relPanel = document.getElementById('carto-relations-panel');
            if (relPanel && relPanel.style.display !== 'none') buildRelationsPanel(currentMode());
        });

        const fedSave  = document.getElementById('federal-panel-save');
        if (fedSave)  fedSave.addEventListener('click', saveFederalRegion);

        const fedClose = document.getElementById('federal-panel-close');
        if (fedClose) fedClose.addEventListener('click', function () {
            document.getElementById('carto-federal-panel').style.display = 'none';
        });

        const fedColor = document.getElementById('federal-color-picker');
        if (fedColor) fedColor.addEventListener('input', updateFederalMergeHint);

        const fedFlag  = document.getElementById('federal-flag-input');
        if (fedFlag) fedFlag.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (ev) {
                const b64full = ev.target.result;
                const b64     = b64full.split(',')[1];
                const name    = (document.getElementById('federal-region-name').value || '').trim();
                const slug    = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'region-' + Date.now();

                const data = _modeData['federal'] || defaultData('federal');
                if (!data._pendingFlags) data._pendingFlags = {};
                data._pendingFlags[slug] = b64;
                _modeData['federal'] = data;

                const preview = document.getElementById('federal-flag-preview');
                if (preview) { preview.src = b64full; preview.style.display = 'block'; }

                const regionId = parseInt(document.getElementById('federal-panel-region-id').value);
                const fed = data.regions.find(r => r.member_ids.includes(regionId));
                if (fed) fed.flag_path = `assets/flags/${slug}.png`;
            };
            reader.readAsDataURL(file);
        });
    }

    /* ── Panel activation ─────────────────────────── */
    function initCartoPanel() {
        const el = document.getElementById('carto-map');
        if (!el) return;
        _mapBuilt = true;
        el.innerHTML = '<div class="map-loading">Chargement de la carte…</div>';

        fetch(GEOJSON_URL)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (geoData) {
                _geoData   = geoData;
                _empireIds = new Set();
                for (const f of geoData.features) {
                    if ((f.properties || {}).country_name === 'Empire Hussein')
                        _empireIds.add(f.properties.region_id);
                }

                return Promise.all(
                    MapModes.map(mode => mode.dataFile
                        ? fetch(DATA_PREFIX + mode.dataFile).then(r => r.ok ? r.json() : null).catch(() => null)
                        : Promise.resolve(null)
                    )
                ).then(function (results) {
                    MapModes.forEach(function (mode, i) {
                        _modeData[mode.id]  = results[i] || defaultData(mode.id);
                        _savedData[mode.id] = JSON.parse(JSON.stringify(_modeData[mode.id]));
                    });
                    el.innerHTML = '';
                    initButtons();
                    switchMode(0);
                    _mapBuilt = true;
                });
            })
            .catch(function (err) {
                console.error('CartoPanel: load failed', err);
                el.innerHTML = '<div class="map-loading map-loading--error">Impossible de charger les données.</div>';
            });
    }

    function observePanelActivation() {
        const wrapper = document.getElementById('panels-wrapper');
        if (!wrapper) return;
        const observer = new MutationObserver(function () {
            const panel = document.getElementById('panel-cartographie');
            if (panel && !panel.classList.contains('hidden') && !_mapBuilt)
                initCartoPanel();
        });
        observer.observe(wrapper, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    document.addEventListener('click', function (e) {
        const item = e.target.closest('[data-panel="cartographie"]');
        if (item && !_mapBuilt) setTimeout(initCartoPanel, 50);
    });

    document.addEventListener('DOMContentLoaded', function () {
        wireButtons();
        observePanelActivation();
    });
}());
