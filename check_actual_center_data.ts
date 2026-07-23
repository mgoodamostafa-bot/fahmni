import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const appMaster = initializeApp(config);
const dbMaster = initializeFirestore(appMaster, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  const tenantSnap = await getDoc(doc(dbMaster, 'tenants', 'eng'));
  const tenantData = tenantSnap.data()!;
  const tenantApp = initializeApp(tenantData.firebaseConfig, 'TENANT');
  const dbTenant = initializeFirestore(tenantApp, { experimentalForceLongPolling: true }, tenantData.firebaseConfig.firestoreDatabaseId || '(default)');

  console.log('--- Printing ALL attendance docs ---');
  const att = await getDocs(collection(dbTenant, 'attendance'));
  console.log('Total attendance size:', att.size);
  att.forEach(d => console.log('Doc ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2)));

  console.log('--- Printing ALL evaluations docs ---');
  const evals = await getDocs(collection(dbTenant, 'evaluations'));
  console.log('Total evaluations size:', evals.size);
  evals.forEach(d => console.log('Doc ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2)));

  console.log('--- Printing ALL center_payments docs ---');
  const pays = await getDocs(collection(dbTenant, 'center_payments'));
  console.log('Total center_payments size:', pays.size);
  pays.forEach(d => console.log('Doc ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2)));

  console.log('--- Printing ALL offline_results docs ---');
  const off = await getDocs(collection(dbTenant, 'offline_results'));
  console.log('Total offline_results size:', off.size);
  off.forEach(d => console.log('Doc ID:', d.id, 'Data:', JSON.stringify(d.data(), null, 2)));
}

main().catch(console.error);
