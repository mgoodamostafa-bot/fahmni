
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');
const auth = getAuth(app);

async function main() {
  await signInWithEmailAndPassword(auth, 'teacher_test@fahmni.com', 'password123');
  
  console.log('Fetching student details from Supabase REST API...');
  const res = await fetch("https://hhkomksgecjnvgnbyzag.supabase.co/rest/v1/center_students?student_id=eq.2026013", {
    headers: {
      "apikey": "sb_publishable_gcaH8rZIHULvg69_FHq4Cw_BnGZnBZ0",
      "Authorization": "Bearer sb_publishable_gcaH8rZIHULvg69_FHq4Cw_BnGZnBZ0"
    }
  });
  const data: any = await res.json();
  if (!data || data.length === 0) throw new Error('Student not found in Supabase');
  const student = data[0];
  const studentUid = student.uid;
  const studentName = student.display_name;
  
  const todayStr = new Date().toISOString().split('T')[0];

  // Attendance
  await setDoc(doc(db, 'attendance', 'att_' + studentUid + '_' + todayStr), {
    studentUid,
    studentName,
    studentId: '2026013',
    centerId: student.center_id,
    groupId: student.group_id,
    date: todayStr,
    status: 'present',
    timestamp: serverTimestamp()
  });

  // Evaluation
  await setDoc(doc(db, 'evaluations', 'eval_' + studentUid + '_' + todayStr), {
    studentUid,
    studentName,
    studentId: '2026013',
    centerId: student.center_id,
    groupId: student.group_id,
    date: todayStr,
    quizGrade: 9,
    quizTotal: 10,
    homeworkStatus: 'completed',
    behaviorRating: 5,
    teacherRemarks: 'طالب ممتاز ومتفوق جداً وأداء رائع اليوم',
    createdAt: serverTimestamp()
  });

  // Payment
  await setDoc(doc(db, 'center_payments', 'pay_' + studentUid + '_' + Date.now()), {
    studentUid,
    studentName,
    studentId: '2026013',
    amount: 150,
    type: 'subscription',
    title: 'اشتراك شهر يوليو 2026',
    status: 'paid',
    date: todayStr,
    remarks: 'دفع نقدي بالسنتر',
    timestamp: serverTimestamp()
  });
  console.log('Successfully wrote test data via Node.js context');
  process.exit(0);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
      