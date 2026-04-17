(function () {
    'use strict';

    const EMPIRE_REGION_IDS = new Set([35, 38, 39, 40, 41, 42, 43, 44, 78, 169, 1152, 1194, 1195, 1198, 1199]);
    const COLOR_EMPIRE = '#c4a95b';
    const COLOR_OTHER  = '#1e2618';
    const COLOR_EMPIRE_BORDER = '#e6cc7a';
    const COLOR_OTHER_BORDER  = '#2d3826';
    const GEOJSON_URL = 'https://map.projet-resurgence.fr/data/regions_mercator.geojson';

    function formatPopulation(n) {
        if (!n || n === 0) return 'Inhabité';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' M';
        if (n >= 1_000)     return Math.round(n / 1_000) + ' k';
        return n.toString();
    }

    function buildPopup(props, isEmpire) {
        const dot = isEmpire ? 'map-popup-dot--empire' : 'map-popup-dot--other';
        const badge = isEmpire
            ? '<div class="map-popup-empire-badge">TERRITOIRE DE L\'EMPIRE HUSSEIN</div>'
            : '';
        return `
            <div class="map-popup">
                <div class="map-popup-header">
                    <span class="map-popup-dot ${dot}"></span>
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
                        <span class="map-popup-value">${formatPopulation(props.population)}</span>
                    </div>
                </div>
                ${badge}
            </div>`;
    }

    function initMap() {
        const el = document.getElementById('map-empire');
        if (!el) return;

        const map = L.map('map-empire', {
            center: [27, 33],
            zoom: 4,
            zoomControl: true,
            attributionControl: true,
            minZoom: 2,
            maxZoom: 8
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter_nolabels/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        fetch(GEOJSON_URL, { mode: 'cors' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                L.geoJSON(data, {
                    style: function (feature) {
                        const id = feature.properties && feature.properties.region_id;
                        const empire = EMPIRE_REGION_IDS.has(id);
                        return {
                            fillColor:   empire ? COLOR_EMPIRE : COLOR_OTHER,
                            fillOpacity: empire ? 0.55 : 0.35,
                            color:       empire ? COLOR_EMPIRE_BORDER : COLOR_OTHER_BORDER,
                            weight:      empire ? 1.5 : 0.8,
                            opacity:     empire ? 0.9 : 0.5
                        };
                    },
                    onEachFeature: function (feature, layer) {
                        const props = feature.properties || {};
                        const id = props.region_id;
                        const isEmpire = EMPIRE_REGION_IDS.has(id);

                        layer.on('click', function (e) {
                            L.popup({ maxWidth: 320, className: 'map-popup-outer' })
                                .setLatLng(e.latlng)
                                .setContent(buildPopup(props, isEmpire))
                                .openOn(map);
                        });

                        layer.on('mouseover', function () {
                            if (isEmpire) {
                                layer.setStyle({ fillOpacity: 0.75, weight: 2 });
                            } else {
                                layer.setStyle({ fillOpacity: 0.5, weight: 1.2 });
                            }
                        });

                        layer.on('mouseout', function () {
                            if (isEmpire) {
                                layer.setStyle({ fillOpacity: 0.55, weight: 1.5 });
                            } else {
                                layer.setStyle({ fillOpacity: 0.35, weight: 0.8 });
                            }
                        });
                    }
                }).addTo(map);
            })
            .catch(function (err) {
                console.error('Carte: GeoJSON load failed', err);
                el.insertAdjacentHTML('afterend',
                    '<p style="text-align:center;color:#9A8B7A;padding:1rem;font-family:var(--font-body);font-size:.85rem;">Impossible de charger les données cartographiques.</p>'
                );
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
    } else {
        initMap();
    }
}());
