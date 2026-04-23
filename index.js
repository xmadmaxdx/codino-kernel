const express = require('express');
const { PythonShell } = require('python-shell'); // Keep for structure
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

// --- 1. RENDER PROXY FIX ---
app.set('trust proxy', 1); 

app.use(cors());
app.use(express.json());

// --- 2. RATE LIMITING (Prevent Spam) ---
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 50, 
    message: { success: false, error: "Too many requests. Please wait a minute." }
});

// --- 3. THE EXECUTION ENDPOINT ---
app.post('/execute', limiter, (req, res) => {
    const { code, language } = req.body;

    if (!code) {
        return res.status(400).json({ success: false, error: "No code provided" });
    }

    const lang = language || 'java'; // Default to Java if not specified

    // --- PYTHON LOGIC (Kept as requested) ---
    if (lang === 'python') {
        PythonShell.runString(code, { mode: 'text' })
            .then(messages => {
                res.json({ success: true, output: messages.join('\n') });
            })
            .catch(err => res.status(400).json({ success: false, error: err.message }));
    } 

    // --- JAVA LOGIC (Optimized & Accurate) ---
    else if (lang === 'java') {
        const fileName = "Main.java";
        const className = "Main";

        // Step 1: Write the user's code to Main.java
        fs.writeFileSync(fileName, code);

        // Step 2: Compile and Run
        // We use a longer 7-second timeout for Java compilation
        exec(`javac ${fileName} && java ${className}`, { timeout: 7000 }, (error, stdout, stderr) => {
            
            // Step 3: IMMEDIATE CLEANUP
            // We must delete the files so the next request starts fresh
            if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
            if (fs.existsSync(`${className}.class`)) fs.unlinkSync(`${className}.class`);

            if (error) {
                // If javac fails, stderr contains the line number and error
                // If the user used the wrong class name, this will tell them
                const errorDetail = stderr || error.message;
                return res.status(400).json({ 
                    success: false, 
                    error: errorDetail.includes("should be declared in a file") 
                           ? "Error: Your class name must be 'Main'." 
                           : errorDetail
                });
            }
            
            // Step 4: Success!
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

// --- 4. HEALTH & MAINTENANCE ---
app.get('/health', (req, res) => res.send('System Online 🟢'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Java Kernel ready on port ${PORT}`));
