const express = require('express');
const { PythonShell } = require('python-shell');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// --- 1. SAFETY: RATE LIMITING ---
// This prevents one user from spamming your 0.1 CPU. 
// Limits each IP to 12 requests per minute.

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, 
    message: { success: false, error: "Too many requests. Please wait a minute." }
});

app.use(cors());
app.use(express.json());
app.use('/execute', limiter);

// --- 2. THE EXECUTION ENDPOINT ---
app.post('/execute', (appReq, appRes) => {
    const code = appReq.body.code;

    if (!code) {
        return appRes.status(400).json({ success: false, error: "No code provided" });
    }

    let options = {
        mode: 'text',
        pythonOptions: ['-u'], 
    };

    // SAFETY: Kill the script if it takes longer than 5 seconds
    const timeout = setTimeout(() => {
        return appRes.status(408).json({ 
            success: false, 
            error: "Execution Timeout: Your code took longer than 5 seconds to run." 
        });
    }, 5000);

    PythonShell.runString(code, options).then(messages => {
        clearTimeout(timeout); // Cancel timeout if code finishes fast
        appRes.json({ 
            success: true, 
            output: messages.join('\n') || ">>> Execution finished (no output)" 
        });
    }).catch(err => {
        clearTimeout(timeout);
        appRes.status(400).json({ success: false, error: err.message });
    });
});

// --- 3. THE 8-MINUTE NUDGE (Stay Awake) ---
// Replace with your actual Render URL once deployed
const RENDER_URL = 'https://your-service-name.onrender.com/health';

app.get('/health', (req, res) => res.send('System Online 🟢'));

setInterval(() => {
    axios.get(RENDER_URL)
        .then(() => console.log('Ping: Server staying awake...'))
        .catch((err) => console.log('Ping failed (Server probably booting up)'));
}, 480000); // 480,000ms = 8 minutes


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Kernel secure and running on port ${PORT}`);
});