import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  const email = 'teacher_test@fahmni.com';
  const password = 'password123';
  console.log(`Creating teacher account: ${email}...`);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`User created in auth with UID: ${cred.user.uid}`);
    
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: email,
      displayName: 'المعلم التجريبي',
      role: 'teacher',
      createdAt: new Date().toISOString()
    });
    console.log('User document written successfully to users collection.');
  } catch (err: any) {
    console.error('Failed to create teacher:', err.message || err);
  }
}

main().catch(console.error);
