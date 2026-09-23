import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const storage = getStorage(app);

// Conditionally initialize Firestore based on environment
let firestoreDb;
if (typeof window !== 'undefined') {
  // Check if running inside an iframe (like AI Studio preview)
  const isIframe = window.self !== window.top;
  
  if (isIframe) {
    // Disable persistent storage in iframe to prevent storage access errors,
    // and force long polling to bypass iframe/proxy WebChannel streaming timeouts.
    firestoreDb = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
  } else {
    // Enable persistent offline cache when accessed directly (e.g. GitHub Pages / Vercel)
    // and use long polling for reliable connectivity behind reverse proxies/firewalls.
    firestoreDb = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
  }
} else {
  // Server-side / Node.js fallback
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = firestoreDb;

// Test Connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration.");
    }
  }
}
testConnection();
