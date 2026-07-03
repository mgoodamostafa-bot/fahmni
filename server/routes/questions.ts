import { Request, Response, Router } from 'express';
import { getAdminDb, strictLimiter, cleanData } from '../lib/middleware.js';
import { validateRequest } from '../lib/validateRequest.js';
import { getQuestionsSchema, submitAnswerSchema, submitExamSchema } from '../../src/lib/validations.js';

const router = Router();

/**
 * GET /api/questions
 * Query params: grade, subject, limit, startAfter
 * Returns questions WITHOUT correctOptionIndex (anti-cheat)
 */
router.get('/', validateRequest({ query: getQuestionsSchema }), async (req: Request, res: Response) => {
  const { grade, subject, limit: limitParam, startAfter } = req.query;
  const adminDb = getAdminDb();
  if (!adminDb) {
    res.status(500).json({ error: 'DB error' });
    return;
  }

  try {
    let q: any = adminDb.collection('questions');
    if (grade) q = q.where('grade', '==', grade);
    if (subject) q = q.where('subject', '==', subject);

    // Pagination support
    const pageSize = Math.min(parseInt(limitParam as string) || 50, 100);
    q = q.orderBy('createdAt', 'desc').limit(pageSize);

    if (startAfter) {
      const startDoc = await adminDb.collection('questions').doc(startAfter as string).get();
      if (startDoc.exists) q = q.startAfter(startDoc);
    }

    const snap = await q.get();
    const questions = snap.docs.map((doc: any) => {
      const data = doc.data();
      const { correctOptionIndex, explanation, ...publicData } = data;
      return { id: doc.id, ...publicData };
    });

    const lastDoc = snap.docs[snap.docs.length - 1];
    res.json({
      questions,
      nextCursor: lastDoc?.id || null,
      hasMore: snap.docs.length === pageSize
    });
  } catch (err: any) {
    console.error('Questions fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/questions/answer
 * Server-side answer verification only
 */
router.post('/answer', strictLimiter, validateRequest({ body: submitAnswerSchema }), async (req: Request, res: Response) => {
  const { questionId, selectedIndex, userId } = req.body;
  
  const adminDb = getAdminDb();
  if (!adminDb) {
    res.status(500).json({ error: 'DB error' });
    return;
  }

  try {
    const doc = await adminDb.collection('questions').doc(questionId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    const data = doc.data()!;
    const correct = data.correctOptionIndex === selectedIndex;

    await adminDb.collection('question_attempts').add({
      userId, questionId, selectedIndex, correct,
      grade: data.grade, subject: data.subject, chapter: data.chapter,
      timestamp: new Date().toISOString()
    });

    res.json({
      correct,
      correctIndex: data.correctOptionIndex,
      explanation: data.explanation
    });
  } catch (err: any) {
    console.error('Answer verify error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/exams/submit
 * Server-side scoring + chapter breakdown
 */
router.post('/exams/submit', strictLimiter, validateRequest({ body: submitExamSchema }), async (req: Request, res: Response) => {
  const { examId, answers, userId, timeTaken } = req.body;
  
  const adminDb = getAdminDb();
  if (!adminDb) {
    res.status(500).json({ error: 'DB error' });
    return;
  }

  try {
    const examDoc = await adminDb.collection('exams').doc(examId).get();
    if (!examDoc.exists) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    const exam = examDoc.data()!;
    const examQuestions: any[] = exam.questions || [];

    const chapterStats: Record<string, { correct: number; total: number }> = {};
    let totalCorrect = 0;
    const details = answers.map((ans: { questionId: string; selectedIndex: number }) => {
      const q = examQuestions.find((eq: any) => eq.id === ans.questionId);
      if (!q) return { questionId: ans.questionId, correct: false, chapter: 'غير محدد' };
      const correct = q.correctOptionIndex === ans.selectedIndex;
      if (correct) totalCorrect++;
      const ch = q.chapter || 'غير محدد';
      if (!chapterStats[ch]) chapterStats[ch] = { correct: 0, total: 0 };
      chapterStats[ch].total++;
      if (correct) chapterStats[ch].correct++;
      return { questionId: ans.questionId, correct, chapter: ch, correctIndex: q.correctOptionIndex, explanation: q.explanation };
    });

    const totalQuestions = answers.length;
    const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const level = percentage >= 85 ? 'متفوق' : percentage >= 70 ? 'جيد جداً' : percentage >= 55 ? 'جيد' : percentage >= 40 ? 'متوسط' : 'ضعيف';

    const chapterBreakdown = Object.entries(chapterStats).map(([chapter, stats]) => ({
      chapter, correct: stats.correct, total: stats.total,
      percentage: Math.round((stats.correct / stats.total) * 100),
      level: stats.correct / stats.total >= 0.85 ? 'متفوق' : stats.correct / stats.total >= 0.7 ? 'جيد' : 'متوسط'
    }));

    const resultData = {
      userId, examId, examTitle: exam.title, subject: exam.subject, grade: exam.grade,
      totalCorrect, totalQuestions, percentage, level, timeTaken: timeTaken || 0,
      chapterBreakdown, details, teacherId: exam.teacherId || 'unknown',
      teacherName: exam.teacherName || 'غير معروف', submittedAt: new Date().toISOString()
    };

    const resultRef = await adminDb.collection('student_results').add(cleanData(resultData));
    res.json({ ...resultData, resultId: resultRef.id });
  } catch (err: any) {
    console.error('Exam submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
