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
 * Notes Page — External JS
 * Loaded by the SPA router or directly via <script src>
 */

window.initPage = function () {
    const API = '/api';

    function getToken() { return localStorage.getItem('jwt_token'); }
    function authHeaders() {
        const t = getToken();
        return t ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    // ── Sidebar toggle ──
    const ham = document.getElementById('hamBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (ham && sidebar && sidebarOverlay) {
        ham.addEventListener('click', () => { ham.classList.toggle('open'); sidebar.classList.toggle('open'); sidebarOverlay.classList.toggle('show'); });
        sidebarOverlay.addEventListener('click', () => { ham.classList.remove('open'); sidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); });
    }

    // ── Reading progress + back to top ──
    const progressBar = document.getElementById('progressBar');
    const backTop = document.getElementById('backTop');
    function onScroll() {
        const s = window.scrollY;
        const d = document.documentElement.scrollHeight - window.innerHeight;
        if (d > 0 && progressBar) progressBar.style.width = (s / d * 100) + '%';
        if (backTop) backTop.classList.toggle('show', s > 300);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    // ── Section observer ──
    const io = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.06, rootMargin: '0px 0px -40px 0px' });

    // ── Modal ──
    const approvalModal = document.getElementById('approvalModal');
    window.closeApprovalModal = function () {
        if (approvalModal) { approvalModal.classList.remove('show'); document.body.style.overflow = ''; }
    };
    function showApprovalModal() {
        if (approvalModal) { approvalModal.classList.add('show'); document.body.style.overflow = 'hidden'; }
    }
    if (approvalModal) {
        approvalModal.addEventListener('click', e => { if (e.target === approvalModal) window.closeApprovalModal(); });
    }

    // ── Auth Check ──
    const token = getToken();
    if (!token) {
        const authGate = document.getElementById('authGate');
        if (authGate) authGate.style.display = 'block';
        return;
    }
    const mainPage = document.getElementById('mainPage');
    if (mainPage) mainPage.style.display = 'block';
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) uploadBtn.disabled = false;

    // Observe sections
    document.querySelectorAll('.sec').forEach(el => io.observe(el));

    // GSAP animations (if available)
    if (window.gsap) {
        gsap.registerPlugin(ScrollTrigger);
        gsap.from('.page-hero-inner h1', { duration: 1, y: 40, opacity: 0, ease: 'power4.out', delay: 0.1 });
        gsap.from('.page-hero-inner p', { duration: 0.9, y: 30, opacity: 0, ease: 'power4.out', delay: 0.3 });
        gsap.from('.form-card', {
            scrollTrigger: { trigger: '.form-card', start: 'top 85%' },
            duration: 0.8, x: -30, opacity: 0, ease: 'power3.out'
        });
        gsap.from('.notes-panel', {
            scrollTrigger: { trigger: '.notes-panel', start: 'top 85%' },
            duration: 0.8, x: 30, opacity: 0, ease: 'power3.out'
        });
    }

    loadNotes();

    // ── Load My Submissions ──
    async function loadNotes() {
        const list = document.getElementById('notesList');
        if (!list) return;
        list.innerHTML = '<div class="notes-empty"><i class="fas fa-spinner fa-spin"></i><div>Loading your submissions\u2026</div></div>';

        try {
            // Check user org — try both fields + classroom membership
            let hasOrg = false;
            const meRes = await fetch(`${API}/auth/me`, {
                headers: { 'Authorization': 'Bearer ' + (token), 'Content-Type': 'application/json' }
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                const user = meData.user || meData;
                // /api/auth/me returns "organization" (object), not "organization_id"
                hasOrg = !!(user.organization_id || user.organization);
            }

            // Fallback: check classroom membership
            if (!hasOrg) {
                try {
                    const clsRes = await fetch(`${API}/classrooms/my`, {
                        headers: { 'Authorization': 'Bearer ' + (token), 'Content-Type': 'application/json' }
                    });
                    if (clsRes.ok) {
                        const clsData = await clsRes.json();
                        hasOrg = (clsData.classrooms && clsData.classrooms.length > 0);
                    }
                } catch (e) { /* ignore */ }
            }

            if (!hasOrg) {
                list.innerHTML = `
                    <div class="notes-empty">
                        <i class="fas fa-link"></i>
                        <div>Join a Classroom First</div>
                        <p>Enter a class code on the <a href="/my-classrooms" style="color:var(--blue-light)">My Classrooms</a> page to get connected to an organization.</p>
                    </div>`;
                const notesCount = document.getElementById('notesCount');
                if (notesCount) notesCount.textContent = '0';
                if (uploadBtn) uploadBtn.disabled = true;
                return;
            }

            const res = await fetch(`${API}/notes/my-notes`, {
                headers: { 'Authorization': 'Bearer ' + (token), 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || errData.message || 'Failed to load notes');
            }

            const data = await res.json();
            const notes = data.notes || [];

            const notesCount = document.getElementById('notesCount');
            if (notesCount) notesCount.textContent = `${data.total || 0}`;

            if (notes.length === 0) {
                list.innerHTML = `
                    <div class="notes-empty">
                        <i class="fas fa-folder-open"></i>
                        <div>No submissions yet</div>
                        <p>Upload your first note using the form!</p>
                    </div>`;
                return;
            }

            const TYPE_LABELS = {
                self_made: '\ud83d\udfe2 Self Made',
                teacher: '\ud83d\udfe2 Teacher Notes',
                university: '\ud83d\udfe3 University',
                buyed: '\ud83d\udfe1 Buyed'
            };
            const STATUS_ICONS = {
                pending: '\u23f3',
                approved: '\u2705',
                rejected: '\u274c'
            };

            list.innerHTML = notes.map(n => {
                const date = new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                const status = n.status || 'pending';
                const noteType = n.note_type || 'self_made';
                return `
                <div class="note-item">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                        <span class="status-badge ${status}">${STATUS_ICONS[status] || ''} ${status}</span>
                        <span class="type-badge ${noteType}">${TYPE_LABELS[noteType] || noteType}</span>
                    </div>
                    <div class="note-item-title">${esc(n.title)}</div>
                    ${n.description ? `<div class="note-item-desc">${esc(n.description)}</div>` : ''}
                    <div class="note-item-meta">
                        <span><i class="fas fa-calendar"></i>${date}</span>
                    </div>
                    ${status === 'approved' ? `
                    <div class="note-item-actions">
                        <a href="${n.file_url}" target="_blank" class="note-btn note-btn-preview">
                            <i class="fas fa-eye"></i> Preview
                        </a>
                    </div>` : ''}
                </div>`;
            }).join('');
        } catch (err) {
            console.error('Load notes error:', err);
            list.innerHTML = `
                <div class="notes-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>Failed to load submissions</div>
                </div>`;
        }
    }

    // ── Upload Form ──
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('noteTitle').value.trim();
            const description = document.getElementById('noteDesc').value.trim();
            const note_type = document.getElementById('noteType').value;
            const fileInput = document.getElementById('noteFile');
            const file = fileInput.files[0];

            if (!title || !file) return showMsg('Title and PDF file are required', true);
            if (!file.type.includes('pdf')) return showMsg('Only PDF files are allowed', true);
            if (file.size > 25 * 1024 * 1024) return showMsg('File must be under 25MB', true);

            const btn = document.getElementById('uploadBtn');
            const btnText = document.getElementById('uploadBtnText');
            btn.disabled = true;
            btnText.textContent = 'Uploading\u2026';
            hideMsg();

            try {
                const currentToken = getToken();

                // Step 1: Get signed upload URL
                const urlRes = await fetch(`${API}/notes/upload-url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileName: file.name, fileSize: file.size })
                });

                if (!urlRes.ok) {
                    const err = await urlRes.json().catch(() => ({}));
                    throw new Error(err.message || 'Failed to get upload URL');
                }

                const { path, signedUrl } = await urlRes.json();

                // Step 2: Upload file to Supabase
                const uploadRes = await fetch(signedUrl,
                    { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file }
                );

                if (!uploadRes.ok) throw new Error('File upload failed');

                // Step 3: Save metadata
                const metaRes = await fetch(`${API}/notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, description, filePath: path, note_type })
                });

                if (!metaRes.ok) {
                    const err = await metaRes.json().catch(() => ({}));
                    throw new Error(err.message || 'Failed to save note');
                }

                uploadForm.reset();
                showApprovalModal();
                loadNotes();
            } catch (err) {
                console.error('Upload error:', err);
                showMsg(err.message || 'Upload failed. Please try again.', true);
            } finally {
                btn.disabled = false;
                btnText.textContent = 'Upload Note';
            }
        });
    }

    // ── Helpers ──
    function esc(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, m => map[m]);
    }

    function showMsg(text, isError) {
        const el = document.getElementById('uploadMsg');
        const txt = document.getElementById('uploadMsgText');
        if (!el || !txt) return;
        el.className = `upload-msg show ${isError ? 'error' : 'success'}`;
        txt.textContent = text;
        if (!isError) setTimeout(() => el.classList.remove('show'), 4000);
    }

    function hideMsg() {
        const el = document.getElementById('uploadMsg');
        if (el) el.classList.remove('show');
    }
};

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initPage);
} else {
    window.initPage();
}
