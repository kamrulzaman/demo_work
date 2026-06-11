// API Base URL
const API_URL = 'http://localhost:5000/api';

let stationsList = [];
let myDeskBookings = [];
let assignedExperiments = [];
let submittedReports = [];
let studentIssues = [];
let studentManuals = [];
let instructorChats = [{ sender: "Instructor", data: "Welcome to the lab! Let me know if you need help." }];

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return false;
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'student' && user.role !== 'admin') {
        window.location.href = '/';
        return false;
    }
    document.querySelector('.user-meta strong').innerText = user.name || 'Student';
    return true;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function triggerToast(msg, type = "info") {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 12px 24px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white; border-radius: 8px; z-index: 1000;
    `;
    toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function loadAllData() {
    await Promise.all([
        loadStations(),
        loadMyBookings(),
        loadMyExperiments(),
        loadMySubmissions(),
        loadMyIssues(),
        loadManuals()
    ]);
    renderStudentWorkspace();
}

async function loadStations() {
    try {
        const response = await fetch(`${API_URL}/student/stations`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) stationsList = data.stations;
    } catch (error) {
        console.error('Error loading stations:', error);
    }
}

async function loadMyBookings() {
    try {
        const response = await fetch(`${API_URL}/student/my-bookings`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) myDeskBookings = data.bookings;
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

async function loadMyExperiments() {
    try {
        const response = await fetch(`${API_URL}/student/my-experiments`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) assignedExperiments = data.experiments;
    } catch (error) {
        console.error('Error loading experiments:', error);
    }
}

async function loadMySubmissions() {
    try {
        const response = await fetch(`${API_URL}/student/my-submissions`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) submittedReports = data.results;
    } catch (error) {
        console.error('Error loading submissions:', error);
    }
}

async function loadMyIssues() {
    try {
        const response = await fetch(`${API_URL}/student/my-issues`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) studentIssues = data.issues;
    } catch (error) {
        console.error('Error loading issues:', error);
    }
}

async function loadManuals() {
    try {
        const response = await fetch(`${API_URL}/student/manuals`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) studentManuals = data.manuals;
    } catch (error) {
        console.error('Error loading manuals:', error);
    }
}

// Render functions
function renderStudentWorkspace() {
    renderStudentStats();
    renderStudentSchedules();
    renderStudentStationStates();
    renderStudentDeskTable();
    renderStudentExperiments();
    renderSubmittedReportsTable();
    renderStudentManualsCatalog();
    renderStudentIssuesTable();
}

function renderStudentStats() {
    const pendingCount = myDeskBookings.filter(d => d.status === "pending").length;
    const activeCount = assignedExperiments.filter(a => a.status === "active").length;
    const submittedCount = submittedReports.length;
    
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div><h3>Pending Desks</h3><div class="stat-number">${pendingCount}</div></div><div class="stat-icon"><i class="fas fa-hourglass-start"></i></div></div>
        <div class="stat-card"><div><h3>Active Project Logs</h3><div class="stat-number">${activeCount}</div></div><div class="stat-icon"><i class="fas fa-microscope"></i></div></div>
        <div class="stat-card"><div><h3>Turned In Reports</h3><div class="stat-number">${submittedCount}</div></div><div class="stat-icon"><i class="fas fa-file-check"></i></div></div>
    `;
}

function renderStudentSchedules() {
    const approved = myDeskBookings.filter(d => d.status === "approved");
    document.getElementById('studentRecentBookings').innerHTML = approved.length === 0 ? 
        '<p style="color:#666; font-size:0.9rem;">No active desk assignments approved.</p>' : 
        approved.map(r => `
            <div class="experiment-card"><strong>${escapeHtml(r.station_name)}</strong><br><small><i class="fas fa-calendar-alt"></i> ${new Date(r.start_time).toLocaleString()} to ${new Date(r.end_time).toLocaleTimeString()}</small></div>
        `).join('');
}

function renderStudentStationStates() {
    const available = stationsList.filter(s => s.status === "available");
    document.getElementById('studentQuickEquipment').innerHTML = stationsList.slice(0, 5).map(s => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom:1px solid #eee;">
            <span style="font-size:0.9rem;">${escapeHtml(s.name)}</span>
            <span class="status-badge status-${s.status}">${s.status === 'available' ? 'Available' : s.status === 'inuse' ? 'In Use' : 'Maintenance'}</span>
        </div>
    `).join('');
    
    const deskSelect = document.getElementById('deskSelect');
    if (deskSelect) {
        deskSelect.innerHTML = stationsList.map(st => `<option value="${st.id}">${escapeHtml(st.name)}</option>`).join('');
    }
    
    const issueSelect = document.getElementById('issueEquipmentSelect');
    if (issueSelect) {
        issueSelect.innerHTML = stationsList.map(st => `<option value="${st.id}">${escapeHtml(st.name)}</option>`).join('');
    }
}

function renderStudentDeskTable() {
    document.getElementById('myDesksListTable').innerHTML = `
        <table style="width:100%">
            <thead><tr><th>Station Location</th><th>Timing Schedule</th><th>State</th></tr></thead>
            <tbody>
                ${myDeskBookings.slice(0, 5).map(d => `
                    <tr><td><strong>${escapeHtml(d.station_name)}</strong></td><td><small>${new Date(d.start_time).toLocaleString()}</small></td><td><span class="status-badge ${d.status === 'approved' ? 'status-available' : 'status-inuse'}">${d.status}</span></td></tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderStudentExperiments() {
    const expSelect = document.getElementById('studentExpSelect');
    if (expSelect) {
        expSelect.innerHTML = assignedExperiments.map(a => `<option value="${a.id}">${escapeHtml(a.title || 'Assignment')}</option>`).join('');
    }
    
    const assignSelect = document.getElementById('assignContextSelect');
    if (assignSelect) {
        assignSelect.innerHTML = assignedExperiments.map(a => `<option value="${a.id}">${escapeHtml(a.course_name || 'Course')} - ${escapeHtml(a.title)}</option>`).join('');
    }
    
    const activeExps = assignedExperiments.filter(a => a.status === "active");
    document.getElementById('studentExpCards').innerHTML = activeExps.length === 0 ? 
        '<p style="color:#666; font-size:0.9rem;">No active learning experiments tracked.</p>' : 
        activeExps.map(a => `
            <div class="experiment-card"><strong>${escapeHtml(a.title || 'Assignment')}</strong><br><small>Course: ${escapeHtml(a.course_name || 'N/A')}</small><div style="background:#e5e7eb; height:6px; border-radius:3px; margin:8px 0;"><div style="background:#2563eb; width:${a.progress}%; height:100%; border-radius:3px;"></div></div><small>Milestone Progress: ${a.progress}%</small></div>
        `).join('');
}

function renderSubmittedReportsTable() {
    document.getElementById('turnedInTable').innerHTML = `
        <table style="width:100%">
            <thead><tr><th>Course Task context</th><th>Filename Submission</th><th>Date</th></tr></thead>
            <tbody>
                ${submittedReports.slice(0, 5).map(s => `
                    <tr><td><strong>${escapeHtml(s.experiment_title)}</strong><br><small style="color:#666;">${escapeHtml(s.conclusion || '')}</small></td><td><i class="fas fa-file-pdf" style="color:red;"></i> ${escapeHtml(s.file_name || 'File')}</td><td>${new Date(s.uploaded_at).toLocaleDateString()}</td></tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderStudentManualsCatalog() {
    document.getElementById('studentSopList').innerHTML = studentManuals.slice(0, 4).map(m => `
        <div class="equipment-card">
            <strong>${escapeHtml(m.title)}</strong>
            <p style="font-size:0.8rem; color:#666; margin:6px 0;">${escapeHtml(m.equipment_type || 'Lab Manual')}</p>
            <button class="btn btn-edit" style="width:100%;" onclick="triggerToast('Opening ${m.title}...')"><i class="fas fa-file-pdf"></i> Read Documentation</button>
        </div>
    `).join('');
}

function renderStudentIssuesTable() {
    document.getElementById('studentReportedIssuesTable').innerHTML = `
        <table style="width:100%">
            <thead><tr><th>Equipment / PC Node</th><th>Priority</th><th>Logged Date</th></tr></thead>
            <tbody>
                ${studentIssues.slice(0, 5).map(i => `
                    <tr><td><strong>${escapeHtml(i.equipment_name)}</strong><br><small style="color:#666;">${escapeHtml(i.description)}</small></td><td><span class="status-badge status-maintenance">${i.severity}</span></td><td>${new Date(i.reported_at).toLocaleDateString()}</td></tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Form submissions
async function handleDeskBooking(e) {
    e.preventDefault();
    const stationId = document.getElementById('deskSelect').value;
    const date = document.getElementById('deskDate').value;
    const startTime = document.getElementById('deskStart').value;
    const endTime = document.getElementById('deskEnd').value;
    const purpose = document.getElementById('deskPurpose').value;
    
    const startDateTime = `${date}T${startTime}`;
    const endDateTime = `${date}T${endTime}`;
    
    try {
        const response = await fetch(`${API_URL}/student/bookings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                equipment_id: stationId,
                start_time: startDateTime,
                end_time: endDateTime,
                purpose: purpose
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Desk reservation submitted successfully!", 'success');
            document.getElementById('deskBookingForm').reset();
            await loadMyBookings();
            renderStudentWorkspace();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error submitting booking', 'error');
    }
}

async function handleStudentExp(e) {
    e.preventDefault();
    const experimentId = document.getElementById('studentExpSelect').value;
    const notes = document.getElementById('studentExpNotes').value;
    const progress = parseInt(document.getElementById('studentExpProgress').value);
    
    try {
        const response = await fetch(`${API_URL}/student/experiments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                booking_id: null,
                title: 'Student Assignment',
                equipment_used: 'Lab Equipment',
                progress: progress,
                notes: notes
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast(`Assignment progress updated to ${progress}%`, 'success');
            document.getElementById('studentExpForm').reset();
            await loadMyExperiments();
            renderStudentWorkspace();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error updating progress', 'error');
    }
}

async function handleAssignmentUpload(e) {
    e.preventDefault();
    const experimentId = document.getElementById('assignContextSelect').value;
    const title = document.getElementById('assignTitle').value;
    const comments = document.getElementById('assignComments').value;
    const fileInput = document.getElementById('assignFile');
    
    if (!experimentId || !title || !fileInput.files[0]) {
        triggerToast("Please fill all fields and select a file", 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('experiment_id', experimentId);
    formData.append('title', title);
    formData.append('conclusion', comments);
    formData.append('assignFile', fileInput.files[0]);
    
    try {
        const response = await fetch(`${API_URL}/student/upload-assignment`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Assignment submitted successfully!", 'success');
            document.getElementById('assignmentForm').reset();
            await loadMySubmissions();
            renderStudentWorkspace();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error submitting assignment', 'error');
    }
}

async function handleStudentIssue(e) {
    e.preventDefault();
    const equipmentId = document.getElementById('issueEquipmentSelect').value;
    const severity = document.getElementById('issueSeverity').value;
    const description = document.getElementById('issueDescription').value;
    
    try {
        const response = await fetch(`${API_URL}/student/issues`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                equipment_id: equipmentId,
                severity: severity.toLowerCase(),
                description: description
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Issue reported successfully!", 'success');
            document.getElementById('studentIssueForm').reset();
            await loadMyIssues();
            renderStudentWorkspace();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error reporting issue', 'error');
    }
}

// Chat functionality
function toggleStudentChat() {
    const drawer = document.getElementById('chatWindow');
    drawer.style.display = drawer.style.display === 'flex' ? 'none' : 'flex';
}

function sendStudentMessage() {
    const input = document.getElementById('chatInput');
    if (input.value.trim()) {
        instructorChats.push({ sender: "You", data: input.value.trim() });
        renderStudentChatWidget();
        input.value = '';
        setTimeout(() => {
            instructorChats.push({ sender: "Instructor", data: "Thanks for your message. I'll help you shortly." });
            renderStudentChatWidget();
        }, 1000);
    }
}

function renderStudentChatWidget() {
    const msgBox = document.getElementById('chatMessages');
    msgBox.innerHTML = instructorChats.map(c => `
        <div class="msg-bubble ${c.sender === 'You' ? 'msg-sent' : 'msg-rcv'}">
            <small style="display:block; font-size:0.7rem; opacity:0.8;">${c.sender}</small>${escapeHtml(c.data)}
        </div>
    `).join('');
    msgBox.scrollTop = msgBox.scrollHeight;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Navigation
function initStudentRouter() {
    document.querySelectorAll(".nav-item").forEach(menuItem => {
        menuItem.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
            menuItem.classList.add("active");

            const sectionKey = menuItem.getAttribute("data-section");
            document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active-section"));
            
            const targetDom = document.getElementById(`${sectionKey}Section`);
            if (targetDom) targetDom.classList.add("active-section");

            const headerTitles = { 
                dashboard: 'Student Overview Panel', 
                'class-booking': 'Book Lab Desk Station', 
                'student-experiments': 'My Experiments Tracker', 
                'submit-assignment': 'Submit Assignment / Report',
                manuals: 'Course Lab Manuals Catalogue',
                'student-issue': 'Report Lab Defect Ticket'
            };
            document.getElementById('pageTitle').innerText = headerTitles[sectionKey] || 'Student Console';

            if (window.innerWidth <= 992) closeStudentSidebar();
        });
    });

    document.querySelectorAll(".btn-act").forEach(actionBtn => {
        actionBtn.addEventListener("click", () => {
            const targetSection = actionBtn.getAttribute("data-target");
            const correspondenceItem = document.querySelector(`.nav-item[data-section="${targetSection}"]`);
            if (correspondenceItem) correspondenceItem.click();
        });
    });
}

function initStudentMobileMenu() {
    const triggerBtn = document.getElementById("menuToggle");
    const navDrawer = document.getElementById("sidebar");
    const backplaneOverlay = document.getElementById("sidebarOverlay");
    const exitSessionBtn = document.getElementById("logoutBtn");

    if (triggerBtn) triggerBtn.addEventListener("click", () => { navDrawer.classList.add("open"); backplaneOverlay.classList.add("open"); });
    if (backplaneOverlay) backplaneOverlay.addEventListener("click", closeStudentSidebar);
    if (exitSessionBtn) exitSessionBtn.addEventListener("click", () => { if (confirm("Log out?")) logout(); });
}

function closeStudentSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("open");
}

function initStudentDateDefaults() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateInput = document.getElementById('deskDate');
    if (dateInput) dateInput.value = todayStr;
    
    const startInput = document.getElementById('deskStart');
    const endInput = document.getElementById('deskEnd');
    if (startInput) startInput.value = "10:00";
    if (endInput) endInput.value = "12:00";
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    if (!checkAuth()) return;
    
    initStudentRouter();
    initStudentMobileMenu();
    initStudentDateDefaults();
    loadAllData();
    renderStudentChatWidget();
});