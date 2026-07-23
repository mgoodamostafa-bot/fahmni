-- ─── PHASE 1 DATABASE SCHEMA MIGRATION ───────────────────
-- Execute this SQL code in your Supabase Dashboard SQL Editor (https://supabase.com)

-- 1. Add custom package and points columns to center_students if they do not exist
ALTER TABLE center_students 
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS package_id TEXT,
  ADD COLUMN IF NOT EXISTS remaining_sessions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_type TEXT,
  ADD COLUMN IF NOT EXISTS subscription_start_date DATE,
  ADD COLUMN IF NOT EXISTS subscription_end_date DATE;

-- 2. Create offline_results table if it does not exist
CREATE TABLE IF NOT EXISTS offline_results (
  id TEXT PRIMARY KEY,
  student_uid TEXT NOT NULL,
  student_name TEXT,
  student_code TEXT,
  exam_title TEXT,
  score NUMERIC DEFAULT 0,
  max_score NUMERIC DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create attendance table if it does not exist
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  student_uid TEXT NOT NULL,
  student_name TEXT,
  student_id TEXT,
  center_id TEXT,
  group_id TEXT,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Create evaluations table if it does not exist
CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  student_uid TEXT NOT NULL,
  student_name TEXT,
  student_id TEXT,
  center_id TEXT,
  group_id TEXT,
  date TEXT NOT NULL,
  quiz_grade NUMERIC DEFAULT 0,
  quiz_total NUMERIC DEFAULT 10,
  homework_status TEXT,
  behavior_rating INTEGER DEFAULT 5,
  teacher_remarks TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Create center_payments table if it does not exist
CREATE TABLE IF NOT EXISTS center_payments (
  id TEXT PRIMARY KEY,
  student_uid TEXT NOT NULL,
  student_name TEXT,
  student_id TEXT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  remarks TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
