// === SAME-DOMAIN AUTH INTERCEPTOR ===
(function() {
  var _origFetch = window.fetch;
  window.fetch = function(url, opts) {
    opts = opts || {};
    var urlStr = typeof url === 'string' ? url : (url && url.url) || '';
    if (urlStr.includes('/api/')) {
      var tok = localStorage.getItem('jwt_token');
      if (tok && tok !== 'null' && tok !== 'undefined') {
        opts.headers = Object.assign({}, opts.headers || {}, { 'Authorization': 'Bearer ' + tok });
      }
      opts.credentials = opts.credentials || 'include';
    }
    return _origFetch.call(this, url, opts);
  };
})();
/**
 * Settings Page â€” External JS
 * Loaded by the SPA router or directly via <script src>
 */

window.initPage = function () {
    const API_BASE = '/api/user';
    let currentPrefs = {};
    let userRole = null;

    const TOKEN_KEY = 'jwt_token';
    const USER_KEY = 'user';

    function getToken() { return localStorage.getItem(TOKEN_KEY) || null; }
    function getCachedUser() {
        try { const raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
    }
    function authHeaders() {
        const token = getToken();
        return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    // â”€â”€ Load Preferences â”€â”€
    async function loadPreferences() {
        const headers = authHeaders();
        if (!headers) { window.location.href = '/login'; return; }

        try {
            const [prefsRes, profileRes] = await Promise.all([
                fetch(`${API_BASE}/email-preferences`, { headers }),
                fetch(`${API_BASE}/profile`, { headers }),
            ]);

            if (prefsRes.status === 401 || profileRes.status === 401) {
                window.location.href = '/login';
                return;
            }

            const prefsData = await prefsRes.json();
            const profileData = await profileRes.json();

            currentPrefs = prefsData.emailNotifications || {};
            userRole = profileData.user?.role || 'student';

            document.querySelectorAll('[data-pref]').forEach(input => {
                const key = input.dataset.pref;
                input.checked = currentPrefs[key] !== false;
            });

            const digestMode = currentPrefs.digestMode || 'instant';
            const digestRadio = document.querySelector(`input[name="digestMode"][value="${digestMode}"]`);
            if (digestRadio) {
                digestRadio.checked = true;
                const opt = digestRadio.closest('.digest-option');
                if (opt) opt.classList.add('selected');
            }

            if (userRole === 'faculty' || userRole === 'teacher') {
                const fs = document.getElementById('facultySection');
                if (fs) fs.style.display = 'block';
            }

            const loadingState = document.getElementById('loadingState');
            const settingsContent = document.getElementById('settingsContent');
            if (loadingState) loadingState.style.display = 'none';
            if (settingsContent) settingsContent.style.display = 'block';

            attachToggleListeners();
            attachDigestListeners();
        } catch (err) {
            console.error('Failed to load preferences:', err);
            const loadingState = document.getElementById('loadingState');
            if (loadingState) {
                loadingState.innerHTML = '<i class="fas fa-exclamation-circle" style="color:var(--red); font-size:1.5rem;"></i><span>Failed to load settings.</span>';
            }
        }
    }

    function attachToggleListeners() {
        document.querySelectorAll('[data-pref]').forEach(input => {
            input.addEventListener('change', async (e) => {
                const key = e.target.dataset.pref;
                const value = e.target.checked;
                if (key === 'global') toggleDimState(!value);
                await savePreference(key, value);
            });
        });

        const globalToggle = document.getElementById('toggle-global');
        if (globalToggle && !globalToggle.checked) toggleDimState(true);
    }

    function toggleDimState(disabled) {
        document.querySelectorAll('[data-pref]').forEach(input => {
            if (input.dataset.pref === 'global') return;
            const row = input.closest('.toggle-row');
            if (row) {
                row.style.opacity = disabled ? '0.4' : '1';
                row.style.pointerEvents = disabled ? 'none' : 'auto';
            }
        });
    }

    function attachDigestListeners() {
        document.querySelectorAll('input[name="digestMode"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                document.querySelectorAll('.digest-option').forEach(opt => opt.classList.remove('selected'));
                e.target.closest('.digest-option').classList.add('selected');

                const headers = authHeaders();
                if (!headers) return;
                try {
                    const res = await fetch(`${API_BASE}/email-preferences`, {
                        method: 'PUT', headers,
                        body: JSON.stringify({ digestMode: e.target.value }),
                    });
                    if (!res.ok) throw new Error('Save failed');
                    showToast('Delivery mode updated', false);
                } catch (err) {
                    showToast('Failed to save', true);
                }
            });
        });
    }

    async function savePreference(key, value) {
        const headers = authHeaders();
        if (!headers) return;
        try {
            const res = await fetch(`${API_BASE}/email-preferences`, {
                method: 'PUT', headers,
                body: JSON.stringify({ [key]: value }),
            });
            if (!res.ok) throw new Error('Save failed');
            showToast('Preferences saved', false);
        } catch (err) {
            console.error('Save error:', err);
            showToast('Failed to save', true);
            const toggle = document.getElementById(`toggle-${key}`);
            if (toggle) toggle.checked = !value;
        }
    }

    function showToast(message, isError = false) {
        const el = document.getElementById('saveStatus');
        const textEl = document.getElementById('saveStatusText');
        if (!el || !textEl) return;
        const iconEl = el.querySelector('i');
        textEl.textContent = message;
        el.className = 'save-status' + (isError ? ' error' : '');
        if (iconEl) iconEl.className = isError ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 2500);
    }

    // Run
    loadPreferences();
};

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initPage);
} else {
    window.initPage();
}
