import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXxi238bF5MBjEu815ENbm_xl2EoVUNMA",
  authDomain: "maximal-bongo-fr4g1.firebaseapp.com",
  projectId: "maximal-bongo-fr4g1",
  storageBucket: "maximal-bongo-fr4g1.firebasestorage.app",
  messagingSenderId: "379365157698",
  appId: "1:379365157698:web:692a284e312109505036db"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
// Initialize Firestore with custom databaseId
const db = getFirestore(app, "ai-studio-be705015-fdc9-4d91-920e-b46336def2ed");

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("client is offline")) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}
testConnection();

export { app, db };
