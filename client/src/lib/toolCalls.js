// toolCalls.js
// The backend streams plain text (see server.js's /api/chat) — no SSE, no
// JSON envelope, just characters written straight to the response body, so
// the client can pipe them into the chat bubble as they arrive. To signal
// "a tool ran" inline in that same plain-text stream without corrupting it,
// the server wraps a small JSON blob in two control-character sentinels
// that a language model would never naturally produce as part of a reply
// (unlike a plain word, which a user could plausibly type or ask about).
// The client strips those out of what gets rendered as markdown and
// collects them separately so Message.jsx can show a proper tool-use card
// instead of raw JSON text.
export const TOOL_START = "\x02TOOLCALL\x02";
export const TOOL_END = "\x02ENDTOOLCALL\x02";

// Takes the FULL text assembled so far (not just the latest chunk) and
// splits it into the visible markdown content and any complete tool-call
// records found in it. An in-progress marker whose closing sentinel
// hasn't arrived yet is intentionally left out of `content` — safer to
// show nothing for a half-streamed marker than a flash of raw JSON.
export function extractToolCalls(raw) {
  let content = "";
  const toolCalls = [];
  let i = 0;
  while (i < raw.length) {
    const startIdx = raw.indexOf(TOOL_START, i);
    if (startIdx === -1) {
      content += raw.slice(i);
      break;
    }
    content += raw.slice(i, startIdx);
    const endIdx = raw.indexOf(TOOL_END, startIdx + TOOL_START.length);
    if (endIdx === -1) break; // marker still streaming in — stop here for now
    const jsonStr = raw.slice(startIdx + TOOL_START.length, endIdx);
    try {
      toolCalls.push(JSON.parse(jsonStr));
    } catch {
      // Malformed — skip it rather than crash the whole render.
    }
    i = endIdx + TOOL_END.length;
  }
  return { content, toolCalls };
}

// Turns a raw {name, args, ok, result|error} record (written by
// server.js's runTool, see TOOL_DEFINITIONS there) into the icon key +
// one-line summary Message.jsx renders as a small tool-use card.
export function describeToolCall(call) {
  if (!call || typeof call !== "object") return null;

  if (call.name === "calculate") {
    const expr = call.args?.expression ?? "";
    return call.ok
      ? { icon: "calculator", text: `${expr} = ${call.result}` }
      : { icon: "calculator", text: `Couldn't evaluate "${expr}"`, failed: true };
  }

  if (call.name === "convert_units") {
    const { value, from_unit, to_unit } = call.args || {};
    return call.ok
      ? { icon: "swap", text: `${value} ${from_unit} = ${roundForDisplay(call.result)} ${to_unit}` }
      : { icon: "swap", text: `Couldn't convert ${value} ${from_unit} to ${to_unit}`, failed: true };
  }

  return { icon: "calculator", text: call.ok ? String(call.result) : call.error || "Tool failed" };
}

function roundForDisplay(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return n;
  return Math.round(n * 10000) / 10000;
}
