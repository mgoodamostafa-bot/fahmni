import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const apiKey = config.apiKey;

async function main() {
  console.log('Signing in via Auth REST API...');
  const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const authRes = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'parent_viewer@fahmni.me',
      password: 'parent123456',
      returnSecureToken: true
    })
  });

  const authJson: any = await authRes.json();
  if (!authRes.ok) {
    console.error('Auth failed:', authJson);
    return;
  }

  const idToken = authJson.idToken;
  console.log('Authenticated successfully! ID Token obtained.');

  const dbUrl = 'https://firestore.googleapis.com/v1/projects/gen-lang-client-0266961201/databases/ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0/documents/offline_results';
  console.log('Fetching Firestore documents via REST API with Auth...');
  const dbRes = await fetch(dbUrl, {
    headers: {
      'Authorization': `Bearer ${idToken}`
    }
  });

  const dbJson = await dbRes.json();
  console.log('Response Status:', dbRes.status);
  console.log('Response JSON:', JSON.stringify(dbJson, null, 2));
}

main().catch(console.error);
