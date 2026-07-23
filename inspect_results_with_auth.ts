import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, 'ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0');

async function main() {
  console.log('Signing in...');
  await signInWithEmailAndPassword(auth, 'parent_viewer@fahmni.me', 'parent123456');
  console.log('Authenticated successfully!');

  console.log('Querying offline_results...');
  const snap = await getDocs(collection(db, 'offline_results'));
  console.log('Total results size:', snap.size);
  snap.docs.forEach(d => {
    console.log('Result Doc ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2));
  });
}

main().catch(console.error);
