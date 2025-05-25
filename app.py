from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import sqlite3
import os
import hashlib
import requests
import json
from datetime import datetime, timedelta
import logging
from functools import wraps
import PyPDF2
import docx
import threading
import time

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create uploads directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)

# Database setup
def init_db():
    conn = sqlite3.connect('document_summarizer.db')
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Documents table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER,
            file_type TEXT,
            content_text TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Chat sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            document_ids TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_session_id INTEGER,
            message_type TEXT CHECK(message_type IN ('user', 'assistant')),
            content TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_session_id) REFERENCES chat_sessions (id)
        )
    ''')
    
    # System logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert default settings
    cursor.execute('INSERT OR IGNORE INTO settings VALUES (?, ?, ?)', 
                   ('max_files', '5', datetime.now()))
    cursor.execute('INSERT OR IGNORE INTO settings VALUES (?, ?, ?)', 
                   ('max_file_size', '16', datetime.now()))
    cursor.execute('INSERT OR IGNORE INTO settings VALUES (?, ?, ?)', 
                   ('llm_server_url', 'http://localhost:1234', datetime.now()))
    cursor.execute('INSERT OR IGNORE INTO settings VALUES (?, ?, ?)', 
                   ('request_timeout', '30', datetime.now()))
    
    conn.commit()
    conn.close()

def log_message(level, message):
    """Log message to database and file"""
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        cursor.execute('INSERT INTO system_logs (level, message) VALUES (?, ?)', (level, message))
        conn.commit()
        conn.close()
        
        # Also log to file
        if level.upper() == 'ERROR':
            logging.error(message)
        elif level.upper() == 'WARNING':
            logging.warning(message)
        else:
            logging.info(message)
    except Exception as e:
        logging.error(f"Failed to log message: {e}")

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        cursor.execute('SELECT is_admin FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        conn.close()
        
        if not user or not user[0]:
            flash('Akses ditolak. Hanya admin yang dapat mengakses halaman ini.', 'error')
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)
    return decorated_function

def is_unnes_email(email):
    """Check if email is from UNNES domain"""
    return email.endswith('@mail.unnes.ac.id') or email.endswith('@students.unnes.ac.id')

def is_admin_email(email):
    """Check if email is admin (dosen) email"""
    return email.endswith('@mail.unnes.ac.id')

def extract_text_from_file(file_path, file_type):
    """Extract text content from uploaded files"""
    try:
        if file_type == 'pdf':
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
        elif file_type == 'docx':
            doc = docx.Document(file_path)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text
        elif file_type == 'txt':
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        else:
            return ""
    except Exception as e:
        log_message('ERROR', f'Failed to extract text from {file_path}: {e}')
        return ""

def get_llm_response(messages, max_retries=3):
    """Get response from LLM with retry mechanism"""
    conn = sqlite3.connect('document_summarizer.db')
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM settings WHERE key = ?', ('llm_server_url',))
    llm_url = cursor.fetchone()[0]
    cursor.execute('SELECT value FROM settings WHERE key = ?', ('request_timeout',))
    timeout = int(cursor.fetchone()[0])
    conn.close()

    for attempt in range(max_retries):
        try:
            payload = {
                "model": "mistral-nemo-instruct-2407",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 1000,
                "stream": False
            }
            
            response = requests.post(
                f"{llm_url}/v1/chat/completions",
                json=payload,
                timeout=timeout,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result = response.json()
                if 'choices' in result and len(result['choices']) > 0:
                    return result['choices'][0]['message']['content']
                else:
                    log_message('WARNING', f'Invalid response format from LLM: {result}')
                    return "Maaf, terjadi kesalahan dalam memproses respons dari sistem AI."
            else:
                log_message('WARNING', f'LLM server returned status {response.status_code}: {response.text}')
                
        except requests.exceptions.Timeout:
            log_message('WARNING', f'LLM request timeout (attempt {attempt + 1}/{max_retries})')
        except requests.exceptions.ConnectionError:
            log_message('WARNING', f'Cannot connect to LLM server (attempt {attempt + 1}/{max_retries})')
        except Exception as e:
            log_message('ERROR', f'Error calling LLM API (attempt {attempt + 1}/{max_retries}): {e}')
        
        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)  # Exponential backoff
    
    return "Maaf, sistem AI sedang tidak tersedia. Silakan coba lagi nanti."

def is_relevant_question(question):
    """Check if question is relevant to papers or UNNES"""
    question_lower = question.lower()
    keywords = [
        'paper', 'skripsi', 'penelitian', 'jurnal', 'artikel', 'tesis', 'disertasi',
        'unnes', 'universitas negeri semarang', 'semarang', 'metodologi', 'metode',
        'hasil', 'kesimpulan', 'penulis', 'author', 'abstrak', 'abstract'
    ]
    
    return any(keyword in question_lower for keyword in keywords)

# Routes
@app.route('/')
def index():
    return render_template('landing.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form['email'].lower().strip()
        name = request.form['name'].strip()
        password = request.form['password']
        
        # Validate UNNES email
        if not is_unnes_email(email):
            flash('Hanya email UNNES (@mail.unnes.ac.id atau @students.unnes.ac.id) yang diperbolehkan.', 'error')
            return render_template('register.html')
        
        # Check if user already exists
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        if cursor.fetchone():
            flash('Email sudah terdaftar.', 'error')
            conn.close()
            return render_template('register.html')
        
        # Create user
        password_hash = generate_password_hash(password)
        is_admin = is_admin_email(email)
        
        cursor.execute('''
            INSERT INTO users (email, name, password_hash, is_admin) 
            VALUES (?, ?, ?, ?)
        ''', (email, name, password_hash, is_admin))
        
        conn.commit()
        conn.close()
        
        log_message('INFO', f'New user registered: {email} (Admin: {is_admin})')
        flash('Registrasi berhasil! Silakan login.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email'].lower().strip()
        password = request.form['password']
        
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, password_hash, is_admin FROM users WHERE email = ?', (email,))
        user = cursor.fetchone()
        conn.close()
        
        if user and check_password_hash(user[2], password):
            session['user_id'] = user[0]
            session['user_name'] = user[1]
            session['user_email'] = email
            session['is_admin'] = user[3]
            
            log_message('INFO', f'User logged in: {email}')
            
            if user[3]:  # is_admin
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('dashboard'))
        else:
            flash('Email atau password salah.', 'error')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    user_email = session.get('user_email', 'Unknown')
    session.clear()
    log_message('INFO', f'User logged out: {user_email}')
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/admin_dashboard')
@admin_required
def admin_dashboard():
    return render_template('admin_dashboard.html')

@app.route('/upload', methods=['POST'])
@login_required
def upload_files():
    try:
        if 'files' not in request.files:
            return jsonify({'success': False, 'error': 'Tidak ada file yang dipilih'})
        
        files = request.files.getlist('files')
        
        # Get max files setting
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        cursor.execute('SELECT value FROM settings WHERE key = ?', ('max_files',))
        max_files = int(cursor.fetchone()[0])
        
        if len(files) > max_files:
            conn.close()
            return jsonify({'success': False, 'error': f'Maksimal {max_files} file dapat diupload sekaligus'})
        
        uploaded_files = []
        
        for file in files:
            if file.filename == '':
                continue
                
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_ext = filename.rsplit('.', 1)[1].lower()
                unique_filename = f"{session['user_id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                
                file.save(file_path)
                file_size = os.path.getsize(file_path)
                
                # Extract text content
                content_text = extract_text_from_file(file_path, file_ext)
                
                # Save to database
                cursor.execute('''
                    INSERT INTO documents (user_id, filename, original_filename, file_path, file_size, file_type, content_text)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (session['user_id'], unique_filename, filename, file_path, file_size, file_ext, content_text))
                
                doc_id = cursor.lastrowid
                uploaded_files.append({
                    'id': doc_id,
                    'filename': filename,
                    'size': file_size
                })
        
        conn.commit()
        conn.close()
        
        log_message('INFO', f'User {session["user_email"]} uploaded {len(uploaded_files)} files')
        return jsonify({'success': True, 'files': uploaded_files})
        
    except Exception as e:
        log_message('ERROR', f'Error uploading files: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat mengupload file'})

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/chat', methods=['POST'])
@login_required
def chat():
    try:
        data = request.json
        message = data.get('message', '').strip()
        document_ids = data.get('document_ids', [])
        chat_session_id = data.get('chat_session_id')
        
        if not message:
            return jsonify({'success': False, 'error': 'Pesan tidak boleh kosong'})
        
        # Check if question is relevant
        if not is_relevant_question(message):
            response = "Maaf, tolong berikan pertanyaan yang relevan dengan paper atau Universitas Negeri Semarang."
            return jsonify({'success': True, 'response': response})
        
        # Get or create chat session
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        
        if not chat_session_id:
            cursor.execute('''
                INSERT INTO chat_sessions (user_id, document_ids) 
                VALUES (?, ?)
            ''', (session['user_id'], ','.join(map(str, document_ids))))
            chat_session_id = cursor.lastrowid
        
        # Save user message
        cursor.execute('''
            INSERT INTO messages (chat_session_id, message_type, content) 
            VALUES (?, ?, ?)
        ''', (chat_session_id, 'user', message))
        
        # Get document context
        context = ""
        if document_ids:
            placeholders = ','.join('?' * len(document_ids))
            cursor.execute(f'''
                SELECT content_text FROM documents 
                WHERE id IN ({placeholders}) AND user_id = ?
            ''', document_ids + [session['user_id']])
            
            docs = cursor.fetchall()
            context = '\n\n'.join([doc[0] for doc in docs if doc[0]])
        
        # Prepare messages for LLM
        system_message = {
            "role": "system",
            "content": """Anda adalah asisten AI yang membantu menganalisis dokumen penelitian dan menjawab pertanyaan tentang Universitas Negeri Semarang (UNNES). 
            Berikan jawaban yang akurat, informatif, dan relevan. Jika tidak ada informasi yang cukup dalam konteks dokumen, 
            berikan jawaban umum yang masuk akal atau sarankan untuk mencari informasi lebih lanjut.
            Jawab dalam bahasa Indonesia dengan sopan dan profesional."""
        }
        
        user_message = {
            "role": "user", 
            "content": f"Konteks dokumen:\n{context}\n\nPertanyaan: {message}"
        }
        
        messages = [system_message, user_message]
        
        # Get response from LLM
        response = get_llm_response(messages)
        
        # Save assistant response
        cursor.execute('''
            INSERT INTO messages (chat_session_id, message_type, content) 
            VALUES (?, ?, ?)
        ''', (chat_session_id, 'assistant', response))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True, 
            'response': response,
            'chat_session_id': chat_session_id
        })
        
    except Exception as e:
        log_message('ERROR', f'Error in chat: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat memproses pesan'})

@app.route('/get_documents')
@login_required
def get_documents():
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, original_filename, file_size, uploaded_at 
            FROM documents 
            WHERE user_id = ? 
            ORDER BY uploaded_at DESC
        ''', (session['user_id'],))
        
        documents = []
        for row in cursor.fetchall():
            documents.append({
                'id': row[0],
                'filename': row[1],
                'size': row[2],
                'uploaded_at': row[3]
            })
        
        conn.close()
        return jsonify({'success': True, 'documents': documents})
        
    except Exception as e:
        log_message('ERROR', f'Error getting documents: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat mengambil data dokumen'})

@app.route('/get_chat_history/<int:chat_session_id>')
@login_required
def get_chat_history(chat_session_id):
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        
        # Verify chat session belongs to user
        cursor.execute('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?', 
                      (chat_session_id, session['user_id']))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Chat session tidak ditemukan'})
        
        cursor.execute('''
            SELECT message_type, content, timestamp 
            FROM messages 
            WHERE chat_session_id = ? 
            ORDER BY timestamp ASC
        ''', (chat_session_id,))
        
        messages = []
        for row in cursor.fetchall():
            messages.append({
                'type': row[0],
                'content': row[1],
                'timestamp': row[2]
            })
        
        conn.close()
        return jsonify({'success': True, 'messages': messages})
        
    except Exception as e:
        log_message('ERROR', f'Error getting chat history: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat mengambil riwayat chat'})

@app.route('/delete_document/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id):
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        
        # Check if document belongs to user
        cursor.execute('SELECT file_path FROM documents WHERE id = ? AND user_id = ?', 
                      (doc_id, session['user_id']))
        doc = cursor.fetchone()
        
        if not doc:
            conn.close()
            return jsonify({'success': False, 'error': 'Dokumen tidak ditemukan'})
        
        # Delete file from filesystem
        try:
            os.remove(doc[0])
        except OSError:
            pass  # File might already be deleted
        
        # Delete from database
        cursor.execute('DELETE FROM documents WHERE id = ? AND user_id = ?', 
                      (doc_id, session['user_id']))
        
        conn.commit()
        conn.close()
        
        log_message('INFO', f'User {session["user_email"]} deleted document {doc_id}')
        return jsonify({'success': True})
        
    except Exception as e:
        log_message('ERROR', f'Error deleting document: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat menghapus dokumen'})

# Admin API routes
@app.route('/admin/api/stats')
@admin_required
def admin_stats():
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        
        # Get total users
        cursor.execute('SELECT COUNT(*) FROM users')
        total_users = cursor.fetchone()[0]
        
        # Get total documents
        cursor.execute('SELECT COUNT(*) FROM documents')
        total_documents = cursor.fetchone()[0]
        
        # Get total chats
        cursor.execute('SELECT COUNT(*) FROM chat_sessions')
        total_chats = cursor.fetchone()[0]
        
        # Get total messages
        cursor.execute('SELECT COUNT(*) FROM messages')
        total_messages = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify({
            'total_users': total_users,
            'total_documents': total_documents,
            'total_chats': total_chats,
            'total_messages': total_messages
        })
        
    except Exception as e:
        log_message('ERROR', f'Error getting admin stats: {e}')
        return jsonify({'error': 'Terjadi kesalahan saat mengambil statistik'})

@app.route('/admin/api/users')
@admin_required
def admin_users():
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        cursor.execute('SELECT id, email, name, is_admin, created_at FROM users ORDER BY created_at DESC')
        
        users = []
        for row in cursor.fetchall():
            users.append({
                'id': row[0],
                'email': row[1],
                'name': row[2],
                'is_admin': bool(row[3]),
                'created_at': row[4]
            })
        
        conn.close()
        return jsonify(users)
        
    except Exception as e:
        log_message('ERROR', f'Error getting users: {e}')
        return jsonify({'error': 'Terjadi kesalahan saat mengambil data pengguna'})

@app.route('/admin/api/documents')
@admin_required
def admin_documents():
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT d.id, d.original_filename, u.email, d.file_size, d.uploaded_at 
            FROM documents d 
            JOIN users u ON d.user_id = u.id 
            ORDER BY d.uploaded_at DESC
        ''')
        
        documents = []
        for row in cursor.fetchall():
            documents.append({
                'id': row[0],
                'filename': row[1],
                'user_email': row[2],
                'file_size': row[3],
                'uploaded_at': row[4]
            })
        
        conn.close()
        return jsonify(documents)
        
    except Exception as e:
        log_message('ERROR', f'Error getting documents: {e}')
        return jsonify({'error': 'Terjadi kesalahan saat mengambil data dokumen'})

@app.route('/admin/api/logs')
@admin_required
def admin_logs():
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        cursor.execute('SELECT level, message, timestamp FROM system_logs ORDER BY timestamp DESC LIMIT 100')
        
        logs = []
        for row in cursor.fetchall():
            logs.append({
                'level': row[0],
                'message': row[1],
                'timestamp': row[2]
            })
        
        conn.close()
        return jsonify(logs)
        
    except Exception as e:
        log_message('ERROR', f'Error getting logs: {e}')
        return jsonify({'error': 'Terjadi kesalahan saat mengambil log sistem'})

@app.route('/admin/api/settings', methods=['GET', 'POST'])
@admin_required
def admin_settings():
    if request.method == 'GET':
        try:
            conn = sqlite3.connect('document_summarizer.db')
            cursor = conn.cursor()
            cursor.execute('SELECT key, value FROM settings')
            
            settings = {}
            for row in cursor.fetchall():
                settings[row[0]] = row[1]
            
            conn.close()
            return jsonify(settings)
            
        except Exception as e:
            log_message('ERROR', f'Error getting settings: {e}')
            return jsonify({'error': 'Terjadi kesalahan saat mengambil pengaturan'})
    
    elif request.method == 'POST':
        try:
            data = request.json
            conn = sqlite3.connect('document_summarizer.db')
            cursor = conn.cursor()
            
            for key, value in data.items():
                cursor.execute('''
                    INSERT OR REPLACE INTO settings (key, value, updated_at) 
                    VALUES (?, ?, ?)
                ''', (key, value, datetime.now()))
            
            conn.commit()
            conn.close()
            
            log_message('INFO', f'Admin {session["user_email"]} updated settings')
            return jsonify({'success': True, 'message': 'Pengaturan berhasil disimpan'})
            
        except Exception as e:
            log_message('ERROR', f'Error updating settings: {e}')
            return jsonify({'success': False, 'error': 'Terjadi kesalahan saat menyimpan pengaturan'})

@app.route('/admin/api/delete_user/<int:user_id>', methods=['DELETE'])
@admin_required
def admin_delete_user(user_id):
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        
        # Check if user exists and is not admin
        cursor.execute('SELECT email, is_admin FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({'success': False, 'error': 'Pengguna tidak ditemukan'})
        
        if user[1]:  # is_admin
            conn.close()
            return jsonify({'success': False, 'error': 'Tidak dapat menghapus admin'})
        
        # Get user's documents to delete files
        cursor.execute('SELECT file_path FROM documents WHERE user_id = ?', (user_id,))
        files = cursor.fetchall()
        
        # Delete files from filesystem
        for file_path in files:
            try:
                os.remove(file_path[0])
            except OSError:
                pass
        
        # Delete user data (cascading will handle related records)
        cursor.execute('DELETE FROM messages WHERE chat_session_id IN (SELECT id FROM chat_sessions WHERE user_id = ?)', (user_id,))
        cursor.execute('DELETE FROM chat_sessions WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM documents WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
        
        conn.commit()
        conn.close()
        
        log_message('INFO', f'Admin {session["user_email"]} deleted user {user[0]}')
        return jsonify({'success': True, 'message': 'Pengguna berhasil dihapus'})
        
    except Exception as e:
        log_message('ERROR', f'Error deleting user: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat menghapus pengguna'})

@app.route('/admin/api/delete_document/<int:doc_id>', methods=['DELETE'])
@admin_required
def admin_delete_document(doc_id):
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        
        # Get document info
        cursor.execute('SELECT file_path, original_filename FROM documents WHERE id = ?', (doc_id,))
        doc = cursor.fetchone()
        
        if not doc:
            conn.close()
            return jsonify({'success': False, 'error': 'Dokumen tidak ditemukan'})
        
        # Delete file from filesystem
        try:
            os.remove(doc[0])
        except OSError:
            pass
        
        # Delete from database
        cursor.execute('DELETE FROM documents WHERE id = ?', (doc_id,))
        
        conn.commit()
        conn.close()
        
        log_message('INFO', f'Admin {session["user_email"]} deleted document {doc[1]}')
        return jsonify({'success': True, 'message': 'Dokumen berhasil dihapus'})
        
    except Exception as e:
        log_message('ERROR', f'Error deleting document: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat menghapus dokumen'})

@app.route('/get_predefined_questions')
@login_required
def get_predefined_questions():
    """Get predefined questions for user selection"""
    questions = [
        "Metode apa yang digunakan pada paper tersebut?",
        "Siapa penulis dan kapan paper tersebut dibuat?",
        "Apa hasil dari penelitian tersebut?",
        "Apa kesimpulan dari paper tersebut?",
        "Apa tujuan dari penelitian ini?",
        "Bagaimana metodologi penelitian yang digunakan?",
        "Apa saja temuan utama dalam penelitian ini?",
        "Bagaimana kontribusi penelitian ini terhadap bidang ilmu?",
        "Apa saran untuk penelitian selanjutnya?",
        "Bagaimana kualitas data yang digunakan dalam penelitian?"
    ]
    
    return jsonify({'success': True, 'questions': questions})

@app.route('/get_chat_sessions')
@login_required
def get_chat_sessions():
    """Get user's chat sessions"""
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT cs.id, cs.created_at, 
                   COUNT(m.id) as message_count,
                   MAX(m.timestamp) as last_message
            FROM chat_sessions cs
            LEFT JOIN messages m ON cs.id = m.chat_session_id
            WHERE cs.user_id = ?
            GROUP BY cs.id, cs.created_at
            ORDER BY COALESCE(MAX(m.timestamp), cs.created_at) DESC
        ''', (session['user_id'],))
        
        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                'id': row[0],
                'created_at': row[1],
                'message_count': row[2],
                'last_message': row[3]
            })
        
        conn.close()
        return jsonify({'success': True, 'sessions': sessions})
        
    except Exception as e:
        log_message('ERROR', f'Error getting chat sessions: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat mengambil sesi chat'})

@app.route('/delete_chat_session/<int:session_id>', methods=['DELETE'])
@login_required
def delete_chat_session(session_id):
    """Delete a chat session and all its messages"""
    try:
        conn = sqlite3.connect('document_summarizer.db')
        cursor = conn.cursor()
        
        # Verify session belongs to user
        cursor.execute('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?', 
                      (session_id, session['user_id']))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Sesi chat tidak ditemukan'})
        
        # Delete messages first (foreign key constraint)
        cursor.execute('DELETE FROM messages WHERE chat_session_id = ?', (session_id,))
        
        # Delete chat session
        cursor.execute('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', 
                      (session_id, session['user_id']))
        
        conn.commit()
        conn.close()
        
        log_message('INFO', f'User {session["user_email"]} deleted chat session {session_id}')
        return jsonify({'success': True, 'message': 'Sesi chat berhasil dihapus'})
        
    except Exception as e:
        log_message('ERROR', f'Error deleting chat session: {e}')
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat menghapus sesi chat'})

# Error handlers
@app.errorhandler(413)
def too_large(e):
    return jsonify({'success': False, 'error': 'File terlalu besar. Maksimal 16MB.'}), 413

@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(e):
    log_message('ERROR', f'Internal server error: {e}')
    return render_template('500.html'), 500

# Initialize database on startup
if __name__ == '__main__':
    init_db()
    log_message('INFO', 'Document Summarizer application started')
    app.run(debug=True, host='0.0.0.0', port=5000)