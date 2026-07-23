import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const appMaster = initializeApp(config);
const dbMaster = initializeFirestore(appMaster, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  const tenantSnap = await getDoc(doc(dbMaster, 'tenants', 'eng'));
  const tenantData = tenantSnap.data()!;
  const tenantApp = initializeApp(tenantData.firebaseConfig, 'TENANT');
  const dbTenant = initializeFirestore(tenantApp, { experimentalForceLongPolling: true }, tenantData.firebaseConfig.firestoreDatabaseId || '(default)');

  const studentUid = '2eQ2mD1QGjS1wZ6EEXpD';

  console.log('--- Querying attendance for studentUid:', studentUid, '---');
  const attQ = query(collection(dbTenant, 'attendance'), where('studentUid', '==', studentUid));
  const attSnap = await getDocs(attQ);
  console.log('Attendance docs found:', attSnap.size);
  attSnap.forEach(d => console.log('Attendance:', d.id, d.data()));

  console.log('--- Querying center_payments for studentUid:', studentUid, '---');
  const payQ = query(collection(dbTenant, 'center_payments'), where('studentUid', '==', studentUid));
  const paySnap = await getDocs(payQ);
  console.log('Payments docs found:', paySnap.size);
  paySnap.forEach(d => console.log('Payment:', d.id, d.data()));
}

main().catch(console.error);
