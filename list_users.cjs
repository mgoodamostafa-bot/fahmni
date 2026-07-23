const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const jsonConfig = require('./firebase-applet-config.json');

(async () => {
  const app = initializeApp(jsonConfig);
  const db = getFirestore(app);
  
  console.log('Querying users...');
  const snap = await getDocs(collection(db, 'users'));
  console.log(`Found ${snap.size} users:`);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`- ID: ${d.id}, Name: ${data.displayName}, Role: ${data.role}, studentId: ${data.studentId}, studentType: ${data.studentType}`);
  });
})();
