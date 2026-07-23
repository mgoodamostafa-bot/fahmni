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

const db = admin.firestore('ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0');

async function run() {
  console.log("Checking users collection for teachers/admins...");
  const snap = await db.collection('users').get();
  console.log(`Found ${snap.size} users total in users collection.`);
  
  snap.forEach(doc => {
    const data = doc.data();
    if (data.role === 'admin' || data.role === 'teacher') {
      console.log(`- ID: ${doc.id}, Name: ${data.displayName}, Email: ${data.email}, Role: ${data.role}`);
    }
  });
}

run().catch(console.error);
