import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
   apiKey: "AIzaSyBWdmdx7i0bGha8AL6NqxEp890KIg4CoYw",
  authDomain: "tddetailed-dtatabase.firebaseapp.com",
  projectId: "tddetailed-dtatabase",
  storageBucket: "tddetailed-dtatabase.firebasestorage.app",
  messagingSenderId: "1068419663214",
  appId: "1:1068419663214:web:e389f98fe97ffecadf6d7f",
  measurementId: "G-PZWH4JKBF9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);