import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  config.firestoreDatabaseId || '(default)'
);

async function checkBreakdown() {
  console.log('==== FIRESTORE INSPECTION ====');

  // 1. center_students
  const centerSnap = await getDocs(collection(db, 'center_students'));
  console.log(`Firestore 'center_students' docs count: ${centerSnap.size}`);

  // 2. users
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Firestore 'users' docs count: ${usersSnap.size}`);

  let centerInUsers = 0;
  let legacyCenterUsersList: any[] = [];

  usersSnap.docs.forEach((d) => {
    const data = d.data();
    const isCenter =
      data.isCenterStudent ||
      data.userType === 'center' ||
      data.role === 'center_student' ||
      data.centerId ||
      data.groupId;

    if (isCenter) {
      centerInUsers++;
      legacyCenterUsersList.push({ id: d.id, name: data.displayName || data.name, ...data });
    }
  });

  console.log(`Firestore 'users' with center flags: ${centerInUsers}`);

  // Check Supabase if configured in tenant / env
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lkhmlgwryevndkbbusqj.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (supabaseUrl && supabaseKey) {
    console.log('==== SUPABASE INSPECTION ====');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: supaCenter, error: err1 } = await supabase.from('center_students').select('*');
    if (supaCenter) {
      console.log(`Supabase 'center_students' count: ${supaCenter.length}`);
    } else {
      console.log(`Supabase 'center_students' error:`, err1?.message);
    }

    const { data: supaUsers, error: err2 } = await supabase.from('users').select('*');
    if (supaUsers) {
      console.log(`Supabase 'users' count: ${supaUsers.length}`);
      const supaCenterInUsers = supaUsers.filter(
        (u: any) => u.is_center_student || u.user_type === 'center' || u.role === 'center_student' || u.center_id || u.group_id
      );
      console.log(`Supabase 'users' with center flags: ${supaCenterInUsers.length}`);
    }
  }

  process.exit(0);
}

checkBreakdown().catch((e) => {
  console.error(e);
  process.exit(1);
});
