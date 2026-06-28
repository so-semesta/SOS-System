import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  const students = await getDocs(collection(db, 'students'));
  console.log('Students:', students.size);
  students.forEach(s => console.log(s.id, s.data()));

  const comps = await getDocs(collection(db, 'competitions'));
  console.log('Competitions:', comps.size);

  const regs = await getDocs(collection(db, 'registrations'));
  console.log('Registrations:', regs.size);
  regs.forEach(r => console.log(r.id, r.data()));
  
  process.exit(0);
}
test();

