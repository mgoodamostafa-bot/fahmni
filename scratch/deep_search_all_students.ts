import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

async function deepSearch() {
  console.log('Authenticating with Firebase...');
  await signInWithEmailAndPassword(auth, 'teacher_test@fahmni.com', 'password123');

  // Get tenant key
  const tSnap = await getDoc(doc(db, 'tenants', 'hossamalsalhy'));
  let supaUrl = 'https://hhkomksgecjnvgnbyzag.supabase.co/';
  let supaKey = '';
  if (tSnap.exists()) {
    const tData = tSnap.data();
    supaUrl = tData.supabaseUrl || supaUrl;
    supaKey = tData.supabaseAnonKey || '';
    console.log(`Found tenant hossamalsalhy: SupabaseUrl=${supaUrl}, KeyLength=${supaKey.length}`);
  }

  const allFoundStudents = new Map<string, any>();

  const addStudent = (id: string, name: string, data: any, source: string) => {
    if (!id && !name) return;
    const key = (id || name).trim().toLowerCase();
    if (!allFoundStudents.has(key)) {
      allFoundStudents.set(key, { id, name, ...data, sources: [source] });
    } else {
      const existing = allFoundStudents.get(key);
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      allFoundStudents.set(key, { ...data, ...existing });
    }
  };

  // 1. Supabase hossamalsalhy center_students
  if (supaUrl && supaKey) {
    try {
      const supa = createClient(supaUrl, supaKey);
      const { data: supaStudents, error } = await supa.from('center_students').select('*');
      if (supaStudents) {
        console.log(`1. Supabase center_students count: ${supaStudents.length}`);
        supaStudents.forEach((s) => {
          addStudent(s.uid || s.id, s.display_name || s.name || s.displayName, s, 'Supabase center_students');
        });
      } else {
        console.warn('Supabase error:', error?.message);
      }
    } catch (e: any) {
      console.warn('Supabase catch error:', e.message);
    }
  }

  // 2. Firestore center_students
  try {
    const centerSnap = await getDocs(collection(db, 'center_students'));
    console.log(`2. Firestore center_students count: ${centerSnap.size}`);
    centerSnap.docs.forEach((d) => {
      const data = d.data();
      addStudent(d.id, data.displayName || data.name, data, 'Firestore center_students');
    });
  } catch (e: any) {
    console.warn('Firestore center_students error:', e.message);
  }

  // 3. Firestore users
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`3. Firestore users count: ${usersSnap.size}`);
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      const isCenter =
        data.isCenterStudent ||
        data.userType === 'center' ||
        data.role === 'center_student' ||
        data.centerId ||
        data.groupId ||
        data.studentType === 'center';

      if (isCenter || data.role === 'student') {
        addStudent(d.id, data.displayName || data.name, data, `Firestore users (${data.role || 'user'})`);
      }
    });
  } catch (e: any) {
    console.warn('Firestore users error:', e.message);
  }

  // 4. Firestore evaluations
  try {
    const evalSnap = await getDocs(collection(db, 'evaluations'));
    console.log(`4. Firestore evaluations count: ${evalSnap.size}`);
    evalSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.studentUid || data.studentName) {
        addStudent(data.studentUid, data.studentName, {
          uid: data.studentUid,
          displayName: data.studentName,
          centerId: data.centerId,
          groupId: data.groupId,
        }, 'Firestore evaluations');
      }
    });
  } catch (e: any) {
    console.warn('Firestore evaluations error:', e.message);
  }

  // 5. Firestore offline_results
  try {
    const offSnap = await getDocs(collection(db, 'offline_results'));
    console.log(`5. Firestore offline_results count: ${offSnap.size}`);
    offSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.studentId || data.studentName) {
        addStudent(data.studentId, data.studentName, {
          uid: data.studentId,
          displayName: data.studentName,
          studentId: data.studentCode,
          centerId: data.centerId,
          groupId: data.groupId,
        }, 'Firestore offline_results');
      }
    });
  } catch (e: any) {
    console.warn('Firestore offline_results error:', e.message);
  }

  console.log(`\n======================================================`);
  console.log(`🔥 TOTAL GRAND UNIQUE STUDENTS FOUND ACROSS ALL SOURCES: ${allFoundStudents.size}`);
  console.log(`======================================================\n`);

  let count = 0;
  allFoundStudents.forEach((st) => {
    count++;
    console.log(`${count}. Name: "${st.displayName || st.display_name || st.name}" | Code: ${st.studentId || st.student_id || st.code || 'None'} | Sources: [${st.sources.join(', ')}]`);
  });

  process.exit(0);
}

deepSearch().catch((err) => {
  console.error(err);
  process.exit(1);
});
