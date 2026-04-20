(function () {
    'use strict';

    const BLANK = '\u2800'; // ⠀ braille blank — padding inside Discord `code`
    const EHU_FLAG = '<:flag_ehu:1493299393606975539>';

    // ── Bold Unicode converter ───────────────────────────────────────────────
    function boldChar(ch) {
        const c = ch.codePointAt(0);
        if (c >= 65 && c <= 90)  return String.fromCodePoint(0x1D400 + c - 65); // A–Z
        if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D41A + c - 97); // a–z
        if (c >= 48 && c <= 57)  return String.fromCodePoint(0x1D7CE + c - 48); // 0–9
        return ch;
    }

    function toBold(str) {
        let out = '';
        for (const ch of [...str]) {
            const c = ch.codePointAt(0);
            // Pass combining diacritics through as-is (U+0300–U+036F)
            if (c >= 0x0300 && c <= 0x036F) { out += ch; continue; }
            const nfd = ch.normalize('NFD');
            if (nfd.length > 1) {
                // Precomposed accented char: bold the base, keep the combining mark(s)
                out += boldChar(nfd[0]) + nfd.slice(1);
            } else {
                out += boldChar(ch);
            }
        }
        return out;
    }

    function toRoman(n) {
        const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
        const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
        let r = '';
        for (let i = 0; i < vals.length; i++) while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
        return r;
    }

    function escHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── State ────────────────────────────────────────────────────────────────
    let articles = []; // [{mode:'simple'|'subpoints', content:'', subpoints:[{label:'', content:''}]}]

    // ── Helpers to read form values ──────────────────────────────────────────
    function g(id) { return document.getElementById(id); }
    function radio(name) { return document.querySelector(`input[name="${name}"]:checked`)?.value || ''; }
    function checked(id) { return g(id)?.checked || false; }
    function val(id) { return (g(id)?.value || '').trim(); }

    // ── Generate Discord text ────────────────────────────────────────────────
    function generate() {
        const type    = radio('traite-type') || 'TRAITE';
        const nomType = radio('traite-nom-type') || 'ville';
        const vis     = radio('traite-visibilite') || 'Public';

        // Title bold string
        let titleStr;
        if (nomType === 'ville') {
            const city = val('traite-ville').toUpperCase() || 'VILLE';
            titleStr = toBold(`${type} DE ${city}`);
        } else {
            const nat = val('traite-nilo').toUpperCase() || 'NATIONALITE';
            titleStr = toBold(`${type} NILO-${nat}`);
        }

        const partnerEmoji = val('traite-emoji');
        const preamb       = val('traite-preambule');

        // Nature badges
        const natures = [];
        if (checked('traite-eco'))   natures.push(toBold('Économique'));
        if (checked('traite-def'))   natures.push(toBold('Défense'));
        if (checked('traite-tech'))  natures.push(toBold('Technologique'));
        if (checked('traite-diplo')) natures.push(toBold('Diplomatique'));

        const lines = [];

        // ── Header ───────────────────────────────────────────────────────────
        const partnerPart = partnerEmoji ? ` ${partnerEmoji}` : '';
        lines.push(`> ${EHU_FLAG} \`${BLANK}${titleStr}${BLANK}\`${partnerPart}`);
        lines.push(`> `);

        // ── Visibility & nature ───────────────────────────────────────────────
        lines.push(`> ▶ \`${BLANK}${toBold(vis)}${BLANK}\``);
        if (natures.length) lines.push(`> ▶ \`${BLANK}${natures.join(', ')}${BLANK}\``);
        lines.push(`> `);

        // ── Préambule ─────────────────────────────────────────────────────────
        if (preamb) {
            lines.push(`> \`${toBold('PRÉAMBULE')}.\` :`);
            preamb.split('\n').forEach(l => lines.push(`> ${l}`));
        }

        // ── Articles ──────────────────────────────────────────────────────────
        articles.forEach((art, idx) => {
            lines.push(`> `);
            const roman = toBold(toRoman(idx + 1));
            lines.push(`> \`${toBold('ARTICLE')} ${roman}.\` :`);
            if (art.mode === 'simple') {
                if (art.content.trim()) {
                    art.content.split('\n').forEach(l => lines.push(`> ${l}`));
                } else {
                    lines.push(`> `);
                }
            } else {
                art.subpoints.forEach((sp, si) => {
                    if (si > 0) lines.push(`> `);
                    const lbl = sp.label.trim() || String(si + 1);
                    lines.push(`> **${lbl} :** ${sp.content.trim()}`);
                });
            }
        });

        return lines.join('\n');
    }

    // ── Update preview ───────────────────────────────────────────────────────
    function updatePreview() {
        const el = g('traite-preview');
        if (el) el.textContent = generate();
    }

    // ── Render article list ──────────────────────────────────────────────────
    function renderArticles() {
        const list = g('traite-articles-list');
        if (!list) return;
        list.innerHTML = '';

        articles.forEach((art, idx) => {
            const label = `ARTICLE ${toRoman(idx + 1)}`;
            const div = document.createElement('div');
            div.className = 'traite-article-item';

            const bodyHtml = art.mode === 'simple'
                ? `<textarea class="form-input traite-body-textarea traite-art-content" data-idx="${idx}" rows="3" placeholder="Contenu de l'article…">${escHtml(art.content)}</textarea>`
                : `<div class="traite-subpoints-list" id="traite-sp-${idx}">
                    ${art.subpoints.map((sp, si) => `
                        <div class="traite-subpoint-row">
                            <input class="form-input traite-sp-lbl" type="text" data-idx="${idx}" data-si="${si}" value="${escHtml(sp.label)}" placeholder="1">
                            <textarea class="form-input traite-sp-body" data-idx="${idx}" data-si="${si}" rows="2" placeholder="Contenu…">${escHtml(sp.content)}</textarea>
                            <button type="button" class="btn-secondary traite-rm-sp" data-idx="${idx}" data-si="${si}" title="Supprimer">✕</button>
                        </div>`).join('')}
                    <button type="button" class="btn-secondary traite-add-sp" data-idx="${idx}" style="margin-top:8px;">+ Sous-point</button>
                   </div>`;

            div.innerHTML = `
                <div class="traite-article-header">
                    <span class="traite-article-num">${label}</span>
                    <div class="traite-article-actions">
                        <button type="button" class="btn-secondary traite-toggle-mode" data-idx="${idx}">
                            ${art.mode === 'simple' ? 'Mode sous-points' : 'Mode simple'}
                        </button>
                        <button type="button" class="btn-secondary traite-rm-art" data-idx="${idx}" title="Supprimer l'article">✕</button>
                    </div>
                </div>
                ${bodyHtml}`;

            list.appendChild(div);
        });

        // ── Events ───────────────────────────────────────────────────────────
        list.querySelectorAll('.traite-toggle-mode').forEach(btn => btn.addEventListener('click', () => {
            const i = +btn.dataset.idx;
            articles[i].mode = articles[i].mode === 'simple' ? 'subpoints' : 'simple';
            renderArticles(); updatePreview();
        }));

        list.querySelectorAll('.traite-rm-art').forEach(btn => btn.addEventListener('click', () => {
            articles.splice(+btn.dataset.idx, 1);
            renderArticles(); updatePreview();
        }));

        list.querySelectorAll('.traite-art-content').forEach(ta => ta.addEventListener('input', () => {
            articles[+ta.dataset.idx].content = ta.value;
            updatePreview();
        }));

        list.querySelectorAll('.traite-sp-lbl').forEach(inp => inp.addEventListener('input', () => {
            articles[+inp.dataset.idx].subpoints[+inp.dataset.si].label = inp.value;
            updatePreview();
        }));

        list.querySelectorAll('.traite-sp-body').forEach(ta => ta.addEventListener('input', () => {
            articles[+ta.dataset.idx].subpoints[+ta.dataset.si].content = ta.value;
            updatePreview();
        }));

        list.querySelectorAll('.traite-rm-sp').forEach(btn => btn.addEventListener('click', () => {
            articles[+btn.dataset.idx].subpoints.splice(+btn.dataset.si, 1);
            renderArticles(); updatePreview();
        }));

        list.querySelectorAll('.traite-add-sp').forEach(btn => btn.addEventListener('click', () => {
            const i = +btn.dataset.idx;
            articles[i].subpoints.push({ label: String(articles[i].subpoints.length + 1), content: '' });
            renderArticles(); updatePreview();
        }));
    }

    // ── Init ────────────────────────────────────────────────────────────────
    function init() {
        // nom-type toggle
        document.querySelectorAll('input[name="traite-nom-type"]').forEach(r => r.addEventListener('change', () => {
            const isNilo = r.value === 'nilo' && r.checked;
            g('traite-ville-group').style.display = isNilo ? 'none' : '';
            g('traite-nilo-group').style.display  = isNilo ? '' : 'none';
            updatePreview();
        }));

        // Live preview on all controls
        ['traite-type','traite-visibilite'].forEach(name =>
            document.querySelectorAll(`input[name="${name}"]`).forEach(el => el.addEventListener('change', updatePreview)));

        ['traite-ville','traite-nilo','traite-emoji','traite-preambule',
         'traite-eco','traite-def','traite-tech','traite-diplo'].forEach(id => {
            const el = g(id);
            if (!el) return;
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', updatePreview);
        });

        // Add article
        g('traite-add-article')?.addEventListener('click', () => {
            articles.push({ mode: 'simple', content: '', subpoints: [{ label: '1', content: '' }] });
            renderArticles(); updatePreview();
        });

        // Reset
        g('traite-reset')?.addEventListener('click', () => {
            document.querySelector('input[name="traite-type"][value="TRAITE"]').checked = true;
            document.querySelector('input[name="traite-nom-type"][value="ville"]').checked = true;
            document.querySelector('input[name="traite-visibilite"][value="Public"]').checked = true;
            g('traite-ville-group').style.display = '';
            g('traite-nilo-group').style.display  = 'none';
            ['traite-ville','traite-nilo','traite-emoji','traite-preambule'].forEach(id => { if (g(id)) g(id).value = ''; });
            ['traite-eco','traite-def','traite-tech','traite-diplo'].forEach(id => { if (g(id)) g(id).checked = false; });
            articles = [];
            renderArticles(); updatePreview();
        });

        // Copy
        g('traite-copy-btn')?.addEventListener('click', () => {
            const text = g('traite-preview')?.textContent || '';
            navigator.clipboard.writeText(text).then(() => {
                const btn = g('traite-copy-btn');
                const orig = btn.innerHTML;
                btn.textContent = '✓ Copié !';
                btn.classList.add('traite-copy-feedback');
                setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('traite-copy-feedback'); }, 2000);
            });
        });

        // Initial article + preview
        articles.push({ mode: 'simple', content: '', subpoints: [{ label: '1', content: '' }] });
        renderArticles();
        updatePreview();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
