import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
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

  console.log('--- Printing ALL users in Master DB ---');
  const snap = await getDocs(collection(dbMaster, 'users'));
  console.log('Total users found:', snap.size);
  snap.forEach(d => {
    console.log('User document ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2));
  });
}

main().catch(console.error);
