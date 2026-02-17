const express = require('express');
const { PythonShell } = require('python-shell');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/execute', (appReq, appRes) => {
    let options = {
        mode: 'text',
        pythonOptions: ['-u'], // get print results in real-time
    };

    PythonShell.runString(appReq.body.code, options).then(messages => {
        appRes.json({ success: true, output: messages.join('\n') });
    }).catch(err => {
        appRes.status(400).json({ success: false, error: err.message });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kernel running on port ${PORT}`));