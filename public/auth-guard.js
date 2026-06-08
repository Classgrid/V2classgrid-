/**
 * Classgrid Auth Guard — Dual-Mode Token Protection
 * Supports: localStorage jwt_token (legacy) AND HttpOnly cookie (new login flow).
 *
 * Strategy:
 *  - If localStorage token exists → allow immediately (legacy path, unchanged)
 *  - If no localStorage token → hide content, call /api/auth/me with cookies
 *      → If valid cookie → reveal content + store user
 *      → If no valid session → redirect to /login.html
 *
 * Include at the TOP of every protected page's <body>.
 */
(function () {
    'use strict';

    var TOKEN_KEY = 'jwt_token';
    var token = localStorage.getItem(TOKEN_KEY);
    var hasUrlToken = window.location.search.indexOf('token=') !== -1;

    // ── Fast path: localStorage token present ──
    if (token || hasUrlToken) {
        // bfcache guard
        window.addEventListener('pageshow', function (e) {
            if (e.persisted && !localStorage.getItem(TOKEN_KEY)) {
                window.location.replace('/login.html');
            }
        });
        // cross-tab logout guard
        window.addEventListener('storage', function (e) {
            if (e.key === TOKEN_KEY && !e.newValue) {
                window.location.replace('/login.html');
            }
        });
        return; // All good — let the page load normally
    }

    // ── Slow path: no localStorage token — check HttpOnly cookie ──
    // Hide the page body immediately to prevent FOUC (Flash of Unauthorised Content)
    var styleEl = document.createElement('style');
    styleEl.id = '_auth_guard_hide';
    styleEl.textContent = 'body > *:not(script):not(style) { visibility: hidden !important; }';
    document.head.appendChild(styleEl);

    var API_BASE = window.location.origin.includes('localhost')
        ? 'http://localhost:3000'
        : window.location.origin;

    fetch(API_BASE + '/api/auth/me', {
        credentials: 'include',
        cache: 'no-store'
    })
        .then(function (r) {
            if (r.ok) {
                return r.json().then(function (user) {
                    // Valid cookie session — reveal page and cache user for auth-check.js
                    try {
                        window._cookieAuthUser = user;
                        localStorage.setItem('user', JSON.stringify(user));
                    } catch (_) { }
                    // Remove the visibility-hiding style
                    var s = document.getElementById('_auth_guard_hide');
                    if (s) s.remove();
                });
            } else {
                throw new Error('Not authenticated');
            }
        })
        .catch(function () {
            window.location.replace('/login.html');
        });

})();
