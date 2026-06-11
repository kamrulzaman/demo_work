// API Base URL
const API_URL = 'http://localhost:5000/api';

let equipmentData = [];
let bookingsData = [];
let experimentsData = [];

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
    if (user.role !== 'supervisor' && user.role !== 'admin') {
        window.location.href = '/';
        return false;
    }
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

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/supervisor/stats`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statsGrid').innerHTML = `
                <div class="stat-card"><div><h3>Pending Requests</h3><div class="stat-number">${data.stats.pendingBookings}</div></div><div class="stat-icon"><i class="fas fa-clock"></i></div></div>
                <div class="stat-card"><div><h3>Active Experiments</h3><div class="stat-number">${data.stats.activeExperiments}</div></div><div class="stat-icon"><i class="fas fa-chart-line"></i></div></div>
                <div class="stat-card"><div><h3>Available Gears</h3><div class="stat-number">${data.stats.availableEquipment}</div></div><div class="stat-icon"><i class="fas fa-microscope"></i></div></div>
            `;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadBookings(filter = 'all') {
    try {
        const response = await fetch(`${API_URL}/supervisor/bookings?status=${filter}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            bookingsData = data.bookings;
            renderBookingRequests(filter);
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

function renderBookingRequests(filter) {
    let filtered = bookingsData;
    if (filter !== 'all') {
        filtered = bookingsData.filter(b => b.status === filter);
    }
    
    document.getElementById('allRequests').innerHTML = filtered.length === 0 ? 
        '<p>No requests matching criteria.</p>' : 
        filtered.map(b => `
            <div class="booking-request">
                <div class="request-header"><strong>${escapeHtml(b.equipment_name)}</strong><span class="status-badge status-${b.status}">${b.status}</span></div>
                <p>User: ${escapeHtml(b.user_name)} | ${new Date(b.start_time).toLocaleString()} to ${new Date(b.end_time).toLocaleString()}</p>
                <p><small>Purpose: ${escapeHtml(b.purpose || 'N/A')}</small></p>
                ${b.status === 'pending' ? `
                    <div class="request-actions">
                        <button class="btn btn-approve" onclick="updateBookingStatus(${b.id}, 'approved')">Approve</button>
                        <button class="btn btn-reject" onclick="updateBookingStatus(${b.id}, 'rejected')">Reject</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    
    // Update preview
    const pending = bookingsData.filter(b => b.status === 'pending');
    document.getElementById('pendingRequestsPreview').innerHTML = pending.length === 0 ? 
        '<p>No pending approvals.</p>' : 
        pending.slice(0, 3).map(b => `
            <div class="booking-request">
                <div class="request-header"><strong>${escapeHtml(b.equipment_name)}</strong><span>${new Date(b.start_time).toLocaleDateString()}</span></div>
                <p>${escapeHtml(b.user_name)} - ${escapeHtml(b.purpose || 'No purpose')}</p>
                <div class="request-actions">
                    <button class="btn btn-approve" onclick="updateBookingStatus(${b.id}, 'approved')">Approve</button>
                    <button class="btn btn-reject" onclick="updateBookingStatus(${b.id}, 'rejected')">Reject</button>
                </div>
            </div>
        `).join('');
    
    // Today's schedule
    const today = new Date().toISOString().slice(0, 10);
    const todaysBookings = bookingsData.filter(b => b.status === 'approved' && b.start_time.startsWith(today));
    document.getElementById('todaySchedule').innerHTML = todaysBookings.length === 0 ? 
        '<p>No tasks scheduled today.</p>' : 
        todaysBookings.map(b => `
            <div class="experiment-card"><strong>${escapeHtml(b.equipment_name)}</strong> (${new Date(b.start_time).toLocaleTimeString()} - ${new Date(b.end_time).toLocaleTimeString()})<br><small>User: ${escapeHtml(b.user_name)}</small></div>
        `).join('');
}

async function updateBookingStatus(id, status) {
    try {
        const response = await fetch(`${API_URL}/supervisor/bookings/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast(`Booking ${status} successfully!`, 'success');
            loadBookings(document.getElementById('requestFilter')?.value || 'all');
            loadStats();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error updating booking', 'error');
    }
}

async function loadEquipment() {
    try {
        const response = await fetch(`${API_URL}/supervisor/equipment`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            equipmentData = data.equipment;
            document.getElementById('equipmentGrid').innerHTML = equipmentData.map(e => `
                <div class="equipment-card">
                    <div class="equipment-header"><strong>${escapeHtml(e.name)}</strong><span class="status-badge status-${e.status}">${e.status}</span></div>
                    <p style="font-size:0.85rem; color:#666; margin-bottom:10px;"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(e.location || 'Lab')}</p>
                    <select onchange="updateEquipmentStatus(${e.id}, this.value)" style="width:100%; padding:4px;">
                        <option value="available" ${e.status === 'available' ? 'selected' : ''}>Available</option>
                        <option value="inuse" ${e.status === 'inuse' ? 'selected' : ''}>In Use</option>
                        <option value="maintenance" ${e.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                    </select>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
    }
}

async function updateEquipmentStatus(id, status) {
    try {
        const response = await fetch(`${API_URL}/supervisor/equipment/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status })
        });
        const data = await response.json();
        
        if (data.success) {
            triggerToast(`Equipment status updated to ${status}`, 'success');
            loadEquipment();
            loadStats();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error updating status', 'error');
    }
}

async function loadExperiments() {
    try {
        const response = await fetch(`${API_URL}/supervisor/experiments`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            experimentsData = data.experiments;
            const active = experimentsData.filter(e => e.status === 'active');
            const completed = experimentsData.filter(e => e.status === 'completed');
            
            document.getElementById('activeExperiments').innerHTML = active.length === 0 ? 
                '<p>No currently active tracking sessions.</p>' : 
                active.map(e => `
                    <div class="experiment-card">
                        <strong>${escapeHtml(e.title || e.equipment_name)}</strong> - ${escapeHtml(e.researcher_name)}
                        <div class="experiment-progress"><div class="progress-bar" style="width:${e.progress}%"></div></div>
                        <div class="request-header"><span style="font-size:0.8rem">Progress: ${e.progress}%</span><button class="btn btn-edit" onclick="openVerifyModal(${e.id})">Verify Progress</button></div>
                    </div>
                `).join('');
            
            document.getElementById('completedExperiments').innerHTML = completed.length === 0 ? 
                '<p>No completed experiments.</p>' : 
                completed.map(e => `
                    <div class="experiment-card"><strong>${escapeHtml(e.title || e.equipment_name)}</strong> - ${escapeHtml(e.researcher_name)}<br><small>Completed: ${new Date(e.completed_at).toLocaleDateString()}</small></div>
                `).join('');
        }
    } catch (error) {
        console.error('Error loading experiments:', error);
    }
}

function openVerifyModal(expId) {
    document.getElementById('verifyExpId').value = expId;
    openModal('verifyModal');
}

async function confirmVerification() {
    const id = parseInt(document.getElementById('verifyExpId').value);
    const notes = document.getElementById('verifyNotes').value;
    
    try {
        const response = await fetch(`${API_URL}/supervisor/experiments/${id}/progress`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ progress: 100, notes: notes })
        });
        const data = await response.json();
        
        if (data.success) {
            closeModal('verifyModal');
            triggerToast("Experiment verified successfully!", 'success');
            loadExperiments();
            loadStats();
        } else {
            triggerToast(data.message, 'error');
        }
    } catch (error) {
        triggerToast('Error verifying experiment', 'error');
    }
}

async function loadSOP() {
    try {
        const response = await fetch(`${API_URL}/supervisor/sop`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.sopDocs) {
            document.getElementById('sopDocuments').innerHTML = data.sopDocs.map(d => `
                <div class="equipment-card">
                    <strong>${escapeHtml(d.title)}</strong>
                    <p style="font-size:0.85rem;margin:5px 0;">Equipment: ${escapeHtml(d.equipment_type || 'General')}</p>
                    <button class="btn btn-edit" onclick="triggerToast('Downloading ${d.title}...')"><i class="fas fa-download"></i> Download</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading SOP:', error);
    }
}

function uploadSOP() {
    const title = document.getElementById('sopTitle').value;
    if (!title) {
        triggerToast("Please enter a title", 'error');
        return;
    }
    
    triggerToast("SOP uploaded successfully!", 'success');
    closeModal('sopModal');
    loadSOP();
}

async function loadDamageReports() {
    try {
        const response = await fetch(`${API_URL}/supervisor/damage-reports`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.reports) {
            document.getElementById('damageReportsTable').innerHTML = `
                <table>
                    <thead><tr><th>Equipment</th><th>Severity</th><th>Reported By</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                        ${data.reports.map(r => `
                            <tr>
                                <td>${escapeHtml(r.equipment_name)}</td>
                                <td><span class="status-badge status-maintenance">${r.severity}</span></td>
                                <td>${escapeHtml(r.reported_by_name)}</td>
                                <td>${r.status}</td>
                                <td>${new Date(r.reported_at).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (error) {
        console.error('Error loading damage reports:', error);
    }
}

function submitDamageReport() {
    const equipment = document.getElementById('damageEquipment').value;
    const severity = document.getElementById('damageSeverity').value;
    const description = document.getElementById('damageDescription').value;
    const reporter = document.getElementById('damageReporter').value;
    
    if (!description || !reporter) {
        triggerToast("Please fill in all fields", 'error');
        return;
    }
    
    triggerToast("Damage report submitted successfully!", 'success');
    closeModal('damageModal');
    loadDamageReports();
}

function filterRequests() {
    loadBookings(document.getElementById('requestFilter').value);
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

// Chat functionality
let chatMessages = [
    { sender: "researcher", text: "Hello, I need assistance with the microscope" },
    { sender: "supervisor", text: "Sure, I'll be there in 10 minutes" }
];

function toggleChat() {
    const win = document.getElementById('chatWindow');
    win.style.display = win.style.display === 'flex' ? 'none' : 'flex';
}

function sendMessage() {
    const inp = document.getElementById('chatInput');
    if (inp.value.trim()) {
        chatMessages.push({ sender: 'supervisor', text: inp.value.trim() });
        renderChatDisplay();
        inp.value = '';
    }
}

function renderChatDisplay() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = chatMessages.map(m => `
        <div class="msg-bubble ${m.sender === 'supervisor' ? 'msg-sent' : 'msg-rcv'}">
            <small style="display:block; font-size:0.7rem;">${m.sender}</small>${escapeHtml(m.text)}
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Navigation
function initViewRouter() {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const sectionTarget = item.getAttribute("data-section");
            document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active-section"));
            
            const activeSection = document.getElementById(`${sectionTarget}Section`);
            if(activeSection) activeSection.classList.add("active-section");
            
            const titles = { 
                dashboard: 'Supervisor Dashboard', 
                requests: 'Booking Requests', 
                equipment: 'Equipment Status', 
                experiments: 'Track Experiments', 
                sop: 'SOP & Safety Documents', 
                damage: 'Damage Reports' 
            };
            document.getElementById('pageTitle').innerText = titles[sectionTarget] || 'Dashboard';
            
            if (window.innerWidth <= 992) closeMobileSidebar();
        });
    });
}

function initMobileNavigation() {
    const toggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const logoutBtn = document.getElementById("logoutBtn");

    if (toggle) toggle.addEventListener("click", () => { sidebar.classList.add("open"); overlay.classList.add("open"); });
    if (overlay) overlay.addEventListener("click", closeMobileSidebar);
    if (logoutBtn) logoutBtn.addEventListener("click", () => { if(confirm("Log out?")) logout(); });
}

function closeMobileSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("open");
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    if (!checkAuth()) return;
    
    initViewRouter();
    initMobileNavigation();
    
    loadStats();
    loadBookings('all');
    loadEquipment();
    loadExperiments();
    loadSOP();
    loadDamageReports();
    renderChatDisplay();
});