// server.js
// Express backend for the AI chatbot. This is the layer that talks to
// OpenAI so the API key stays on the server and never ships to the browser.
// Matches the "full-stack" pattern: React frontend (Vite, port 5173) ->
// this Express server (port 8000) -> OpenAI API.

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 8000;

// Attachments (voice notes, documents) arrive as multipart/form-data and are
// handled in memory — nothing is written to disk, since Render's free tier
// has an ephemeral filesystem anyway.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — plenty for a voice note or a resume
});

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

// Voice notes: the browser records audio, sends it here, and gets back the
// transcribed text. The frontend then sends that text through /api/chat
// exactly like a typed message — this endpoint doesn't talk to the chat
// model at all, only OpenAI's speech-to-text (Whisper) model.
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!openai) {
    return res.status(500).json({
      error: "Server has no OPENAI_API_KEY configured. Add one to server/.env and restart the server.",
    });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No audio file was received." });
  }

  try {
    const file = await OpenAI.toFile(req.file.buffer, req.file.originalname || "voice-note.webm");
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    res.json({ text: transcription.text || "" });
  } catch (err) {
    console.error("Error transcribing audio:", err.message);
    res.status(500).json({ error: "Could not transcribe that voice note. Please try again." });
  }
});

// Document attachments (PDF / DOCX / TXT): extracts plain text server-side
// so the frontend can fold it into the chat message as context. Images are
// handled entirely on the frontend instead (sent inline as base64 to the
// vision-capable chat model), so they never hit this endpoint.
const MAX_DOCUMENT_CHARS = 8000;

app.post("/api/extract", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No document was received." });
  }

  const { originalname, mimetype, buffer } = req.file;
  const lowerName = (originalname || "").toLowerCase();

  try {
    let text = "";

    if (mimetype === "application/pdf" || lowerName.endsWith(".pdf")) {
      // pdf-parse v2 has a class-based API (not the plain callable
      // function older versions used) — construct it with the buffer,
      // read the text, then release its internal resources.
      const { PDFParse } = require("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        // pdf-parse inserts "-- N of M --" page-separator lines into the
        // text; useful for its own page-mapping features, but just noise
        // once this is folded into a chat message, so strip them out.
        text = (parsed.text || "").replace(/\n?--\s*\d+\s*of\s*\d+\s*--\n?/g, "\n");
      } finally {
        await parser.destroy();
      }
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx")
    ) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
    } else if (mimetype === "text/plain" || lowerName.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else {
      return res.status(400).json({
        error: "Unsupported file type. Please attach a PDF, Word (.docx), or plain text (.txt) file.",
      });
    }

    text = text.trim();
    if (!text) {
      return res.status(400).json({ error: "Couldn't find any readable text in that document." });
    }

    const truncated = text.length > MAX_DOCUMENT_CHARS;
    if (truncated) {
      text = text.slice(0, MAX_DOCUMENT_CHARS);
    }

    res.json({ text, filename: originalname, truncated });
  } catch (err) {
    console.error("Error extracting document text:", err.message);
    res.status(500).json({ error: "Could not read that document. Please try a different file." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Turns Multer's upload errors (file too large, wrong field, etc.) into the
// same kind of JSON error response the frontend already knows how to show,
// instead of Express's default HTML error page.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "That file is too large (20MB max)." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});