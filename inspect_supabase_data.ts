import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc } from 'firebase/firestore';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const appMaster = initializeApp(config);
const dbMaster = initializeFirestore(appMaster, { experimentalForceLongPolling: true }, config.firestoreDatabaseId || '(default)');

async function main() {
  console.log('Fetching tenant eng config...');
  const tenantSnap = await getDoc(doc(dbMaster, 'tenants', 'eng'));
  const tenantData = tenantSnap.data();
  if (!tenantData) {
    console.error('Tenant eng not found!');
    return;
  }

  const url = tenantData.supabaseUrl;
  const anonKey = tenantData.supabaseAnonKey;
  console.log('Supabase URL:', url);
  console.log('Supabase Anon Key:', anonKey);

  if (!url || !anonKey) {
    console.error('Supabase not configured for eng!');
    return;
  }

  const supabase = createClient(url, anonKey);
  console.log('Connecting to Supabase...');

  console.log('Querying student 2026002...');
  const { data: student, error: sErr } = await supabase
    .from('center_students')
    .select('*')
    .eq('student_id', '2026002')
    .limit(1);

  if (sErr) {
    console.error('Error querying student:', sErr);
    return;
  }

  console.log('Student details from Supabase:', JSON.stringify(student, null, 2));

  if (student && student.length > 0) {
    const studentUid = student[0].uid;
    console.log('Querying offline_results for studentUid:', studentUid);
    const { data: results, error: rErr } = await supabase
      .from('offline_results')
      .select('*')
      .eq('student_uid', studentUid);

    if (rErr) {
      console.error('Error querying offline_results:', rErr);
    } else {
      console.log('Results size:', results ? results.length : 0);
      console.log('Results data:', JSON.stringify(results, null, 2));
    }
  } else {
    console.log('Student not found in Supabase!');
  }
}

main().catch(console.error);
