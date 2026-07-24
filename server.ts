import express from 'express';
import { createServer as createViteServer } from 'vite';
import Stripe from 'stripe';
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { PDFDocument, rgb as pdfRgb, degrees as pdfDegrees } from 'pdf-lib';

dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

// Regular JSON parsing for other API routes (increased limit to 50mb for exporter tenant payload)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Server-side Forensic Stamped PDF streaming
app.get('/api/view-pdf', async (req: any, res: any) => {
  const fileUrl = req.query.url;
  const name = req.query.name || '';
  const phone = req.query.phone || '';
  const email = req.query.email || '';
  const id = req.query.id || '';
  const ip = req.query.ip || req.ip || '';

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

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF
    const isValidPdf = buffer.length >= 5 &&
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46 && // F
      buffer[4] === 0x2D;   // -

    if (!isValidPdf) {
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(buffer);
      return;
    }

    // Load PDF Document
    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();

    // Helper to sanitize
    const sanitizeAscii = (str: string) => {
      if (!str) return '';
      return str.split('').filter(char => {
        const code = char.charCodeAt(0);
        return code >= 32 && code <= 126;
      }).join('').trim();
    };

    const cleanName = sanitizeAscii(name);
    const cleanPhone = sanitizeAscii(phone);
    const cleanId = sanitizeAscii(id);
    const cleanEmail = email ? sanitizeAscii(email) : cleanPhone;
    const cleanIp = ip ? sanitizeAscii(ip) : '';
    const dateText = new Date().toLocaleDateString('en-US');

    const ipPart = cleanIp ? ` | IP: ${cleanIp}` : '';
    const namePart = cleanName ? `${cleanName} | ` : '';
    const visibleText = `ID: ${cleanId} | ${namePart}${cleanEmail}${ipPart} | Date: ${dateText}`;

    pdfDoc.setTitle(`Forensic Copy - ID: ${cleanId}`);
    pdfDoc.setAuthor('Fahmni Education Security');
    pdfDoc.setSubject(`Licensed to: ${cleanEmail} (Tel: ${cleanPhone})`);
    pdfDoc.setKeywords([`id:${cleanId}`, `email:${cleanEmail}`, `phone:${cleanPhone}`, `ip:${cleanIp}`]);

    for (const page of pages) {
      const { width, height } = page.getSize();
      const fontColor = pdfRgb(0.65, 0.65, 0.65);
      const opacity = 0.18;

      const stepsX = 2;
      const stepsY = 3;
      for (let x = 1; x <= stepsX; x++) {
        for (let y = 1; y <= stepsY; y++) {
          const posX = (width / (stepsX + 1)) * x - 100;
          const posY = (height / (stepsY + 1)) * y;

          page.drawText(visibleText, {
            x: posX,
            y: posY,
            size: 11,
            color: fontColor,
            opacity: opacity,
            rotate: pdfDegrees(30),
          });
        }
      }

      // Invisible Forensic watermark
      const hiddenText = `ID: ${cleanId} | ${cleanEmail}`;
      page.drawText(hiddenText, {
        x: width / 2 - 100,
        y: 35,
        size: 13,
        color: pdfRgb(1.0, 1.0, 0.92),
      });
    }

    const stampedPdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="licensed_document.pdf"');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(stampedPdfBytes));
  } catch (error: any) {
    console.error('Server PDF stamping error:', error);
    res.status(500).json({ error: error.message || 'Failed to stamp PDF' });
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

// ─────────────────────────────────────────────
// WHATSAPP NOTIFICATION ENDPOINTS (Twilio)
// ─────────────────────────────────────────────

const sendWhatsAppMessage = async (to: string, body: string) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (!accountSid || !authToken) {
    console.warn('Twilio credentials not configured. WhatsApp message not sent.');
    return { success: false, error: 'Twilio not configured' };
  }

  // Clean and format the phone number
  let cleanedTo = to.replace(/[\s\-\(\)]/g, '');
  if (!cleanedTo.startsWith('+')) {
    // Assume Egyptian number if no country code
    if (cleanedTo.startsWith('0')) cleanedTo = cleanedTo.substring(1);
    cleanedTo = '+2' + cleanedTo;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: `whatsapp:${cleanedTo}`,
      From: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
      Body: body,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio WhatsApp Error:', data);
      return { success: false, error: data.message || 'Failed to send' };
    }

    console.log(`WhatsApp sent to ${cleanedTo}: SID=${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (err: any) {
    console.error('WhatsApp send error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * POST /api/whatsapp/send
 * Body: { to: string (phone), message: string, studentId?: string }
 * Sends a custom WhatsApp message
 */
app.post('/api/whatsapp/send', async (req: any, res: any) => {
  const { to, message, studentId } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing required fields: to, message' });
  }

  const result = await sendWhatsAppMessage(to, message);

  // Log the notification in Firestore
  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      await adminDb.collection('whatsapp_logs').add({
        to,
        message,
        studentId: studentId || null,
        status: result.success ? 'sent' : 'failed',
        error: result.error || null,
        sid: result.success ? (result as any).sid : null,
        sentAt: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error('Failed to log WhatsApp message:', logErr);
    }
  }

  if (result.success) {
    res.json({ success: true, sid: (result as any).sid });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

/**
 * POST /api/whatsapp/notify-result
 * Body: { studentId: string, examTitle: string, score: number, total: number, percentage: number }
 * Sends exam result notification to parent via WhatsApp
 */
app.post('/api/whatsapp/notify-result', async (req: any, res: any) => {
  const { studentId, examTitle, score, total, percentage } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'Missing studentId' });
  }

  const adminDb = getAdminDb();
  if (!adminDb) return res.status(500).json({ error: 'DB error' });

  try {
    // Find student and parent phone
    let studentDoc = await adminDb.collection('users').doc(studentId).get();
    if (!studentDoc.exists) {
      studentDoc = await adminDb.collection('center_students').doc(studentId).get();
    }
    if (!studentDoc.exists) return res.status(404).json({ error: 'Student not found' });

    const studentData = studentDoc.data()!;
    const parentPhone = studentData.fatherPhone || studentData.motherPhone;

    if (!parentPhone) {
      return res.status(400).json({ error: 'No parent phone number found for this student' });
    }

    const level = percentage >= 85 ? 'متفوق ⭐' : percentage >= 70 ? 'جيد جداً 👏' : percentage >= 55 ? 'جيد 👍' : percentage >= 40 ? 'متوسط ⚠️' : 'يحتاج تحسين 📚';

    const message = `📋 *نتيجة اختبار جديدة*\n\n` +
      `👤 الطالب: ${studentData.displayName || 'طالب'}\n` +
      `📝 الاختبار: ${examTitle || 'غير محدد'}\n` +
      `✅ النتيجة: ${score || 0} / ${total || 0}\n` +
      `📊 النسبة: ${percentage || 0}%\n` +
      `🏆 المستوى: ${level}\n\n` +
      `_هذه رسالة تلقائية من المنصة التعليمية_`;

    const result = await sendWhatsAppMessage(parentPhone, message);

    // Log
    await adminDb.collection('whatsapp_logs').add({
      to: parentPhone,
      type: 'exam_result',
      studentId,
      message,
      status: result.success ? 'sent' : 'failed',
      sentAt: new Date().toISOString(),
    });

    res.json({ success: result.success, parentPhone });
  } catch (err: any) {
    console.error('WhatsApp notify-result error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/whatsapp/notify-attendance
 * Body: { studentId: string, date: string, status: 'present'|'absent'|'late'|'excused' }
 * Sends attendance notification to parent via WhatsApp
 */
app.post('/api/whatsapp/notify-attendance', async (req: any, res: any) => {
  const { studentId, date, status } = req.body;

  if (!studentId || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const adminDb = getAdminDb();
  if (!adminDb) return res.status(500).json({ error: 'DB error' });

  try {
    let studentDoc = await adminDb.collection('users').doc(studentId).get();
    if (!studentDoc.exists) {
      studentDoc = await adminDb.collection('center_students').doc(studentId).get();
    }
    if (!studentDoc.exists) return res.status(404).json({ error: 'Student not found' });

    const studentData = studentDoc.data()!;
    const parentPhone = studentData.fatherPhone || studentData.motherPhone;

    if (!parentPhone) {
      return res.status(400).json({ error: 'No parent phone number found' });
    }

    const statusMap: Record<string, string> = {
      'present': '✅ حاضر',
      'absent': '❌ غائب',
      'late': '⚠️ متأخر',
      'excused': '📋 مستأذن',
    };

    const statusText = statusMap[status] || status;

    const message = `📢 *إشعار حضور*\n\n` +
      `👤 الطالب: ${studentData.displayName || 'طالب'}\n` +
      `📅 التاريخ: ${date || new Date().toLocaleDateString('ar-EG')}\n` +
      `📌 الحالة: ${statusText}\n\n` +
      `_هذه رسالة تلقائية من المنصة التعليمية_`;

    const result = await sendWhatsAppMessage(parentPhone, message);

    await adminDb.collection('whatsapp_logs').add({
      to: parentPhone,
      type: 'attendance',
      studentId,
      status,
      message,
      result: result.success ? 'sent' : 'failed',
      sentAt: new Date().toISOString(),
    });

    res.json({ success: result.success, parentPhone });
  } catch (err: any) {
    console.error('WhatsApp notify-attendance error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/whatsapp/send-custom
 * Body: { studentId: string, message: string }
 * Teacher sends a custom WhatsApp message to a student's parent
 */
app.post('/api/whatsapp/send-custom', async (req: any, res: any) => {
  const { studentId, message } = req.body;

  if (!studentId || !message) {
    return res.status(400).json({ error: 'Missing studentId or message' });
  }

  const adminDb = getAdminDb();
  if (!adminDb) return res.status(500).json({ error: 'DB error' });

  try {
    let studentDoc = await adminDb.collection('users').doc(studentId).get();
    if (!studentDoc.exists) {
      studentDoc = await adminDb.collection('center_students').doc(studentId).get();
    }
    if (!studentDoc.exists) return res.status(404).json({ error: 'Student not found' });

    const studentData = studentDoc.data()!;
    const parentPhone = studentData.fatherPhone || studentData.motherPhone;

    if (!parentPhone) {
      return res.status(400).json({ error: 'No parent phone number found' });
    }

    const fullMessage = `💬 *رسالة من المعلم*\n\n` +
      `👤 بخصوص الطالب: ${studentData.displayName || 'طالب'}\n\n` +
      `${message}\n\n` +
      `_هذه رسالة من المنصة التعليمية_`;

    const result = await sendWhatsAppMessage(parentPhone, fullMessage);

    await adminDb.collection('whatsapp_logs').add({
      to: parentPhone,
      type: 'custom',
      studentId,
      message: fullMessage,
      status: result.success ? 'sent' : 'failed',
      sentAt: new Date().toISOString(),
    });

    res.json({ success: result.success, parentPhone });
  } catch (err: any) {
    console.error('WhatsApp send-custom error:', err);
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

  // Backend Standalone Exporter API - bundles compiled dist assets + configs + full tenant branding
  app.all('/api/export-standalone-zip', async (req, res) => {
    try {
      const bodyData = req.body || {};
      const queryData = req.query || {};
      const payload = { ...queryData, ...bodyData };

      const tenantId = (payload.subdomain as string) || (payload.tenant?.subdomain as string) || 'standalone';
      const customDomain = (payload.customDomain as string) || (payload.tenant?.customDomain as string) || (tenantId ? `${tenantId}.fahmni.me` : '');
      const name = (payload.name as string) || (payload.tenant?.name as string) || tenantId || 'المنصة المستقلة';
      const firebaseConfig = (payload.firebaseConfig as string) || (payload.tenant?.firebaseConfig as string) || '';
      const supabaseUrl = (payload.supabaseUrl as string) || (payload.tenant?.supabaseUrl as string) || '';
      const supabaseAnonKey = (payload.supabaseAnonKey as string) || (payload.tenant?.supabaseAnonKey as string) || '';

      // Fetch full tenant document from Firestore to bundle branding, logo, colors, and content
      let tenantDocData: any = {};
      try {
        const adminDb = getAdminDb();
        if (adminDb && tenantId) {
          const tDoc = await adminDb.collection('tenants').doc(tenantId).get();
          if (tDoc.exists) {
            tenantDocData = tDoc.data() || {};
          }
        }
      } catch (e) {
        console.error('Error fetching tenant doc in exporter API:', e);
      }

      const tenantObj = payload.tenant || payload || {};

      const fullTenantObj = {
        name,
        siteName: tenantObj.siteName || tenantObj.name || tenantDocData.siteName || tenantDocData.name || name,
        teacherName: tenantObj.teacherName || tenantObj.name || tenantDocData.teacherName || tenantDocData.name || name,
        teacherTitle: tenantObj.teacherTitle || tenantDocData.teacherTitle || '',
        subject: tenantObj.subject || tenantDocData.subject || '',
        logo: tenantObj.logo || tenantObj.logoUrl || tenantDocData.logo || tenantDocData.logoUrl || '',
        logoUrl: tenantObj.logoUrl || tenantObj.logo || tenantDocData.logoUrl || tenantDocData.logo || '',
        fruitTheme: tenantObj.fruitTheme || tenantDocData.fruitTheme || 'emerald',
        primaryColor: tenantObj.primaryColor || tenantDocData.primaryColor || '',
        welcomeTitle: tenantObj.welcomeTitle || tenantDocData.welcomeTitle || '',
        welcomeSubtitle: tenantObj.welcomeSubtitle || tenantDocData.welcomeSubtitle || '',
        heroBanner: tenantObj.heroBanner || tenantDocData.heroBanner || '',
        heroTitle1: tenantObj.heroTitle1 || tenantDocData.heroTitle1 || '',
        heroTitle2: tenantObj.heroTitle2 || tenantDocData.heroTitle2 || '',
        heroTitle3: tenantObj.heroTitle3 || tenantDocData.heroTitle3 || '',
        heroDescription: tenantObj.heroDescription || tenantDocData.heroDescription || '',
        teacherPhoto: tenantObj.teacherPhoto || tenantObj.teacherPhotoUrl || tenantDocData.teacherPhoto || tenantDocData.teacherPhotoUrl || '',
        teacherPhotoUrl: tenantObj.teacherPhotoUrl || tenantObj.teacherPhoto || tenantDocData.teacherPhotoUrl || tenantDocData.teacherPhoto || '',
        facebook: tenantObj.facebook || tenantDocData.facebook || '',
        youtube: tenantObj.youtube || tenantDocData.youtube || '',
        telegram: tenantObj.telegram || tenantDocData.telegram || '',
        whatsapp: tenantObj.whatsapp || tenantDocData.whatsapp || '',
        instagram: tenantObj.instagram || tenantDocData.instagram || '',
        tiktok: tenantObj.tiktok || tenantDocData.tiktok || '',
        ...tenantDocData,
        ...tenantObj,
        subdomain: tenantId,
        customDomain,
        firebaseConfig,
        supabaseUrl,
        supabaseAnonKey,
      };

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // 1. .env file
      const envContent = `# =======================================================
# Standalone Environment Config for Tenant: ${name}
# Subdomain / ID: ${tenantId}
# Custom Domain: ${customDomain}
# Generated Date: ${new Date().toLocaleString('ar-EG')}
# =======================================================

VITE_TENANT_ID=${tenantId}
VITE_CUSTOM_DOMAIN=${customDomain}
VITE_FIREBASE_CONFIG='${firebaseConfig}'
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}
VITE_STANDALONE_MODE=true
VITE_TENANT_DATA='${JSON.stringify(fullTenantObj)}'
`;
      zip.file('.env', envContent);

      // 2. firebase-applet-config.json
      let jsonStr = firebaseConfig || '{}';
      try {
        jsonStr = JSON.stringify(JSON.parse(firebaseConfig), null, 2);
      } catch (e) {}
      zip.file('firebase-applet-config.json', jsonStr);

      // 3. .htaccess for CPanel / Hostinger
      const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`;
      zip.file('.htaccess', htaccessContent);

      // 4. vercel.json for 1-Click Vercel Deployment
      const vercelJsonContent = JSON.stringify({
        version: 2,
        buildCommand: "echo 'Static deployment bundle ready'",
        outputDirectory: ".",
        rewrites: [{ source: "/(.*)", destination: "/index.html" }]
      }, null, 2);
      zip.file('vercel.json', vercelJsonContent);

      // 5. DEPLOYMENT_GUIDE.md
      zip.file('DEPLOYMENT_GUIDE.md', `# 🚀 دليل استضافة المنصة المستقلة للمعلم: ${name}
تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}
الدومين المستهدف: ${customDomain}

## 1. الرفع السريع على Vercel / Netlify
1. قم بفك الضغط عن هذا المجلد.
2. اسحب المجلد إلى Vercel أو Netlify Drop (app.netlify.com/drop).
3. اضغط Deploy وستعمل المنصة فوراً بدون أي أخطاء!

## 2. الرفع على Hostinger أو CPanel
1. افتح لوحة التحكم في Hostinger أو CPanel.
2. ارفع كافة الملفات الموجودة داخل مجلد dist_ready_for_public_html إلى مجلد public_html.
3. ستعمل المنصة ودومينك الخاص فوراً!
`);

      // 6. Read actual compiled dist directory files if available
      const distPath = path.join(process.cwd(), 'dist');
      let hasDist = false;
      try {
        const stats = await fs.stat(distPath);
        if (stats.isDirectory()) {
          hasDist = true;
        }
      } catch (e) {}

      async function addFolderToZip(zipObj: any, folderPath: string, zipRelativePath: string) {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(folderPath, entry.name);
          const relPath = zipRelativePath ? `${zipRelativePath}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await addFolderToZip(zipObj, fullPath, relPath);
          } else {
            let fileData = await fs.readFile(fullPath);
            if (entry.name === 'index.html') {
              let htmlStr = fileData.toString('utf-8');
              const injectScript = `<script>
  window.VITE_TENANT_ID = "${tenantId}";
  window.VITE_CUSTOM_DOMAIN = "${customDomain}";
  window.VITE_FIREBASE_CONFIG = '${firebaseConfig}';
  window.VITE_SUPABASE_URL = "${supabaseUrl}";
  window.VITE_SUPABASE_ANON_KEY = "${supabaseAnonKey}";
  window.VITE_STANDALONE_MODE = "true";
  window.VITE_TENANT_DATA = ${JSON.stringify(fullTenantObj)};
</script>`;
              htmlStr = htmlStr.replace('<head>', `<head>\n  ${injectScript}`);
              htmlStr = htmlStr.replace(/<title>.*?<\/title>/, `<title>منصة فهماني التعليمية - ${name}</title>`);
              zipObj.file(relPath, htmlStr);
            } else {
              zipObj.file(relPath, fileData);
            }
          }
        }
      }

      if (hasDist) {
        await addFolderToZip(zip, distPath, '');
        const distFolder = zip.folder('dist_ready_for_public_html');
        if (distFolder) {
          await addFolderToZip(distFolder, distPath, '');
          distFolder.file('.htaccess', htaccessContent);
          distFolder.file('.env', envContent);
          distFolder.file('firebase-applet-config.json', jsonStr);
          distFolder.file('vercel.json', vercelJsonContent);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="fahmni_standalone_${tenantId}_full_bundle.zip"`);
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Error generating standalone zip:', err);
      res.status(500).json({ error: err.message });
    }
  });
  // ============================================================
  // 🕒 12-HOUR AUTOMATED BACKUP ENGINE (CRON SCHEDULER)
  // ============================================================
  const BACKUP_DIR = path.join(process.cwd(), 'backups');

  async function ensureBackupDir() {
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (e) {}
  }

  async function runAutomated12HourBackup() {
    try {
      await ensureBackupDir();
      const adminDb = getAdminDb();
      if (!adminDb) return;

      console.log('⏰ Starting Automated 12-Hour System Backup Job...');
      const tenantsSnap = await adminDb.collection('tenants').get();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupSubDir = path.join(BACKUP_DIR, `system_backup_${timestamp}`);
      await fs.mkdir(backupSubDir, { recursive: true });

      const allTenantsData: any[] = [];
      for (const doc of tenantsSnap.docs) {
        const tenantData = doc.data();
        allTenantsData.push({ id: doc.id, ...tenantData });
      }

      await fs.writeFile(
        path.join(backupSubDir, 'all_tenants_backup.json'),
        JSON.stringify(allTenantsData, null, 2),
        'utf-8'
      );

      console.log(`✅ Automated 12-Hour Backup Completed Successfully! Saved in: ${backupSubDir}`);
    } catch (error) {
      console.error('Error during automated 12-hour backup job:', error);
    }
  }

  // Schedule automated backup every 12 hours (12 * 60 * 60 * 1000 ms)
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  setInterval(runAutomated12HourBackup, TWELVE_HOURS_MS);

  // Trigger initial background backup after 1 minute of server startup
  setTimeout(runAutomated12HourBackup, 60 * 1000);

  // API Endpoint - Manual Backup Trigger
  app.post('/api/backups/trigger-now', async (req, res) => {
    try {
      await runAutomated12HourBackup();
      res.json({ success: true, message: 'تم إنشاء النسخة الاحتياطية بنجاح!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Endpoint - List System Backups
  app.get('/api/backups/list', async (req, res) => {
    try {
      await ensureBackupDir();
      const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
      const backups = entries
        .filter(e => e.isDirectory() && e.name.startsWith('system_backup_'))
        .map(e => ({
          name: e.name,
          createdAt: e.name.replace('system_backup_', '').replace(/-/g, ':')
        }))
        .sort((a, b) => b.name.localeCompare(a.name));

      res.json({ backups });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Endpoint - Export Single Tenant Complete JSON Backup
  app.get('/api/tenants/:tenantId/export-backup', async (req, res) => {
    try {
      const { tenantId } = req.params;
      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: 'Database admin instance not available' });
      }

      // Fetch tenant metadata
      const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
      const tenantData = tenantDoc.exists ? tenantDoc.data() : { id: tenantId };

      // Helper to fetch collection filtering by tenantId if applicable
      async function getTenantCollection(colName: string) {
        try {
          const snap = await adminDb.collection(colName).where('tenantId', '==', tenantId).get();
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          try {
            const allSnap = await adminDb.collection(colName).get();
            return allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch (e2) {
            return [];
          }
        }
      }

      const backupObj = {
        tenantId,
        exportedAt: new Date().toISOString(),
        tenant: tenantData,
        users: await getTenantCollection('users'),
        courses: await getTenantCollection('courses'),
        lessons: await getTenantCollection('lessons'),
        exams: await getTenantCollection('exams'),
        questions: await getTenantCollection('questions'),
        examResults: await getTenantCollection('examResults'),
        chargeCards: await getTenantCollection('chargeCards')
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="backup_${tenantId}_${new Date().toISOString().slice(0, 10)}.json"`);
      res.send(JSON.stringify(backupObj, null, 2));
    } catch (err: any) {
      console.error('Error exporting tenant backup:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Endpoint - Restore Single Tenant Complete JSON Backup
  app.post('/api/tenants/:tenantId/restore-backup', async (req, res) => {
    try {
      const { tenantId } = req.params;
      const backupData = req.body;

      if (!backupData || typeof backupData !== 'object') {
        return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح' });
      }

      const adminDb = getAdminDb();
      if (!adminDb) {
        return res.status(500).json({ error: 'Database admin instance not available' });
      }

      console.log(`Starting restore process for tenant ${tenantId}...`);

      // Restore tenant doc
      if (backupData.tenant) {
        await adminDb.collection('tenants').doc(tenantId).set(backupData.tenant, { merge: true });
      }

      // Batch restore helper
      async function restoreCollection(colName: string, items?: any[]) {
        if (!items || !Array.isArray(items)) return;
        for (const item of items) {
          if (item && item.id) {
            const itemId = item.id;
            const dataToSave = { ...item, tenantId };
            delete dataToSave.id;
            await adminDb.collection(colName).doc(itemId).set(dataToSave, { merge: true });
          }
        }
      }

      await restoreCollection('users', backupData.users);
      await restoreCollection('courses', backupData.courses);
      await restoreCollection('lessons', backupData.lessons);
      await restoreCollection('exams', backupData.exams);
      await restoreCollection('questions', backupData.questions);
      await restoreCollection('examResults', backupData.examResults);
      await restoreCollection('chargeCards', backupData.chargeCards);

      res.json({ success: true, message: `تم استرجاع نسخة المنصة (${tenantId}) بنجاح!` });
    } catch (err: any) {
      console.error('Error restoring tenant backup:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Backend API - Generates SQL Schema + SQL Migration Script for MySQL / PostgreSQL
  app.all('/api/generate-tenant-sql-migration', async (req, res) => {
    try {
      const payload = req.body || req.query || {};
      const tenantId = payload.subdomain || payload.tenantId || 'standalone';
      
      const schemaSqlPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
      let schemaSql = '';
      try {
        schemaSql = await fs.readFile(schemaSqlPath, 'utf-8');
      } catch (e) {
        schemaSql = `-- Universal Schema File --\n`;
      }

      // Convert payload or backup data into SQL statements
      let dataSql = '';
      const backupData = payload.backupData || payload.tenant || payload;
      if (backupData) {
        const { convertFirebaseJsonToSql } = await import('./src/services/migrationEngine.js').catch(async () => {
          return await import('./src/services/migrationEngine.ts');
        });
        dataSql = convertFirebaseJsonToSql({
          tenantId,
          exportedAt: new Date().toISOString(),
          users: backupData.users || [],
          courses: backupData.courses || [],
          lessons: backupData.lessons || [],
          exams: backupData.exams || [],
          questions: backupData.questions || [],
          examResults: backupData.examResults || [],
          chargeCards: backupData.chargeCards || []
        });
      }

      const fullSqlScript = `${schemaSql}\n\n-- ============================================================\n-- TENANT MIGRATION DATA\n-- ============================================================\n${dataSql}`;

      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="fahmni_tenant_${tenantId}_migration.sql"`);
      res.send(fullSqlScript);
    } catch (err: any) {
      console.error('Error generating tenant SQL migration:', err);
      res.status(500).json({ error: err.message });
    }
  });

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
