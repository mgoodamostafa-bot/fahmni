// ============================================================
// FAHMNI MIGRATION ENGINE - FIREBASE NO-SQL TO MYSQL/POSTGRES SQL
// ============================================================

export interface TenantBackupData {
  tenantId: string;
  exportedAt: string;
  users?: any[];
  courses?: any[];
  lessons?: any[];
  exams?: any[];
  questions?: any[];
  examResults?: any[];
  chargeCards?: any[];
  walletTransactions?: any[];
  siteSettings?: Record<string, any>;
}

function escapeSqlString(str: any): string {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'number' || typeof str === 'boolean') return `${str}`;
  const sanitized = String(str).replace(/'/g, "''").replace(/\\/g, '\\\\');
  return `'${sanitized}'`;
}

function jsonToSqlValue(obj: any): string {
  if (obj === null || obj === undefined) return 'NULL';
  if (typeof obj === 'object') {
    return escapeSqlString(JSON.stringify(obj));
  }
  return escapeSqlString(obj);
}

/**
 * Converts a Firebase JSON backup object into standard SQL INSERT statements for MySQL / PostgreSQL
 */
export function convertFirebaseJsonToSql(backupData: TenantBackupData): string {
  const sqlLines: string[] = [];

  sqlLines.push(`-- ============================================================`);
  sqlLines.push(`-- FAHMNI DATA MIGRATION SCRIPT (FIREBASE TO MYSQL / POSTGRESQL)`);
  sqlLines.push(`-- Tenant ID: ${backupData.tenantId || 'Standalone'}`);
  sqlLines.push(`-- Exported At: ${backupData.exportedAt || new Date().toISOString()}`);
  sqlLines.push(`-- ============================================================\n`);

  // 1. Users Migration
  if (backupData.users && backupData.users.length > 0) {
    sqlLines.push(`-- 1. Migrate Users (${backupData.users.length} records)`);
    for (const u of backupData.users) {
      sqlLines.push(
        `INSERT INTO users (id, name, phone, parent_phone, code, role, grade, group_id, governorate, is_blocked, wallet_balance) ` +
        `VALUES (${escapeSqlString(u.id || u.uid)}, ${escapeSqlString(u.name || u.displayName)}, ${escapeSqlString(u.phone)}, ` +
        `${escapeSqlString(u.parentPhone)}, ${escapeSqlString(u.code)}, ${escapeSqlString(u.role || 'student')}, ` +
        `${escapeSqlString(u.grade)}, ${escapeSqlString(u.groupId)}, ${escapeSqlString(u.governorate)}, ` +
        `${u.isBlocked ? 'TRUE' : 'FALSE'}, ${Number(u.walletBalance || 0)}) ` +
        `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, wallet_balance = EXCLUDED.wallet_balance;`
      );
    }
    sqlLines.push(`\n`);
  }

  // 2. Courses Migration
  if (backupData.courses && backupData.courses.length > 0) {
    sqlLines.push(`-- 2. Migrate Courses (${backupData.courses.length} records)`);
    for (const c of backupData.courses) {
      sqlLines.push(
        `INSERT INTO courses (id, title, description, price, grade, image_url, is_published) ` +
        `VALUES (${escapeSqlString(c.id)}, ${escapeSqlString(c.title)}, ${escapeSqlString(c.description)}, ` +
        `${Number(c.price || 0)}, ${escapeSqlString(c.grade)}, ${escapeSqlString(c.imageUrl || c.image)}, ` +
        `${c.isPublished !== false ? 'TRUE' : 'FALSE'}) ` +
        `ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, price = EXCLUDED.price;`
      );
    }
    sqlLines.push(`\n`);
  }

  // 3. Lessons Migration
  if (backupData.lessons && backupData.lessons.length > 0) {
    sqlLines.push(`-- 3. Migrate Lessons (${backupData.lessons.length} records)`);
    for (const l of backupData.lessons) {
      sqlLines.push(
        `INSERT INTO lessons (id, course_id, title, description, video_url, pdf_url, is_free, order_index) ` +
        `VALUES (${escapeSqlString(l.id)}, ${escapeSqlString(l.courseId)}, ${escapeSqlString(l.title)}, ` +
        `${escapeSqlString(l.description)}, ${escapeSqlString(l.videoUrl)}, ${escapeSqlString(l.pdfUrl)}, ` +
        `${l.isFree ? 'TRUE' : 'FALSE'}, ${Number(l.orderIndex || 0)}) ` +
        `ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, video_url = EXCLUDED.video_url;`
      );
    }
    sqlLines.push(`\n`);
  }

  // 4. Exams Migration
  if (backupData.exams && backupData.exams.length > 0) {
    sqlLines.push(`-- 4. Migrate Exams (${backupData.exams.length} records)`);
    for (const e of backupData.exams) {
      sqlLines.push(
        `INSERT INTO exams (id, title, course_id, lesson_id, duration_minutes, total_marks, passing_marks, is_published) ` +
        `VALUES (${escapeSqlString(e.id)}, ${escapeSqlString(e.title)}, ${escapeSqlString(e.courseId)}, ` +
        `${escapeSqlString(e.lessonId)}, ${Number(e.durationMinutes || 30)}, ${Number(e.totalMarks || 100)}, ` +
        `${Number(e.passingMarks || 50)}, ${e.isPublished !== false ? 'TRUE' : 'FALSE'}) ` +
        `ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;`
      );
    }
    sqlLines.push(`\n`);
  }

  // 5. Exam Results Migration
  if (backupData.examResults && backupData.examResults.length > 0) {
    sqlLines.push(`-- 5. Migrate Exam Results (${backupData.examResults.length} records)`);
    for (const r of backupData.examResults) {
      sqlLines.push(
        `INSERT INTO exam_results (id, user_id, exam_id, score, total_marks, passed, student_answers) ` +
        `VALUES (${escapeSqlString(r.id)}, ${escapeSqlString(r.userId)}, ${escapeSqlString(r.examId)}, ` +
        `${Number(r.score || 0)}, ${Number(r.totalMarks || 100)}, ${r.passed ? 'TRUE' : 'FALSE'}, ` +
        `${jsonToSqlValue(r.studentAnswers || r.answers)}) ` +
        `ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score;`
      );
    }
    sqlLines.push(`\n`);
  }

  // 6. Charge Cards Migration
  if (backupData.chargeCards && backupData.chargeCards.length > 0) {
    sqlLines.push(`-- 6. Migrate Charge Cards (${backupData.chargeCards.length} records)`);
    for (const card of backupData.chargeCards) {
      sqlLines.push(
        `INSERT INTO charge_cards (id, code, amount, is_used, used_by_user_id) ` +
        `VALUES (${escapeSqlString(card.id)}, ${escapeSqlString(card.code)}, ${Number(card.amount || 0)}, ` +
        `${card.isUsed ? 'TRUE' : 'FALSE'}, ${escapeSqlString(card.usedByUserId)}) ` +
        `ON CONFLICT (id) DO NOTHING;`
      );
    }
    sqlLines.push(`\n`);
  }

  return sqlLines.join('\n');
}
