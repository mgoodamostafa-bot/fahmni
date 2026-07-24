-- ============================================================
-- FAHMNI STANDALONE ENGINE - UNIVERSAL SQL SCHEMA (MySQL & PostgreSQL)
-- ============================================================

-- 1. Tenants / Platform Settings
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    teacher_name VARCHAR(255),
    teacher_title VARCHAR(255),
    subject VARCHAR(255),
    logo_url TEXT,
    teacher_photo_url TEXT,
    fruit_theme VARCHAR(50) DEFAULT 'emerald',
    primary_color VARCHAR(50),
    custom_domain VARCHAR(255),
    firebase_config TEXT,
    supabase_url TEXT,
    supabase_anon_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Students, Admins, Teachers)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) UNIQUE,
    parent_phone VARCHAR(50),
    code VARCHAR(50) UNIQUE,
    role VARCHAR(50) DEFAULT 'student',
    grade VARCHAR(100),
    group_id VARCHAR(100),
    governorate VARCHAR(100),
    center_id VARCHAR(100),
    device_fingerprint TEXT,
    device_id TEXT,
    is_blocked BOOLEAN DEFAULT FALSE,
    wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Courses
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) DEFAULT 0.00,
    grade VARCHAR(100),
    image_url TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Lessons
CREATE TABLE IF NOT EXISTS lessons (
    id VARCHAR(100) PRIMARY KEY,
    course_id VARCHAR(100) REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT,
    pdf_url TEXT,
    is_free BOOLEAN DEFAULT FALSE,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Exams
CREATE TABLE IF NOT EXISTS exams (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    course_id VARCHAR(100),
    lesson_id VARCHAR(100),
    duration_minutes INT DEFAULT 30,
    total_marks INT DEFAULT 100,
    passing_marks INT DEFAULT 50,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Exam Questions
CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(100) PRIMARY KEY,
    exam_id VARCHAR(100) REFERENCES exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    image_url TEXT,
    options TEXT, -- JSON Array of options
    correct_option_index INT DEFAULT 0,
    explanation TEXT,
    marks INT DEFAULT 1
);

-- 7. Exam Results / Submissions
CREATE TABLE IF NOT EXISTS exam_results (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    exam_id VARCHAR(100) REFERENCES exams(id) ON DELETE CASCADE,
    score DECIMAL(5, 2) NOT NULL,
    total_marks DECIMAL(5, 2) NOT NULL,
    passed BOOLEAN DEFAULT FALSE,
    student_answers TEXT, -- JSON object of student answers
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Charge Cards
CREATE TABLE IF NOT EXISTS charge_cards (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_by_user_id VARCHAR(100),
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Wallet / Financial Transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'recharge', 'purchase', 'refund'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Site Settings & Branding Override
CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT
);
