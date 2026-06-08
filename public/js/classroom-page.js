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
 * Classroom Page (Dashboard) Ã¢â‚¬â€ External JS Module
 * Loaded by the SPA router or directly via <script type="module" src>
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://hukbgzdreghzidgzwxlj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1a2JnemRyZWdoemlkZ3p3eGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzgyMjYsImV4cCI6MjA4NjkxNDIyNn0.iB3mmWQdnIUU0PaVo6UmwaW0V56BSeRSlyJ2_wrgsWs';
const supabase = createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let currentFilter = 'all';

// ----- SHARED CACHE FOR PARALLEL FETCHING -----
let classroomCache = {
    data: null,
    fetchPromise: null
};

/**
 * Fetches classrooms once and shares the promise/data across all dashboard widgets.
 * This runs in parallel with the Auth check to eliminate waterfall loading.
 * @param {boolean} forceRefresh - If true, bypasses cache and forces a new network request
 */
function getSharedClassrooms(forceRefresh = false) {
    if (forceRefresh) {
        classroomCache.data = null;
        classroomCache.fetchPromise = null;
    }
    if (classroomCache.data) return Promise.resolve(classroomCache.data);
    if (classroomCache.fetchPromise) return classroomCache.fetchPromise;

    const token = null;
    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;

    classroomCache.fetchPromise = fetch(`${API_BASE}/api/classrooms`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    })
        .then(res => res.ok ? res.json() : { classrooms: [] })
        .then(data => {
            classroomCache.data = data.classrooms || [];
            return classroomCache.data;
        })
        .catch(() => {
            return [];
        });

    return classroomCache.fetchPromise;
}

const SUBJECT_MAP = {
    science: { name: 'science', icon: 'fa-flask', color: '#10b981' },
    physics: { name: 'Physics', icon: 'fa-layer-group', color: '#f97316' },
    cpp: { name: 'C++ Programming', icon: 'fa-code', color: '#00d4ff' },
    mathematics: { name: 'Mathematics', icon: 'fa-square-root-alt', color: '#a855f7' }
};

const ALLOWED_FACULTY = [
    'physics@classgrid.in',
    'math@classgrid.in',
    'cpp@classgrid.in',
    'math@qunatumchem.site',
    'cpp@classgridsite'
];

/**
 * Returns true if the user is a faculty/teacher.
 * Supports both new 'faculty' role and legacy 'teacher' role.
 * For 'teacher' role, falls back to email allowlist for backward compat.
 */
function isAuthorizedFaculty(email, role) {
    // New system: role-based check
    if (role === 'faculty') return true;
    // Legacy: teacher role with email allowlist
    if (role === 'teacher') {
        return ALLOWED_FACULTY.includes(email) || (email && email.endsWith('@classgrid.in'));
    }
    return false;
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ INIT ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
async function init() {
    try {
        let token = localStorage.getItem('jwt_token');
        // Removed strict token check inline to defer to server cookie validation

        // ----- FAST-BOOT UI (OPTIMISTIC RENDER) -----
        const cachedUserStr = localStorage.getItem('user');
        if (cachedUserStr) {
            try {
                const cachedUser = JSON.parse(cachedUserStr);
                currentUser = cachedUser;
                // Instantly paint the shell
                updateNavbar(cachedUser);
                updateSidebar(cachedUser);
                updateSidebarNav(cachedUser);

                // Show the main grid but widgets will show custom spinners internally
                document.getElementById('loader').style.display = 'none';
                document.getElementById('mainContent').style.display = 'grid';

                // Paint the dashboard layout immediately
                if (isAuthorizedFaculty(cachedUser.email, cachedUser.role)) {
                    renderTeacherDashboard();
                } else {
                    renderStudentDashboard();
                }

                if (typeof gsap !== 'undefined') {
                    gsap.from('.sidebar', { x: -24, opacity: 0, duration: 0.65, ease: 'power3.out' });
                    gsap.from('.main', { y: 18, opacity: 0, duration: 0.65, delay: 0.1, ease: 'power3.out' });
                }
            } catch (e) {
                console.warn('Fast-boot failed, waiting for network', e);
            }
        }

        const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 8000);

        // KICK OFF AUTH AND DATA FETCH CONCURRENTLY
        const authFetch = fetch(`${API_BASE}/api/auth/me`, {
            signal: ctrl.signal,
            credentials: 'include'
        });

        // Start pre-fetching classrooms immediately so the widgets get it faster
        getSharedClassrooms();

        const res = await authFetch;
        clearTimeout(tid);

        if (!res.ok) {
            if (res.status === 401) { localStorage.removeItem('jwt_token'); window.location.href = '/login.html'; return; }
            throw new Error('Auth failed');
        }
        const data = await res.json();
        const freshUser = data.user || data;

        if (freshUser.organization && !freshUser.organization_id) {
            freshUser.organization_id = freshUser.organization;
        }

        // Admins should never end up on the classroom hub
        if (freshUser.role === 'super_admin') {
            window.location.href = '/super-admin-dashboard';
            return;
        }
        if (freshUser.role === 'org_admin') {
            window.location.href = '/org-admin-dashboard';
            return;
        }

        // If we didn't fast-boot, or data changed significantly, update UI
        if (!cachedUserStr || currentUser.email !== freshUser.email) {
            currentUser = freshUser;
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateNavbar(currentUser);
            updateSidebar(currentUser);
            updateSidebarNav(currentUser);

            if (isAuthorizedFaculty(currentUser.email, currentUser.role)) {
                renderTeacherDashboard();
            } else {
                renderStudentDashboard();
            }

            document.getElementById('loader').style.display = 'none';
            document.getElementById('mainContent').style.display = 'grid';
        }

    } catch (err) {
        console.error('Init error:', err);
        document.getElementById('loader').innerHTML = \
        <div style="text-align:center;padding:2rem">
            <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--red);margin-bottom:1rem;display:block"></i>
            <p style="color:var(--silver)">Connection error. <a href="/login.html" style="color:var(--cyan)">Login again</a></p>
        </div>\;
    }
}
function updateNavbar(user) {
    document.getElementById('navName').textContent = user.name.split(' ')[0];
    const roleEl = document.getElementById('navRole');
    // Map both new 'faculty' and legacy 'teacher' to the same 'teacher' badge class
    const displayRole = (user.role === 'faculty' || user.role === 'teacher') ? 'teacher' : user.role;
    const displayLabel = user.role === 'faculty' ? 'Faculty' : user.role === 'teacher' ? 'Faculty' : user.role;
    roleEl.textContent = displayLabel;
    roleEl.className = `role-badge ${displayRole}`;
    const ml = document.getElementById('manageLink');
    if (ml) ml.style.display = (user.role === 'teacher' || user.role === 'faculty') ? '' : 'none';
}

function updateSidebar(user) {
    const avatarEl = document.getElementById('sidebarAvatar');
    if (user.profilePicture) {
        avatarEl.innerHTML = `<img src="${user.profilePicture}" alt="${esc(user.name)}">`;
        avatarEl.style.fontSize = '0';
    } else {
        avatarEl.textContent = user.name.charAt(0).toUpperCase();
        avatarEl.style.fontSize = '';
    }

    document.getElementById('sidebarName').textContent = user.name;
    document.getElementById('sidebarEmail').textContent = user.email;

    // Account age
    const created = new Date(user.createdAt || Date.now());
    const diffMs = Date.now() - created;
    const diffDays = Math.floor(diffMs / 86400000);
    let ageText;
    if (diffDays < 1) {
        const h = Math.floor(diffMs / 3600000);
        ageText = h <= 1 ? 'Just now' : `${h} hours`;
    } else if (diffDays < 30) {
        ageText = diffDays === 1 ? '1 day' : `${diffDays} days`;
    } else if (diffDays < 365) {
        const mo = Math.floor(diffDays / 30);
        const rd = diffDays % 30;
        ageText = (mo === 1 ? '1 month' : `${mo} months`) + (rd > 0 ? `, ${rd}d` : '');
    } else {
        const yr = Math.floor(diffDays / 365);
        const rm = Math.floor((diffDays % 365) / 30);
        ageText = (yr === 1 ? '1 year' : `${yr} years`) + (rm > 0 ? `, ${rm}mo` : '');
    }
    document.getElementById('statAccountAge').textContent = ageText;
    document.getElementById('statCreatedAt').textContent = created.toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });

    // Subject badge for teachers
    if (user.role === 'teacher' && user.subject) {
        const subj = SUBJECT_MAP[user.subject];
        if (subj) {
            document.getElementById('subjectBadge').innerHTML = `
                        <div class="profile-subject-badge" style="border-color:${subj.color}33;color:${subj.color}">
                            <i class="fas ${subj.icon}"></i> ${subj.name} Faculty
                        </div>`;
        }
    }

    // Linked account pills
    const providers = user.linkedProviders || [user.authProvider || 'manual'];
    ['manual', 'google', 'github', 'linkedin'].forEach(p => {
        const pill = document.getElementById(`pill-${p}`);
        if (pill) pill.classList.toggle('active', providers.includes(p));
    });
}

function updateSidebarNav(user) {
    const link = document.getElementById('classroomNavLink');
    const text = document.getElementById('classroomNavText');
    const uploadNotesLink = document.getElementById('uploadNotesLink');

    // Both new 'faculty' and legacy 'teacher' (with authorized email) get the teacher-side nav
    const isFaculty = user.role === 'faculty' || (user.role === 'teacher' && isAuthorizedFaculty(user.email, user.role));

    if (isFaculty) {
        link.href = '/manage-classroom';
        text.textContent = 'Manage Classrooms';
        if (uploadNotesLink) uploadNotesLink.style.display = 'none';
    } else {
        link.href = '/my-classrooms';
        text.textContent = 'My Classrooms';
    }
    link.style.display = '';
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ TEACHER DASHBOARD ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
async function renderTeacherDashboard() {
    const main = document.getElementById('dynamicContent');
    const subj = currentUser.subject ? SUBJECT_MAP[currentUser.subject] : null;
    const label = subj ? subj.name : 'All Subjects';
    const org = currentUser.organization_id || currentUser.organization || null;
    const hasOrg = !!(org);
    const orgName = org?.name || '';
    const orgLogo = org?.logo_url || '';

    // If faculty has no org ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â show gate
    if (!hasOrg) {
        main.innerHTML = `
                    <div class="welcome-banner">
                        <div class="welcome-greeting">Welcome back</div>
                        <div class="welcome-name"><span>${esc(currentUser.name)}</span></div>
                        <div class="welcome-sub">${label} Faculty Dashboard</div>
                    </div>
                    <div class="card">
                        <div class="org-gate">
                            <div class="org-gate-icon"><i class="fas fa-building-columns"></i></div>
                            <h3>Connect to Your Organization</h3>
                            <p>Please connect to an organization before accessing classrooms, managing students, or uploading content.</p>
                            <div class="org-gate-form">
                                <input
                                    class="org-code-input"
                                    id="facultyOrgCodeInput"
                                    type="text"
                                    placeholder="Enter Faculty Organization Code"
                                    maxlength="12"
                                    autocomplete="off"
                                    oninput="this.value=this.value.toUpperCase().replace(/\\s/g,'')"
                                    onkeydown="if(event.key==='Enter')window.connectOrgFaculty()"
                                    style="max-width:unset;flex:1"
                                >
                                <button class="btn-access-org" id="facultyOrgAccessBtn" onclick="window.connectOrgFaculty()">
                                    <i class="fas fa-link"></i> Connect
                                </button>
                            </div>
                        </div>
                    </div>`;

        window.connectOrgFaculty = async () => {
            const input = document.getElementById('facultyOrgCodeInput');
            const btn = document.getElementById('facultyOrgAccessBtn');
            if (!input || !btn) return;
            const code = input.value.trim().toUpperCase();
            if (!code || code.length < 3) { showToast('Please enter a valid organization code', 'error'); return; }
            btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            const token = null;
            const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
            try {
                const res = await fetch(`${API_BASE}/api/organization/verify-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ code: code, type: 'faculty' })
                });
                const data = await res.json();
                if (!res.ok) { showToast(data.message || 'Invalid code', 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-link"></i> Connect'; return; }
                currentUser.organization_id = { _id: data.organizationId, name: data.organizationName, logo_url: data.organizationLogo };
                localStorage.setItem('user', JSON.stringify(currentUser));
                showToast(`âœ… Connected to ${data.organizationName}! Reloading dashboard...`, 'success');
                setTimeout(() => renderTeacherDashboard(), 1200);
            } catch (e) {
                showToast('Network error', 'error');
                btn.disabled = false; btn.innerHTML = '<i class="fas fa-link"></i> Connect';
            }
        };
        window.loadNotifications();
        return;
    }

    // Build org banner for faculty
    const orgBanner = `<div class="org-banner" style="margin-top:0.75rem">
                ${orgLogo ? `<img src="${esc(orgLogo)}" class="org-banner-logo" alt="${esc(orgName)} logo" onerror="this.style.display='none'">` : `<div class="org-banner-logo-placeholder"><i class="fas fa-building-columns"></i></div>`}
                <div class="org-banner-info">
                    <div class="org-banner-label">Your Organization</div>
                    <div class="org-banner-name">${esc(orgName)}</div>
                </div>
                <div class="org-banner-dot"></div>
            </div>`;

    main.innerHTML = `
                <div class="welcome-banner">
                    <div class="welcome-greeting">Welcome back</div>
                    <div class="welcome-name"><span>${esc(currentUser.name)}</span></div>
                    <div class="welcome-sub">${label} Faculty Dashboard</div>
                    ${orgBanner}
                    <div class="welcome-actions" style="margin-top:1rem">
                        <a href="/manage-classroom" class="btn btn-primary"><i class="fas fa-school"></i> Manage Classrooms</a>
                        <a href="/classgrid_assistant.html" class="btn btn-glass"><i class="fas fa-robot"></i> AI Assistant</a>
                    </div>
                </div>

                <div class="stats-row" id="statsRow">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-file-alt" style="color:var(--cyan)"></i></div>
                        <div class="stat-value" id="totalMaterials">...</div>
                        <div class="stat-label">Materials</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-clipboard-check" style="color:var(--purple)"></i></div>
                        <div class="stat-value" id="totalQuizzes">...</div>
                        <div class="stat-label">Quizzes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-bullhorn" style="color:var(--orange)"></i></div>
                        <div class="stat-value" id="totalAnnouncements">...</div>
                        <div class="stat-label">Announcements</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-eye" style="color:var(--green)"></i></div>
                        <div class="stat-value" id="totalViews">...</div>
                        <div class="stat-label">Total Views</div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title" style="justify-content:space-between">
                        <div><i class="fas fa-school"></i> My Classrooms</div>
                        <a href="/manage-classroom" class="btn-icon-small" title="Manage"><i class="fas fa-cog"></i></a>
                    </div>
                    <div id="teacherQuickClassrooms">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title" style="justify-content:space-between">
                        <div><i class="fas fa-history"></i> Recent Uploads (${label})</div>
                        <button onclick="window.loadTeacherSubjectContent()" class="btn-icon-small"><i class="fas fa-sync-alt"></i></button>
                    </div>
                    <div id="teacherSubjectContent">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>`;

    loadTeacherStats();
    loadTeacherSubjectContent();
    loadTeacherQuickClassrooms();
    window.loadNotifications();
}

async function loadTeacherStats() {
    try {
        const classrooms = await getSharedClassrooms();
        const cids = classrooms.map(c => c._id);
        if (!cids.length) { ['totalMaterials', 'totalQuizzes', 'totalAnnouncements', 'totalViews'].forEach(id => document.getElementById(id).textContent = 0); return; }
        const [m, q, a] = await Promise.all([
            supabase.from('materials').select('*', { count: 'exact', head: true }).in('classroom_id', cids),
            supabase.from('quizzes').select('*', { count: 'exact', head: true }).in('classroom_id', cids),
            supabase.from('announcements').select('*', { count: 'exact', head: true }).in('classroom_id', cids)
        ]);
        document.getElementById('totalMaterials').textContent = m.count || 0;
        document.getElementById('totalQuizzes').textContent = q.count || 0;
        document.getElementById('totalAnnouncements').textContent = a.count || 0;
        document.getElementById('totalViews').textContent = (m.count || 0) * 12 + (q.count || 0) * 8;
    } catch (e) { console.error('Stats error:', e); }
}

async function loadTeacherSubjectContent() {
    const list = document.getElementById('teacherSubjectContent');
    if (!list) return;
    try {
        const classrooms = await getSharedClassrooms();
        const cids = classrooms.map(c => c._id);
        const cNames = Object.fromEntries(classrooms.map(c => [c._id, c.name]));
        if (!cids.length) { list.innerHTML = '<div class="empty-state"><p>Create a classroom to start adding content.</p></div>'; return; }
        const [mr, ar, qr] = await Promise.all([
            supabase.from('materials').select('*').in('classroom_id', cids).order('created_at', { ascending: false }).limit(5),
            supabase.from('announcements').select('*').in('classroom_id', cids).order('created_at', { ascending: false }).limit(5),
            supabase.from('quizzes').select('*').in('classroom_id', cids).order('created_at', { ascending: false }).limit(5)
        ]);
        let updates = [
            ...(mr.data || []).map(m => ({ ...m, type: 'Material', icon: 'file-alt', color: 'cyan', link: m.file_url })),
            ...(ar.data || []).map(a => ({ ...a, type: 'Announcement', icon: 'bullhorn', color: 'purple', link: '#' })),
            ...(qr.data || []).map(q => ({ ...q, type: 'Quiz', icon: 'clipboard-list', color: 'green', link: q.quiz_url || '#' }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (!updates.length) { list.innerHTML = '<div class="empty-state"><p>No content uploaded yet.</p></div>'; return; }
        list.innerHTML = updates.map(u => `
                    <div class="content-item">
                        <div class="content-info" style="min-width:0;flex:1">
                            <h4><i class="fas fa-${u.icon}" style="color:var(--${u.color});margin-right:0.4rem;font-size:0.85rem"></i>${esc(u.title || u.message)}</h4>
                            <div class="content-meta">
                                <span class="tag">${esc(cNames[u.classroom_id] || '')}</span>
                                <span style="text-transform:capitalize"><i class="fas fa-tag"></i> ${u.type}</span>
                                <span><i class="fas fa-calendar-alt"></i> ${new Date(u.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        ${u.link !== '#' ? `<a href="${u.link}" target="_blank" class="btn-icon"><i class="fas fa-eye"></i></a>` : ''}
                    </div>`).join('');
    } catch (e) { list.innerHTML = '<div class="empty-state">Error loading content</div>'; }
}

async function loadTeacherQuickClassrooms() {
    const container = document.getElementById('teacherQuickClassrooms');
    if (!container) return;
    try {
        const classrooms = await getSharedClassrooms();
        if (!classrooms.length) { container.innerHTML = `<div class="empty-state"><i class="fas fa-school"></i><p>No classrooms yet.</p><a href="/manage-classroom" class="btn btn-primary" style="margin-top:0.8rem"><i class="fas fa-plus"></i> Create Classroom</a></div>`; return; }
        container.innerHTML = `<div class="subjects-grid">${classrooms.slice(0, 4).map(c => `
                    <div class="subj-card" style="text-align:left" onclick="(window.SpaRouter ? window.SpaRouter.navigate('/view-classroom?id=${c._id}') : window.location.href = '/view-classroom?id=${c._id}')">
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem">
                            <i class="fas fa-chalkboard" style="color:var(--purple);font-size:1.2rem;flex-shrink:0"></i>
                            <span style="font-weight:600;font-size:0.88rem;word-break:break-word">${esc(c.name)}</span>
                        </div>
                        <div style="font-size:0.7rem;color:var(--text-dim);display:flex;gap:0.5rem;flex-wrap:wrap">
                            <span><i class="fas fa-book"></i> ${esc(c.subject || c.subjectSlug || '')}</span>
                            <span><i class="fas fa-users"></i> ${c.memberCount || 0}</span>
                        </div>
                    </div>`).join('')}</div>
                ${classrooms.length > 4 ? `<a href="/manage-classroom" class="btn btn-glass" style="margin-top:0.8rem;width:100%;justify-content:center"><i class="fas fa-arrow-right"></i> View All</a>` : ''}`;
    } catch (e) { container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i> Could not load</div>'; }
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ STUDENT DASHBOARD ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
async function renderStudentDashboard() {
    const main = document.getElementById('dynamicContent');
    const org = currentUser.organization_id || currentUser.organization || null;
    const hasOrg = !!(org);
    const orgName = org?.name || '';
    const orgLogo = org?.logo_url || '';

    // Build org banner or input area
    const orgSection = hasOrg
        ? buildOrgBanner(orgName || 'Your Organization', orgLogo)
        : `<div class="org-code-section" id="orgCodeSection">
                    <input
                        class="org-code-input"
                        id="orgCodeInput"
                        type="text"
                        placeholder="Enter Student Honor Code"
                        maxlength="12"
                        autocomplete="off"
                        oninput="this.value=this.value.toUpperCase().replace(/\\s/g,'')"
                        onkeydown="if(event.key==='Enter')window.connectOrg()"
                    >
                    <button class="btn-access-org" id="orgAccessBtn" onclick="window.connectOrg()">
                        <i class="fas fa-link"></i> Access
                    </button>
                  </div>`;

    const rollLabel = org?.rollNumberLabel || 'PRN';
    const hasPrn = !!(currentUser.prn);
    const prnSection = hasPrn
        ? `<div style="margin-top:4px;display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:8px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.2)">
                    <span style="font-size:11px;font-weight:700;color:var(--text-dim)">${esc(rollLabel)}</span>
                    <span style="font-size:13px;font-weight:800;color:var(--cyan)">${esc(currentUser.prn)}</span>
                   </div>`
        : (hasOrg ? `<div id="prnSetupCard" style="margin-top:10px;padding:12px 16px;border-radius:10px;background:rgba(255,193,7,.06);border:1px solid rgba(255,193,7,.2)">
                    <div style="font-size:12px;font-weight:700;color:#ffc107;margin-bottom:6px"><i class="fas fa-id-badge" style="margin-right:4px"></i>Set your ${esc(rollLabel)}</div>
                    <div style="display:flex;gap:6px;align-items:center">
                        <input id="prnInput" type="text" placeholder="e.g. 2201ABC" maxlength="9" oninput="this.value=this.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-deep);color:var(--white);font-size:13px;font-weight:600;font-family:inherit">
                        <button onclick="window.submitPrn()" style="padding:8px 14px;border-radius:8px;border:none;background:var(--cyan);color:#000;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap"><i class="fas fa-check"></i> Set</button>
                    </div>
                    <div style="font-size:10px;color:var(--text-dim);margin-top:4px">Max 9 characters (letters and numbers only). Cannot be changed later.</div>
                    <div id="prnError" style="display:none;margin-top:4px;font-size:11px;color:var(--red);font-weight:600"></div>
                   </div>` : '');

    main.innerHTML = `
                <div class="welcome-banner">
                    <div class="welcome-greeting">Welcome back</div>
                    <div class="welcome-name"><span>${esc(currentUser.name)}</span></div>
                    ${prnSection}
                    <div class="welcome-sub">Ready to continue your learning journey?</div>
                    <div class="welcome-actions">
                        <a href="/my-classrooms" class="btn btn-primary"><i class="fas fa-school"></i> Join Classrooms</a>
                        ${orgSection}
                        <button onclick="window.openBrowseClassrooms()" class="btn btn-glass" ${!hasOrg ? 'id="browseBtn" style="opacity:0.5" title="Connect to an organization first"' : ''}>
                            <i class="fas fa-search"></i> Available Classrooms
                        </button>
                        <a href="/classgrid_assistant.html" class="btn btn-glass"><i class="fas fa-robot"></i> Ask AI</a>
                    </div>
                    <div id="orgBannerSlot">${hasOrg ? '' : ''}</div>
                </div>

                <div class="card">
                    <div class="card-title" style="justify-content:space-between">
                        <div><i class="fas fa-school"></i> My Classrooms</div>
                        <button onclick="window.loadQuickClassrooms(true)" class="btn-icon-small"><i class="fas fa-sync-alt"></i></button>
                    </div>
                    <div id="quickClassroomsList">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title" style="justify-content:space-between">
                        <div><i class="fas fa-calendar-check"></i> Attendance Overview</div>
                        <button onclick="window.loadAttendanceOverview()" class="btn-icon-small"><i class="fas fa-sync-alt"></i></button>
                    </div>
                    <div class="att-filter-bar" id="attFilterBar">
                        <select id="attClassroomFilter" onchange="window.loadAttendanceOverview()">
                            <option value="">All Classrooms</option>
                        </select>
                        <select id="attMonthFilter" onchange="window.onAttFilterChange()">
                            ${(() => {
            const now = new Date();
            let opts = '<option value="week">This Week</option>';
            opts += '<option value="month" selected>This Month</option>';
            for (let i = 0; i < 6; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const m = d.getMonth() + 1;
                const y = d.getFullYear();
                const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
                opts += '<option value="' + m + '-' + y + '">' + label + '</option>';
            }
            opts += '<option value="custom">Custom Range</option>';
            return opts;
        })()}
                        </select>
                        <input type="date" id="attStartDate" style="display:none" onchange="window.loadAttendanceOverview()">
                        <input type="date" id="attEndDate" style="display:none" onchange="window.loadAttendanceOverview()">
                    </div>
                    <div id="attendanceOverview">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title" style="justify-content:space-between">
                        <div><i class="fas fa-stream"></i> Recent Updates</div>
                        <button onclick="window.loadStudentContent()" class="btn-icon-small"><i class="fas fa-sync-alt"></i></button>
                    </div>
                    <div class="filter-bar">
                        <button class="filter-chip active" onclick="window.setFilter('all',this)">All</button>
                        <button class="filter-chip" onclick="window.setFilter('week',this)">This Week</button>
                        <button class="filter-chip" onclick="window.setFilter('month',this)">This Month</button>
                    </div>
                    <div id="studentRecentList">
                        <div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>
                    </div>
                </div>`;

    loadStudentContent();
    loadQuickClassrooms();
    loadAttendanceOverview();
    window.loadNotifications();
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ORG HELPERS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function buildOrgBanner(name, logo) {
    const logoHtml = logo
        ? `<img src="${esc(logo)}" class="org-banner-logo" alt="${esc(name)} logo" onerror="this.style.display='none'">`
        : `<div class="org-banner-logo-placeholder"><i class="fas fa-building-columns"></i></div>`;
    return `<div class="org-banner" onclick="window.toggleOrgInfo()" style="cursor:pointer" title="Click to view organization details">
                ${logoHtml}
                <div class="org-banner-info">
                    <div class="org-banner-label">Connected to</div>
                    <div class="org-banner-name">${esc(name)}</div>
                </div>
                <div class="org-banner-dot"></div>
                <i class="fas fa-chevron-down org-banner-chevron" id="orgBannerChevron" style="color:var(--text-dim);font-size:0.7rem;margin-left:auto;transition:transform 0.3s"></i>
            </div>
            <div id="orgInfoPanel" style="display:none"></div>`;
}

let _orgInfoCache = null;

window.toggleOrgInfo = async () => {
    const panel = document.getElementById('orgInfoPanel');
    const chevron = document.getElementById('orgBannerChevron');
    if (!panel) return;

    // Toggle
    if (panel.style.display !== 'none') {
        panel.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        return;
    }

    panel.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';

    // Already loaded?
    if (_orgInfoCache) {
        renderOrgInfoPanel(panel, _orgInfoCache);
        return;
    }

    panel.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-dim)"><i class="fas fa-spinner fa-spin"></i> Loading organization info...</div>';

    try {
        const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
        const res = await fetch(`${API_BASE}/api/organization/public-info`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        _orgInfoCache = data;
        renderOrgInfoPanel(panel, data);
    } catch (e) {
        panel.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--red);font-size:0.82rem"><i class="fas fa-exclamation-circle"></i> Could not load organization info</div>';
    }
};

function renderOrgInfoPanel(panel, data) {
    const { org, faculties, stats, userJoinedAt } = data;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    const facultyHtml = faculties.length > 0
        ? faculties.map(f => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
            ${f.avatar ? `<img src="${esc(f.avatar)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">` : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(168,85,247,0.15);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--purple)">${esc(f.name.charAt(0).toUpperCase())}</div>`}
            <span style="font-size:0.82rem;color:var(--text)">${esc(f.name)}</span>
        </div>`).join('')
        : '<div style="font-size:0.8rem;color:var(--text-dim)">No faculty members yet</div>';

    panel.innerHTML = `
        <div style="margin-top:0.5rem;padding:1.25rem;background:var(--bg-deep,#0a0f1e);border:1px solid var(--border,#1e293b);border-radius:12px;animation:orgPanelIn 0.3s ease">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem">
                ${org.logo
            ? `<img src="${esc(org.logo)}" alt="${esc(org.name)}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;border:1px solid var(--border,#1e293b)" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
                <div style="width:36px;height:36px;border-radius:8px;background:rgba(168,85,247,0.12);display:${org.logo ? 'none' : 'flex'};align-items:center;justify-content:center"><i class="fas fa-building-columns" style="color:var(--purple);font-size:1rem"></i></div>
                <div>
                    <div style="font-size:0.9rem;font-weight:700;color:var(--text)">${esc(org.name)}</div>
                    <div style="font-size:0.68rem;color:var(--text-dim)">Organization Details</div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-bottom:1rem">
                <div style="text-align:center;padding:10px;border-radius:8px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.12)">
                    <div style="font-size:1.3rem;font-weight:800;color:var(--cyan)">${stats.studentCount}</div>
                    <div style="font-size:0.68rem;color:var(--text-dim);font-weight:600">Students</div>
                </div>
                <div style="text-align:center;padding:10px;border-radius:8px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.12)">
                    <div style="font-size:1.3rem;font-weight:800;color:var(--purple)">${stats.facultyCount}</div>
                    <div style="font-size:0.68rem;color:var(--text-dim);font-weight:600">Faculty</div>
                </div>
                <div style="text-align:center;padding:10px;border-radius:8px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.12)">
                    <div style="font-size:1.3rem;font-weight:800;color:var(--green)">${stats.classroomCount}</div>
                    <div style="font-size:0.68rem;color:var(--text-dim);font-weight:600">Classrooms</div>
                </div>
            </div>

            <div style="display:grid;gap:8px;font-size:0.82rem">
                ${org.adminName ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border,#1e293b)"><span style="color:var(--text-dim)">Admin</span><span style="font-weight:600;color:var(--text)">${esc(org.adminName)}${org.adminDesignation ? ` <span style="color:var(--text-dim);font-weight:400">(${esc(org.adminDesignation)})</span>` : ''}</span></div>` : ''}
                ${org.address ? `<div style="display:flex;justify-content:space-between;gap:1rem;padding:6px 0;border-bottom:1px solid var(--border,#1e293b)"><span style="color:var(--text-dim);flex-shrink:0">Address</span><span style="font-weight:600;color:var(--text);text-align:right;word-break:break-word">${esc(org.address)}</span></div>` : ''}
                ${org.phone ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border,#1e293b)"><span style="color:var(--text-dim)">Phone</span><span style="font-weight:600;color:var(--text)">${esc(org.phone)}</span></div>` : ''}
                ${org.website ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border,#1e293b)"><span style="color:var(--text-dim)">Website</span><a href="${esc(org.website)}" target="_blank" style="font-weight:600;color:var(--cyan);text-decoration:none">${esc(org.website)}</a></div>` : ''}
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border,#1e293b)"><span style="color:var(--text-dim)">Registered</span><span style="font-weight:600;color:var(--text)">${fmtDate(org.registeredAt)}</span></div>
                ${userJoinedAt ? `<div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--text-dim)">You Joined</span><span style="font-weight:600;color:var(--green)">${fmtDate(userJoinedAt)}</span></div>` : ''}
            </div>

            <div style="margin-top:1rem">
                <div style="font-size:0.75rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px"><i class="fas fa-chalkboard-teacher" style="margin-right:4px"></i> Faculty Members</div>
                ${facultyHtml}
            </div>
        </div>`;
}

window.submitPrn = async () => {
    const input = document.getElementById('prnInput');
    const errEl = document.getElementById('prnError');
    if (!input) return;
    const val = input.value.trim();
    if (!val) { errEl.style.display = 'block'; errEl.textContent = 'Please enter a value.'; return; }
    try {
        const token = null;
        const r = await fetch('/api/user/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ prn: val })
        });
        const d = await r.json();
        if (!r.ok) { errEl.style.display = 'block'; errEl.textContent = d.message || 'Failed'; return; }
        // Success ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â replace card with badge
        const card = document.getElementById('prnSetupCard');
        const org = currentUser.organization_id || currentUser.organization || null;
        const rl = org?.rollNumberLabel || 'PRN';
        if (card) {
            card.outerHTML = `<div style="margin-top:4px;display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:8px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.2)">
                        <span style="font-size:11px;font-weight:700;color:var(--text-dim)">${esc(rl)}</span>
                        <span style="font-size:13px;font-weight:800;color:var(--cyan)">${esc(val)}</span>
                    </div>`;
        }
        currentUser.prn = val;
    } catch (e) { errEl.style.display = 'block'; errEl.textContent = 'Network error'; }
};

window.connectOrg = async () => {
    const input = document.getElementById('orgCodeInput');
    const btn = document.getElementById('orgAccessBtn');
    if (!input || !btn) return;
    const code = input.value.trim().toUpperCase();
    if (!code || code.length < 3) { showToast('Please enter a valid organization code', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    const token = null;
    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
    try {
        const res = await fetch(`${API_BASE}/api/organization/verify-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ code: code, type: 'student' })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.message || 'Invalid code', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-link"></i> Access';
            return;
        }
        // Success — update currentUser and refresh UI
        currentUser.organization_id = {
            _id: data.organizationId,
            name: data.organizationName,
            logo_url: data.organizationLogo
        };
        localStorage.setItem('user', JSON.stringify(currentUser));
        showToast(`✅ Connected to ${data.organizationName}!`, 'success');

        // Fully re-render dashboard so PRN step activates
        renderStudentDashboard();
    } catch (e) {
        showToast('Network error. Please try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-link"></i> Access';
    }
};

window.loadQuickClassrooms = async (forceRefresh = false) => {
    const container = document.getElementById('quickClassroomsList');
    if (!container) return;
    // Guard: no org ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ show prompt
    if (!currentUser?.organization_id) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-door-open"></i><p>Connect to an organization to see your classrooms.</p></div>';
        return;
    }

    if (forceRefresh) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
    }

    try {
        const allClassrooms = await getSharedClassrooms(forceRefresh);
        const rooms = allClassrooms.filter(c => c.membershipStatus === 'approved');
        if (!rooms.length) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-door-open"></i><p>No classrooms joined yet.</p><button onclick="window.openBrowseClassrooms()" class="btn btn-primary" style="margin-top:0.8rem"><i class="fas fa-plus"></i> Join a Classroom</button></div>`;
            return;
        }
        container.innerHTML = `<div class="subjects-grid">${rooms.slice(0, 6).map(c => `
                    <a href="/view-classroom.html?id=${c._id}" class="subj-card" style="text-align:left">
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem">
                            <i class="fas fa-chalkboard" style="color:var(--cyan);font-size:1.2rem;flex-shrink:0"></i>
                            <span style="font-weight:600;font-size:0.88rem;word-break:break-word">${esc(c.name)}</span>
                        </div>
                        <div style="font-size:0.7rem;color:var(--text-dim);display:flex;gap:0.5rem;flex-wrap:wrap">
                            <span><i class="fas fa-book"></i> ${esc(c.subject || c.subjectSlug || '')}</span>
                            <span><i class="fas fa-user-graduate"></i> ${esc(c.teacher?.name || 'Unknown')}</span>
                            <span><i class="fas fa-users"></i> ${c.memberCount || 0}</span>
                        </div>
                    </a>`).join('')}</div>
                ${rooms.length > 6 ? `<a href="/my-classrooms" class="btn btn-glass" style="margin-top:0.8rem;width:100%;justify-content:center"><i class="fas fa-arrow-right"></i> View All</a>` : ''}`;
    } catch (e) { container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i> Could not load classrooms</div>'; }
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ATTENDANCE OVERVIEW ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
let _attClassroomsPopulated = false;

function pctColor(p) { return p >= 75 ? 'green' : p >= 60 ? 'orange' : 'red'; }

window.onAttFilterChange = () => {
    const sel = document.getElementById('attMonthFilter');
    const sd = document.getElementById('attStartDate');
    const ed = document.getElementById('attEndDate');
    if (sel.value === 'custom') {
        sd.style.display = ''; ed.style.display = '';
        if (!sd.value || !ed.value) return; // wait for both dates
    } else {
        sd.style.display = 'none'; ed.style.display = 'none';
    }
    window.loadAttendanceOverview();
};

async function loadAttendanceOverview() {
    const container = document.getElementById('attendanceOverview');
    if (!container) return;
    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';

    const token = null;
    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;

    // Build query params
    const monthSel = document.getElementById('attMonthFilter');
    const classroomSel = document.getElementById('attClassroomFilter');
    let url = `${API_BASE}/api/attendance/my-overview?`;

    if (monthSel && monthSel.value === 'custom') {
        const sd = document.getElementById('attStartDate')?.value;
        const ed = document.getElementById('attEndDate')?.value;
        if (!sd || !ed) { container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Select both start and end dates.</p></div>'; return; }
        url += `startDate=${sd}&endDate=${ed}`;
    } else if (monthSel && monthSel.value === 'week') {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        url += `startDate=${weekStart.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`;
    } else if (monthSel && monthSel.value === 'month') {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        url += `startDate=${monthStart.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`;
    } else if (monthSel) {
        const [m, y] = monthSel.value.split('-');
        url += `month=${m}&year=${y}`;
    }

    if (classroomSel && classroomSel.value) {
        url += `&classroom=${classroomSel.value}`;
    }

    try {
        const res = await fetch(url, { headers: {} });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();

        // Populate classroom dropdown (only once)
        if (!_attClassroomsPopulated && data.classrooms?.length) {
            const dd = document.getElementById('attClassroomFilter');
            if (dd) {
                // Keep "All Classrooms" and add options
                const allRooms = data.classrooms;
                // Also fetch all memberships to include zero-session classrooms
                try {
                    const allClassrooms = await getSharedClassrooms();
                    const approved = allClassrooms.filter(c => c.membershipStatus === 'approved');
                    approved.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c._id;
                        opt.textContent = c.name;
                        dd.appendChild(opt);
                    });
                } catch { }
                _attClassroomsPopulated = true;
            }
        }

        const o = data.overall;
        if (!o || o.totalSessions === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-check" style="font-size:2rem;opacity:0.3"></i><p>No attendance sessions recorded for this period.</p></div>';
            return;
        }

        const col = pctColor(o.percentage);
        let html = `
                    <div class="att-overall">
                        <div class="att-ring-box">
                            <div class="att-ring ${col}" style="--pct:${o.percentage}">
                                <div class="att-ring-inner">${o.percentage}%</div>
                            </div>
                            <div class="att-ring-details">
                                <h5>Overall Attendance</h5>
                                <span>${o.present} of ${o.totalSessions} sessions</span>
                            </div>
                        </div>
                        <div class="att-stat-tiles">
                            <div class="att-tile"><div class="att-tile-val cyan">${o.totalSessions}</div><div class="att-tile-label">Total</div></div>
                            <div class="att-tile"><div class="att-tile-val green">${o.present}</div><div class="att-tile-label">Present</div></div>
                            <div class="att-tile"><div class="att-tile-val red">${o.absent}</div><div class="att-tile-label">Absent</div></div>
                        </div>
                    </div>`;

        // Per-classroom rows
        if (data.classrooms?.length) {
            html += data.classrooms.map(c => {
                const cc = pctColor(c.percentage);
                return `<div class="att-classroom-row">
                            <div class="att-row-name">
                                <h5>${esc(c.name)}</h5>
                                <span>${esc(c.subject || '')}</span>
                            </div>
                            <div class="att-row-bar"><div class="att-row-bar-fill ${cc}" style="width:${c.percentage}%"></div></div>
                            <div class="att-row-pct ${cc}">${c.percentage}%</div>
                            <div class="att-row-stat">${c.present}/${c.totalSessions}</div>
                        </div>`;
            }).join('');
        }

        // Defaulter warning
        if (o.isDefaulter) {
            html += `<div class="att-defaulter-warn"><i class="fas fa-exclamation-triangle"></i> Your overall attendance is below 75%. You may be marked as a defaulter.</div>`;
        }

        container.innerHTML = html;
    } catch (e) {
        console.error('[Attendance] Overview load error:', e);
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Could not load attendance data.</p></div>';
    }
}
window.loadAttendanceOverview = loadAttendanceOverview;
window.onAttFilterChange = window.onAttFilterChange;

function getFilterDate() {
    const now = new Date();
    if (currentFilter === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString(); }
    if (currentFilter === 'month') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString(); }
    return null;
}

async function loadStudentContent() {
    const list = document.getElementById('studentRecentList');
    if (!list) return;
    try {
        const allClassrooms = await getSharedClassrooms();
        const rooms = allClassrooms.filter(c => c.membershipStatus === 'approved');
        if (!rooms.length) { list.innerHTML = '<div class="empty-state"><i class="fas fa-door-open"></i><p>Join a classroom to see updates.</p></div>'; return; }
        const ids = rooms.map(c => c._id);
        const names = Object.fromEntries(rooms.map(c => [c._id, c.name]));
        const filterDate = getFilterDate();
        const [mr, ar, qr] = await Promise.all([
            supabase.from('materials').select('*').in('classroom_id', ids).order('created_at', { ascending: false }).limit(10),
            supabase.from('announcements').select('*').in('classroom_id', ids).order('created_at', { ascending: false }).limit(10),
            supabase.from('quizzes').select('*').in('classroom_id', ids).order('created_at', { ascending: false }).limit(10)
        ]);
        let updates = [
            ...(mr.data || []).map(m => ({ ...m, icon: 'file-alt', color: 'cyan', link: m.file_url, isExt: true })),
            ...(ar.data || []).map(a => ({ ...a, icon: 'bullhorn', color: 'purple', link: '#' })),
            ...(qr.data || []).map(q => ({ ...q, icon: 'clipboard-list', color: 'green', link: `/quiz-viewer.html?id=${q.id}&cid=${q.classroom_id}` }))
        ];
        if (filterDate) updates = updates.filter(u => new Date(u.created_at) >= new Date(filterDate));
        updates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (!updates.length) { list.innerHTML = '<div class="empty-state"><i class="fas fa-stream"></i><p>No recent updates.</p></div>'; return; }
        list.innerHTML = updates.slice(0, 15).map(u => `
                    <div class="content-item">
                        <div class="content-info" style="min-width:0;flex:1">
                            <h4><i class="fas fa-${u.icon}" style="color:var(--${u.color});margin-right:0.4rem;font-size:0.85rem"></i>${esc(u.title || u.message)}</h4>
                            <div class="content-meta">
                                <span class="tag tag-${u.subject_slug || ''}">${u.subject_slug || ''}</span>
                                <span><i class="fas fa-university"></i> ${esc(names[u.classroom_id] || '')}</span>
                                <span><i class="fas fa-calendar-alt"></i> ${new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                            </div>
                        </div>
                        <a href="${u.link}" ${u.isExt ? 'target="_blank"' : ''} class="btn-icon"><i class="fas fa-arrow-right"></i></a>
                    </div>`).join('');
    } catch (e) { console.error(e); list.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load updates.</p></div>'; }
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ BROWSE CLASSROOMS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
window.openBrowseClassrooms = () => {
    document.getElementById('browseClassroomsModal').classList.add('active');
    document.body.classList.add('modal-open');
    window.loadBrowseClassrooms();
};
window.closeBrowseClassrooms = () => {
    document.getElementById('browseClassroomsModal').classList.remove('active');
    document.body.classList.remove('modal-open');
};

let searchTimeout;
window.debouncedSearch = () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(window.loadBrowseClassrooms, 450); };

window.loadBrowseClassrooms = async () => {
    const search = document.getElementById('browseSearchInput').value.trim();
    const list = document.getElementById('browseList');
    list.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
    const token = null;
    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
    try {
        let url = `${API_BASE}/api/classrooms/discover`;
        if (search) url += `?search=${encodeURIComponent(search)}`;
        const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + (token), 'Content-Type': 'application/json' } });
        const { classrooms = [] } = await res.json();
        if (!classrooms.length) { list.innerHTML = '<div class="empty-state"><p>No classrooms found.</p></div>'; return; }
        list.innerHTML = classrooms.map(c => {
            let btn = `<button onclick="window.joinClassroom('${c._id}')" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:0.5rem"><i class="fas fa-user-plus"></i> Request to Join</button>`;
            if (c.membershipStatus === 'pending') btn = `<button disabled class="btn btn-glass" style="width:100%;justify-content:center;margin-top:0.5rem;opacity:0.7"><i class="fas fa-clock"></i> Pending</button>`;
            else if (c.membershipStatus === 'approved') btn = `<button disabled class="btn btn-glass" style="width:100%;justify-content:center;margin-top:0.5rem;border-color:var(--green);color:var(--green)"><i class="fas fa-check"></i> Member</button>`;
            else if (c.membershipStatus === 'rejected') btn = `<button onclick="window.joinClassroom('${c._id}')" class="btn btn-danger" style="width:100%;justify-content:center;margin-top:0.5rem"><i class="fas fa-redo"></i> Re-Apply</button>`;
            return `<div class="card" style="padding:1rem">
                        <div class="card-title" style="font-size:0.95rem;margin-bottom:0.4rem"><i class="fas fa-chalkboard"></i> ${esc(c.name)}</div>
                        <div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:0.5rem;line-height:1.6">
                            <i class="fas fa-book"></i> ${esc(c.subject || c.subjectSlug || '')} &nbsp;
                            <i class="fas fa-user"></i> ${esc(c.teacher?.name || 'Unknown')} &nbsp;
                            <i class="fas fa-users"></i> ${c.memberCount || 0}
                        </div>
                        <div style="font-size:0.73rem;color:var(--silver);margin-bottom:0.4rem">${esc(c.description || 'No description.')}</div>
                        ${btn}
                    </div>`;
        }).join('');
    } catch (e) { list.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i> Failed to load</div>'; }
};

window.joinClassroom = async (id) => {
    if (!confirm('Send a request to join this classroom?')) return;
    const token = null;
    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
    try {
        const res = await fetch(`${API_BASE}/api/classrooms/${id}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (res.ok) { showToast('Join request sent!', 'success'); window.loadBrowseClassrooms(); }
        else showToast(data.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
};

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ NOTIFICATIONS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
let allNotifications = [];
let notifFilter = 'all';

window.toggleNotifications = () => {
    const panel = document.getElementById('notifDropdown');
    const backdrop = document.getElementById('notifBackdrop');
    const isOpen = panel.classList.contains('active');
    if (isOpen) {
        window.closeNotifications();
    } else {
        panel.classList.add('active');
        backdrop.classList.add('active');
        document.body.classList.add('modal-open');
        window.loadNotifications();
    }
};

window.closeNotifications = () => {
    document.getElementById('notifDropdown').classList.remove('active');
    document.getElementById('notifBackdrop').classList.remove('active');
    document.body.classList.remove('modal-open');
};

window.filterNotifs = (filter, btn) => {
    notifFilter = filter;
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderNotifList();
};

function getNotifIcon(n) {
    const title = (n.title || '').toLowerCase();
    const msg = (n.message || '').toLowerCase();
    if (title.includes('approved') || title.includes('welcome') || msg.includes('approved')) return { cls: 'success', icon: 'fa-check-circle' };
    if (title.includes('reject') || title.includes('denied') || msg.includes('reject')) return { cls: 'alert', icon: 'fa-times-circle' };
    if (title.includes('classroom') || title.includes('class')) return { cls: 'info', icon: 'fa-chalkboard' };
    if (title.includes('quiz') || title.includes('test')) return { cls: 'system', icon: 'fa-clipboard-list' };
    if (title.includes('material') || title.includes('upload') || title.includes('file')) return { cls: 'info', icon: 'fa-file-alt' };
    if (title.includes('announcement')) return { cls: 'system', icon: 'fa-bullhorn' };
    return { cls: 'info', icon: 'fa-bell' };
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr);
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function renderNotifList() {
    const list = document.getElementById('notifList');
    const filtered = notifFilter === 'unread'
        ? allNotifications.filter(n => !n.isRead)
        : allNotifications;

    if (!filtered.length) {
        const msg = notifFilter === 'unread'
            ? 'No unread notifications.<br>You\'re all caught up!'
            : 'No notifications yet.<br>New alerts will appear here.';
        list.innerHTML = `
                    <div class="notif-empty">
                        <div class="notif-empty-icon"><i class="fas fa-bell-slash"></i></div>
                        <h5>${notifFilter === 'unread' ? 'All caught up!' : 'No notifications'}</h5>
                        <p>${msg}</p>
                    </div>`;
        return;
    }

    list.innerHTML = filtered.map(n => {
        const { cls, icon } = getNotifIcon(n);
        return `
                <div class="notif-item ${n.isRead ? '' : 'unread'}" onclick="window.handleNotifClick('${n._id}', '${n.link || ''}')">
                    <div class="notif-dot ${cls}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="notif-body">
                        <div class="notif-title">${esc(n.title)}</div>
                        <div class="notif-msg">${esc(n.message)}</div>
                        <div class="notif-meta">
                            <span class="notif-time">
                                <i class="fas fa-clock" style="font-size:0.6rem"></i>
                                ${timeAgo(n.createdAt)}
                            </span>
                            ${!n.isRead ? '<span class="notif-unread-dot"></span>' : ''}
                        </div>
                    </div>
                </div>`;
    }).join('');
}

window.loadNotifications = async () => {
    const token = null;
    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
    const badge = document.getElementById('notifBadge');
    const subtitle = document.getElementById('notifSubtitle');

    try {
        const res = await fetch(`${API_BASE}/api/notifications`, { headers: { 'Authorization': 'Bearer ' + (token), 'Content-Type': 'application/json' } });
        const data = await res.json();
        allNotifications = data.notifications || [];

        const unread = data.unreadCount || 0;
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
        subtitle.textContent = unread > 0 ? `${unread} unread` : `${allNotifications.length} total`;

        renderNotifList();
    } catch (e) {
        document.getElementById('notifList').innerHTML = `
                    <div class="notif-empty">
                        <div class="notif-empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                        <h5>Failed to load</h5>
                        <p>Check your connection and try again.</p>
                    </div>`;
    }
};

window.handleNotifClick = async (id, link) => {
    // OPTIMISTIC: Update UI immediately
    const n = allNotifications.find(n => n._id === id);
    if (n) { n.isRead = true; }
    renderNotifList();
    const unread = allNotifications.filter(n => !n.isRead).length;
    const badge = document.getElementById('notifBadge');
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
    document.getElementById('notifSubtitle').textContent = unread > 0 ? `${unread} unread` : `${allNotifications.length} total`;
    if (link) { window.closeNotifications(); window.location.href = link; }

    // Fire API call in background
    const token = null;
    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
    fetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + (token), 'Content-Type': 'application/json' } }).catch(() => { });
};

window.markAllRead = async () => {
    // OPTIMISTIC: Update UI immediately ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â don't wait for API
    allNotifications.forEach(n => n.isRead = true);
    const badge = document.getElementById('notifBadge');
    badge.style.display = 'none';
    document.getElementById('notifSubtitle').textContent = `${allNotifications.length} total`;
    renderNotifList();

    // Fire API call in background (don't block UI)
    const token = null;
    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
    fetch(`${API_BASE}/api/notifications/read-all`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + (token), 'Content-Type': 'application/json' } }).catch(() => { });
};

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ FILTER ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
window.setFilter = (filter, btn) => {
    currentFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    if (currentUser?.role !== 'teacher') loadStudentContent();
};

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ DELETE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
window.deleteContent = async (table, id) => {
    if (!confirm('Delete this item?')) return;
    await supabase.from(table).delete().eq('id', id);
    loadTeacherSubjectContent();
    showToast('Deleted', 'info');
};

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ TOAST ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
window.showToast = (msg, type = 'info') => {
    const t = document.getElementById('toast');
    t.className = `toast show ${type}`;
    t.querySelector('span').textContent = msg;
    setTimeout(() => t.classList.remove('show'), 4000);
};
function showToast(m, t) { window.showToast(m, t); }

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ LOGOUT ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
window.handleLogout = () => { if (window.AppState) { window.AppState.clearAll(); } else { localStorage.removeItem('jwt_token'); sessionStorage.clear(); } window.location.replace('/login.html'); };

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ EDIT PROFILE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
let pendingPhotoBase64 = null;

window.openEditProfile = () => {
    if (!currentUser) return;
    const isTeacher = currentUser.role === 'teacher' && isAuthorizedFaculty(currentUser.email);

    // Toggle field sections
    document.getElementById('teacherFields').style.display = isTeacher ? 'block' : 'none';
    document.getElementById('studentFields').style.display = isTeacher ? 'none' : 'block';

    // Common fields
    document.getElementById('editName').value = currentUser.name || '';
    document.getElementById('editEmail').value = currentUser.email || '';

    // Role-specific fields
    if (isTeacher) {
        document.getElementById('editDepartment').value = currentUser.department || '';
        document.getElementById('editQualification').value = currentUser.qualification || '';
        document.getElementById('editBio').value = currentUser.bio || '';
        document.getElementById('editPhone').value = currentUser.phoneNumber || '';
    } else {
        document.getElementById('editBranch').value = currentUser.branch || '';
        document.getElementById('editCollege').value = currentUser.college || '';
        document.getElementById('editStudentBio').value = currentUser.bio || '';
    }

    // Photo preview
    const prev = document.getElementById('photoPreviewContent');
    prev.innerHTML = currentUser.profilePicture
        ? `<img src="${currentUser.profilePicture}" alt="Profile">`
        : '<i class="fas fa-user photo-placeholder"></i>';

    const modal = document.getElementById('editProfileModal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('active'));
    document.body.classList.add('modal-open');
};

window.closeEditProfile = () => {
    const modal = document.getElementById('editProfileModal');
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modal.style.display = 'none'; }, 260);
    pendingPhotoBase64 = null;
};

// Close on overlay backdrop click
const _editModal = document.getElementById('editProfileModal');
const _browseModal = document.getElementById('browseClassroomsModal');
if (_editModal) _editModal.addEventListener('click', e => { if (e.target === e.currentTarget) window.closeEditProfile(); });
if (_browseModal) _browseModal.addEventListener('click', e => { if (e.target === e.currentTarget) window.closeBrowseClassrooms(); });

// Close on Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        window.closeEditProfile();
        window.closeBrowseClassrooms();
        window.closeNotifications();
    }
});


window.handlePhotoSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 512000) { showToast('Photo must be under 500KB', 'error'); event.target.value = ''; return; }
    if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = e => {
        pendingPhotoBase64 = e.target.result;
        document.getElementById('photoPreviewContent').innerHTML = `<img src="${pendingPhotoBase64}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
};

window.saveProfile = async () => {
    const btn = document.getElementById('saveProfileBtn');
    const name = document.getElementById('editName').value.trim();
    if (!name) { showToast('Name cannot be empty', 'error'); return; }

    const isTeacher = currentUser.role === 'teacher' && isAuthorizedFaculty(currentUser.email);

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    try {
        const token = null;
        const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;

        const body = { name };

        if (isTeacher) {
            body.phoneNumber = document.getElementById('editPhone').value.trim();
            body.department = document.getElementById('editDepartment').value.trim();
            body.qualification = document.getElementById('editQualification').value.trim();
            body.bio = document.getElementById('editBio').value.trim();
        } else {
            body.branch = document.getElementById('editBranch').value.trim();
            body.college = document.getElementById('editCollege').value.trim();
            body.bio = document.getElementById('editStudentBio').value.trim();
        }

        if (pendingPhotoBase64) body.profilePicture = pendingPhotoBase64;

        const res = await fetch(`${API_BASE}/api/user/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed'); }
        const { user } = await res.json();
        Object.assign(currentUser, user);
        updateNavbar(currentUser);
        updateSidebar(currentUser);
        showToast('Profile updated!', 'success');
        window.closeEditProfile();
    } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Save Changes';
    }
};

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ HELPERS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Expose to window for teacher reload buttons
window.loadTeacherSubjectContent = loadTeacherSubjectContent;
window.loadTeacherQuickClassrooms = loadTeacherQuickClassrooms;
window.loadTeacherStats = loadTeacherStats;
window.loadQuickClassrooms = loadQuickClassrooms;
window.loadStudentContent = loadStudentContent;

// Expose initPage
window.initPage = init;

// Initialize on load
init();


