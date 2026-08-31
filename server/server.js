// server.js
// Express backend for the AI chatbot. This is the layer that talks to
// OpenAI so the API key stays on the server and never ships to the browser.
// Matches the "full-stack" pattern: React frontend (Vite, port 5173) ->
// this Express server (port 8000) -> OpenAI API.

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 8000;

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "\n[WARNING] OPENAI_API_KEY is not set. Copy .env.example to .env and add your key,\n" +
      "otherwise /api/chat requests will fail.\n"
  );
}

// Lazily-guarded client: the server still boots without a key so you can
// work on/preview the frontend before wiring up billing.
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(cors());
app.use(bodyParser.json());

const SYSTEM_PROMPT =
  "You are a friendly, concise assistant embedded in a demo chat app. Keep answers short and clear.";

// Streams the AI's reply back to the browser token-by-token (like ChatGPT)
// instead of making the user wait for the full response. The validation
// checks below all happen BEFORE any streaming headers are set, so they
// still return a normal JSON error response — the frontend can tell the
// two cases apart by checking res.ok before it starts reading a stream.
app.post("/api/chat", async (req, res) => {
  if (!openai) {
    return res.status(500).json({
      error: "Server has no OPENAI_API_KEY configured. Add one to server/.env and restart the server.",
    });
  }

  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Request body must include a non-empty 'messages' array." });
  }

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");

    for await (const part of stream) {
      const token = part.choices?.[0]?.delta?.content;
      if (token) {
        res.write(token);
      }
    }
    res.end();
  } catch (err) {
    console.error("Error calling OpenAI API:", err.message);
    // If we've already started streaming, we can't switch to a JSON error
    // response anymore — just end the stream and let the client's fallback
    // handling take over. Otherwise, respond with a normal JSON error.
    if (!res.headersSent) {
      res.status(500).json({
        error: "Something went wrong talking to the AI. Check the server logs and your API key.",
      });
    } else {
      res.end();
    }
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
