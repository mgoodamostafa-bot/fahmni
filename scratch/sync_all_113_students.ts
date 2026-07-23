import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
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

async function syncAll113() {
  console.log('Authenticating with Firebase Auth...');
  await signInWithEmailAndPassword(auth, 'teacher_test@fahmni.com', 'password123');

  // Get tenant key
  const tSnap = await getDoc(doc(db, 'tenants', 'hossamalsalhy'));
  let supaUrl = 'https://hhkomksgecjnvgnbyzag.supabase.co/';
  let supaKey = '';
  if (tSnap.exists()) {
    const tData = tSnap.data();
    supaUrl = tData.supabaseUrl || supaUrl;
    supaKey = tData.supabaseAnonKey || '';
  }

  const supabase = createClient(supaUrl, supaKey);

  const allFoundMap = new Map<string, any>();

  const addStudent = (id: string, name: string, data: any) => {
    const cleanName = (name || '').trim();
    if (!cleanName || cleanName.length < 2) return;

    // Use name as canonical key to deduplicate
    const key = cleanName.toLowerCase();
    
    if (!allFoundMap.has(key)) {
      const uid = id || data.uid || data.id || `center_student_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const code = data.studentId || data.student_id || data.studentCode || data.code || '';

      allFoundMap.set(key, {
        uid,
        displayName: cleanName,
        studentId: code,
        studentPhone: data.studentPhone || data.student_phone || '',
        fatherPhone: data.fatherPhone || data.father_phone || '',
        motherPhone: data.motherPhone || data.mother_phone || '',
        centerId: data.centerId || data.center_id || 'hossam_center',
        groupId: data.groupId || data.group_id || 'h6nm0P5BSUp5GfPyjsJZ',
        grade: data.grade || data.level || 'الصف الأول الثانوي',
        level: data.level || data.grade || 'الصف الأول الثانوي',
        schoolName: data.schoolName || data.school_name || '',
        walletBalance: Number(data.walletBalance || data.wallet_balance || data.balance || 0),
        studentType: 'center',
        role: 'student',
        isCenterStudent: true,
        createdAt: data.createdAt || data.created_at || new Date().toISOString(),
      });
    } else {
      // Merge extra missing fields into existing
      const existing = allFoundMap.get(key);
      if (!existing.studentId && (data.studentId || data.student_id || data.code)) {
        existing.studentId = data.studentId || data.student_id || data.code;
      }
      if (!existing.studentPhone && (data.studentPhone || data.student_phone)) {
        existing.studentPhone = data.studentPhone || data.student_phone;
      }
      if (!existing.fatherPhone && (data.fatherPhone || data.father_phone)) {
        existing.fatherPhone = data.fatherPhone || data.father_phone;
      }
    }
  };

  // 1. Fetch Supabase center_students
  const { data: supaStudents } = await supabase.from('center_students').select('*');
  if (supaStudents) {
    supaStudents.forEach((s) => {
      addStudent(s.uid || s.id, s.display_name || s.name || s.displayName, s);
    });
  }

  // 2. Fetch Firestore center_students
  const centerSnap = await getDocs(collection(db, 'center_students'));
  centerSnap.docs.forEach((d) => {
    const data = d.data();
    addStudent(d.id, data.displayName || data.name, data);
  });

  // 3. Fetch Firestore users
  const usersSnap = await getDocs(collection(db, 'users'));
  usersSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.role === 'student' || data.isCenterStudent || data.userType === 'center') {
      addStudent(d.id, data.displayName || data.name, data);
    }
  });

  // 4. Fetch evaluations
  const evalSnap = await getDocs(collection(db, 'evaluations'));
  evalSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.studentName) {
      addStudent(data.studentUid, data.studentName, data);
    }
  });

  // 5. Fetch offline_results
  const offSnap = await getDocs(collection(db, 'offline_results'));
  offSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.studentName) {
      addStudent(data.studentId, data.studentName, data);
    }
  });

  const uniqueStudents = Array.from(allFoundMap.values());
  console.log(`🔥 Total Consolidated Unique Students: ${uniqueStudents.length}`);

  // Assign clean sequential code for any student without a code
  let autoCodeIndex = 1;
  uniqueStudents.forEach((st) => {
    if (!st.studentId || st.studentId === 'undefined' || st.studentId === 'null') {
      st.studentId = `2026${String(autoCodeIndex).padStart(3, '0')}`;
    }
    autoCodeIndex++;
  });

  console.log(`Writing all ${uniqueStudents.length} students into Firestore 'center_students'...`);
  let batch = writeBatch(db);
  let batchCounter = 0;

  for (const st of uniqueStudents) {
    batch.set(doc(db, 'center_students', st.uid), st, { merge: true });
    batchCounter++;

    if (batchCounter % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  await batch.commit();
  console.log(`✅ Firestore sync complete!`);

  console.log(`Writing all ${uniqueStudents.length} students into Supabase 'center_students'...`);
  const sqlRows = uniqueStudents.map((st) => ({
    uid: st.uid,
    display_name: st.displayName,
    student_id: st.studentId,
    student_phone: st.studentPhone || '',
    father_phone: st.fatherPhone || '',
    mother_phone: st.motherPhone || '',
    center_id: st.centerId || 'hossam_center',
    group_id: st.groupId || 'h6nm0P5BSUp5GfPyjsJZ',
    grade: st.grade || 'الصف الأول الثانوي',
    level: st.level || 'الصف الأول الثانوي',
    school_name: st.schoolName || '',
    wallet_balance: st.walletBalance || 0,
    student_type: 'center',
    role: 'student',
    created_at: typeof st.createdAt === 'string'
      ? st.createdAt
      : st.createdAt?.seconds
      ? new Date(st.createdAt.seconds * 1000).toISOString()
      : new Date().toISOString(),
  }));

  const { error: supaErr } = await supabase.from('center_students').upsert(sqlRows);
  if (supaErr) {
    console.error('Supabase upsert error:', supaErr.message);
  } else {
    console.log(`✅ Supabase sync complete! All ${uniqueStudents.length} students upserted!`);
  }

  process.exit(0);
}

syncAll113().catch((err) => {
  console.error(err);
  process.exit(1);
});
