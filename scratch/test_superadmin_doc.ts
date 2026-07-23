import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function testAuthUsers() {
  // Test writing with auth if available or checking existing rules
  try {
    await setDoc(doc(db, 'super_admin', 'releases'), {
      latestVersion: 'v2.5.0',
      notes: 'تحديث شامل لنظام الحضور الذكي بالـ QR، زيادة سرعة الماسح، وإصلاح إحصائيات المجموعات وربط الدومينات الخاصة.',
      zipUrl: 'https://releases.fahmni.me/v2.5.0.zip',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log('✅ SUCCESS writing to super_admin/releases!');
  } catch (err: any) {
    console.error('❌ Failed writing to super_admin/releases:', err.message);
  }

  try {
    const docSnap = await getDoc(doc(db, 'super_admin', 'landing_page'));
    console.log('Read super_admin/landing_page:', docSnap.exists() ? 'EXISTS' : 'NOT FOUND');
  } catch (err: any) {
    console.error('❌ Read failed:', err.message);
  }

  process.exit(0);
}

testAuthUsers();
