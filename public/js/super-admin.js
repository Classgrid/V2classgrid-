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
// === PROD API FIX ===
const _PROD_API = (window.location.origin.includes('classgrid.in') || window.location.origin.includes('classgrid.in')) ? '/api' : null;
// -----------------------------------------------------------
//  SUPER ADMIN 2.0 � Platform Command Center
//  All existing logic preserved + new features
// -----------------------------------------------------------

// -- GLOBALS --
const TOKEN = null;
let allOrgs = [], allUsers = [], pendingActionId = null, currentUserObj = null;
let limitTargetId = null, planTargetId = null;

function getApi() {
    if (_PROD_API) return _PROD_API;
    const o = window.location.origin;
    return o.includes('localhost') ? 'http://localhost:3000/api' : o + '/api';
}
const API = getApi();

// -- INSTANT AUTH GUARD --
(function instantGuard() {
    // 1. Fast path: The inline script in <head> may have already fetched our user
    if (window._cookieAuthUser && window._cookieAuthUser.role === 'super_admin') {
        populatePage(window._cookieAuthUser);
        document.body.style.visibility = 'visible';
        loadAllData();
        backgroundVerify();
        return;
    }

    try {
        const cached = localStorage.getItem('user');
        if (cached) {
            const u = JSON.parse(cached);
            if (u && u.role === 'super_admin') {
                populatePage(u);
                document.body.style.visibility = 'visible';
                loadAllData();
                backgroundVerify();
                return;
            }
        }
    } catch (_) { }
    document.body.style.visibility = 'hidden';
    apiVerify();
})();

function populatePage(user) {
    currentUserObj = user;
    const el = id => document.getElementById(id);
    if (el('navAdminName')) el('navAdminName').innerHTML = `<i class="fas fa-shield-alt"></i> ${user.name}`;
    if (el('sidebarAdminName')) el('sidebarAdminName').textContent = user.name;
    if (el('adminName')) el('adminName').textContent = user.name;
    if (el('adminEmail')) el('adminEmail').textContent = user.email || '';
    if (el('adminLastLogin')) el('adminLastLogin').textContent =
        user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Active session';
    if (el('overviewDate')) el('overviewDate').textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    // God user UI
    if (user.email === 'nikhil.shinde@classgrid.in') {
        const addBtn = el('createSuperAdminBtn');
        if (addBtn) addBtn.style.display = 'inline-flex';
    }
}

async function backgroundVerify() {
    try {
        const res = await fetch(`${API}/auth/me`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        if (res.status === 401) {
            localStorage.removeItem('jwt_token'); localStorage.removeItem('user');
            window.location.replace('/superadmin/login'); return;
        }
        if (res.ok) {
            const user = await res.json();
            if (user.role !== 'super_admin') {
                localStorage.removeItem('jwt_token'); localStorage.removeItem('user');
                window.location.replace('/superadmin/login'); return;
            }
            localStorage.setItem('user', JSON.stringify(user));
            populatePage(user);
        }
    } catch (_) { }
}

async function apiVerify(retryCount = 0) {
    try {
        const res = await fetch(`${API}/auth/me`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        if (res.status === 401) {
            localStorage.removeItem('jwt_token'); localStorage.removeItem('user');
            window.location.replace('/superadmin/login'); return;
        }
        if (!res.ok) {
            if (retryCount < 2) { await new Promise(r => setTimeout(r, 1500 * (retryCount + 1))); return apiVerify(retryCount + 1); }
            window.location.replace('/superadmin/login'); return;
        }
        const user = await res.json();
        if (user.role !== 'super_admin') {
            window.location.replace(user.role === 'org_admin' ? '/admin/login' : '/classroom'); return;
        }
        localStorage.setItem('user', JSON.stringify(user));
        populatePage(user);
        document.body.style.visibility = 'visible';
        loadAllData();
    } catch (e) {
        if (retryCount < 1) { await new Promise(r => setTimeout(r, 1000)); return apiVerify(retryCount + 1); }
        window.location.replace('/superadmin/login');
    }
}

function doLogout() {
    openConfirmModal('Logout', 'Are you sure you want to logout from the Command Center?', async () => {
        try {
            await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch (e) { }
        localStorage.removeItem('jwt_token'); localStorage.removeItem('user'); sessionStorage.clear();
        window.location.replace('/superadmin/login');
    });
}

// -- THEME TOGGLE --
function toggleTheme() {
    const html = document.documentElement;
    const isLight = html.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('sa_theme', newTheme);
    updateThemeToggleUI(newTheme);
}

function updateThemeToggleUI(theme) {
    const icon = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if (!icon || !label) return;
    if (theme === 'light') {
        icon.className = 'fas fa-moon';
        label.textContent = 'Dark Mode';
    } else {
        icon.className = 'fas fa-sun';
        label.textContent = 'Light Mode';
    }
}

function initThemeToggleUI() {
    const saved = localStorage.getItem('sa_theme') || 'dark';
    updateThemeToggleUI(saved);
}
initThemeToggleUI();

// -- NAVIGATION --
let isTransitioning = false;

function showSection(name, btn) {
    if (isTransitioning) return;
    const currentSection = document.querySelector('.page-section.active');
    const nextSection = document.getElementById('section-' + name);

    if (currentSection && currentSection === nextSection) return;

    isTransitioning = true;

    if (currentSection) {
        currentSection.style.opacity = '0';
        currentSection.style.transition = 'opacity 150ms ease';
    }

    document.querySelectorAll('.sidebar .nav-item').forEach(n => n.classList.remove('active'));
    if (btn) btn.classList.add('active');

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

        if (name === 'analytics') {
            loadOrgLevelAnalytics();
            if (typeof loadGlobalStudentPerformance === "function") loadGlobalStudentPerformance();
            if (typeof loadGlobalAuditLog === "function") loadGlobalAuditLog();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Re-trigger scroll animations for the new section
        if (window.UIAnim && typeof window.UIAnim.initScrollAnimations === 'function') {
            setTimeout(() => window.UIAnim.initScrollAnimations(), 50);
        }

        isTransitioning = false;
    }, currentSection ? 150 : 0);
}

// -- TOAST --
function toast(msg, type = 'info') {
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const el = document.createElement('div');
    el.className = `toast-item ${type}`;
    el.innerHTML = `<i class="fas ${icons[type]}"></i> ${msg}`;
    document.getElementById('toast').appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// -- SIMPLE CONFIRM MODAL (replaces confirm()) --
let confirmCallback = null;
function openConfirmModal(title, message, callback) {
    // Use a lightweight inline confirm for now
    if (confirm(message)) callback();
}

// -- LOAD ALL DATA --
async function loadAllData() {
    await Promise.all([
        loadPending(), loadOrgs(), loadUsers(), loadUpgrades(), loadPendingNotes(),
        loadSystemSettings(), loadSystemActivity(), loadDashboardAnalytics(), loadEmailAnalytics(),
        (typeof loadGlobalStorageAnalytics === "function" ? loadGlobalStorageAnalytics() : Promise.resolve()),
        (typeof loadGlobalStudentPerformance === "function" ? loadGlobalStudentPerformance() : Promise.resolve()),
        (typeof loadGlobalAuditLog === "function" ? loadGlobalAuditLog() : Promise.resolve())
    ]);
    // Sandbox removed from Super Admin — lives in Org Admin dashboard only
    updateOverviewStats();
    updateAnalytics();
    updateSecurity();
    updateSystem();
    updateRevenue();
}

// -- PENDING APPLICATIONS --
async function loadPending() {
    try {
        const res = await fetch(`${API}/admin/pending-organizations`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        const data = await res.json();
        const badge = document.getElementById('pendingBadge');
        if (badge) { /* no pendingBadge in new sidebar, moderation badge instead */ }
        animStat('statPending', data.length);
        // Update moderation badge
        updateModerationBadge();
        renderPending(data);
    } catch (e) { console.error(e); }
}

function renderPending(items) {
    const container = document.getElementById('pendingList');
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-check-double"></i><p>No pending applications. All caught up!</p></div>`;
        return;
    }
    container.innerHTML = items.map(p => `
        <div class="org-card" data-id="${p._id}">
            <div class="org-logo">
                ${p.logo_url ? `<img src="${p.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius: 4px;">` : '<i class="fas fa-university" style="font-size:1.2rem;"></i>'}
            </div>
            <div class="org-info">
                <div class="org-name">${p.institute_name}</div>
                <div class="org-meta">
                    <span><i class="fas fa-user"></i> ${p.owner_name} ${p.designation ? `(${p.designation})` : ''}</span>
                    <span><i class="fas fa-envelope"></i> ${p.owner_email}</span>
                    <span><i class="fas fa-phone"></i> ${p.phone}</span>
                    ${p.website ? `<span><i class="fas fa-globe"></i> <a href="${p.website}" target="_blank" style="color:var(--blue-light);text-decoration:none;">${p.website}</a></span>` : ''}
                    <span><i class="fas fa-calendar"></i> ${new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
                <div style="margin-top:0.3rem;font-size:0.78rem;color:var(--dim);"><i class="fas fa-map-marker-alt"></i> ${p.address}</div>
                ${(p.planRequested === 'PRO') ? `
                <div style="margin-top:0.6rem;padding:0.6rem;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius: 4px;">
                    <div style="font-size:0.75rem;font-weight:700;color:var(--purple,#a855f7);margin-bottom:0.3rem;"><i class="fas fa-bolt"></i> Pro Plan — Razorpay Payment</div>
                    <div style="font-size:0.75rem;color:var(--dim);"><i class="fas fa-info-circle"></i> Payment is handled via Razorpay Checkout. Organization will be auto-activated upon successful payment.</div>
                </div>` : ''}
            </div>
            <div class="org-actions">
                <span class="pill pill-pending">Pending</span>
                <span class="pill ${(p.planRequested || 'FREE') === 'PRO' ? 'pill-pro' : 'pill-free'}">${p.planRequested || 'FREE'}</span>
                <button class="btn btn-success btn-sm" onclick="openApprove('${p._id}', '${p.institute_name.replace(/'/g, "\\'")}')"><i class="fas fa-check"></i> Approve</button>
                <button class="btn btn-danger btn-sm" onclick="openReject('${p._id}', '${p.institute_name.replace(/'/g, "\\'")}')"><i class="fas fa-times"></i> Reject</button>
            </div>
        </div>
    `).join('');
}

// -- REVENUE & PAYMENT UPGRADES --
async function loadUpgrades() {
    try {
        const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
            fetch(`${API}/payments/requests?status=pending`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' }),
            fetch(`${API}/payments/requests?status=approved`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' }),
            fetch(`${API}/payments/requests?status=rejected`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
        ]);

        const [pendingData, approvedData, rejectedData] = await Promise.all([
            pendingRes.json(), approvedRes.json(), rejectedRes.json()
        ]);

        const pendingReqs = pendingData.requests || [];
        const approvedReqs = approvedData.requests || [];
        const rejectedReqs = rejectedData.requests || [];

        // Update Pending Approvals Stat Card
        if (document.getElementById('revPendingApprovals')) {
            animStat('revPendingApprovals', pendingReqs.length);
        }

        renderUpgrades(pendingReqs);
        renderApprovedPayments(approvedReqs);
        renderRejectedPayments(rejectedReqs);
    } catch (e) { console.error(e); }
}

function renderUpgrades(items) {
    const tbody = document.getElementById('upgradesTableBody');
    if (!tbody) return;
    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-arrow-up" style="font-size:2rem;opacity:0.3;"></i><p>No pending plan upgrades.</p></td></tr>`;
        return;
    }
    tbody.innerHTML = items.map(req => {
        const orgName = req.applicationId ? req.applicationId.institute_name : (req.organizationId ? req.organizationId.name : 'Unknown');
        const ownerName = req.applicationId ? req.applicationId.owner_name : (req.organizationId?.owner_id ? req.organizationId.owner_id.name : '');
        const ownerEmail = req.applicationId ? req.applicationId.owner_email : (req.organizationId?.owner_id ? req.organizationId.owner_id.email : '');
        return `
        <tr>
            <td>
                <div style="font-weight:500;">${orgName}</div>
                <div style="font-size:0.72rem;color:var(--dim);">${ownerName} - ${ownerEmail}</div>
            </td>
            <td><span class="pill ${req.planRequested === 'PRO' ? 'pill-pro' : req.planRequested === 'PLUS' ? 'pill-plus' : 'pill-free'}">${req.planRequested}</span></td>
            <td style="font-weight:600;">₹${req.amount}</td>
            <td style="font-family:monospace;color:var(--blue);">${req.transactionId}</td>
            <td style="color:var(--dim);font-size:0.8rem;">${new Date(req.createdAt).toLocaleDateString()}</td>
            <td>${req.screenshotUrl ? `<button class="btn btn-ghost btn-sm" onclick="viewScreenshot('${req.screenshotUrl}')"><i class="fas fa-image"></i> View</button>` : '<span style="color:var(--dim)"><i class="fas fa-times-circle"></i> None</span>'}</td>
            <td><span class="pill pill-pending">Pending Review</span></td>
            <td>
                <div style="display:flex;gap:0.4rem;">
                    <button class="btn btn-success btn-sm" onclick="openApproveUpgrade('${req._id}')" title="Approve"><i class="fas fa-check"></i> Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="openRejectUpgrade('${req._id}')" title="Reject"><i class="fas fa-times"></i> Reject</button>
                </div>
            </td>
        </tr>
    `}).join('');
}

function renderApprovedPayments(items) {
    const tbody = document.getElementById('approvedPaymentsTableBody');
    if (!tbody) return;
    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><p>No approved Pro organizations yet.</p></td></tr>`;
        return;
    }
    tbody.innerHTML = items.map(req => {
        const org = req.organizationId;
        const isRazorpay = org && (org.paymentMethod === 'razorpay' || org.razorpaySubscriptionId);
        const paymentLabel = isRazorpay ? 'Razorpay' : 'Manual / UPI';
        const paymentPillClass = isRazorpay ? 'pill-pro' : 'pill-free';
        const paymentIdDisplay = isRazorpay && org.razorpaySubscriptionId
            ? `<div style="font-size:0.7rem;color:var(--dim);font-family:monospace;margin-top:2px;" title="${org.razorpaySubscriptionId}">${org.razorpaySubscriptionId.substring(0, 18)}…</div>`
            : '';
        return `
        <tr>
            <td>
                <div style="font-weight:500;">${org ? org.name : req.applicationId?.institute_name || 'Unknown'}</div>
                <div style="font-size:0.72rem;color:var(--dim);">${org && org.owner_id ? org.owner_id.email : req.applicationId?.owner_email || ''}</div>
            </td>
            <td>${org && org.owner_id ? org.owner_id.name : req.applicationId?.owner_name || 'N/A'}</td>
            <td style="color:var(--dim);font-size:0.8rem;">${new Date(req.processedAt || req.updatedAt).toLocaleDateString()}</td>
            <td><span class="pill ${paymentPillClass}">${paymentLabel}</span>${paymentIdDisplay}</td>
            <td style="color:var(--dim);font-size:0.8rem;">${org && org.planExpiresAt ? new Date(org.planExpiresAt).toLocaleDateString() : 'N/A'}</td>
            <td style="font-weight:600;color:var(--green);">+₹${req.amount}</td>
        </tr>
    `}).join('');
}

function renderRejectedPayments(items) {
    const tbody = document.getElementById('rejectedPaymentsTableBody');
    if (!tbody) return;
    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state"><p>No rejected requests.</p></td></tr>`;
        return;
    }
    tbody.innerHTML = items.map(req => {
        const orgName = req.applicationId ? req.applicationId.institute_name : (req.organizationId ? req.organizationId.name : 'Unknown');
        const ownerEmail = req.applicationId ? req.applicationId.owner_email : (req.organizationId?.owner_id ? req.organizationId.owner_id.email : '');
        return `
        <tr>
            <td>
                <div style="font-weight:500;">${orgName}</div>
                <div style="font-size:0.72rem;color:var(--dim);">${ownerEmail}</div>
            </td>
            <td style="color:var(--dim);font-size:0.8rem;">${new Date(req.processedAt || req.updatedAt).toLocaleDateString()}</td>
            <td><span style="color:var(--red);font-size:0.85rem;"><i class="fas fa-info-circle"></i> Invalid proof of payment</span></td>
        </tr>
    `}).join('');
}

function viewScreenshot(url) {
    document.getElementById('screenshotImg').src = url;
    document.getElementById('screenshotModal').classList.add('active');
}

async function approveUpgrade(id) {
    openConfirmModal('Approve', 'Approve this payment and upgrade the organization?', async () => {
        try {
            const res = await fetch(`${API}/payments/approve/${id}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
            const data = await res.json();
            if (res.ok) { toast('Plan upgraded successfully!', 'success'); loadAllData(); }
            else { toast(data.message || 'Approval failed.', 'error'); }
        } catch (err) { toast('Connection error.', 'error'); }
    });
}

async function rejectUpgrade(id) {
    openConfirmModal('Reject', 'Reject this payment request?', async () => {
        try {
            const res = await fetch(`${API}/payments/reject/${id}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
            const data = await res.json();
            if (res.ok) { toast('Payment request rejected.', 'info'); loadAllData(); }
            else { toast(data.message || 'Rejection failed.', 'error'); }
        } catch (err) { toast('Connection error.', 'error'); }
    });
}

// -- NOTES REVIEW --
async function loadPendingNotes() {
    try {
        const orgFilter = document.getElementById('notesOrgFilter')?.value || '';
        const url = orgFilter ? `${API}/admin/notes/pending?org=${encodeURIComponent(orgFilter)}` : `${API}/admin/notes/pending`;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        const data = await res.json();
        const notes = Array.isArray(data) ? data : (data.notes || []);
        const pending = notes.filter(n => n.status === 'pending');
        const approved = notes.filter(n => n.status === 'approved');

        const pc = document.getElementById('pendingNotesCount');
        if (pc) pc.textContent = pending.length;
        const ac = document.getElementById('approvedNotesCount');
        if (ac) ac.textContent = approved.length;

        renderPendingNotes(pending);
        renderApprovedNotes(approved);
        populateNotesOrgFilter();
        updateModerationBadge();
    } catch (e) {
        console.error("Error loading notes:", e);
        renderPendingNotes([]); renderApprovedNotes([]);
    }
}

function populateNotesOrgFilter() {
    const select = document.getElementById('notesOrgFilter');
    if (!select || select.options.length > 1) return;
    allOrgs.forEach(org => {
        const opt = document.createElement('option');
        opt.value = org._id; opt.textContent = org.name;
        select.appendChild(opt);
    });
}

function renderPendingNotes(notes) {
    const tbody = document.getElementById('notesTableBody');
    if (!tbody) return;
    if (!notes || notes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-check-circle"></i><p>No notes pending review.</p></td></tr>`;
        return;
    }
    tbody.innerHTML = notes.map(n => `
        <tr>
            <td><div style="font-weight:600;color:var(--blue);">${esc(n.title)}</div>
                ${n.description ? `<div style="font-size:0.72rem;color:var(--dim);margin-top:2px;">${esc(n.description.substring(0, 60))}${n.description.length > 60 ? '...' : ''}</div>` : ''}</td>
            <td style="font-family:monospace;color:var(--muted);font-size:0.82rem;">${n.organization_id}</td>
            <td><div style="font-weight:500;">${esc(n.uploaded_by || 'Unknown')}</div></td>
            <td>${n.file_url ? `<a href="${n.file_url}" target="_blank" class="btn btn-ghost btn-sm"><i class="fas fa-external-link-alt"></i> PDF</a>` : '<span style="color:var(--dim)">No File</span>'}</td>
            <td style="color:var(--dim);font-size:0.78rem;">${new Date(n.created_at).toLocaleString()}</td>
            <td><div style="display:flex;gap:0.4rem;">
                <button class="btn btn-success btn-sm" onclick="approveNote('${n.id}')"><i class="fas fa-check"></i></button>
                <button class="btn btn-danger btn-sm" onclick="rejectNote('${n.id}')"><i class="fas fa-times"></i></button>
            </div></td>
        </tr>
    `).join('');
}

function renderApprovedNotes(notes) {
    const tbody = document.getElementById('approvedNotesTableBody');
    if (!tbody) return;
    if (!notes || notes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-folder-open"></i><p>No approved notes found.</p></td></tr>`;
        return;
    }
    tbody.innerHTML = notes.map(n => `
        <tr>
            <td><div style="font-weight:600;">${esc(n.title)}</div></td>
            <td style="font-family:monospace;color:var(--muted);font-size:0.82rem;">${n.organization_id}</td>
            <td>${esc(n.uploaded_by || 'Unknown')}</td>
            <td>${n.file_url ? `<a href="${n.file_url}" target="_blank" class="btn btn-ghost btn-sm"><i class="fas fa-external-link-alt"></i> PDF</a>` : '<span style="color:var(--dim)">No File</span>'}</td>
            <td style="color:var(--dim);font-size:0.78rem;">${new Date(n.created_at).toLocaleString()}</td>
            <td><span class="pill pill-approved">Approved</span></td>
        </tr>
    `).join('');
}

async function approveNote(id) {
    openConfirmModal('Approve Note', 'Approve this note? It will become visible to all members of its organization.', async () => {
        try {
            const res = await fetch(`${API}/admin/notes/${id}/approve`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
            const data = await res.json();
            if (res.ok) { toast('Note approved!', 'success'); loadPendingNotes(); }
            else { toast(data.message || 'Failed to approve.', 'error'); }
        } catch (err) { toast('Connection error.', 'error'); }
    });
}

async function rejectNote(id) {
    openConfirmModal('Reject Note', 'Reject and delete this note? This cannot be undone.', async () => {
        try {
            const res = await fetch(`${API}/admin/notes/${id}/reject`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
            const data = await res.json();
            if (res.ok) { toast('Note rejected.', 'info'); loadPendingNotes(); }
            else { toast(data.message || 'Failed to reject.', 'error'); }
        } catch (err) { toast('Connection error.', 'error'); }
    });
}

function esc(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
}

// -- SAFE STAT UPDATER � always sets value immediately, animates if UIAnim ready --
function animStat(elOrId, value) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    // Remove skeleton loading state from parent card
    const card = el.closest('.stat-card');
    if (card) card.classList.remove('loading');
    // Always set the value immediately so the ? never persists
    el.textContent = value;
    // Then run the count-up animation if UIAnim is available
    if (window.UIAnim && typeof UIAnim.animateValue === 'function') {
        UIAnim.animateValue(el, 0, parseFloat(value) || 0);
    }
}

// Add loading skeleton to all stat cards on page load (skip action cards with data-no-loading)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.stat-card:not([data-no-loading])').forEach((card, i) => {
        card.classList.add('loading');
        // Staggered entrance animation
        card.style.opacity = '0';
        card.style.transform = 'translateY(16px)';
        setTimeout(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1)';
            card.style.opacity = '';
            card.style.transform = '';
        }, 80 + i * 60);
    });
});


// -- ORGANIZATIONS --
async function loadOrgs() {
    try {
        const res = await fetch(`${API}/admin/all-organizations`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        allOrgs = await res.json();
        animStat('statOrgs', allOrgs.length);
        renderOrgs(allOrgs);
    } catch (e) { console.error(e); }
}


function renderOrgs(items) {
    const container = document.getElementById('orgList');
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-building"></i><p>No organizations found.</p></div>`;
        return;
    }
    container.innerHTML = `<div class="org-accordion">${items.map(o => {
        const plan = (o.plan || 'FREE').toUpperCase();
        const pillClass = plan === 'PRO' ? 'pill-pro' : plan === 'PLUS' ? 'pill-plus' : 'pill-free';
        const status = o.status || 'active';
        const statusPillClass = status === 'suspended' ? 'pill-suspended' : status === 'blocked' ? 'pill-blocked' : 'pill-active';
        const isActive = status === 'active';
        const logoHtml = o.logo_url
            ? `<img src="${o.logo_url}" alt="${o.name}">`
            : `<i class="fas fa-university" style="font-size:1.1rem;"></i>`;
        const ownerInfo = o.owner_id ? `${o.owner_id.name || 'N/A'} &mdash; ${o.owner_id.email || ''}` : 'No owner';
        const joined = new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        // Plan expiry info
        let expiryHtml = '';
        if (plan !== 'FREE' && o.planExpiresAt) {
            const expDate = new Date(o.planExpiresAt);
            const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const expiryColor = daysLeft <= 0 ? 'var(--red, #ef4444)' : daysLeft <= 3 ? 'var(--yellow, #f59e0b)' : 'var(--green, #22c55e)';
            const expiryLabel = daysLeft <= 0 ? 'EXPIRED' : `${daysLeft}d left`;
            expiryHtml = `
                <div class="org-acc-detail-item"><i class="fas fa-calendar-check"></i><span>Activated <strong>${o.planActivatedAt ? new Date(o.planActivatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</strong></span></div>
                <div class="org-acc-detail-item"><i class="fas fa-clock"></i><span>Expires <strong>${expDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> <span style="color:${expiryColor};font-weight:700;margin-left:6px;">(${expiryLabel})</span></span></div>
            `;
        } else if (plan === 'FREE') {
            expiryHtml = `<div class="org-acc-detail-item"><i class="fas fa-infinity"></i><span>No expiry (FREE plan)</span></div>`;
        }

        const actionBtns = isActive ? `
            <button class="org-action-btn act-warn"    onclick="suspendOrg('${o._id}')"><i class="fas fa-pause-circle"></i> Pause Org</button>
            <button class="org-action-btn act-danger"  onclick="blockOrg('${o._id}')"><i class="fas fa-ban"></i> Block Org</button>
        ` : `
            <button class="org-action-btn act-success" onclick="reactivateOrg('${o._id}')"><i class="fas fa-check-circle"></i> Reactivate</button>
        `;

        return `
        <div class="org-acc-card" id="org-card-${o._id}">
            <div class="org-acc-header" onclick="toggleOrgCard('${o._id}')">
                <div class="org-acc-logo">${logoHtml}</div>
                <div class="org-acc-info">
                    <div class="org-acc-name">${o.name}</div>
                    <div class="org-acc-meta">
                        <span class="pill ${pillClass}">${plan}</span>
                        <span class="pill ${statusPillClass}" style="font-size:0.62rem;">${status}</span>
                    </div>
                </div>
                <div class="org-acc-right">
                    <i class="fas fa-chevron-down org-acc-chevron"></i>
                </div>
            </div>
            <div class="org-acc-panel">
                <div class="org-acc-details">
                    <div class="org-acc-detail-item"><i class="fas fa-user-tie"></i><span>${ownerInfo}</span></div>
                    <div class="org-acc-detail-item"><i class="fas fa-calendar-alt"></i><span>Joined <strong>${joined}</strong></span></div>
                    <div class="org-acc-detail-item"><i class="fas fa-chalkboard-teacher"></i><span><strong>${o.facultyCount || 0}</strong> / ${o.faculty_limit} Faculty</span></div>
                    <div class="org-acc-detail-item"><i class="fas fa-users"></i><span><strong>${o.studentCount || 0}</strong> Students</span></div>
                    ${expiryHtml}
                </div>
                <div class="org-acc-actions-label"><i class="fas fa-bolt" style="margin-right:5px;color:var(--blue);"></i>Actions</div>
                <div class="org-acc-actions">
                    ${actionBtns}
                    <button class="org-action-btn act-danger"  onclick="openDeleteOrg('${o._id}', '${o.name.replace(/'/g, "\\'")}')" ><i class="fas fa-trash-alt"></i> Delete Org</button>
                    <button class="org-action-btn act-blue"    onclick="resetOrgPassword('${o._id}')"><i class="fas fa-key"></i> Reset Password</button>
                    <button class="org-action-btn act-purple"  onclick="openLimitModal('${o._id}', ${o.faculty_limit})"><i class="fas fa-edit"></i> Edit Faculty Limit</button>
                    <button class="org-action-btn act-warn"    onclick="openPlanModal('${o._id}', '${plan}')"><i class="fas fa-crown"></i> Change Plan</button>
                    <button class="org-action-btn act-cyan"    onclick="openUsageModal('${o._id}', '${o.name.replace(/'/g, "\\'")}')"><i class="fas fa-chart-pie"></i> Resource Usage</button>
                </div>
                <!-- Org Insight Panel (lazy loaded on expand) -->
                <div id="org-insight-${o._id}" class="org-insight-container"></div>
            </div>
        </div>`;
    }).join('')}</div>`;
}

function toggleOrgCard(id) {
    const card = document.getElementById('org-card-' + id);
    if (!card) return;
    const isOpen = card.classList.contains('expanded');
    // Close all other open cards
    document.querySelectorAll('.org-acc-card.expanded').forEach(c => c.classList.remove('expanded'));
    // Toggle this one
    if (!isOpen) {
        card.classList.add('expanded');
        // Lazy-load org insight panel
        loadOrgInsight(id);
    }
}



function filterOrgs() {
    const q = document.getElementById('orgSearch').value.toLowerCase();
    const planF = document.getElementById('orgPlanFilter')?.value || '';
    const statusF = document.getElementById('orgStatusFilter')?.value || '';
    renderOrgs(allOrgs.filter(o => {
        const matchName = o.name.toLowerCase().includes(q) || (o.owner_id && o.owner_id.email && o.owner_id.email.toLowerCase().includes(q));
        const matchPlan = !planF || (o.plan || 'FREE').toUpperCase() === planF;
        const matchStatus = !statusF || (o.status || 'active') === statusF;
        return matchName && matchPlan && matchStatus;
    }));
}

// -- USERS --
async function loadUsers() {
    try {
        const res = await fetch(`${API}/admin/all-users`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        allUsers = await res.json();
        // Calculate totals excluding super_admin from the 'Total Users' count
        const nonSuperAdmins = allUsers.filter(u => u.role !== 'super_admin');
        const orgAdminsCount = allUsers.filter(u => u.role === 'org_admin').length;

        animStat('statUsers', nonSuperAdmins.length);
        animStat('statFaculty', allUsers.filter(u => u.role === 'faculty').length);
        animStat('statStudents', allUsers.filter(u => u.role === 'student').length);
        animStat('statOrgAdmins', orgAdminsCount);

        // Org-level users only in the main users table
        const orgUsers = nonSuperAdmins;
        renderUsers(orgUsers);
        // Super admins get their own dedicated section
        if (typeof renderSuperAdmins === 'function') renderSuperAdmins(allUsers.filter(u => u.role === 'super_admin'));
    } catch (e) { console.error(e); }
}

function renderSuperAdmins(items) {
    const tbody = document.getElementById('superAdminsTableBody');
    if (!tbody) return;
    // Show Create button only for god user
    const btn = document.getElementById('createSuperAdminBtn');
    if (btn && currentUserObj?.email === 'nikhil.shinde@classgrid.in') btn.style.display = 'inline-flex';

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-shield-alt"></i><p>No system admins found.</p></td></tr>`;
        return;
    }
    tbody.innerHTML = items.map(u => {
        const status = u.status || 'active';
        const isGod = u.email === 'nikhil.shinde@classgrid.in';
        const roleLabel = u.role === 'super_admin' ? 'Super Admin' : 'Org Admin';
        const rolePill = u.role === 'super_admin' ? 'pill-admin' : 'pill-faculty';
        return `<tr>
            <td><div style="display:flex;align-items:center;gap:10px;">
                <img src="${u.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=1e3a5f&color=fff`}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;">
                <div><div style="font-weight:500;">${u.name}</div><div style="font-size:0.72rem;color:var(--dim);">${u.email}</div></div>
            </div></td>
            <td><span class="pill ${rolePill}">${roleLabel}</span>${isGod ? ' <span class="pill pill-admin" style="font-size:0.6rem;"><i class="fas fa-crown"></i> OWNER</span>' : ''}</td>
            <td style="color:var(--dim);font-size:0.78rem;">${new Date(u.createdAt).toLocaleDateString()}</td>
            <td style="color:var(--dim);font-size:0.78rem;">${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
            <td><span class="pill pill-${status}" style="font-size:0.62rem;">${status}</span></td>
            <td>${isGod ? '<span style="color:var(--dim);font-size:0.78rem;">Protected</span>' : `
                <div style="display:flex;gap:0.3rem;">
                    ${status === 'suspended' || status === 'blocked'
                    ? `<button class="btn btn-success btn-sm" onclick="reactivateUser('${u._id}')" title="Reactivate"><i class="fas fa-check"></i></button>`
                    : `<button class="btn btn-sm" style="background:var(--yellow-dim);color:var(--yellow);border:1px solid rgba(245,158,11,0.3);" onclick="suspendUser('${u._id}')" title="Suspend"><i class="fas fa-pause"></i></button>
                           <button class="btn btn-danger btn-sm" onclick="deleteUser('${u._id}')" title="Delete"><i class="fas fa-trash"></i></button>`}
                </div>`}
            </td>
        </tr>`;
    }).join('');
}

function renderUsers(items) {
    const tbody = document.getElementById('usersTableBody');
    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-users"></i><p>No users found</p></td></tr>`;
        return;
    }
    const pillMap = { org_admin: 'pill-admin', faculty: 'pill-faculty', student: 'pill-student', teacher: 'pill-faculty' };
    tbody.innerHTML = items.map((u, idx) => {
        const status = u.status || 'active';
        return `
        <tr>
            <td style="color:var(--dim);font-size:0.78rem;font-weight:600;text-align:center;">${idx + 1}</td>
            <td><div style="display:flex;align-items:center;gap:10px;">
                <img src="${u.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=1e3a5f&color=fff`}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;">
                <div><div style="font-weight:500;">${u.name}</div><div style="font-size:0.72rem;color:var(--dim);">${u.email}</div></div>
            </div></td>
            <td><span class="pill ${pillMap[u.role] || ''}">${u.role.replace('_', ' ')}</span></td>
            <td>${u.organization_id ? (u.organization_id.name || 'N/A') : '<span style="color:var(--dim)">None</span>'}</td>
            <td style="color:var(--dim);font-size:0.78rem;">${new Date(u.createdAt).toLocaleDateString()}</td>
            <td style="color:var(--dim);font-size:0.78rem;">${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
            <td><span class="pill pill-${status}" style="font-size:0.62rem;">${status}</span></td>
            <td>
                <div style="display:flex;gap:0.3rem;">
                    ${status === 'suspended' || status === 'blocked'
                ? `<button class="btn btn-success btn-sm" onclick="reactivateUser('${u._id}')" title="Reactivate"><i class="fas fa-check"></i></button>`
                : `<button class="btn btn-sm" style="background:var(--yellow-dim);color:var(--yellow);border:1px solid rgba(245,158,11,0.3);" onclick="suspendUser('${u._id}')" title="Suspend"><i class="fas fa-pause"></i></button>
                       <button class="btn btn-danger btn-sm" onclick="deleteUser('${u._id}')" title="Delete"><i class="fas fa-trash"></i></button>`}
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterUsers() {
    const q = document.getElementById('userSearch').value.toLowerCase();
    const role = document.getElementById('roleFilter').value;
    const statusF = document.getElementById('userStatusFilter')?.value || '';
    const orgUsers = allUsers.filter(u => u.role !== 'super_admin');
    renderUsers(orgUsers.filter(u => {
        const matchName = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        const matchRole = !role || u.role === role;
        const matchStatus = !statusF || (u.status || 'active') === statusF;
        return matchName && matchRole && matchStatus;
    }));
}

// -- ORG INSIGHT (loads inside expanded accordion card) --
async function loadOrgInsight(orgId) {
    const panelId = `org-insight-${orgId}`;
    const existingPanel = document.getElementById(panelId);
    if (existingPanel && existingPanel.dataset.loaded === 'true') return; // Already loaded

    const container = document.getElementById(panelId);
    if (!container) return;
    container.innerHTML = `<div class="spinner" style="margin:1rem auto;"></div>`;

    try {
        const res = await fetch(`${API}/admin/org-insight/${orgId}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        const data = await res.json();
        container.dataset.loaded = 'true';

        container.innerHTML = `
        <div style="border-top:1px solid var(--border);margin-top:1rem;padding-top:1rem;">
            <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--dim);margin-bottom:0.75rem;"><i class="fas fa-sitemap" style="margin-right:5px;color:var(--blue);"></i>Academic Structure</div>
            <div class="org-insight-stats">
                <div class="insight-stat"><div class="insight-stat-num">${data.totalFaculty}</div><div class="insight-stat-label"><i class="fas fa-chalkboard-teacher"></i> Faculty</div></div>
                <div class="insight-stat"><div class="insight-stat-num">${data.totalStudents}</div><div class="insight-stat-label"><i class="fas fa-users"></i> Students</div></div>
                <div class="insight-stat"><div class="insight-stat-num">${data.totalClassrooms}</div><div class="insight-stat-label"><i class="fas fa-door-open"></i> Classrooms</div></div>
            </div>
            ${data.faculty.length === 0 ? `<div style="color:var(--dim);font-size:0.82rem;text-align:center;padding:1rem;">No faculty in this organization yet.</div>` :
                data.faculty.map(f => `
            <div class="faculty-insight-row">
                <div class="faculty-insight-header">
                    <img src="${f.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.name)}&background=1e3a5f&color=fff`}"
                         style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--border);">
                    <div>
                        <div style="font-weight:600;font-size:0.85rem;">${esc(f.name)}</div>
                        <div style="font-size:0.72rem;color:var(--dim);">${esc(f.email)}${f.department ? ` � ${esc(f.department)}` : ''}</div>
                    </div>
                    <span class="pill pill-faculty" style="margin-left:auto;font-size:0.6rem;">${f.classrooms.length} class${f.classrooms.length !== 1 ? 'es' : ''}</span>
                </div>
                ${f.classrooms.length > 0 ? `
                <div class="faculty-classrooms">
                    ${f.classrooms.map(c => `
                    <div class="faculty-classroom-item ${c.isArchived ? 'archived' : ''}">
                        <i class="fas fa-door-open" style="color:${c.isArchived ? 'var(--dim)' : 'var(--blue)'}"></i>
                        <span>${esc(c.name)}<span style="color:var(--dim);font-size:0.75rem;"> � ${esc(c.subject)}</span></span>
                        <span class="pill" style="font-size:0.6rem;background:var(--elevated);color:var(--muted);">${c.memberCount} students</span>
                        ${c.isArchived ? '<span style="font-size:0.65rem;color:var(--dim);">[archived]</span>' : ''}
                    </div>`).join('')}
                </div>` : `<div style="font-size:0.78rem;color:var(--dim);padding:0.4rem 0 0 2.5rem;">No classrooms yet</div>`}
            </div>`).join('')}
        </div>`;
    } catch (e) {
        container.innerHTML = `<div style="color:var(--red);font-size:0.82rem;padding:0.5rem 0;">Failed to load org insight.</div>`;
    }
}

// -- API METRICS --
async function loadApiMetrics() {
    // Set loading state
    ['mTotalReq', 'mSuccessReq', 'mClientErr', 'mServerErr', 'mErrorRate', 'mAvgResp', 'mRpm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });
    const tbody = document.getElementById('apiTopRoutesBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;"><div class="spinner"></div></td></tr>`;

    try {
        const res = await fetch(`${API}/admin/api-metrics`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        renderApiMetrics(data);
    } catch (e) {
        const hLabel = document.getElementById('healthLabel');
        if (hLabel) hLabel.textContent = 'Error loading metrics';
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-exclamation-circle" style="color:var(--red)"></i><p>Could not load API metrics.</p></td></tr>`;
    }
}

function renderApiMetrics(data) {
    // Health indicator
    const healthColors = { healthy: 'var(--green)', warning: 'var(--yellow)', critical: 'var(--red)' };
    const healthLabels = { healthy: 'Healthy', warning: 'Warning', critical: 'Critical' };
    const dot = document.getElementById('healthDot');
    const label = document.getElementById('healthLabel');
    if (dot) dot.style.background = healthColors[data.health] || 'var(--dim)';
    if (label) label.textContent = healthLabels[data.health] || data.health;

    // Health bar background
    const bar = document.getElementById('apiHealthBar');
    if (bar) bar.dataset.health = data.health;

    // Stats
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('mTotalReq', data.totalRequests.toLocaleString());
    set('mSuccessReq', data.successCount.toLocaleString());
    set('mClientErr', data.clientErrCount.toLocaleString());
    set('mServerErr', data.serverErrCount.toLocaleString());
    set('mErrorRate', data.errorRate + '%');
    set('mAvgResp', data.avgRespMs + 'ms');
    set('mRpm', data.requestsPerMinute);

    // Top Routes table
    const tbody = document.getElementById('apiTopRoutesBody');
    if (tbody) {
        if (!data.topRoutes || data.topRoutes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-wave-square"></i><p>No requests tracked yet. Data appears after the first API call is made.</p></td></tr>`;
        } else {
            tbody.innerHTML = data.topRoutes.map(r => {
                const errF = parseFloat(r.errorRate);
                const health = errF > 10 ? 'critical' : errF > 3 ? 'warning' : 'healthy';
                const hColor = { healthy: 'var(--green)', warning: 'var(--yellow)', critical: 'var(--red)' }[health];
                const respColor = r.avgRespMs > 2000 ? 'var(--red)' : r.avgRespMs > 800 ? 'var(--yellow)' : 'var(--green)';
                return `<tr>
                    <td style="font-family:monospace;font-size:0.8rem;color:var(--blue);">${esc(r.route)}</td>
                    <td style="font-weight:600;">${r.requests.toLocaleString()}</td>
                    <td style="color:${errF > 0 ? 'var(--red)' : 'var(--green)'};">${r.errorRate}%</td>
                    <td style="color:${respColor};">${r.avgRespMs}ms</td>
                    <td><span class="pill" style="background:${hColor}22;color:${hColor};border:1px solid ${hColor}44;font-size:0.62rem;">${health}</span></td>
                </tr>`;
            }).join('');
        }
    }

    // Failures log
    const failLog = document.getElementById('apiFailuresLog');
    if (failLog) {
        if (!data.recentFailures || data.recentFailures.length === 0) {
            failLog.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--green);font-size:1.5rem;margin-bottom:0.5rem;"></i><p>No failures recorded. All systems healthy!</p></div>`;
        } else {
            failLog.innerHTML = data.recentFailures.map(f => `
            <div class="api-failure-row">
                <span class="pill" style="background:var(--red-dim);color:var(--red);border:none;font-size:0.65rem;">${f.statusCode}</span>
                <span style="font-family:monospace;font-size:0.8rem;color:var(--muted);flex:1;">${esc(f.errorMessage)}</span>
                <span style="font-size:0.72rem;color:var(--dim);white-space:nowrap;">${new Date(f.timestamp).toLocaleString()}</span>
            </div>`).join('');
        }
    }
}



// -- OVERVIEW STATS --
function updateOverviewStats() {
    const free = allOrgs.filter(o => !o.plan || o.plan.toUpperCase() === 'FREE' || o.plan.toUpperCase() === 'PLUS').length;
    const pro = allOrgs.filter(o => o.plan && o.plan.toUpperCase() === 'PRO').length;
    const el = document.getElementById('statPlanSplit');
    if (el) {
        el.textContent = `${free} / ${pro}`;
        const card = el.closest('.stat-card');
        if (card) card.classList.remove('loading');
    }
}

// -- ANALYTICS --
function updateAnalytics() {
    const el = id => document.getElementById(id);
    const nonSuperAdminCount = allUsers.filter(u => u.role !== 'super_admin').length;
    if (el('analyticsUserGrowth')) el('analyticsUserGrowth').textContent = `${nonSuperAdminCount} total users registered`;
    if (el('analyticsOrgGrowth')) el('analyticsOrgGrowth').textContent = `${allOrgs.length} total organizations`;
    if (el('analyticsTotalAdmins')) el('analyticsTotalAdmins').textContent = allUsers.filter(u => u.role === 'super_admin').length;
    if (el('analyticsTotalFaculty')) el('analyticsTotalFaculty').textContent = allUsers.filter(u => u.role === 'faculty').length;
    if (el('analyticsTotalStudents')) el('analyticsTotalStudents').textContent = allUsers.filter(u => u.role === 'student').length;
    if (el('analyticsTotalOrgAdmins')) el('analyticsTotalOrgAdmins').textContent = allUsers.filter(u => u.role === 'org_admin').length;

    // Top organizations by student count
    const topOrgs = [...allOrgs].sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0)).slice(0, 5);
    const topContainer = el('analyticsTopOrgs');
    if (topContainer) {
        topContainer.innerHTML = topOrgs.length === 0
            ? '<div class="info-row"><span>No data yet</span><span>—</span></div>'
            : topOrgs.map(o => `<div class="info-row"><span>${o.name}</span><span>${o.studentCount || 0} students</span></div>`).join('');
    }
}

// -- REVENUE STATS --
function updateRevenue() {
    const el = id => document.getElementById(id);
    const now = new Date();

    // 1. Total active Pro Orgs
    const proOrgs = allOrgs.filter(o => {
        if (!o.plan || o.plan.toUpperCase() !== 'PRO' || o.status === 'suspended') return false;
        if (o.planExpiresAt && new Date(o.planExpiresAt) <= now) return false;
        return true;
    });
    const proCount = proOrgs.length;

    // 2. Total Revenue
    const totalRevenue = proCount * 100; // ₹100 per org

    // 3. This Month Revenue
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyProOrgs = proOrgs.filter(o => {
        if (!o.planActivatedAt) return false;
        const activatedDate = new Date(o.planActivatedAt);
        return activatedDate >= startOfMonth;
    });
    const monthlyRevenue = monthlyProOrgs.length * 100;

    // Output to DOM
    if (el('revProOrgs')) animStat('revProOrgs', proCount);
    if (el('revTotalRevenue')) {
        const tr = el('revTotalRevenue');
        tr.textContent = totalRevenue === 0 ? '₹0' : `₹${totalRevenue.toLocaleString('en-IN')}`;
        const c = tr.closest('.stat-card');
        if (c) c.classList.remove('loading');
    }
    if (el('revMonthlyRevenue')) {
        const mr = el('revMonthlyRevenue');
        mr.textContent = monthlyRevenue === 0 ? '₹0' : `₹${monthlyRevenue.toLocaleString('en-IN')}`;
        const c = mr.closest('.stat-card');
        if (c) c.classList.remove('loading');
    }
}

// -- SECURITY --
function updateSecurity() {
    const el = id => document.getElementById(id);
    if (el('secTotalAdmins')) el('secTotalAdmins').textContent = allUsers.filter(u => u.role === 'super_admin').length;
    if (el('secSuspendedOrgs')) el('secSuspendedOrgs').textContent = allOrgs.filter(o => o.status === 'suspended').length;
    if (el('secBlockedUsers')) el('secBlockedUsers').textContent = allUsers.filter(u => u.status === 'blocked').length;
    if (el('secActiveSessions')) el('secActiveSessions').textContent = allUsers.length; // Approximate
}

// -- SYSTEM --
function updateSystem() {
    const el = id => document.getElementById(id);
    if (el('sysOrgs')) el('sysOrgs').textContent = allOrgs.length;
    if (el('sysUsers')) el('sysUsers').textContent = allUsers.length;
}

// -- MODERATION BADGE --
function updateModerationBadge() {
    const pending = parseInt(document.getElementById('statPending')?.textContent || '0');
    const pendingNotes = parseInt(document.getElementById('pendingNotesCount')?.textContent || '0');
    const total = pending + pendingNotes;
    const badge = document.getElementById('moderationBadge');
    if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'inline-block' : 'none'; }
}

// -- APPROVE / REJECT MODALS --
function openApprove(id, name) {
    pendingActionId = id;
    document.getElementById('approveOrgName').textContent = name;
    document.getElementById('approveModal').classList.add('active');
}
function openReject(id, name) {
    pendingActionId = id;
    document.getElementById('rejectOrgName').textContent = name;
    if (document.getElementById('rejectReasonInput')) document.getElementById('rejectReasonInput').value = '';
    document.getElementById('rejectModal').classList.add('active');
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); pendingActionId = null; }

async function confirmApprove() {
    if (!pendingActionId) return;
    const btn = document.getElementById('approveConfirmBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Processing...';
    try {
        const res = await fetch(`${API}/admin/approve-organization/${pendingActionId}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (res.ok) { toast('Organization approved! Activation email sent.', 'success'); closeModal('approveModal'); loadAllData(); }
        else { toast(data.message || 'Approval failed.', 'error'); }
    } catch (e) { toast('Connection error.', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span>Approve</span><i class="fas fa-check"></i>'; }
}

async function confirmReject() {
    if (!pendingActionId) return;
    const btn = document.getElementById('rejectConfirmBtn');
    const reason = document.getElementById('rejectReasonInput')?.value || '';
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Processing...';
    try {
        const res = await fetch(`${API}/admin/reject-organization/${pendingActionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (res.ok) { toast('Application rejected.', 'info'); closeModal('rejectModal'); loadAllData(); }
        else { toast(data.message || 'Rejection failed.', 'error'); }
    } catch (e) { toast('Connection error.', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span>Reject</span><i class="fas fa-ban"></i>'; }
}

// Close modals on backdrop click
document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) { m.classList.remove('active'); pendingActionId = null; } });
});

// -- ORG ACTIONS --
async function runOrgAction(actionUrl, confirmMsg, successMsg) {
    openConfirmModal('Confirm', confirmMsg, async () => {
        try {
            const res = await fetch(actionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            const data = await res.json();
            if (res.ok) { toast(successMsg || data.message, 'success'); loadAllData(); }
            else { toast(data.message || 'Action failed', 'error'); }
        } catch (err) { toast('Connection error', 'error'); }
    });
}

function suspendOrg(id) { runOrgAction(`${API}/admin/suspend-organization/${id}`, 'Suspend this organization?', 'Organization suspended'); }
function blockOrg(id) { runOrgAction(`${API}/admin/block-organization/${id}`, 'Block this organization?', 'Organization blocked'); }
function reactivateOrg(id) { runOrgAction(`${API}/admin/reactivate-organization/${id}`, 'Reactivate this organization?', 'Organization reactivated'); }

// -- DELETE ORG --
let deleteOrgTargetId = null;
function openDeleteOrg(id, name) {
    deleteOrgTargetId = id;
    document.getElementById('deleteOrgName').textContent = name;
    document.getElementById('deleteConfirmInput').value = '';
    checkDeleteInput();
    document.getElementById('deleteOrgModal').classList.add('active');
}
function checkDeleteInput() {
    const btn = document.getElementById('deleteConfirmBtn');
    const val = document.getElementById('deleteConfirmInput').value.trim();
    if (val === 'DELETE') {
        btn.disabled = false; btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
        btn.style.color = '#fff'; btn.style.cursor = 'pointer'; btn.style.opacity = '1';
    } else {
        btn.disabled = true; btn.style.background = 'linear-gradient(135deg,#444,#333)';
        btn.style.color = '#888'; btn.style.cursor = 'not-allowed'; btn.style.opacity = '0.6';
    }
}
async function confirmDelete() {
    if (!deleteOrgTargetId) return;
    const btn = document.getElementById('deleteConfirmBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Deleting...';
    try {
        const res = await fetch(`${API}/admin/delete-organization/${deleteOrgTargetId}`, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (res.ok) { toast(`? ${data.message}`, 'success'); closeModal('deleteOrgModal'); loadAllData(); }
        else { toast(data.message || 'Delete failed', 'error'); }
    } catch (e) { toast('Connection error', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span><i class="fas fa-trash"></i> Delete Permanently</span>'; deleteOrgTargetId = null; }
}

function resetOrgPassword(id) { runOrgAction(`${API}/admin/reset-admin-password/${id}`, 'Send password reset to this org admin?', 'Reset instructions sent'); }

// -- FACULTY LIMIT MODAL (replaces prompt) --
function openLimitModal(id, currentLimit) {
    limitTargetId = id;
    document.getElementById('newLimitInput').value = currentLimit;
    document.getElementById('limitModal').classList.add('active');
}
async function confirmUpdateLimit() {
    const newLimit = document.getElementById('newLimitInput').value;
    if (!newLimit || isNaN(newLimit)) { toast('Enter a valid number', 'error'); return; }
    const btn = document.getElementById('limitConfirmBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Updating...';
    try {
        const res = await fetch(`${API}/admin/update-faculty-limit/${limitTargetId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: parseInt(newLimit, 10) })
        });
        if (res.ok) { toast('Faculty limit updated', 'success'); closeModal('limitModal'); loadAllData(); }
        else { toast('Update failed', 'error'); }
    } catch (err) { toast('Connection error', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span>Update Limit</span>'; }
}

// -- CHANGE PLAN MODAL (replaces prompt) --
function openPlanModal(id, currentPlan) {
    planTargetId = id;
    document.getElementById('planCurrentLabel').textContent = currentPlan;
    document.getElementById('newPlanSelect').value = currentPlan;
    document.getElementById('planModal').classList.add('active');
}
async function confirmChangePlan() {
    const plan = document.getElementById('newPlanSelect').value;
    try {
        const res = await fetch(`${API}/admin/update-plan/${planTargetId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan })
        });
        const data = await res.json();
        if (res.ok) { toast(`Plan updated to ${plan}!`, 'success'); closeModal('planModal'); loadAllData(); }
        else { toast(data.message || 'Failed to update plan', 'error'); }
    } catch (err) { toast('Connection error', 'error'); }
}

// -- USER ACTIONS (Modal-based) --
let suspendUserTargetId = null;
let deleteUserTargetId = null;

function suspendUser(id) {
    suspendUserTargetId = id;
    document.getElementById('suspendReasonInput').value = '';
    document.getElementById('suspendUserModal').classList.add('active');
}

async function confirmSuspendUser() {
    if (!suspendUserTargetId) return;
    const reason = document.getElementById('suspendReasonInput').value.trim();
    if (!reason) { toast('Please enter a reason for suspension', 'error'); return; }
    const btn = document.getElementById('suspendUserConfirmBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Suspending...';
    try {
        const res = await fetch(`${API}/admin/suspend-user/${suspendUserTargetId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (res.ok) { toast('? User suspended. Email notification sent.', 'success'); closeModal('suspendUserModal'); loadAllData(); }
        else { toast(data.message || 'Suspension failed', 'error'); }
    } catch (err) { toast('Connection error', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span><i class="fas fa-pause-circle"></i> Suspend User</span>'; suspendUserTargetId = null; }
}

function reactivateUser(id) {
    openConfirmModal('Reactivate User', 'Reactivate this user? They will regain access to Classgrid.', async () => {
        try {
            const res = await fetch(`${API}/admin/reactivate-user/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok) { toast('? User reactivated', 'success'); loadAllData(); }
            else { toast(data.message || 'Reactivation failed', 'error'); }
        } catch (err) { toast('Connection error', 'error'); }
    });
}

function deleteUser(id) {
    deleteUserTargetId = id;
    document.getElementById('deleteUserReasonInput').value = '';
    document.getElementById('deleteUserConfirmInput').value = '';
    checkDeleteUserInput();
    document.getElementById('deleteUserModal').classList.add('active');
}

function checkDeleteUserInput() {
    const btn = document.getElementById('deleteUserConfirmBtn');
    const val = document.getElementById('deleteUserConfirmInput').value.trim();
    const reason = document.getElementById('deleteUserReasonInput').value.trim();
    if (val === 'DELETE' && reason.length > 0) {
        btn.disabled = false; btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
        btn.style.color = '#fff'; btn.style.cursor = 'pointer'; btn.style.opacity = '1';
    } else {
        btn.disabled = true; btn.style.background = 'linear-gradient(135deg,#444,#333)';
        btn.style.color = '#888'; btn.style.cursor = 'not-allowed'; btn.style.opacity = '0.6';
    }
}

async function confirmDeleteUser() {
    if (!deleteUserTargetId) return;
    const reason = document.getElementById('deleteUserReasonInput').value.trim();
    if (!reason) { toast('Reason is required', 'error'); return; }
    const btn = document.getElementById('deleteUserConfirmBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Deleting...';
    try {
        const res = await fetch(`${API}/admin/delete-user/${deleteUserTargetId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (res.ok) { toast('? User permanently deleted', 'success'); closeModal('deleteUserModal'); loadAllData(); }
        else { toast(data.message || 'Delete failed', 'error'); }
    } catch (err) { toast('Connection error', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span><i class="fas fa-trash"></i> Delete Permanently</span>'; deleteUserTargetId = null; }
}

// -- CREATE SUPER ADMIN --
function openCreateSuperAdminModal() { document.getElementById('createSuperAdminModal').classList.add('active'); }
async function confirmCreateSuperAdmin() {
    const name = document.getElementById('newAdminName').value.trim();
    const email = document.getElementById('newAdminEmail').value.trim();
    const password = document.getElementById('newAdminPassword').value.trim();
    if (!name || !email || !password) { toast('Please fill all fields', 'error'); return; }
    const btn = document.getElementById('createAdminConfirmBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Creating...';
    try {
        const res = await fetch(`${API}/admin/create-super-admin`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (res.ok) {
            toast('Super Admin created!', 'success'); closeModal('createSuperAdminModal'); loadAllData();
            document.getElementById('newAdminName').value = '';
            document.getElementById('newAdminEmail').value = '';
            document.getElementById('newAdminPassword').value = '';
        } else { toast(data.message || 'Creation failed', 'error'); }
    } catch (err) { toast('Connection error', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<span>Create Admin</span><i class="fas fa-plus"></i>'; }
}

// -- EXPORT CSV --
function exportOrgsCSV() {
    if (allOrgs.length === 0) { toast('No organizations to export', 'info'); return; }
    const headers = ['Name', 'Plan', 'Faculty', 'Students', 'Status', 'Created'];
    const rows = allOrgs.map(o => [
        `"${o.name}"`, (o.plan || 'FREE').toUpperCase(),
        o.facultyCount || 0, o.studentCount || 0, o.status || 'active',
        new Date(o.createdAt).toLocaleDateString()
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `classgrid-organizations-${Date.now()}.csv`;
    a.click(); toast('CSV exported!', 'success');
}

// -- TOGGLE SWITCH --
async function togglePlatformSetting(settingKey) {
    const elId = {
        'maintenanceMode': 'toggleMaintenance',
        'disableRegistrations': 'toggleRegistrations',
        'globalLock': 'toggleLock',
        'aiFeatures': 'toggleAIFeatures',
        'notesSystem': 'toggleNotesSystem',
        'chatSystem': 'toggleChatSystem'
    }[settingKey];

    const el = document.getElementById(elId);
    if (!el) return;

    const isCurrentlyOn = el.classList.contains('on');
    const newValue = !isCurrentlyOn;

    // Optimistic UI update
    el.classList.toggle('on');

    try {
        const payload = {};
        payload[settingKey] = newValue;

        const res = await fetch(`${API}/admin/system-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Failed to update setting');
        toast('Setting updated successfully', 'success');
    } catch (err) {
        // Revert UI on failure
        el.classList.toggle('on');
        toast('Failed to update setting', 'error');
    }
}

async function loadSystemSettings() {
    try {
        const res = await fetch(`${API}/admin/system-settings`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        const applyToggle = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                if (value) el.classList.add('on');
                else el.classList.remove('on');
            }
        };

        applyToggle('toggleMaintenance', data.maintenanceMode);
        applyToggle('toggleRegistrations', data.disableRegistrations);
        applyToggle('toggleLock', data.globalLock);
        applyToggle('toggleAIFeatures', data.aiFeatures);
        applyToggle('toggleNotesSystem', data.notesSystem);
        applyToggle('toggleChatSystem', data.chatSystem);

    } catch (e) {
        console.error("Failed to load settings", e);
    }
}

// -- USAGE MODAL & EXTENDED ANALYTICS --
async function openUsageModal(id, name) {
    if (window.UIAnim) { UIAnim.animateValue(document.getElementById('usageOrgName'), 0, parseFloat(name) || 0); } else { document.getElementById('usageOrgName').textContent = name; }
    document.getElementById('usageDataState').style.display = 'none';
    document.getElementById('usageLoadingState').style.display = 'flex';
    document.getElementById('usageModal').classList.add('active');

    try {
        const [usageRes, emailRes] = await Promise.all([
            fetch(`${API}/admin/usage/${id}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' }),
            fetch(`${API}/admin/email-analytics?orgId=${id}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
        ]);

        if (!usageRes.ok || !emailRes.ok) throw new Error('Data fetch failed');

        const usageData = await usageRes.json();
        const emailData = await emailRes.json();

        const el = id => document.getElementById(id);

        el('usageStorageMB').textContent = usageData.storage.mb + ' MB';
        el('usageNotesMB').textContent = usageData.storage.mb + ' MB'; // Only notes consume storage right now
        el('usageNotesFileCount').textContent = usageData.storage.fileCount;
        el('usageNotesDBCount').textContent = usageData.db.notesCount;

        el('usageEmailTotal').textContent = emailData.total;
        el('usageEmailToday').textContent = emailData.daily;
        el('usageEmailMonth').textContent = emailData.monthly;

        const breakdownSection = el('usageEmailBreakdown');
        const types = emailData.typeBreakdown || {};
        breakdownSection.innerHTML = Object.keys(types).map(k => {
            return `<div style="display:flex;justify-content:space-between;background:var(--bg);padding:8px;border-radius: 4px;font-size:0.85rem;">
                <span style="text-transform:capitalize;color:var(--dim);">${k.replace('_', ' ')}</span>
                <span style="font-weight:600;">${types[k]}</span>
            </div>`;
        }).join('');

    } catch (err) {
        toast('Failed to load usage data.', 'error');
    } finally {
        document.getElementById('usageLoadingState').style.display = 'none';
        document.getElementById('usageDataState').style.display = 'block';
    }
}

// -- HAMBURGER / SIDEBAR --
const ham = document.getElementById('hamBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
ham.addEventListener('click', () => { ham.classList.toggle('open'); sidebar.classList.toggle('open'); overlay.classList.toggle('show'); });
overlay.addEventListener('click', () => { ham.classList.remove('open'); sidebar.classList.remove('open'); overlay.classList.remove('show'); });

// -- SCROLL PROGRESS & BACK TO TOP --
const progressBar = document.getElementById('progressBar');
const backTop = document.getElementById('backTop');
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.width = (scrollTop / docH * 100) + '%';
    if (backTop) backTop.classList.toggle('show', scrollTop > 300);
}, { passive: true });

// -- SECTION REVEAL ANIMATION --
const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.cmd-section').forEach(el => io.observe(el));

/* 
   GLOBAL STUDENT PERFORMANCE (Super Admin � all orgs)
   - */
async function loadGlobalStudentPerformance() {
    const container = document.getElementById('globalTopStudentsContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--dim);"><div class="spinner"></div></div>';

    try {
        const res = await fetch(`${API}/admin/student-performance`, {
            credentials: 'include', headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            container.innerHTML = '<p style="color:var(--dim);padding:1rem;">Could not load performance data.</p>';
            return;
        }
        const { students, totalStudents, cached } = await res.json();

        if (!students || students.length === 0) {
            container.innerHTML = '<p style="color:var(--dim);text-align:center;padding:1rem;">No student data yet across any organization.</p>';
            return;
        }

        const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
        container.innerHTML = `
            ${cached ? '<div style="font-size:0.75rem;color:var(--dim);margin-bottom:8px;"><i class="fas fa-clock" style="margin-right:4px;"></i>Cached � refreshes every 10 min</div>' : ''}
            <div style="overflow-x:auto;">
            <table>
                <thead><tr>
                    <th style="width:40px;">#</th>
                    <th>Student</th>
                    <th>Organization</th>
                    <th>Score</th>
                    <th>Quiz</th>
                    <th>Attend</th>
                    <th>Notes</th>
                    <th>Activity</th>
                </tr></thead>
                <tbody>
                ${students.map((s, i) => {
            const medal = i < 3 ? ['', '', ''][i] + ' ' : '';
            const bar = `<div style="background:var(--elevated);border-radius: 4px;height:6px;width:64px;display:inline-block;vertical-align:middle;overflow:hidden;"><div style="background:var(--blue);height:100%;width:${s.engagementScore}%;border-radius: 4px;"></div></div>`;
            const scoreColor = s.engagementScore >= 70 ? 'var(--green)' : s.engagementScore >= 40 ? 'var(--amber)' : 'var(--red)';
            return `<tr>
                        <td style="font-weight:700;color:var(--dim);">${medal}${s.rank}</td>
                        <td>
                            <div style="font-weight:600;">${esc(s.name)}</div>
                            <div style="font-size:0.72rem;color:var(--dim);">${esc(s.email)}</div>
                        </td>
                        <td style="font-size:0.82rem;color:var(--muted);">${esc(s.organizationName || '�')}</td>
                        <td>
                            <div style="display:flex;align-items:center;gap:6px;">
                                ${bar}<span style="font-weight:700;color:${scoreColor};">${s.engagementScore}</span>
                            </div>
                        </td>
                        <td style="color:${s.quizAvg >= 60 ? 'var(--green)' : 'var(--amber)'};">${s.quizAttempts > 0 ? s.quizAvg + '%' : '�'}</td>
                        <td style="color:${s.attendanceRate >= 75 ? 'var(--green)' : s.attendanceRate >= 50 ? 'var(--amber)' : 'var(--red)'};">${s.attendanceRate}%</td>
                        <td>${s.notesCount || 0}</td>
                        <td style="color:var(--muted);">${s.activityCount}</td>
                    </tr>`;
        }).join('')}
                </tbody>
            </table>
            </div>
            <div style="font-size:0.75rem;color:var(--dim);margin-top:8px;text-align:right;">Top ${students.length} of ${totalStudents} students platform-wide</div>
        `;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--dim);padding:1rem;">Error loading performance data.</p>';
    }
}

/* 
   GLOBAL AUDIT LOG (Super Admin � all orgs)
    */
async function loadGlobalAuditLog() {
    const tbody = document.getElementById('globalAuditLogBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;"><div class="spinner"></div></td></tr>';

    // Auto-populate org filter if needed
    const orgSelect = document.getElementById('globalAuditOrgFilter');
    if (orgSelect && orgSelect.options.length <= 1 && allOrgs.length > 0) {
        allOrgs.forEach(org => {
            const opt = document.createElement('option');
            opt.value = org._id;
            opt.textContent = org.name;
            orgSelect.appendChild(opt);
        });
    }

    const orgFilter = orgSelect?.value || '';
    const actionFilter = document.getElementById('globalAuditActionFilter')?.value || '';
    const params = new URLSearchParams();
    if (orgFilter) params.set('org', orgFilter);
    if (actionFilter) params.set('action', actionFilter);
    const qs = params.toString() ? '?' + params.toString() : '';

    try {
        const res = await fetch(`${API}/admin/audit-log${qs}`, {
            credentials: 'include', headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:2rem;">Error loading audit log.</td></tr>';
            return;
        }
        const { logs } = await res.json();

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:2rem;"><i class="fas fa-history" style="font-size:1.5rem;display:block;margin-bottom:8px;"></i>No audit records yet. Admin actions will appear here.</td></tr>';
            return;
        }

        const actionLabels = {
            add_faculty: 'Add Faculty', remove_faculty: 'Remove Faculty', remove_student: 'Remove Student',
            change_role: 'Change Role', archive_classroom: 'Archive Classroom', restore_classroom: 'Restore Classroom',
            approve_note: 'Approve Note', reject_note: 'Reject Note',
            create_announcement: 'Create Announcement', delete_announcement: 'Delete Announcement',
            approve_org: 'Approve Org', reject_org: 'Reject Org', suspend_org: 'Suspend Org',
            block_org: 'Block Org', reactivate_org: 'Reactivate Org', delete_org: 'Delete Org',
            suspend_user: 'Suspend User', block_user: 'Block User', delete_user: 'Delete User', reactivate_user: 'Reactivate User',
        };
        const actionColors = {
            remove_faculty: '#ef4444', remove_student: '#ef4444', delete_org: '#ef4444',
            block_org: '#ef4444', reject_note: '#ef4444', delete_announcement: '#ef4444',
            block_user: '#ef4444', delete_user: '#ef4444', suspend_org: '#f59e0b', suspend_user: '#f59e0b',
            archive_classroom: '#f59e0b', change_role: '#8b5cf6',
            add_faculty: '#10b981', approve_note: '#10b981', approve_org: '#10b981',
            create_announcement: '#3b82f6', restore_classroom: '#06b6d4',
            reactivate_org: '#10b981', reactivate_user: '#10b981',
        };

        tbody.innerHTML = logs.map(log => {
            const label = actionLabels[log.action] || log.action;
            const color = actionColors[log.action] || 'var(--muted)';
            const time = log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '�';
            const actorName = log.actorId?.name || log.actorName || 'Unknown';
            const actorRole = log.actorRole || '';
            const orgName = log.organizationName || '�';
            const meta = log.metadata?.oldRole ? `<span style="font-size:0.75rem;color:var(--dim);">${log.metadata.oldRole || 'Unknown'} &rarr; ${log.metadata.newRole || 'Unknown'}</span>` : '';
            return `<tr>
                <td style="color:var(--dim);font-size:0.78rem;">${time}</td>
                <td>
                    <div style="font-weight:600;font-size:0.85rem;">${esc(actorName)}</div>
                    <div style="font-size:0.7rem;color:var(--dim);">${esc(actorRole)}</div>
                </td>
                <td style="font-size:0.82rem;color:var(--muted);">${esc(orgName)}</td>
                <td><span style="color:${color};font-weight:600;font-size:0.82rem;">${esc(label)}</span></td>
                <td>
                    <div style="font-weight:500;font-size:0.82rem;">${esc(log.targetName || log.targetId || '�')}</div>
                    <div style="font-size:0.7rem;color:var(--dim);">${esc(log.targetType || '')}</div>
                </td>
                <td style="font-size:0.78rem;color:var(--dim);">${meta}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:2rem;">Network error.</td></tr>';
    }
}

// escHtml helper for super-admin if not already defined
function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ========================================================
   DASHBOARD ANALYTICS (Notes + Student Growth)
   ======================================================== */
async function loadDashboardAnalytics() {
    try {
        const res = await fetch(`${API}/admin/dashboard-analytics`, {
            credentials: 'include', headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) return;
        const data = await res.json();

        const s = id => document.getElementById(id);

        // Student Growth
        if (data.students) {
            animStat('analyticsGrowthTotal', data.students.total);
            animStat('analyticsGrowthToday', data.students.today);
            animStat('analyticsGrowth7Days', data.students.last7Days);
            animStat('analyticsGrowthMonth', data.students.thisMonth);
            // New stat cards
            animStat('growthTotal', data.students.total);
            animStat('growthToday', data.students.today);
            animStat('growth7Days', data.students.last7Days);
            animStat('growthMonth', data.students.thisMonth);
        }

        // Notes & Approvals
        if (data.notes) {
            const n = data.notes;
            animStat('analyticsNotesTotal', n.total);
            animStat('analyticsNotesApproved', n.approved);
            animStat('analyticsNotesPending', n.pending);
            animStat('analyticsNotesRejected', n.rejected);
            // New expanded cards
            animStat('notesStatTotal', n.total);
            animStat('notesStatApproved', n.approved);
            animStat('notesStatPending', n.pending);
            animStat('notesStatRejected', n.rejected);
            const approvalRate = n.total > 0 ? Math.round((n.approved / n.total) * 100) : 0;
            const rejectionRate = n.total > 0 ? Math.round((n.rejected / n.total) * 100) : 0;
            if (s('notesApprovalBar')) s('notesApprovalBar').style.width = approvalRate + '%';
            if (s('notesApprovalRate')) s('notesApprovalRate').textContent = approvalRate;
            if (s('approvalRatePct')) s('approvalRatePct').textContent = approvalRate + '%';
            if (s('rejectionRatePct')) s('rejectionRatePct').textContent = rejectionRate + '%';
        }
    } catch (e) { console.error('loadDashboardAnalytics error:', e); }
}

/* ========================================================
   GLOBAL STORAGE ANALYTICS
   ======================================================== */
async function loadGlobalStorageAnalytics() {
    try {
        const res = await fetch(`${API}/admin/global-storage`, {
            credentials: 'include', headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        const s = id => document.getElementById(id);

        if (data.storage) {
            if (s('storageTotalMb')) {
                if (window.UIAnim) UIAnim.animateValue(s('storageTotalMb'), 0, parseFloat(data.storage.mb) || 0, 1200, v => v + ' MB');
                else s('storageTotalMb').textContent = data.storage.mb + ' MB';
            }
            if (s('storageFileCount')) {
                if (window.UIAnim) UIAnim.animateValue(s('storageFileCount'), 0, parseFloat(data.storage.fileCount) || 0);
                else s('storageFileCount').textContent = data.storage.fileCount;
            }
            if (s('storageAvgMb')) {
                if (window.UIAnim) UIAnim.animateValue(s('storageAvgMb'), 0, parseFloat(data.storage.avgMbPerOrg) || 0, 1200, v => '~' + v + ' MB');
                else s('storageAvgMb').textContent = '~' + data.storage.avgMbPerOrg + ' MB';
            }
        }
    } catch (e) { console.error('loadGlobalStorageAnalytics error:', e); }
}

/* ========================================================
   EMAIL ANALYTICS (global)
   ======================================================== */
async function loadEmailAnalytics() {
    try {
        const res = await fetch(`${API}/admin/email-analytics`, {
            credentials: 'include', headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        const s = id => document.getElementById(id);

        if (s('emailTotal')) s('emailTotal').textContent = (data.total || 0).toLocaleString();
        if (s('emailToday')) s('emailToday').textContent = data.daily || 0;
        if (s('emailMonth')) s('emailMonth').textContent = data.monthly || 0;

        // Type tags
        const breakdown = data.typeBreakdown || {};
        const container = s('emailTypeBreakdown');
        if (container) {
            const typeColors = { otp: '#06b6d4', notifications: '#3b82f6', announcement: '#8b5cf6', system: '#10b981', bulk: '#f59e0b', other: 'var(--dim)' };
            container.innerHTML = Object.entries(breakdown)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `<span style="padding:2px 8px;border-radius: 4px;font-size:0.72rem;font-weight:600;background:${typeColors[k] || 'var(--dim)'}22;color:${typeColors[k] || 'var(--dim)'};border:1px solid ${typeColors[k] || 'var(--dim)'}44;">${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}</span>`)
                .join('');
        }
        // Render per-day chart
        renderEmailDailyChart(data.dailyChart || []);
    } catch (e) { console.error('loadEmailAnalytics error:', e); }
}

/* ========================================================
   EMAIL DAILY CHART (bar chart, pure CSS)
   ======================================================== */
function renderEmailDailyChart(dailyChart) {
    const chartEl = document.getElementById('emailDailyChart');
    const labelsEl = document.getElementById('emailChartXLabels');
    const monthEl = document.getElementById('emailChartMonth');
    if (!chartEl || !dailyChart || dailyChart.length === 0) {
        if (chartEl) chartEl.innerHTML = '<div style="color:var(--dim);font-size:0.8rem;padding:2rem;">No email data this month</div>';
        return;
    }

    const maxCount = Math.max(...dailyChart.map(d => d.count), 1);
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (monthEl) monthEl.textContent = monthName;

    const barW = Math.max(14, Math.floor(580 / dailyChart.length) - 4);

    chartEl.innerHTML = dailyChart.map(d => {
        const pct = Math.round((d.count / maxCount) * 100);
        const day = d.date ? d.date.split('-')[2] : '';
        // Zero bars: subtle but visible; peak: green; rest: blue
        const color = d.count === 0 ? 'rgba(255,255,255,0.12)' : d.count === maxCount ? '#06d6a0' : '#3b82f6';
        const barH = d.count === 0 ? 6 : Math.max(8, Math.round(pct * 0.9));
        const countLabel = d.count > 0
            ? `<span style="font-size:0.64rem;color:#e2e8f0;font-weight:600;">${d.count}</span>`
            : `<span style="font-size:0.64rem;opacity:0;"> </span>`;
        const tooltipText = `Day ${day}: ${d.count} email${d.count !== 1 ? 's' : ''}`;
        return `<div title="${tooltipText}" style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;">
            ${countLabel}
            <div style="width:${barW}px;height:${barH}px;background:${color};border-radius:3px 3px 0 0;transition:all 0.4s;cursor:default;${d.count === 0 ? 'border:1px solid rgba(255,255,255,0.2);box-sizing:border-box;' : ''}"
                onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'"></div>
        </div>`;
    }).join('');

    if (labelsEl) {
        labelsEl.innerHTML = dailyChart.map(d => {
            const day = d.date ? Number(d.date.split('-')[2]) : '';
            const show = day === 1 || day % 5 === 0;
            return `<span style="flex-shrink:0;width:${barW + 4}px;text-align:center;color:${show ? '#94a3b8' : 'transparent'};font-size:0.68rem;">${show ? day : '.'}</span>`;
        }).join('');
    }
}

/* ========================================================
   PER-ORG STORAGE + EMAIL ANALYTICS
   ======================================================== */
async function loadOrgLevelAnalytics() {
    const select = document.getElementById('analyticsOrgSelect');
    // Populate dropdown if empty
    if (select && select.options.length <= 1 && allOrgs.length > 0) {
        allOrgs.forEach(org => {
            const opt = document.createElement('option');
            opt.value = org._id; opt.textContent = org.name;
            select.appendChild(opt);
        });
    }
    const orgId = select?.value || '';
    if (!orgId) {
        // Load global email analytics instead
        await loadEmailAnalytics();
        return;
    }

    // Load per-org storage + email
    const s = id => document.getElementById(id);
    try {
        const [usageRes, emailRes] = await Promise.all([
            fetch(`${API}/admin/usage/${orgId}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' }),
            fetch(`${API}/admin/email-analytics?orgId=${orgId}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
        ]);

        const usage = usageRes.ok ? await usageRes.json() : {};
        const email = emailRes.ok ? await emailRes.json() : {};

        const orgName = allOrgs.find(o => o._id === orgId)?.name || 'Org';
        if (s('orgAnalyticsName')) if (window.UIAnim) { UIAnim.animateValue(s('orgAnalyticsName'), 0, parseFloat(orgName) || 0); } else { s('orgAnalyticsName').textContent = orgName; }

        const mb = parseFloat(usage.storage?.mb || 0);
        const storageStr = mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(2) + ' MB';
        if (s('orgStorageMb')) if (window.UIAnim) { UIAnim.animateValue(s('orgStorageMb'), 0, parseFloat(storageStr) || 0); } else { s('orgStorageMb').textContent = storageStr; }
        if (s('orgFileCount')) if (window.UIAnim) { UIAnim.animateValue(s('orgFileCount'), 0, parseFloat(usage.storage?.fileCount || 0) || 0); } else { s('orgFileCount').textContent = usage.storage?.fileCount || 0; }
        if (s('orgNotesCount')) if (window.UIAnim) { UIAnim.animateValue(s('orgNotesCount'), 0, parseFloat(usage.db?.notesCount || 0) || 0); } else { s('orgNotesCount').textContent = usage.db?.notesCount || 0; }
        if (s('orgEmailCount')) if (window.UIAnim) { UIAnim.animateValue(s('orgEmailCount'), 0, parseFloat((email.total || 0).toLocaleString()) || 0); } else { s('orgEmailCount').textContent = (email.total || 0).toLocaleString(); }

        const detail = document.getElementById('orgAnalyticsDetail');
        if (detail) detail.style.display = 'block';
    } catch (e) {
        console.error('loadOrgLevelAnalytics error:', e);
    }
}

/* ========================================================
   SYSTEM ACTIVITY FEED (enhanced render)
   ======================================================== */
async function loadSystemActivity() {
    try {
        const res = await fetch(`${API}/admin/system-activity`, {
            credentials: 'include', headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `HTTP error ${res.status}`);
        }
        const activities = await res.json();
        const feed = document.getElementById('activityFeed');
        if (!feed) return;

        if (!activities || activities.length === 0) {
            feed.innerHTML = '<div class="empty-state"><i class="fas fa-check-double"></i><p>No recent activity recorded.</p></div>';
            return;
        }

        const typeStyles = {
            login: { icon: 'fa-sign-in-alt', color: 'var(--blue)', label: 'Login' },
            org_approved: { icon: 'fa-building', color: 'var(--green)', label: 'Org Onboarded' },
            email_failed: { icon: 'fa-exclamation-circle', color: 'var(--red)', label: 'Email Failed' },
            signup: { icon: 'fa-user-plus', color: '#10b981', label: 'New Student' },
            note_upload: { icon: 'fa-file-upload', color: '#8b5cf6', label: 'Note Uploaded' },
            user_suspended: { icon: 'fa-pause-circle', color: '#f59e0b', label: 'Suspended' },
            user_blocked: { icon: 'fa-ban', color: 'var(--red)', label: 'Blocked' },
            classroom_created: { icon: 'fa-chalkboard-teacher', color: '#06b6d4', label: 'New Classroom' },
        };

        feed.innerHTML = activities.map(a => {
            const style = typeStyles[a.type] || { icon: 'fa-bolt', color: 'var(--dim)', label: a.type };
            const time = a.time ? new Date(a.time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '�';
            return `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
                <span style="width:28px;height:28px;border-radius:50%;background:${style.color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas ${style.icon}" style="color:${style.color};font-size:0.75rem;"></i>
                </span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:500;font-size:0.85rem;">${esc(a.message)}</div>
                    ${a.error ? `<div style="font-size:0.72rem;color:var(--red);margin-top:2px;">${esc(a.error)}</div>` : ''}
                </div>
                <span style="font-size:0.72rem;color:var(--dim);white-space:nowrap;">${time}</span>
            </div>`;
        }).join('');
    } catch (e) {
        console.error('loadSystemActivity error:', e);
        const feed = document.getElementById('activityFeed');
        if (feed) {
            feed.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle" style="color:var(--red)"></i><p>Failed to load activity:</p><p style="font-size:0.75rem;color:var(--dim);">${esc(e.message)}</p></div>`;
        }
    }
}



/*  FAST FETCH (MANUAL REFRESH)  */
async function fastFetchAnalytics() {
    const icon = document.getElementById("refreshIconSuper");
    const label = document.getElementById("lastRefreshSuper");
    if (icon) icon.classList.add("fa-spin");

    try {
        // Fetch all SuperAdmin-level analytics data
        await Promise.all([
            loadDashboardAnalytics(),
            loadSystemActivity(),
            loadEmailAnalytics(),
            (typeof loadOrgLevelAnalytics === "function" ? loadOrgLevelAnalytics() : Promise.resolve()),
            (typeof loadGlobalStorageAnalytics === "function" ? loadGlobalStorageAnalytics() : Promise.resolve()),
            (typeof loadGlobalStudentPerformance === "function" ? loadGlobalStudentPerformance() : Promise.resolve()),
            (typeof loadGlobalAuditLog === "function" ? loadGlobalAuditLog() : Promise.resolve())
        ]);

        if (label) {
            const now = new Date();
            label.textContent = `Last active: ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
        }
        toast("Platform analytics refreshed successfully", "success");
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

/* ========================================================
   LIVE AUTO-REFRESH LOGIC
   ======================================================== */
let refreshIntervalSuper = null;
let isTabActive = true;

document.addEventListener("visibilitychange", () => {
    isTabActive = document.visibilityState === "visible";
    if (isTabActive) fetchActiveSectionData(true);
});

function setupAutoRefreshSuper() {
    if (refreshIntervalSuper) clearInterval(refreshIntervalSuper);
    refreshIntervalSuper = setInterval(() => {
        if (!isTabActive) return;
        fetchActiveSectionData(true);
    }, 120000); // Poll every 120 seconds
}

async function fetchActiveSectionData(isSilent = false) {
    const activeSection = document.querySelector('.page-section.active');
    if (!activeSection) return;

    const sectionId = activeSection.id;
    updateLiveIndicatorStatus('fetching');

    try {
        if (sectionId === 'section-overview') {
            await Promise.all([
                loadPending(), loadOrgs(), loadUsers(), loadUpgrades(),
                loadPendingNotes(), loadDashboardAnalytics(), loadSystemActivity()
            ]);
            updateOverviewStats();
        } else if (sectionId === 'section-analytics') {
            await Promise.all([
                loadEmailAnalytics(),
                (typeof loadOrgLevelAnalytics === "function" ? loadOrgLevelAnalytics() : Promise.resolve()),
                (typeof loadGlobalStorageAnalytics === "function" ? loadGlobalStorageAnalytics() : Promise.resolve()),
                (typeof loadGlobalStudentPerformance === "function" ? loadGlobalStudentPerformance() : Promise.resolve()),
                (typeof loadGlobalAuditLog === "function" ? loadGlobalAuditLog() : Promise.resolve())
            ]);
        } else if (sectionId === 'section-orgs') {
            await loadOrgs();
        } else if (sectionId === 'section-users') {
            await loadUsers();
        } else if (sectionId === 'section-pending' || sectionId === 'section-moderation') {
            await Promise.all([loadPending(), loadPendingNotes()]);
        } else if (sectionId === 'section-settings') {
            await loadSystemSettings();
        } else if (sectionId === 'section-finance') {
            await loadUpgrades();
        }

        updateLiveIndicatorStatus('success');
    } catch (e) {
        console.error("Auto refresh failed", e);
        updateLiveIndicatorStatus('error');
    }
}

function updateLiveIndicatorStatus(status) {
    const dots = [document.getElementById('liveRefreshDot'), document.getElementById('liveRefreshDotAnalytics')];
    const labels = [document.getElementById('liveRefreshLabel'), document.getElementById('liveRefreshLabelAnalytics')];

    dots.forEach(dot => {
        if (!dot) return;
        if (status === 'fetching') {
            dot.style.background = 'var(--yellow)';
            dot.style.boxShadow = '0 0 8px var(--yellow)';
        } else if (status === 'success') {
            dot.style.background = 'var(--green)';
            dot.style.boxShadow = '0 0 8px var(--green)';
        } else if (status === 'error') {
            dot.style.background = 'var(--red)';
            dot.style.boxShadow = '0 0 8px var(--red)';
        }
    });

    labels.forEach(label => {
        if (!label) return;
        if (status === 'fetching') label.textContent = 'Updating...';
        else if (status === 'success') {
            const now = new Date();
            label.textContent = `Live \u2022 ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
        }
        else if (status === 'error') label.textContent = 'Failed to update';
    });
}

function manualRefresh() {
    const btns = [document.getElementById('refreshNowBtn'), document.getElementById('refreshNowBtnAnalytics')];
    btns.forEach(btn => {
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
    });

    fetchActiveSectionData(false).finally(() => {
        btns.forEach(btn => {
            if (!btn) return;
            const icon = btn.querySelector('i');
            if (icon) icon.classList.remove('fa-spin');
        });
    });
}

// Start auto refresh
setTimeout(setupAutoRefreshSuper, 2000);
