const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT is not set!");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("Checking tenants collection...");
  const tenantsSnap = await db.collection('tenants').get();
  console.log(`Found ${tenantsSnap.size} tenants.`);
  tenantsSnap.forEach(doc => {
    console.log(`Tenant ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

run().catch(console.error);
