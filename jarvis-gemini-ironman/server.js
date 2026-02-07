// server.js — Gemini proxy (uses axios)
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3o';
const PORT = process.env.PORT || 3000;

if(!GEMINI_API_KEY){
  console.warn('WARNING: GEMINI_API_KEY not set. /api/chat will return errors.');
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if(!prompt || typeof prompt !== 'string' || !prompt.trim()){
      return res.status(400).json({ error: 'Missing prompt' });
    }
    if(!GEMINI_API_KEY){
      return res.status(500).json({ error: 'Server not configured with GEMINI_API_KEY' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const payload = {
      contents: [
        { parts: [{ text: prompt }] }
      ]
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      timeout: 20000
    });

    const j = response.data;
    let reply = 'No reply from Gemini';
    try {
      reply = j?.candidates?.[0]?.content?.[0]?.parts?.[0]?.text
            || j?.candidates?.[0]?.content?.parts?.[0]?.text
            || JSON.stringify(j);
    } catch(e){
      reply = JSON.stringify(j);
    }

    return res.json({ reply });
  } catch (err) {
    console.error('Gemini proxy error', err.response ? err.response.data : err.message);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, ()=> console.log('Server running on http://localhost:'+PORT));
