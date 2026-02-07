# Jarvis — Ironman LLM (Gemini) + Hinglish

This project includes a frontend (PWA-ready) with Ironman-themed UI and Hinglish support, and a Node/Express proxy server that forwards prompts to Google's Gemini (Generative Language) API.

## Setup
1. Clone or unzip project.
2. `cd jarvis-gemini-ironman`
3. `npm install`
4. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
5. `npm start`
6. Open `http://localhost:3000` in Chrome. Grant microphone access.

## Notes
- DO NOT commit `.env` to GitHub. Add `.env` to `.gitignore`.
- If you deploy to a platform (Render, Railway, Vercel), set GEMINI_API_KEY in platform secrets.
- PWA: manifest.json + service worker included. Use PWA Builder after pushing to GitHub.

## Files
- public/: frontend files (index.html, styles.css, script.js, manifest.json, sw.js)
- server.js: Express server that proxies /api/chat to Gemini
- .env.example: example environment file
- package.json: dependencies
