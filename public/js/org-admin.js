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
/* -----------------------------------------------------------
   ORG ADMIN 2.0 � Institutional Command Center � JS
   Preserves all existing API integrations
   ----------------------------------------------------------- */

const API = window.location.origin.includes('localhost') ? 'http://localhost:3000/api' : '/api';
let orgData = null;
let facultyList = [];
let studentList = [];
let classroomList = [];
let notesList = { pending: [], approved: [] };
const loadedSections = {};

/* -- THEME TOGGLE -- */
(function applyStoredTheme() {
    const saved = localStorage.getItem('orgAdminTheme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    // Update toggle icon/label after DOM ready
    document.addEventListener('DOMContentLoaded', () => updateThemeUI(saved));
})();

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('orgAdminTheme', next);
    updateThemeUI(next);
}

function updateThemeUI(theme) {
    const icon = document.getElementById('themeToggleIcon');
    const label = document.getElementById('themeToggleLabel');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    if (label) label.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
}

/* -- AUTO-REFRESH STATE -- */
let _autoRefreshInterval = null;
let _liveIndicatorInterval = null;
let _isRefreshing = false;
let _activeSection = 'overview';
const SECTION_INTERVALS = {
    overview: 120000, notes: 120000,
    faculty: 120000, students: 120000,
    classrooms: 120000, analytics: 120000,
    attendance: 120000, announcements: 120000,
    auditlog: 120000, sandbox: 120000,
    organization: 120000, security: 120000, billing: 120000,
    results: 120000,
};
const _sectionLastRefresh = {};
Object.keys(SECTION_INTERVALS).forEach(k => _sectionLastRefresh[k] = 0);

/* -- GLOBAL FETCH WRAPPER -- */
async function apiRequest(endpoint, options = {}) {
    const headers = { ...options.headers };

    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const res = await fetch(`${API}${endpoint}`, { ...options, headers, credentials: 'include' });

        if (res.status === 401) {
            // Only auto-logout on auth/me � not every API call
            if (endpoint === '/auth/me') doLogout();
            throw new Error('Session expired. Please log in again.');
        }

        const isJson = res.headers.get('content-type')?.includes('application/json');
        const data = isJson ? await res.json() : null;

        if (!res.ok) {
            throw new Error(data?.message || `Request failed with status ${res.status}`);
        }

        return { ok: true, data };
    } catch (err) {
        console.error(`API Error (${endpoint}):`, err);
        toast(err.message || 'Network error.', 'error');
        return { ok: false, error: err };
    }
}

/* -- AUTH GUARD -- */
document.addEventListener('DOMContentLoaded', () => {

    const setupUserUI = () => {
        const userStr = localStorage.getItem('user');
        if (!userStr) return; // Wait for auth-check.js to fetch it

        try {
            const user = JSON.parse(userStr);
            if (user.role !== 'org_admin' && user.role !== 'super_admin') {
                alert('Unauthorized access.');
                window.location.href = '/classroom';
                return;
            }
            const name = user.name || 'Admin';
            setEl('navAdminName', `<i class="fas fa-user-tie"></i> ${esc(name)}`);
            setEl('sidebarAdminName', esc(name));
        } catch (e) { console.error(e); }
    };

    setupUserUI();

    // Listen for auth-check.js completing its user fetch
    window.addEventListener('auth-updated', (e) => {
        if (e.detail && e.detail.isAuthenticated) setupUserUI();
    });

    // Load overview + pre-fetch critical data in parallel for speed
    document.body.style.visibility = 'visible';
    loadOverview();
    prefetchClassrooms();

    // Bookmark toast
    if (localStorage.getItem('showAdminBookmarkAlert') === 'true') {
        localStorage.removeItem('showAdminBookmarkAlert');
        showBookmarkToast();
    }

    // Setup UI
    setupSidebar();
    setupScrollProgress();
    setupObservers();
    setupModalBackdrop();
    setupPaymentListener();

    // Date
    setEl('overviewDate', new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

    // Start auto-refresh
    startAutoRefresh();

    // Pause when tab is hidden, resume when visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            startAutoRefresh();
        }
    });

    // Clean up on page unload
    window.addEventListener('beforeunload', () => stopAutoRefresh());
});

/* -- SIDEBAR & NAVIGATION -- */
let isTransitioning = false;

function showSection(name, btn) {
    if (isTransitioning) return;
    const currentSection = document.querySelector('.page-section.active');
    const nextSection = document.getElementById('section-' + name);

    if (currentSection && currentSection === nextSection) return;

    isTransitioning = true;
    _activeSection = name; // track for auto-refresh

    if (currentSection) {
        currentSection.style.opacity = '0';
        currentSection.style.transition = 'opacity 150ms ease';
    }

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('hamBtn')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('show');

    setTimeout(() => {
        document.querySelectorAll('.page-section').forEach(s => {
            s.classList.remove('active');
            s.style.opacity = '';
        });

        if (nextSection) {
            nextSection.classList.add('active');
            // Force reflow
            void nextSection.offsetWidth;
            nextSection.classList.add('section-fade', 'active');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        // On-demand loading
        if (!loadedSections[name]) {
            loadedSections[name] = true;
            loadSection(name);
        }

        // Re-trigger scroll animations for the new section
        if (window.UIAnim && typeof window.UIAnim.initScrollAnimations === 'function') {
            setTimeout(() => window.UIAnim.initScrollAnimations(), 50);
        }

        isTransitioning = false;
    }, currentSection ? 150 : 0);
}

function loadSection(name) {
    switch (name) {
        case 'faculty': loadFaculty(); break;
        case 'students': loadStudents(); break;
        case 'classrooms': loadClassrooms(); break;
        case 'notes': loadNotes(); break;
        case 'analytics': loadAnalytics(); loadStudentPerformance(); break;
        case 'attendance': loadAttendance(); break;
        case 'billing': loadBilling(); break;
        case 'organization': loadOrgProfile(); break;
        case 'security': break; // static
        case 'announcements': loadAnnouncements(); break;
        case 'sandbox': loadDemoAccounts(); break;
        case 'auditlog': loadAuditLog(); break;
        case 'results': loadResultSystem(); break;
    }
}

function setupSidebar() {
    const ham = document.getElementById('hamBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    ham?.addEventListener('click', () => {
        ham.classList.toggle('open');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });
    overlay?.addEventListener('click', () => {
        ham.classList.remove('open');
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    });
}

function setupScrollProgress() {
    window.addEventListener('scroll', () => {
        const bar = document.getElementById('progressBar');
        const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        if (bar) bar.style.width = Math.min(pct, 100) + '%';

        const backTop = document.getElementById('backTop');
        if (backTop) backTop.classList.toggle('show', window.scrollY > 400);
    });
}

function setupObservers() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.cmd-section').forEach(s => obs.observe(s));
}

function setupModalBackdrop() {
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
    });
}

/* -- OVERVIEW LOAD -- */
async function loadOverview() {
    try {

        const orgRes = await apiRequest('/org/me');
        if (orgRes.ok) {
            orgData = orgRes.data;
            const org = orgData.organization;
            const stats = orgData.stats;


            // Title & sidebar
            document.getElementById('orgNameTitle').innerHTML = esc(org.name) + ' <span>Dashboard</span>';
            setEl('sidebarOrgName', esc(org.name));

            // Stats
            setEl('statFacultyCount', stats.facultyCount);
            setEl('statFacultyLimit', stats.facultyLimit);
            setEl('statStudentCount', stats.studentCount ?? 0);
            setEl('statClassroomCount', stats.classroomCount ?? 0);
            setEl('statPlan', (org.plan || 'FREE').toUpperCase());

            // Codes
            const orgCode = org.organizationCode || org.private_code || '�';
            const honorCode = org.honorCode || '�';
            setEl('statOrgCode', orgCode);
            setEl('statHonorCode', honorCode);

            // Logo
            if (org.logo_url) {
                document.getElementById('navLogo').src = org.logo_url;
            }

            // Plan details
            handlePlanDetails(org);
            highlightPlanCard(org.plan);

            // Gate PRO-only features (analytics + attendance)
            const effectivePlan = (stats.effectivePlan || org.plan || 'FREE').toUpperCase();
            const isPro = effectivePlan === 'PRO';
            const proBadge = '<span style="font-size:0.6rem;background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;padding:1px 6px;border-radius:4px;margin-left:4px;font-weight:700;">PRO</span>';

            // Analytics
            const analyticsNav = document.getElementById('nav-analytics');
            const analyticsSection = document.getElementById('section-analytics');
            if (analyticsNav) {
                if (!isPro) {
                    analyticsNav.style.opacity = '0.45';
                    analyticsNav.style.pointerEvents = 'none';
                    analyticsNav.innerHTML = '<i class="fas fa-chart-line"></i> 07 — Analytics ' + proBadge;
                } else {
                    analyticsNav.style.opacity = '';
                    analyticsNav.style.pointerEvents = '';
                }
            }
            if (analyticsSection && !isPro) analyticsSection.style.display = 'none';

            // Attendance
            const attNav = document.getElementById('nav-attendance');
            const attSection = document.getElementById('section-attendance');
            if (attNav) {
                if (!isPro) {
                    attNav.style.opacity = '0.45';
                    attNav.style.pointerEvents = 'none';
                    attNav.innerHTML = '<i class="fas fa-clipboard-check"></i> 08 — Attendance ' + proBadge;
                } else {
                    attNav.style.opacity = '';
                    attNav.style.pointerEvents = '';
                }
            }
            if (attSection && !isPro) attSection.style.display = 'none';


            // Populate billing + organization sections from cache
            populateBillingFromCache();
            populateOrgProfileFromCache();


            // Load notes badge + activity feed in parallel (non-blocking)
            loadNotesBadge();
            loadActivityFeed();
        }
    } catch (err) {
        console.error('Dashboard load failed:', err);
        toast('Failed to load dashboard', 'error');
    }
}

async function loadActivityFeed() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;

    try {
        const res = await apiRequest('/org/analytics');
        if (!res.ok) {
            feed.innerHTML = '<div class="info-row"><span style="color:var(--dim);">Could not load activity.</span></div>';
            return;
        }

        const trend = res.data?.activityTrend || [];
        const today = trend.length > 0 ? trend[trend.length - 1] : null;
        const totalWeek = trend.reduce((sum, d) => sum + (d.total || 0), 0);

        const rows = [];

        if (today && today.total > 0) {
            const actionIcons = {
                note_upload: { icon: 'fa-file-upload', color: 'var(--blue)', label: 'Note uploads' },
                note_approved: { icon: 'fa-check-circle', color: 'var(--green)', label: 'Notes approved' },
                join_classroom: { icon: 'fa-door-open', color: 'var(--cyan)', label: 'Classroom joins' },
                login: { icon: 'fa-sign-in-alt', color: 'var(--purple)', label: 'Logins' },
                announcement_created: { icon: 'fa-bullhorn', color: 'var(--amber)', label: 'Announcements' },
            };

            for (const [key, meta] of Object.entries(actionIcons)) {
                if (today[key] > 0) {
                    rows.push(`<div class="info-row"><span><i class="fas ${meta.icon}" style="color:${meta.color};margin-right:6px;width:14px;"></i>${meta.label}</span><span style="font-weight:600;">${today[key]} today</span></div>`);
                }
            }
        }

        if (totalWeek > 0) {
            rows.push(`<div class="info-row" style="border-top:1px solid var(--border);padding-top:0.4rem;margin-top:0.2rem;"><span><i class="fas fa-chart-line" style="color:var(--muted);margin-right:6px;width:14px;"></i>7-day total</span><span style="font-weight:600;color:var(--green);">${totalWeek} events</span></div>`);
        }

        if (rows.length === 0) {
            rows.push('<div class="info-row"><span style="color:var(--dim);font-size:0.8rem;">No recent activity recorded.</span></div>');
        }

        feed.innerHTML = rows.join('');
    } catch {
        feed.innerHTML = '<div class="info-row"><span style="color:var(--dim);">Activity feed unavailable.</span></div>';
    }
}

function handlePlanDetails(org) {
    const plan = (org.plan || 'FREE').toUpperCase();
    const expiresAt = org.planExpiresAt;
    const activatedAt = org.planActivatedAt;

    if (plan !== 'FREE' && expiresAt) {
        document.getElementById('planDetailsSection').style.display = 'block';

        const fmtOpts = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' };
        const startDate = activatedAt ? new Date(activatedAt) : null;
        const endDate = new Date(expiresAt);

        const startEl = document.getElementById('statPlanStart');
        const endEl = document.getElementById('statPlanEnd');
        if (startEl) startEl.textContent = startDate ? startDate.toLocaleDateString('en-IN', fmtOpts) : 'N/A';
        if (endEl) endEl.textContent = endDate.toLocaleDateString('en-IN', fmtOpts);

        const daysRemaining = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const daysEl = document.getElementById('statDaysRemaining');
        if (daysRemaining <= 0) {
            daysEl.textContent = 'Expired';
            daysEl.style.color = 'var(--red)';
            daysEl.style.fontSize = '1.1rem';
        } else {
            daysEl.textContent = daysRemaining;
            if (daysRemaining <= 3) daysEl.style.color = 'var(--red)';
            else if (daysRemaining <= 7) daysEl.style.color = 'var(--amber)';
        }

        // Expiry banner
        if (daysRemaining <= 1) {
            const banner = document.getElementById('planExpiryBanner');
            banner.style.display = 'block';
            if (daysRemaining <= 0) {
                banner.classList.add('expired');
                setEl('expiryBannerTitle', 'Plan Expired');
                setEl('expiryBannerMessage', 'Your PRO plan has expired. Click "Upgrade to Pro" below to renew instantly via Razorpay.');
            } else {
                setEl('expiryBannerTitle', 'Plan Expiring Tomorrow');
                setEl('expiryBannerMessage', `Your ${plan} plan expires on ${endDate.toLocaleDateString('en-IN', fmtOpts)}. Click "Upgrade to Pro" to renew via Razorpay.`);
            }
        }
    }
}

function highlightPlanCard(currentPlan) {
    const plan = (currentPlan || 'FREE').toUpperCase();
    const badge = document.getElementById('planBadge-PRO');
    const upgradeBtn = document.getElementById('upgradeProBtn');

    if (plan === 'PRO') {
        if (badge) badge.style.display = 'block';
        if (upgradeBtn) upgradeBtn.style.display = 'none';
    } else {
        if (badge) badge.style.display = 'none';
        if (upgradeBtn) upgradeBtn.style.display = 'block';
    }
}

/* -- FACULTY -- */
async function loadFaculty() {
    try {
        const res = await apiRequest('/org/faculties');
        if (res.ok) {
            facultyList = Array.isArray(res.data) ? res.data : [];
            renderFaculty(facultyList);
        }
    } catch (e) { console.error(e); }
}

function renderFaculty(list) {
    const tbody = document.getElementById('facultyTableBody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-users"></i><p>No faculty found in this organization.</p></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(f => {
        const isSuspended = f.status === 'suspended';
        return `
        <tr style="${isSuspended ? 'opacity:0.6;' : ''}">
            <td><div style="display:flex;align-items:center;gap:10px;">
                <img src="${f.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.name)}&background=10b981&color=fff`}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">
                <div>
                    <span style="font-weight:500;">${esc(f.name)}</span>
                    ${f.mustResetPassword ? `<div style="font-size:0.7rem;color:var(--amber);margin-top:2px;"><i class="fas fa-clock"></i> Pending Activation</div>` : ''}
                    ${isSuspended ? `<div style="font-size:0.7rem;color:var(--red);margin-top:2px;"><i class="fas fa-ban"></i> Suspended</div>` : ''}
                </div>
            </div></td>
            <td style="color:var(--muted);">${esc(f.email)}</td>
            <td><span class="pill pill-faculty">Faculty</span></td>
            <td style="color:var(--dim);">${new Date(f.createdAt).toLocaleDateString()}</td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${isSuspended
                ? `<button class="btn btn-success btn-sm" onclick="reactivateOrgUser('${f._id}','${esc(f.name).replace(/'/g, "\\'")}')"><i class="fas fa-check"></i> Reactivate</button>`
                : `${f.mustResetPassword
                    ? `<button class="btn btn-primary btn-sm" onclick="resendFacultyInvite('${esc(f.email)}','${esc(f.name).replace(/'/g, "\\'")}')"><i class="fas fa-envelope"></i> Resend Invite</button>`
                    : `<button class="btn btn-danger btn-sm" onclick="resetFacultyPassword('${f._id}','${esc(f.email)}')"><i class="fas fa-key"></i> Reset</button>`
                }
                        <button class="btn btn-sm" style="background:rgba(245,158,11,0.1);color:var(--amber);border:1px solid rgba(245,158,11,0.3);" onclick="suspendOrgUser('${f._id}')"><i class="fas fa-pause"></i> Suspend</button>`
            }
                    <button class="btn btn-amber btn-sm" onclick="removeFaculty('${f._id}','${esc(f.name).replace(/'/g, "\\'")}')"><i class="fas fa-user-minus"></i> Remove</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function filterFaculty() {
    const q = document.getElementById('facultySearch')?.value.toLowerCase() || '';
    const filtered = facultyList.filter(f => f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q));
    renderFaculty(filtered);
}

async function resetFacultyPassword(facultyId, email) {
    if (!confirm(`Send a password reset email to ${email}?`)) return;
    const res = await apiRequest('/org/reset-faculty-password', {
        method: 'POST',
        body: JSON.stringify({ facultyId })
    });
    if (res.ok) toast(`? Reset email sent to ${email}`, 'success');
}

async function removeFaculty(facultyId, facultyName) {
    if (!confirm(`Remove ${facultyName} from your organization? This cannot be undone.`)) return;
    const res = await apiRequest(`/org/remove-faculty/${facultyId}`, { method: 'DELETE' });
    if (res.ok) {
        toast(`${facultyName} removed.`, 'success');
        loadFaculty();
        loadOverview();
    }
}

async function resendFacultyInvite(email, name) {
    if (!confirm(`Resend activation invite to ${email}? A new link will be generated and sent.`)) return;
    const res = await apiRequest('/org/add-faculty', {
        method: 'POST',
        body: JSON.stringify({ email, name })
    });
    if (res.ok) {
        toast(`? Invitation re-sent to ${email}`, 'success');
    }
}

// -- Org Admin: Suspend / Reactivate User --
let suspendOrgTargetId = null;

function suspendOrgUser(userId) {
    suspendOrgTargetId = userId;
    document.getElementById('suspendReasonInput').value = '';
    document.getElementById('suspendUserModal').classList.add('active');
}

async function confirmSuspendUser() {
    if (!suspendOrgTargetId) return;
    const reason = document.getElementById('suspendReasonInput').value.trim();
    if (!reason) { toast('Please enter a reason for suspension', 'error'); return; }
    const btn = document.getElementById('suspendUserConfirmBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Suspending...';
    try {
        const res = await apiRequest(`/admin/suspend-user/${suspendOrgTargetId}`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        if (res.ok) {
            toast('? User suspended. Email notification sent.', 'success');
            document.getElementById('suspendUserModal').classList.remove('active');
            loadFaculty(); loadStudents(); loadOverview();
        } else { toast(res.error?.message || 'Suspension failed', 'error'); }
    } catch (err) { toast('Connection error', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span><i class="fas fa-pause-circle"></i> Suspend User</span>'; suspendOrgTargetId = null; }
}

async function reactivateOrgUser(userId, userName) {
    if (!confirm(`Reactivate ${userName}? They will regain access.`)) return;
    try {
        const res = await apiRequest(`/admin/reactivate-user/${userId}`, { method: 'POST' });
        if (res.ok) {
            toast(`? ${userName} reactivated`, 'success');
            loadFaculty(); loadStudents(); loadOverview();
        } else { toast(res.error?.message || 'Reactivation failed', 'error'); }
    } catch (err) { toast('Connection error', 'error'); }
}

function exportFacultyCSV() {
    if (!facultyList.length) { toast('No faculty to export.', 'error'); return; }
    const csv = 'Name,Email,Role,Joined\n' + facultyList.map(f =>
        `"${f.name}","${f.email}","Faculty","${new Date(f.createdAt).toLocaleDateString()}"`
    ).join('\n');
    downloadCSV(csv, 'faculty-export.csv');
}

/* -- STUDENTS -- */
async function loadStudents() {
    try {
        const res = await apiRequest('/org/students');
        if (res.ok) {
            studentList = Array.isArray(res.data) ? res.data : (res.data?.students || []);
            // Populate classroom filter dropdown
            const sel = document.getElementById('studentClassroomFilter');
            if (sel) {
                const classrooms = [...new Set(studentList.map(s => s.classroomName || s.classroom || '').filter(Boolean))].sort();
                sel.innerHTML = `<option value="all">All Classrooms (${studentList.length})</option>`;
                classrooms.forEach(c => {
                    const count = studentList.filter(s => (s.classroomName || s.classroom || '') === c).length;
                    sel.innerHTML += `<option value="${c}">${c} (${count} students)</option>`;
                });
            }
            renderStudents(studentList);
            updateStudentCount(studentList.length, studentList.length);
        } else {
            renderStudents([]);
        }
    } catch {
        renderStudents([]);
    }
}

function renderStudents(list) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-user-graduate"></i><p>No students found. Students will appear here once they join your organization.</p></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(s => {
        const isSuspended = s.status === 'suspended';
        return `
        <tr style="${isSuspended ? 'opacity:0.6;' : ''}">
            <td style="font-weight:500;">${esc(s.name || 'Unknown')}</td>
            <td style="color:var(--muted);">${esc(s.email || '�')}</td>
            <td>${esc(s.classroomName || s.classroom || '�')}</td>
            <td style="color:var(--dim);">${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '�'}</td>
            <td><span class="pill ${isSuspended ? '' : 'pill-active'}">${isSuspended ? 'Suspended' : (s.status || 'Active')}</span></td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${isSuspended
                ? `<button class="btn btn-success btn-sm" onclick="reactivateOrgUser('${s._id}','${esc(s.name || 'Student').replace(/'/g, "\\'")}')"><i class="fas fa-check"></i> Reactivate</button>`
                : `<button class="btn btn-sm" style="background:rgba(245,158,11,0.1);color:var(--amber);border:1px solid rgba(245,158,11,0.3);" onclick="suspendOrgUser('${s._id}')"><i class="fas fa-pause"></i> Suspend</button>`
            }
                    <button class="btn btn-amber btn-sm" onclick="removeStudent('${s._id}','${esc(s.name || 'Student').replace(/'/g, "\\'")}')"><i class="fas fa-user-minus"></i> Remove</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function filterStudents() {
    const q = document.getElementById('studentSearch')?.value.toLowerCase() || '';
    const classroomFilter = document.getElementById('studentClassroomFilter')?.value || 'all';
    let filtered = studentList;
    if (classroomFilter !== 'all') {
        filtered = filtered.filter(s => (s.classroomName || s.classroom || '') === classroomFilter);
    }
    if (q) {
        filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
    }
    renderStudents(filtered);
    updateStudentCount(filtered.length, studentList.length);
}

function updateStudentCount(shown, total) {
    const badge = document.getElementById('studentCountBadge');
    if (badge) badge.textContent = shown === total ? `${total} students` : `${shown} of ${total} students`;
}

function exportStudentCSV() {
    if (!studentList.length) { toast('No students to export.', 'error'); return; }
    const csv = 'Name,Email,Classroom,Joined,Status\n' + studentList.map(s =>
        `"${s.name || ''}","${s.email || ''}","${s.classroomName || s.classroom || ''}","${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''}","${s.status || 'Active'}"`
    ).join('\n');
    downloadCSV(csv, 'students-export.csv');
}

async function removeStudent(studentId, studentName) {
    if (!confirm(`Remove ${studentName} from your organization? They will lose access to all classrooms.`)) return;
    const res = await apiRequest(`/org/remove-student/${studentId}`, { method: 'DELETE' });
    if (res.ok) {
        toast(`${studentName} removed from organization.`, 'success');
        loadStudents();
        loadOverview();
    }
}

/* -- CLASSROOMS -- */
let _classroomsFetched = false;
async function prefetchClassrooms() {
    if (_classroomsFetched) return;
    try {
        const res = await apiRequest('/org/classrooms');
        if (res.ok) {
            classroomList = Array.isArray(res.data) ? res.data : (res.data?.classrooms || []);
        }
    } catch { /* silent */ }
    _classroomsFetched = true;
}

async function loadClassrooms() {
    if (!_classroomsFetched) await prefetchClassrooms();
    renderClassrooms(classroomList);
}

function renderClassrooms(list) {
    const tbody = document.getElementById('classroomsTableBody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-door-open"></i><p>No classrooms found. Classrooms will appear here when faculty create them.</p></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(c => {
        const isArchived = c.settings?.isArchived;
        return `
        <tr style="${isArchived ? 'opacity:0.55;' : ''}">
            <td style="font-weight:500;">${esc(c.name || c.className || 'Untitled')}</td>
            <td style="color:var(--muted);">${esc(c.facultyName || c.createdBy || '�')}</td>
            <td>${c.studentCount || c.students?.length || 0}</td>
            <td style="color:var(--dim);">${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '�'}</td>
            <td><span class="pill ${isArchived ? '' : 'pill-active'}">${isArchived ? 'Archived' : 'Active'}</span></td>
            <td>
                <button class="btn btn-sm ${isArchived ? 'btn-primary' : 'btn-ghost'}" onclick="archiveClassroom('${c._id}', ${isArchived})" title="${isArchived ? 'Un-archive' : 'Archive'}">
                    <i class="fas ${isArchived ? 'fa-box-open' : 'fa-archive'}"></i> ${isArchived ? 'Restore' : 'Archive'}
                </button>
            </td>
        </tr>`;
    }).join('');
}

/* -- NOTES -- */
async function loadNotes() {
    try {
        const res = await apiRequest('/org/notes/pending');
        const notes = res.ok ? (Array.isArray(res.data) ? res.data : (res.data?.notes || [])) : [];

        notesList.pending = notes.filter(n => n.status === 'pending');
        notesList.approved = notes.filter(n => n.status === 'approved');

        setEl('pendingNotesCount', notesList.pending.length);
        setEl('approvedNotesCount', notesList.approved.length);

        renderPendingNotes(notesList.pending);
        renderApprovedNotes(notesList.approved);
    } catch (e) {
        console.error('Error loading notes:', e);
        renderPendingNotes([]);
        renderApprovedNotes([]);
    }
}

async function loadNotesBadge() {
    try {
        const res = await apiRequest('/org/notes/pending');
        if (res.ok) {
            const notes = Array.isArray(res.data) ? res.data : (res.data?.notes || []);
            const pending = notes.filter(n => n.status === 'pending');
            const badge = document.getElementById('notesBadge');
            if (badge) {
                badge.textContent = pending.length;
                badge.style.display = pending.length > 0 ? 'inline-block' : 'none';
            }
        }
    } catch { }
}

function renderPendingNotes(notes) {
    const tbody = document.getElementById('pendingNotesTableBody');
    if (!tbody) return;

    if (!notes || notes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-check-circle"></i><p>No notes pending review. All caught up!</p></td></tr>`;
        return;
    }

    tbody.innerHTML = notes.map(n => `
        <tr id="note-row-${n.id}">
            <td>
                <div style="font-weight:600;">${esc(n.title)}</div>
                ${n.description ? `<div style="font-size:0.73rem;color:var(--dim);margin-top:2px;">${esc(n.description.substring(0, 80))}${n.description.length > 80 ? '...' : ''}</div>` : ''}
            </td>
            <td style="color:var(--muted);">${esc(n.uploaded_by || 'Unknown')}</td>
            <td>${n.file_url ? `<a href="${n.file_url}" target="_blank" class="btn btn-ghost btn-sm"><i class="fas fa-external-link-alt"></i> View</a>` : '<span style="color:var(--dim);">No File</span>'}</td>
            <td style="color:var(--dim);">${new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-success btn-sm" onclick="approveNote('${n.id}')"><i class="fas fa-check"></i> Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectNote('${n.id}')"><i class="fas fa-times"></i> Reject</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderApprovedNotes(notes) {
    const tbody = document.getElementById('approvedNotesTableBody');
    if (!tbody) return;

    if (!notes || notes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-folder-open"></i><p>No approved notes yet.</p></td></tr>`;
        return;
    }

    tbody.innerHTML = notes.map(n => `
        <tr>
            <td>
                <div style="font-weight:600;">${esc(n.title)}</div>
                ${n.description ? `<div style="font-size:0.73rem;color:var(--dim);margin-top:2px;">${esc(n.description.substring(0, 80))}${n.description.length > 80 ? '...' : ''}</div>` : ''}
            </td>
            <td style="color:var(--muted);">${esc(n.uploaded_by || 'Unknown')}</td>
            <td>${n.file_url ? `<a href="${n.file_url}" target="_blank" class="btn btn-ghost btn-sm"><i class="fas fa-external-link-alt"></i> View</a>` : '<span style="color:var(--dim);">No File</span>'}</td>
            <td style="color:var(--dim);">${new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td><span class="pill pill-active">Published</span></td>
        </tr>
    `).join('');
}

async function approveNote(id) {
    if (!confirm('Approve this note? It will become visible to all members.')) return;
    const res = await apiRequest(`/org/notes/${id}/approve`, { method: 'POST' });
    if (res.ok) { toast('? Note approved!', 'success'); loadNotes(); loadNotesBadge(); }
}

async function rejectNote(id) {
    if (!confirm('Reject this note? It will be removed.')) return;
    const res = await apiRequest(`/org/notes/${id}/reject`, { method: 'POST' });
    if (res.ok) { toast('Note rejected.', 'success'); loadNotes(); loadNotesBadge(); }
}

/* -- ANALYTICS -- */
async function loadAnalytics() {
    try {
        const res = await apiRequest('/org/analytics');
        if (!res.ok) return;
        const data = res.data;

        // -- ROW 1: KPI Cards --
        const kpis = data.kpis || {};
        setEl('kpiStudents', kpis.students?.total ?? 0);
        setEl('kpiFaculty', kpis.faculty?.total ?? 0);
        setEl('kpiActiveClassrooms', kpis.activeClassrooms?.total ?? 0);
        setEl('kpiWau', kpis.wau?.total ?? 0);

        // Weekly growth badges
        const weekBadge = (count) => {
            if (count > 0) return `<span style="color:var(--green);font-weight:600;">+${count} this week ?</span>`;
            return `<span style="color:var(--dim);">No change this week</span>`;
        };
        setEl('kpiStudentsWeek', weekBadge(kpis.students?.thisWeek || 0));
        setEl('kpiFacultyWeek', weekBadge(kpis.faculty?.thisWeek || 0));
        setEl('kpiActiveClassroomsSub', `${kpis.activeClassrooms?.total ?? 0} of ${kpis.activeClassrooms?.outOf ?? 0} classrooms active`);
        setEl('kpiWauSub', kpis.wau?.outOf > 0 ? `${Math.round((kpis.wau.total / kpis.wau.outOf) * 100)}% of users active` : 'No users yet');

        // -- ROW 2: Activity Trend Chart --
        const trend = data.activityTrend || [];
        const chartEl = document.getElementById('activityTrendChart');
        if (chartEl && trend.length > 0) {
            const totalEvents = trend.reduce((sum, d) => sum + (d.total || 0), 0);
            const maxTotal = Math.max(...trend.map(t => t.total || 0), 1);
            const bars = trend.map(d => {
                const pct = Math.round(((d.total || 0) / maxTotal) * 100);
                const dt = new Date(d.date + 'T00:00:00+05:30');
                const label = dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
                return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;">
                    <span style="min-width:55px;font-size:0.72rem;color:var(--dim);">${label}</span>
                    <div style="flex:1;background:var(--elevated);border-radius: 4px;height:20px;overflow:hidden;">
                        <div style="height:100%;background:linear-gradient(90deg,var(--blue),var(--cyan));border-radius: 4px;width:${pct}%;min-width:${d.total > 0 ? '4px' : '0'};transition:width 0.5s ease;"></div>
                    </div>
                    <span style="min-width:28px;text-align:right;font-size:0.75rem;font-weight:600;color:var(--muted);">${d.total}</span>
                </div>`;
            }).join('');
            chartEl.innerHTML = `<div style="font-size:0.85rem;font-weight:600;margin-bottom:8px;color:var(--muted);"><i class="fas fa-chart-bar" style="margin-right:6px;color:var(--blue);"></i>${totalEvents} events in last 7 days</div>${bars}`;
        } else if (chartEl) {
            chartEl.innerHTML = '<div style="text-align:center;color:var(--dim);padding:2rem;font-size:0.85rem;"><i class="fas fa-chart-bar" style="margin-right:6px;"></i>No activity recorded</div>';
        }

        // Content Stats
        const cs = data.contentStats || {};
        setEl('analyticsPendingNotes', cs.pendingNotes ?? 0);
        setEl('analyticsApprovedNotes', cs.approvedNotes ?? 0);
        setEl('analyticsTotalNotes', cs.totalNotes ?? 0);
        setEl('analyticsAvgNotes', data.engagement?.avgNotesPerStudent ?? 0);

        // -- ROW 3: Engagement --
        const eng = data.engagement || {};
        const score = eng.score ?? 0;
        setEl('engagementScore', `${score}%`);
        const engBar = document.getElementById('engagementBar');
        if (engBar) {
            setTimeout(() => { engBar.style.width = score + '%'; }, 100);
            engBar.style.background = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--red)';
        }
        const engLabel = score >= 70 ? 'Healthy engagement' : score >= 40 ? 'Moderate engagement' : 'Low engagement - take action';
        setEl('engagementLabel', engLabel);

        // Insights
        const ins = data.insights || {};
        setEl('insightActiveDay', ins.mostActiveDay?.day || 'N/A');
        setEl('insightActiveDaySub', ins.mostActiveDay?.count > 0 ? `${ins.mostActiveDay.count} events` : 'No activity yet');
        setEl('insightTopClassroom', ins.mostActiveClassroom?.name || 'N/A');
        setEl('insightTopClassroomSub', ins.mostActiveClassroom?.count > 0 ? `${ins.mostActiveClassroom.count} events this week` : 'No activity yet');

        // -- ROW 4: Plan Utilization --
        const pu = data.planUtilization || {};
        setEl('planFacultyUsed', pu.faculty?.used ?? 0);
        setEl('planFacultyLimit', pu.faculty?.limit ?? '�');
        setEl('planClassroomsUsed', pu.classrooms?.used ?? 0);
        setEl('planClassroomsLimit', pu.classrooms?.limit ?? '�');
        setEl('planStudentsLimit', pu.studentsPerClassroom?.limit ?? '�');
        setEl('planLabel', `${pu.plan || 'FREE'} Plan`);

        // Animated progress bars
        setTimeout(() => {
            const fBar = document.getElementById('planFacultyBar');
            const cBar = document.getElementById('planClassroomsBar');
            if (fBar && pu.faculty?.limit > 0) fBar.style.width = Math.min(100, Math.round((pu.faculty.used / pu.faculty.limit) * 100)) + '%';
            if (cBar && pu.classrooms?.limit > 0) cBar.style.width = Math.min(100, Math.round((pu.classrooms.used / pu.classrooms.limit) * 100)) + '%';
        }, 200);

        // -- ROW 5: Smart Alerts --
        const alerts = data.alerts || [];
        const alertsSection = document.getElementById('alertsSection');
        const alertsContainer = document.getElementById('analyticsAlerts');
        if (alertsSection && alertsContainer) {
            if (alerts.length > 0) {
                alertsSection.style.display = 'block';
                alertsContainer.innerHTML = alerts.map(a => `
                    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--card);border:1px solid var(--border);border-radius: 4px;border-left:3px solid ${a.color};">
                        <i class="fas ${a.icon}" style="color:${a.color};font-size:1rem;"></i>
                        <span style="font-size:0.85rem;color:var(--muted);">${esc(a.message)}</span>
                    </div>
                `).join('');
            } else {
                alertsSection.style.display = 'none';
            }
        }

    } catch (e) {
        console.error('Analytics load error:', e);
    }
}

/* -- ATTENDANCE -- */
let attendanceFilterPopulated = false;
async function loadAttendance() {
    try {
        const filter = document.getElementById('attendanceClassroomFilter')?.value || 'all';
        const endpoint = filter && filter !== 'all' ? `/org/attendance-analytics?classroom=${filter}` : '/org/attendance-analytics';
        const res = await apiRequest(endpoint);
        if (!res.ok) return;
        const data = res.data;

        // Populate classroom filter (only once)
        if (!attendanceFilterPopulated && data.classrooms?.length > 0) {
            const sel = document.getElementById('attendanceClassroomFilter');
            if (sel) {
                const current = sel.value;
                sel.innerHTML = '<option value="all">All Classrooms</option>';
                data.classrooms.forEach(c => {
                    sel.innerHTML += `<option value="${c._id}" ${c._id === current ? 'selected' : ''}>${esc(c.name)}</option>`;
                });
                attendanceFilterPopulated = true;
            }
        }

        // KPIs
        const ov = data.overall || {};
        setEl('attTotalSessions', ov.totalSessions ?? 0);
        setEl('attOverallRate', `${ov.attendanceRate ?? 0}%`);
        setEl('attTotalPresent', ov.totalPresent ?? 0);
        setEl('attExpectedSub', `of ${ov.totalExpected ?? 0} expected`);

        // Attendance rate bar
        const attBar = document.getElementById('attOverallBar');
        if (attBar) {
            const rate = ov.attendanceRate ?? 0;
            setTimeout(() => { attBar.style.width = rate + '%'; }, 100);
            attBar.style.background = rate >= 75 ? 'var(--green)' : rate >= 50 ? 'var(--amber)' : 'var(--red)';
        }

        // Daily chart
        const chart = data.dailyChart || [];
        const chartEl = document.getElementById('attDailyChart');
        if (chartEl && chart.length > 0) {
            const maxPresent = Math.max(...chart.map(d => d.present || 0), 1);
            const bars = chart.map(d => {
                const dt = new Date(d.date + 'T00:00:00+05:30');
                const label = dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
                const pct = Math.round(((d.present || 0) / maxPresent) * 100);
                return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
                    <span style="min-width:58px;font-size:0.72rem;color:var(--dim);">${label}</span>
                    <div style="flex:1;display:flex;gap:4px;align-items:center;">
                        <div style="flex:1;background:var(--elevated);border-radius: 4px;height:20px;overflow:hidden;">
                            <div style="height:100%;background:linear-gradient(90deg,var(--green),var(--cyan));border-radius: 4px;width:${pct}%;min-width:${d.present > 0 ? '4px' : '0'};transition:width 0.5s ease;"></div>
                        </div>
                    </div>
                    <span style="min-width:60px;text-align:right;font-size:0.72rem;color:var(--muted);font-weight:600;">${d.present} present</span>
                    <span style="min-width:50px;text-align:right;font-size:0.68rem;color:var(--dim);">${d.sessions} lec</span>
                </div>`;
            }).join('');
            const totalP = chart.reduce((s, d) => s + (d.present || 0), 0);
            const totalS = chart.reduce((s, d) => s + (d.sessions || 0), 0);
            chartEl.innerHTML = `<div style="font-size:0.85rem;font-weight:600;margin-bottom:8px;color:var(--muted);"><i class="fas fa-clipboard-check" style="margin-right:6px;color:var(--green);"></i>${totalP} present across ${totalS} sessions this week</div>${bars}`;
        } else if (chartEl) {
            chartEl.innerHTML = '<div style="text-align:center;color:var(--dim);padding:2rem;font-size:0.85rem;"><i class="fas fa-clipboard-check" style="margin-right:6px;"></i>No attendance sessions this week</div>';
        }

        // Per-classroom table
        const tbody = document.getElementById('attClassroomBody');
        if (tbody) {
            const stats = data.classroomStats || [];
            if (stats.length > 0) {
                tbody.innerHTML = stats.map(c => {
                    const rateColor = c.attendanceRate >= 75 ? 'var(--green)' : c.attendanceRate >= 50 ? 'var(--amber)' : 'var(--red)';
                    return `<tr>
                        <td style="font-weight:600;">${esc(c.name)}</td>
                        <td>${c.totalSessions}</td>
                        <td>${c.memberCount}</td>
                        <td>${c.totalPresent}</td>
                        <td>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <div style="width:50px;height:5px;background:var(--border);border-radius: 4px;overflow:hidden;">
                                    <div style="height:100%;width:${c.attendanceRate}%;background:${rateColor};border-radius: 4px;"></div>
                                </div>
                                <span style="font-weight:700;color:${rateColor};font-size:0.85rem;">${c.attendanceRate}%</span>
                            </div>
                        </td>
                    </tr>`;
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--dim);padding:1.5rem;">No classrooms found</td></tr>';
            }
        }

        // Low attendance alerts
        const alerts = data.lowAttendanceAlerts || [];
        const alertsSection = document.getElementById('attAlertsSection');
        const alertsContainer = document.getElementById('attAlerts');
        if (alertsSection && alertsContainer) {
            if (alerts.length > 0) {
                alertsSection.style.display = 'block';
                alertsContainer.innerHTML = alerts.map(a => `
                    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--card);border:1px solid var(--border);border-radius: 4px;border-left:3px solid var(--red);">
                        <i class="fas fa-exclamation-triangle" style="color:var(--red);font-size:1rem;"></i>
                        <span style="font-size:0.85rem;color:var(--muted);"><strong>${esc(a.name)}</strong> has ${a.attendanceRate}% attendance (${a.totalSessions} sessions, ${a.totalPresent} present)</span>
                    </div>
                `).join('');
            } else {
                alertsSection.style.display = 'none';
            }
        }
    } catch (e) {
        console.error('Attendance load error:', e);
    }
}

/* -- ANNOUNCEMENTS -- */
let announcementsList = [];

async function loadAnnouncements() {
    try {
        const res = await apiRequest('/org/announcements');
        if (res.ok) {
            announcementsList = res.data?.announcements || [];
            renderAnnouncements(announcementsList);
        } else {
            renderAnnouncements([]);
        }
    } catch {
        renderAnnouncements([]);
    }
}

function renderAnnouncements(list) {
    const tbody = document.getElementById('announcementsTableBody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-bullhorn"></i><p>No announcements yet. Create your first announcement above.</p></td></tr>`;
        return;
    }

    const attIcon = (a) => {
        if (!a.attachment_url) return '';
        const icons = { pdf: 'fa-file-pdf', image: 'fa-file-image', ppt: 'fa-file-powerpoint' };
        const colors = { pdf: '#ef4444', image: '#3b82f6', ppt: '#f97316' };
        const ic = icons[a.attachment_type] || 'fa-paperclip';
        const co = colors[a.attachment_type] || 'var(--dim)';
        return `<a href="${a.attachment_url}" target="_blank" title="${esc(a.attachment_name || 'Attachment')}" style="display:inline-flex;align-items:center;gap:4px;font-size:0.72rem;color:${co};text-decoration:none;margin-top:3px;"><i class="fas ${ic}"></i>${esc((a.attachment_name || 'File').substring(0, 25))}</a>`;
    };

    tbody.innerHTML = list.map(a => `
        <tr>
            <td><div style="font-weight:600;">${esc(a.title)}</div><div style="font-size:0.72rem;color:var(--dim);margin-top:2px;">${esc((a.content || '').replace(/<[^>]*>/g, '').substring(0, 80))}${(a.content || '').length > 80 ? '...' : ''}</div>${attIcon(a)}</td>
            <td style="color:var(--muted);">${esc(a.created_by?.name || a.creator_name || 'Admin')}</td>
            <td style="color:var(--dim);">${(a.created_at || a.createdAt) ? new Date(a.created_at || a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
            <td>${a.target_type === 'all' ? '<span class="pill" style="background:var(--purple);color:#fff;">All</span>' : `<span class="pill" style="background:var(--blue);color:#fff;">${(a.target_classrooms || []).length} classrooms</span>`}</td>
            <td><span class="pill ${a.status === 'published' ? 'pill-active' : ''}">${(a.status || 'published').charAt(0).toUpperCase() + (a.status || 'published').slice(1)}</span></td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-ghost btn-sm" onclick="openEditAnnouncementModal('${a._id || a.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement('${a._id || a.id}','${esc(a.title).replace(/'/g, "\\\'")}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function openCreateAnnouncementModal() {
    document.getElementById('announcementModal')?.classList.add('active');
    const container = document.getElementById('announcementClassroomsList');
    // If classrooms not yet loaded, fetch them instantly
    if (classroomList.length === 0 && !_classroomsFetched) {
        if (container) container.innerHTML = '<p style="color:var(--dim);font-size:0.82rem;"><i class="fas fa-spinner fa-spin"></i> Loading classrooms...</p>';
        await prefetchClassrooms();
    }
    // Populate classroom checkboxes from cached list
    if (container && classroomList.length > 0) {
        container.innerHTML = classroomList.map(c => `
            <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:var(--muted);cursor:pointer;">
                <input type="checkbox" name="target_classroom" value="${c._id}" style="accent-color:var(--blue);">
                ${esc(c.name || c.className || 'Untitled')}
            </label>
        `).join('');
    } else if (container) {
        container.innerHTML = '<p style="color:var(--dim);font-size:0.82rem;">No classrooms found in your organization.</p>';
    }
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal')?.classList.remove('active');
    document.getElementById('announcementForm')?.reset();
    const preview = document.getElementById('annAttachmentPreview');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    const fileInput = document.getElementById('annAttachmentFile');
    if (fileInput) fileInput.value = '';
}

function previewAnnAttachment(input) {
    const preview = document.getElementById('annAttachmentPreview');
    if (!preview) return;
    const file = input.files[0];
    if (!file) { preview.style.display = 'none'; preview.innerHTML = ''; return; }
    if (file.size > 5 * 1024 * 1024) {
        toast('File exceeds 5 MB limit.', 'error');
        input.value = '';
        preview.style.display = 'none';
        return;
    }
    const icons = { 'application/pdf': 'fa-file-pdf', 'image/': 'fa-file-image', 'application/vnd': 'fa-file-powerpoint' };
    let icon = 'fa-paperclip';
    for (const [k, v] of Object.entries(icons)) { if (file.type.startsWith(k)) { icon = v; break; } }
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    preview.style.display = 'flex';
    preview.innerHTML = `<i class="fas ${icon}" style="font-size:1.1rem;"></i> <span>${esc(file.name)}</span> <span style="color:var(--dim);">(${sizeMB} MB)</span> <button type="button" onclick="removeAnnAttachment()" style="margin-left:auto;background:none;border:none;color:var(--red);cursor:pointer;font-size:0.85rem;"><i class="fas fa-times"></i></button>`;
}

function removeAnnAttachment() {
    const input = document.getElementById('annAttachmentFile');
    const preview = document.getElementById('annAttachmentPreview');
    if (input) input.value = '';
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function submitAnnouncement(e) {
    if (e) e.preventDefault();
    const title = document.getElementById('annTitle')?.value.trim();
    const content = document.getElementById('annContent')?.value.trim();
    const targetType = document.querySelector('input[name="annTargetType"]:checked')?.value || 'specific';

    if (!title || !content) { toast('Title and content are required.', 'error'); return; }

    const targetClassrooms = [];
    if (targetType === 'specific') {
        document.querySelectorAll('input[name="target_classroom"]:checked').forEach(cb => targetClassrooms.push(cb.value));
        if (targetClassrooms.length === 0) { toast('Select at least one classroom.', 'error'); return; }
    }

    const btn = document.getElementById('submitAnnouncementBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...'; }

    const payload = {
        title,
        content,
        type: 'announcement',
        target_type: targetType,
        status: 'published',
    };
    if (targetType === 'specific') payload.target_classrooms = targetClassrooms;

    // Read attachment file as base64 if selected
    const attFile = document.getElementById('annAttachmentFile')?.files[0];
    if (attFile) {
        try {
            payload.attachment_base64 = await readFileAsBase64(attFile);
            payload.attachment_name = attFile.name;
        } catch {
            toast('Failed to read attachment file.', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<span>Publish Announcement</span><i class="fas fa-paper-plane"></i>'; }
            return;
        }
    }

    const res = await apiRequest('/org/announcements', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    if (btn) { btn.disabled = false; btn.innerHTML = '<span>Publish Announcement</span><i class="fas fa-paper-plane"></i>'; }

    if (res.ok) {
        toast('Announcement created!', 'success');
        closeAnnouncementModal();
        loadAnnouncements();
    }
}


async function deleteAnnouncement(id, title) {
    if (!confirm(`Delete announcement "${title}"? This cannot be undone.`)) return;
    const res = await apiRequest(`/org/announcements/${id}`, { method: 'DELETE' });
    if (res.ok) {
        toast('Announcement deleted.', 'success');
        loadAnnouncements();
    }
}

/* -- BILLING (from cache) -- */
function loadBilling() { populateBillingFromCache(); }

function populateBillingFromCache() {
    if (!orgData) return;
    const org = orgData.organization;
    const plan = (org.plan || 'FREE').toUpperCase();
    setEl('billingPlan', plan);

    const fmtOpts = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' };
    if (plan !== 'FREE' && org.planExpiresAt) {
        const start = org.planActivatedAt ? new Date(org.planActivatedAt) : null;
        const end = new Date(org.planExpiresAt);
        setEl('billingStart', start ? start.toLocaleDateString('en-IN', fmtOpts) : 'N/A');
        setEl('billingEnd', end.toLocaleDateString('en-IN', fmtOpts));
        const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const el = document.getElementById('billingDays');
        if (el) {
            el.textContent = days <= 0 ? 'Expired' : days;
            if (days <= 0) el.style.color = 'var(--red)';
            else if (days <= 3) el.style.color = 'var(--red)';
            else if (days <= 7) el.style.color = 'var(--amber)';
        }
    } else {
        setEl('billingStart', 'N/A');
        setEl('billingEnd', 'N/A');
        setEl('billingDays', '8');
    }
}

/* -- ORGANIZATION PROFILE (from cache) -- */
function loadOrgProfile() { populateOrgProfileFromCache(); }

function populateOrgProfileFromCache() {
    if (!orgData) return;
    const org = orgData.organization;

    // Institution logo & name
    const logoEl = document.getElementById('orgProfileLogo');
    if (logoEl && org.logo_url) logoEl.src = org.logo_url;
    setEl('orgProfileOrgName', esc(org.name || ''));

    setEl('orgProfileAddress', org.address || 'N/A');
    setEl('orgProfilePhone', org.contactNumber || 'N/A');

    const websiteEl = document.getElementById('orgProfileWebsite');
    if (websiteEl) {
        websiteEl.innerHTML = org.website ? `<a href="${org.website}" target="_blank" style="color:var(--blue);text-decoration:none;">${esc(org.website)}</a>` : 'N/A';
    }

    setEl('orgProfileAdminName', org.ownerName || 'N/A');
    setEl('orgProfileDesignation', org.designation || 'N/A');
    setEl('orgProfileEmail', org.ownerEmail || 'N/A');
}

/* -- LOGO UPLOAD -- */
async function uploadOrgLogo(input) {
    const file = input.files[0];
    if (!file) return;

    const statusEl = document.getElementById('logoUploadStatus');
    const logoEl = document.getElementById('orgProfileLogo');
    const navLogo = document.getElementById('navLogo');

    // Show loading
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--dim)';
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    // Read as base64
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result;

        const res = await apiRequest('/org/logo', {
            method: 'PUT',
            body: JSON.stringify({ logo_base64: base64 })
        });

        if (res.ok) {
            const url = res.data.logo_url;
            // Update logo everywhere on the page
            if (logoEl) logoEl.src = url;
            if (navLogo) navLogo.src = url;
            // Update in cached orgData too so it persists in-session
            if (orgData && orgData.organization) orgData.organization.logo_url = url;
            statusEl.style.color = 'var(--green)';
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Logo updated!';
            setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
        } else {
            statusEl.style.color = 'var(--red)';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Upload failed. Try again.';
        }

        // Reset input so the same file can be selected again
        input.value = '';
    };

    reader.onerror = () => {
        statusEl.style.color = 'var(--red)';
        statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Failed to read file.';
    };

    reader.readAsDataURL(file);
}

/* -- ADD FACULTY MODAL -- */
function openAddModal() { document.getElementById('addFacultyModal')?.classList.add('active'); }
function closeAddModal() {
    document.getElementById('addFacultyModal')?.classList.remove('active');
    document.getElementById('addFacultyForm')?.reset();
}

document.getElementById('addFacultyForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('addFacultyBtn');
    const spinner = document.getElementById('addFacultySpinner');
    const name = document.getElementById('facultyNameInput').value;
    const email = document.getElementById('facultyEmailInput').value;

    btn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';

    const res = await apiRequest('/org/add-faculty', {
        method: 'POST',
        body: JSON.stringify({ name, email })
    });

    btn.disabled = false;
    if (spinner) spinner.style.display = 'none';

    if (res.ok) {
        toast('Faculty added! They should check their email.', 'success');
        closeAddModal();
        loadFaculty();
        loadOverview(); // refresh stats
    } else {
        toast('Failed: ' + (res.data?.message || 'Unknown error.'), 'error');
    }
});

/* -- PAYMENT MODAL (Razorpay Checkout SDK) -- */
function setupPaymentListener() {
    // Payment now handled via Razorpay Checkout SDK — no screenshot listener needed
}

async function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal?.classList.add('active');
    // Reset state
    const content = document.getElementById('payModalContent');
    const success = document.getElementById('paySuccessContent');
    const errDiv = document.getElementById('paymentError');
    const btn = document.getElementById('razorpayPayBtn');
    const btnText = document.getElementById('razorpayPayBtnText');
    if (content) content.style.display = 'block';
    if (success) success.style.display = 'none';
    if (errDiv) errDiv.textContent = '';
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    if (btnText) btnText.textContent = 'Pay ₹100 — Activate Pro';
}

function closePaymentModal() { document.getElementById('paymentModal')?.classList.remove('active'); }

/**
 * Full Razorpay Checkout SDK flow:
 * 1. POST /api/payments/create-order → get orderId + keyId
 * 2. Open Razorpay Checkout popup
 * 3. On success → POST /api/payments/verify → upgrade confirmed
 * 4. Show success UI + send confirmation emails (backend)
 */
async function startRazorpayCheckout() {
    const btn = document.getElementById('razorpayPayBtn');
    const btnText = document.getElementById('razorpayPayBtnText');
    const errDiv = document.getElementById('paymentError');

    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    if (btnText) btnText.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i> Creating order…';
    if (errDiv) errDiv.textContent = '';

    try {
        // Step 1: Create Razorpay order
        const orderRes = await apiRequest('/payments/create-order', {
            method: 'POST',
            body: JSON.stringify({ planType: 'PRO' })
        });

        if (!orderRes.ok) {
            throw new Error(orderRes.data?.message || 'Failed to create payment order.');
        }

        const { orderId, amount, currency, keyId } = orderRes.data;

        // Step 2: Open Razorpay Checkout popup
        if (btnText) btnText.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i> Opening Razorpay…';

        const options = {
            key: keyId,
            amount: amount,
            currency: currency || 'INR',
            name: 'Classgrid',
            description: 'Pro Plan — 31 Days',
            order_id: orderId,
            handler: async function (response) {
                // Step 3: Verify payment on backend
                if (btnText) btnText.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i> Verifying payment…';
                if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

                try {
                    const verifyRes = await apiRequest('/payments/verify', {
                        method: 'POST',
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            planType: 'PRO'
                        })
                    });

                    if (verifyRes.ok) {
                        // Step 4: Show success
                        document.getElementById('payModalContent').style.display = 'none';
                        document.getElementById('paySuccessContent').style.display = 'block';
                        toast('🎉 Pro plan activated! Check your email for instructions.', 'success');
                    } else {
                        if (errDiv) errDiv.textContent = verifyRes.data?.message || 'Payment verification failed. Contact support.';
                        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
                        if (btnText) btnText.textContent = 'Pay ₹100 — Activate Pro';
                    }
                } catch {
                    if (errDiv) errDiv.textContent = 'Verification error. Your payment is safe — contact support@classgrid.in.';
                    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
                    if (btnText) btnText.textContent = 'Pay ₹100 — Activate Pro';
                }
            },
            prefill: {},
            theme: {
                color: '#a855f7',
                backdrop_color: 'rgba(0,0,0,0.85)'
            },
            modal: {
                ondismiss: function () {
                    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
                    if (btnText) btnText.textContent = 'Pay ₹100 — Activate Pro';
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
            if (errDiv) errDiv.textContent = response.error?.description || 'Payment failed. Please try again.';
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
            if (btnText) btnText.textContent = 'Pay ₹100 — Activate Pro';
        });
        rzp.open();

    } catch (err) {
        if (errDiv) errDiv.textContent = err.message || 'Something went wrong. Please try again.';
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        if (btnText) btnText.textContent = 'Pay ₹100 — Activate Pro';
    }
}

/* -- DELETE ORG -- */
function openOrgDeleteModal() {
    const input = document.getElementById('orgAdminDeleteInput');
    if (input) input.value = '';
    checkOrgAdminDeleteInput();
    document.getElementById('deleteOrgAdminModal')?.classList.add('active');
}

function closeDeleteOrgModal() { document.getElementById('deleteOrgAdminModal')?.classList.remove('active'); }

function checkOrgAdminDeleteInput() {
    const btn = document.getElementById('orgAdminDeleteBtn');
    const val = document.getElementById('orgAdminDeleteInput')?.value.trim();
    if (!btn) return;
    if (val === 'DELETE') {
        btn.disabled = false;
        btn.style.background = 'var(--red)';
        btn.style.color = '#fff';
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
        btn.style.borderColor = 'var(--red)';
    } else {
        btn.disabled = true;
        btn.style.background = 'var(--elevated)';
        btn.style.color = 'var(--dim)';
        btn.style.cursor = 'not-allowed';
        btn.style.opacity = '0.5';
        btn.style.borderColor = 'var(--border)';
    }
}

async function requestOrgDeletion() {
    const btn = document.getElementById('orgAdminDeleteBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Sending...'; }
    const res = await apiRequest('/organization/request-delete', { method: 'POST' });
    if (res.ok) {
        closeDeleteOrgModal();
        toast(`${res.data?.message || 'Verification email sent.'}`, 'success');
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<span><i class="fas fa-envelope"></i> Send Verification Email</span>'; }
}

/* -- COPY CODE -- */
function copyCode(elementId, btn) {
    const el = document.getElementById(elementId);
    const code = el?.textContent?.trim();
    if (!code || code === '�') return;
    navigator.clipboard.writeText(code).then(() => {
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.style.opacity = '0.7';
        setTimeout(() => { btn.innerHTML = original; btn.style.opacity = '1'; }, 2000);
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    });
}

/* -- LOGOUT -- */
function doLogout() {
    if (window.Auth && window.Auth.logout) { window.Auth.logout(); return; }
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    window.location.replace('/admin/login');
}

/* -- TOAST -- */
function toast(msg, type = 'info') {
    const container = document.getElementById('toast');
    if (!container) return;
    const item = document.createElement('div');
    item.className = `toast-item ${type}`;
    const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle');
    item.innerHTML = `<i class="fas fa-${icon}"></i> ${msg}`;
    container.appendChild(item);
    setTimeout(() => { item.style.opacity = '0'; item.style.transition = 'opacity 0.3s'; setTimeout(() => item.remove(), 300); }, 4000);
}

/* -- CSV DOWNLOAD -- */
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/* -- BOOKMARK TOAST -- */
function showBookmarkToast() {
    const t = document.createElement('div');
    t.className = 'toast-item info';
    t.style.maxWidth = '350px';
    t.innerHTML = `
        <div>
            <div style="font-weight:600;font-size:0.9rem;margin-bottom:4px;"><i class="fas fa-bookmark" style="color:var(--blue);margin-right:6px;"></i>Bookmark this URL!</div>
            <div style="font-size:0.82rem;color:var(--muted);line-height:1.4;">Press <strong>Ctrl+D</strong> (or <strong>Cmd+D</strong>) to bookmark this Admin Dashboard.</div>
        </div>
        <i class="fas fa-times" style="cursor:pointer;color:var(--dim);font-size:0.85rem;position:absolute;top:8px;right:10px;" onclick="this.parentElement.remove()"></i>
    `;
    t.style.position = 'relative';
    const container = document.getElementById('toast');
    if (container) container.appendChild(t);
    setTimeout(() => { if (t.parentElement) { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); } }, 10000);
}

/* -- CLASSROOM TEST ACCOUNTS (Role Sandbox) -- */
async function loadDemoAccounts() {
    try {
        const res = await apiRequest('/org/test-accounts');
        if (res.ok) {
            renderDemoAccounts(res.data?.testAccounts || []);
        }
    } catch (e) { console.error('Load admin test accounts error:', e); }
}

function renderDemoAccounts(list) {
    const tbody = document.getElementById('demoAccountsBody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--dim);padding:2rem;"><i class="fas fa-flask" style="margin-right:6px;"></i>No admin test accounts yet. Create one above.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(d => `
        <tr>
            <td><span class="pill ${d.role === 'faculty' ? 'pill-faculty' : 'pill-active'}">${d.role === 'faculty' ? 'Faculty' : 'Student'}</span></td>
            <td style="color:var(--muted);word-break:break-all;font-size:0.82rem;">${esc(d.email)}</td>
            <td>
                <div style="display:flex;align-items:center;gap:6px;">
                    <code style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);padding:5px 12px;border-radius:6px;font-size:0.9rem;font-weight:700;user-select:all;color:#22c55e;letter-spacing:0.5px;">${esc(d.sandboxPassword || '—')}</code>
                    ${d.sandboxPassword ? `<button class="btn btn-sm" style="padding:3px 8px;font-size:0.7rem;" onclick="navigator.clipboard.writeText('${esc(d.sandboxPassword)}').then(()=>toast('Password copied!','success'))"><i class="fas fa-copy"></i></button>` : '<span style="font-size:0.72rem;color:var(--dim);">Reset to reveal</span>'}
                </div>
            </td>
            <td style="color:var(--dim);">${new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td>
                <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
                    <button class="btn btn-sm" onclick="openDemoResetModal('${d._id}')"><i class="fas fa-key"></i> ResetPwd</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDemoAccount('${d._id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function openCreateDemoModal(role) {
    const roleLabel = role === 'faculty' ? 'Admin Faculty' : 'Admin Student';
    if (!confirm(`Create an ${roleLabel} test account? This will generate a classroom test account instantly.`)) return;

    const res = await apiRequest('/org/test-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
    });

    if (res.ok) {
        toast('Test account created', 'success');
        document.getElementById('demoCreatedRole').textContent = roleLabel;
        document.getElementById('demoCreatedEmail').textContent = res.data.account.email;
        document.getElementById('demoCreatedPassword').textContent = res.data.plaintextPassword;
        document.getElementById('demoCreatedModal')?.classList.add('active');
        loadDemoAccounts();
    } else {
        toast(res.error || 'Failed to create test account', 'error');
    }
}

function closeDemoCreatedModal() {
    document.getElementById('demoCreatedModal')?.classList.remove('active');
}

function copyDemoPassword() {
    const pw = document.getElementById('demoCreatedPassword')?.textContent;
    if (pw && pw !== '�') {
        navigator.clipboard.writeText(pw).then(() => toast('Password copied!', 'success')).catch(() => toast('Copy failed.', 'error'));
    }
}

function openDemoResetModal(id) {
    document.getElementById('demoResetId').value = id;
    document.getElementById('demoResetPasswordInput').value = '';
    document.getElementById('demoResetResult').style.display = 'none';
    document.getElementById('demoResetModal')?.classList.add('active');
}

function closeDemoResetModal() {
    document.getElementById('demoResetModal')?.classList.remove('active');
}

async function submitDemoPasswordReset() {
    const id = document.getElementById('demoResetId').value;
    const customPw = document.getElementById('demoResetPasswordInput')?.value?.trim();
    const body = customPw ? { customPassword: customPw } : {};
    const res = await apiRequest(`/org/test-accounts/${id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (res.ok) {
        document.getElementById('demoResetNewPassword').textContent = res.data.plaintextPassword;
        document.getElementById('demoResetResult').style.display = 'block';
        toast('Password reset!', 'success');
        loadDemoAccounts();
        // Auto-close modal after 2 seconds
        setTimeout(() => closeDemoResetModal(), 2000);
    } else {
        toast(res.error || 'Failed to reset password', 'error');
    }
}

async function deleteDemoAccount(id) {
    if (!confirm('Delete this admin test account? This action is permanent.')) return;

    const res = await apiRequest(`/org/test-accounts/${id}`, { method: 'DELETE' });
    if (res.ok) {
        toast('Admin test account deleted.', 'success');
        loadDemoAccounts();
    } else {
        toast(res.error || 'Failed to delete account', 'error');
    }
}


/* -- HELPERS -- */
function esc(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
}

function setEl(id, html) {
    const el = document.getElementById(id);
    if (!el) return;

    // Animate stats automatically
    if (window.UIAnim && (id.startsWith('stat') || id.startsWith('growth') || id.startsWith('notesStat') || id.startsWith('analytics') || id.startsWith('usage') || id.startsWith('sec') || id.startsWith('sys') || id.startsWith('m') || id.startsWith('rev'))) {
        const val = parseFloat(html);
        if (!isNaN(val)) {
            UIAnim.animateValue(el, 0, val);
            return;
        }
    }
    el.innerHTML = html;
}


/* -- ARCHIVE CLASSROOM (ORG ADMIN) -- */
async function archiveClassroom(classroomId, isCurrentlyArchived) {
    const action = isCurrentlyArchived ? 'restore' : 'archive';
    if (!confirm(`Are you sure you want to ${action} this classroom?`)) return;
    try {
        const res = await apiRequest(`/org/archive-classroom/${classroomId}`, 'POST');
        if (res.ok) {
            showToast(res.data?.message || `Classroom ${action}d.`, 'success');
            loadClassrooms();
        } else {
            showToast(res.data?.message || `Failed to ${action} classroom.`, 'error');
        }
    } catch {
        showToast('Network error.', 'error');
    }
}

/* -- CHANGE ADMIN PASSWORD (SECURITY SECTION) -- */
async function changeAdminPassword() {
    const current = document.getElementById('secCurrentPassword')?.value || '';
    const newPwd = document.getElementById('secNewPassword')?.value || '';
    const confirm_ = document.getElementById('secConfirmPassword')?.value || '';
    const msgEl = document.getElementById('secPasswordMsg');

    const showMsg = (text, color) => {
        if (!msgEl) return;
        msgEl.textContent = text;
        msgEl.style.color = color;
        msgEl.style.display = 'block';
    };

    if (!current || !newPwd || !confirm_) return showMsg('All fields are required.', 'var(--red)');
    if (newPwd.length < 8) return showMsg('New password must be at least 8 characters.', 'var(--red)');
    if (newPwd !== confirm_) return showMsg('New passwords do not match.', 'var(--red)');

    showMsg('Changing password�', 'var(--muted)');

    try {
        const res = await apiRequest('/org/change-password', 'POST', {
            currentPassword: current,
            newPassword: newPwd,
        });
        if (res.ok) {
            showMsg('? Password changed successfully!', 'var(--green)');
            document.getElementById('secCurrentPassword').value = '';
            document.getElementById('secNewPassword').value = '';
            document.getElementById('secConfirmPassword').value = '';
        } else {
            showMsg(res.data?.message || 'Failed to change password.', 'var(--red)');
        }
    } catch {
        showMsg('Network error. Please try again.', 'var(--red)');
    }
}

/*  STUDENT PERFORMANCE (Top 10, Analytics Section)  */
async function loadStudentPerformance() {
    const container = document.getElementById('topStudentsContainer');
    if (!container) return;

    try {
        const res = await apiRequest('/org/student-performance');
        if (!res.ok) {
            container.innerHTML = `<div class="info-box" style="color:var(--dim);">Could not load student performance data.</div>`;
            return;
        }
        const { students, totalStudents, cached } = res.data;

        if (!students || students.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--dim);"><i class="fas fa-user-graduate" style="font-size:2rem;display:block;margin-bottom:8px;"></i>Not enough data yet. Students need to attempt quizzes, upload notes, and attend classes.</div>`;
            return;
        }

        const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

        container.innerHTML = `
            ${cached ? `<div style="font-size:0.75rem;color:var(--dim);margin-bottom:8px;"><i class="fas fa-clock" style="margin-right:4px;"></i>Cached result � refreshes every 5 min</div>` : ''}
            <div style="overflow-x:auto;">
            <table>
                <thead><tr>
                    <th style="width:40px;">#</th>
                    <th>Student</th>
                    <th title="Weighted composite score">Score</th>
                    <th title="Average quiz %">Quiz</th>
                    <th title="Attendance rate">Attend</th>
                    <th title="Approved notes uploaded">Notes</th>
                    <th title="Activity count (30d)">Activity</th>
                </tr></thead>
                <tbody>
                ${students.map((s, i) => {
            const medal = i < 3 ? `<span style="color:${medalColors[i]};margin-right:4px;">` + ['', '', ''][i] + `</span>` : '';
            const bar = `<div style="background:var(--elevated);border-radius: 4px;height:6px;width:80px;display:inline-block;vertical-align:middle;overflow:hidden;"><div style="background:var(--blue);height:100%;width:${s.engagementScore}%;border-radius: 4px;"></div></div>`;
            return `<tr>
                        <td style="font-weight:700;color:var(--dim);">${medal}${s.rank}</td>
                        <td>
                            <div style="font-weight:600;">${esc(s.name)}</div>
                            <div style="font-size:0.72rem;color:var(--dim);">${esc(s.email)}</div>
                        </td>
                        <td>
                            <div style="display:flex;align-items:center;gap:8px;">
                                ${bar}
                                <span style="font-weight:700;color:var(--${s.engagementScore >= 70 ? 'green' : s.engagementScore >= 40 ? 'amber' : 'red'});">${s.engagementScore}</span>
                            </div>
                        </td>
                        <td><span style="color:var(--${s.quizAvg >= 60 ? 'green' : 'amber'});">${s.quizAttempts > 0 ? s.quizAvg + '%' : '—'}</span></td>
                        <td><span style="color:var(--${s.attendanceRate >= 75 ? 'green' : s.attendanceRate >= 50 ? 'amber' : 'red'});">${s.attendanceRate}%</span></td>
                        <td>${s.notesCount || 0}</td>
                        <td style="color:var(--muted);">${s.activityCount}</td>
                    </tr>`;
        }).join('')}
                </tbody>
            </table>
            </div>
            <div style="font-size:0.75rem;color:var(--dim);margin-top:8px;text-align:right;">Showing top ${students.length} of ${totalStudents} total students</div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="info-box" style="color:var(--dim);">Error loading performance data.</div>`;
    }
}

/*  ADMIN AUDIT LOG  */
async function loadAuditLog() {
    const tbody = document.getElementById('auditLogBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><div class="spinner"></div></td></tr>`;

    const actionFilter = document.getElementById('auditActionFilter')?.value || '';
    const params = actionFilter ? `?action=${actionFilter}` : '';

    try {
        const res = await apiRequest(`/org/audit-log${params}`);
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-lock"></i><p>Could not load audit log.</p></td></tr>`;
            return;
        }
        const logs = res.data?.logs || [];
        if (!logs.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-history"></i><p>No admin actions recorded yet. Actions appear here after the first mutation.</p></td></tr>`;
            return;
        }

        const actionLabels = {
            add_faculty: 'Added Faculty', remove_faculty: 'Removed Faculty',
            remove_student: 'Removed Student', change_role: 'Changed Role',
            archive_classroom: 'Archived Classroom', restore_classroom: 'Restored Classroom',
            approve_note: 'Approved Note', reject_note: 'Rejected Note',
            create_announcement: 'Created Announcement', delete_announcement: 'Deleted Announcement',
        };
        const actionIcons = {
            add_faculty: 'fa-user-plus', remove_faculty: 'fa-user-minus',
            remove_student: 'fa-user-times', change_role: 'fa-exchange-alt',
            archive_classroom: 'fa-archive', restore_classroom: 'fa-box-open',
            approve_note: 'fa-check-circle', reject_note: 'fa-times-circle',
            create_announcement: 'fa-bullhorn', delete_announcement: 'fa-trash',
        };
        const actionColors = {
            remove_faculty: 'var(--red)', remove_student: 'var(--red)',
            archive_classroom: 'var(--amber)', reject_note: 'var(--red)',
            delete_announcement: 'var(--red)', add_faculty: 'var(--green)',
            approve_note: 'var(--green)', create_announcement: 'var(--blue)',
            change_role: 'var(--purple)', restore_classroom: 'var(--cyan)',
        };

        tbody.innerHTML = logs.map(log => {
            const label = actionLabels[log.action] || log.action;
            const icon = actionIcons[log.action] || 'fa-bolt';
            const color = actionColors[log.action] || 'var(--muted)';
            const time = log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '�';
            const meta = log.metadata && (log.metadata.oldRole || log.metadata.newRole)
                ? `<span style="font-size:0.75rem;color:var(--dim);">${log.metadata.oldRole || 'Unknown'} &rarr; ${log.metadata.newRole || 'Unknown'}</span>`
                : '';
            return `<tr>
                <td style="color:var(--dim);font-size:0.8rem;">${time}</td>
                <td>
                    <div style="font-weight:600;">${esc(log.actorName || log.actorId?.name || 'Unknown')}</div>
                    <div style="font-size:0.72rem;color:var(--dim);">${esc(log.actorRole || '')}</div>
                </td>
                <td>
                    <span style="display:inline-flex;align-items:center;gap:5px;color:${color};font-weight:600;font-size:0.85rem;">
                        <i class="fas ${icon}"></i> ${esc(label)}
                    </span>
                </td>
                <td>
                    <div style="font-weight:500;">${esc(log.targetName || log.targetId || '�')}</div>
                    <div style="font-size:0.72rem;color:var(--dim);">${esc(log.targetType || '')}</div>
                </td>
                <td>${meta}</td>
            </tr>`;
        }).join('');
    } catch {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Network error loading audit log.</p></td></tr>`;
    }
}
function openEditAnnouncementModal(id) {
    const ann = announcementsList.find(a => a._id === id);
    if (!ann) return;

    document.getElementById("announcementModal")?.classList.add("active");

    // Switch modal to Edit Mode
    const titleEl = document.getElementById("annTitle");
    const contentEl = document.getElementById("annContent");
    const btn = document.getElementById("submitAnnouncementBtn");
    const header = document.querySelector("#announcementModal .modal-header h2");

    if (titleEl) titleEl.value = ann.title || "";
    if (contentEl) contentEl.value = (ann.content || "").replace(/<br>/g, "\n");
    if (btn) {
        btn.innerHTML = `<span>Save Changes</span><i class="fas fa-save"></i>`;
        btn.onclick = (e) => submitEditAnnouncement(e, id);
    }
    if (header) header.innerHTML = `<i class="fas fa-edit" style="color:var(--blue);margin-right:8px;"></i>Edit Announcement`;

    // Handle Targets
    const targetType = ann.target_type || "specific";
    const radio = document.querySelector(`input[name="annTargetType"][value="${targetType}"]`);
    if (radio) radio.checked = true;

    // Populate and check classrooms
    const container = document.getElementById("announcementClassroomsList");
    if (container && classroomList.length > 0) {
        container.innerHTML = classroomList.map(c => {
            const isChecked = (ann.target_classrooms || []).some(tc => (tc._id || tc) === c._id) ? "checked" : "";
            return `<label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:var(--muted);cursor:pointer;">
                <input type="checkbox" name="target_classroom" value="${c._id}" style="accent-color:var(--blue);" ${isChecked}>
                ${esc(c.name || c.className || "Untitled")}
            </label>`;
        }).join("");
    }
}

async function submitEditAnnouncement(e, id) {
    if (e) e.preventDefault();
    const title = document.getElementById("annTitle")?.value.trim();
    const content = document.getElementById("annContent")?.value.trim();
    const targetType = document.querySelector(`input[name="annTargetType"]:checked`)?.value || "specific";

    if (!title || !content) { toast("Title and content are required.", "error"); return; }

    const targetClassrooms = [];
    if (targetType === "specific") {
        document.querySelectorAll(`input[name="target_classroom"]:checked`).forEach(cb => targetClassrooms.push(cb.value));
        if (targetClassrooms.length === 0) { toast("Select at least one classroom.", "error"); return; }
    }

    const btn = document.getElementById("submitAnnouncementBtn");
    if (btn) btn.disabled = true;

    const payload = { title, content, target_type: targetType };
    if (targetType === "specific") payload.target_classrooms = targetClassrooms;

    const res = await apiRequest(`/org/announcements/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
    });

    if (btn) btn.disabled = false;

    if (res.ok) {
        toast(" Announcement updated!", "success");
        closeAnnouncementModal();
        loadAnnouncements();
    } else {
        toast(res.data?.message || "Failed to update.", "error");
    }
}

// Override close to reset modal back to "Create" mode
const originalCloseAnnouncementModal = closeAnnouncementModal;
closeAnnouncementModal = function () {
    originalCloseAnnouncementModal();
    const btn = document.getElementById("submitAnnouncementBtn");
    const header = document.querySelector("#announcementModal .modal-header h2");
    if (btn) {
        btn.innerHTML = `<span>Publish Announcement</span><i class="fas fa-paper-plane"></i>`;
        btn.onclick = submitAnnouncement;
    }
    if (header) header.innerHTML = `<i class="fas fa-bullhorn" style="color:var(--blue);margin-right:8px;"></i>Create Announcement`;
};

/*  FAST FETCH (MANUAL REFRESH)  */
async function fastFetchAnalytics() {
    const icon = document.getElementById("refreshIconOrg");
    const label = document.getElementById("lastRefreshOrg");
    if (icon) icon.classList.add("fa-spin");

    try {
        // Fetch all Org-level analytics data
        await Promise.all([
            loadOverview(),
            loadStudentPerformance(),
            (typeof loadAnnouncements === "function" ? loadAnnouncements() : Promise.resolve())
        ]);

        if (label) {
            const now = new Date();
            label.textContent = `Last active: ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
        }
        toast("Analytics refreshed successfully", "success");
    } catch (e) {
        console.error("Fast Fetch Error:", e);
        toast("Error refreshing analytics", "error");
    } finally {
        if (icon) icon.classList.remove("fa-spin");
    }
}



// Initialize scroll animations
window.addEventListener('scroll', () => {
    if (window.UIAnim && !window._uiAnimInit) {
        window._uiAnimInit = true;
        UIAnim.initScrollAnimations();
    }
});
setTimeout(() => {
    if (window.UIAnim) UIAnim.initScrollAnimations();
}, 500);

/* --------------------------------------------------------------
   AUTO-REFRESH ENGINE
   - Per-section timestamps
   - Tab-visibility aware (pauses when hidden)
   - Memory-safe (single interval, cleared on logout/unload)
   - Silent: no UI break on failure, no skeleton on refresh
   - Only refreshes the active section + always refreshes overview
     stats + notes badge in background
   -------------------------------------------------------------- */

function startAutoRefresh() {
    // Prevent duplicate intervals
    if (_autoRefreshInterval) clearInterval(_autoRefreshInterval);

    // Master tick: checks every 35s whether any section needs refresh
    _autoRefreshInterval = setInterval(() => {
        if (_isRefreshing || document.hidden) return;
        const now = Date.now();

        // Always silently refresh overview stats + notes badge
        if (now - (_sectionLastRefresh['overview'] || 0) >= SECTION_INTERVALS.overview) {
            _silentRefreshOverview();
        }
        if (now - (_sectionLastRefresh['_notesBadge'] || 0) >= 120000) {
            loadNotesBadge();
            _sectionLastRefresh['_notesBadge'] = now;
        }

        // Refresh the currently active section (if its interval has elapsed)
        const interval = SECTION_INTERVALS[_activeSection] || 60000;
        if (now - (_sectionLastRefresh[_activeSection] || 0) >= interval) {
            _silentRefreshSection(_activeSection);
        }
    }, 120000);

    // Start the live indicator clock
    _startLiveIndicator();
}

function stopAutoRefresh() {
    if (_autoRefreshInterval) { clearInterval(_autoRefreshInterval); _autoRefreshInterval = null; }
    if (_liveIndicatorInterval) { clearInterval(_liveIndicatorInterval); _liveIndicatorInterval = null; }
}

async function _silentRefreshSection(name) {
    if (_isRefreshing) return;
    _isRefreshing = true;
    _setRefreshIndicator(true);
    try {
        switch (name) {
            case 'overview': await loadOverview(); break;
            case 'faculty': await loadFaculty(); break;
            case 'students': await loadStudents(); break;
            case 'classrooms': _classroomsFetched = false; await loadClassrooms(); break;
            case 'notes': await loadNotes(); break;
            case 'analytics': await loadAnalytics(); break;
            case 'attendance': await loadAttendance(); break;
            case 'announcements': await loadAnnouncements(); break;
            case 'auditlog': if (typeof loadAuditLog === 'function') await loadAuditLog(); break;
            // Static sections: security, organization, billing, sandbox � skip
        }
        _sectionLastRefresh[name] = Date.now();
        _updateLastRefreshedTime();
    } catch (err) {
        console.warn('[AutoRefresh] Silent refresh failed for section:', name, err);
        // Never break the UI � swallow silently
    } finally {
        _isRefreshing = false;
        _setRefreshIndicator(false);
    }
}

async function _silentRefreshOverview() {
    try {
        const res = await apiRequest('/org/me');
        if (res.ok) {
            orgData = res.data;
            const org = res.data.organization;
            const stats = res.data.stats;
            setEl('statFacultyCount', stats.facultyCount);
            setEl('statFacultyLimit', stats.facultyLimit);
            setEl('statStudentCount', stats.studentCount ?? 0);
            setEl('statPlan', (org.plan || 'FREE').toUpperCase());
            _sectionLastRefresh['overview'] = Date.now();
        }
    } catch (err) {
        console.warn('[AutoRefresh] Silent overview refresh failed:', err);
    }
}

/* -- LIVE INDICATOR ("Last updated: X seconds ago") -- */
let _lastRefreshedAt = Date.now();

function _updateLastRefreshedTime() {
    _lastRefreshedAt = Date.now();
}

function _startLiveIndicator() {
    if (_liveIndicatorInterval) clearInterval(_liveIndicatorInterval);
    _liveIndicatorInterval = setInterval(() => {
        const label = document.getElementById('liveRefreshLabel');
        if (!label) return;
        const diff = Math.floor((Date.now() - _lastRefreshedAt) / 1000);
        if (diff < 5) {
            label.textContent = 'Updated just now';
        } else if (diff < 60) {
            label.textContent = `Updated ${diff}s ago`;
        } else {
            label.textContent = `Updated ${Math.floor(diff / 60)}m ago`;
        }
    }, 1000);
}

function _setRefreshIndicator(isActive) {
    const icon = document.getElementById('liveRefreshIcon');
    const dot = document.getElementById('liveRefreshDot');
    if (icon) icon.classList.toggle('fa-spin', isActive);
    if (dot) dot.style.opacity = isActive ? '0.5' : '1';
}

/* -- MANUAL REFRESH NOW -- */
window.manualRefresh = async function () {
    if (_isRefreshing) return;
    const btn = document.getElementById('refreshNowBtn');
    if (btn) { btn.disabled = true; }
    try {
        await _silentRefreshSection('overview');
        if (_activeSection !== 'overview') await _silentRefreshSection(_activeSection);
        await loadNotesBadge();
        _updateLastRefreshedTime();
    } catch (err) {
        console.warn('[ManualRefresh] Error:', err);
    } finally {
        if (btn) { btn.disabled = false; }
    }
};

/* -- CLEANUP ON LOGOUT -- */
const _originalDoLogout = typeof doLogout === 'function' ? doLogout : null;
if (_originalDoLogout) {
    window.doLogout = function () {
        stopAutoRefresh();
        _originalDoLogout();
    };
}

/* ═══════════════════════════════════════════════════════════
   14 — RESULT SYSTEM (Multi-Subject)
   ═══════════════════════════════════════════════════════════ */

let _rsSubjects = [];
let _rsExams = [];
let _rsPendingMatched = null;
let _rsLoaded = false;
let _rsPolicy = { calculationMethod: 'percentage', passPercentage: 40, gradeRules: [] };

function switchRsTab(tab) {
    ['subjects', 'createExam', 'policy', 'history'].forEach(t => {
        const panel = document.getElementById('rsPanel-' + t);
        const btn = document.getElementById('rsTab-' + t);
        if (panel) panel.style.display = t === tab ? '' : 'none';
        if (panel && t === tab) panel.classList.add('visible');
        if (btn) {
            btn.className = t === tab ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
        }
    });
}

async function loadResultSystem() {
    if (_rsLoaded) return;
    _rsLoaded = true;
    await Promise.all([loadSubjects(), loadExamList(), loadClassroomsForRS(), loadResultPolicy()]);
}

/* -- RESULT POLICY -- */
async function loadResultPolicy() {
    try {
        const res = await apiRequest('/marks/policy');
        if (res.ok && res.data.policy) {
            _rsPolicy = res.data.policy;
            renderResultPolicy();
        }
    } catch (e) { console.error(e); }
}

function renderResultPolicy() {
    document.getElementById('rsPolicyMethod').value = _rsPolicy.calculationMethod || 'percentage';
    document.getElementById('rsPolicyPassing').value = _rsPolicy.passPercentage || 40;
    renderGradeRulesTable();
    toggleGradeRulesUI();
}

function toggleGradeRulesUI() {
    const method = document.getElementById('rsPolicyMethod').value;
    const rulesSec = document.getElementById('rsGradeRulesSection');
    if (method === 'grade' || method === 'cgpa') {
        rulesSec.style.display = 'block';
    } else {
        rulesSec.style.display = 'none';
    }
}

function renderGradeRulesTable() {
    const tbody = document.getElementById('rsGradeRulesBody');
    if (!tbody) return;
    if (!_rsPolicy.gradeRules || _rsPolicy.gradeRules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="padding:1rem;color:var(--dim);text-align:center;">No rules defined. Add a rule to calculate grades.</td></tr>';
        return;
    }
    tbody.innerHTML = _rsPolicy.gradeRules.map((r, i) => `
        <tr>
            <td><input type="number" class="form-input" style="width:70px" value="${r.minPct}" oninput="updateRsGradeRule(${i}, 'minPct', this.value)"></td>
            <td><input type="number" class="form-input" style="width:70px" value="${r.maxPct}" oninput="updateRsGradeRule(${i}, 'maxPct', this.value)"></td>
            <td><input type="text" class="form-input" style="width:80px" value="${esc(r.grade)}" oninput="updateRsGradeRule(${i}, 'grade', this.value)"></td>
            <td><input type="number" step="0.1" class="form-input" style="width:70px" value="${r.gradePoint || ''}" oninput="updateRsGradeRule(${i}, 'gradePoint', this.value)"></td>
            <td><button class="btn btn-amber btn-sm" onclick="removeRsGradeRule(${i})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function addRsGradeRule() {
    if (!_rsPolicy.gradeRules) _rsPolicy.gradeRules = [];
    _rsPolicy.gradeRules.push({ minPct: 0, maxPct: 100, grade: 'A', gradePoint: 10 });
    renderGradeRulesTable();
}

window.updateRsGradeRule = function (idx, field, val) {
    if (field === 'minPct' || field === 'maxPct' || field === 'gradePoint') {
        val = parseFloat(val);
    }
    _rsPolicy.gradeRules[idx][field] = val;
};

window.removeRsGradeRule = function (idx) {
    _rsPolicy.gradeRules.splice(idx, 1);
    renderGradeRulesTable();
};

async function saveResultPolicy() {
    const method = document.getElementById('rsPolicyMethod').value;
    const passing = parseFloat(document.getElementById('rsPolicyPassing').value) || 40;

    // Sort rules by minPct descending for logical processing on backend
    let rules = [...(_rsPolicy.gradeRules || [])];
    rules.sort((a, b) => b.minPct - a.minPct);

    const payload = { calculationMethod: method, passPercentage: passing, gradeRules: rules };

    const res = await apiRequest('/marks/policy', {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
    if (res.ok) {
        toast('Result Policy saved successfully!', 'success');
        _rsPolicy = res.data.policy;
        renderResultPolicy();
    } else {
        toast('Failed to save policy', 'error');
    }
}

/* -- SUBJECTS -- */
async function loadSubjects() {
    try {
        const res = await apiRequest('/marks/subjects');
        if (res.ok) {
            _rsSubjects = res.data.subjects || [];
            renderSubjects();
        }
    } catch (e) { console.error(e); }
}

function renderSubjects() {
    const tbody = document.getElementById('rsSubjectsBody');
    if (!tbody) return;
    if (_rsSubjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fas fa-book"></i><p>No subjects configured yet. Add your first subject above.</p></td></tr>';
        return;
    }
    tbody.innerHTML = _rsSubjects.map((s, i) => `
        <tr>
            <td style="color:var(--dim);">${i + 1}</td>
            <td style="font-weight:600;">${esc(s.subjectName)}</td>
            <td>${s.maxMarks}</td>
            <td style="color:var(--dim);">${new Date(s.createdAt).toLocaleDateString()}</td>
            <td><button class="btn btn-amber btn-sm" onclick="deleteSubject('${s._id}','${esc(s.subjectName).replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
    renderSubjectCheckboxes();
}

async function addSubject() {
    const nameEl = document.getElementById('rsSubjectName');
    const maxEl = document.getElementById('rsSubjectMax');
    const name = nameEl?.value.trim();
    const max = parseInt(maxEl?.value) || 20;
    if (!name) { toast('Enter a subject name', 'error'); return; }
    const res = await apiRequest('/marks/subjects', {
        method: 'POST',
        body: JSON.stringify({ subjectName: name, maxMarks: max }),
    });
    if (res.ok) {
        toast('Subject added!', 'success');
        nameEl.value = '';
        _rsLoaded = false;
        await loadSubjects();
    }
}

async function deleteSubject(id, name) {
    if (!confirm('Delete subject "' + name + '"?')) return;
    const res = await apiRequest('/marks/subjects/' + id, { method: 'DELETE' });
    if (res.ok) {
        toast('Subject deleted', 'success');
        _rsLoaded = false;
        await loadSubjects();
    }
}

function renderSubjectCheckboxes() {
    const container = document.getElementById('rsExamSubjectsList');
    if (!container) return;
    if (_rsSubjects.length === 0) {
        container.innerHTML = '<span style="color:var(--dim);font-size:0.82rem;">No subjects configured. Go to Configure Subjects tab first.</span>';
        return;
    }
    container.innerHTML = _rsSubjects.map(s => `
        <label style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:0.82rem;font-weight:500;transition:all 0.2s;">
            <input type="checkbox" value="${s._id}" class="rs-subject-cb" checked style="accent-color:#00d4ff;">
            ${esc(s.subjectName)} <span style="color:var(--dim);font-size:0.7rem;">(${s.maxMarks})</span>
        </label>
    `).join('');
}

/* -- CLASSROOMS FOR RS -- */
async function loadClassroomsForRS() {
    if (!_classroomsFetched) await prefetchClassrooms();
    const sel = document.getElementById('rsExamClassroom');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select classroom...</option>';
    classroomList.forEach(c => {
        if (!c.settings?.isArchived) {
            sel.innerHTML += '<option value="' + c._id + '">' + esc(c.name || c.className || 'Untitled') + '</option>';
        }
    });
}

/* -- CREATE EXAM -- */
async function createExam() {
    const title = document.getElementById('rsExamTitle')?.value.trim();
    const examType = document.getElementById('rsExamType')?.value;
    const classroomId = document.getElementById('rsExamClassroom')?.value;
    const passing = parseInt(document.getElementById('rsExamPassing')?.value) || 0;
    const checkedBoxes = document.querySelectorAll('.rs-subject-cb:checked');
    const subjectIds = Array.from(checkedBoxes).map(cb => cb.value);

    if (!title) { toast('Exam name is required', 'error'); return; }
    if (!classroomId) { toast('Select a classroom', 'error'); return; }
    if (subjectIds.length === 0) { toast('Select at least one subject', 'error'); return; }

    const res = await apiRequest('/marks/create-exam', {
        method: 'POST',
        body: JSON.stringify({ title, examType, classroomId, subjectIds, passingMarks: passing }),
    });
    if (res.ok) {
        toast('Exam created! Go to Upload tab to add results.', 'success');
        document.getElementById('rsExamTitle').value = '';
        _rsLoaded = false;
        await loadExamList();
        const resultDiv = document.getElementById('rsExamResult');
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div class="info-box info-box-success" style="margin:0;"><i class="fas fa-check-circle" style="color:var(--green);margin-right:6px;"></i> Exam "' + esc(title) + '" created. Subjects: ' + res.data.exam.subjects.map(s => s.subjectName).join(', ') + '</div>';
        }
    }
}

/* -- LOAD EXAMS LIST -- */
async function loadExamList() {
    try {
        const res = await apiRequest('/marks/exams');
        if (res.ok) {
            _rsExams = res.data.exams || [];
            renderExamHistory();
        }
    } catch (e) { console.error(e); }
}

function renderExamHistory() {
    const tbody = document.getElementById('rsHistoryBody');
    if (!tbody) return;
    if (_rsExams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-history"></i><p>No exams created yet.</p></td></tr>';
        return;
    }
    tbody.innerHTML = _rsExams.map(e => {
        const subjectList = (e.subjects || []).map(s => s.subjectName).join(', ');

        let statsHtml = '\u2014';
        if (e.analytics && e.analytics.classAverage) {
            statsHtml = `
                <div style="font-size:0.75rem;line-height:1.3;color:var(--dim);">
                    <span style="color:var(--text);font-weight:600;">Avg:</span> ${e.analytics.classAverage.toFixed(1)}%<br>
                    <span style="color:var(--green);font-weight:600;">Hi:</span> ${e.analytics.highest}% | <span style="color:var(--red);font-weight:600;">Lo:</span> ${e.analytics.lowest}%<br>
                    <span style="font-weight:600;">Pass:</span> ${e.analytics.passPercentage.toFixed(1)}%
                </div>
            `;
        }

        const total = e.analytics?.totalStudents || e.mappingStats?.matched || '\u2014';

        let statusClass = '';
        if (e.status === 'published') statusClass = 'pill-success';
        else if (e.status === 'locked') statusClass = 'pill-dark';
        else if (e.status === 'verified') statusClass = 'pill-active';

        return `
        <tr>
            <td style="font-weight:600;">${esc(e.title)}</td>
            <td>${esc(e.classroom?.name || '\u2014')}</td>
            <td style="font-size:0.78rem;color:var(--dim);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(subjectList)}">${esc(subjectList) || '\u2014'}</td>
            <td>${total}</td>
            <td>${statsHtml}</td>
            <td><span class="pill ${statusClass}" style="cursor:pointer;" onclick="toggleRsExamStatus('${e._id}', '${e.status}')" title="Click to change status">${esc(e.status || 'draft')}</span></td>
            <td style="color:var(--dim);font-size:0.8rem;">${new Date(e.createdAt).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="exportRsExam('${e._id}')" title="Export Excel" style="color:var(--blue);"><i class="fas fa-file-excel"></i> Export</button>
            </td>
        </tr>`;
    }).join('');
}

async function toggleRsExamStatus(examId, currentStatus) {
    const statuses = ['draft', 'verified', 'published', 'locked'];
    let idx = statuses.indexOf(currentStatus);
    let nextStatus = statuses[(idx + 1) % statuses.length];

    // Quick confirmation if publishing or locking
    if (nextStatus === 'published' || nextStatus === 'locked') {
        if (!confirm(`Change exam status to ${nextStatus.toUpperCase()}?`)) return;
    }

    try {
        const res = await apiRequest('/marks/exams/' + examId + '/status', {
            method: 'PUT',
            body: JSON.stringify({ status: nextStatus })
        });
        if (res.ok) {
            toast('Status updated to ' + nextStatus, 'success');
            const exam = _rsExams.find(e => e._id === examId);
            if (exam) exam.status = nextStatus;
            renderExamHistory();
        }
    } catch (err) {
        console.error(err);
        toast('Failed to change status', 'error');
    }
}

function exportRsExam(examId) {
    window.location.href = '/api/marks/exams/' + examId + '/export';
}

