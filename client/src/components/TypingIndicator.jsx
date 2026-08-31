export default function TypingIndicator() {
  return (
    <div className="message-row message-row--assistant">
      <div className="avatar avatar--ai">🤖</div>
      <div className="msg msg--assistant msg--typing">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}
