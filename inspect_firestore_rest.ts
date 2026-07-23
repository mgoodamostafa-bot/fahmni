

async function main() {
  const url = 'https://firestore.googleapis.com/v1/projects/gen-lang-client-0266961201/databases/ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0/documents/offline_results';
  console.log('Fetching Firestore documents via REST API from url:', url);
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response JSON:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error fetching REST API:', err);
  }
}

main();
