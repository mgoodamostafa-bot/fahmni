import { Request, Response, Router } from 'express';
import { getAdminDb, authenticateUser, extractVideoId } from '../lib/middleware.js';
import { validateRequest } from '../lib/validateRequest.js';
import { lessonIdParamSchema, navParamsSchema } from '../../src/lib/validations.js';

const router = Router();

// Video Verification Endpoint
router.get('/video/verify/:lessonId', authenticateUser, validateRequest({ params: lessonIdParamSchema }), async (req: any, res: any) => {
  const { lessonId } = req.params;
  const userId = req.userId;

  try {
    const adminDb = getAdminDb();
    if (!adminDb) return res.status(500).json({ error: 'Database connection failed' });

    const lessonDoc = await adminDb.collection('lessons').doc(lessonId).get();
    if (!lessonDoc.exists) return res.status(404).json({ error: 'Lesson not found' });
    const lessonData = lessonDoc.data();

    if (lessonData?.isFreePreview) {
      return res.json({ videoId: extractVideoId(lessonData.videoUrl), authorized: true });
    }

    const enrollmentId = `${userId}_${lessonData?.courseId}`;
    const enrollmentDoc = await adminDb.collection('enrollments').doc(enrollmentId).get();
    if (enrollmentDoc.exists && enrollmentDoc.data()?.status === 'active') {
      return res.json({ videoId: extractVideoId(lessonData?.videoUrl), authorized: true });
    }

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (userDoc.exists && userDoc.data()?.role === 'admin') {
      return res.json({ videoId: extractVideoId(lessonData?.videoUrl), authorized: true });
    }

    res.status(403).json({ error: 'Access denied. You must be enrolled in this course.' });
  } catch (error: any) {
    console.error('Video Verification Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Lesson Details (including Quiz)
router.get('/lessons/:lessonId', validateRequest({ params: lessonIdParamSchema }), async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;
    const adminDb = getAdminDb();
    if (!adminDb) { res.status(500).json({ error: 'Database connection failed' }); return; }

    const lessonDoc = await adminDb.collection('lessons').doc(lessonId).get();
    if (!lessonDoc.exists) { res.status(404).json({ error: 'Lesson not found' }); return; }

    const lessonData = lessonDoc.data();
    const quizSnapshot = await adminDb.collection('quizzes').where('lessonId', '==', lessonId).limit(1).get();
    const quiz = !quizSnapshot.empty ? { id: quizSnapshot.docs[0].id, ...quizSnapshot.docs[0].data() } : null;

    res.json({ ...lessonData, id: lessonDoc.id, quiz });
  } catch (error: any) {
    console.error('Error fetching lesson details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Next/Previous Lesson
router.get('/courses/:courseId/lessons/:currentOrder/nav', validateRequest({ params: navParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { courseId, currentOrder } = req.params;
    const order = parseInt(currentOrder);
    const adminDb = getAdminDb();
    if (!adminDb) { res.status(500).json({ error: 'Database connection failed' }); return; }

    const nextQuery = adminDb.collection('lessons')
      .where('courseId', '==', courseId).where('order', '==', order + 1).limit(1);
    const prevQuery = adminDb.collection('lessons')
      .where('courseId', '==', courseId).where('order', '==', order - 1).limit(1);

    const [nextSnap, prevSnap] = await Promise.all([nextQuery.get(), prevQuery.get()]);

    res.json({
      next: !nextSnap.empty ? { id: nextSnap.docs[0].id, ...nextSnap.docs[0].data() } : null,
      prev: !prevSnap.empty ? { id: prevSnap.docs[0].id, ...prevSnap.docs[0].data() } : null
    });
  } catch (error: any) {
    console.error('Error fetching navigation lessons:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
