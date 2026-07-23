import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  config.firestoreDatabaseId || '(default)'
);
const auth = getAuth(app);

async function main() {
  await signInWithEmailAndPassword(auth, 'teacher_test@fahmni.com', 'password123');

  console.log('\n==== SEARCHING ALL TENANTS ====');
  const tenantsSnap = await getDocs(collection(db, 'tenants'));
  console.log(`Found ${tenantsSnap.size} tenants in Firestore:`);
  
  for (const tDoc of tenantsSnap.docs) {
    const tData = tDoc.data();
    console.log(`- Tenant ID: "${tDoc.id}", Name: "${tData.name}", Domain: "${tData.customDomain || tData.subdomain}", SupabaseUrl: "${tData.supabaseUrl}"`);
    
    // Check Supabase if configured for this tenant
    if (tData.supabaseUrl && tData.supabaseAnonKey) {
      try {
        const supa = createClient(tData.supabaseUrl, tData.supabaseAnonKey);
        const { data: supaStudents, error: err1 } = await supa.from('center_students').select('*');
        console.log(`   └─ Supabase center_students count: ${supaStudents ? supaStudents.length : 0} (Error: ${err1?.message || 'None'})`);
        
        const { data: supaUsers, error: err2 } = await supa.from('users').select('*');
        console.log(`   └─ Supabase users count: ${supaUsers ? supaUsers.length : 0} (Error: ${err2?.message || 'None'})`);
      } catch (e: any) {
        console.log(`   └─ Supabase error: ${e.message}`);
      }
    }
  }

  // Check default Supabase env if any
  const envUrl = process.env.VITE_SUPABASE_URL || 'https://lkhmlgwryevndkbbusqj.supabase.co';
  const envKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxraG1sZ3dyeWV2bmRrYmJ1c3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyOTQyMDAsImV4cCI6MjA2NDg3MDIwMH0.123';
  
  if (envUrl && envKey) {
    console.log('\n==== ENV SUPABASE INSPECTION ====');
    try {
      const supa = createClient(envUrl, envKey);
      const { data: s1 } = await supa.from('center_students').select('*');
      console.log(`ENV Supabase center_students count: ${s1 ? s1.length : 'error/empty'}`);

      const { data: s2 } = await supa.from('users').select('*');
      console.log(`ENV Supabase users count: ${s2 ? s2.length : 'error/empty'}`);
    } catch (e: any) {
      console.log('ENV Supabase err:', e.message);
    }
  }

  process.exit(0);
}

main().catch(console.error);
