// API Base URL
const API_URL = 'http://localhost:5000/api';

// Helper function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Show notification
function showNotification(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = "toast-alert";
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 12px 24px;
        border-radius: 8px; color: white; z-index: 1000;
        background-color: ${type === "error" ? "#ef4444" : type === "success" ? "#10b981" : "#3b82f6"};
        animation: fadeIn 0.3s ease;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            document.querySelector('#dashboard .cards').innerHTML = `
                <div class="card"><h3>Total Users</h3><p>${data.stats.totalUsers}</p></div>
                <div class="card"><h3>Pending Approvals</h3><p>${data.stats.pendingApprovals}</p></div>
                <div class="card"><h3>Total Equipment</h3><p>${data.stats.totalEquipment}</p></div>
                <div class="card"><h3>Active Bookings</h3><p>${data.stats.activeBookings}</p></div>
            `;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load users
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.users) {
            const tbody = document.querySelector('#users tbody');
            tbody.innerHTML = data.users.map(user => `
                <tr>
                    <td>${escapeHtml(user.full_name)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${escapeHtml(user.role)}</td>
                    <td>${user.is_approved ? '<span style="color:#10b981;">Approved</span>' : '<span style="color:#f59e0b;">Pending</span>'}</td>
                    <td>
                        ${!user.is_approved && user.role !== 'admin' ? 
                            `<button class="btn btn-approve" onclick="approveUser(${user.id})">Approve</button>
                             <button class="btn btn-reject" onclick="rejectUser(${user.id})">Reject</button>` : 
                            user.role !== 'admin' ?
                            `<button class="btn btn-reject" onclick="rejectUser(${user.id})">Delete</button>` : 
                            'Admin'
                        }
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Approve user
async function approveUser(userId) {
    if (!confirm('Approve this user?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/approve`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('User approved successfully!', 'success');
            loadUsers();
            loadDashboardStats();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error approving user', 'error');
    }
}

// Reject/Delete user
async function rejectUser(userId) {
    if (!confirm('Delete this user?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('User deleted successfully!', 'success');
            loadUsers();
            loadDashboardStats();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error deleting user', 'error');
    }
}

// Load supervisors
async function loadSupervisors() {
    try {
        const response = await fetch(`${API_URL}/admin/supervisors`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.supervisors) {
            const tbody = document.querySelector('#supervisors tbody');
            tbody.innerHTML = data.supervisors.map(sup => `
                <tr>
                    <td>${escapeHtml(sup.full_name)}</td>
                    <td>${escapeHtml(sup.email)}</td>
                    <td>${escapeHtml(sup.department || 'N/A')}</td>
                    <td>Main Lab</td>
                    <td>
                        <button class="btn btn-edit" onclick="editSupervisor(${sup.id})">Edit</button>
                        <button class="btn btn-reject" onclick="deleteSupervisor(${sup.id})">Remove</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading supervisors:', error);
    }
}

// Add supervisor
async function addSupervisor() {
    const name = prompt('Enter supervisor full name:');
    if (!name) return;
    
    const email = prompt('Enter supervisor email:');
    if (!email) return;
    
    const password = prompt('Enter temporary password:');
    if (!password) return;
    
    const department = prompt('Enter department:');
    
    try {
        const response = await fetch(`${API_URL}/admin/supervisors`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                full_name: name,
                email: email,
                password: password,
                department: department || 'General'
            })
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('Supervisor added successfully!', 'success');
            loadSupervisors();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error adding supervisor', 'error');
    }
}

// Delete supervisor
async function deleteSupervisor(userId) {
    if (!confirm('Remove this supervisor?')) return;
    await rejectUser(userId);
}

// Edit supervisor (placeholder)
function editSupervisor(userId) {
    showNotification('Edit functionality coming soon', 'info');
}

// Load equipment
async function loadEquipment() {
    try {
        const response = await fetch(`${API_URL}/admin/equipment`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.equipment) {
            const tbody = document.querySelector('#equipment tbody');
            tbody.innerHTML = data.equipment.map(eq => `
                <tr>
                    <td>${escapeHtml(eq.name)}</td>
                    <td>${escapeHtml(eq.category || 'N/A')}</td>
                    <td><span class="status-badge status-${eq.status}">${eq.status}</span></td>
                    <td>
                        <button class="btn btn-edit" onclick="editEquipment(${eq.id})">Edit</button>
                        <button class="btn btn-reject" onclick="deleteEquipment(${eq.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
    }
}

// Add equipment
async function addEquipment() {
    const name = prompt('Enter equipment name:');
    if (!name) return;
    
    const category = prompt('Enter category:');
    const location = prompt('Enter location:');
    const description = prompt('Enter description:');
    
    try {
        const response = await fetch(`${API_URL}/admin/equipment`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                name: name,
                category: category || 'General',
                location: location || 'Lab',
                status: 'available',
                description: description || ''
            })
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('Equipment added successfully!', 'success');
            loadEquipment();
            loadDashboardStats();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error adding equipment', 'error');
    }
}

// Edit equipment
async function editEquipment(id) {
    const newName = prompt('Enter new equipment name:');
    if (!newName) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/equipment/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name: newName })
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('Equipment updated!', 'success');
            loadEquipment();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error updating equipment', 'error');
    }
}

// Delete equipment
async function deleteEquipment(id) {
    if (!confirm('Delete this equipment?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/equipment/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('Equipment deleted!', 'success');
            loadEquipment();
            loadDashboardStats();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Error deleting equipment', 'error');
    }
}

// Load reports
async function loadReports() {
    try {
        const response = await fetch(`${API_URL}/admin/damage-reports`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.success && data.reports) {
            const tbody = document.querySelector('#reports tbody');
            tbody.innerHTML = data.reports.map(report => `
                <tr>
                    <td>DR${report.id}</td>
                    <td>Damage Report - ${escapeHtml(report.equipment_name)}</td>
                    <td>${new Date(report.reported_at).toLocaleDateString()}</td>
                    <td><button class="btn btn-download" onclick="downloadReport(${report.id})">Download PDF</button></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

function downloadReport(id) {
    showNotification(`Downloading report DR${id}...`, 'info');
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Navigation and initialization
document.addEventListener("DOMContentLoaded", () => {
    if (!checkAuth()) return;
    
    // Initialize all modules
    loadDashboardStats();
    loadUsers();
    loadSupervisors();
    loadEquipment();
    loadReports();
    
    // Navigation
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll(".content-section");
    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    const toggleSidebar = (state) => {
        sidebar.classList.toggle("open", state);
        if (sidebarOverlay) sidebarOverlay.classList.toggle("open", state);
    };

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active-section"));

            link.classList.add("active");
            const targetId = link.getAttribute("href").substring(1);
            document.getElementById(targetId).classList.add("active-section");

            if (window.innerWidth <= 992) toggleSidebar(false);
        });
    });

    const menuToggle = document.getElementById("menuToggle");
    if (menuToggle) {
        menuToggle.addEventListener("click", () => toggleSidebar(true));
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", () => toggleSidebar(false));
    }

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
        if (confirm("Are you sure you want to log out?")) {
            logout();
        }
    });
    
    // Add equipment button
    const addEquipmentBtn = document.querySelector('#equipment .section-header .btn-approve');
    if (addEquipmentBtn) {
        addEquipmentBtn.addEventListener('click', addEquipment);
    }
    
    // Add supervisor button
    const addSupervisorBtn = document.querySelector('#supervisors .section-header .btn-approve');
    if (addSupervisorBtn) {
        addSupervisorBtn.addEventListener('click', addSupervisor);
    }
});