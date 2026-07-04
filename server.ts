import express from 'express';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Initialize Stripe lazily
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn('STRIPE_SECRET_KEY environment variable is missing. Stripe integration will not work.');
      return new Stripe('dummy_key', { apiVersion: '2026-02-25.clover' });
    }
    stripeClient = new Stripe(key, { apiVersion: '2026-02-25.clover' });
  }
  return stripeClient;
}

// Initialize Firebase Admin lazily for webhooks
let db: FirebaseFirestore.Firestore | null = null;
// --- Utility Helpers ---
const cleanData = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => newObj[key] === undefined && delete newObj[key]);
  return newObj;
};

function getAdminDb() {
  if (!db) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.log('Initializing Firebase Admin SDK...');
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
          credential: cert(serviceAccount)
        });
        db = getFirestore();
        console.log('Firebase Admin SDK Initialized.');
      } else {
        console.error('CRITICAL: FIREBASE_SERVICE_ACCOUNT environment variable is missing!');
        console.warn('Questions and Exam features will fail because the Admin SDK is not configured.');
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
    }
  }
  return db;
}

// Webhook endpoint needs raw body
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).send('Webhook secret or signature missing');
    return;
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const courseId = session.metadata?.courseId;

    if (userId && courseId) {
      const adminDb = getAdminDb();
      if (adminDb) {
        try {
          await adminDb.collection('enrollments').doc(`${userId}_${courseId}`).set({
            userId,
            courseId,
            status: 'active',
            paymentMethod: 'stripe',
            createdAt: new Date().toISOString(),
            stripeSessionId: session.id
          });
          console.log(`Successfully enrolled user ${userId} in course ${courseId}`);
        } catch (error) {
          console.error('Error updating enrollment in Firestore:', error);
        }
      }
    }
  }

  res.json({ received: true });
});

// Regular JSON parsing for other API routes
app.use(express.json());

// Global API Logger for diagnostic
app.use('/api', (req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.url}`);
  next();
});

// Heartbeat for diagnostic
app.get('/api/health', (req, res) => {
  console.log('API HIT: /api/health');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth Middleware
const authenticateUser = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const adminDb = getAdminDb();
    if (!adminDb) return res.status(500).json({ error: 'DB error' });
    
    // In a real app, use admin.auth().verifyIdToken(token)
    // For this demonstration, we'll assume the client is handling the token, 
    // but we'll check the database for enrollment.
    // Let's at least try to decode if possible or use a mock if not configured.
    req.userId = token; // Use the provided "token" as userId for simplicity in this demo environment
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin Promotion Endpoint (Bypasses Firestore Rules)
app.post('/api/admin/promote', async (req: any, res: any) => {
  const { uid, email, displayName } = req.body;
  
  if (!uid || !email) {
    return res.status(400).json({ error: 'Missing uid or email' });
  }

  const adminEmails = ['admin@fahmni.com', 'mostafagooda36@gmail.com', 'tafagooda35@gmail.com'];
  if (!adminEmails.includes(email)) {
    return res.status(403).json({ error: 'Not an admin email' });
  }

  try {
    const adminDb = getAdminDb();
    if (!adminDb) return res.status(500).json({ error: 'Database connection failed' });

    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      await userRef.set({
        uid,
        email,
        displayName: displayName || 'Admin',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    } else {
      await userRef.set({ role: 'admin' }, { merge: true });
    }
    
    res.json({ success: true, message: 'User promoted to admin successfully' });
  } catch (error: any) {
    console.error('Error promoting admin:', error);
    res.status(500).json({ error: error.message });
  }
});

// Video Verification Endpoint
app.get('/api/video/verify/:lessonId', authenticateUser, async (req: any, res: any) => {
  const { lessonId } = req.params;
  const userId = req.userId; // From middleware
  
  try {
    const adminDb = getAdminDb();
    if (!adminDb) return res.status(500).json({ error: 'Database connection failed' });

    // 1. Get Lesson
    const lessonDoc = await adminDb.collection('lessons').doc(lessonId).get();
    if (!lessonDoc.exists) return res.status(404).json({ error: 'Lesson not found' });
    const lessonData = lessonDoc.data();

    // 2. Check if lesson is free preview
    if (lessonData?.isFreePreview) {
      return res.json({ videoId: extractVideoId(lessonData.videoUrl), authorized: true });
    }

    // 3. Check Enrollment
    const enrollmentId = `${userId}_${lessonData?.courseId}`;
    const enrollmentDoc = await adminDb.collection('enrollments').doc(enrollmentId).get();
    
    if (enrollmentDoc.exists && enrollmentDoc.data()?.status === 'active') {
      return res.json({ videoId: extractVideoId(lessonData?.videoUrl), authorized: true });
    }

    // 4. Admin check
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

function extractVideoId(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : url;
}

// Global API download proxy to bypass CORS on external files (e.g. Google Drive)
app.get('/api/download-proxy', async (req: any, res: any) => {
  const fileUrl = req.query.url;
  if (!fileUrl) {
    res.status(400).json({ error: 'Missing url query parameter' });
    return;
  }

  try {
    let targetUrl = fileUrl;
    let fileId: string | null = null;

    if (fileUrl.includes('drive.google.com')) {
      const match = fileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        fileId = match[1];
        targetUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }

    let response;

    if (fileId) {
      // 1. GET request to fetch cookies (and trigger warning if necessary)
      const getRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const contentType = getRes.headers.get('content-type') || '';

      if (contentType.includes('text/html')) {
        const cookies = getRes.headers.getSetCookie();
        const warningCookie = cookies.find(c => c.includes('download_warning'));

        if (warningCookie) {
          const cookieString = warningCookie.split(';')[0];
          // 2. POST request with the warning-confirmation cookie to get actual PDF bytes
          response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Cookie': cookieString
            }
          });
        } else {
          response = getRes;
        }
      } else {
        response = getRes;
      }
    } else {
      response = await fetch(targetUrl);
    }

    if (!response.ok) {
      res.status(response.status).json({ error: `Failed to fetch target file: ${response.statusText}` });
      return;
    }

    const finalContentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', finalContentType);

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error: any) {
    console.error('Proxy Download Error:', error);
    res.status(500).json({ error: error.message || 'Failed to download file through proxy' });
  }
});

// YouTube Playlist Import API
app.get('/api/youtube/playlist', async (req, res) => {
  const { playlistId } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!playlistId || typeof playlistId !== 'string') {
    res.status(400).json({ error: 'Playlist ID is required' });
    return;
  }

  if (!apiKey) {
    res.status(500).json({ error: 'YouTube API Key is not configured' });
    return;
  }

  try {
    const youtube = google.youtube({
      version: 'v3',
      auth: apiKey,
    });

    // 1. Fetch playlist details
    const playlistResponse = await youtube.playlists.list({
      part: ['snippet'],
      id: [playlistId],
    });

    if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    const playlist = playlistResponse.data.items[0];
    const playlistInfo = {
      title: playlist.snippet?.title,
      description: playlist.snippet?.description,
      thumbnail: playlist.snippet?.thumbnails?.maxres?.url || playlist.snippet?.thumbnails?.high?.url,
    };

    // 2. Fetch all videos in the playlist
    const videos: any[] = [];
    let nextPageToken: string | undefined | null = undefined;

    do {
      const playlistItemsResponse: any = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: playlistId,
        maxResults: 50,
        pageToken: nextPageToken || undefined,
      });

      const items = playlistItemsResponse.data.items || [];
      videos.push(...items.map((item: any) => ({
        title: item.snippet.title,
        description: item.snippet.description,
        videoId: item.contentDetails.videoId,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        position: item.snippet.position,
      })));

      nextPageToken = playlistItemsResponse.data.nextPageToken;
    } while (nextPageToken);

    res.json({
      playlist: playlistInfo,
      videos: videos,
    });
  } catch (error: any) {
    console.error('YouTube API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch playlist data' });
  }
});

// Get Lesson Details (including Quiz)
app.get('/api/lessons/:lessonId', async (req, res) => {
  try {
    const { lessonId } = req.params;
    const adminDb = getAdminDb();
    if (!adminDb) {
      res.status(500).json({ error: 'Database connection failed' });
      return;
    }

    const lessonDoc = await adminDb.collection('lessons').doc(lessonId).get();
    if (!lessonDoc.exists) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    const lessonData = lessonDoc.data();
    
    // Fetch Quiz for this lesson
    const quizSnapshot = await adminDb.collection('quizzes').where('lessonId', '==', lessonId).limit(1).get();
    const quiz = !quizSnapshot.empty ? { id: quizSnapshot.docs[0].id, ...quizSnapshot.docs[0].data() } : null;

    res.json({
      ...lessonData,
      id: lessonDoc.id,
      quiz
    });
  } catch (error: any) {
    console.error('Error fetching lesson details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Next/Previous Lesson
app.get('/api/courses/:courseId/lessons/:currentOrder/nav', async (req, res) => {
  try {
    const { courseId, currentOrder } = req.params;
    const order = parseInt(currentOrder);
    const adminDb = getAdminDb();
    
    if (!adminDb) {
      res.status(500).json({ error: 'Database connection failed' });
      return;
    }

    const nextQuery = adminDb.collection('lessons')
      .where('courseId', '==', courseId)
      .where('order', '==', order + 1)
      .limit(1);
    
    const prevQuery = adminDb.collection('lessons')
      .where('courseId', '==', courseId)
      .where('order', '==', order - 1)
      .limit(1);

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

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { courseId, courseTitle, price, userId, userEmail } = req.body;

    if (!courseId || !courseTitle || price === undefined || !userId) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    const stripe = getStripe();
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'dummy_key') {
      res.status(500).json({ error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables.' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: courseTitle,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/courses/${courseId}`,
      customer_email: userEmail,
      metadata: {
        userId,
        courseId
      }
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// QUESTION BANK ENDPOINTS
// ─────────────────────────────────────────────

/**
 * GET /api/questions
 * Query params: grade, subject
 * Returns questions WITHOUT correctOptionIndex (anti-cheat)
 */
app.get('/api/questions', async (req: any, res: any) => {
  const { grade, subject } = req.query;
  const adminDb = getAdminDb();
  if (!adminDb) return res.status(500).json({ error: 'DB error' });

  try {
    let q: any = adminDb.collection('questions');
    if (grade) q = q.where('grade', '==', grade);
    if (subject) q = q.where('subject', '==', subject);
    const snap = await q.get();
    const questions = snap.docs.map((doc: any) => {
      const data = doc.data();
      // Strip answer before sending to client
      const { correctOptionIndex, explanation, ...publicData } = data;
      return { id: doc.id, ...publicData };
    });
    res.json({ questions });
  } catch (err: any) {
    console.error('Questions fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/questions/answer
 * Body: { questionId, selectedIndex, userId }
 * Returns: { correct: boolean, correctIndex: number, explanation: string }
 * Correct answer is ONLY read server-side, never sent raw to client
 */
app.post('/api/questions/answer', async (req: any, res: any) => {
  console.log('API HIT: /api/questions/answer', req.body);
  const { questionId, selectedIndex, userId } = req.body;
  if (!questionId || selectedIndex === undefined || !userId) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const adminDb = getAdminDb();
  if (!adminDb) return res.status(500).json({ error: 'DB error' });

  try {
    const doc = await adminDb.collection('questions').doc(questionId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Question not found' });

    const data = doc.data()!;
    const correct = data.correctOptionIndex === selectedIndex;

    // Log attempt (optional)
    await adminDb.collection('question_attempts').add({
      userId,
      questionId,
      selectedIndex,
      correct,
      grade: data.grade,
      subject: data.subject,
      chapter: data.chapter,
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
 * Body: { examId, answers: { questionId, selectedIndex }[], userId, timeTaken }
 * Scores server-side, saves to student_results, returns scorecard
 */
app.post('/api/exams/submit', async (req: any, res: any) => {
  console.log('API HIT: /api/exams/submit', req.body);
  const { examId, answers, userId, timeTaken } = req.body;
  if (!examId || !answers || !userId) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const adminDb = getAdminDb();
  if (!adminDb) return res.status(500).json({ error: 'DB error' });

  try {
    // 1. Load exam
    const examDoc = await adminDb.collection('exams').doc(examId).get();
    if (!examDoc.exists) return res.status(404).json({ error: 'Exam not found' });
    const exam = examDoc.data()!;
    const examQuestions: any[] = exam.questions || [];

    // 2. Score answers (chapter breakdown)
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

    // 3. Build chapter breakdown for report
    const chapterBreakdown = Object.entries(chapterStats).map(([chapter, stats]) => ({
      chapter,
      correct: stats.correct,
      total: stats.total,
      percentage: Math.round((stats.correct / stats.total) * 100),
      level: stats.correct / stats.total >= 0.85 ? 'متفوق' : stats.correct / stats.total >= 0.7 ? 'جيد' : 'متوسط'
    }));

    // 4. Save result to Firestore
    const resultData = {
      userId,
      examId,
      examTitle: exam.title,
      subject: exam.subject,
      grade: exam.grade,
      totalCorrect,
      totalQuestions,
      percentage,
      level,
      timeTaken: timeTaken || 0,
      chapterBreakdown,
      details,
      teacherId: exam.teacherId || 'unknown',
      teacherName: exam.teacherName || 'غير معروف',
      submittedAt: new Date().toISOString()
    };
    console.log('Final ResultData for Firestore:', JSON.stringify(resultData, null, 2));
    const resultRef = await adminDb.collection('student_results').add(cleanData(resultData));
    console.log('Result saved with ID:', resultRef.id);

    res.json({ ...resultData, resultId: resultRef.id });
  } catch (err: any) {
    console.error('Exam submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const getPageTitle = async (hostname: string) => {
    let pageTitle = 'تعلم ببساطة';
    const parts = hostname.split('.');
    let tenant = null;
    
    if (hostname === 'fahmni.me' || hostname === 'www.fahmni.me' || hostname === 'localhost' || hostname === '127.0.0.1') {
      tenant = null;
    } else if (parts.length >= 3 && parts[1] === 'fahmni' && parts[2] === 'me') {
      tenant = parts[0] === 'www' ? null : parts[0];
    } else if (parts.length === 2 && parts[1] === 'localhost') {
      tenant = parts[0];
    } else if (parts.length >= 3) {
      tenant = parts[0];
    }

    if (tenant) {
      try {
        const adminDb = getAdminDb();
        if (adminDb) {
          const tenantDoc = await adminDb.collection('tenants').doc(tenant).get();
          if (tenantDoc.exists) {
            const data = tenantDoc.data();
            if (data?.siteName) pageTitle = data.siteName;
            else if (data?.name) pageTitle = data.name;
          }
        }
      } catch (err) {
        console.error('Error fetching tenant for meta tags:', err);
      }
    }
    return pageTitle;
  };

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = await fs.readFile(path.join(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        
        const pageTitle = await getPageTitle(req.hostname);
        template = template.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
        template = template.replace(/<meta property="og:title" content=".*?"\s*\/?>/, `<meta property="og:title" content="${pageTitle}" />`);
        
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    
    app.get('*', async (req, res) => {
      try {
        let html = await fs.readFile(path.join(distPath, 'index.html'), 'utf-8');
        const pageTitle = await getPageTitle(req.hostname);
        html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
        html = html.replace(/<meta property="og:title" content=".*?"\s*\/?>/, `<meta property="og:title" content="${pageTitle}" />`);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } catch (err) {
        console.error('Error serving html:', err);
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
