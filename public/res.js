// API Base URL
const API_URL = 'http://localhost:5000/api';

let equipmentList = [];
let myBookings = [];
let myExperiments = [];
let uploadedResults = [];
let reportedDamage = [];
let sopDocuments = [];
let chatMessages = [{ sender: "Supervisor", text: "Welcome! How can I help you?" }];

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
    if (user.role !== 'researcher' && user.role !== 'admin') {
        window.location.href = '/';
        return false;
    }
    document.querySelector('.user-meta strong').innerText = user.name || 'Researcher';
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

// Load all data
async function loadAllData() {
    await Promise.all([
        loadEquipment(),
        loadMyBookings(),
        loadMyExperiments(),
        loadMyResults(),
        loadMyDamageReports(),
        loadSOP()
    ]);
    renderAllModules();
}

async function loadEquipment() {
    try {
        const response = await fetch(`${API_URL}/researcher/equipment`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) equipmentList = data.equipment;
    } catch (error) {
        console.error('Error loading equipment:', error);
    }
}

async function loadMyBookings() {
    try {
        const response = await fetch(`${API_URL}/researcher/my-bookings`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) myBookings = data.bookings;
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

async function loadMyExperiments() {
    try {
        const response = await fetch(`${API_URL}/researcher/my-experiments`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) myExperiments = data.experiments;
    } catch (error) {
        console.error('Error loading experiments:', error);
    }
}

async function loadMyResults() {
    try {
        const response = await fetch(`${API_URL}/researcher/my-results`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) uploadedResults = data.results;
    } catch (error) {
        console.error('Error loading results:', error);
    }
}

async function loadMyDamageReports() {
    try {
        const response = await fetch(`${API_URL}/researcher/damage-reports`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success && data.reports) reportedDamage = data.reports;
    } catch (error) {
        console.error('Error loading damage reports:', error);
    }
}

async function loadSOP() {
    try {
        const response = await fetch(`${API_URL}/researcher/sop`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (data.success) sopDocuments = data.sopDocs;
    } catch (error) {
        console.error('Error loading SOP:', error);
    }
}

// Render functions
function renderAllModules() {
    renderStats();
    renderUpcomingSchedules();
    renderEquipmentStates();
    renderBookingHistory();
    renderExperimentManager();
    renderUploadedResultsTable();
    renderSOPCatalog();
    renderDamageReportsTable();
}

function renderStats() {
    const pendingCount = myBookings.filter(b => b.status === "pending").length;
    const activeCount = myExperiments.filter(e => e.status === "active").length;
    const resultsCount = uploadedResults.length;
    
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div><h3>Pending Schedules</h3><div class="stat-number">${pendingCount}</div></div><div class="stat-icon"><i class="fas fa-hourglass-half"></i></div></div>
        <div class="stat-card"><div><h3>Active Tracking Run</h3><div class="stat-number">${activeCount}</div></div><div class="stat-icon"><i class="fas fa-vial"></i></div></div>
        <div class="stat-card"><div><h3>Uploaded Datasets</h3><div class="stat-number">${resultsCount}</div></div><div class="stat-icon"><i class="fas fa-cloud-upload-alt"></i></div></div>
    `;
}

function renderUpcomingSchedules() {
    const approved = myBookings.filter(b => b.status === "approved");
    document.getElementById('recentBookings').innerHTML = approved.length === 0 ? 
        '<p style="color:#666; font-size:0.9rem;">No approved bookings found.</p>' : 
        approved.map(b => `
            <div class="experiment-card"><strong>${escapeHtml(b.equipment_name)}</strong><br><small><i class="fas fa-clock"></i> ${new Date(b.start_time).toLocaleString()} to ${new Date(b.end_time).toLocaleTimeString()}</small></div>
        `).join('');
}

function renderEquipmentStates() {
    const available = equipmentList.filter(e => e.status === 'available');
    document.getElementById('quickEquipment').innerHTML = equipmentList.slice(0, 5).map(e => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom:1px solid #eee;">
            <span style="font-size:0.9rem;">${escapeHtml(e.name)}</span>
            <span class="status-badge status-${e.status}">${e.status}</span>
        </div>
    `).join('');
    
    const equipmentSelect = document.getElementById('bookingEquipment');
    if (equipmentSelect) {
        equipmentSelect.innerHTML = equipmentList.map(eq => `<option value="${eq.id}">${escapeHtml(eq.name)} (${eq.status})</option>`).join('');
    }
    
    const damageSelect = document.getElementById('damageEquipmentSelect');
    if (damageSelect) {
        damageSelect.innerHTML = equipmentList.map(eq => `<option value="${eq.id}">${escapeHtml(eq.name)}</option>`).join('');
    }
}

function renderBookingHistory() {
    document.getElementById('myBookingsList').innerHTML = `
        <table style="width:100%">
            <thead><tr><th>Equipment</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
                ${myBookings.slice(0, 5).map(b => `
                    <tr><td><strong>${escapeHtml(b.equipment_name)}</strong></td><td><small>${new Date(b.start_time).toLocaleString()}</small></td><td><span class="status-badge status-${b.status}">${b.status}</span></td></tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderExperimentManager() {
    const approvedBookings = myBookings.filter(b => b.status === "approved");
    const expSelect = document.getElementById('expBookingSelect');
    if (expSelect) {
        expSelect.innerHTML = approvedBookings.map(b => `<option value="${b.id}">${escapeHtml(b.equipment_name)} (${new Date(b.start_time).toLocaleDateString()})</option>`).join('');
    }
    
    const uploadSelect = document.getElementById('uploadExpSelect');
    if (uploadSelect) {
        uploadSelect.innerHTML = myExperiments.map(e => `<option value="${e.id}">${escapeHtml(e.title || 'Experiment')}</option>`).join('');
    }
    
    const activeExps = myExperiments.filter(e => e.status === "active");
    document.getElementById('pastResults').innerHTML = activeExps.length === 0 ? 
        '<p style="color:#666; font-size:0.9rem;">No active logs tracked currently.</p>' : 
        activeExps.map(e => `
            <div class="experiment-card">
                <strong>${escapeHtml(e.title || 'Experiment')}</strong><br>
                <small>Equipment: ${escapeHtml(e.equipment_name || 'N/A')}</small>
                <div style="background:#e5e7eb; height:6px; border-radius:3px; margin:8px 0;"><div style="background:#3b82f6; width:${e.progress}%; height:100%; border-radius:3px;"></div></div>
                <small>Progress: ${e.progress}%</small>
            </div>
        `).join('');
}

function renderUploadedResultsTable() {
    document.getElementById('uploadedResultsTable').innerHTML = `
        <table style="width:100%">
            <thead><tr><th>Experiment</th><th>File</th><th>Upload Date</th></tr></thead>
            <tbody>
                ${uploadedResults.slice(0, 5).map(r => `
                    <tr><td><strong>${escapeHtml(r.experiment_title)}</strong><br><small style="color:#666;">${escapeHtml(r.conclusion || '')}</small></td><td><i class="fas fa-file-alt"></i> ${escapeHtml(r.file_name || 'File')}</td><td>${new Date(r.uploaded_at).toLocaleDateString()}</td></tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderSOPCatalog() {
    document.getElementById('sopList').innerHTML = sopDocuments.slice(0, 4).map(s => `
        <div class="equipment-card">
            <strong>${escapeHtml(s.title)}</strong>
            <p style="font-size:0.8rem; color:#666; margin:6px 0;">${escapeHtml(s.equipment_type || 'General')}</p>
            <button class="btn btn-edit" style="width:100%;" onclick="triggerToast('Opening ${s.title}...')"><i class="fas fa-file-download"></i> Read Documentation</button>
        </div>
    `).join('');
}

function renderDamageReportsTable() {
    document.getElementById('reportedDamageTable').innerHTML = `
        <table style="width:100%">
            <thead><tr><th>Equipment</th><th>Severity</th><th>Report Date</th></tr></thead>
            <tbody>
                ${reportedDamage.slice(0, 5).map(d => `
                    <tr><td><strong>${escapeHtml(d.equipment_name)}</strong><br><small>${escapeHtml(d.description)}</small></td><td><span class="status-badge status-maintenance">${d.severity}</span></td><td>${new Date(d.reported_at).toLocaleDateString()}</td></tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Form submissions
async function submitBooking(e) {
    e.preventDefault();
    const equipmentId = document.getElementById('bookingEquipment').value;
    const start = document.getElementById('bookingStart').value;
    const end = document.getElementById('bookingEnd').value;
    const plan = document.getElementById('bookingPlan').value;
    
    if (!equipmentId || !start || !end) {
        triggerToast("Please fill all fields", 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/researcher/bookings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                equipment_id: equipmentId,
                start_time: start,
                end_time: end,
                purpose: plan
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Booking request submitted successfully!", 'success');
            document.getElementById('bookingForm').reset();
            await loadMyBookings();
            renderAllModules();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error submitting booking', 'error');
    }
}

async function submitExperiment(e) {
    e.preventDefault();
    const bookingId = document.getElementById('expBookingSelect').value;
    const notes = document.getElementById('expNotes').value;
    const progress = parseInt(document.getElementById('expProgress').value);
    
    const booking = myBookings.find(b => b.id == bookingId);
    const title = booking ? `Experiment with ${booking.equipment_name}` : 'Research Experiment';
    
    try {
        const response = await fetch(`${API_URL}/researcher/experiments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                booking_id: bookingId,
                title: title,
                equipment_used: booking?.equipment_name,
                progress: progress,
                notes: notes
            })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast(`Experiment progress updated to ${progress}%`, 'success');
            document.getElementById('experimentForm').reset();
            await loadMyExperiments();
            renderAllModules();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error saving experiment', 'error');
    }
}

async function handleResultUpload(e) {
    e.preventDefault();
    const experimentId = document.getElementById('uploadExpSelect').value;
    const title = document.getElementById('resultTitle').value;
    const conclusion = document.getElementById('resultConclusion').value;
    const fileInput = document.getElementById('resultFile');
    
    if (!experimentId || !title || !fileInput.files[0]) {
        triggerToast("Please fill all fields and select a file", 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('experiment_id', experimentId);
    formData.append('title', title);
    formData.append('conclusion', conclusion);
    formData.append('resultFile', fileInput.files[0]);
    
    try {
        const response = await fetch(`${API_URL}/researcher/upload-result`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast("Results uploaded successfully!", 'success');
            document.getElementById('resultUploadForm').reset();
            await loadMyResults();
            renderAllModules();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error uploading results', 'error');
    }
}

async function handleDamageReport(e) {
    e.preventDefault();
    const equipmentId = document.getElementById('damageEquipmentSelect').value;
    const severity = document.getElementById('damageSeverity').value;
    const description = document.getElementById('damageDescription').value;
    
    try {
        const response = await fetch(`${API_URL}/researcher/damage-reports`, {
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
            triggerToast("Damage report filed successfully!", 'success');
            document.getElementById('damageReportForm').reset();
            await loadMyDamageReports();
            renderAllModules();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error submitting report', 'error');
    }
}

// Chat functionality
function toggleChat() {
    const win = document.getElementById('chatWindow');
    win.style.display = win.style.display === 'flex' ? 'none' : 'flex';
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    if (input.value.trim()) {
        chatMessages.push({ sender: "You", text: input.value.trim() });
        renderChatWidget();
        input.value = '';
        setTimeout(() => {
            chatMessages.push({ sender: "Supervisor", text: "Thanks for your message. I'll get back to you shortly." });
            renderChatWidget();
        }, 1000);
    }
}

function renderChatWidget() {
    const msgBox = document.getElementById('chatMessages');
    msgBox.innerHTML = chatMessages.map(c => `
        <div class="msg-bubble ${c.sender === 'You' ? 'msg-sent' : 'msg-rcv'}">
            <small style="display:block; font-size:0.7rem; opacity:0.8;">${c.sender}</small>${escapeHtml(c.text)}
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
function initViewRouter() {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const targetSection = item.getAttribute("data-section");
            document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active-section"));
            
            const activeSec = document.getElementById(`${targetSection}Section`);
            if (activeSec) activeSec.classList.add("active-section");

            const titles = { 
                dashboard: 'Researcher Overview', 
                booking: 'Book Lab Equipment', 
                experiments: 'My Experiments Tracker', 
                'upload-results': 'Upload My Results Archive',
                sop: 'SOP & Safety Protocols',
                'damage-report': 'Equipment Damage Statements'
            };
            document.getElementById('pageTitle').innerText = titles[targetSection] || 'Workspace';

            if (window.innerWidth <= 992) closeMobileSidebar();
        });
    });

    document.querySelectorAll(".btn-act").forEach(btn => {
        btn.addEventListener("click", () => {
            const dest = btn.getAttribute("data-target");
            const sideItem = document.querySelector(`.nav-item[data-section="${dest}"]`);
            if (sideItem) sideItem.click();
        });
    });
}

function initMobileNavigation() {
    const toggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const logout = document.getElementById("logoutBtn");

    if (toggle) toggle.addEventListener("click", () => { sidebar.classList.add("open"); overlay.classList.add("open"); });
    if (overlay) overlay.addEventListener("click", closeMobileSidebar);
    if (logout) logout.addEventListener("click", () => { if (confirm("Log out?")) logout(); });
}

function closeMobileSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("open");
}

function initDateDefaults() {
    let now = new Date();
    let tomorrow = new Date(now.getTime() + 24 * 3600000);
    const startInput = document.getElementById('bookingStart');
    const endInput = document.getElementById('bookingEnd');
    if (startInput) startInput.value = now.toISOString().slice(0, 16);
    if (endInput) endInput.value = tomorrow.toISOString().slice(0, 16);
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    if (!checkAuth()) return;
    
    initViewRouter();
    initMobileNavigation();
    initDateDefaults();
    loadAllData();
    renderChatWidget();
});