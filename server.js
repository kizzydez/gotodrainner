// =============================================
// server.js - Backend for Airdrop Report Form
// =============================================

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('combined'));

// Store submissions (in-memory for simplicity)
const submissions = [];

// ===================== MAIN ENDPOINT =====================
app.post('/api/submit', (req, res) => {
    const { email, wallet, discord, twitter, complaint, submittedAt } = req.body;

    const formData = {
        email,
        wallet,
        discord,
        twitter,
        complaint,
        submittedAt: submittedAt || new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: new Date()
    };

    submissions.push(formData);

    console.log("=== NEW SUBMISSION RECEIVED ===");
    console.log(formData);
    console.log(`Total submissions: ${submissions.length}`);

    // You can also save to file or database here if needed

    res.status(200).json({
        success: true,
        message: "Form submitted successfully!",
        submissionId: Date.now()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: "ok", submissions: submissions.length });
});

app.get('/', (req, res) => {
    res.send("Airdrop Form Backend is running ✅");
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`Submission endpoint: http://localhost:${PORT}/api/submit`);
});
