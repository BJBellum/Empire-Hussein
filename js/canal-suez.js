/* ════════════════════════════════════════════
   CANAL DE SUEZ — Rendu public
   ════════════════════════════════════════════ */

const CANAL_CATS_PUBLIC = [
    { id: 'matieres_premieres',      label: 'Matières Premières' },
    { id: 'produits_manufactures',   label: 'Produits Manufacturés' },
    { id: 'materiel_militaire',      label: 'Matériel Militaire' },
    { id: 'materiel_industriel',     label: 'Matériel Industriel' },
    { id: 'ressources_energetiques', label: 'Ressources Énergétiques' },
];

async function initCanalPublic() {
    const grid    = document.getElementById('canal-grid');
    const loading = document.getElementById('canal-loading');
    const empty   = document.getElementById('canal-empty');
    if (!grid) return;

    try {
        const res = await fetch('../data/canal-suez.json?t=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        let data = await res.json();

        // Si le fichier déployé est vide, utiliser le cache localStorage (mis à jour au push)
        if (!Array.isArray(data) || data.length === 0) {
            try {
                const cached = JSON.parse(localStorage.getItem('empire_canal_v1') || '{}');
                if (Array.isArray(cached.items) && cached.items.length > 0) data = cached.items;
            } catch {}
        }

        if (loading) loading.style.display = 'none';

        if (!Array.isArray(data) || data.length === 0) {
            if (empty) empty.style.display = 'flex';
            return;
        }

        // Tri alphabétique par nom dans chaque groupe
        data.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' }));

        // Regroupement par continent
        const groups = {};
        data.forEach(item => {
            const cont = item.continent?.trim() || 'Non Classes';
            if (!groups[cont]) groups[cont] = [];
            groups[cont].push(item);
        });

        // Tri des continents alphabétiquement (Non Classes toujours en dernier)
        const sortedContinents = Object.keys(groups).sort((a, b) => {
            if (a === 'Non Classes') return 1;
            if (b === 'Non Classes') return -1;
            return a.localeCompare(b, 'fr', { sensitivity: 'base' });
        });

        grid.style.display = 'block';
        grid.innerHTML = sortedContinents.map(cont => `
            <div class="canal-continent-group">
                <div class="canal-continent-header">
                    <h2 class="canal-continent-title">${escH(cont.toUpperCase())}</h2>
                    <div class="canal-continent-line"></div>
                </div>
                <div class="canal-continent-cards">
                    ${groups[cont].map(renderCountryCard).join('')}
                </div>
            </div>
        `).join('');

        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
            });
        }, { threshold: 0.05 });
        document.querySelectorAll('.canal-card').forEach(el => io.observe(el));
    } catch (err) {
        if (loading) loading.style.display = 'none';
        if (empty) {
            empty.style.display = 'flex';
            const textEl = empty.querySelector('.canal-empty-text');
            if (textEl) textEl.textContent = 'Erreur de chargement des données.';
        }
    }
}

function taxColor(val) {
    // 0 → vert vif, 50 → orange, 100 → rouge
    const hue = Math.round(120 - (Math.min(val, 100) / 100) * 120);
    return `hsl(${hue}, 80%, 52%)`;
}

function countryNameStyle(name) {
    const len = name.length;
    if (len > 24) return 'font-size:9px;letter-spacing:0.1em;';
    if (len > 17) return 'font-size:11px;letter-spacing:0.14em;';
    return '';
}

function renderCountryCard(country) {
    const flagSrc = country.drapeau
        ? (country.drapeau.startsWith('data:') ? country.drapeau : `../${escH(country.drapeau)}`)
        : null;

    const flagHtml = flagSrc
        ? `<img src="${flagSrc}" alt="${escH(country.nom)}" loading="lazy" onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\' width=\\'56\\' height=\\'56\\' style=\\'color:var(--text-muted)\\'><rect x=\\'2\\' y=\\'5\\' width=\\'20\\' height=\\'14\\' rx=\\'1\\'/><path d=\\'M2 9h20M2 13h20\\'/></svg>'">`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56" style="color:var(--text-muted)"><rect x="2" y="5" width="20" height="14" rx="1"/><path d="M2 9h20M2 13h20"/></svg>`;

    const taxRows = CANAL_CATS_PUBLIC.map(cat => {
        const val = country.taxes?.[cat.id];
        const blocked = val === null || val === undefined;
        let valHtml;
        if (blocked) {
            valHtml = `<span class="canal-tax-blocked">NON AUTORISE</span>`;
        } else if (val === 0) {
            valHtml = `<span class="canal-tax-libre">LIBRE PASSAGE</span>`;
        } else {
            valHtml = `<span class="canal-tax-val" style="color:${taxColor(val)}">${val}%</span>`;
        }
        return `<div class="canal-tax-row">
                    <span class="canal-tax-label">${cat.label}</span>
                    ${valHtml}
                </div>`;
    }).join('');

    return `
        <div class="canal-card reveal-up">
            <div class="canal-flag">${flagHtml}</div>
            <div class="canal-card-body">
                <h3 class="canal-country-name" style="${countryNameStyle(country.nom)}">${escH(country.nom)}</h3>
                <div class="canal-divider"></div>
                <div class="canal-tax-table">${taxRows}</div>
            </div>
        </div>
    `;
}

function escH(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', initCanalPublic);
