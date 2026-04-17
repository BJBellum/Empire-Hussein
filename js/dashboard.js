/**
 * Empire Hussein — Dashboard JS
 * Handles: auth guard, sidebar nav, text editor,
 *          document storage, GitHub API integration
 */

/* ════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════ */
const DOCS_KEY    = 'empire_docs_v1';
const FOLDERS_KEY = 'empire_folders_v1';
const GH_KEY      = 'empire_github_config';

let currentDocId     = null;
let currentFolderId  = null;
let githubFileSHA    = null;

/* ════════════════════════════════════════════
   AUTH GUARD
   ════════════════════════════════════════════ */
document.addEventListener('auth:ready', ({ detail }) => {
    if (!detail.isAdmin) {
        document.getElementById('access-denied').style.display = 'flex';
        document.getElementById('dashboard-root').style.display = 'none';
        setupAccessDenied();
    } else {
        document.getElementById('access-denied').style.display = 'none';
        document.getElementById('dashboard-root').style.display = 'grid';
        initDashboard(detail.user);
    }
});

/* Fallback: if auth:ready never fires (edge case) */
window.addEventListener('load', () => {
    const root = document.getElementById('dashboard-root');
    if (root.style.display === 'none' &&
        document.getElementById('access-denied').style.display === 'none') {
        document.getElementById('access-denied').style.display = 'flex';
        setupAccessDenied();
    }
});

function setupAccessDenied() {
    const btn = document.getElementById('btn-access-login');
    if (btn && typeof Auth !== 'undefined') {
        btn.addEventListener('click', () => Auth.login());
    }
}

/* ════════════════════════════════════════════
   DASHBOARD INIT
   ════════════════════════════════════════════ */
function initDashboard(user) {
    renderSidebarUser(user);
    initNav();
    initSidebarToggle();
    initEditor();
    initDocuments();
    initGithub();
    loadGithubConfig();
    initCatalogueAdmin();
    initCanalAdmin();
}

/* ── Sidebar user info ──────────────────────── */
function renderSidebarUser(user) {
    const el = document.getElementById('sidebar-user');
    if (!el || !user) return;
    const avatarHash = user.avatar;
    const userId = user.id;
    const avatarSrc = avatarHash
        ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=64`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 5}.png`;
    el.innerHTML = `
        <img class="sidebar-user-avatar" src="${avatarSrc}" alt="Avatar" width="28" height="28">
        <span class="sidebar-user-name">${user.global_name || user.username}</span>
        <span class="sidebar-user-badge">ADMIN</span>
    `;
}

/* ════════════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════════════ */
function initNav() {
    const items = document.querySelectorAll('.nav-item[data-panel]');
    const titleEl = document.getElementById('current-panel-title');

    items.forEach(item => {
        item.addEventListener('click', () => {
            const panelId = item.dataset.panel;
            const panelTitle = item.dataset.title || panelId.toUpperCase();

            // Deactivate all
            items.forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));

            // Activate clicked
            item.classList.add('active');
            const panel = document.getElementById(`panel-${panelId}`);
            if (panel) {
                panel.classList.remove('hidden');
            }

            if (titleEl) titleEl.textContent = panelTitle;

            // Close mobile sidebar
            document.getElementById('sidebar')?.classList.remove('open');
        });
    });
}

/* ── Sidebar toggle (mobile) ────────────────── */
function initSidebarToggle() {
    const btn     = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;

    btn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            e.target !== btn && !btn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

/* ════════════════════════════════════════════
   VISITOR CHART (Canvas)
   ════════════════════════════════════════════ */
function generateVisitorData(days = 30) {
    // Use a deterministic seed for consistent data per session
    const stored = sessionStorage.getItem('empire_visitor_data');
    if (stored) return JSON.parse(stored);

    const data = [];
    let base = 85;
    for (let i = 0; i < days; i++) {
        // Pseudo-random using fixed seed-ish values
        const noise = Math.sin(i * 2.4 + 0.8) * 18 + Math.sin(i * 0.7 + 1.2) * 25;
        const val = Math.round(Math.max(20, Math.min(320, base + noise)));
        data.push(val);
    }
    sessionStorage.setItem('empire_visitor_data', JSON.stringify(data));
    return data;
}

function initVisitorChart() {
    drawVisitorChart();
}

function drawVisitorChart() {
    const canvas = document.getElementById('visitor-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // High-DPI
    const dpr  = window.devicePixelRatio || 1;
    const rect  = canvas.parentElement.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width  = rect.width + 'px';
    canvas.style.height = '200px';
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = 200;
    const PAD = { top: 16, right: 16, bottom: 32, left: 44 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const data  = generateVisitorData(30);
    const maxV  = Math.max(...data) * 1.15;
    const minV  = 0;
    const range = maxV - minV;

    const toX = (i) => PAD.left + (i / (data.length - 1)) * chartW;
    const toY = (v) => PAD.top + chartH - ((v - minV) / range) * chartH;

    ctx.clearRect(0, 0, W, H);

    // ── Grid lines ──
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.06)';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const y = PAD.top + (i / gridLines) * chartH;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + chartW, y);
        ctx.stroke();

        // Y labels
        const val = Math.round(maxV - (i / gridLines) * maxV);
        ctx.fillStyle = 'rgba(96, 88, 72, 0.8)';
        ctx.font = '10px Nunito, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(val, PAD.left - 6, y + 3.5);
    }

    // ── Area fill ──
    const gradient = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
    gradient.addColorStop(0, 'rgba(201, 168, 76, 0.18)');
    gradient.addColorStop(1, 'rgba(201, 168, 76, 0)');

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0]));
    for (let i = 1; i < data.length; i++) {
        const xm = (toX(i - 1) + toX(i)) / 2;
        ctx.bezierCurveTo(xm, toY(data[i - 1]), xm, toY(data[i]), toX(i), toY(data[i]));
    }
    ctx.lineTo(toX(data.length - 1), PAD.top + chartH);
    ctx.lineTo(toX(0), PAD.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // ── Line ──
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0]));
    for (let i = 1; i < data.length; i++) {
        const xm = (toX(i - 1) + toX(i)) / 2;
        ctx.bezierCurveTo(xm, toY(data[i - 1]), xm, toY(data[i]), toX(i), toY(data[i]));
    }
    ctx.strokeStyle = '#C9A84C';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── X-axis date labels (every 5 days) ──
    ctx.fillStyle = 'rgba(96, 88, 72, 0.8)';
    ctx.font = '9px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'center';
    const today = new Date();
    for (let i = 0; i < data.length; i += 5) {
        const d = new Date(today);
        d.setDate(today.getDate() - (data.length - 1 - i));
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        ctx.fillText(label, toX(i), H - 8);
    }
}

// Redraw on resize
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawVisitorChart, 150);
});

/* ════════════════════════════════════════════
   TEXT EDITOR
   ════════════════════════════════════════════ */
let boldFontActive = false;

/* Mapping vers les caractères mathématiques gras Unicode
   (Mathematical Bold Latin — U+1D400..U+1D433).
   Les accentués français sont composés avec des diacritiques. */
const BOLD_UPPER_BASE = 0x1D400; // 𝐀
const BOLD_LOWER_BASE = 0x1D41A; // 𝐚
const DIACRITIC_ACUTE      = '\u0301';
const DIACRITIC_GRAVE      = '\u0300';
const DIACRITIC_CIRCUMFLEX = '\u0302';
const DIACRITIC_DIAERESIS  = '\u0308';

const BOLD_ACCENTS = {
    'é': 'e' + DIACRITIC_ACUTE,      'É': 'E' + DIACRITIC_ACUTE,
    'à': 'a' + DIACRITIC_GRAVE,      'À': 'A' + DIACRITIC_GRAVE,
    'è': 'e' + DIACRITIC_GRAVE,      'È': 'E' + DIACRITIC_GRAVE,
    'ù': 'u' + DIACRITIC_GRAVE,      'Ù': 'U' + DIACRITIC_GRAVE,
    'â': 'a' + DIACRITIC_CIRCUMFLEX, 'Â': 'A' + DIACRITIC_CIRCUMFLEX,
    'ê': 'e' + DIACRITIC_CIRCUMFLEX, 'Ê': 'E' + DIACRITIC_CIRCUMFLEX,
    'î': 'i' + DIACRITIC_CIRCUMFLEX, 'Î': 'I' + DIACRITIC_CIRCUMFLEX,
    'ô': 'o' + DIACRITIC_CIRCUMFLEX, 'Ô': 'O' + DIACRITIC_CIRCUMFLEX,
    'û': 'u' + DIACRITIC_CIRCUMFLEX, 'Û': 'U' + DIACRITIC_CIRCUMFLEX,
    'ë': 'e' + DIACRITIC_DIAERESIS,  'Ë': 'E' + DIACRITIC_DIAERESIS,
    'ï': 'i' + DIACRITIC_DIAERESIS,  'Ï': 'I' + DIACRITIC_DIAERESIS,
    'ü': 'u' + DIACRITIC_DIAERESIS,  'Ü': 'U' + DIACRITIC_DIAERESIS
};

function boldLetter(ch) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90)  return String.fromCodePoint(BOLD_UPPER_BASE + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(BOLD_LOWER_BASE + (code - 97));
    return ch;
}

function toBoldFont(str) {
    let out = '';
    for (const ch of str) {
        const accent = BOLD_ACCENTS[ch];
        if (accent) {
            out += boldLetter(accent[0]) + accent.slice(1);
        } else {
            out += boldLetter(ch);
        }
    }
    return out;
}

function initEditor() {
    const textarea  = document.getElementById('editor-textarea');
    const countEl   = document.getElementById('char-count');
    const clearBtn  = document.getElementById('btn-editor-clear');
    const saveBtn   = document.getElementById('btn-editor-save');
    const charsToggle = document.getElementById('toggle-chars');
    const charsPanel  = document.getElementById('special-chars');
    const blankBtn    = document.getElementById('btn-insert-blank');
    const boldFontBtn = document.getElementById('toggle-boldfont');

    if (!textarea) return;

    // Character count
    textarea.addEventListener('input', updateCharCount);
    updateCharCount();

    // Toolbar buttons
    document.querySelectorAll('.toolbar-btn[data-format]').forEach(btn => {
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => applyFormat(btn.dataset.format));
    });

    // Blank character button (⠀ U+2800)
    if (blankBtn) {
        blankBtn.addEventListener('mousedown', (e) => e.preventDefault());
        blankBtn.addEventListener('click', () => insertAtCursor('\u2800'));
    }

    // Bold-font mode toggle (𝐚-𝐳, 𝐀-𝐙, diacritiques)
    if (boldFontBtn) {
        boldFontBtn.addEventListener('mousedown', (e) => e.preventDefault());
        boldFontBtn.addEventListener('click', () => {
            boldFontActive = !boldFontActive;
            boldFontBtn.classList.toggle('is-active', boldFontActive);
            boldFontBtn.setAttribute('aria-pressed', boldFontActive ? 'true' : 'false');
            textarea.focus();
        });
    }

    textarea.addEventListener('beforeinput', (e) => {
        if (!boldFontActive) return;
        if (typeof e.data !== 'string' || !e.data) return;
        const INSERT_TYPES = ['insertText', 'insertFromPaste', 'insertFromDrop', 'insertCompositionText', 'insertReplacementText'];
        if (!INSERT_TYPES.includes(e.inputType)) return;
        const converted = toBoldFont(e.data);
        if (converted === e.data) return;
        e.preventDefault();
        const ok = document.execCommand('insertText', false, converted);
        if (!ok) {
            const start = textarea.selectionStart;
            const end   = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + converted + textarea.value.substring(end);
            textarea.setSelectionRange(start + converted.length, start + converted.length);
        }
        updateCharCount();
    });

    // Special characters toggle
    if (charsToggle && charsPanel) {
        charsToggle.addEventListener('click', () => {
            const visible = charsPanel.style.display !== 'none';
            charsPanel.style.display = visible ? 'none' : 'flex';
            charsToggle.style.color = visible ? '' : 'var(--gold)';
        });
    }

    // Character buttons
    document.querySelectorAll('.char-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => insertAtCursor(btn.textContent));
    });

    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (textarea.value.trim() === '') return;
            if (confirm('Effacer tout le contenu de l\'éditeur ?')) {
                textarea.focus();
                textarea.select();
                document.execCommand('insertText', false, '');
                currentDocId = null;
                const titleIn = document.getElementById('editor-title-input');
                if (titleIn) titleIn.value = '';
                updateCharCount();
            }
        });
    }

    // Save button
    if (saveBtn) {
        saveBtn.addEventListener('click', openSaveModal);
    }

    // Tab + raccourcis clavier (Ctrl/Cmd + B, I, U, etc.)
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            insertAtCursor('  ');
            return;
        }
        const mod = e.ctrlKey || e.metaKey;
        if (!mod || e.altKey) return;
        const k = e.key.toLowerCase();
        const map = { b: 'bold', i: 'italic', u: 'underline', e: 'code' };
        if (map[k]) {
            e.preventDefault();
            applyFormat(map[k]);
        }
    });

    // Save modal
    initSaveModal();
}

function updateCharCount() {
    const textarea = document.getElementById('editor-textarea');
    const countEl  = document.getElementById('char-count');
    if (!textarea || !countEl) return;
    const n = textarea.value.length;
    countEl.textContent = `${n.toLocaleString('fr-FR')} caractère${n !== 1 ? 's' : ''}`;
}

/* ── Format applicator ──────────────────────── */
/* Utilise document.execCommand('insertText') pour conserver la pile
   d'annulation native (Ctrl+Z / Ctrl+Y). */
function applyFormat(format) {
    const textarea = document.getElementById('editor-textarea');
    if (!textarea) return;
    textarea.focus();

    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.substring(start, end);

    const LINE_FORMATS = {
        h1:    '# ',
        h2:    '## ',
        h3:    '### ',
        small: '-# ',
        quote: '> ',
    };

    const WRAP_FORMATS = {
        bold:      ['**',  '**'],
        italic:    ['*',   '*'],
        underline: ['__',  '__'],
        strike:    ['~~',  '~~'],
        spoiler:   ['||',  '||'],
        code:      ['`',   '`'],
        codeblock: ['```\n', '\n```'],
    };

    if (LINE_FORMATS[format]) {
        const prefix   = LINE_FORMATS[format];
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const linePrefix = value.substring(lineStart, lineStart + prefix.length);

        if (linePrefix === prefix) {
            textarea.setSelectionRange(lineStart, lineStart + prefix.length);
            document.execCommand('insertText', false, '');
            const newStart = Math.max(lineStart, start - prefix.length);
            const newEnd   = Math.max(lineStart, end - prefix.length);
            textarea.setSelectionRange(newStart, newEnd);
        } else {
            textarea.setSelectionRange(lineStart, lineStart);
            document.execCommand('insertText', false, prefix);
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }
    } else if (WRAP_FORMATS[format]) {
        const [pre, suf] = WRAP_FORMATS[format];
        textarea.setSelectionRange(start, end);
        document.execCommand('insertText', false, pre + (selected || '') + suf);
        if (selected) {
            textarea.setSelectionRange(start + pre.length, start + pre.length + selected.length);
        } else {
            textarea.setSelectionRange(start + pre.length, start + pre.length);
        }
    }

    updateCharCount();
}

function insertAtCursor(text) {
    const textarea = document.getElementById('editor-textarea');
    if (!textarea) return;
    textarea.focus();
    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
        // Fallback (pas de pile undo mais évite la perte de saisie)
        const start = textarea.selectionStart;
        const end   = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
        textarea.setSelectionRange(start + text.length, start + text.length);
    }
    updateCharCount();
}

/* ════════════════════════════════════════════
   DOCUMENT SAVE MODAL
   ════════════════════════════════════════════ */
function initSaveModal() {
    const modal       = document.getElementById('save-modal');
    const cancelBtn   = document.getElementById('btn-save-cancel');
    const confirmBtn  = document.getElementById('btn-save-confirm');
    const newFolderCb = document.getElementById('doc-new-folder-check');
    const newFolderIn = document.getElementById('doc-new-folder-name');

    if (!modal) return;

    cancelBtn?.addEventListener('click', () => modal.style.display = 'none');

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    newFolderCb?.addEventListener('change', () => {
        if (newFolderIn) {
            newFolderIn.style.display = newFolderCb.checked ? 'block' : 'none';
        }
    });

    confirmBtn?.addEventListener('click', () => {
        const titleInput  = document.getElementById('doc-title-input');
        const folderSel   = document.getElementById('doc-folder-select');
        const title = titleInput?.value.trim();

        if (!title) {
            titleInput?.focus();
            showToast('Entrez un titre pour le document');
            return;
        }

        let folderId = folderSel?.value || null;

        // Create new folder if needed
        if (newFolderCb?.checked) {
            const folderName = newFolderIn?.value.trim();
            if (folderName) {
                folderId = createFolder(folderName);
            }
        }

        const textarea = document.getElementById('editor-textarea');
        saveDocument(title, textarea?.value || '', folderId);
        modal.style.display = 'none';
        showToast(`Document « ${title} » enregistré`);
        renderDocumentsList();
    });
}

function openSaveModal() {
    const textarea = document.getElementById('editor-textarea');
    if (!textarea?.value.trim()) {
        showToast('L\'éditeur est vide — rien à enregistrer');
        return;
    }

    const modal     = document.getElementById('save-modal');
    const titleInp  = document.getElementById('doc-title-input');
    const folderSel = document.getElementById('doc-folder-select');

    // Pre-fill from editor title input or existing doc
    const editorTitleIn = document.getElementById('editor-title-input');
    if (currentDocId) {
        const docs = getDocs();
        const doc  = docs.find(d => d.id === currentDocId);
        if (doc && titleInp) titleInp.value = doc.title;
    } else {
        if (titleInp) titleInp.value = editorTitleIn?.value.trim() || '';
    }

    // Populate folder select
    if (folderSel) {
        folderSel.innerHTML = '<option value="">Aucun dossier</option>';
        getFolders().forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.name;
            if (currentDocId) {
                const docs = getDocs();
                const doc  = docs.find(d => d.id === currentDocId);
                if (doc && doc.folderId === f.id) opt.selected = true;
            }
            folderSel.appendChild(opt);
        });
    }

    const newFolderCb = document.getElementById('doc-new-folder-check');
    const newFolderIn = document.getElementById('doc-new-folder-name');
    if (newFolderCb) newFolderCb.checked = false;
    if (newFolderIn) { newFolderIn.style.display = 'none'; newFolderIn.value = ''; }

    if (modal) modal.style.display = 'flex';
    titleInp?.focus();
}

/* ════════════════════════════════════════════
   DOCUMENT STORAGE
   ════════════════════════════════════════════ */
function getDocs()    { return JSON.parse(localStorage.getItem(DOCS_KEY)    || '[]'); }
function getFolders() { return JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]'); }

function saveDocs(docs)       { localStorage.setItem(DOCS_KEY,    JSON.stringify(docs)); }
function saveFolders(folders) { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); }

function createFolder(name, parentId = null) {
    const folders = getFolders();
    const id = 'folder_' + Date.now();
    folders.push({ id, name, parentId, createdAt: Date.now() });
    saveFolders(folders);
    return id;
}

function saveDocument(title, content, folderId = null) {
    const docs = getDocs();
    if (currentDocId) {
        const doc = docs.find(d => d.id === currentDocId);
        if (doc) {
            doc.title     = title;
            doc.content   = content;
            doc.folderId  = folderId;
            doc.updatedAt = Date.now();
        }
    } else {
        const doc = {
            id:        'doc_' + Date.now(),
            title,
            content,
            folderId,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        docs.push(doc);
        currentDocId = doc.id;
    }
    saveDocs(docs);
}

function deleteDocument(id) {
    let docs = getDocs();
    docs = docs.filter(d => d.id !== id);
    saveDocs(docs);
    if (currentDocId === id) currentDocId = null;
}

/* ════════════════════════════════════════════
   DOCUMENTS PANEL
   ════════════════════════════════════════════ */
function initDocuments() {
    renderFolderList();
    renderDocumentsList();
    initFolderModal();
    initFolderDeleteModal();
    initRenameModal();
    initDocDeleteModal();

    document.getElementById('btn-new-folder')?.addEventListener('click', openFolderModal);

    document.getElementById('btn-export-docs')?.addEventListener('click', exportDocsJson);

    const importInput = document.getElementById('import-json-input');
    document.getElementById('btn-import-docs')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', (e) => {
        importDocsJson(e.target.files[0]);
        e.target.value = ''; // reset so same file can be re-imported
    });

    document.getElementById('btn-new-doc')?.addEventListener('click', () => {
        // Open editor panel
        const editorItem = document.querySelector('[data-panel="editeur"]');
        if (editorItem) editorItem.click();
        currentDocId = null;
        const ta = document.getElementById('editor-textarea');
        const titleIn = document.getElementById('editor-title-input');
        if (ta) { ta.value = ''; updateCharCount(); ta.focus(); }
        if (titleIn) titleIn.value = '';
    });
}

/* ── Folder creation modal ──────────────────── */
function openFolderModal() {
    const modal = document.getElementById('folder-modal');
    const input = document.getElementById('folder-name-input');
    if (!modal) return;
    if (input) input.value = '';
    modal.style.display = 'flex';
    setTimeout(() => input?.focus(), 50);
}

function initFolderModal() {
    const modal      = document.getElementById('folder-modal');
    const cancelBtn  = document.getElementById('btn-folder-cancel');
    const confirmBtn = document.getElementById('btn-folder-confirm');
    const input      = document.getElementById('folder-name-input');
    if (!modal) return;

    const close = () => { modal.style.display = 'none'; };

    cancelBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const doCreate = () => {
        const name = input?.value.trim();
        if (!name) { input?.focus(); showToast('Entrez un nom de dossier'); return; }
        createFolder(name);
        renderFolderList();
        showToast(`Dossier « ${name} » créé`);
        close();
    };

    confirmBtn?.addEventListener('click', doCreate);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCreate(); });
}

/* ── Folder delete modal ────────────────────── */
let _pendingDeleteFolderId = null;

function initFolderDeleteModal() {
    const modal      = document.getElementById('folder-delete-modal');
    const cancelBtn  = document.getElementById('btn-folder-delete-cancel');
    const confirmBtn = document.getElementById('btn-folder-delete-confirm');
    if (!modal) return;

    const close = () => { modal.style.display = 'none'; _pendingDeleteFolderId = null; };

    cancelBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    confirmBtn?.addEventListener('click', () => {
        if (!_pendingDeleteFolderId) return;
        // Collect this folder + all nested descendants
        const allIds = getAllDescendantFolderIds(_pendingDeleteFolderId);
        // Delete all docs inside any of those folders
        let docs = getDocs();
        docs = docs.filter(d => !allIds.includes(d.folderId));
        saveDocs(docs);
        // Delete all those folders
        let folders = getFolders();
        const deleted = folders.find(f => f.id === _pendingDeleteFolderId);
        folders = folders.filter(f => !allIds.includes(f.id));
        saveFolders(folders);
        // Reset selection if it was inside deleted tree
        if (allIds.includes(currentFolderId)) currentFolderId = null;
        close();
        renderFolderList();
        renderDocumentsList();
        showToast(`Dossier « ${deleted?.name || ''} » supprimé`);
    });
}

function openFolderDeleteModal(folderId, folderName) {
    _pendingDeleteFolderId = folderId;
    const modal  = document.getElementById('folder-delete-modal');
    const textEl = document.getElementById('folder-delete-text');
    if (textEl) textEl.textContent = `Supprimer « ${folderName} » et tous ses documents ?`;
    if (modal) modal.style.display = 'flex';
}

/* ════════════════════════════════════════════
   RENAME MODAL (folders + documents)
   ════════════════════════════════════════════ */
let _renameContext = null; // { type: 'folder'|'doc', id }

function openRenameModal(type, id, currentName) {
    _renameContext = { type, id };
    const modal    = document.getElementById('rename-modal');
    const input    = document.getElementById('rename-input');
    const titleEl  = document.getElementById('rename-modal-title');
    const labelEl  = document.getElementById('rename-modal-label');
    if (titleEl) titleEl.textContent = type === 'folder' ? 'RENOMMER LE DOSSIER' : 'RENOMMER LE DOCUMENT';
    if (labelEl) labelEl.textContent = type === 'folder' ? 'Nouveau nom du dossier' : 'Nouveau titre';
    if (input)   input.value = currentName;
    if (modal)   modal.style.display = 'flex';
    setTimeout(() => { input?.select(); }, 50);
}

function initRenameModal() {
    const modal      = document.getElementById('rename-modal');
    const cancelBtn  = document.getElementById('btn-rename-cancel');
    const confirmBtn = document.getElementById('btn-rename-confirm');
    const input      = document.getElementById('rename-input');
    if (!modal) return;

    const close = () => { modal.style.display = 'none'; _renameContext = null; };

    cancelBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const doRename = () => {
        const newName = input?.value.trim();
        if (!newName) { input?.focus(); showToast('Entrez un nouveau nom'); return; }
        if (!_renameContext) return;

        if (_renameContext.type === 'folder') {
            const folders = getFolders();
            const folder  = folders.find(f => f.id === _renameContext.id);
            if (folder) { folder.name = newName; saveFolders(folders); renderFolderList(); }
        } else {
            const docs = getDocs();
            const doc  = docs.find(d => d.id === _renameContext.id);
            if (doc) {
                doc.title     = newName;
                doc.updatedAt = Date.now();
                saveDocs(docs);
                renderDocumentsList();
                // Sync editor title input if this doc is currently open
                if (currentDocId === doc.id) {
                    const titleIn = document.getElementById('editor-title-input');
                    if (titleIn) titleIn.value = newName;
                }
            }
        }
        showToast(`Renommé en « ${newName} »`);
        close();
    };

    confirmBtn?.addEventListener('click', doRename);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRename(); });
}

/* ════════════════════════════════════════════
   DOCUMENT DELETE MODAL
   ════════════════════════════════════════════ */
let _pendingDeleteDocId = null;

function openDocDeleteModal(docId, docTitle) {
    _pendingDeleteDocId = docId;
    const modal  = document.getElementById('doc-delete-modal');
    const textEl = document.getElementById('doc-delete-text');
    if (textEl) textEl.textContent = `Supprimer « ${docTitle} » définitivement ?`;
    if (modal)   modal.style.display = 'flex';
}

function initDocDeleteModal() {
    const modal      = document.getElementById('doc-delete-modal');
    const cancelBtn  = document.getElementById('btn-doc-delete-cancel');
    const confirmBtn = document.getElementById('btn-doc-delete-confirm');
    if (!modal) return;

    const close = () => { modal.style.display = 'none'; _pendingDeleteDocId = null; };

    cancelBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    confirmBtn?.addEventListener('click', () => {
        if (!_pendingDeleteDocId) return;
        const docs  = getDocs();
        const doc   = docs.find(d => d.id === _pendingDeleteDocId);
        deleteDocument(_pendingDeleteDocId);
        renderDocumentsList();
        showToast(`Document « ${doc?.title || ''} » supprimé`);
        close();
    });
}

function renderFolderList() {
    const list = document.getElementById('folder-list');
    if (!list) return;
    list.innerHTML = '';

    // Root "Tous les documents" item
    const rootDiv = document.createElement('div');
    rootDiv.className = `folder-item${currentFolderId === null ? ' active' : ''}`;
    rootDiv.dataset.folder = '';
    rootDiv.innerHTML = `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 12V5l3-2h6l3 2v7H2z" stroke-linejoin="round"/>
        </svg>
        <span class="folder-item-name">Tous les documents</span>
    `;
    rootDiv.addEventListener('click', () => selectFolder(null, 'Tous les documents', rootDiv));
    setupFolderDrop(rootDiv, null);
    list.appendChild(rootDiv);

    // Recursive tree from root
    renderFolderNodes(null, 0, list);
}

function renderFolderNodes(parentId, depth, container) {
    const folders = getFolders().filter(f => (f.parentId || null) === parentId);
    folders.forEach(f => {
        const div = document.createElement('div');
        div.className = `folder-item${currentFolderId === f.id ? ' active' : ''}`;
        div.dataset.folder = f.id;
        div.draggable = true;
        div.style.paddingLeft = `${14 + depth * 14}px`;
        div.innerHTML = `
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 13V6l2.5-2h3L9 5.5h5V13H2z" stroke-linejoin="round"/>
            </svg>
            <span class="folder-item-name">${escapeHtml(f.name)}</span>
            <div class="folder-item-actions">
                <button class="folder-item-btn folder-item-gear" title="Renommer">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                        <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                    </svg>
                </button>
                <button class="folder-item-btn folder-item-delete" title="Supprimer">×</button>
            </div>
        `;

        // Click to select folder (ignore clicks on action buttons)
        div.addEventListener('click', (e) => {
            if (e.target.closest('.folder-item-actions')) return;
            selectFolder(f.id, f.name, div);
        });

        // Gear → rename
        div.querySelector('.folder-item-gear').addEventListener('click', (e) => {
            e.stopPropagation();
            openRenameModal('folder', f.id, f.name);
        });

        // × → delete
        div.querySelector('.folder-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            openFolderDeleteModal(f.id, f.name);
        });

        // Drag this folder
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', id: f.id }));
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => div.classList.add('dragging'), 0);
        });
        div.addEventListener('dragend', () => div.classList.remove('dragging'));

        // Accept drops onto this folder
        setupFolderDrop(div, f.id);

        container.appendChild(div);

        // Render children immediately after the parent
        renderFolderNodes(f.id, depth + 1, container);
    });
}

/* ── Folder selection ───────────────────────── */
function selectFolder(folderId, name, clickedEl) {
    currentFolderId = folderId;
    document.querySelectorAll('.folder-item').forEach(i => i.classList.remove('active'));
    clickedEl.classList.add('active');
    const titleEl = document.getElementById('docs-folder-title');
    if (titleEl) titleEl.textContent = name;
    renderDocumentsList();
}

/* ── Drop target setup ──────────────────────── */
function setupFolderDrop(el, targetFolderId) {
    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', (e) => {
        if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
    });
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        let payload;
        try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }

        if (payload.type === 'doc') {
            const docs = getDocs();
            const doc = docs.find(d => d.id === payload.id);
            if (doc && doc.folderId !== targetFolderId) {
                doc.folderId = targetFolderId;
                saveDocs(docs);
                renderFolderList();
                renderDocumentsList();
                showToast('Document déplacé');
            }
        } else if (payload.type === 'folder') {
            if (payload.id === targetFolderId) return;
            // Prevent dropping a folder into one of its own descendants
            if (targetFolderId && isFolderDescendantOf(targetFolderId, payload.id)) return;
            const folders = getFolders();
            const folder = folders.find(f => f.id === payload.id);
            if (folder && (folder.parentId || null) !== targetFolderId) {
                folder.parentId = targetFolderId;
                saveFolders(folders);
                if (currentFolderId === payload.id) currentFolderId = null;
                renderFolderList();
                renderDocumentsList();
                showToast('Dossier déplacé');
            }
        }
    });
}

/* ── Folder ancestry check ──────────────────── */
function isFolderDescendantOf(folderId, potentialAncestorId) {
    let current = getFolders().find(f => f.id === folderId);
    while (current) {
        if ((current.parentId || null) === potentialAncestorId) return true;
        current = getFolders().find(f => f.id === current.parentId);
    }
    return false;
}

function getAllDescendantFolderIds(folderId) {
    const ids = [folderId];
    getFolders()
        .filter(f => f.parentId === folderId)
        .forEach(child => ids.push(...getAllDescendantFolderIds(child.id)));
    return ids;
}

function renderDocumentsList() {
    const emptyEl   = document.getElementById('docs-empty');
    const listEl    = document.getElementById('docs-list');
    if (!emptyEl || !listEl) return;

    let docs = getDocs();
    if (currentFolderId !== null) {
        docs = docs.filter(d => d.folderId === currentFolderId);
    }
    docs.sort((a, b) => b.updatedAt - a.updatedAt);

    if (docs.length === 0) {
        emptyEl.style.display = 'flex';
        listEl.style.display  = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display  = 'flex';
    listEl.innerHTML      = '';

    docs.forEach(doc => {
        const div = document.createElement('div');
        div.className  = `doc-item${currentDocId === doc.id ? ' active' : ''}`;
        div.dataset.id = doc.id;

        const d = new Date(doc.updatedAt);
        const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

        div.draggable = true;
        div.innerHTML = `
            <svg class="doc-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 2h6l3 3v9H4V2z" stroke-linejoin="round"/>
                <polyline points="10,2 10,5 13,5" stroke-linejoin="round"/>
            </svg>
            <span class="doc-item-title">${escapeHtml(doc.title)}</span>
            <span class="doc-item-date">${dateStr}</span>
            <div class="doc-item-actions">
                <button class="doc-item-btn doc-item-gear" title="Options">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                        <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                    </svg>
                </button>
                <button class="doc-item-btn doc-item-del" title="Supprimer">×</button>
            </div>
        `;

        // Open doc on click (not on action buttons)
        div.addEventListener('click', (e) => {
            if (e.target.closest('.doc-item-actions')) return;
            openDocument(doc.id);
        });

        // Gear → options dropdown
        div.querySelector('.doc-item-gear').addEventListener('click', (e) => {
            e.stopPropagation();
            openDocOptions(doc.id, doc.title, e.currentTarget);
        });

        // × → delete
        div.querySelector('.doc-item-del').addEventListener('click', (e) => {
            e.stopPropagation();
            openDocDeleteModal(doc.id, doc.title);
        });

        // Drag this document
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'doc', id: doc.id }));
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => div.classList.add('dragging'), 0);
        });
        div.addEventListener('dragend', () => div.classList.remove('dragging'));
        listEl.appendChild(div);
    });
}

function openDocument(id) {
    const docs = getDocs();
    const doc  = docs.find(d => d.id === id);
    if (!doc) return;

    currentDocId = id;

    // Highlight in list
    document.querySelectorAll('.doc-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-id="${id}"]`)?.classList.add('active');

    // Show viewer
    const viewer = document.getElementById('doc-viewer');
    if (viewer) {
        viewer.style.display = 'block';
        const titleEl   = document.getElementById('doc-viewer-title');
        const contentEl = document.getElementById('doc-viewer-content');
        if (titleEl)   titleEl.textContent   = doc.title;
        if (contentEl) contentEl.textContent = doc.content;

        document.getElementById('btn-doc-edit')?.addEventListener('click', () => {
            const editorItem = document.querySelector('[data-panel="editeur"]');
            if (editorItem) editorItem.click();
            const ta = document.getElementById('editor-textarea');
            const titleIn = document.getElementById('editor-title-input');
            if (ta) { ta.value = doc.content; updateCharCount(); ta.focus(); }
            if (titleIn) titleIn.value = doc.title;
        }, { once: true });

        document.getElementById('btn-doc-delete')?.addEventListener('click', () => {
            if (confirm(`Supprimer le document « ${doc.title} » ?`)) {
                deleteDocument(id);
                viewer.style.display = 'none';
                renderDocumentsList();
                showToast('Document supprimé');
            }
        }, { once: true });
    }
}

/* ════════════════════════════════════════════
   GITHUB INTEGRATION
   ════════════════════════════════════════════ */
function loadGithubConfig() {
    const cfg = getGithubConfig();
    if (!cfg) return;

    const repoIn   = document.getElementById('github-repo');
    const patIn    = document.getElementById('github-pat');
    const branchIn = document.getElementById('github-branch');

    if (repoIn)   repoIn.value   = cfg.repo   || '';
    if (patIn)    patIn.value    = cfg.pat     || '';
    if (branchIn) branchIn.value = cfg.branch  || 'main';

    if (cfg.repo && cfg.pat) {
        const fileSection = document.getElementById('github-file-section');
        if (fileSection) fileSection.style.display = 'block';
    }
}

function getGithubConfig() {
    try {
        return JSON.parse(localStorage.getItem(GH_KEY) || 'null');
    } catch { return null; }
}

function initGithub() {
    const saveBtn   = document.getElementById('btn-github-save');
    const testBtn   = document.getElementById('btn-github-test');
    const fetchBtn  = document.getElementById('btn-github-fetch');
    const pushBtn   = document.getElementById('btn-github-push');
    const patToggle = document.getElementById('btn-toggle-pat');
    const patInput  = document.getElementById('github-pat');

    // PAT visibility toggle
    if (patToggle && patInput) {
        patToggle.addEventListener('click', () => {
            const show = patInput.type === 'password';
            patInput.type = show ? 'text' : 'password';
            const icon = document.getElementById('pat-eye-icon');
            if (icon) {
                icon.innerHTML = show
                    ? `<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/>`
                    : `<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>`;
            }
        });
    }

    // Save config
    saveBtn?.addEventListener('click', () => {
        const repo   = document.getElementById('github-repo')?.value.trim();
        const pat    = document.getElementById('github-pat')?.value.trim();
        const branch = document.getElementById('github-branch')?.value.trim() || 'main';

        if (!repo || !pat) {
            showToast('Dépôt et token requis');
            return;
        }
        if (!repo.includes('/')) {
            showToast('Format : proprietaire/depot');
            return;
        }

        localStorage.setItem(GH_KEY, JSON.stringify({ repo, pat, branch }));
        showToast('Configuration GitHub enregistrée');

        const fileSection = document.getElementById('github-file-section');
        if (fileSection) fileSection.style.display = 'block';
    });

    // Test connection
    testBtn?.addEventListener('click', async () => {
        const cfg = getGithubConfig();
        if (!cfg) { showToast('Enregistrez d\'abord la configuration'); return; }
        testBtn.textContent = 'Test…';
        testBtn.disabled = true;
        const statusEl = document.getElementById('github-status');

        try {
            const res = await fetch(`https://api.github.com/repos/${cfg.repo}`, {
                headers: {
                    Authorization: `token ${cfg.pat}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            });
            const data = await res.json();
            if (res.ok) {
                showGithubStatus(`Connexion réussie — ${data.full_name} (${data.visibility})`, true, statusEl);
            } else {
                showGithubStatus(`Erreur : ${data.message}`, false, statusEl);
            }
        } catch (err) {
            showGithubStatus(`Erreur réseau : ${err.message}`, false, statusEl);
        } finally {
            testBtn.textContent = 'Tester la connexion';
            testBtn.disabled = false;
        }
    });

    // Fetch file
    fetchBtn?.addEventListener('click', async () => {
        const cfg      = getGithubConfig();
        const filepath = document.getElementById('github-filepath')?.value.trim();
        if (!cfg || !filepath) { showToast('Configurez GitHub et entrez un chemin'); return; }

        fetchBtn.textContent = 'Chargement…';
        fetchBtn.disabled = true;

        try {
            const res = await fetch(
                `https://api.github.com/repos/${cfg.repo}/contents/${filepath}?ref=${cfg.branch || 'main'}`,
                { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
            );
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Fichier introuvable');

            githubFileSHA = data.sha;
            const content = atob(data.content.replace(/\n/g, ''));
            const editor  = document.getElementById('github-file-content');
            const block   = document.getElementById('github-editor-block');
            const commitIn = document.getElementById('github-commit-msg');

            if (editor) editor.value = content;
            if (block)  block.style.display = 'block';
            if (commitIn) commitIn.value = `Update ${filepath}`;
            showToast('Fichier chargé');
        } catch (err) {
            showToast(`Erreur : ${err.message}`);
        } finally {
            fetchBtn.textContent = 'Charger';
            fetchBtn.disabled = false;
        }
    });

    // Push file
    pushBtn?.addEventListener('click', async () => {
        const cfg      = getGithubConfig();
        const filepath = document.getElementById('github-filepath')?.value.trim();
        const content  = document.getElementById('github-file-content')?.value || '';
        const message  = document.getElementById('github-commit-msg')?.value.trim() || `Update ${filepath}`;

        if (!cfg || !filepath) { showToast('Configuration incomplète'); return; }
        if (!githubFileSHA) { showToast('Chargez le fichier d\'abord'); return; }

        pushBtn.disabled = true;
        pushBtn.querySelector('svg + text, span') && (pushBtn.textContent = 'Envoi…');

        try {
            const res = await fetch(
                `https://api.github.com/repos/${cfg.repo}/contents/${filepath}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `token ${cfg.pat}`,
                        Accept:        'application/vnd.github.v3+json',
                        'Content-Type':'application/json'
                    },
                    body: JSON.stringify({
                        message,
                        content: btoa(unescape(encodeURIComponent(content))),
                        sha:     githubFileSHA,
                        branch:  cfg.branch || 'main'
                    })
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Erreur lors du push');
            githubFileSHA = data.content?.sha || githubFileSHA;
            showToast(`Fichier poussé — ${message}`);
        } catch (err) {
            showToast(`Erreur push : ${err.message}`);
        } finally {
            pushBtn.disabled = false;
            pushBtn.innerHTML = `
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M8 12V4M4 8l4-4 4 4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Pousser les modifications`;
        }
    });
}

function showGithubStatus(msg, ok, el) {
    if (!el) return;
    el.style.display = 'block';
    el.className = `github-status github-status--${ok ? 'ok' : 'err'}`;
    el.textContent = msg;
}

/* ════════════════════════════════════════════
   DOCUMENT OPTIONS DROPDOWN
   ════════════════════════════════════════════ */
let _activeDocMenu = null;

function closeDocOptions() {
    if (_activeDocMenu) {
        _activeDocMenu.remove();
        _activeDocMenu = null;
    }
}

function openDocOptions(docId, docTitle, gearBtn) {
    closeDocOptions();

    const menu = document.createElement('div');
    menu.className = 'doc-options-menu';
    menu.innerHTML = `
        <button class="doc-options-item" id="doc-opt-edit">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 14l2-5L11 2.5l3 3L9 12.5 2 14z"/>
                <path d="M9 4l3 3"/>
            </svg>
            Modifier
        </button>
        <button class="doc-options-item" id="doc-opt-rename">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M3 4h10M8 4v8M6 12h4"/>
            </svg>
            Renommer
        </button>
    `;

    // Position relative to the gear button
    const rect = gearBtn.getBoundingClientRect();
    menu.style.top    = `${rect.bottom + 4}px`;
    menu.style.right  = `${window.innerWidth - rect.right}px`;
    document.body.appendChild(menu);
    _activeDocMenu = menu;

    // Modifier — open doc in editor
    menu.querySelector('#doc-opt-edit').addEventListener('click', () => {
        closeDocOptions();
        const docs = getDocs();
        const doc  = docs.find(d => d.id === docId);
        if (!doc) return;
        currentDocId = docId;
        const editorItem = document.querySelector('[data-panel="editeur"]');
        if (editorItem) editorItem.click();
        const ta      = document.getElementById('editor-textarea');
        const titleIn = document.getElementById('editor-title-input');
        if (ta)      { ta.value = doc.content; updateCharCount(); ta.focus(); }
        if (titleIn) titleIn.value = doc.title;
    });

    // Renommer
    menu.querySelector('#doc-opt-rename').addEventListener('click', () => {
        closeDocOptions();
        openRenameModal('doc', docId, docTitle);
    });

    // Close on any outside click
    setTimeout(() => {
        document.addEventListener('click', closeDocOptions, { once: true });
    }, 0);
}

/* ════════════════════════════════════════════
   JSON EXPORT / IMPORT
   ════════════════════════════════════════════ */
function exportDocsJson() {
    const data = {
        version:    1,
        exportedAt: new Date().toISOString(),
        folders:    getFolders(),
        docs:       getDocs()
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `empire-hussein-docs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Sauvegarde exportée');
}

function importDocsJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data.docs)) throw new Error('Format invalide');
            saveDocs(data.docs);
            if (Array.isArray(data.folders)) saveFolders(data.folders);
            if (typeof currentFolderId !== 'undefined') currentFolderId = null;
            renderFolderList();
            renderDocumentsList();
            showToast(`${data.docs.length} document${data.docs.length !== 1 ? 's' : ''} importé${data.docs.length !== 1 ? 's' : ''}`);
        } catch (err) {
            showToast(`Erreur d'importation : ${err.message}`);
        }
    };
    reader.readAsText(file);
}

/* ════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════ */
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ════════════════════════════════════════════
   CATALOGUE MILITAIRE — ADMIN
   ════════════════════════════════════════════ */
const CAT_JSON_PATH   = 'data/catalogue-militaire.json';
const CAT_IMG_DIR     = 'assets/images/catalogue';
const CAT_CACHE_KEY   = 'empire_cat_militaire_v1';
const CAT_SHA_KEY     = 'empire_cat_militaire_sha';

const CAT_NIV_LABELS = {
    1:  'I — 1910-1919',
    2:  'II — 1920-1929',
    3:  'III — 1930-1939',
    4:  'IV — 1940-1949',
    5:  'V — 1950-1959',
    6:  'VI — 1960-1969',
    7:  'VII — 1970-1979',
    8:  'VIII — 1980-1989',
    9:  'IX — 1990-1999',
    10: 'X — 2000-2009',
    11: 'XI — 2010-2019',
    12: 'XII — 2020+'
};

const CAT_CATEGORY_LABELS = {
    'armes-feu':             'Armes à feu',
    'explosifs':             'Explosifs',
    'vehicules-terrestres':  'Véhicules terrestres',
    'artillerie':            'Artillerie',
    'aeronefs':              'Aéronefs',
    'navires':               'Navires',
    'sous-marins':           'Sous-marins',
    'missiles':              'Missiles',
    'missiles-strategiques': 'Missiles stratégiques'
};

const CAT_SUBTYPES = {
    'armes-feu': [
        'Pistolet', 'Pistolet mitrailleur', 'Fusil', 'Fusil d\'assaut',
        'Fusil de précision', 'Mitrailleuse', 'Fusil à pompe',
        'Lance-roquette', 'Lance-grenade', 'Lance-flammes'
    ],
    'explosifs': [
        'Grenade', 'Grenade fumigène', 'Mines (AP/AT/Autre)',
        'Charge explosive', 'Dispositif improvisé', 'Torpille'
    ],
    'vehicules-terrestres': [
        'Véhicule léger', 'Véhicule utilitaire', 'Transport de troupes blindé (APC)',
        'Véhicule de Combat d\'infanterie (IFV)', 'Char léger (LT)',
        'Char moyen (MT)', 'Char de Combat Principal (MBT)', 'Char lourd (HT)',
        'Chasseur de chars', 'Canon automoteur', 'Obusier automoteur',
        'Lance roquette multiple (LRM)', 'Véhicule de soutien', 'Véhicule du génie'
    ],
    'artillerie': [
        'Mortier d\'infanterie (-7 cm)', 'Mortier de Campagne (7-12 cm)',
        'Mortier Lourd (+12 cm)', 'Artillerie de Campagne (7-16 cm)',
        'Artillerie Lourde (+16 cm)', 'Canon Anti-Char Léger (-8cm)',
        'Canon Anti-Char Lourd (+ 8cm)', 'Canon Anti-Aérien Léger',
        'Canon Anti-Aérien Lourd', 'Lance-roquettes remorqué'
    ],
    'aeronefs': [
        'Avion à hélice (AH) - Chasse', 'Avion à hélice (AH) - Attaque',
        'Avion à hélice (AH) - Bombardier', 'Avion à hélice (AH) - Transport',
        'Avion à Réaction (AR) - Chasse', 'Avion à Réaction (AR) - Intercepteur',
        'Avion à Réaction (AR) - Attaque', 'AR - Bombardier Tactique',
        'AR - Bombardier Stratégique', 'AR - Bombardier Lourd',
        'Avion de transport', 'Avion radar (AWACS)',
        'Gyrocoptère/Hélicoptère', 'Hélicoptère d\'attaque',
        'Drone / UAV'
    ],
    'navires': [
        'Patrouilleur', 'Corvette', 'Frégate', 'Destroyer', 'Croiseur',
        'Cuirassé', 'Porte-avions léger', 'Porte-avions',
        'Navire amphibie', 'Navire de soutien', 'Navire logistique'
    ],
    'sous-marins': [
        'Sous-marin côtier', 'Sous-marin d\'attaque conventionnel',
        'Sous-marin d\'attaque nucléaire (SNA)',
        'Sous-marin lance-missiles balistiques (SNLE)',
        'Sous-marin de poche'
    ],
    'missiles': [
        'Missile antichar', 'Missile anti-aérien (SAM)',
        'Missile air-air', 'Missile air-sol', 'Missile de croisière',
        'Missile antinavire', 'Roquette non guidée'
    ],
    'missiles-strategiques': [
        'Missile balistique à courte portée (SRBM)',
        'Missile balistique à moyenne portée (MRBM)',
        'Missile balistique à portée intermédiaire (IRBM)',
        'Missile balistique intercontinental (ICBM)',
        'Missile balistique lancé en mer (SLBM)'
    ]
};

const CAT_PRESETS = {
    'armes-feu': [
        'Calibre', 'Masse (non chargé)', 'Longueur', 'Longueur du canon',
        'Cadence de tir', 'Vitesse initiale', 'Portée pratique', 'Portée maximale',
        'Capacité', 'Type de munitions', 'Équipements possibles'
    ],
    'explosifs': [
        'Délai', 'Portée de lancer', 'Poids', 'Longueur', 'Largeur/Diamètre',
        'Portée létale', 'Type d\'explosif'
    ],
    'vehicules-terrestres': [
        'Moteur', 'Carburant', 'Transmission', 'Poids à vide',
        'Vitesse max. (Route)', 'Vitesse max. (Tout-terrain)',
        'Autonomie (Route)', 'Autonomie (Tout-terrain)', 'Type de suspensions',
        'Longueur', 'Largeur', 'Hauteur',
        'Membres d\'équipage', 'Passagers', 'Cargaison',
        'Blindage Caisse : Arrière', 'Blindage Caisse : Côté',
        'Blindage Caisse : Front', 'Blindage Caisse : Plancher',
        'Blindage Caisse : Toit',
        'Blindage Tourelle : Arrière', 'Blindage Tourelle : Côté',
        'Blindage Tourelle : Toit',
        'Armement', 'Munitions'
    ],
    'artillerie': [
        'Calibre', 'Équipage', 'Masse (non chargé)', 'Longueur',
        'Longueur du canon', 'Cadence de tir', 'Vitesse initiale',
        'Système de visée', 'Portée maximale', 'Munitions'
    ],
    'aeronefs': [
        'Moteur', 'Carburant', 'Cargaison et équipage',
        'Vitesse maximale', 'Vitesse ascensionnelle', 'Plafond', 'Rayon d\'action',
        'Poids à vide', 'Poids chargé maximal',
        'Envergure', 'Longueur', 'Hauteur', 'Surface alaire',
        'Armement', 'Équipement'
    ],
    'navires': [
        'Propulsion', 'Déplacement', 'Longueur', 'Largeur', 'Tirant d\'eau',
        'Vitesse maximale', 'Autonomie', 'Équipage',
        'Armement principal', 'Armement secondaire', 'Défense',
        'Aéronefs embarqués', 'Équipement'
    ],
    'sous-marins': [
        'Propulsion', 'Déplacement (surface)', 'Déplacement (immersion)',
        'Longueur', 'Diamètre', 'Profondeur maximale',
        'Vitesse (surface)', 'Vitesse (immersion)', 'Autonomie',
        'Équipage', 'Armement', 'Équipement (sonar/guerre électronique)'
    ],
    'missiles': [
        'Type', 'Longueur', 'Diamètre', 'Envergure', 'Masse', 'Charge utile',
        'Propulsion', 'Portée minimale', 'Portée maximale',
        'Vitesse maximale', 'Système de guidage', 'Plateforme de lancement'
    ],
    'missiles-strategiques': [
        'Classe', 'Longueur', 'Diamètre', 'Masse au lancement',
        'Propulsion (étages)', 'Charge utile', 'Type d\'ogive',
        'Portée minimale', 'Portée maximale', 'Vitesse de rentrée',
        'Précision (CEP)', 'Système de guidage', 'Plateforme de lancement'
    ]
};

let _catItems = [];
let _catEditingId = null;
let _catPendingImage = null;        // { dataUrl, base64, filename }
let _catDeleteTargetId = null;
let _catCustomSpecFields = [];      // { key, value } — only for current form

/* ── INIT ───────────────────────────────────── */
function initCatalogueAdmin() {
    if (!document.getElementById('panel-cat-militaire')) return;

    document.getElementById('cat-categorie')?.addEventListener('change', onCatCategoryChange);
    document.getElementById('cat-form-save')?.addEventListener('click', () => saveCatalogueItem(false));
    document.getElementById('cat-form-push')?.addEventListener('click', () => saveCatalogueItem(true));
    document.getElementById('cat-form-reset')?.addEventListener('click', resetCatForm);
    document.getElementById('cat-specs-add')?.addEventListener('click', addCustomSpecField);
    document.getElementById('cat-img-btn')?.addEventListener('click', () =>
        document.getElementById('cat-img-input')?.click());
    document.getElementById('cat-img-input')?.addEventListener('change', handleCatImageUpload);
    document.getElementById('cat-img-clear')?.addEventListener('click', clearCatImage);
    document.getElementById('cat-sync-btn')?.addEventListener('click', () => loadCatItemsFromGithub(true));
    document.getElementById('cat-list-search')?.addEventListener('input', renderCatList);
    document.getElementById('cat-list-filter')?.addEventListener('change', renderCatList);

    // Populate niveau select
    const nivSel = document.getElementById('cat-niveau');
    if (nivSel && nivSel.options.length <= 1) {
        Object.entries(CAT_NIV_LABELS).forEach(([n, label]) => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.textContent = label;
            nivSel.appendChild(opt);
        });
    }

    // Delete modal wiring
    const delModal   = document.getElementById('cat-delete-modal');
    const delCancel  = document.getElementById('btn-cat-delete-cancel');
    const delConfirm = document.getElementById('btn-cat-delete-confirm');
    const closeDel = () => {
        if (delModal) delModal.style.display = 'none';
        _catDeleteTargetId = null;
    };
    delCancel?.addEventListener('click', closeDel);
    delModal?.addEventListener('click', e => { if (e.target === delModal) closeDel(); });
    delConfirm?.addEventListener('click', () => deleteCatItem(_catDeleteTargetId));

    // Preload cache, then refresh from GitHub if possible
    const cached = getCatCache();
    if (cached.items) {
        _catItems = cached.items;
        renderCatList();
    } else {
        renderCatList();
    }
    loadCatItemsFromGithub(false);
}

/* ── DATA LOADING ───────────────────────────── */
function getCatCache() {
    try {
        return JSON.parse(localStorage.getItem(CAT_CACHE_KEY) || '{}');
    } catch { return {}; }
}

function setCatCache(items) {
    localStorage.setItem(CAT_CACHE_KEY, JSON.stringify({ items, ts: Date.now() }));
}

async function loadCatItemsFromGithub(showToastOnSuccess) {
    const cfg = getGithubConfig();
    try {
        let data, sha = null;
        if (cfg && cfg.repo && cfg.pat) {
            const res = await fetch(
                `https://api.github.com/repos/${cfg.repo}/contents/${CAT_JSON_PATH}?ref=${cfg.branch || 'main'}`,
                { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
            );
            if (!res.ok) throw new Error((await res.json()).message || 'Erreur GitHub');
            const payload = await res.json();
            sha = payload.sha;
            const raw = atob(payload.content.replace(/\n/g, ''));
            data = JSON.parse(decodeURIComponent(escape(raw)));
            localStorage.setItem(CAT_SHA_KEY, sha);
        } else {
            // Fallback: fetch local JSON directly
            const res = await fetch('../data/catalogue-militaire.json' + '?t=' + Date.now());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            data = await res.json();
        }
        _catItems = Array.isArray(data) ? data : [];
        setCatCache(_catItems);
        renderCatList();
        if (showToastOnSuccess) showToast(`Inventaire chargé — ${_catItems.length} équipement(s)`);
    } catch (err) {
        const listEl = document.getElementById('cat-admin-list');
        if (listEl && _catItems.length === 0) {
            listEl.innerHTML = `<div class="cat-admin-empty">Erreur de chargement : ${escapeHtml(err.message)}</div>`;
        }
        if (showToastOnSuccess) showToast(`Erreur : ${err.message}`);
    }
}

/* ── FORM : CATEGORY CHANGE ─────────────────── */
function onCatCategoryChange() {
    const cat = document.getElementById('cat-categorie').value;
    renderSubtypeOptions(cat);
    renderSpecFields(cat);
}

function renderSubtypeOptions(cat, selectedVal = '') {
    const sel = document.getElementById('cat-soustype');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Aucun —</option>';
    if (!cat) {
        sel.innerHTML = '<option value="">— Choisir une catégorie d\'abord —</option>';
        return;
    }
    const list = CAT_SUBTYPES[cat] || [];
    list.forEach(s => {
        const o = document.createElement('option');
        o.value = s;
        o.textContent = s;
        if (s === selectedVal) o.selected = true;
        sel.appendChild(o);
    });
    // If selectedVal exists but not in preset list, add it
    if (selectedVal && !list.includes(selectedVal)) {
        const o = document.createElement('option');
        o.value = selectedVal;
        o.textContent = selectedVal;
        o.selected = true;
        sel.appendChild(o);
    }
    // Allow custom entry
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '+ Autre (texte libre)…';
    sel.appendChild(customOpt);
}

function renderSpecFields(cat, existingSpecs = null) {
    const container = document.getElementById('cat-specs-fields');
    const hint = document.getElementById('cat-specs-hint');
    if (!container) return;
    container.innerHTML = '';

    const preset = CAT_PRESETS[cat];
    if (!preset) {
        if (hint) hint.style.display = 'block';
        return;
    }
    if (hint) hint.style.display = 'none';

    preset.forEach(key => {
        container.appendChild(buildSpecRow(key, existingSpecs?.[key] || '', false));
    });

    // If editing and existing specs have keys not in preset, render them as custom rows
    if (existingSpecs) {
        Object.entries(existingSpecs).forEach(([k, v]) => {
            if (!preset.includes(k)) {
                container.appendChild(buildSpecRow(k, v, true));
            }
        });
    }
}

function buildSpecRow(key, value, editableKey) {
    const row = document.createElement('div');
    row.className = 'cat-spec-row' + (editableKey ? ' cat-spec-row--custom' : '');
    row.innerHTML = `
        ${editableKey
            ? `<input class="form-input cat-spec-key" type="text" placeholder="Nom du champ" value="${escapeHtml(key)}">`
            : `<label class="cat-spec-label">${escapeHtml(key)}</label>`}
        <input class="form-input cat-spec-val" type="text" placeholder="Valeur" value="${escapeHtml(value)}">
        ${editableKey ? `<button type="button" class="btn-icon cat-spec-remove" title="Retirer"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5"/></svg></button>` : ''}
    `;
    if (editableKey) {
        row.querySelector('.cat-spec-remove').addEventListener('click', () => row.remove());
    }
    return row;
}

function addCustomSpecField() {
    const container = document.getElementById('cat-specs-fields');
    if (!container) return;
    container.appendChild(buildSpecRow('', '', true));
}

/* ── IMAGE UPLOAD (2:1 crop) ────────────────── */
function handleCatImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const { canvas, dataUrl } = cropTo2x1(img);
            _catPendingImage = {
                dataUrl,
                base64: dataUrl.split(',')[1],
                filename: slugify(file.name).replace(/\.[^.]+$/, '') + '-' + Date.now() + '.jpg'
            };
            updateImagePreview(dataUrl);
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function cropTo2x1(img) {
    const ratio = 2 / 1;
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const srcRatio = srcW / srcH;

    let cropW, cropH, sx, sy;
    if (srcRatio > ratio) {
        cropH = srcH;
        cropW = srcH * ratio;
        sx = (srcW - cropW) / 2;
        sy = 0;
    } else {
        cropW = srcW;
        cropH = srcW / ratio;
        sx = 0;
        sy = (srcH - cropH) / 2;
    }

    const MAX_W = 1400;
    const outW = Math.min(MAX_W, Math.round(cropW));
    const outH = Math.round(outW / ratio);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
    return { canvas, dataUrl: canvas.toDataURL('image/jpeg', 0.88) };
}

function updateImagePreview(dataUrl) {
    const preview = document.getElementById('cat-img-preview');
    const clearBtn = document.getElementById('cat-img-clear');
    if (!preview) return;
    if (dataUrl) {
        preview.innerHTML = `<img src="${dataUrl}" alt="Aperçu" style="width:100%;height:100%;object-fit:cover;">`;
        preview.classList.add('has-image');
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    } else {
        preview.innerHTML = `
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2">
                <rect x="6" y="10" width="36" height="28"/>
                <path d="M6 30l12-10 10 8 14-12"/>
                <circle cx="16" cy="18" r="2"/>
            </svg>
            <span class="cat-img-placeholder">Aucune image</span>`;
        preview.classList.remove('has-image');
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

function clearCatImage() {
    _catPendingImage = null;
    document.getElementById('cat-image-path').value = '';
    updateImagePreview(null);
}

function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/* ── FORM : READ + SAVE ─────────────────────── */
function collectCatFormItem() {
    const id = _catEditingId || 'cat_' + Date.now();
    const specs = {};
    document.querySelectorAll('#cat-specs-fields .cat-spec-row').forEach(row => {
        const keyEl = row.querySelector('.cat-spec-key');
        const labelEl = row.querySelector('.cat-spec-label');
        const valEl = row.querySelector('.cat-spec-val');
        const key = keyEl ? keyEl.value.trim() : (labelEl ? labelEl.textContent.trim() : '');
        const val = valEl ? valEl.value.trim() : '';
        if (key && val) specs[key] = val;
    });

    let sousType = document.getElementById('cat-soustype').value;
    if (sousType === '__custom__') {
        sousType = prompt('Sous-type personnalisé :') || '';
    }

    const nivRaw = document.getElementById('cat-niveau').value;

    return {
        id,
        nom:           document.getElementById('cat-nom').value.trim(),
        categorie:     document.getElementById('cat-categorie').value,
        soustype:      sousType,
        niveau:        nivRaw ? parseInt(nivRaw, 10) : null,
        fabricant:     document.getElementById('cat-fabricant').value.trim(),
        cout_unite:    document.getElementById('cat-cout').value.trim(),
        inspiration:   document.getElementById('cat-inspiration').value.trim(),
        disponibilite: document.getElementById('cat-disponibilite').value.trim(),
        specs,
        image_path:    document.getElementById('cat-image-path').value.trim() || null
    };
}

async function saveCatalogueItem(pushToGh) {
    const item = collectCatFormItem();
    if (!item.nom) { showToast('Le nom est requis'); return; }
    if (!item.categorie) { showToast('La catégorie est requise'); return; }

    const saveBtn = document.getElementById('cat-form-save');
    const pushBtn = document.getElementById('cat-form-push');
    const statusEl = document.getElementById('cat-push-status');
    if (saveBtn) saveBtn.disabled = true;
    if (pushBtn) pushBtn.disabled = true;

    try {
        // 1. Upload image to GitHub if pending and pushing
        if (pushToGh && _catPendingImage) {
            showCatPushStatus('Téléversement de l\'image…', null, statusEl);
            const path = await uploadCatImage(_catPendingImage);
            item.image_path = path;
            _catPendingImage = null;
        } else if (_catPendingImage) {
            // Save locally with data URL as preview only (not persisted to GitHub)
            item.image_path = _catPendingImage.dataUrl;
        }

        // 2. Update _catItems
        const idx = _catItems.findIndex(i => i.id === item.id);
        if (idx >= 0) _catItems[idx] = item;
        else _catItems.push(item);
        setCatCache(_catItems);

        // 3. Push JSON if requested
        if (pushToGh) {
            showCatPushStatus('Envoi de l\'inventaire…', null, statusEl);
            await pushCatJson(`Update catalogue: ${item.nom}`);
            showCatPushStatus(`Équipement « ${item.nom} » poussé sur GitHub`, true, statusEl);
            showToast(`« ${item.nom} » poussé sur GitHub`);
        } else {
            showToast(`« ${item.nom} » enregistré localement`);
        }

        resetCatForm();
        renderCatList();
    } catch (err) {
        showCatPushStatus(`Erreur : ${err.message}`, false, statusEl);
        showToast(`Erreur : ${err.message}`);
    } finally {
        if (saveBtn) saveBtn.disabled = false;
        if (pushBtn) pushBtn.disabled = false;
    }
}

async function uploadCatImage(pending) {
    const cfg = getGithubConfig();
    if (!cfg || !cfg.repo || !cfg.pat) throw new Error('Configuration GitHub requise pour l\'upload d\'image');

    const path = `${CAT_IMG_DIR}/${pending.filename}`;
    const res = await fetch(
        `https://api.github.com/repos/${cfg.repo}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `token ${cfg.pat}`,
                Accept:        'application/vnd.github.v3+json',
                'Content-Type':'application/json'
            },
            body: JSON.stringify({
                message: `Add catalogue image: ${pending.filename}`,
                content: pending.base64,
                branch:  cfg.branch || 'main'
            })
        }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur upload image');
    return path;
}

async function pushCatJson(commitMessage) {
    const cfg = getGithubConfig();
    if (!cfg || !cfg.repo || !cfg.pat) throw new Error('Configuration GitHub requise');

    // Always fetch the latest SHA before pushing
    let sha = localStorage.getItem(CAT_SHA_KEY);
    try {
        const probe = await fetch(
            `https://api.github.com/repos/${cfg.repo}/contents/${CAT_JSON_PATH}?ref=${cfg.branch || 'main'}`,
            { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
        );
        if (probe.ok) {
            sha = (await probe.json()).sha;
            localStorage.setItem(CAT_SHA_KEY, sha);
        }
    } catch {}

    const json = JSON.stringify(_catItems, null, 2);
    const body = {
        message: commitMessage,
        content: btoa(unescape(encodeURIComponent(json))),
        branch:  cfg.branch || 'main'
    };
    if (sha) body.sha = sha;

    const res = await fetch(
        `https://api.github.com/repos/${cfg.repo}/contents/${CAT_JSON_PATH}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `token ${cfg.pat}`,
                Accept:        'application/vnd.github.v3+json',
                'Content-Type':'application/json'
            },
            body: JSON.stringify(body)
        }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur push JSON');
    if (data.content?.sha) localStorage.setItem(CAT_SHA_KEY, data.content.sha);
}

function showCatPushStatus(msg, ok, el) {
    if (!el) return;
    el.style.display = 'block';
    el.className = 'github-status' + (ok === true ? ' github-status--ok' : ok === false ? ' github-status--err' : '');
    el.textContent = msg;
}

/* ── FORM : RESET + EDIT ────────────────────── */
function resetCatForm() {
    _catEditingId = null;
    _catPendingImage = null;
    document.getElementById('cat-form-title').textContent = 'NOUVEL EQUIPEMENT';
    document.getElementById('cat-nom').value = '';
    document.getElementById('cat-categorie').value = '';
    document.getElementById('cat-niveau').value = '';
    document.getElementById('cat-fabricant').value = '';
    document.getElementById('cat-cout').value = '';
    document.getElementById('cat-inspiration').value = '';
    document.getElementById('cat-disponibilite').value = '';
    document.getElementById('cat-image-path').value = '';
    renderSubtypeOptions('');
    renderSpecFields('');
    updateImagePreview(null);
    const st = document.getElementById('cat-push-status');
    if (st) st.style.display = 'none';
}

function editCatItem(id) {
    const item = _catItems.find(i => i.id === id);
    if (!item) return;
    _catEditingId = item.id;

    document.getElementById('cat-form-title').textContent = `MODIFIER — ${item.nom}`;
    document.getElementById('cat-nom').value = item.nom || '';
    document.getElementById('cat-categorie').value = item.categorie || '';
    document.getElementById('cat-niveau').value = item.niveau || '';
    document.getElementById('cat-fabricant').value = item.fabricant || '';
    document.getElementById('cat-cout').value = item.cout_unite || '';
    document.getElementById('cat-inspiration').value = item.inspiration || '';
    document.getElementById('cat-disponibilite').value = item.disponibilite || '';
    document.getElementById('cat-image-path').value = item.image_path || '';

    renderSubtypeOptions(item.categorie || '', item.soustype || '');
    renderSpecFields(item.categorie || '', item.specs || {});

    _catPendingImage = null;
    if (item.image_path) {
        updateImagePreview(item.image_path);
    } else {
        updateImagePreview(null);
    }

    document.querySelector('.dashboard-main')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function openCatDeleteModal(id, name) {
    _catDeleteTargetId = id;
    const modal = document.getElementById('cat-delete-modal');
    const text = document.getElementById('cat-delete-text');
    if (text) text.textContent = `Supprimer « ${name} » ?`;
    if (modal) modal.style.display = 'flex';
}

async function deleteCatItem(id) {
    if (!id) return;
    const modal = document.getElementById('cat-delete-modal');
    const item = _catItems.find(i => i.id === id);
    if (!item) { if (modal) modal.style.display = 'none'; return; }

    const confirmBtn = document.getElementById('btn-cat-delete-confirm');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
        _catItems = _catItems.filter(i => i.id !== id);
        setCatCache(_catItems);

        const cfg = getGithubConfig();
        if (cfg && cfg.repo && cfg.pat) {
            await pushCatJson(`Remove catalogue: ${item.nom}`);
            showToast(`« ${item.nom} » supprimé (local + GitHub)`);
        } else {
            showToast(`« ${item.nom} » supprimé localement`);
        }
        renderCatList();
        if (_catEditingId === id) resetCatForm();
    } catch (err) {
        showToast(`Erreur suppression : ${err.message}`);
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
        if (modal) modal.style.display = 'none';
        _catDeleteTargetId = null;
    }
}

/* ── LIST RENDER ────────────────────────────── */
function renderCatList() {
    const listEl = document.getElementById('cat-admin-list');
    const countEl = document.getElementById('cat-list-count');
    if (!listEl) return;

    if (countEl) countEl.textContent = _catItems.length;

    const filterCat = document.getElementById('cat-list-filter')?.value || 'all';
    const search = (document.getElementById('cat-list-search')?.value || '').trim().toLowerCase();

    let items = [..._catItems];
    if (filterCat !== 'all') items = items.filter(i => i.categorie === filterCat);
    if (search) {
        items = items.filter(i =>
            [i.nom, i.soustype, i.fabricant, i.inspiration].filter(Boolean)
                .join(' ').toLowerCase().includes(search)
        );
    }

    if (items.length === 0) {
        listEl.innerHTML = `<div class="cat-admin-empty">Aucun équipement à afficher.</div>`;
        return;
    }

    listEl.innerHTML = items.map(item => {
        const catLabel = CAT_CATEGORY_LABELS[item.categorie] || item.categorie || '';
        const niv = item.niveau ? `NIV ${CAT_NIV_LABELS[item.niveau]?.split(' ')[0] || item.niveau}` : '';
        const imgBlock = item.image_path
            ? `<img src="${escapeHtml(item.image_path)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="cat-admin-item-noimg">—</div>`;
        return `
            <div class="cat-admin-item" data-id="${escapeHtml(item.id)}">
                <div class="cat-admin-item-img">${imgBlock}</div>
                <div class="cat-admin-item-body">
                    <div class="cat-admin-item-head">
                        <h4 class="cat-admin-item-name">${escapeHtml(item.nom || '')}</h4>
                        ${niv ? `<span class="cat-admin-item-niv">${escapeHtml(niv)}</span>` : ''}
                    </div>
                    <div class="cat-admin-item-meta">
                        <span>${escapeHtml(catLabel)}</span>
                        ${item.soustype ? `<span>·</span><span>${escapeHtml(item.soustype)}</span>` : ''}
                        ${item.fabricant ? `<span>·</span><span>${escapeHtml(item.fabricant)}</span>` : ''}
                    </div>
                </div>
                <div class="cat-admin-item-actions">
                    <button class="btn-icon cat-move-up" title="Monter (double-clic = en tête)">
                        <!-- icones.js.org — tabler:arrow-up -->
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 5v14M5 12l7-7 7 7"/>
                        </svg>
                    </button>
                    <button class="btn-icon cat-move-down" title="Descendre (double-clic = en fin)">
                        <!-- icones.js.org — tabler:arrow-down -->
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 5v14M5 12l7 7 7-7"/>
                        </svg>
                    </button>
                    <button class="btn-icon cat-edit" title="Modifier">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 14l2-5L11 2.5l3 3L9 12.5 2 14z"/>
                            <path d="M9 4l3 3"/>
                        </svg>
                    </button>
                    <button class="btn-icon cat-del" title="Supprimer">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                            <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l1 9a1 1 0 001 1h2a1 1 0 001-1l1-9"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    listEl.querySelectorAll('.cat-admin-item').forEach(el => {
        const id = el.dataset.id;
        const item = _catItems.find(i => i.id === id);
        el.querySelector('.cat-edit')?.addEventListener('click', () => editCatItem(id));
        el.querySelector('.cat-del')?.addEventListener('click', () => openCatDeleteModal(id, item?.nom || ''));
        attachMoveBtn(el.querySelector('.cat-move-up'),   id, 'up');
        attachMoveBtn(el.querySelector('.cat-move-down'), id, 'down');
    });
}

function attachMoveBtn(btn, id, dir) {
    if (!btn) return;
    let timer = null;
    btn.addEventListener('click', () => {
        if (timer !== null) return;
        timer = setTimeout(() => {
            timer = null;
            moveCatItem(id, dir);
        }, 220);
    });
    btn.addEventListener('dblclick', () => {
        clearTimeout(timer);
        timer = null;
        moveCatItem(id, dir === 'up' ? 'top' : 'bottom');
    });
}

function moveCatItem(id, direction) {
    const idx = _catItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    let newIdx;
    if      (direction === 'up')     newIdx = Math.max(0, idx - 1);
    else if (direction === 'down')   newIdx = Math.min(_catItems.length - 1, idx + 1);
    else if (direction === 'top')    newIdx = 0;
    else                             newIdx = _catItems.length - 1;
    if (newIdx === idx) return;
    const [item] = _catItems.splice(idx, 1);
    _catItems.splice(newIdx, 0, item);
    setCatCache(_catItems);
    renderCatList();
}

/* ════════════════════════════════════════════
   CANAL DE SUEZ — ADMIN
   ════════════════════════════════════════════ */
const CANAL_JSON_PATH = 'data/canal-suez.json';
const CANAL_IMG_DIR   = 'assets/drapeaux';
const CANAL_CACHE_KEY = 'empire_canal_v1';
const CANAL_SHA_KEY   = 'empire_canal_sha';

const CANAL_TAXES = [
    { id: 'matieres_premieres',      label: 'Matières Premières' },
    { id: 'produits_manufactures',   label: 'Produits Manufacturés' },
    { id: 'materiel_militaire',      label: 'Matériel Militaire' },
    { id: 'materiel_industriel',     label: 'Matériel Industriel' },
    { id: 'ressources_energetiques', label: 'Ressources Énergétiques' },
];

let _canalItems          = [];
let _canalEditingId      = null;
let _canalPendingFlag    = null;
let _canalDeleteTargetId = null;

/* ── INIT ───────────────────────────────────── */
function initCanalAdmin() {
    if (!document.getElementById('panel-canal')) return;

    document.getElementById('canal-flag-btn')?.addEventListener('click', () =>
        document.getElementById('canal-flag-input')?.click());
    document.getElementById('canal-flag-input')?.addEventListener('change', handleCanalFlagUpload);
    document.getElementById('canal-flag-clear')?.addEventListener('click', clearCanalFlag);
    document.getElementById('canal-form-save')?.addEventListener('click', () => saveCanalItem(false));
    document.getElementById('canal-form-push')?.addEventListener('click', () => saveCanalItem(true));
    document.getElementById('canal-form-reset')?.addEventListener('click', resetCanalForm);
    document.getElementById('canal-sync-btn')?.addEventListener('click', () => loadCanalItemsFromGithub(true));
    document.getElementById('canal-list-search')?.addEventListener('input', renderCanalList);

    CANAL_TAXES.forEach(cat => {
        const cb  = document.getElementById(`canal-blocked-${cat.id}`);
        const inp = document.getElementById(`canal-tax-${cat.id}`);
        if (cb && inp) {
            cb.addEventListener('change', () => {
                inp.disabled = cb.checked;
                inp.style.opacity = cb.checked ? '0.3' : '';
            });
        }
    });

    const delModal   = document.getElementById('canal-delete-modal');
    const delCancel  = document.getElementById('btn-canal-delete-cancel');
    const delConfirm = document.getElementById('btn-canal-delete-confirm');
    const closeDel = () => {
        if (delModal) delModal.style.display = 'none';
        _canalDeleteTargetId = null;
    };
    delCancel?.addEventListener('click', closeDel);
    delModal?.addEventListener('click', e => { if (e.target === delModal) closeDel(); });
    delConfirm?.addEventListener('click', () => deleteCanalItem(_canalDeleteTargetId));

    const cached = getCanalCache();
    if (cached.items) { _canalItems = cached.items; renderCanalList(); } else { renderCanalList(); }
    loadCanalItemsFromGithub(false);
}

/* ── DATA ───────────────────────────────────── */
function getCanalCache() {
    try { return JSON.parse(localStorage.getItem(CANAL_CACHE_KEY) || '{}'); }
    catch { return {}; }
}

function setCanalCache(items) {
    localStorage.setItem(CANAL_CACHE_KEY, JSON.stringify({ items, ts: Date.now() }));
}

async function loadCanalItemsFromGithub(showToastOnSuccess) {
    const cfg = getGithubConfig();
    try {
        let data;
        if (cfg && cfg.repo && cfg.pat) {
            const res = await fetch(
                `https://api.github.com/repos/${cfg.repo}/contents/${CANAL_JSON_PATH}?ref=${cfg.branch || 'main'}`,
                { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
            );
            if (!res.ok) throw new Error((await res.json()).message || 'Erreur GitHub');
            const payload = await res.json();
            localStorage.setItem(CANAL_SHA_KEY, payload.sha);
            const raw = atob(payload.content.replace(/\n/g, ''));
            data = JSON.parse(decodeURIComponent(escape(raw)));
        } else {
            const res = await fetch('../data/canal-suez.json?t=' + Date.now());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            data = await res.json();
        }
        _canalItems = Array.isArray(data) ? data : [];
        setCanalCache(_canalItems);
        renderCanalList();
        if (showToastOnSuccess) showToast(`${_canalItems.length} pays chargé(s)`);
    } catch (err) {
        const listEl = document.getElementById('canal-admin-list');
        if (listEl && _canalItems.length === 0) {
            listEl.innerHTML = `<div class="cat-admin-empty">Erreur : ${escapeHtml(err.message)}</div>`;
        }
        if (showToastOnSuccess) showToast(`Erreur : ${err.message}`);
    }
}

/* ── FLAG UPLOAD (1:1 crop) ─────────────────── */
function handleCanalFlagUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const { dataUrl } = cropToSquare(img);
            _canalPendingFlag = {
                dataUrl,
                base64: dataUrl.split(',')[1],
                filename: slugify(file.name).replace(/\.[^.]+$/, '') + '-' + Date.now() + '.jpg'
            };
            updateFlagPreview(dataUrl);
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function cropToSquare(img) {
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const size = Math.min(srcW, srcH);
    const sx = (srcW - size) / 2;
    const sy = (srcH - size) / 2;
    const outSize = Math.min(400, size);
    const canvas = document.createElement('canvas');
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, size, size, 0, 0, outSize, outSize);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.88) };
}

function updateFlagPreview(dataUrl) {
    const preview  = document.getElementById('canal-flag-preview');
    const clearBtn = document.getElementById('canal-flag-clear');
    if (!preview) return;
    if (dataUrl) {
        preview.innerHTML = `<img src="${dataUrl}" alt="Aperçu" style="width:150px;height:150px;object-fit:cover;">`;
        preview.classList.add('has-image');
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    } else {
        preview.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="5" width="20" height="14" rx="1"/>
                <path d="M2 9h20M2 13h20M7 5V3M17 5V3"/>
            </svg>
            <span class="canal-flag-placeholder">Aucun drapeau</span>`;
        preview.classList.remove('has-image');
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

function clearCanalFlag() {
    _canalPendingFlag = null;
    document.getElementById('canal-flag-path').value = '';
    updateFlagPreview(null);
}

/* ── FORM SAVE ──────────────────────────────── */
function collectCanalFormItem() {
    const id   = _canalEditingId || 'canal_' + Date.now();
    const taxes = {};
    CANAL_TAXES.forEach(cat => {
        const blocked = document.getElementById(`canal-blocked-${cat.id}`)?.checked;
        const val     = document.getElementById(`canal-tax-${cat.id}`)?.value;
        taxes[cat.id] = blocked ? null : Math.min(100, Math.max(0, parseFloat(val) || 0));
    });
    return {
        id,
        nom:       document.getElementById('canal-nom')?.value.trim() || '',
        continent: document.getElementById('canal-continent')?.value || '',
        drapeau:   document.getElementById('canal-flag-path')?.value.trim() || null,
        taxes
    };
}

async function saveCanalItem(pushToGh) {
    const item    = collectCanalFormItem();
    if (!item.nom) { showToast('Le nom du pays est requis'); return; }

    const saveBtn  = document.getElementById('canal-form-save');
    const pushBtn  = document.getElementById('canal-form-push');
    const statusEl = document.getElementById('canal-push-status');
    if (saveBtn) saveBtn.disabled = true;
    if (pushBtn) pushBtn.disabled = true;

    try {
        if (pushToGh && _canalPendingFlag) {
            showCatPushStatus('Téléversement du drapeau…', null, statusEl);
            const path = await uploadCanalFlag(_canalPendingFlag);
            item.drapeau = path;
            _canalPendingFlag = null;
        } else if (_canalPendingFlag) {
            item.drapeau = _canalPendingFlag.dataUrl;
        }

        const idx = _canalItems.findIndex(i => i.id === item.id);
        if (idx >= 0) _canalItems[idx] = item;
        else _canalItems.push(item);
        setCanalCache(_canalItems);

        if (pushToGh) {
            showCatPushStatus('Envoi de la liste des pays…', null, statusEl);
            await pushCanalJson(`Update canal de suez: ${item.nom}`);
            showCatPushStatus(`Pays « ${item.nom} » poussé sur GitHub`, true, statusEl);
            showToast(`« ${item.nom} » poussé sur GitHub`);
        } else {
            showToast(`« ${item.nom} » enregistré localement`);
        }

        resetCanalForm();
        renderCanalList();
    } catch (err) {
        showCatPushStatus(`Erreur : ${err.message}`, false, statusEl);
        showToast(`Erreur : ${err.message}`);
    } finally {
        if (saveBtn) saveBtn.disabled = false;
        if (pushBtn) pushBtn.disabled = false;
    }
}

async function uploadCanalFlag(pending) {
    const cfg = getGithubConfig();
    if (!cfg || !cfg.repo || !cfg.pat) throw new Error('Configuration GitHub requise');
    const path = `${CANAL_IMG_DIR}/${pending.filename}`;
    const res = await fetch(
        `https://api.github.com/repos/${cfg.repo}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                Authorization:  `token ${cfg.pat}`,
                Accept:         'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Add drapeau: ${pending.filename}`,
                content: pending.base64,
                branch:  cfg.branch || 'main'
            })
        }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur upload drapeau');
    return path;
}

async function pushCanalJson(commitMessage) {
    const cfg = getGithubConfig();
    if (!cfg || !cfg.repo || !cfg.pat) throw new Error('Configuration GitHub requise');

    let sha = localStorage.getItem(CANAL_SHA_KEY);
    try {
        const probe = await fetch(
            `https://api.github.com/repos/${cfg.repo}/contents/${CANAL_JSON_PATH}?ref=${cfg.branch || 'main'}`,
            { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
        );
        if (probe.ok) { sha = (await probe.json()).sha; localStorage.setItem(CANAL_SHA_KEY, sha); }
    } catch {}

    const json = JSON.stringify(_canalItems, null, 2);
    const body = {
        message: commitMessage,
        content: btoa(unescape(encodeURIComponent(json))),
        branch:  cfg.branch || 'main'
    };
    if (sha) body.sha = sha;

    const res = await fetch(
        `https://api.github.com/repos/${cfg.repo}/contents/${CANAL_JSON_PATH}`,
        {
            method: 'PUT',
            headers: {
                Authorization:  `token ${cfg.pat}`,
                Accept:         'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur push JSON');
    if (data.content?.sha) localStorage.setItem(CANAL_SHA_KEY, data.content.sha);
}

/* ── FORM RESET + EDIT ──────────────────────── */
function resetCanalForm() {
    _canalEditingId  = null;
    _canalPendingFlag = null;
    document.getElementById('canal-form-title').textContent = 'NOUVEAU PAYS';
    document.getElementById('canal-nom').value = '';
    const contSel = document.getElementById('canal-continent');
    if (contSel) contSel.value = '';
    document.getElementById('canal-flag-path').value = '';
    updateFlagPreview(null);
    CANAL_TAXES.forEach(cat => {
        const cb  = document.getElementById(`canal-blocked-${cat.id}`);
        const inp = document.getElementById(`canal-tax-${cat.id}`);
        if (cb)  { cb.checked = false; }
        if (inp) { inp.value = '0'; inp.disabled = false; inp.style.opacity = ''; }
    });
    const st = document.getElementById('canal-push-status');
    if (st) st.style.display = 'none';
}

function editCanalItem(id) {
    const item = _canalItems.find(i => i.id === id);
    if (!item) return;
    _canalEditingId = item.id;

    document.getElementById('canal-form-title').textContent = `MODIFIER — ${item.nom}`;
    document.getElementById('canal-nom').value = item.nom || '';
    const contSelEdit = document.getElementById('canal-continent');
    if (contSelEdit) contSelEdit.value = item.continent || '';
    document.getElementById('canal-flag-path').value = item.drapeau || '';

    _canalPendingFlag = null;
    updateFlagPreview(item.drapeau || null);

    CANAL_TAXES.forEach(cat => {
        const cb  = document.getElementById(`canal-blocked-${cat.id}`);
        const inp = document.getElementById(`canal-tax-${cat.id}`);
        const val = item.taxes?.[cat.id];
        if (cb && inp) {
            const blocked = val === null || val === undefined;
            cb.checked    = blocked;
            inp.disabled  = blocked;
            inp.style.opacity = blocked ? '0.3' : '';
            inp.value     = blocked ? '0' : String(val ?? 0);
        }
    });

    document.querySelector('.dashboard-main')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function openCanalDeleteModal(id, name) {
    _canalDeleteTargetId = id;
    const modal  = document.getElementById('canal-delete-modal');
    const textEl = document.getElementById('canal-delete-text');
    if (textEl) textEl.textContent = `Supprimer « ${name} » ?`;
    if (modal)  modal.style.display = 'flex';
}

async function deleteCanalItem(id) {
    if (!id) return;
    const modal = document.getElementById('canal-delete-modal');
    const item  = _canalItems.find(i => i.id === id);
    if (!item) { if (modal) modal.style.display = 'none'; return; }

    const confirmBtn = document.getElementById('btn-canal-delete-confirm');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
        _canalItems = _canalItems.filter(i => i.id !== id);
        setCanalCache(_canalItems);

        const cfg = getGithubConfig();
        if (cfg && cfg.repo && cfg.pat) {
            await pushCanalJson(`Remove canal de suez: ${item.nom}`);
            showToast(`« ${item.nom} » supprimé (local + GitHub)`);
        } else {
            showToast(`« ${item.nom} » supprimé localement`);
        }
        renderCanalList();
        if (_canalEditingId === id) resetCanalForm();
    } catch (err) {
        showToast(`Erreur suppression : ${err.message}`);
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
        if (modal) modal.style.display = 'none';
        _canalDeleteTargetId = null;
    }
}

/* ── LIST RENDER ────────────────────────────── */
function renderCanalList() {
    const listEl  = document.getElementById('canal-admin-list');
    const countEl = document.getElementById('canal-list-count');
    if (!listEl) return;
    if (countEl) countEl.textContent = _canalItems.length;

    const search = (document.getElementById('canal-list-search')?.value || '').trim().toLowerCase();
    let items = [..._canalItems];
    if (search) items = items.filter(i => i.nom?.toLowerCase().includes(search));

    if (items.length === 0) {
        listEl.innerHTML = `<div class="cat-admin-empty">Aucun pays enregistré.</div>`;
        return;
    }

    listEl.innerHTML = items.map(item => {
        const flagHtml = item.drapeau
            ? `<img src="${escapeHtml(item.drapeau)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : '';

        const taxSummary = CANAL_TAXES.map(cat => {
            const val = item.taxes?.[cat.id];
            return (val === null || val === undefined) ? '✕' : `${val}%`;
        }).join(' / ');

        return `
            <div class="cat-admin-item" data-id="${escapeHtml(item.id)}">
                <div class="cat-admin-item-img" style="width:40px;height:40px;overflow:hidden;">${flagHtml}</div>
                <div class="cat-admin-item-body">
                    <div class="cat-admin-item-head">
                        <h4 class="cat-admin-item-name">${escapeHtml(item.nom || '')}</h4>
                    </div>
                    <div class="cat-admin-item-meta">
                        ${item.continent ? `<span style="font-size:11px;color:var(--gold);margin-right:8px;">${escapeHtml(item.continent)}</span>` : ''}
                        <span style="font-size:11px;">${escapeHtml(taxSummary)}</span>
                    </div>
                </div>
                <div class="cat-admin-item-actions">
                    <button class="btn-icon canal-move-up" title="Monter (double-clic = en tête)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 5v14M5 12l7-7 7 7"/>
                        </svg>
                    </button>
                    <button class="btn-icon canal-move-down" title="Descendre (double-clic = en fin)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 5v14M5 12l7 7 7-7"/>
                        </svg>
                    </button>
                    <button class="btn-icon canal-edit" title="Modifier">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 14l2-5L11 2.5l3 3L9 12.5 2 14z"/>
                            <path d="M9 4l3 3"/>
                        </svg>
                    </button>
                    <button class="btn-icon canal-del" title="Supprimer">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                            <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4l1 9a1 1 0 001 1h2a1 1 0 001-1l1-9"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    listEl.querySelectorAll('.cat-admin-item').forEach(el => {
        const id   = el.dataset.id;
        const item = _canalItems.find(i => i.id === id);
        el.querySelector('.canal-edit')?.addEventListener('click', () => editCanalItem(id));
        el.querySelector('.canal-del')?.addEventListener('click', () => openCanalDeleteModal(id, item?.nom || ''));
        attachCanalMoveBtn(el.querySelector('.canal-move-up'),   id, 'up');
        attachCanalMoveBtn(el.querySelector('.canal-move-down'), id, 'down');
    });
}

function attachCanalMoveBtn(btn, id, dir) {
    if (!btn) return;
    let timer = null;
    btn.addEventListener('click', () => {
        if (timer !== null) return;
        timer = setTimeout(() => { timer = null; moveCanalItem(id, dir); }, 220);
    });
    btn.addEventListener('dblclick', () => {
        clearTimeout(timer);
        timer = null;
        moveCanalItem(id, dir === 'up' ? 'top' : 'bottom');
    });
}

function moveCanalItem(id, direction) {
    const idx = _canalItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    let newIdx;
    if      (direction === 'up')   newIdx = Math.max(0, idx - 1);
    else if (direction === 'down') newIdx = Math.min(_canalItems.length - 1, idx + 1);
    else if (direction === 'top')  newIdx = 0;
    else                           newIdx = _canalItems.length - 1;
    if (newIdx === idx) return;
    const [item] = _canalItems.splice(idx, 1);
    _canalItems.splice(newIdx, 0, item);
    setCanalCache(_canalItems);
    renderCanalList();
}
