import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForScriptOnly1234567890",
  authDomain: "fahmni-app.firebaseapp.com",
  projectId: "fahmni-app",
  storageBucket: "fahmni-app.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:1234567890"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectCounts() {
  console.log('--- Inspecting Firestore Collections ---');
  
  const centerSnap = await getDocs(collection(db, 'center_students'));
  console.log(`center_students count in Firestore: ${centerSnap.size}`);

  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`users count in Firestore: ${usersSnap.size}`);

  let centerUsersInUsersCol = 0;
  let legacyCenterUsers = 0;

  usersSnap.docs.forEach(d => {
    const data = d.data();
    if (data.isCenterStudent || data.userType === 'center' || data.role === 'center_student' || data.centerId || data.groupId) {
      centerUsersInUsersCol++;
    }
  });

  console.log(`Center students found in 'users' collection: ${centerUsersInUsersCol}`);

  // Inspect groups & centers
  const groupsSnap = await getDocs(collection(db, 'groups'));
  console.log(`groups count: ${groupsSnap.size}`);

  const centersSnap = await getDocs(collection(db, 'centers'));
  console.log(`centers count: ${centersSnap.size}`);
}

inspectCounts().catch(console.error);
