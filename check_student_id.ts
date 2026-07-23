import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const appMaster = initializeApp(config);
const dbMaster = getFirestore(appMaster);

async function main() {
  const tenantSnap = await getDoc(doc(dbMaster, 'tenants', 'eng'));
  const tenantData = tenantSnap.data()!;
  const tenantApp = initializeApp(tenantData.firebaseConfig, 'TENANT');
  const dbTenant = getFirestore(tenantApp, tenantData.firebaseConfig.firestoreDatabaseId || '(default)');

  console.log('--- Searching for student by code 2026001 ---');
  const q = query(collection(dbTenant, 'users'), where('studentId', '==', '2026001'));
  const snap = await getDocs(q);
  console.log('Found users size:', snap.size);
  snap.forEach(d => {
    console.log('User document ID:', d.id);
    console.log('User data:', JSON.stringify(d.data(), null, 2));
  });
}

main().catch(console.error);
