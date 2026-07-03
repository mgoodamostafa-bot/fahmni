const fs = require('fs');
const path = require('path');

// Load token directly from firebase-tools.json
const firebaseToolsPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
if (!fs.existsSync(firebaseToolsPath)) {
  console.error("firebase-tools.json not found!");
  process.exit(1);
}

const firebaseTools = JSON.parse(fs.readFileSync(firebaseToolsPath, 'utf8'));
const accessToken = firebaseTools.tokens.access_token;
const projectId = 'gen-lang-client-0266961201';

async function getDocREST(dbId, collection, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/${collection}/${docId}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (res.status === 404) return null;
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function queryUsersREST(dbId, email) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'email' },
            op: 'EQUAL',
            value: { stringValue: email }
          }
        }
      }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.map(item => item.document).filter(doc => !!doc);
}

async function run() {
  console.log("Querying Firestore using REST API...\n");

  const namedDbId = 'ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0';

  console.log("--- Checking default database for 'tenants/eng' ---");
  try {
    const docDefault = await getDocREST('(default)', 'tenants', 'eng');
    if (docDefault) {
      console.log("Found in (default):", JSON.stringify(docDefault, null, 2));
    } else {
      console.log("NOT found in (default).");
    }
  } catch (err) {
    console.error("Error (default):", err.message);
  }

  console.log(`\n--- Checking named database (${namedDbId}) for 'tenants/eng' ---`);
  try {
    const docNamed = await getDocREST(namedDbId, 'tenants', 'eng');
    if (docNamed) {
      console.log(`Found in named db:`, JSON.stringify(docNamed, null, 2));
    } else {
      console.log(`NOT found in named db.`);
    }
  } catch (err) {
    console.error("Error named db:", err.message);
  }

  console.log(`\n--- Querying user 'mostafagooda3@gmail.com' in named db ---`);
  try {
    const users = await queryUsersREST(namedDbId, 'mostafagooda3@gmail.com');
    console.log(`Found ${users.length} users:`);
    users.forEach(u => console.log(JSON.stringify(u, null, 2)));
  } catch (err) {
    console.error("Error querying users:", err.message);
  }

  console.log(`\n--- Querying user 'mostafagooda36@gmail.com' in named db ---`);
  try {
    const users = await queryUsersREST(namedDbId, 'mostafagooda36@gmail.com');
    console.log(`Found ${users.length} users:`);
    users.forEach(u => console.log(JSON.stringify(u, null, 2)));
  } catch (err) {
    console.error("Error querying users:", err.message);
  }
}

run().catch(console.error);
