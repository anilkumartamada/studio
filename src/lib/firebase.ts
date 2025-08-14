import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCwmfN3Svs22X3Cwqs3P6hlPP0jdAhAeqY",
  authDomain: "connectile-ejotw.firebaseapp.com",
  projectId: "connectile-ejotw",
  storageBucket: "connectile-ejotw.firebasestorage.app",
  messagingSenderId: "1092615489720",
  appId: "1:1092615489720:web:5d12f717f8d17c73920c4d"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// It's good practice to initialize Analytics if it's in the config,
// but since it's not used elsewhere in the app yet, we'll just initialize it.
try {
  if (firebaseConfig.measurementId) {
    getAnalytics(app);
  }
} catch (e) {
  console.log("Firebase Analytics not available in this environment");
}


export { app, auth, db, storage };
