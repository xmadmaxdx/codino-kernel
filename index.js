const express = require('express');
const { PythonShell } = require('python-shell');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

// --- 1. THE CRITICAL FIX FOR RENDER ---
// This tells express-rate-limit to trust the Render proxy
// and fixes the 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR' error.
app.set('trust proxy', 1); 

app.use(cors());
app.use(express.json());

// --- 2. SAFETY: RATE LIMITING ---
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, 
    message: { success: false, error: "Too many requests. Please wait a minute." }
});

// --- 3. THE EXECUTION ENDPOINT ---
app.post('/execute', limiter, (req, res) => {
    const { code, language } = req.body;

    if (!code) {
        return res.status(400).json({ success: false, error: "No code provided" });
    }

    // Default to python if no language is specified for backward compatibility
    const lang = language || 'python';

    // --- PYTHON LOGIC ---
    if (lang === 'python') {
        PythonShell.runString(code, { mode: 'text', pythonOptions: ['-u'] })
            .then(messages => {
                res.json({ 
                    success: true, 
                    output: messages.join('\n') || ">>> Execution finished (no output)" 
                });
            })
            .catch(err => {
                res.status(400).json({ success: false, error: err.message });
            });
    } 

    // --- JAVA LOGIC ---
    else if (lang === 'java') {
        // We use a unique ID or timestamp to prevent file collisions if 2 users run at once
        const jobId = Date.now();
        const fileName = `Main_${jobId}.java`;
        const className = `Main_${jobId}`;

        // Java is strict: we must replace "public class Main" with our temp class name
        // so that the filename matches the class name perfectly.
        const modifiedCode = code.replace(/public\s+class\s+Main/g, `public class ${className}`);
        
        fs.writeFileSync(fileName, modifiedCode);

        // Compile and Run
        exec(`javac ${fileName} && java ${className}`, { timeout: 6000 }, (error, stdout, stderr) => {
            // Cleanup: Remove .java and .class files immediately
            if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
            if (fs.existsSync(`${className}.class`)) fs.unlinkSync(`${className}.class`);

            if (error) {
                // Return the specific Java compiler error (stderr) so the user can fix their code
                const errorMessage = stderr || error.message;
                return res.status(400).json({ 
                    success: false, 
                    error: errorMessage 
                });
            }
            
            res.json({ 
                success: true, 
                output: stdout || ">>> Execution finished (no output)" 
            });
        });
    } 
    
    else {
        res.status(400).json({ success: false, error: "Language not supported" });
    }
});

// --- 4. HEALTH & WAKE-UP ---
app.get('/health', (req, res) => res.send('System Online 🟢'));

// Keep-alive logic (Optional)
const RENDER_URL = 'https://codino-kernel-2.onrender.com/health';
setInterval(() => {
    axios.get(RENDER_URL).catch(() => console.log('Waking up...'));
}, 480000); // 8 minutes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Kernel ready on port ${PORT}`);
});
