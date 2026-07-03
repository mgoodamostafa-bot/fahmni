import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import config from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(config);
const auth = getAuth(app);

async function test() {
  try {
    console.log('Attempting to login...');
    const cred = await signInWithEmailAndPassword(auth, 'mostafagooda3@gmail.com', '123456');
    console.log('Login success:', cred.user.uid);
  } catch (err: any) {
    console.error('Login failed:', err.code, err.message);
    try {
      console.log('Attempting to register instead...');
      const cred = await createUserWithEmailAndPassword(auth, 'test-dummy' + Date.now() + '@example.com', '123456');
      console.log('Register success:', cred.user.uid);
    } catch (err2: any) {
      console.error('Register failed:', err2.code, err2.message);
    }
  }
  process.exit(0);
}
test();
