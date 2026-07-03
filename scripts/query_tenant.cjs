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

async function run() {
  const namedDbId = 'ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0';
  const docNamed = await getDocREST(namedDbId, 'tenants', 'eng');
  if (docNamed && docNamed.fields) {
    console.log("Tenant keys:", Object.keys(docNamed.fields));
    if (docNamed.fields.firebaseConfig) {
      console.log("firebaseConfig raw value:", JSON.stringify(docNamed.fields.firebaseConfig, null, 2));
    } else {
      console.log("firebaseConfig field is MISSING in tenants/eng!");
    }
  } else {
    console.log("tenants/eng document not found!");
  }
}

run().catch(console.error);
