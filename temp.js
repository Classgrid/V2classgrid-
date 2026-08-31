
        /* Auth Guard â— runs BEFORE CSS/content to prevent any flash of protected content */
        (function () {
            var t = null; var hasUrlToken = window.location.search.indexOf('token=') !== -1;
            if (t || hasUrlToken) {
                window.addEventListener('pageshow', function (e) { if (e.persisted && !null) window.location.replace('/login.html'); });
                window.addEventListener('storage', function (e) { if (e.key === 'jwt_token' && !e.newValue) window.location.replace('/login.html'); });
                return;
            }
            var _cs = document.createElement('style'); _cs.id = '_ag'; _cs.textContent = 'body>*:not(script):not(style){visibility:hidden!important}'; document.head.appendChild(_cs);
            var _cb = location.origin.includes('localhost') ? 'http://localhost:3000' : '';
            var _tok = localStorage.getItem('jwt_token'); var _hdrs = { 'Cache-Control': 'no-store' }; if (_tok && _tok !== 'null' && _tok !== 'undefined') { _hdrs['Authorization'] = 'Bearer ' + _tok; } fetch(_cb + '/api/auth/me', { credentials: 'include', cache: 'no-store', headers: _hdrs })
                .then(function (r) { if (r.ok) return r.json().then(function (u) { window._cookieAuthUser = u; var e = document.getElementById('_ag'); if (e) e.remove(); }); throw 0; })
                .catch(function () { window.location.replace('/login.html'); });
        })();
    