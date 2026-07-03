const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCzB8TBR9dWrxlZKDjPFnWkiOiaW9H0j-w",
  authDomain: "gen-lang-client-0266961201.firebaseapp.com",
  projectId: "gen-lang-client-0266961201",
  storageBucket: "gen-lang-client-0266961201.firebasestorage.app",
  messagingSenderId: "880587627994",
  appId: "1:880587627994:web:d822a25982d64733bff4e3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0");

async function run() {
  console.log("Reading tenants...");
  const tenantsCol = collection(db, 'tenants');
  const snap = await getDocs(tenantsCol);
  console.log(`Found ${snap.size} tenants.`);
  snap.forEach(doc => {
    console.log(`Tenant ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

run().catch(console.error);
