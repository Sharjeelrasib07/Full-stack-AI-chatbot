# AI Chatbot — React + Node.js Full Stack Demo

A full-stack chatbot built with a React (Vite) frontend, a Node/Express
backend, and the OpenAI API — the same pattern used in production AI
features: the frontend never talks to OpenAI directly, it goes through
your own backend, which is the only place the API key lives.

## Features

- **Streaming replies** — the AI's response appears word-by-word as it's
  generated (like ChatGPT), instead of waiting for the full reply.
- **Multiple saved conversations** — a sidebar to create, switch between,
  and delete separate chats, each auto-titled from its first message.
- **Persistence** — conversations and your theme choice are saved to the
  browser's localStorage, so they survive a page refresh.
- **Markdown rendering** — AI replies render bold text, lists, links, and
  code blocks properly instead of showing raw markdown syntax.
- **Dark / light mode** — toggle in the sidebar, remembered between visits.
- **Polished chat UI** — avatars, per-message timestamps, a copy button on
  AI replies, an animated typing indicator, smooth message animations, and
  an auto-resizing input box (Enter to send, Shift+Enter for a new line).
- **Responsive** — the sidebar collapses behind a menu button on narrow
  screens.

## Architecture

```
Browser (React, Vite dev server — http://localhost:5173)
        │  fetch POST /api/chat  (reads a streamed response)
        ▼
Express backend (http://localhost:8000)
        │  openai.chat.completions.create({ stream: true, ... })
        ▼
OpenAI API
```

Two separate apps that run side by side:

```
ai-chatbot-react/
├── client/     React app (Vite) — the chat UI
│   └── src/
│       ├── App.jsx              Top-level state: conversations, theme, sending/streaming
│       ├── components/
│       │   ├── Sidebar.jsx       Conversation list, new chat, delete, theme toggle
│       │   ├── ChatWindow.jsx    Message list + input form
│       │   ├── Message.jsx       One chat bubble (avatar, markdown, timestamp, copy)
│       │   └── TypingIndicator.jsx
│       └── lib/
│           └── storage.js        localStorage helpers (conversations, theme)
└── server/     Express app — proxies streamed requests to OpenAI
    └── server.js
```

## Setup

You need two terminals — one for the backend, one for the frontend.

**Terminal 1 — backend**
```
cd server
npm install
cp .env.example .env
# open .env and paste your OpenAI API key (from platform.openai.com/api-keys)
npm start
```
This starts the backend at http://localhost:8000.

**Terminal 2 — frontend**
```
cd client
npm install
npm run dev
```
This starts the React app at http://localhost:5173 — open that URL in
your browser and start chatting.

Note: http://localhost:8000 on its own will show "Cannot GET /" — that's
expected, the backend only exposes API routes (`/api/chat`, `/api/health`),
not a homepage. The actual UI is on port 5173.

## Why split into client/ and server/

This mirrors how real AI-powered apps are built: the frontend is a plain
static React app with no secrets in it, and the backend is the only piece
that holds the OpenAI API key and talks to the AI provider. If you called
OpenAI directly from React, your API key would be visible to anyone who
opens the browser's dev tools — this project deliberately avoids that.

## How streaming works

The backend calls OpenAI with `stream: true`, which returns the reply as
a sequence of small chunks instead of one big response. Each chunk is
written straight to the HTTP response as it arrives (`res.write(...)`).
On the frontend, `fetch()`'s `response.body` is read with a
`ReadableStream` reader in a loop, decoding and appending each chunk to
the in-progress assistant message — which is what makes the text appear
to "type itself" in the UI.

## Key files

- `server/server.js` — the Express route `POST /api/chat`: validates the
  request, calls OpenAI with `stream: true`, and pipes tokens to the
  response as they arrive.
- `client/src/App.jsx` — owns all app state (conversations, active chat,
  theme) and the `fetch` + streaming-read logic.
- `client/src/lib/storage.js` — small wrapper around `localStorage` for
  saving/loading conversations and theme, with safe fallbacks.

## Possible next steps

- Persist conversation history in a real database instead of localStorage.
- Add user authentication so each person has their own chat history.
- Add a model picker (e.g. switch between `gpt-4o-mini` and `gpt-4o`).
- Deploy it (e.g. Render, Railway, or Vercel for the frontend + a small
  backend host) so it's live at a public URL, not just localhost.
