// === SAME-DOMAIN AUTH INTERCEPTOR ===
(function () {
    var _origFetch = window.fetch;
    window.fetch = function (url, opts) {
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
 * My Classrooms Page â€” External JS
 * Loaded by the SPA router or directly via <script src>
 */

// â”€â”€ Page init function â”€â”€
window.initPage = function () {
    let token = localStorage.getItem('jwt_token');
    let currentUser = null;

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenParam = urlParams.get('token');
        if (tokenParam) {
            token = tokenParam;

            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (!token) { location.href = '/login'; return; }
        try {
            const res = await apiFetch('/api/auth/me');
            const data = await res.json();
            currentUser = data.user || data;
            localStorage.setItem('user', JSON.stringify(currentUser));
            const navName = document.getElementById('navName');
            if (navName) navName.textContent = currentUser.name;

            // Guard: no org â†’ show join-by-code prompt
            if (!currentUser.organization) {
                document.getElementById('myGrid').innerHTML = '<div class="empty-state"><h3>Join a Classroom First</h3><p>Enter a class code above to join your first classroom and get connected to an organization.</p></div>';
                document.getElementById('pendingGrid').innerHTML = '<div class="empty-state"><h3>No pending requests</h3></div>';
                return;
            }

            await loadMyClassrooms();
        } catch { location.href = '/login'; }
    }

    function apiFetch(url, o = {}) {
        return fetch(url, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers || {}) } });
    }

    // Expose logout globally
    window.logout = function () {
        if (window.AppState) { window.AppState.clearAll(); } else { localStorage.removeItem('jwt_token'); sessionStorage.clear(); }
        window.location.replace('/login.html');
    };

    // Expose switchTab globally (called from onclick in HTML)
    window.switchTab = function (btn, name) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + name).classList.add('active');
        btn.classList.add('active');
        if (name === 'discover') loadDiscover();
    };

    async function loadMyClassrooms() {
        if (!currentUser?.organization) {
            document.getElementById('myGrid').innerHTML = '<div class="empty-state"><h3>Join a Classroom First</h3><p>Enter a class code above to join your first classroom.</p></div>';
            return;
        }
        const res = await apiFetch('/api/classrooms');
        const data = await res.json();
        const all = data.classrooms || [];
        const approved = all.filter(c => c.membershipStatus === 'approved');
        const pending = all.filter(c => c.membershipStatus === 'pending');
        document.getElementById('myGrid').innerHTML = approved.length ? approved.map(c => classroomCard(c, 'approved')).join('') : '<div class="empty-state"><h3>No classrooms yet</h3><p>Join a classroom using a class code or browse available classrooms.</p></div>';
        document.getElementById('pendingGrid').innerHTML = pending.length ? pending.map(c => classroomCard(c, 'pending')).join('') : '<div class="empty-state"><h3>No pending requests</h3></div>';
        const pb = document.getElementById('pendingBadge');
        if (pb) { pb.textContent = pending.length; pb.style.display = pending.length > 0 ? 'inline' : 'none'; }
    }

    function classroomCard(c, status) {
        const teacherName = c.teacher?.name || 'Teacher';
        const teacherImg = c.teacher?.profilePicture
            ? `<img src="${esc(c.teacher.profilePicture)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid rgba(0,212,255,0.5)">`
            : `<i class="fas fa-user-tie"></i>`;

        return `<div class="cc">
        <span class="status-badge status-${status}">${status === 'approved' ? 'âœ“ Approved' : 'â³ Pending'}</span>
        <span class="cc-subject">${esc(c.subject || c.subjectSlug)}</span>
        <div class="cc-name">${esc(c.name)}</div>
        <div class="cc-desc">${esc(c.description || 'No description')}</div>
        <div class="cc-teacher" style="display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:1rem">${teacherImg} ${esc(teacherName)}</div>
        <div class="cc-stats"><span><i class="fas fa-users"></i> ${c.memberCount || 0}</span><span><i class="fas fa-calendar"></i> ${timeAgo(c.createdAt)}</span></div>
        ${status === 'approved' ? `<div class="cc-actions">
            <a href="/view-classroom.html?id=${c._id}" class="btn btn-primary btn-sm"><i class="fas fa-arrow-right"></i> Open</a>
            <a href="/classroom-chat?id=${c._id}" class="btn btn-glass btn-sm"><i class="fas fa-comments"></i> Chat</a>
        </div>` : ''}
    </div>`;
    }

    async function loadDiscover() {
        const grid = document.getElementById('discoverGrid');
        if (!currentUser?.organization) {
            grid.innerHTML = '<div class="empty-state"><h3>Organization Required</h3><p>Join a classroom via class code first to connect to an organization, then you can browse available classrooms.</p></div>';
            return;
        }
        const search = document.getElementById('searchInput').value;
        const res = await apiFetch(`/api/classrooms/discover?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        const cls = data.classrooms || [];
        grid.innerHTML = cls.length ? cls.map(c => {
            const st = c.membershipStatus;
            const tImg = c.teacher?.profilePicture
                ? `<img src="${esc(c.teacher.profilePicture)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid rgba(0,212,255,0.5)">`
                : `<i class="fas fa-user-tie"></i>`;

            return `<div class="cc">
            ${st ? `<span class="status-badge status-${st}">${st === 'approved' ? 'âœ“ Member' : 'â³ Pending'}</span>` : ''}
            <span class="cc-subject">${esc(c.subject)}</span>
            <div class="cc-name">${esc(c.name)}</div>
            <div class="cc-desc">${esc(c.description || '')}</div>
            <div class="cc-teacher" style="display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:1rem">${tImg} ${esc(c.teacher?.name)}</div>
            <div class="cc-stats"><span><i class="fas fa-users"></i> ${c.memberCount || 0}</span></div>
            <div class="cc-actions">
                ${!st ? `<button class="btn btn-primary btn-sm" onclick="joinById('${c._id}')"><i class="fas fa-plus"></i> Request to Join</button>` : `<span style="font-size:.78rem;color:var(--silver);padding:.4rem">${st === 'approved' ? 'Already a member' : 'Request pending'}</span>`}
            </div>
        </div>`;
        }).join('') : '<div class="empty-state"><h3>No classrooms found</h3></div>';
    }

    // Expose joinByCode globally (called from onclick in HTML)
    window.joinByCode = async function () {
        const code = document.getElementById('joinCode').value.trim().toUpperCase();
        if (!code) { showToast('Enter a class code', 'error'); return; }
        const btn = document.getElementById('joinBtn');
        btn.disabled = true;
        try {
            const res = await apiFetch('/api/classrooms/join-by-code', { method: 'POST', body: JSON.stringify({ classCode: code }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Validation error');
            showToast(data.message, 'success');
            document.getElementById('joinCode').value = '';

            // Refresh user state to get new organization
            const meRes = await apiFetch('/api/auth/me');
            if (meRes.ok) {
                const meData = await meRes.json();
                currentUser = meData.user || meData;
                localStorage.setItem('user', JSON.stringify(currentUser));
            }

            await loadMyClassrooms();
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            btn.disabled = false;
        }
    };

    // Expose joinById globally
    window.joinById = async function (id) {
        try {
            const res = await apiFetch(`/api/classrooms/${id}/join`, { method: 'POST', body: '{}' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            showToast(data.message, 'success');
            await loadMyClassrooms(); loadDiscover();
        } catch (e) { showToast(e.message, 'error'); }
    };

    function showToast(msg, type) {
        const t = document.getElementById('toast');
        if (!t) return;
        t.className = 'toast ' + type;
        t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}" style="color:var(--${type === 'success' ? 'green' : 'red'})"></i> ${msg}`;
        t.style.display = 'flex';
        setTimeout(() => t.style.display = 'none', 3000);
    }

    function timeAgo(d) {
        if (!d) return '';
        const ms = Date.now() - new Date(d).getTime(), m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), dy = Math.floor(ms / 86400000);
        if (m < 1) return 'Just now'; if (m < 60) return m + 'm ago'; if (h < 24) return h + 'h ago'; if (dy < 7) return dy + 'd ago';
        return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    function esc(s) {
        if (!s) return '';
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Run init
    init();
};

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initPage);
} else {
    window.initPage();
}
