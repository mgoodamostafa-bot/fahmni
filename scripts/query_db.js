const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Load refresh token from firebase-tools.json
const firebaseToolsPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
if (!fs.existsSync(firebaseToolsPath)) {
  console.error("firebase-tools.json not found!");
  process.exit(1);
}

const firebaseTools = JSON.parse(fs.readFileSync(firebaseToolsPath, 'utf8'));
const refreshToken = firebaseTools.tokens.refresh_token;

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  return data.access_token;
}

async function run() {
  console.log("Fetching access token...");
  const accessToken = await getAccessToken();

  console.log("Initializing firebase-admin...");
  admin.initializeApp({
    credential: admin.credential.accessToken(accessToken),
    projectId: 'gen-lang-client-0266961201'
  });

  const namedDbId = 'ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0';
  const defaultDb = admin.firestore(); // default
  const namedDb = admin.firestore(admin.app(), namedDbId);

  console.log("\n--- Checking default database ---");
  try {
    const tenantDefault = await defaultDb.collection('tenants').doc('eng').get();
    if (tenantDefault.exists) {
      console.log("Found 'eng' in (default) db:", tenantDefault.data());
    } else {
      console.log("'eng' NOT found in (default) db.");
    }
  } catch (err) {
    console.error("Error querying (default) db:", err.message);
  }

  console.log(`\n--- Checking named database (${namedDbId}) ---`);
  try {
    const tenantNamed = await namedDb.collection('tenants').doc('eng').get();
    if (tenantNamed.exists) {
      console.log(`Found 'eng' in named db:`, tenantNamed.data());
    } else {
      console.log(`'eng' NOT found in named db.`);
    }
  } catch (err) {
    console.error("Error querying named db:", err.message);
  }

  console.log("\n--- Checking user email 'mostafagooda3@gmail.com' & 'mostafagooda36@gmail.com' in named database ---");
  try {
    const usersRef = namedDb.collection('users');
    const q1 = await usersRef.where('email', '==', 'mostafagooda3@gmail.com').get();
    console.log(`mostafagooda3@gmail.com: found ${q1.size} records`);
    q1.forEach(d => console.log(d.id, d.data()));

    const q2 = await usersRef.where('email', '==', 'mostafagooda36@gmail.com').get();
    console.log(`mostafagooda36@gmail.com: found ${q2.size} records`);
    q2.forEach(d => console.log(d.id, d.data()));
  } catch (err) {
    console.error("Error querying users in named db:", err.message);
  }
}

run().catch(console.error);
