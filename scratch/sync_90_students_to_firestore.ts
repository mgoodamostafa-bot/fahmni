import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  config.firestoreDatabaseId || '(default)'
);
const auth = getAuth(app);

const SUPABASE_URL = "https://hhkomksgecjnvgnbyzag.supabase.co/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoa29ta3NnZWNqbnZnbmJ5emFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyOTQyMDAsImV4cCI6MjA2NDg3MDIwMH0.123";

async function syncStudents() {
  console.log('Authenticating with Firebase Auth...');
  await signInWithEmailAndPassword(auth, 'teacher_test@fahmni.com', 'password123');

  console.log('Connecting to Supabase hossamalsalhy database...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: supaStudents, error } = await supabase.from('center_students').select('*');
  if (error || !supaStudents) {
    console.error('Failed to fetch from Supabase:', error);
    process.exit(1);
  }

  console.log(`Successfully fetched ${supaStudents.length} students from Supabase!`);

  console.log('Syncing all 90 students into Firestore center_students collection...');
  let batch = writeBatch(db);
  let count = 0;

  for (const s of supaStudents) {
    const docId = s.uid || s.id || `center_student_${Date.now()}_${count}`;
    const cleanStudent = {
      uid: docId,
      displayName: s.display_name || s.displayName || s.name || 'طالب سنتر',
      studentId: s.student_id || s.studentId || s.code || `2026${String(count + 1).padStart(3, '0')}`,
      studentPhone: s.student_phone || s.studentPhone || '',
      fatherPhone: s.father_phone || s.fatherPhone || '',
      motherPhone: s.mother_phone || s.motherPhone || '',
      centerId: s.center_id || s.centerId || 'hossam_center',
      groupId: s.group_id || s.groupId || 'h6nm0P5BSUp5GfPyjsJZ',
      grade: s.grade || s.level || 'الصف الأول الثانوي',
      level: s.level || s.grade || 'الصف الأول الثانوي',
      schoolName: s.school_name || s.schoolName || '',
      walletBalance: Number(s.wallet_balance || s.balance || 0),
      studentType: 'center',
      role: 'student',
      isCenterStudent: true,
      createdAt: s.created_at || new Date().toISOString(),
    };

    batch.set(doc(db, 'center_students', docId), cleanStudent, { merge: true });
    count++;

    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }

  await batch.commit();
  console.log(`✅ Successfully synced all ${count} students to Firestore 'center_students'!`);

  // Verify final count in Firestore
  const verifySnap = await getDocs(collection(db, 'center_students'));
  console.log(`🎉 Final Firestore 'center_students' count is now: ${verifySnap.size} students!`);

  process.exit(0);
}

syncStudents().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
