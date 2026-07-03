import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkUser(uid: string) {
  const docRef = db.collection('users').doc(uid);
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    console.log('User found:', docSnap.data());
    // Also, if the role is not 'admin', fix it!
    if (docSnap.data()?.role !== 'admin') {
      await docRef.update({ role: 'admin' });
      console.log('Updated role to admin');
    }
  } else {
    console.log('User document DOES NOT EXIST. Creating it.');
    await docRef.set({
      uid: uid,
      email: 'admin@fahmni.com',
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    console.log('User document created.');
  }
}

checkUser('dufqUF8GN5dkfgbWGkmSdJeD0L62');
