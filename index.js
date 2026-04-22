const express = require('express');
const { PythonShell } = require('python-shell');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process'); // Needed for Java
const fs = require('fs');
const path = require('path');

const app = express();

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 20, 
    message: { success: false, error: "Too many requests. Please wait a minute." }
});

app.use(cors());
app.use(express.json());

// --- THE EXECUTION ENDPOINT ---
app.post('/execute', limiter, (appReq, appRes) => {
    const { code, language } = appReq.body; // Added language parameter

    if (!code) {
        return appRes.status(400).json({ success: false, error: "No code provided" });
    }

    // --- LOGIC FOR PYTHON ---
    if (language === 'python') {
        let options = { mode: 'text', pythonOptions: ['-u'] };
        
        PythonShell.runString(code, options)
            .then(messages => {
                appRes.json({ success: true, output: messages.join('\n') || ">>> Execution finished" });
            })
            .catch(err => appRes.status(400).json({ success: false, error: err.message }));
    } 

    // --- LOGIC FOR JAVA ---
    else if (language === 'java') {
        const fileName = "Main.java";
        const className = "Main";

        // 1. Save code to a file
        fs.writeFileSync(fileName, code);

        // 2. Compile and Run
        // We use a 5-second limit to prevent infinite loops
        exec(`javac ${fileName} && java ${className}`, { timeout: 5000 }, (error, stdout, stderr) => {
            // Cleanup files after running
            if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
            if (fs.existsSync(`${className}.class`)) fs.unlinkSync(`${className}.class`);

            if (error) {
                const errMsg = stderr || error.message;
                return appRes.status(400).json({ success: false, error: errMsg });
            }
            appRes.json({ success: true, output: stdout || ">>> Execution finished" });
        });
    } 
    
    else {
        appRes.status(400).json({ success: false, error: "Unsupported language" });
    }
});

app.get('/health', (req, res) => res.send('System Online 🟢'));

// KEEP ALIVE LOGIC
const RENDER_URL = 'https://codino-kernel.onrender.com/health';
setInterval(() => {
    axios.get(RENDER_URL).catch(() => console.log('Ping failed'));
}, 480000); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kernel running on port ${PORT}`));
