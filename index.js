const express = require('express');
const { PythonShell } = require('python-shell');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Safety: Limit requests to avoid server crash
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 50, 
    message: { success: false, error: "Wait a minute before trying again." }
});

app.post('/execute', limiter, (req, res) => {
    const { code, language } = req.body;

    if (!code || !language) {
        return res.status(400).json({ success: false, error: "Code and Language are required" });
    }

    // --- PYTHON LOGIC ---
    if (language === 'python') {
        PythonShell.runString(code, { mode: 'text' })
            .then(messages => res.json({ success: true, output: messages.join('\n') }))
            .catch(err => res.status(400).json({ success: false, error: err.message }));
    } 

    // --- JAVA LOGIC ---
    else if (language === 'java') {
        const fileName = "Main.java";
        fs.writeFileSync(fileName, code);

        // Compile and Run in one command
        exec(`javac ${fileName} && java Main`, { timeout: 5000 }, (error, stdout, stderr) => {
            // Cleanup files
            if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
            if (fs.existsSync("Main.class")) fs.unlinkSync("Main.class");

            if (error) return res.status(400).json({ success: false, error: stderr || error.message });
            res.json({ success: true, output: stdout || ">>> Done (No output)" });
        });
    } else {
        res.status(400).json({ success: false, error: "Language not supported" });
    }
});

app.get('/health', (req, res) => res.send('System Online 🟢'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kernel ready on port ${PORT}`));
