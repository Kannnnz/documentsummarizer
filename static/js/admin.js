// Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminDashboard();
    loadAdminStats();
    initializeAdminCharts();
    initializeUserManagement();
});

function initializeAdminDashboard() {
    // Initialize admin-specific components
    initializeAdminSidebar();
    loadSystemStatus();
    initializeRealTimeMonitoring();
}

function initializeAdminSidebar() {
    const sidebarLinks = document.querySelectorAll('.admin-menu a');
    const currentPath = window.location.pathname;
    
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
        
        link.addEventListener('click', function(e) {
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

async function loadAdminStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        if (data.success) {
            updateAdminStats(data.stats);
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

function updateAdminStats(stats) {
    // Update total users
    const totalUsers = document.getElementById('total-users');
    if (totalUsers) {
        animateCounter(totalUsers, stats.total_users || 0);
    }
    
    // Update total documents
    const totalDocuments = document.getElementById('total-documents');
    if (totalDocuments) {
        animateCounter(totalDocuments, stats.total_documents || 0);
    }
    
    // Update total questions
    const totalQuestions = document.getElementById('total-questions');
    if (totalQuestions) {
        animateCounter(totalQuestions, stats.total_questions || 0);
    }
    
    // Update system storage
    const systemStorage = document.getElementById('system-storage');
    if (systemStorage) {
        systemStorage.textContent = formatFileSize(stats.system_storage || 0);
    }
    
    // Update active sessions
    const activeSessions = document.getElementById('active-sessions');
    if (activeSessions) {
        animateCounter(activeSessions, stats.active_sessions || 0);
    }
}

function animateCounter(element, targetValue) {
    const startValue = 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
        
        element.textContent = currentValue.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

function loadSystemStatus() {
    fetch('/api/admin/system-status')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateSystemStatus(data.status);
            }
        })
        .catch(error => console.error('Error loading system status:', error));
}

function updateSystemStatus(status) {
    // Update server status
    const serverStatus = document.getElementById('server-status');
    if (serverStatus) {
        serverStatus.innerHTML = `
            <span class="status-indicator ${status.server.healthy ? 'status-online' : 'status-offline'}"></span>
            ${status.server.healthy ? 'Online' : 'Offline'}
        `;
    }
    
    // Update database status
    const dbStatus = document.getElementById('database-status');
    if (dbStatus) {
        dbStatus.innerHTML = `
            <span class="status-indicator ${status.database.healthy ? 'status-online' : 'status-offline'}"></span>
            ${status.database.healthy ? 'Connected' : 'Error'}
        `;
    }
    
    // Update LLM model status
    const llmStatus = document.getElementById('llm-status');
    if (llmStatus) {
        llmStatus.innerHTML = `
            <span class="status-indicator ${status.llm.healthy ? 'status-online' : 'status-offline'}"></span>
            ${status.llm.healthy ? 'Ready' : 'Error'}
        `;
    }
    
    // Update CPU usage
    const cpuUsage = document.getElementById('cpu-usage');
    if (cpuUsage) {
        const percentage = status.system.cpu_usage || 0;
        cpuUsage.innerHTML = `
            <div class="usage-bar">
                <div class="usage-fill" style="width: ${percentage}%; background-color: ${getUsageColor(percentage)}"></div>
            </div>
            <span>${percentage}%</span>
        `;
    }
    
    // Update memory usage
    const memoryUsage = document.getElementById('memory-usage');
    if (memoryUsage) {
        const percentage = status.system.memory_usage || 0;
        memoryUsage.innerHTML = `
            <div class="usage-bar">
                <div class="usage-fill" style="width: ${percentage}%; background-color: ${getUsageColor(percentage)}"></div>
            </div>
            <span>${percentage}%</span>
        `;
    }
}

function getUsageColor(percentage) {
    if (percentage < 50) return '#28a745';
    if (percentage < 80) return '#ffc107';
    return '#dc3545';
}

function initializeAdminCharts() {
    // Initialize usage charts
    initializeUsageChart();
    initializeUserActivityChart();
    initializeDocumentChart();
}

function initializeUsageChart() {
    const ctx = document.getElementById('usage-chart');
    if (!ctx) return;
    
    fetch('/api/admin/usage-data')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                createUsageChart(ctx, data.usage_data);
            }
        })
        .catch(error => console.error('Error loading usage data:', error));
}

function createUsageChart(ctx, data) {
    // Simple chart implementation without external libraries
    const canvas = ctx.getContext('2d');
    const width = ctx.width;
    const height = ctx.height;
    
    // Clear canvas
    canvas.clearRect(0, 0, width, height);
    
    // Draw chart background
    canvas.fillStyle = '#f8f9fa';
    canvas.fillRect(0, 0, width, height);
    
    // Draw usage data as simple bars
    const barWidth = width / data.length;
    const maxValue = Math.max(...data.map(d => d.value));
    
    data.forEach((item, index) => {
        const barHeight = (item.value / maxValue) * (height - 40);
        const x = index * barWidth;
        const y = height - barHeight - 20;
        
        canvas.fillStyle = '#007bff';
        canvas.fillRect(x + 5, y, barWidth - 10, barHeight);
        
        // Draw labels
        canvas.fillStyle = '#333';
        canvas.font = '12px Arial';
        canvas.fillText(item.label, x + 5, height - 5);
    });
}

function initializeUserActivityChart() {
    const ctx = document.getElementById('activity-chart');
    if (!ctx) return;
    
    fetch('/api/admin/activity-data')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                createActivityChart(ctx, data.activity_data);
            }
        })
        .catch(error => console.error('Error loading activity data:', error));
}

function createActivityChart(ctx, data) {
    const canvas = ctx.getContext('2d');
    const width = ctx.width;
    const height = ctx.height;
    
    canvas.clearRect(0, 0, width, height);
    canvas.fillStyle = '#f8f9fa';
    canvas.fillRect(0, 0, width, height);
    
    // Draw line chart for activity
    if (data.length > 0) {
        const stepX = width / (data.length - 1);
        const maxValue = Math.max(...data.map(d => d.value));
        
        canvas.beginPath();
        canvas.strokeStyle = '#28a745';
        canvas.lineWidth = 2;
        
        data.forEach((item, index) => {
            const x = index * stepX;
            const y = height - ((item.value / maxValue) * (height - 40)) - 20;
            
            if (index === 0) {
                canvas.moveTo(x, y);
            } else {
                canvas.lineTo(x, y);
            }
        });
        
        canvas.stroke();
    }
}

function initializeDocumentChart() {
    const ctx = document.getElementById('document-chart');
    if (!ctx) return;
    
    fetch('/api/admin/document-data')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                createDocumentChart(ctx, data.document_data);
            }
        })
        .catch(error => console.error('Error loading document data:', error));
}

function createDocumentChart(ctx, data) {
    const canvas = ctx.getContext('2d');
    const width = ctx.width;
    const height = ctx.height;
    
    canvas.clearRect(0, 0, width, height);
    
    // Draw pie chart for document types
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;
    
    let currentAngle = 0;
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1'];
    
    data.forEach((item, index) => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        
        canvas.beginPath();
        canvas.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        canvas.lineTo(centerX, centerY);
        canvas.fillStyle = colors[index % colors.length];
        canvas.fill();
        
        currentAngle += sliceAngle;
    });
}

function initializeUserManagement() {
    // Initialize user management functionality
    loadUserList();
    initializeUserActions();
    initializeUserFilters();
}

function loadUserList() {
    fetch('/api/admin/users')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayUserList(data.users);
            }
        })
        .catch(error => console.error('Error loading users:', error));
}

function displayUserList(users) {
    const userTableBody = document.getElementById('user-table-body');
    if (!userTableBody) return;
    
    userTableBody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <img src="${user.avatar || '/static/images/default-avatar.png'}" 
                     alt="${user.name}" class="user-avatar">
                <span>${user.name}</span>
            </td>
            <td>${user.email}</td>
            <td>
                <span class="user-type-badge ${user.user_type}">${user.user_type}</span>
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td>${formatDate(user.last_login)}</td>
            <td>
                <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})">
                        Edit
                    </button>
                    <button class="btn btn-sm btn-${user.is_active ? 'warning' : 'success'}" 
                            onclick="toggleUserStatus(${user.id})">
                        ${user.is_active ? 'Suspend' : 'Activate'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">
                        Delete
                    </button>
                </div>
            </td>
        `;
        userTableBody.appendChild(row);
    });
}

function initializeUserActions() {
    // Add user button
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', showAddUserModal);
    }
    
    // Search functionality
    const userSearch = document.getElementById('user-search');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(handleUserSearch, 300));
    }
}

function initializeUserFilters() {
    const filterButtons = document.querySelectorAll('.user-filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            const filter = this.dataset.filter;
            filterUsers(filter);
        });
    });
}

function handleUserSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const userRows = document.querySelectorAll('#user-table-body tr');
    
    userRows.forEach(row => {
        const name = row.querySelector('td:first-child span').textContent.toLowerCase();
        const email = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
        
        if (name.includes(searchTerm) || email.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function filterUsers(filter) {
    const userRows = document.querySelectorAll('#user-table-body tr');
    
    userRows.forEach(row => {
        if (filter === 'all') {
            row.style.display = '';
        } else {
            const userType = row.querySelector('.user-type-badge').textContent.toLowerCase();
            const status = row.querySelector('.status-badge').textContent.toLowerCase();
            
            let shouldShow = false;
            
            switch(filter) {
                case 'students':
                    shouldShow = userType === 'student';
                    break;
                case 'lecturers':
                    shouldShow = userType === 'lecturer';
                    break;
                case 'active':
                    shouldShow = status === 'active';
                    break;
                case 'inactive':
                    shouldShow = status === 'inactive';
                    break;
            }
            
            row.style.display = shouldShow ? '' : 'none';
        }
    });
}

function editUser(userId) {
    fetch(`/api/admin/users/${userId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showEditUserModal(data.user);
            }
        })
        .catch(error => console.error('Error loading user data:', error));
}

function showEditUserModal(user) {
    const modal = document.getElementById('edit-user-modal');
    if (!modal) return;
    
    // Fill form with user data
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-name').value = user.name;
    document.getElementById('edit-user-email').value = user.email;
    document.getElementById('edit-user-type').value = user.user_type;
    document.getElementById('edit-user-active').checked = user.is_active;
    
    modal.style.display = 'block';
}

function showAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    if (!modal) return;
    
    // Clear form
    document.getElementById('add-user-form').reset();
    modal.style.display = 'block';
}

function toggleUserStatus(userId) {
    if (confirm('Are you sure you want to change this user\'s status?')) {
        fetch(`/api/admin/users/${userId}/toggle-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('User status updated successfully', 'success');
                loadUserList(); // Reload the user list
            } else {
                showNotification('Error updating user status', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error updating user status', 'error');
        });
    }
}

function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('User deleted successfully', 'success');
                loadUserList(); // Reload the user list
            } else {
                showNotification('Error deleting user', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error deleting user', 'error');
        });
    }
}

function initializeRealTimeMonitoring() {
    // Set up real-time monitoring with WebSocket or polling
    setInterval(() => {
        loadSystemStatus();
        updateRealtimeStats();
    }, 30000); // Update every 30 seconds
}

function updateRealtimeStats() {
    fetch('/api/admin/realtime-stats')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update active sessions counter
                const activeSessions = document.getElementById('active-sessions');
                if (activeSessions) {
                    activeSessions.textContent = data.stats.active_sessions;
                }
                
                // Update recent activity
                updateRecentActivity(data.stats.recent_activity);
            }
        })
        .catch(error => console.error('Error loading realtime stats:', error));
}

function updateRecentActivity(activities) {
    const activityList = document.getElementById('recent-activity-list');
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="icon-${activity.type}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text">${activity.description}</div>
                <div class="activity-time">${formatTimeAgo(activity.timestamp)}</div>
            </div>
        `;
        activityList.appendChild(activityItem);
    });
}

// Utility functions
function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return Math.floor(diffInSeconds / 60) + ' minutes ago';
    if (diffInSeconds < 86400) return Math.floor(diffInSeconds / 3600) + ' hours ago';
    return Math.floor(diffInSeconds / 86400) + ' days ago';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Modal functionality
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
    
    if (e.target.classList.contains('modal-close')) {
        e.target.closest('.modal').style.display = 'none';
    }
});

// Form submissions
document.addEventListener('submit', function(e) {
    if (e.target.id === 'add-user-form') {
        e.preventDefault();
        handleAddUser(e.target);
    }
    
    if (e.target.id === 'edit-user-form') {
        e.preventDefault();
        handleEditUser(e.target);
    }
});

function handleAddUser(form) {
    const formData = new FormData(form);
    const userData = Object.fromEntries(formData);
    
    fetch('/api/admin/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('User added successfully', 'success');
            document.getElementById('add-user-modal').style.display = 'none';
            loadUserList();
        } else {
            showNotification(data.message || 'Error adding user', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error adding user', 'error');
    });
}

function handleEditUser(form) {
    const formData = new FormData(form);
    const userData = Object.fromEntries(formData);
    const userId = userData.id;
    
    fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('User updated successfully', 'success');
            document.getElementById('edit-user-modal').style.display = 'none';
            loadUserList();
        } else {
            showNotification(data.message || 'Error updating user', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error updating user', 'error');
    });
}
