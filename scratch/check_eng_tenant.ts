import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function checkEng() {
  const snap = await getDoc(doc(db, 'tenants', 'eng'));
  if (snap.exists()) {
    console.log('✅ Tenant "eng" exists in Firestore:', snap.data());
  } else {
    console.log('⚠️ Tenant "eng" not found in Firestore. Creating it now...');
    const newEngData = {
      id: 'eng',
      name: 'منصة العبقري التجريبية',
      subdomain: 'eng',
      package: 'VIP',
      isStandalone: true,
      customDomain: 'eng.fahmni.me',
      firebaseConfig: JSON.stringify(config, null, 2),
      platformMode: 'single',
      teacherName: 'مستر حسام الصالحي',
      teacherTitle: 'معلم العلوم والكيمياء',
      subject: 'علوم وكيمياء',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'tenants', 'eng'), newEngData, { merge: true });
    console.log('✅ Created tenant "eng" successfully!');
  }
  process.exit(0);
}

checkEng().catch(console.error);
