/**
 * Empire Hussein — Catalogue Militaire
 * Charge data/catalogue-militaire.json et affiche les équipements
 * avec filtres par catégorie, recherche et fiches techniques dépliables.
 */

const CAT_LABELS = {
    'armes-feu':            'ARMES A FEU',
    'explosifs':            'EXPLOSIFS',
    'vehicules-terrestres': 'VEHICULES TERRESTRES',
    'artillerie':           'ARTILLERIE',
    'aeronefs':             'AERONEFS',
    'navires':              'NAVIRES',
    'sous-marins':          'SOUS-MARINS',
    'missiles':             'MISSILES',
    'missiles-strategiques':'MISSILES STRATEGIQUES'
};

const NIV_ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const JSON_URL = 'data/catalogue-militaire.json';
const CART_STORAGE_KEY = 'empire-hussein:catalogue-militaire:cart';

let allItems = [];
let currentFilter = 'all';
let currentSearch = '';
let cart = new Map(); // id -> { id, nom, prix, qty }

document.addEventListener('DOMContentLoaded', async () => {
    initSidebarToggle();
    initFilters();
    initSearch();
    initCart();
    await loadItems();
});

/* ────────────────────────────────────────
   DATA LOADING
   ──────────────────────────────────────── */
async function loadItems() {
    const loading = document.getElementById('cat-loading');
    const container = document.getElementById('cat-items');
    try {
        const res = await fetch(JSON_URL, { cache: 'default' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        allItems = await res.json();
    } catch (err) {
        if (loading) loading.textContent = `Erreur de chargement : ${err.message}`;
        return;
    }
    loading.style.display = 'none';
    container.style.display = 'flex';
    updateCounts();
    render();
}

/* ────────────────────────────────────────
   FILTERS
   ──────────────────────────────────────── */
function initFilters() {
    document.querySelectorAll('.cat-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            render();
            closeSidebarOnMobile();
        });
    });
}

function initSearch() {
    const input = document.getElementById('cat-search');
    if (!input) return;
    input.addEventListener('input', () => {
        currentSearch = input.value.trim().toLowerCase();
        render();
    });
}

function initSidebarToggle() {
    const btn = document.getElementById('cat-sidebar-toggle');
    const body = document.getElementById('cat-sidebar-body');
    if (!btn || !body) return;
    btn.addEventListener('click', () => body.classList.toggle('open'));
}

function closeSidebarOnMobile() {
    if (window.innerWidth > 900) return;
    document.getElementById('cat-sidebar-body')?.classList.remove('open');
}

/* ────────────────────────────────────────
   COUNTS
   ──────────────────────────────────────── */
function updateCounts() {
    const total = allItems.length;
    const all = document.getElementById('count-all');
    if (all) all.textContent = total;

    document.querySelectorAll('[data-count]').forEach(el => {
        const cat = el.dataset.count;
        el.textContent = allItems.filter(i => i.categorie === cat).length;
    });
}

/* ────────────────────────────────────────
   RENDER
   ──────────────────────────────────────── */
function render() {
    const items = filterItems();

    const titleEl = document.getElementById('cat-results-title');
    const countEl = document.getElementById('cat-results-count');
    const listEl  = document.getElementById('cat-items');
    const empty   = document.getElementById('cat-empty');

    if (titleEl) {
        titleEl.textContent = currentFilter === 'all'
            ? 'TOUS LES EQUIPEMENTS'
            : (CAT_LABELS[currentFilter] || currentFilter.toUpperCase());
    }
    if (countEl) {
        const n = items.length;
        countEl.textContent = `${n} équipement${n !== 1 ? 's' : ''}`;
    }

    if (items.length === 0) {
        listEl.style.display = 'none';
        empty.style.display  = 'block';
        return;
    }

    listEl.style.display = 'flex';
    empty.style.display  = 'none';

    items.sort((a, b) => {
        const catCmp = (a.categorie || '').localeCompare(b.categorie || '');
        if (catCmp !== 0) return catCmp;
        return (a.nom || '').localeCompare(b.nom || '');
    });

    listEl.innerHTML = items.map(itemTemplate).join('');

    listEl.querySelectorAll('.cat-item-specs-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.target;
            const panel = document.getElementById(id);
            if (!panel) return;
            const isOpen = panel.classList.toggle('open');
            btn.classList.toggle('open', isOpen);
            const label = btn.querySelector('.cat-toggle-label');
            if (label) label.textContent = isOpen ? 'MASQUER LA FICHE' : 'VOIR LA FICHE TECHNIQUE';
        });
    });

    listEl.querySelectorAll('.cat-item-add').forEach(btn => {
        btn.addEventListener('click', () => addToCart(btn.dataset.id));
    });

    syncAddButtons();
}

function filterItems() {
    return allItems.filter(item => {
        if (currentFilter !== 'all' && item.categorie !== currentFilter) return false;
        if (currentSearch) {
            const haystack = [
                item.nom, item.soustype, item.fabricant, item.inspiration,
                CAT_LABELS[item.categorie] || item.categorie
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(currentSearch)) return false;
        }
        return true;
    });
}

/* ────────────────────────────────────────
   TEMPLATE
   ──────────────────────────────────────── */
function itemTemplate(item) {
    const specsId = `specs-${item.id}`;
    const niv = NIV_ROMAN[item.niveau] || item.niveau;

    const imgBlock = item.image_path
        ? `<img src="${esc(item.image_path)}" alt="${esc(item.nom)}" loading="lazy" onerror="this.parentElement.classList.add('cat-item-image--empty');this.remove();">`
        : `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2">
                <rect x="6" y="10" width="36" height="28"/>
                <path d="M6 30l12-10 10 8 14-12"/>
                <circle cx="16" cy="18" r="2"/>
           </svg>`;

    const imgClass = item.image_path ? 'cat-item-image' : 'cat-item-image cat-item-image--empty';

    const metaRows = [];
    if (item.fabricant)     metaRows.push(['FABRICANT', item.fabricant]);
    if (item.inspiration)   metaRows.push(['INSPIRATION', item.inspiration]);
    if (item.disponibilite) metaRows.push(['DISPONIBLE', item.disponibilite]);

    const specRows = Object.entries(item.specs || {}).map(([k, v]) => `
        <div class="cat-item-specs-row">
            <span class="cat-item-specs-key">${esc(k)}</span>
            <span class="cat-item-specs-val">${esc(v)}</span>
        </div>
    `).join('');

    return `
        <article class="cat-item" data-id="${esc(item.id)}">
            <div class="${imgClass}">
                ${imgBlock}
                <span class="cat-item-niv">NIV ${niv}</span>
            </div>
            <div class="cat-item-body">
                <div class="cat-item-header">
                    <h3 class="cat-item-name">${esc(item.nom || 'Sans nom')}</h3>
                    ${item.cout_unite ? `<span class="cat-item-cost">${formatCost(item.cout_unite)}</span>` : ''}
                </div>
                <div class="cat-item-subtype">${esc(item.soustype || CAT_LABELS[item.categorie] || '')}</div>
                <div class="cat-item-meta">
                    ${metaRows.map(([l, v]) => `
                        <div class="cat-item-meta-entry">
                            <span class="cat-item-meta-label">${esc(l)}</span>
                            <span class="cat-item-meta-value">${esc(v)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="cat-item-actions">
                    ${specRows ? `
                        <button class="cat-item-specs-toggle" data-target="${specsId}">
                            <span class="cat-toggle-label">VOIR LA FICHE TECHNIQUE</span>
                            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M2 4l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    ` : ''}
                    ${item.cout_unite ? `
                        <button class="cat-item-add" data-id="${esc(item.id)}" type="button" aria-label="Ajouter au panier">
                            <!-- icones.js.org — tabler:plus -->
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 5v14m-7-7h14"/>
                            </svg>
                            <span class="cat-item-add-label">AJOUTER</span>
                        </button>
                    ` : ''}
                </div>
            </div>
            ${specRows ? `
                <div class="cat-item-specs" id="${specsId}">
                    <div class="cat-item-specs-title">FICHE TECHNIQUE</div>
                    <div class="cat-item-specs-grid">${specRows}</div>
                </div>
            ` : ''}
        </article>
    `;
}

/* ────────────────────────────────────────
   UTILS
   ──────────────────────────────────────── */
function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatCost(raw) {
    if (!raw) return '';
    const num = Number(String(raw).replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) return esc(raw);
    return num.toLocaleString('fr-FR') + ' §';
}

function parsePrice(raw) {
    const num = Number(String(raw || '').replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
}

function formatDollar(num) {
    return '$' + Math.round(num).toLocaleString('fr-FR');
}

/* ────────────────────────────────────────
   PANIER
   ──────────────────────────────────────── */
function initCart() {
    loadCartFromStorage();

    document.getElementById('cat-cart-clear')?.addEventListener('click', clearCart);

    const fab = document.getElementById('cat-cart-fab');
    const cartEl = document.getElementById('cat-cart');
    if (fab && cartEl) {
        fab.addEventListener('click', () => cartEl.classList.toggle('cat-cart--open'));
    }

    renderCart();
}

function loadCartFromStorage() {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;
        arr.forEach(entry => {
            if (entry && entry.id && entry.qty > 0) cart.set(entry.id, entry);
        });
    } catch {}
}

function saveCartToStorage() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([...cart.values()]));
    } catch {}
}

function addToCart(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    const existing = cart.get(id);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.set(id, {
            id: item.id,
            nom: item.nom || 'Sans nom',
            prix: parsePrice(item.cout_unite),
            qty: 1
        });
    }
    afterCartMutation();
}

function incrementCart(id) {
    const entry = cart.get(id);
    if (!entry) return;
    entry.qty += 1;
    afterCartMutation();
}

function decrementCart(id) {
    const entry = cart.get(id);
    if (!entry) return;
    entry.qty -= 1;
    if (entry.qty <= 0) cart.delete(id);
    afterCartMutation();
}

function removeFromCart(id) {
    cart.delete(id);
    afterCartMutation();
}

function clearCart() {
    if (cart.size === 0) return;
    cart.clear();
    afterCartMutation();
}

function afterCartMutation() {
    saveCartToStorage();
    renderCart();
    syncAddButtons();
}

function renderCart() {
    const itemsEl = document.getElementById('cat-cart-items');
    const emptyEl = document.getElementById('cat-cart-empty');
    const countEl = document.getElementById('cat-cart-count');
    const fabCountEl = document.getElementById('cat-cart-fab-count');
    const totalEl = document.getElementById('cat-cart-total');
    const clearBtn = document.getElementById('cat-cart-clear');
    const fabEl = document.getElementById('cat-cart-fab');
    if (!itemsEl) return;

    const entries = [...cart.values()];
    const totalQty = entries.reduce((s, e) => s + e.qty, 0);
    const totalPrice = entries.reduce((s, e) => s + e.prix * e.qty, 0);

    if (countEl) countEl.textContent = totalQty;
    if (fabCountEl) fabCountEl.textContent = totalQty;
    if (totalEl) totalEl.textContent = formatDollar(totalPrice);
    if (clearBtn) clearBtn.disabled = entries.length === 0;
    if (fabEl) fabEl.classList.toggle('cat-cart-fab--active', totalQty > 0);

    if (entries.length === 0) {
        itemsEl.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    itemsEl.innerHTML = entries.map(e => `
        <li class="cat-cart-item" data-id="${esc(e.id)}">
            <div class="cat-cart-item-info">
                <span class="cat-cart-item-name">${esc(e.nom)}</span>
                <span class="cat-cart-item-unit">${formatDollar(e.prix)} / u.</span>
            </div>
            <div class="cat-cart-item-qty">
                <button class="cat-cart-qty-btn" data-action="dec" data-id="${esc(e.id)}" aria-label="Retirer une unité">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
                </button>
                <span class="cat-cart-qty-value">${e.qty}</span>
                <button class="cat-cart-qty-btn" data-action="inc" data-id="${esc(e.id)}" aria-label="Ajouter une unité">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14m-7-7h14"/></svg>
                </button>
            </div>
            <div class="cat-cart-item-sub">${formatDollar(e.prix * e.qty)}</div>
            <button class="cat-cart-item-remove" data-action="remove" data-id="${esc(e.id)}" aria-label="Supprimer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </li>
    `).join('');

    itemsEl.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const { action, id } = btn.dataset;
            if (action === 'inc') incrementCart(id);
            else if (action === 'dec') decrementCart(id);
            else if (action === 'remove') removeFromCart(id);
        });
    });
}

function syncAddButtons() {
    document.querySelectorAll('.cat-item-add').forEach(btn => {
        const entry = cart.get(btn.dataset.id);
        const qty = entry ? entry.qty : 0;
        btn.classList.toggle('cat-item-add--in-cart', qty > 0);
        const label = btn.querySelector('.cat-item-add-label');
        if (label) label.textContent = qty > 0 ? `AJOUTER (${qty})` : 'AJOUTER';
    });
}
