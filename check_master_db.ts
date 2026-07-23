import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const appMaster = initializeApp(config);
const authMaster = getAuth(appMaster);
const dbMaster = initializeFirestore(appMaster, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  try {
    await signInWithEmailAndPassword(authMaster, 'parent_viewer@fahmni.me', 'parent123456');
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      await createUserWithEmailAndPassword(authMaster, 'parent_viewer@fahmni.me', 'parent123456');
    }
  }

  console.log('--- Searching in MASTER database for student 2026002 ---');
  const q = query(collection(dbMaster, 'users'), where('studentId', '==', '2026002'));
  const snap = await getDocs(q);
  console.log('Found users size in Master DB:', snap.size);
  let studentUid = '';
  snap.forEach(d => {
    studentUid = d.id;
    console.log('User document ID:', d.id);
    console.log('User data:', JSON.stringify(d.data(), null, 2));
  });

  if (studentUid) {
    console.log('--- Querying master attendance ---');
    const attSnap = await getDocs(query(collection(dbMaster, 'attendance'), where('studentUid', '==', studentUid)));
    console.log('Attendance docs found:', attSnap.size);
    attSnap.forEach(d => console.log('Attendance:', d.id, JSON.stringify(d.data(), null, 2)));

    console.log('--- Querying master evaluations ---');
    const evalSnap = await getDocs(query(collection(dbMaster, 'evaluations'), where('studentUid', '==', studentUid)));
    console.log('Evaluations docs found:', evalSnap.size);
    evalSnap.forEach(d => console.log('Evaluation:', d.id, JSON.stringify(d.data(), null, 2)));

    console.log('--- Querying master center_payments ---');
    const paySnap = await getDocs(query(collection(dbMaster, 'center_payments'), where('studentUid', '==', studentUid)));
    console.log('Payments docs found:', paySnap.size);
    paySnap.forEach(d => console.log('Payment:', d.id, JSON.stringify(d.data(), null, 2)));
  }
}

main().catch(console.error);
