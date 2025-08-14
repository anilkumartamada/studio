import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCKB_Gh1pxK0VkzCJP9ZC5uEejQCQvYyMk",
  authDomain: "randomly-1a187.firebaseapp.com",
  projectId: "randomly-1a187",
  storageBucket: "randomly-1a187.firebasestorage.app",
  messagingSenderId: "1001700137849",
  appId: "1:1001700137849:web:5f72bca550e35854072da8",
  measurementId: "G-95TQLCEFSF"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// It's good practice to initialize Analytics if it's in the config,
// but since it's not used elsewhere in the app yet, we'll just initialize it.
try {
  getAnalytics(app);
} catch (e) {
  console.log("Firebase Analytics not available in this environment");
}


export { app, auth, db, storage };
