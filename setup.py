#!/usr/bin/env python3
"""
Setup script untuk Document Summarizer
Menginisialisasi database dan membuat folder yang diperlukan
"""

import os
import sqlite3
from werkzeug.security import generate_password_hash

def setup_project():
    """Setup initial project structure and database"""
    
    print("🚀 Setting up Document Summarizer...")
    
    # Create necessary directories
    directories = ['uploads', 'templates', 'static/css', 'static/js']
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"✅ Created directory: {directory}")
    
    # Initialize database
    DATABASE = 'users.db'
    
    # Remove existing database if exists
    if os.path.exists(DATABASE):
        os.remove(DATABASE)
        print("🗑️  Removed existing database")
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create chat_history table
    cursor.execute('''
        CREATE TABLE chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            session_id TEXT NOT NULL,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Create uploaded_files table
    cursor.execute('''
        CREATE TABLE uploaded_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            session_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Create default admin user
    admin_password_hash = generate_password_hash('admin123')
    cursor.execute('''
        INSERT INTO users (username, password_hash, is_admin) 
        VALUES (?, ?, ?)
    ''', ('admin', admin_password_hash, True))
    
    # Create test user
    user_password_hash = generate_password_hash('user123')
    cursor.execute('''
        INSERT INTO users (username, password_hash, is_admin) 
        VALUES (?, ?, ?)
    ''', ('testuser', user_password_hash, False))
    
    conn.commit()
    conn.close()
    
    print("✅ Database initialized successfully")
    print("👤 Default admin user: admin / admin123")
    print("👤 Test user: testuser / user123")
    
    # Create .env file for configuration
    env_content = """# LM Studio Configuration
LM_STUDIO_URL=http://localhost:1234/v1/chat/completions
MODEL_NAME=local-model

# Flask Configuration
SECRET_KEY=your-secret-key-change-this-in-production
DEBUG=True

# Upload Configuration
MAX_FILES=5
UPLOAD_FOLDER=uploads
"""
    
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print("✅ Created .env configuration file")
    
    print("\n🎉 Setup completed successfully!")
    print("\n📋 Next steps:")
    print("1. Install dependencies: pip install -r requirements.txt")
    print("2. Start LM Studio and load your model")
    print("3. Run the application: python app.py")
    print("4. Access admin panel at: http://localhost:5000/admin")
    print("5. Access user interface at: http://localhost:5000")

if __name__ == "__main__":
    setup_project()