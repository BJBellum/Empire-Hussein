(function () {
    'use strict';

    const GEOJSON_URL = 'https://api.projet-resurgence.fr/geojson/regions?projection=mercator';
    const DATA_PREFIX = '';

    let _geoData      = null;
    let _empireIds    = new Set();
    let _currentIdx   = 0;
    let _modeData     = {};
    let _mapInstance  = null;
    let _renderVersion = 0;
    let _initialized   = false;

    function loadModeData(mode) {
        if (_modeData[mode.id] !== undefined) return Promise.resolve(_modeData[mode.id]);
        if (!mode.dataFile) return Promise.resolve(null);
        return fetch(DATA_PREFIX + mode.dataFile)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null);
    }

    function renderMap() {
        const el      = document.getElementById('map-empire');
        const wrapper = el ? el.closest('.carte-wrapper') : null;
        if (!el || !_geoData) return;
        const renderVersion = ++_renderVersion;
        if (_mapInstance) { _mapInstance.destroy(); _mapInstance = null; }
        el.innerHTML = '';

        const mode = MapModes[_currentIdx];
        loadModeData(mode).then(function (data) {
            if (renderVersion !== _renderVersion) return;
            _modeData[mode.id] = data;
            _mapInstance = MapEngine.build({
                mapEl:       el,
                wrapperEl:   wrapper,
                geoData:     _geoData,
                empireIds:   _empireIds,
                mode:        mode,
                modeData:    data,
                zoomPrefix:  'map',
                pathPrefix:  DATA_PREFIX,
                onLeftClick: null,
                onRightClick: null
            });
        });
    }

    function switchMode(idx) {
        _currentIdx = idx;
        document.querySelectorAll('.map-mode-switcher .map-mode-btn').forEach(function (btn, i) {
            btn.classList.toggle('active', i === idx);
        });
        renderMap();
    }

    function initButtons() {
        const switcher = document.getElementById('map-mode-switcher');
        if (!switcher) return;
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

    function initMap() {
        const el = document.getElementById('map-empire');
        if (!el || _initialized) return;
        _initialized = true;
        el.innerHTML = '<div class="map-loading">Chargement de la carte…</div>';

        fetch(GEOJSON_URL)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (geoData) {
                _geoData = geoData;
                _empireIds = new Set();
                for (const f of geoData.features) {
                    if ((f.properties || {}).country_name === 'Empire Hussein')
                        _empireIds.add(f.properties.region_id);
                }
                el.innerHTML = '';
                initButtons();
                renderMap();
            })
            .catch(function (err) {
                console.error('Carte: load failed', err);
                el.innerHTML = '<div class="map-loading map-loading--error">Impossible de charger les données cartographiques.</div>';
            });
    }

    function observeMap() {
        const el = document.getElementById('map-empire');
        if (!el) return;
        if (!('IntersectionObserver' in window)) {
            initMap();
            return;
        }
        const observer = new IntersectionObserver(function (entries) {
            if (!entries[0].isIntersecting) return;
            observer.disconnect();
            initMap();
        }, { rootMargin: '300px 0px' });
        observer.observe(el);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeMap);
    } else {
        observeMap();
    }
}());
