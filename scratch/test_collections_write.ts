import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function testWriteCollections() {
  const collectionsToTest = [
    { coll: 'super_admin', docId: 'config' },
    { coll: 'siteSettings', docId: 'system_releases' },
    { coll: 'settings', docId: 'system_releases' },
    { coll: 'platform_config', docId: 'system_releases' },
    { coll: 'tenants', docId: 'test_tenant' },
    { coll: 'system_releases', docId: 'latest' },
  ];

  for (const item of collectionsToTest) {
    try {
      await setDoc(doc(db, item.coll, item.docId), { test: true, updatedAt: new Date().toISOString() }, { merge: true });
      console.log(`✅ SUCCESS writing to collection: "${item.coll}" (doc: ${item.docId})`);
    } catch (err: any) {
      console.log(`❌ FAILED writing to collection: "${item.coll}" - Error: ${err.message}`);
    }
  }
  process.exit(0);
}

testWriteCollections();
