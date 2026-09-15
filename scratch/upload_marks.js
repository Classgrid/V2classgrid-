
let _currentUploadExamId = null;

function openUploadMarksModal(examId) {
    _currentUploadExamId = examId;
    document.getElementById('marksExcelFile').value = '';
    document.getElementById('uploadMarksModal').classList.add('active');
}

function closeUploadMarksModal() {
    _currentUploadExamId = null;
    document.getElementById('uploadMarksModal').classList.remove('active');
}

function downloadExamTemplate() {
    if (!_currentUploadExamId) return;
    window.location.href = `/api/marks/exams/${_currentUploadExamId}/template`;
}

async function submitExamMarks() {
    if (!_currentUploadExamId) return;
    const fileInput = document.getElementById('marksExcelFile');
    if (!fileInput.files[0]) return toast('Please select an Excel file to upload.', 'error');

    const btn = document.getElementById('btnUploadMarks');
    const ogText = btn.innerText;
    btn.innerText = 'Processing...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        const res = await fetch(`/api/marks/upload-multi/${_currentUploadExamId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('classgrid_token')}` },
            body: formData
        });

        const data = await res.json();
        
        if (res.ok) {
            toast('Marks uploaded successfully!', 'success');
            closeUploadMarksModal();
            loadResultSystem();
        } else {
            toast(data.message || 'Failed to upload marks', 'error');
        }
    } catch (err) {
        toast('Server error during upload.', 'error');
    } finally {
        btn.innerText = ogText;
        btn.disabled = false;
    }
}
