const supabaseUrl = 'https://hukbgzdreghzidgzwxlj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1a2JnemRyZWdoemlkZ3p3eGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzgyMjYsImV4cCI6MjA4NjkxNDIyNn0.iB3mmWQdnIUU0PaVo6UmwaW0V56BSeRSlyJ2_wrgsWs';
const supabase = null; // Mock for syntax check

const API = '';
let token = 'mock_token';
let currentUser = null;
let classrooms = [];
let allRequests = [];

// ===== AUTH =====
async function init() {
    // Mocking window/document for syntax check context if needed, but for syntax only it should be fine.
    // ... (rest of the code)
}

// Copying the rest of the functions...
function apiFetch(url, opts = {}) {
    return fetch(url, { ...opts, headers: {  'Content-Type': 'application/json', ...(opts.headers || {}) } });
}

function logout() { localStorage.removeItem('jwt_token'); sessionStorage.clear(); window.location.replace('/login.html'); }

// ===== TABS =====
function switchTab(name) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    event.currentTarget.classList.add('active');
}

// ===== LOAD CLASSROOMS =====
async function loadClassrooms() {
    try {
        const res = await apiFetch('/api/classrooms');
        const data = await res.json();
        classrooms = data.classrooms || [];
        renderClassrooms();
        updateFilters();
        updateStats();
    } catch (e) { console.error(e); }
}

function renderClassrooms() {
    const grid = document.getElementById('classroomGrid');
    if (classrooms.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🏫</div><h3>No classrooms yet</h3><p>Create your first classroom to get started!</p></div>';
        return;
    }
    grid.innerHTML = classrooms.map(c => `
        <div class="classroom-card" onclick="openClassroom('${c._id}')">
            <div class="cc-code">${c.classCode || '---'}</div>
            <div class="cc-header"><span class="cc-subject">${esc(c.subject)}</span></div>
            <div class="cc-name">${esc(c.name)}</div>
            <div class="cc-desc">${esc(c.description || 'No description')}</div>
            <div class="cc-stats">
                <span><i class="fas fa-users"></i> ${c.memberCount || 0} members</span>
                <span><i class="fas fa-clock"></i> ${timeAgo(c.createdAt)}</span>
                ${c.pendingRequests > 0 ? `<span style="color:var(--orange)"><i class="fas fa-user-clock"></i> ${c.pendingRequests} pending</span>` : ''}
            </div>
            <div class="cc-actions">
                <button class="btn btn-glass btn-sm" onclick="event.stopPropagation();viewMembers('${c._id}')"><i class="fas fa-users"></i> Members</button>
                <button class="btn btn-glass btn-sm" onclick="event.stopPropagation();copyCode('${c.classCode}')"><i class="fas fa-copy"></i> Code</button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteClassroom('${c._id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

// ===== CREATE CLASSROOM =====
async function createClassroom(e) {
    e.preventDefault();
    const btn = document.getElementById('createBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    try {
        const body = {
            name: document.getElementById('cName').value,
            subject: document.getElementById('cSubject').value,
            description: document.getElementById('cDescription').value,
            subjectSlug: document.getElementById('cSubject').value
        };
        body.settings = { maxStudents: parseInt(document.getElementById('cMaxStudents').value) || 200 };
        const res = await apiFetch('/api/classrooms', { method: 'POST', body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        showToast('Classroom created! Code: ' + data.classroom.classCode, 'success');
        document.getElementById('createClassroomForm').reset();
        await loadClassrooms();
        switchTabDirect('classrooms');
    } catch (err) { showToast(err.message, 'error'); }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> Create Classroom';
}

// ===== JOIN REQUESTS =====
async function loadAllRequests() {
    try {
        const filterId = document.getElementById('requestClassroomFilter').value;
        allRequests = [];
        const targets = filterId ? classrooms.filter(c => c._id === filterId) : classrooms;
        for (const c of targets) {
            const res = await apiFetch(`/api/classrooms/${c._id}/requests?status=pending`);
            const data = await res.json();
            (data.requests || []).forEach(r => { r._classroomName = c.name; r._classroomId = c._id; });
            allRequests.push(...(data.requests || []));
        }
        renderRequests();
        const badge = document.getElementById('requestBadge');
        badge.textContent = allRequests.length;
        badge.style.display = allRequests.length > 0 ? 'inline' : 'none';
        document.getElementById('statPending').textContent = allRequests.length;
    } catch (e) { console.error(e); }
}

function renderRequests() {
    const list = document.getElementById('requestsList');
    if (allRequests.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><h3>No pending requests</h3><p>All caught up!</p></div>';
        return;
    }
    list.innerHTML = allRequests.map(r => `
        <div class="request-item" id="req-${r._id}">
            <div class="request-avatar">${(r.student?.name || '?')[0].toUpperCase()}</div>
            <div class="request-info">
                <div class="request-name">${esc(r.student?.name || 'Unknown')}</div>
                <div class="request-email">${esc(r.student?.email || '')} · ${esc(r._classroomName)}</div>
                ${r.requestMessage ? `<div class="request-msg">"${esc(r.requestMessage)}"</div>` : ''}
                <div class="request-time">${timeAgo(r.requestedAt)}</div>
            </div>
            <div class="request-actions">
                <button class="btn btn-success btn-sm" onclick="handleRequest('${r._classroomId}','${r._id}','approve')"><i class="fas fa-check"></i> Approve</button>
                <button class="btn btn-danger btn-sm" onclick="handleRequest('${r._classroomId}','${r._id}','reject')"><i class="fas fa-times"></i> Reject</button>
            </div>
        </div>
    `).join('');
}

async function handleRequest(classroomId, requestId, action) {
    try {
        const res = await apiFetch(`/api/classrooms/${classroomId}/requests/${requestId}`, {
            method: 'PUT', body: JSON.stringify({ action })
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
        showToast(`Request ${action}d`, 'success');
        document.getElementById('req-' + requestId)?.remove();
        allRequests = allRequests.filter(r => r._id !== requestId);
        document.getElementById('requestBadge').textContent = allRequests.length;
        document.getElementById('statPending').textContent = allRequests.length;
        loadClassrooms(); // Refresh stats from server
    } catch (e) { showToast(e.message, 'error'); }
}

async function bulkAction(action) {
    const filterId = document.getElementById('requestClassroomFilter').value;
    const reqs = allRequests.filter(r => !filterId || r._classroomId === filterId);
    if (reqs.length === 0) return;
    if (!confirm(`${action === 'approve' ? 'Approve' : 'Reject'} ${reqs.length} requests?`)) return;
    // Group by classroom
    const grouped = {};
    reqs.forEach(r => { (grouped[r._classroomId] = grouped[r._classroomId] || []).push(r._id); });
    for (const [cid, ids] of Object.entries(grouped)) {
        await apiFetch(`/api/classrooms/${cid}/requests-bulk`, {
            method: 'PUT', body: JSON.stringify({ requestIds: ids, action })
        });
    }
    showToast(`${reqs.length} requests ${action}d`, 'success');
    await loadAllRequests(); await loadClassrooms();
}

// ===== MEMBERS =====
async function viewMembers(classroomId) {
    try {
        const res = await apiFetch(`/api/classrooms/${classroomId}/members`);
        const data = await res.json();
        const c = classrooms.find(cl => cl._id === classroomId);
        document.getElementById('modalTitle').textContent = `Members — ${c?.name || 'Classroom'}`;
        const members = data.members || [];
        document.getElementById('modalContent').innerHTML = members.length === 0
            ? '<div class="empty-state"><p>No approved members yet.</p></div>'
            : members.map(m => `
                <div class="member-item">
                    <div class="member-avatar">${(m.student?.name || '?')[0].toUpperCase()}</div>
                    <div style="flex:1"><div class="member-name">${esc(m.student?.name)}</div><div class="member-email">${esc(m.student?.email)}</div></div>
                    <button class="btn btn-danger btn-sm" onclick="removeMember('${classroomId}','${m.student?._id}')"><i class="fas fa-user-minus"></i></button>
                </div>
            `).join('');
        openModal();
    } catch (e) { showToast('Error loading members', 'error'); }
}

async function removeMember(classroomId, userId) {
    if (!confirm('Remove this student?')) return;
    await apiFetch(`/api/classrooms/${classroomId}/members/${userId}`, { method: 'DELETE' });
    showToast('Member removed', 'success');
    viewMembers(classroomId); loadClassrooms();
}

// ===== ANALYTICS =====
async function loadAnalytics() {
    const cid = document.getElementById('analyticsClassroomFilter').value;
    const container = document.getElementById('analyticsContent');
    if (!cid) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><h3>Select a classroom</h3></div>'; return; }
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--silver)"><i class="fas fa-spinner fa-spin"></i> Loading analytics...</div>';
    try {
        const res = await apiFetch(`/api/activity/classroom/${cid}/analytics?days=30`);
        const data = await res.json();
        const s = data.summary;
        const activePercent = s.totalMembers > 0 ? Math.round((s.activeStudents / s.totalMembers) * 100) : 0;
        container.innerHTML = `
            <div class="stats-row">
                <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value">${s.totalMembers}</div><div class="stat-label">Members</div></div>
                <div class="stat-card"><div class="stat-icon">🟢</div><div class="stat-value">${s.activeStudents}</div><div class="stat-label">Active</div></div>
                <div class="stat-card"><div class="stat-icon">🔴</div><div class="stat-value">${s.inactiveStudents}</div><div class="stat-label">Inactive</div></div>
                <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value">${s.totalInteractions}</div><div class="stat-label">Interactions</div></div>
            </div>
            <h4 style="margin:1rem 0 .5rem;color:var(--silver);font-size:.85rem">ENGAGEMENT RATE</h4>
            <div class="analytics-bar"><div class="bar-fill" style="width:${activePercent}%;background:linear-gradient(90deg,var(--cyan),var(--green))"></div></div>
            <p style="font-size:.8rem;color:var(--text-dim);margin-bottom:1.5rem">${activePercent}% of students are active in the last 30 days</p>
            ${data.studentAnalytics.length > 0 ? `
                <h4 style="margin:1rem 0 .5rem;color:var(--silver);font-size:.85rem">TOP ENGAGED STUDENTS</h4>
                <div class="engagement-list">${data.studentAnalytics.slice(0, 10).map(sa => `
                    <div class="eng-item">
                        <div class="eng-avatar">${(sa.student?.name || '?')[0].toUpperCase()}</div>
                        <div><div class="eng-name">${esc(sa.student?.name)}</div><div style="font-size:.72rem;color:var(--text-dim)">${esc(sa.student?.email)}</div></div>
                        <div class="eng-count">${sa.totalActions} actions</div>
                    </div>`).join('')}
                </div>` : ''}
            ${data.inactiveStudents.length > 0 ? `
                <h4 style="margin:1.5rem 0 .5rem;color:var(--red);font-size:.85rem">⚠️ INACTIVE STUDENTS</h4>
                <div class="engagement-list">${data.inactiveStudents.slice(0, 10).map(st => `
                    <div class="eng-item"><div class="eng-avatar" style="background:var(--red-dim);color:var(--red)">${(st.name || '?')[0].toUpperCase()}</div>
                    <div><div class="eng-name">${esc(st.name)}</div><div style="font-size:.72rem;color:var(--text-dim)">${esc(st.email)}</div></div>
                    <div class="eng-count" style="color:var(--red)">0</div></div>`).join('')}
                </div>` : ''}
        `;
    } catch (e) { container.innerHTML = '<div class="empty-state"><p>Error loading analytics</p></div>'; }
}

// ===== DELETE CLASSROOM =====
async function deleteClassroom(id) {
    if (!confirm('Delete this classroom and ALL its data? This cannot be undone.')) return;
    try {
        await apiFetch(`/api/classrooms/${id}`, { method: 'DELETE' });
        showToast('Classroom deleted', 'success');
        await loadClassrooms();
    } catch (e) { showToast('Error deleting', 'error'); }
}

function copyCode(code) { navigator.clipboard.writeText(code); showToast('Class code copied: ' + code, 'success'); }

// ===== UI HELPERS =====
function updateFilters() {
    ['requestClassroomFilter', 'analyticsClassroomFilter', 'uploadClassroomSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const val = el.value;
        el.innerHTML = '<option value="">Select Classroom...</option>' + classrooms.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join('');
        el.value = val;
    });
}

function updateStats() {
    document.getElementById('statClassrooms').textContent = classrooms.length;
    document.getElementById('statStudents').textContent = classrooms.reduce((s, c) => s + (c.memberCount || 0), 0);
}

function switchTabDirect(name) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    const idx = ['classrooms', 'requests', 'analytics', 'upload', 'create'].indexOf(name);
    if (idx > -1) document.querySelectorAll('.tab-btn')[idx].classList.add('active');
}

function openClassroom(id) { window.location.href = `/view-classroom.html?id=${id}`; }
function openModal() { document.getElementById('classroomModal').classList.add('active'); }
function closeModal() { document.getElementById('classroomModal').classList.remove('active'); }

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.className = 'toast ' + type;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}" style="color:var(--${type === 'success' ? 'green' : 'red'})"></i> <span>${msg}</span>`;
    t.style.display = 'flex';
    setTimeout(() => { t.style.display = 'none'; }, 3500);
}

function timeAgo(d) {
    if (!d) return '';
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), dy = Math.floor(ms / 86400000);
    if (m < 1) return 'Just now'; if (m < 60) return m + 'm ago'; if (h < 24) return h + 'h ago';
    if (dy < 7) return dy + 'd ago';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function esc(s) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ===== UPLOAD LOGIC =====
function switchUploadTab(type) {
    document.querySelectorAll('.upload-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    // Activate button by data attribute
    const activeBtn = document.querySelector(`.upload-tabs .tab-btn[data-upload-type="${type}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    ['material', 'quiz', 'announce'].forEach(t => {
        const el = document.getElementById(`field-${t}`);
        if (el) el.style.display = t === type ? 'block' : 'none';
    });
    document.getElementById('uploadType').value = type;
    // Toggle required
    const matTitle = document.getElementById('matTitle');
    if (matTitle) {
        if (type === 'material') matTitle.setAttribute('required', '');
        else matTitle.removeAttribute('required');
    }
}

function initUploadForm() {
    const form = document.getElementById('uploadForm');
    if (form) form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabase) { showToast('Supabase not initialized', 'error'); return; }

        const type = document.getElementById('uploadType').value;
        const classroomId = document.getElementById('uploadClassroomSelect').value;
        if (!classroomId) { showToast('Please select a classroom', 'error'); return; }

        const classroom = classrooms.find(c => c._id === classroomId);
        const subject = classroom ? (classroom.subject || 'general') : 'general';
        // We use classroom.subject as 'subject_slug' for compatibility, and also try to store classroom_id if schema supports it
        // Actually, we'll store everything we can.

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
        submitBtn.disabled = true;

        try {
            if (type === 'material') {
                const title = document.getElementById('matTitle').value;
                const fileInput = document.getElementById('matFile');
                if (!fileInput.files || fileInput.files.length === 0) { throw new Error('Select a file'); }

                const file = fileInput.files[0];
                const fileExt = file.name.split('.').pop();
                const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                // Path: classroomId/timestamp_filename
                const filePath = `${classroomId}/${Date.now()}_${cleanName}`;

                const progress = document.getElementById('uploadProgress');
                if (progress) progress.style.display = 'block';

                const { error: uploadError } = await supabase.storage.from('notes-files').upload(filePath, file);
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('notes-files').getPublicUrl(filePath);

                // Insert
                const { error: dbError } = await supabase.from('materials').insert([{
                    title,
                    subject_slug: subject,
                    file_url: publicUrl,
                    uploaded_by: currentUser.name,
                    type: fileExt,
                    classroom_id: classroomId
                }]);
                if (dbError) throw dbError;
                if (progress) progress.style.display = 'none';

            } else if (type === 'quiz') {
                const title = document.getElementById('quizTitle').value;
                const url = document.getElementById('quizLink').value;
                const { error } = await supabase.from('quizzes').insert([{
                    title, subject_slug: subject, quiz_url: url, provider: 'Google Forms',
                    classroom_id: classroomId
                }]);
                if (error) throw error;

            } else if (type === 'announce') {
                const msg = document.getElementById('annMsg').value;
                const tag = document.getElementById('annTag').value;
                const { error } = await supabase.from('announcements').insert([{
                    message: msg, subject_slug: subject,
                    posted_by: currentUser.name, tags: [tag],
                    classroom_id: classroomId
                }]);
                if (error) throw error;
            }

            // Send notification to classroom members
            let notifTitle = '';
            let notifMsg = '';
            if (type === 'material') {
                notifTitle = 'New Material';
                notifMsg = `${currentUser.name} uploaded a new material: ${document.getElementById('matTitle').value}`;
            } else if (type === 'quiz') {
                notifTitle = 'New Quiz';
                notifMsg = `${currentUser.name} posted a new quiz: ${document.getElementById('quizTitle').value}`;
            } else if (type === 'announce') {
                notifTitle = 'New Announcement';
                notifMsg = document.getElementById('annMsg').value.substring(0, 100) + '...';
            }

            if (notifTitle) {
                apiFetch(`/api/classrooms/${classroomId}/notify`, {
                    method: 'POST',
                    body: JSON.stringify({
                        title: notifTitle,
                        message: notifMsg,
                        type: 'system',
                        link: `/view-classroom.html?id=${classroomId}`
                    })
                }).catch(e => console.error("Notification fail:", e));
            }

            showToast('✅ Published!', 'success');
            form.reset();
            document.getElementById('uploadType').value = 'material';
            switchUploadTab('material');

        } catch (err) {
            console.error(err);
            showToast(`❌ ${err.message}`, 'error');
            const progress = document.getElementById('uploadProgress');
            if (progress) progress.style.display = 'none';
        } finally {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}
