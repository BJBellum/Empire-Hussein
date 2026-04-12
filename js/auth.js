/**
 * Discord OAuth2 Authentication
 * Uses implicit grant flow (suitable for static GitHub Pages sites)
 *
 * SETUP:
 * 1. Go to https://discord.com/developers/applications
 * 2. Create a new application (or use an existing one)
 * 3. In OAuth2 settings, add your GitHub Pages URL as a redirect URI
 *    (e.g., https://yourusername.github.io/Empire-Hussein/)
 * 4. Copy the Client ID and set it in DISCORD_CONFIG below
 */

const DISCORD_CONFIG = {
    // ── REPLACE THIS with your Discord Application Client ID ──
    clientId: '1492884020202045480',

    // ── REPLACE THIS with your GitHub Pages URL ──
    redirectUri: window.location.origin + window.location.pathname,

    // Scopes: 'identify' gives us the user's ID, username, avatar
    scope: 'identify',

    // Admin Discord user IDs
    adminIds: [
        '772821169664426025',
        '950389750739664896'
    ]
};

const AUTH_STORAGE_KEY = 'empire_hussein_auth';

// ────────────────────────────────────────────
// Auth state
// ────────────────────────────────────────────
const Auth = {
    user: null,
    isAdmin: false,

    /**
     * Initialize auth: check for token in URL hash or localStorage
     */
    init() {
        // 1. Check if Discord redirected back with a token in the hash
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hashParams.get('access_token');

        if (accessToken) {
            // Clean the URL (remove the token from the address bar)
            window.history.replaceState(null, '', window.location.pathname);
            this.fetchUser(accessToken);
            return;
        }

        // 2. Check localStorage for existing session
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                // Check if token hasn't expired (Discord tokens last ~7 days)
                if (data.expiresAt && Date.now() < data.expiresAt) {
                    this.user = data.user;
                    this.isAdmin = DISCORD_CONFIG.adminIds.includes(data.user.id);
                    this.updateUI();
                    return;
                }
                // Expired, clear it
                localStorage.removeItem(AUTH_STORAGE_KEY);
            } catch {
                localStorage.removeItem(AUTH_STORAGE_KEY);
            }
        }

        // 3. Not logged in
        this.updateUI();
    },

    /**
     * Redirect to Discord OAuth
     */
    login() {
        const params = new URLSearchParams({
            client_id: DISCORD_CONFIG.clientId,
            redirect_uri: DISCORD_CONFIG.redirectUri,
            response_type: 'token',
            scope: DISCORD_CONFIG.scope
        });
        window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
    },

    /**
     * Log out: clear state and reload
     */
    logout() {
        this.user = null;
        this.isAdmin = false;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        this.updateUI();
        showToast('Déconnexion réussie');
    },

    /**
     * Fetch user info from Discord API
     */
    async fetchUser(token) {
        try {
            const res = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch user');

            const user = await res.json();
            this.user = user;
            this.isAdmin = DISCORD_CONFIG.adminIds.includes(user.id);

            // Store in localStorage (token lasts ~7 days = 604800 seconds)
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
                user,
                token,
                expiresAt: Date.now() + 604800 * 1000
            }));

            this.updateUI();
            showToast(this.isAdmin
                ? `Bienvenue, ${user.global_name || user.username} (Admin)`
                : `Bienvenue, ${user.global_name || user.username}`
            );
        } catch (err) {
            console.error('Auth error:', err);
            showToast('Erreur de connexion Discord');
        }
    },

    /**
     * Update all UI elements based on auth state
     */
    updateUI() {
        const badge = document.getElementById('user-badge');
        const avatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const btnDiscord = document.getElementById('btn-discord');
        const btnDiscordMobile = document.getElementById('btn-discord-mobile');
        const navForces = document.getElementById('nav-forces');
        const navForcesMobile = document.getElementById('nav-forces-mobile');

        if (this.user) {
            // Show user badge
            if (badge) {
                badge.style.display = 'flex';
                const avatarHash = this.user.avatar;
                const userId = this.user.id;
                if (avatar) {
                    avatar.src = avatarHash
                        ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=64`
                        : `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 5}.png`;
                }
                if (userName) {
                    userName.textContent = this.user.global_name || this.user.username;
                }
            }

            // Update Discord buttons to show "connected"
            [btnDiscord, btnDiscordMobile].forEach(btn => {
                if (!btn) return;
                const textEl = btn.querySelector('span:last-child, .btn-discord-text');
                if (textEl) textEl.textContent = 'CONNECTÉ';
                btn.style.borderColor = 'rgba(88, 101, 242, 0.4)';
                btn.style.color = '#5865F2';
            });

            // Unlock Forces Armees for admins
            if (this.isAdmin) {
                [navForces, navForcesMobile].forEach(el => {
                    if (!el) return;
                    el.classList.remove('nav-link--locked', 'mobile-nav-link--locked');
                    el.classList.add('nav-link--unlocked');
                });
            }
        } else {
            // Hide user badge
            if (badge) badge.style.display = 'none';

            // Reset Discord buttons
            [btnDiscord, btnDiscordMobile].forEach(btn => {
                if (!btn) return;
                const textEl = btn.querySelector('span:last-child, .btn-discord-text');
                if (textEl) textEl.textContent = 'CONNEXION';
                btn.style.borderColor = '';
                btn.style.color = '';
            });

            // Lock Forces Armees
            [navForces, navForcesMobile].forEach(el => {
                if (!el) return;
                el.classList.add(el.classList.contains('mobile-nav-link--locked')
                    ? 'mobile-nav-link--locked'
                    : 'nav-link--locked');
                el.classList.remove('nav-link--unlocked');
            });
        }
    }
};

// ────────────────────────────────────────────
// Toast notification helper
// ────────────────────────────────────────────
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ────────────────────────────────────────────
// Event listeners for auth buttons
// ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Discord login buttons
    ['btn-discord', 'btn-discord-mobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (Auth.user) return; // Already logged in
                Auth.login();
            });
        }
    });

    // Logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => Auth.logout());
    }

    // Forces Armées — block if not admin
    ['nav-forces', 'nav-forces-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                if (!Auth.isAdmin) {
                    e.preventDefault();
                    if (!Auth.user) {
                        showToast('Connexion requise — Accès réservé aux administrateurs');
                    } else {
                        showToast('Accès refusé — Privilèges administrateur requis');
                    }
                }
            });
        }
    });

    // Initialize auth
    Auth.init();
});
