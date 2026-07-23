import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, setDoc, addDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');
const auth = getAuth(app);

async function main() {
  console.log('Logging in as teacher...');
  const userCredential = await signInWithEmailAndPassword(auth, 'teacher_test@fahmni.com', 'password123');
  console.log('Logged in successfully. User UID:', userCredential.user.uid);

  // 1. Check/Create Center
  console.log('Checking centers...');
  const centersSnap = await getDocs(collection(db, 'centers'));
  let centerId = '';
  if (centersSnap.empty) {
    console.log('No centers found. Creating a test center...');
    const newCenterRef = await addDoc(collection(db, 'centers'), {
      name: 'سنتر التميز التجريبي',
      address: 'القاهرة - مدينة نصر',
      phone: '01012345678',
      createdAt: new Date().toISOString()
    });
    centerId = newCenterRef.id;
    console.log('Created center with ID:', centerId);
  } else {
    centerId = centersSnap.docs[0].id;
    console.log('Using existing center ID:', centerId, 'Name:', centersSnap.docs[0].data().name);
  }

  // 2. Check/Create Group
  console.log('Checking groups...');
  const groupsSnap = await getDocs(collection(db, 'groups'));
  let groupId = '';
  if (groupsSnap.empty) {
    console.log('No groups found. Creating a test group...');
    const newGroupRef = await addDoc(collection(db, 'groups'), {
      name: 'مجموعة الأحد والخميس',
      centerId: centerId,
      day: 'الأحد',
      time: '04:00 م',
      grade: 'sec1', // 1st secondary
      createdAt: new Date().toISOString()
    });
    groupId = newGroupRef.id;
    console.log('Created group with ID:', groupId);
  } else {
    groupId = groupsSnap.docs[0].id;
    console.log('Using existing group ID:', groupId, 'Name:', groupsSnap.docs[0].data().name);
  }

  console.log('Setup finished successfully!');
}

main().catch(console.error);
