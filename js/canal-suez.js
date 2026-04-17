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

        grid.style.display = 'grid';
        grid.innerHTML = data.map(renderCountryCard).join('');

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

function renderCountryCard(country) {
    // Gère les data URLs (sauvegarde locale) et les chemins de fichiers (push GitHub)
    const flagSrc = country.drapeau
        ? (country.drapeau.startsWith('data:') ? country.drapeau : `../${escH(country.drapeau)}`)
        : null;

    const flagHtml = flagSrc
        ? `<img src="${flagSrc}" alt="${escH(country.nom)}" loading="lazy" onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\' width=\\'48\\' height=\\'48\\' style=\\'color:var(--text-muted)\\'><rect x=\\'2\\' y=\\'5\\' width=\\'20\\' height=\\'14\\' rx=\\'1\\'/><path d=\\'M2 9h20M2 13h20\\'/></svg>'">`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="color:var(--text-muted)"><rect x="2" y="5" width="20" height="14" rx="1"/><path d="M2 9h20M2 13h20"/></svg>`;

    const taxRows = CANAL_CATS_PUBLIC.map(cat => {
        const val = country.taxes?.[cat.id];
        const blocked = val === null || val === undefined;
        const valHtml = blocked
            ? `<span class="canal-tax-blocked">NON AUTORISE</span>`
            : `<span class="canal-tax-val">${val}%</span>`;
        return `<div class="canal-tax-row">
                    <span class="canal-tax-label">${cat.label}</span>
                    ${valHtml}
                </div>`;
    }).join('');

    return `
        <div class="canal-card reveal-up">
            <div class="canal-flag">${flagHtml}</div>
            <h3 class="canal-country-name">${escH(country.nom)}</h3>
            <div class="canal-divider"></div>
            <div class="canal-tax-table">${taxRows}</div>
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
