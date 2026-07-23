import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function testAuthWrite() {
  try {
    console.log('Signing in anonymously...');
    const userCred = await signInAnonymously(auth);
    console.log('✅ Signed in as UID:', userCred.user.uid);

    console.log('Testing setDoc to system_releases...');
    await setDoc(doc(db, 'system_releases', 'v2_5_0'), {
      version: 'v2.5.0',
      notes: 'تحديث جديد',
      publishedAt: new Date().toISOString()
    });
    console.log('🎉 SUCCESS writing to system_releases after signInAnonymously!');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
}

testAuthWrite();
