// === Firebase Configuration ===
// To set up:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (free, no Google Analytics needed)
// 3. Click "Realtime Database" in the left menu → Create Database
//    - Choose any location, start in TEST MODE
// 4. Click the gear icon → Project Settings → scroll down to "Your apps"
//    - Click the web icon (</>) to add a web app
//    - Copy the firebaseConfig values below
// 5. Replace the placeholder values with your real ones

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let firebaseDB = null;
try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        firebaseDB = firebase.database();
        console.log('Firebase connected');
    } else {
        console.log('Firebase not configured — using localStorage only');
    }
} catch (e) {
    console.warn('Firebase init failed:', e);
}
