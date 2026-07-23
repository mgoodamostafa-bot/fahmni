import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  config.firestoreDatabaseId || '(default)'
);
const auth = getAuth(app);

async function main() {
  console.log('Authenticating with Firebase Auth...');
  try {
    await signInWithEmailAndPassword(auth, 'teacher_test@fahmni.com', 'password123');
    console.log('Authenticated successfully as teacher_test!');
  } catch (e: any) {
    console.warn('Auth with teacher_test failed, trying parent_viewer...', e.message);
    try {
      await signInWithEmailAndPassword(auth, 'parent_viewer@fahmni.me', 'parent123456');
      console.log('Authenticated successfully as parent_viewer!');
    } catch (e2: any) {
      console.error('All auth attempts failed:', e2.message);
      process.exit(1);
    }
  }

  console.log('\n==== FETCHING FIRESTORE DATA ====');

  // 1. center_students
  const centerSnap = await getDocs(collection(db, 'center_students'));
  console.log(`\n📌 'center_students' collection count: ${centerSnap.size}`);
  centerSnap.docs.forEach((d, i) => {
    const data = d.data();
    console.log(`   ${i + 1}. [${d.id}] Name: "${data.displayName || data.name}" | Code: ${data.studentId || data.code} | Group: ${data.groupId || 'NO_GROUP'}`);
  });

  // 2. users
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`\n📌 'users' collection count: ${usersSnap.size}`);

  const centerInUsers: any[] = [];
  usersSnap.docs.forEach((d) => {
    const data = d.data();
    const isCenter =
      data.isCenterStudent ||
      data.userType === 'center' ||
      data.role === 'center_student' ||
      data.centerId ||
      data.groupId;

    if (isCenter) {
      centerInUsers.push({ id: d.id, ...data });
    }
  });

  console.log(`📌 Center students found in 'users' collection: ${centerInUsers.length}`);
  centerInUsers.forEach((u, i) => {
    console.log(`   ${i + 1}. [${u.id}] Name: "${u.displayName || u.name}" | Code: ${u.studentId || u.code} | Group: ${u.groupId || 'NO_GROUP'} | Role: ${u.role}`);
  });

  console.log(`\nTOTAL UNIQUE CENTER STUDENTS = center_students (${centerSnap.size}) + legacy users (${centerInUsers.length}) = ${centerSnap.size + centerInUsers.length}`);

  process.exit(0);
}

main().catch(console.error);
