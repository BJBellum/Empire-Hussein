/**
 * Empire Hussein — Dashboard JS
 * Handles: auth guard, sidebar nav, visitor chart, text editor,
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
    initVisitorChart();
    initEditor();
    initDocuments();
    initGithub();
    loadGithubConfig();
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

            // Lazy-init canvas if needed
            if (panelId === 'apercu') {
                setTimeout(drawVisitorChart, 50);
            }
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
function initEditor() {
    const textarea  = document.getElementById('editor-textarea');
    const countEl   = document.getElementById('char-count');
    const clearBtn  = document.getElementById('btn-editor-clear');
    const saveBtn   = document.getElementById('btn-editor-save');
    const charsToggle = document.getElementById('toggle-chars');
    const charsPanel  = document.getElementById('special-chars');

    if (!textarea) return;

    // Character count
    textarea.addEventListener('input', updateCharCount);
    updateCharCount();

    // Toolbar buttons
    document.querySelectorAll('.toolbar-btn[data-format]').forEach(btn => {
        btn.addEventListener('click', () => applyFormat(btn.dataset.format));
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
        btn.addEventListener('click', () => insertAtCursor(btn.textContent));
    });

    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (textarea.value.trim() === '') return;
            if (confirm('Effacer tout le contenu de l\'éditeur ?')) {
                textarea.value = '';
                currentDocId = null;
                updateCharCount();
                textarea.focus();
            }
        });
    }

    // Save button
    if (saveBtn) {
        saveBtn.addEventListener('click', openSaveModal);
    }

    // Tab key in textarea
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            insertAtCursor('  ');
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
    // Discord limit warning
    countEl.style.color = n > 1900 ? '#e05252' : n > 1500 ? '#e09a52' : '';
}

/* ── Format applicator ──────────────────────── */
function applyFormat(format) {
    const textarea = document.getElementById('editor-textarea');
    if (!textarea) return;

    const start    = textarea.selectionStart;
    const end      = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const before   = textarea.value.substring(0, start);
    const after    = textarea.value.substring(end);

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
        // Find line start
        const lineStart = (before.lastIndexOf('\n') + 1);
        const linePrefix = textarea.value.substring(lineStart, lineStart + prefix.length);

        let newVal;
        let newCursor;

        if (linePrefix === prefix) {
            // Remove prefix
            newVal = textarea.value.substring(0, lineStart)
                   + textarea.value.substring(lineStart + prefix.length);
            newCursor = start - prefix.length;
        } else {
            // Add prefix
            newVal = textarea.value.substring(0, lineStart)
                   + prefix
                   + textarea.value.substring(lineStart);
            newCursor = start + prefix.length;
        }
        textarea.value = newVal;
        textarea.setSelectionRange(newCursor, newCursor + (end - start));
    } else if (WRAP_FORMATS[format]) {
        const [pre, suf] = WRAP_FORMATS[format];
        const newText = pre + (selected || '') + suf;
        textarea.value = before + newText + after;
        if (selected) {
            textarea.setSelectionRange(start + pre.length, start + pre.length + selected.length);
        } else {
            textarea.setSelectionRange(start + pre.length, start + pre.length);
        }
    }

    textarea.focus();
    updateCharCount();
}

function insertAtCursor(text) {
    const textarea = document.getElementById('editor-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
    textarea.setSelectionRange(start + text.length, start + text.length);
    textarea.focus();
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

    // Pre-fill if editing existing doc
    if (currentDocId) {
        const docs = getDocs();
        const doc  = docs.find(d => d.id === currentDocId);
        if (doc && titleInp) titleInp.value = doc.title;
    } else {
        if (titleInp) titleInp.value = '';
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

function createFolder(name) {
    const folders = getFolders();
    const id = 'folder_' + Date.now();
    folders.push({ id, name, createdAt: Date.now() });
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

    document.getElementById('btn-new-folder')?.addEventListener('click', () => {
        const name = prompt('Nom du nouveau dossier :');
        if (name?.trim()) {
            createFolder(name.trim());
            renderFolderList();
            showToast(`Dossier « ${name.trim()} » créé`);
        }
    });

    document.getElementById('btn-new-doc')?.addEventListener('click', () => {
        // Open editor panel
        const editorItem = document.querySelector('[data-panel="editeur"]');
        if (editorItem) editorItem.click();
        currentDocId = null;
        const ta = document.getElementById('editor-textarea');
        if (ta) { ta.value = ''; updateCharCount(); ta.focus(); }
    });
}

function renderFolderList() {
    const list = document.getElementById('folder-list');
    if (!list) return;

    const folders = getFolders();
    list.innerHTML = `
        <div class="folder-item ${currentFolderId === null ? 'active' : ''}" data-folder="">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 12V5l3-2h6l3 2v7H2z" stroke-linejoin="round"/>
            </svg>
            <span>Tous les documents</span>
        </div>
    `;

    folders.forEach(f => {
        const div = document.createElement('div');
        div.className = `folder-item${currentFolderId === f.id ? ' active' : ''}`;
        div.dataset.folder = f.id;
        div.innerHTML = `
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 13V6l2.5-2h3L9 5.5h5V13H2z" stroke-linejoin="round"/>
            </svg>
            <span>${escapeHtml(f.name)}</span>
        `;
        div.addEventListener('click', () => {
            currentFolderId = f.id || null;
            document.querySelectorAll('.folder-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            const titleEl = document.getElementById('docs-folder-title');
            if (titleEl) titleEl.textContent = f.name;
            renderDocumentsList();
        });
        list.appendChild(div);
    });

    // "All docs" click
    list.querySelector('[data-folder=""]')?.addEventListener('click', () => {
        currentFolderId = null;
        document.querySelectorAll('.folder-item').forEach(i => i.classList.remove('active'));
        list.querySelector('[data-folder=""]').classList.add('active');
        const titleEl = document.getElementById('docs-folder-title');
        if (titleEl) titleEl.textContent = 'Tous les documents';
        renderDocumentsList();
    });
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

        div.innerHTML = `
            <svg class="doc-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M4 2h6l3 3v9H4V2z" stroke-linejoin="round"/>
                <polyline points="10,2 10,5 13,5" stroke-linejoin="round"/>
            </svg>
            <span class="doc-item-title">${escapeHtml(doc.title)}</span>
            <span class="doc-item-date">${dateStr}</span>
        `;

        div.addEventListener('click', () => openDocument(doc.id));
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
            if (ta) { ta.value = doc.content; updateCharCount(); ta.focus(); }
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
