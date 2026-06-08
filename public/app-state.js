/**
 * Classgrid App State — Global State Cache
 * Caches dashboard data, user profile, and classroom lists.
 * Only refetches on hard refresh, logout, or token expiry.
 */
(function () {
    'use strict';

    const API_BASE = window.location.origin.includes('localhost')
        ? 'http://localhost:3000'
        : '';  // Relative path — works for both classgrid.in and classgrid.in

    const state = {
        user: null,
        token: null,
        classrooms: null,
        notifications: null,
        _lastFetch: {},
        _listeners: {}
    };

    /**
     * Get JWT token from localStorage
     */
    function getToken() {
        if (!state.token) {
            state.token = localStorage.getItem('jwt_token');
        }
        return state.token;
    }

    /**
     * Fetch with auth header
     */
    async function authFetch(url, options = {}) {
        const token = getToken();

        const headers = {
            ...(options.headers || {})
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url.startsWith('http') ? url : `${API_BASE}${url}`, {
            ...options,
            headers,
            credentials: 'include'
        });

        if (response.status === 401) {
            // Token expired — clear state and redirect to login
            AppState.clearAll();
            window.location.replace('/login.html');
            throw new Error('Token expired');
        }

        return response;
    }

    /**
     * Check if cached data is still fresh
     */
    function isFresh(key, maxAgeMs = 5 * 60 * 1000) {
        const lastFetch = state._lastFetch[key];
        if (!lastFetch) return false;
        return (Date.now() - lastFetch) < maxAgeMs;
    }

    const AppState = {
        /**
         * Get current user profile (cached)
         */
        async getUser(force = false) {
            if (state.user && !force && isFresh('user', 10 * 60 * 1000)) {
                return state.user;
            }

            try {
                const res = await authFetch('/api/auth/me');
                if (!res.ok) throw new Error('Auth failed');
                const data = await res.json();
                state.user = data.user || data;
                if (data.token && !getToken()) {
                    state.token = data.token;
                    localStorage.setItem('jwt_token', data.token);
                }
                state._lastFetch.user = Date.now();

                // Also update localStorage cache
                localStorage.setItem('user', JSON.stringify(state.user));
                return state.user;
            } catch (err) {
                // Fall back to localStorage cache
                const cached = localStorage.getItem('user');
                if (cached) {
                    state.user = JSON.parse(cached);
                    return state.user;
                }
                throw err;
            }
        },

        /**
         * Get cached user synchronously (may be null)
         */
        getUserSync() {
            if (state.user) return state.user;
            const cached = localStorage.getItem('user');
            if (cached) {
                state.user = JSON.parse(cached);
                return state.user;
            }
            return null;
        },

        /**
         * Get classrooms list (cached)
         */
        async getClassrooms(force = false) {
            if (state.classrooms && !force && isFresh('classrooms')) {
                return state.classrooms;
            }

            const res = await authFetch('/api/classrooms');
            const data = await res.json();
            state.classrooms = data.classrooms || [];
            state._lastFetch.classrooms = Date.now();
            return state.classrooms;
        },

        /**
         * Get notifications (cached with shorter TTL)
         */
        async getNotifications(force = false) {
            if (state.notifications && !force && isFresh('notifications', 60 * 1000)) {
                return state.notifications;
            }

            const res = await authFetch('/api/notifications');
            const data = await res.json();
            state.notifications = {
                items: data.notifications || [],
                unreadCount: data.unreadCount || 0
            };
            state._lastFetch.notifications = Date.now();
            return state.notifications;
        },

        /**
         * Get System Config
         */
        async getSystemConfig(force = false) {
            if (state.systemConfig && !force && isFresh('systemConfig', 5 * 60 * 1000)) {
                return state.systemConfig;
            }
            try {
                const res = await fetch(`${API_BASE}/api/auth/system-config`);
                if (res.ok) {
                    state.systemConfig = await res.json();
                    state._lastFetch.systemConfig = Date.now();

                    // Trigger custom event so dashboards can react immediately
                    window.dispatchEvent(new CustomEvent('systemConfigLoaded', { detail: state.systemConfig }));

                    return state.systemConfig;
                }
            } catch (e) {
                console.error('Failed to fetch system config', e);
            }
            return null;
        },

        /**
         * Invalidate specific cache
         */
        invalidate(key) {
            delete state._lastFetch[key];
            if (key === 'user') state.user = null;
            if (key === 'classrooms') state.classrooms = null;
            if (key === 'notifications') state.notifications = null;
        },

        /**
         * Clear all state (on logout)
         */
        clearAll() {
            state.user = null;
            state.token = null;
            state.classrooms = null;
            state.notifications = null;
            state.systemConfig = null;
            state._lastFetch = {};
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('user');
            localStorage.removeItem('qc_user');
            sessionStorage.clear();
            document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        },

        /**
         * Auth-aware fetch helper (exposed for page scripts)
         */
        authFetch,

        /**
         * Get API base URL
         */
        get API_BASE() { return API_BASE; },

        /**
         * Get token
         */
        getToken
    };

    // Expose globally
    window.AppState = AppState;

    // ── GLOBAL UI ENFORCER ──
    // Automatically hide features based on system configuration
    async function enforceSystemSettings() {
        const config = await AppState.getSystemConfig();
        if (!config) return;

        if (config.notesSystem === false) {
            document.querySelectorAll('button[onclick*="\'notes\'"], button[onclick*="\\"notes\\""], a[href*="/notes"], #uploadNotesLink').forEach(el => el.style.display = 'none');
        }
        if (config.chatSystem === false) {
            document.querySelectorAll('button[onclick*="\'chat\'"], button[onclick*="\\"chat\\""], a[href*="/classroom-chat"]').forEach(el => el.style.display = 'none');
        }
        if (config.aiFeatures === false) {
            document.querySelectorAll('a[href*="classgrid_assistant"], .ai-btn, button[onclick*="generate"]').forEach(el => el.style.display = 'none');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enforceSystemSettings);
    } else {
        enforceSystemSettings();
    }

    // Also re-run enforcement if config is loaded later
    window.addEventListener('systemConfigLoaded', enforceSystemSettings);

    console.log('[App State] Initialized');
})();
