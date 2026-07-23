import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function testWrite() {
  console.log('Testing write to system_releases...');
  try {
    await setDoc(doc(db, 'system_releases', 'v2_5_0'), {
      version: 'v2.5.0',
      notes: 'تحديث جديد',
      publishedAt: new Date().toISOString()
    });
    console.log('✅ Write succeeded!');
  } catch (err: any) {
    console.error('❌ Write failed:', err.message);
  }
  process.exit(0);
}

testWrite();
