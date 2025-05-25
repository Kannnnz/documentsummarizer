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

function getUsageColor(percentage