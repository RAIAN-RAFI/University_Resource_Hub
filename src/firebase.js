import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyChjheSueCVcAxmut-Z7HN8MR5pl207B_A",
  authDomain: "university-resource-hub-8ff7c.firebaseapp.com",
  projectId: "university-resource-hub-8ff7c",
  storageBucket: "university-resource-hub-8ff7c.firebasestorage.app",
  messagingSenderId: "911106966068",
  appId: "1:911106966068:web:5cd6b088138cdedc5a8061"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);