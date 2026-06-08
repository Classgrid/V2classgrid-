(function () {
    // Configuration
    const API_BASE_URL = window.location.origin.includes('localhost')
        ? 'http://localhost:3000'
        : window.location.origin;
    const PROFILE_API = `${API_BASE_URL}/api/user/profile`;
    const TOKEN_KEY = 'jwt_token';
    const USER_KEY = 'user';

    // Global state for other scripts
    window.Auth = {
        user: null,
        token: null,
        isAuthenticated: false,
        logout: () => logout(false) // Default to no reload
    };

    // AuthUtils Compatibility Layer for legacy protection scripts
    window.AuthUtils = {
        isUserLoggedIn: () => window.Auth.isAuthenticated,
        getUserData: () => window.Auth.user,
        getJWTToken: () => window.Auth.token,
        logout: (reload = true) => window.Auth.logout(reload),
        showToast: (msg, type) => {
            if (typeof window.showToast === 'function') window.showToast(msg, type);
            else console.log(`Toast (${type}): ${msg}`);
        },
        showLoginModal: (msg) => {
            if (typeof window.showLoginModal === 'function') window.showLoginModal(msg);
            else {
                const modal = document.getElementById('loginModal');
                if (modal) modal.classList.add('active');
                else alert(msg || 'Please login to access this feature');
            }
        },
        API_BASE: API_BASE_URL
    };

    // Initialize
    async function initAuth() {
        // 1. Check URL for token (OAuth callbacks)
        const urlParams = new URLSearchParams(window.location.search);
        let token = urlParams.get('token');

        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            token = localStorage.getItem(TOKEN_KEY);
        }

        // 2a. If cookie session user was already fetched by auth-guard.js, use it
        if (!token && window._cookieAuthUser) {
            const user = window._cookieAuthUser;
            window.Auth.user = user;
            window.Auth.isAuthenticated = true;
            window.Auth.token = null; // cookie-mode
            try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch (_) { }
            updateUI(user);
            updatePageSpecificUI(true);
            return;
        }

        // 2b. No localStorage token — try cookie session via /api/auth/me
        if (!token) {
            try {
                const API_BASE = window.location.origin.includes('localhost')
                    ? 'http://localhost:3000'
                    : window.location.origin;
                const cookieRes = await fetch(`${API_BASE}/api/auth/me`, {
                    credentials: 'include',
                    cache: 'no-store'
                });
                if (cookieRes.ok) {
                    const user = await cookieRes.json();
                    window.Auth.user = user;
                    window.Auth.isAuthenticated = true;
                    window.Auth.token = null; // cookie-mode, no Bearer token
                    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch (_) { }
                    updateUI(user);
                    updatePageSpecificUI(true);
                    return;
                }
            } catch (_) { /* network error — fall through */ }
            updateUI(null);
            updatePageSpecificUI(false);
            return;
        }

        window.Auth.token = token;

        // Try to get user from local storage first for speed
        try {
            const cachedUser = localStorage.getItem(USER_KEY);
            if (cachedUser) {
                const user = JSON.parse(cachedUser);
                window.Auth.user = user;
                window.Auth.isAuthenticated = true;
                updateUI(user);
                updatePageSpecificUI(true);
            }
        } catch (e) {
            console.error("Error parsing cached user", e);
        }

        // Verify with API (Bearer token path — sends both Bearer header AND cookie for max compatibility)
        try {
            const response = await fetch(PROFILE_API, {
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.user;

                // Update cache
                localStorage.setItem(USER_KEY, JSON.stringify(user));
                window.Auth.user = user;
                window.Auth.isAuthenticated = true;

                updateUI(user);
                updatePageSpecificUI(true);
            } else {
                // Token invalid
                console.warn('Session expired');
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
                updateUI(null);
                updatePageSpecificUI(false);
            }
        } catch (error) {
            console.error('Auth verification failed', error);
            // If network error, keep cached user if we have it
        }
    }

    /**
     * Returns a consistent display label for user roles.
     * Handles both new (faculty) and legacy (teacher) role names.
     */
    function getRoleLabel(role) {
        const labels = {
            super_admin: 'Super Admin',
            org_admin: 'Org Admin',
            faculty: 'Faculty',
            teacher: 'Faculty',  // legacy alias
            student: 'Student',
        };
        return labels[role] || role || 'User';
    }

    function updateUI(user) {
        // 1. Resources-style dropdown (#userDropdown)
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) {
            if (user) {
                const avatar = document.getElementById('userAvatar');
                const name = document.getElementById('userName');
                const dropdownContent = document.getElementById('dropdownContent');

                const avatarUrl = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3B82F6&color=fff`;

                if (avatar) avatar.src = avatarUrl;
                if (name) name.textContent = user.name;

                if (dropdownContent) {
                    const dashboardHref = getDashboardLink(user.role);
                    dropdownContent.innerHTML = `
                        <div style="padding:10px 15px; border-bottom:1px solid #eee;">
                            <strong>${user.name}</strong>
                            <div style="font-size:0.75rem;color:#888;margin-top:2px;">${getRoleLabel(user.role)}</div>
                        </div>
                        <a href="${dashboardHref}" class="dropdown-item">
                            <i class="fas fa-tachometer-alt"></i> <span>Dashboard</span>
                        </a>
                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item" onclick="window.Auth.logout()">
                            <i class="fas fa-sign-out-alt"></i> <span>Logout</span>
                        </a>
                    `;
                }
            }
        }

        // 2. Lecture/Tutorials style (#navAuthSection)
        const navAuthSection = document.getElementById('navAuthSection');
        const mobileAuthSection = document.getElementById('mobileAuthSection');

        if (navAuthSection || mobileAuthSection) {
            if (user) {
                const avatarUrl = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3B82F6&color=fff`;

                if (navAuthSection) {
                    navAuthSection.innerHTML = `
                        <div class="user-nav-section">
                            <a href="${getDashboardLink(user.role)}" class="user-avatar-nav" title="Dashboard">
                                <img src="${avatarUrl}" alt="${user.name}">
                            </a>
                            <span class="user-name-nav" style="margin-left:8px; font-weight:600; color:var(--text-light, #e2e8f0);">${user.name}</span>
                            <button onclick="window.Auth.logout()" class="logout-btn-nav" title="Logout">
                                <i class="fas fa-sign-out-alt"></i>
                            </button>
                        </div>
                    `;
                }

                if (mobileAuthSection) {
                    mobileAuthSection.innerHTML = `
                        <div class="mobile-user-section">
                            <div class="mobile-user-avatar">
                                <img src="${avatarUrl}" alt="${user.name}">
                            </div>
                            <div class="mobile-user-name">${user.name}</div>
                            <div class="mobile-user-email">${user.email}</div>
                            <div style="font-size:0.73rem;color:#888;margin-top:2px;">${getRoleLabel(user.role)}</div>
                            <button onclick="window.Auth.logout()" style="margin-top:10px; width:100%; padding:10px; background:rgba(239, 68, 68, 0.2); border:1px solid rgba(239, 68, 68, 0.4); color:#ef4444; border-radius:8px; cursor:pointer;">
                                <i class="fas fa-sign-out-alt"></i> Logout
                            </button>
                        </div>
                    `;
                }

            } else {
                const loginUrl = 'login.html';
                if (navAuthSection) {
                    navAuthSection.innerHTML = `
                        <div class="auth-buttons">
                            <a href="${loginUrl}" class="auth-btn auth-btn-outline">Sign In</a>
                            <a href="${loginUrl}?action=signup" class="auth-btn auth-btn-primary">Sign Up</a>
                        </div>
                    `;
                }
                if (mobileAuthSection) {
                    mobileAuthSection.innerHTML = `
                       <div style="margin-bottom: 20px; display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                            <a href="${loginUrl}" style="background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color: #fff; padding:14px; border-radius:12px; text-align:center; text-decoration:none; font-weight:700; font-size:1rem;">
                                Sign In
                            </a>
                            <a href="${loginUrl}?action=signup" style="background: var(--grad-bp, linear-gradient(135deg, #4a90f5 0%, #8b6fff 100%)); color:white; padding:14px; border-radius:12px; text-align:center; text-decoration:none; font-weight:700; font-size:1rem; box-shadow: 0 4px 15px rgba(74, 144, 245, 0.3);">
                                Sign Up
                            </a>
                        </div>
                     `;
                }
            }
        }

        // 3. Science-page style (#loggedInUserInfo)
        const loggedInUserInfo = document.getElementById('loggedInUserInfo');
        if (loggedInUserInfo) {
            if (user) {
                const avatarUrl = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3B82F6&color=fff`;

                loggedInUserInfo.innerHTML = `
                    <div class="logged-user-info" style="display:flex; align-items:center; gap:10px; padding:0.5rem; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:12px;">
                        <div class="logged-user-avatar" style="width:36px; height:36px; border-radius:8px; overflow:hidden;">
                            <img src="${avatarUrl}" alt="${user.name}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                        <div class="logged-user-details" style="display:flex; flex-direction:column;">
                            <div class="logged-user-name" style="font-weight:700; font-size:0.9rem;">${user.name}</div>
                            <div style="font-size:0.7rem;color:#888;">${getRoleLabel(user.role)}</div>
                        </div>
                         <button onclick="window.Auth.logout()" style="margin-left:5px; border:none; background:none; cursor:pointer; color:var(--error); padding:5px;" title="Logout">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                `;
            } else {
                loggedInUserInfo.innerHTML = `
                    <a href="login.html" style="text-decoration:none; color:#fff; font-weight:600; padding:0.5rem 1.25rem; border:1px solid rgba(255,255,255,0.2); border-radius:10px; background:rgba(255,255,255,0.05); display:inline-flex; align-items:center; gap:8px;">
                        <i class="fas fa-sign-in-alt"></i> Sign In
                    </a>
                 `;
            }
        }
    }

    /**
     * Returns the correct dashboard URL for the given role.
     */
    function getDashboardLink(role) {
        if (role === 'super_admin') return '/super-admin-dashboard';
        if (role === 'org_admin') {
            const user = window.Auth.user;
            const orgName = user && user.organization && user.organization.name ? encodeURIComponent(user.organization.name.replace(/\s+/g, '-').toLowerCase()) : 'dashboard';
            return `/org/${orgName}/admin`;
        }
        return '/classroom';
    }

    function updatePageSpecificUI(isAuthenticated) {
        // Trigger custom event for page-specific logic (like Tutorials lock)
        window.dispatchEvent(new CustomEvent('auth-updated', { detail: { isAuthenticated } }));

        // Also explicitly call re-render functions if they exist in global scope
        if (typeof window.renderTutorials === 'function') {
            window.renderTutorials();
        }
        if (typeof window.renderUnits === 'function') {
            window.renderUnits();
        }
    }

    async function logout() {
        // Capture role before state is cleared
        const role = window.Auth && window.Auth.user ? window.Auth.user.role : null;

        // 1. Call backend to clear the httpOnly JWT cookie
        try {
            const API_BASE_URL = window.location.origin.includes('localhost')
                ? 'http://localhost:3000'
                : window.location.origin;
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: window.Auth.token ? {} : {}
            });
        } catch (e) {
            // Non-fatal — continue with local cleanup
            console.warn('Logout API call failed (non-fatal):', e.message);
        }

        // 2. Clear ALL storage (use AppState if available for thorough cleanup)
        if (window.AppState) {
            window.AppState.clearAll();
        } else {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem('qc_user');
            sessionStorage.clear();
            document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }

        // 3. Reset auth state
        window.Auth.user = null;
        window.Auth.token = null;
        window.Auth.isAuthenticated = false;

        // 4. Fire events for compatibility
        window.dispatchEvent(new CustomEvent('auth-updated', { detail: { isAuthenticated: false } }));
        window.dispatchEvent(new Event('auth-updated'));

        // 5. Clear SPA page cache if available
        if (window.spaClearCache) window.spaClearCache();

        // 6. Redirect using replace() to remove dashboard from browser history
        if (role === 'org_admin') {
            window.location.replace('/admin/login');
        } else {
            window.location.replace('/login.html');
        }
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ DEMO MODE BANNER Ã¢â€ââ‚¬
    function checkDemoMode() {
        if (localStorage.getItem('demo_mode') === 'true') {
            const banner = document.createElement('div');
            banner.id = 'demoBanner';
            banner.style.cssText = `
                position:fixed;top:0;left:0;right:0;z-index:99999;
                background:linear-gradient(135deg,#f59e0b,#d97706);
                color:#000;padding:10px 20px;display:flex;align-items:center;
                justify-content:center;gap:12px;font-size:0.85rem;font-weight:600;
                box-shadow:0 2px 12px rgba(0,0,0,0.3);
            `;
            banner.innerHTML = `
                <i class="fas fa-flask" style="font-size:1.1rem;"></i>
                <span>Ã¢Å¡Â  You are viewing this account in <strong>Demo Mode</strong></span>
                <button onclick="window.returnToAdmin()" style="
                    background:#000;color:#f59e0b;border:none;padding:6px 16px;
                    border-radius:6px;cursor:pointer;font-weight:700;font-size:0.8rem;
                    margin-left:8px;
                "><i class="fas fa-arrow-left" style="margin-right:4px;"></i> Return to Admin</button>
            `;
            document.body.style.paddingTop = '48px';
            document.body.prepend(banner);
        }
    }

    window.returnToAdmin = function () {
        const adminToken = localStorage.getItem('admin_return_token');
        const adminUser = localStorage.getItem('admin_return_user');

        // Clean up demo session
        localStorage.removeItem('demo_mode');
        localStorage.removeItem('admin_return_token');
        localStorage.removeItem('admin_return_user');

        if (adminToken && adminUser) {

            localStorage.setItem('user', adminUser);
            if (window.spaClearCache) window.spaClearCache();
            try {
                const user = JSON.parse(adminUser);
                const target = user.role === 'super_admin' ? '/super-admin'
                    : user.role === 'org_admin' ? `/org/${user.organization?.name ? encodeURIComponent(user.organization.name.replace(/\s+/g, '-').toLowerCase()) : 'dashboard'}/admin`
                        : '/classroom';
                window.location.replace(target);
            } catch {
                window.location.replace('/classroom');
            }
        } else {
            window.location.replace('/');
        }
    };

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { initAuth(); checkDemoMode(); });
    } else {
        initAuth();
        checkDemoMode();
    }

})();
