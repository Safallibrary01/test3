const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } = require('firebase/firestore');

const app = express();

// Middleware
// Update origin to your GitHub pages URL once deployed
app.use(cors({ origin: '*' })); 
app.use(express.json({ limit: '50mb' })); // Large limit for Base64 image uploads

// Initialize Firebase
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// 1. Login Endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { regNo, pass } = req.body;
        const q = query(collection(db, "students"), where("regNo", "==", regNo), where("password", "==", pass));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            let studentData = snap.docs[0].data();
            studentData.id = snap.docs[0].id;
            res.json(studentData);
        } else {
            res.status(401).json({ error: "Invalid Credentials" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Payments Endpoint
app.get('/api/payments/:regNo', async (req, res) => {
    try {
        const q = query(collection(db, "payments"), where("regNo", "==", req.params.regNo));
        const snap = await getDocs(q);
        const payments = [];
        snap.forEach(doc => payments.push(doc.data()));
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Attendance Endpoint
app.post('/api/attendance', async (req, res) => {
    try {
        const { type, studentId, name, regNo, seatNo } = req.body;
        
        if (type === 'seat') {
            await addDoc(collection(db, "attendance"), { studentId, name, regNo, seatNo, timestamp: new Date() });
            await updateDoc(doc(db, "students", studentId), { seatNo });
            res.json({ success: true, message: `Assigned to Seat ${seatNo}` });
        } else if (type === 'entry') {
            await addDoc(collection(db, "attendance"), { studentId, name, regNo, timestamp: new Date() });
            res.json({ success: true, message: "Entry Attendance Marked Successfully!" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Gemini AI Endpoint
app.post('/api/ai', async (req, res) => {
    try {
        const { systemInstruction, contents } = req.body;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: { text: systemInstruction } },
                contents: contents
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));