// Dashboard JavaScript untuk User dan Admin
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    initializeCharts();
    initializeRealTimeUpdates();
});

function initializeDashboard() {
    // Load user statistics
    loadUserStats();
    
    // Load recent activity
    loadRecentActivity();
    
    // Initialize dashboard widgets
    initializeWidgets();
}

// Load user statistics
async function loadUserStats() {
    try {
        const response = await fetch('/api/user/stats');
        const data = await response.json();
        
        if (data.success) {
            updateStatCards(data.stats);
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

function updateStatCards(stats) {
    // Update documents processed
    const docsProcessed = document.getElementById('docs-processed');
    if (docsProcessed) {
        docsProcessed.textContent = stats.documents_processed || 0;
    }
    
    // Update questions asked
    const questionsAsked = document.getElementById('questions-asked');
    if (questionsAsked) {
        questionsAsked.textContent = stats.questions_asked || 0;
    }
    
    // Update chat sessions
    const chatSessions = document.getElementById('chat-sessions');
    if (chatSessions) {
        chatSessions.textContent = stats.chat_sessions || 0;
    }
    
    // Update storage used
    const storageUsed = document.getElementById('storage-used');
    if (storageUsed) {
        storageUsed.textContent = formatFileSize(stats.storage_used || 0);
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const response = await fetch('/api/user/recent-activity');
        const data = await response.json();
        
        if (data.success) {
            updateRecentActivity(data.activities);
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

function updateRecentActivity(activities) {
    const activityContainer = document.getElementById('recent-activity');
    if (!activityContainer) return;
    
    activityContainer.innerHTML = '';
    
    if (activities.length === 0) {
        activityContainer.innerHTML = '<p class="text-muted">Belum ada aktivitas terbaru.</p>';
        return;
    }
    
    activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-description">${activity.description}</div>
            <div class="activity-time">${formatDateTime(activity.timestamp)}</div>
        `;
        activityContainer.appendChild(activityItem);
    });
}

// Initialize charts
function initializeCharts() {
    // Usage chart
    initializeUsageChart();
    
    // Document types chart
    initializeDocumentTypesChart();
}

function initializeUsageChart() {
    const ctx = document.getElementById('usage-chart');
    if (!ctx) return;
    
    // Fetch usage data
    fetch('/api/user/usage-data')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            label: 'Dokumen Diproses',
                            data: data.documents,
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            tension: 0.4
                        }, {
                            label: 'Pertanyaan Diajukan',
                            data: data.questions,
                            borderColor: '#2ecc71',
                            backgroundColor: 'rgba(46, 204, 113, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            }
        })
        .catch(error => console.error('Error loading usage chart:', error));
}

function initializeDocumentTypesChart() {
    const ctx = document.getElementById('document-types-chart');
    if (!ctx) return;
    
    fetch('/api/user/document-types')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            data: data.values,
                            backgroundColor: [
                                '#3498db',
                                '#2ecc71',
                                '#f39c12',
                                '#e74c3c',
                                '#9b59b6'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }
        })
        .catch(error => console.error('Error loading document types chart:', error));
}

// Initialize widgets
function initializeWidgets() {
    // Quick upload widget
    initializeQuickUpload();
    
    // Chat history widget
    initializeChatHistory();
    
    // Settings widget
    initializeSettings();
}

function initializeQuickUpload() {
    const quickUploadBtn = document.getElementById('quick-upload-btn');
    if (quickUploadBtn) {
        quickUploadBtn.addEventListener('click', function() {
            // Redirect to main upload page or open modal
            window.location.href = '/dashboard';
        });
    }
}

function initializeChatHistory() {
    const chatHistoryContainer = document.getElementById('chat-history');
    if (!chatHistoryContainer) return;
    
    // Load recent chats
    fetch('/api/user/chat-history')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateChatHistory(data.chats);
            }
        })
        .catch(error => console.error('Error loading chat history:', error));
}

function updateChatHistory(chats) {
    const chatHistoryContainer = document.getElementById('chat-history');
    if (!chatHistoryContainer) return;
    
    chatHistoryContainer.innerHTML = '';
    
    if (chats.length === 0) {
        chatHistoryContainer.innerHTML = '<p class="text-muted">Belum ada riwayat chat.</p>';
        return;
    }
    
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-history-item';
        chatItem.innerHTML = `
            <div class="chat-preview">
                <strong>${truncateText(chat.first_question, 50)}</strong>
                <small class="text-muted d-block">${formatDateTime(chat.timestamp)}</small>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="loadChat('${chat.id}')">
                Buka
            </button>
        `;
        chatHistoryContainer.appendChild(chatItem);
    });
}

function initializeSettings() {
    // Theme settings
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', function() {
            changeTheme(this.value);
        });
    }
    
    // Notification settings
    const notificationToggle = document.getElementById('notification-toggle');
    if (notificationToggle) {
        notificationToggle.addEventListener('change', function() {
            updateNotificationSettings(this.checked);
        });
    }
}

function changeTheme(theme) {
    document.body.className = theme === 'dark' ? 'dark-theme' : '';
    localStorage.setItem('preferred-theme', theme);
    
    // Update theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    }
}

function updateNotificationSettings(enabled) {
    fetch('/api/user/notification-settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: enabled })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Pengaturan notifikasi berhasil diperbarui!', 'success');
        } else {
            showAlert('Gagal memperbarui pengaturan notifikasi.', 'danger');
        }
    })
    .catch(error => {
        console.error('Error updating notification settings:', error);
        showAlert('Terjadi kesalahan saat memperbarui pengaturan.', 'danger');
    });
}

// Real-time updates
function initializeRealTimeUpdates() {
    // Update stats every 30 seconds
    setInterval(loadUserStats, 30000);
    
    // Update recent activity every 60 seconds
    setInterval(loadRecentActivity, 60000);
    
    // Check for new notifications every 10 seconds
    setInterval(checkNotifications, 10000);
}

function checkNotifications() {
    fetch('/api/user/notifications')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.notifications.length > 0) {
                updateNotificationBadge(data.notifications.length);
                showRecentNotifications(data.notifications);
            }
        })
        .catch(error => console.error('Error checking notifications:', error));
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
}

function showRecentNotifications(notifications) {
    notifications.forEach(notification => {
        if (!notification.shown) {
            showAlert(notification.message, notification.type || 'info');
            // Mark as shown
            markNotificationAsShown(notification.id);
        }
    });
}

function markNotificationAsShown(notificationId) {
    fetch(`/api/user/notifications/${notificationId}/mark-shown`, {
        method: 'POST'
    });
}

// Utility functions
function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alert-container') || createAlertContainer();
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    alertContainer.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alert-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '10000';
    container.style.maxWidth = '400px';
    document.body.appendChild(container);
    return container;
}

// Global functions
window.loadChat = function(chatId) {
    // Redirect to chat page with specific chat ID
    window.location.href = `/chat?id=${chatId}`;
};

window.deleteChat = function(chatId) {
    if (confirm('Apakah Anda yakin ingin menghapus riwayat chat ini?')) {
        fetch(`/api/user/chat/${chatId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Riwayat chat berhasil dihapus!', 'success');
                initializeChatHistory(); // Reload chat history
            } else {
                showAlert('Gagal menghapus riwayat chat.', 'danger');
            }
        })
        .catch(error => {
            console.error('Error deleting chat:', error);
            showAlert('Terjadi kesalahan saat menghapus chat.', 'danger');
        });
    }
};

window.exportData = function() {
    fetch('/api/user/export-data')
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'my-data-export.json';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showAlert('Data berhasil diekspor!', 'success');
        })
        .catch(error => {
            console.error('Error exporting data:', error);
            showAlert('Gagal mengekspor data.', 'danger');
        });
};