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

  console.log('--- Printing ALL attendance in Master DB ---');
  const att = await getDocs(collection(dbMaster, 'attendance'));
  console.log('Total attendance size:', att.size);
  att.forEach(d => console.log('Attendance Doc ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2)));

  console.log('--- Printing ALL evaluations in Master DB ---');
  const evals = await getDocs(collection(dbMaster, 'evaluations'));
  console.log('Total evaluations size:', evals.size);
  evals.forEach(d => console.log('Evaluation Doc ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2)));

  console.log('--- Printing ALL center_payments in Master DB ---');
  const pays = await getDocs(collection(dbMaster, 'center_payments'));
  console.log('Total center_payments size:', pays.size);
  pays.forEach(d => console.log('Payment Doc ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2)));
}

main().catch(console.error);
