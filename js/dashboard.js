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

function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/* ════════════════════════════════════════════
   TRANSITS STRATEGIQUES — ADMIN
   ════════════════════════════════════════════ */
const TRANSIT_CONFIGS = {
    suez: {
        label: 'Canal de Suez',
        shortLabel: 'Suez',
        jsonPath: 'data/canal-suez.json',
        cacheKey: 'empire_canal_v1',
        shaKey: 'empire_canal_sha',
        idPrefix: 'canal',
        localFetchPath: '../data/canal-suez.json',
        description: 'Ajoutez ou modifiez un pays autorisé à transiter par le Canal de Suez. Définissez les taxes par catégorie de marchandise.'
    },
    gibraltar: {
        label: 'Détroit de Gibraltar',
        shortLabel: 'Gibraltar',
        jsonPath: 'data/detroit-gibraltar.json',
        cacheKey: 'empire_gibraltar_v1',
        shaKey: 'empire_gibraltar_sha',
        idPrefix: 'gibraltar',
        localFetchPath: '../data/detroit-gibraltar.json',
        description: 'Ajoutez ou modifiez un pays autorisé à passer par le Détroit de Gibraltar, co-géré par l\'Empire Hussein et la République Arabe du Maghreb.'
    }
};

const CANAL_IMG_DIR   = 'assets/drapeaux';

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
let _canalTransitKey     = 'suez';

/* ── INIT ───────────────────────────────────── */
function initCanalAdmin() {
    if (!document.getElementById('panel-canal')) return;

    document.getElementById('canal-transit-select')?.addEventListener('change', e => {
        setActiveTransit(e.target.value);
    });
    document.getElementById('canal-import-btn')?.addEventListener('click', () =>
        document.getElementById('canal-import-input')?.click());
    document.getElementById('canal-import-input')?.addEventListener('change', handleTransitJsonImport);
    document.getElementById('canal-download-json-btn')?.addEventListener('click', downloadCanalJson);
    document.getElementById('canal-push-json-btn')?.addEventListener('click', pushCurrentTransitJson);
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

    updateTransitUiCopy();
    resetCanalForm();
    const cached = getCanalCache();
    if (cached.items) { _canalItems = cached.items; renderCanalList(); } else { renderCanalList(); }
    loadCanalItemsFromGithub(false);
}

/* ── DATA ───────────────────────────────────── */
function getActiveTransitConfig() {
    return TRANSIT_CONFIGS[_canalTransitKey] || TRANSIT_CONFIGS.suez;
}

function setActiveTransit(key) {
    const nextKey = TRANSIT_CONFIGS[key] ? key : 'suez';
    if (_canalTransitKey === nextKey) return;
    _canalTransitKey = nextKey;
    _canalItems = [];
    resetCanalForm();
    updateTransitUiCopy();
    const cached = getCanalCache();
    if (cached.items) _canalItems = cached.items;
    renderCanalList();
    loadCanalItemsFromGithub(false);
}

function updateTransitUiCopy() {
    const cfg = getActiveTransitConfig();
    const select = document.getElementById('canal-transit-select');
    const desc = document.getElementById('canal-form-desc');
    const path = document.getElementById('canal-data-path');
    const syncBtn = document.getElementById('canal-sync-btn');
    if (select) select.value = _canalTransitKey;
    if (desc) desc.textContent = cfg.description;
    if (path) path.textContent = `Fichier : ${cfg.jsonPath}`;
    if (syncBtn) syncBtn.textContent = `Recharger ${cfg.shortLabel} depuis GitHub`;
}

function getCanalCache() {
    try { return JSON.parse(localStorage.getItem(getActiveTransitConfig().cacheKey) || '{}'); }
    catch { return {}; }
}

function setCanalCache(items) {
    localStorage.setItem(getActiveTransitConfig().cacheKey, JSON.stringify({ items, ts: Date.now() }));
}

async function loadCanalItemsFromGithub(showToastOnSuccess) {
    const cfg = getGithubConfig();
    const transit = getActiveTransitConfig();
    try {
        let data;
        if (cfg && cfg.repo && cfg.pat) {
            const res = await fetch(
                `https://api.github.com/repos/${cfg.repo}/contents/${transit.jsonPath}?ref=${cfg.branch || 'main'}`,
                { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
            );
            if (!res.ok) throw new Error((await res.json()).message || 'Erreur GitHub');
            const payload = await res.json();
            localStorage.setItem(transit.shaKey, payload.sha);
            const raw = atob(payload.content.replace(/\n/g, ''));
            data = JSON.parse(decodeURIComponent(escape(raw)));
        } else {
            const res = await fetch(transit.localFetchPath + '?t=' + Date.now());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            data = await res.json();
        }
        const fresh = Array.isArray(data) ? data : [];
        // En chargement automatique, ne pas écraser les données locales déjà en mémoire
        if (showToastOnSuccess || _canalItems.length === 0) {
            _canalItems = fresh;
            setCanalCache(_canalItems);
        }
        renderCanalList();
        if (showToastOnSuccess) showToast(`${_canalItems.length} pays chargé(s) pour ${transit.shortLabel}`);
    } catch (err) {
        const listEl = document.getElementById('canal-admin-list');
        if (listEl && _canalItems.length === 0) {
            listEl.innerHTML = `<div class="cat-admin-empty">Erreur : ${escapeHtml(err.message)}</div>`;
        }
        if (showToastOnSuccess) showToast(`Erreur : ${err.message}`);
    }
}

function handleTransitJsonImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            const items = normalizeTransitItems(parsed);
            if (!items.length) throw new Error('Le JSON ne contient aucun pays valide');
            _canalItems = items;
            setCanalCache(_canalItems);
            resetCanalForm();
            renderCanalList();
            showToast(`${items.length} pays importé(s) dans ${getActiveTransitConfig().shortLabel}`);
        } catch (err) {
            showToast(`Import JSON impossible : ${err.message}`);
        }
    };
    reader.readAsText(file);
}

function normalizeTransitItems(parsed) {
    const rawItems = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
    return rawItems
        .filter(item => item && typeof item === 'object' && String(item.nom || '').trim())
        .map((item, idx) => {
            const taxes = {};
            CANAL_TAXES.forEach(cat => {
                const raw = item.taxes?.[cat.id];
                taxes[cat.id] = (raw === null || raw === undefined || raw === '')
                    ? null
                    : Math.min(100, Math.max(0, parseFloat(raw) || 0));
            });
            return {
                id: String(item.id || `${getActiveTransitConfig().idPrefix}_${Date.now()}_${idx}`),
                nom: String(item.nom || '').trim(),
                continent: String(item.continent || '').trim(),
                drapeau: item.drapeau || null,
                taxes
            };
        });
}

function downloadCanalJson() {
    if (!_canalItems.length) { showToast('Aucun pays à télécharger'); return; }
    const transit = getActiveTransitConfig();
    const json = JSON.stringify(_canalItems, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = transit.jsonPath.split('/').pop();
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${transit.shortLabel} téléchargé`);
}

async function pushCurrentTransitJson() {
    if (!_canalItems.length) { showToast('Aucun pays à pousser'); return; }
    const btn = document.getElementById('canal-push-json-btn');
    const statusEl = document.getElementById('canal-push-status');
    const transit = getActiveTransitConfig();
    if (btn) btn.disabled = true;
    try {
        showCanalPushStatus(`Envoi du JSON ${transit.shortLabel}…`, null, statusEl);
        await pushCanalJson(`Update ${transit.label}: import JSON`);
        showCanalPushStatus(`JSON ${transit.shortLabel} poussé sur GitHub`, true, statusEl);
        showToast(`JSON ${transit.shortLabel} poussé sur GitHub`);
    } catch (err) {
        showCanalPushStatus(`Erreur : ${err.message}`, false, statusEl);
        showToast(`Erreur push JSON : ${err.message}`);
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* ── FLAG UPLOAD (preserve original transparency) ─────────────────── */
function handleCanalFlagUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const dataUrl = ev.target.result;
        if (typeof dataUrl !== 'string') return;
        _canalPendingFlag = {
            dataUrl,
            base64: dataUrl.split(',')[1],
            filename: slugify(file.name).replace(/\.[^.]+$/, '') + '-' + Date.now() + getImageExtension(file, dataUrl)
        };
        updateFlagPreview(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function getImageExtension(file, dataUrl) {
    const ext = (file.name.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
    if (['.png', '.webp', '.gif', '.jpg', '.jpeg'].includes(ext)) return ext;
    if (dataUrl.startsWith('data:image/png')) return '.png';
    if (dataUrl.startsWith('data:image/webp')) return '.webp';
    if (dataUrl.startsWith('data:image/gif')) return '.gif';
    if (dataUrl.startsWith('data:image/jpeg')) return '.jpg';
    return '.png';
}

function updateFlagPreview(dataUrl) {
    const preview  = document.getElementById('canal-flag-preview');
    const clearBtn = document.getElementById('canal-flag-clear');
    if (!preview) return;
    if (dataUrl) {
        preview.innerHTML = `<img src="${dashboardAssetSrc(dataUrl)}" alt="Aperçu">`;
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
    const id   = _canalEditingId || `${getActiveTransitConfig().idPrefix}_${Date.now()}`;
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
            showCanalPushStatus('Téléversement du drapeau…', null, statusEl);
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
            showCanalPushStatus('Envoi de la liste des pays…', null, statusEl);
            await pushCanalJson(`Update ${getActiveTransitConfig().label}: ${item.nom}`);
            showCanalPushStatus(`Pays « ${item.nom} » poussé sur GitHub`, true, statusEl);
            showToast(`« ${item.nom} » poussé sur GitHub`);
        } else {
            showToast(`« ${item.nom} » enregistré localement`);
        }

        resetCanalForm();
        renderCanalList();
    } catch (err) {
        showCanalPushStatus(`Erreur : ${err.message}`, false, statusEl);
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
    const transit = getActiveTransitConfig();
    if (!cfg || !cfg.repo || !cfg.pat) throw new Error('Configuration GitHub requise');

    let sha = localStorage.getItem(transit.shaKey);
    try {
        const probe = await fetch(
            `https://api.github.com/repos/${cfg.repo}/contents/${transit.jsonPath}?ref=${cfg.branch || 'main'}`,
            { headers: { Authorization: `token ${cfg.pat}`, Accept: 'application/vnd.github.v3+json' } }
        );
        if (probe.ok) { sha = (await probe.json()).sha; localStorage.setItem(transit.shaKey, sha); }
    } catch {}

    const json = JSON.stringify(_canalItems, null, 2);
    const body = {
        message: commitMessage,
        content: btoa(unescape(encodeURIComponent(json))),
        branch:  cfg.branch || 'main'
    };
    if (sha) body.sha = sha;

    const res = await fetch(
        `https://api.github.com/repos/${cfg.repo}/contents/${transit.jsonPath}`,
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
    if (data.content?.sha) localStorage.setItem(transit.shaKey, data.content.sha);
}

function showCanalPushStatus(msg, ok, el) {
    if (!el) return;
    el.style.display = 'block';
    el.className = 'github-status' + (ok === true ? ' github-status--ok' : ok === false ? ' github-status--err' : '');
    el.textContent = msg;
}

/* ── FORM RESET + EDIT ──────────────────────── */
function resetCanalForm() {
    _canalEditingId  = null;
    _canalPendingFlag = null;
    document.getElementById('canal-form-title').textContent = `NOUVEAU PAYS — ${getActiveTransitConfig().shortLabel.toUpperCase()}`;
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
    if (contSelEdit) {
        contSelEdit.selectedIndex = 0;
        if (item.continent) contSelEdit.value = item.continent;
    }
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
            await pushCanalJson(`Remove ${getActiveTransitConfig().label}: ${item.nom}`);
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
            ? `<img src="${escapeHtml(dashboardAssetSrc(item.drapeau))}" alt="" loading="lazy" onerror="this.style.display='none'">`
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

function dashboardAssetSrc(src) {
    if (!src) return '';
    if (/^(data:|https?:|\.{0,2}\/)/.test(src)) return src;
    return `../${src}`;
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
