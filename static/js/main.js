// Main JavaScript untuk Document Summarizer
document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let uploadedFiles = [];
    let currentChat = [];
    
    // Initialize components
    initializeFileUpload();
    initializeChat();
    initializePresetQuestions();
    
    // File Upload Functionality
    function initializeFileUpload() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const fileList = document.getElementById('file-list');
        
        if (!uploadArea || !fileInput) return;
        
        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
        
        function handleFiles(files) {
            const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
            const maxFiles = 5;
            
            // Check file count
            if (uploadedFiles.length + files.length > maxFiles) {
                showAlert('Maksimal 5 file yang dapat diunggah!', 'warning');
                return;
            }
            
            Array.from(files).forEach(file => {
                // Check file type
                const fileExt = '.' + file.name.split('.').pop().toLowerCase();
                if (!allowedTypes.includes(fileExt)) {
                    showAlert(`File ${file.name} tidak didukung. Hanya PDF, DOC, DOCX, dan TXT yang diperbolehkan.`, 'danger');
                    return;
                }
                
                // Check file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    showAlert(`File ${file.name} terlalu besar. Maksimal 10MB.`, 'danger');
                    return;
                }
                
                uploadedFiles.push(file);
            });
            
            updateFileList();
            updateUploadArea();
        }
        
        function updateFileList() {
            if (!fileList) return;
            
            fileList.innerHTML = '';
            uploadedFiles.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <div>
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">(${formatFileSize(file.size)})</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeFile(${index})">
                        Hapus
                    </button>
                `;
                fileList.appendChild(fileItem);
            });
        }
        
        function updateUploadArea() {
            const uploadText = uploadArea.querySelector('.upload-text');
            if (uploadText) {
                if (uploadedFiles.length === 0) {
                    uploadText.innerHTML = `
                        <i class="fas fa-cloud-upload-alt"></i>
                        <p>Klik atau seret file ke sini</p>
                        <small>PDF, DOC, DOCX, TXT (Max 5 files, 10MB each)</small>
                    `;
                } else {
                    uploadText.innerHTML = `
                        <i class="fas fa-check-circle" style="color: #27ae60;"></i>
                        <p>${uploadedFiles.length} file terpilih</p>
                        <small>Klik untuk menambah file lagi (Max ${5 - uploadedFiles.length} file)</small>
                    `;
                }
            }
        }
    }
    
    // Chat Functionality
    function initializeChat() {
        const chatForm = document.getElementById('chat-form');
        const chatInput = document.getElementById('chat-input');
        const chatContainer = document.getElementById('chat-container');
        
        if (chatForm) {
            chatForm.addEventListener('submit', handleChatSubmit);
        }
        
        async function handleChatSubmit(e) {
            e.preventDefault();
            
            const message = chatInput.value.trim();
            if (!message) return;
            
            // Check if files are uploaded
            if (uploadedFiles.length === 0) {
                showAlert('Silakan unggah file terlebih dahulu!', 'warning');
                return;
            }
            
            // Add user message to chat
            addMessageToChat('user', message);
            chatInput.value = '';
            
            // Show loading
            const loadingId = addMessageToChat('bot', '<div class="loading"></div> Sedang memproses...');
            
            try {
                // Create form data
                const formData = new FormData();
                uploadedFiles.forEach(file => {
                    formData.append('files', file);
                });
                formData.append('question', message);
                
                // Send request
                const response = await fetch('/chat', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                // Remove loading message
                removeMessage(loadingId);
                
                if (result.success) {
                    addMessageToChat('bot', result.answer);
                } else {
                    addMessageToChat('bot', result.message || 'Terjadi kesalahan saat memproses permintaan.');
                }
                
            } catch (error) {
                removeMessage(loadingId);
                addMessageToChat('bot', 'Terjadi kesalahan koneksi. Silakan coba lagi.');
                console.error('Chat error:', error);
            }
        }
        
        function addMessageToChat(sender, message) {
            if (!chatContainer) return null;
            
            const messageId = 'msg-' + Date.now() + '-' + Math.random();
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${sender}`;
            messageDiv.id = messageId;
            messageDiv.innerHTML = message;
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            // Store in current chat
            currentChat.push({
                sender: sender,
                message: message,
                timestamp: new Date().toISOString()
            });
            
            return messageId;
        }
        
        function removeMessage(messageId) {
            const messageElement = document.getElementById(messageId);
            if (messageElement) {
                messageElement.remove();
            }
        }
    }
    
    // Preset Questions Functionality
    function initializePresetQuestions() {
        const presetButtons = document.querySelectorAll('.preset-question');
        
        presetButtons.forEach(button => {
            button.addEventListener('click', function() {
                const question = this.textContent.trim();
                const chatInput = document.getElementById('chat-input');
                
                if (chatInput) {
                    chatInput.value = question;
                    
                    // Remove selected class from all buttons
                    presetButtons.forEach(btn => btn.classList.remove('selected'));
                    
                    // Add selected class to clicked button
                    this.classList.add('selected');
                    
                    // Focus on input
                    chatInput.focus();
                }
            });
        });
    }
    
    // Utility Functions
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    
    // Global functions (for onclick handlers)
    window.removeFile = function(index) {
        uploadedFiles.splice(index, 1);
        const fileList = document.getElementById('file-list');
        const uploadArea = document.getElementById('upload-area');
        
        if (fileList) {
            updateFileList();
        }
        
        // Update upload area text
        const uploadText = uploadArea?.querySelector('.upload-text');
        if (uploadText) {
            if (uploadedFiles.length === 0) {
                uploadText.innerHTML = `
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Klik atau seret file ke sini</p>
                    <small>PDF, DOC, DOCX, TXT (Max 5 files, 10MB each)</small>
                `;
            } else {
                uploadText.innerHTML = `
                    <i class="fas fa-check-circle" style="color: #27ae60;"></i>
                    <p>${uploadedFiles.length} file terpilih</p>
                    <small>Klik untuk menambah file lagi (Max ${5 - uploadedFiles.length} file)</small>
                `;
            }
        }
        
        function updateFileList() {
            const fileList = document.getElementById('file-list');
            if (!fileList) return;
            
            fileList.innerHTML = '';
            uploadedFiles.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <div>
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">(${formatFileSize(file.size)})</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeFile(${index})">
                        Hapus
                    </button>
                `;
                fileList.appendChild(fileItem);
            });
        }
    };
    
    // Form validation
    window.validateForm = function(formId) {
        const form = document.getElementById(formId);
        if (!form) return false;
        
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                field.classList.add('is-invalid');
                isValid = false;
            } else {
                field.classList.remove('is-invalid');
            }
        });
        
        return isValid;
    };
    
    // Password strength checker
    window.checkPasswordStrength = function(password) {
        const strengthMeter = document.getElementById('password-strength');
        if (!strengthMeter) return;
        
        let strength = 0;
        let feedback = [];
        
        if (password.length >= 8) strength++;
        else feedback.push('Minimal 8 karakter');
        
        if (/[a-z]/.test(password)) strength++;
        else feedback.push('Huruf kecil');
        
        if (/[A-Z]/.test(password)) strength++;
        else feedback.push('Huruf besar');
        
        if (/[0-9]/.test(password)) strength++;
        else feedback.push('Angka');
        
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        else feedback.push('Karakter khusus');
        
        const levels = ['Sangat Lemah', 'Lemah', 'Sedang', 'Kuat', 'Sangat Kuat'];
        const colors = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#27ae60'];
        
        strengthMeter.innerHTML = `
            <div class="strength-bar">
                <div class="strength-fill" style="width: ${(strength / 5) * 100}%; background-color: ${colors[strength]}"></div>
            </div>
            <div class="strength-text" style="color: ${colors[strength]}">
                ${levels[strength]} ${feedback.length > 0 ? '- Perlu: ' + feedback.join(', ') : ''}
            </div>
        `;
    };
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            
            // Update icon
            this.innerHTML = isDark ? '☀️' : '🌙';
        });
        
        // Load saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.innerHTML = '☀️';
        }
    }
    
    // Auto-resize textarea
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    });
    
    // Copy to clipboard functionality
    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert('Teks berhasil disalin!', 'success');
        }).catch(() => {
            showAlert('Gagal menyalin teks.', 'danger');
        });
    };
    
    // Print functionality
    window.printContent = function(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Print</title>
                    <style>
                        body { font-family: Arial, sans-serif; }
                        .chat-message { margin: 1rem 0; padding: 1rem; }
                        .chat-message.user { background: #e3f2fd; }
                        .chat-message.bot { background: #f5f5f5; }
                    </style>
                </head>
                <body>
                    ${element.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };
    
    // Progress bar update
    window.updateProgress = function(percentage) {
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = percentage + '%';
        }
    };
});