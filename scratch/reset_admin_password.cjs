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

async function main() {
  const uid = 'dufqUF8GN5dkfgbWGkmSdJeD0L62';
  console.log(`Resetting password for UID: ${uid}...`);
  await admin.auth().updateUser(uid, {
    password: 'password123',
    email: 'admin@fahmni.com'
  });
  console.log('Password successfully reset to: password123');
}

main().catch(console.error);
