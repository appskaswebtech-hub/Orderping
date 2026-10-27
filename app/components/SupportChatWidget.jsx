import { useEffect, useRef, useState, useCallback } from "react";

const WIDGET_CSS = `
.opsc-launcher{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#ea580c,#dc2626);color:#fff;border:none;box-shadow:0 8px 24px rgba(234,88,12,0.35);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:9999;transition:transform .15s ease,box-shadow .15s ease}
.opsc-launcher:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(234,88,12,0.45)}
.opsc-badge{position:absolute;top:-4px;right:-4px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff}
.opsc-panel{position:fixed;right:20px;bottom:88px;width:340px;max-width:calc(100vw - 32px);height:460px;max-height:calc(100vh - 140px);background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.18);display:flex;flex-direction:column;overflow:hidden;z-index:9999;border:1px solid rgba(0,0,0,0.06);font-family:inherit}
.opsc-head{background:linear-gradient(135deg,#ea580c,#dc2626);color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.opsc-head-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700}
.opsc-head-dot{width:8px;height:8px;border-radius:50%;background:#fde68a;flex-shrink:0}
.opsc-head-close{background:none;border:none;color:#fff;opacity:.75;cursor:pointer;padding:4px;display:flex}
.opsc-head-close:hover{opacity:1}
.opsc-head-actions{display:flex;align-items:center;gap:10px}
.opsc-head-end{background:none;border:1px solid rgba(255,255,255,0.3);color:#fff;opacity:.85;cursor:pointer;font-size:11px;font-weight:600;padding:4px 9px;border-radius:7px}
.opsc-head-end:hover{opacity:1;border-color:#fff}
.opsc-head-end:disabled{opacity:.5;cursor:not-allowed}
.opsc-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#fafafa}
.opsc-empty{margin:auto;text-align:center;color:#9ca3af;font-size:12.5px;padding:0 20px}
.opsc-row{display:block;text-align:left;clear:both}
.opsc-row--shop{text-align:right}
.opsc-bubble{display:inline-block;text-align:left;max-width:78%;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.5;white-space:normal;overflow-wrap:break-word}
.opsc-row--shop .opsc-bubble{background:#ea580c;color:#fff;border-bottom-right-radius:4px}
.opsc-row--admin .opsc-bubble{background:#fff;color:#1a1a1a;border:1px solid rgba(0,0,0,0.08);border-bottom-left-radius:4px}
.opsc-attach{display:flex;align-items:center;gap:6px;margin-top:6px;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,0.06);font-size:12px;text-decoration:none;color:inherit}
.opsc-row--shop .opsc-attach{background:rgba(255,255,255,0.18)}
.opsc-attach-img{max-width:180px;max-height:140px;border-radius:8px;display:block;margin-top:6px}
.opsc-time{font-size:10px;color:#b0a8ab;margin-top:3px}
.opsc-row--shop .opsc-time{text-align:right}
.opsc-foot{flex-shrink:0;border-top:1px solid rgba(0,0,0,0.06);padding:10px 12px;background:#fff}
.opsc-filechip{display:flex;align-items:center;gap:6px;font-size:11.5px;background:#fff7ed;color:#9a3412;border:1px solid rgba(234,88,12,0.3);border-radius:8px;padding:5px 8px;margin-bottom:8px}
.opsc-filechip button{margin-left:auto;background:none;border:none;color:#b45454;cursor:pointer;font-size:12px}
.opsc-inputrow{display:flex;align-items:flex-end;gap:8px}
.opsc-textarea{flex:1;resize:none;border:1.5px solid #e5e0e2;border-radius:12px;padding:9px 12px;font:inherit;font-size:13px;max-height:90px;outline:none;transition:border-color .15s}
.opsc-textarea:focus{border-color:#ea580c}
.opsc-iconbtn{width:34px;height:34px;flex-shrink:0;border-radius:10px;border:1.5px solid #e5e0e2;background:#fff;color:#6b7280;display:flex;align-items:center;justify-content:center;cursor:pointer}
.opsc-iconbtn:hover{border-color:#ea580c;color:#ea580c}
.opsc-sendbtn{width:34px;height:34px;flex-shrink:0;border-radius:10px;border:none;background:#ea580c;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.opsc-sendbtn:disabled{opacity:.5;cursor:not-allowed}
.opsc-err{font-size:11.5px;color:#dc2626;margin-bottom:6px}
.opsc-closed-row{display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 0}
.opsc-closed-label{font-size:12px;color:#6b7280;text-align:center}
.opsc-reopen-btn{font-size:12px;font-weight:600;color:#ea580c;background:none;border:1px solid #ea580c;border-radius:8px;padding:5px 14px;cursor:pointer}
.opsc-reopen-btn:hover{background:#fff7ed}
.opsc-typing{font-style:italic;opacity:.65}
.opsc-system{text-align:center;font-size:11.5px;color:#9ca3af;padding:2px 0}
`;

const POLL_INTERVAL = 4000;

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [unread, setUnread] = useState(0);
  const [adminTyping, setAdminTyping] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastTypingSentAt = useRef(0);
  const pollRef = useRef(null);

  const closed = Boolean(thread?.closedAt);

  const fetchMessages = useCallback(async (markSeen = false) => {
    try {
      const url = markSeen ? "/app/support/messages?seen=1" : "/app/support/messages";
      const res = await fetch(url);
      if (!res.ok) return;
      const d = await res.json();
      setMessages(d.messages ?? []);
      setThread(d.thread ?? null);
      const typingAt = d.thread?.adminTypingAt ? new Date(d.thread.adminTypingAt).getTime() : 0;
      setAdminTyping(typingAt > 0 && Date.now() - typingAt < 8000);
      if (!open) setUnread(d.thread?.shopUnreadCount ?? 0);
    } catch {
      // network error — keep showing whatever we have
    }
  }, [open]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(() => fetchMessages(), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      fetchMessages(true);
    }
  }, [open, fetchMessages]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, adminTyping]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed && !file) return;
    setSending(true);
    setError(null);
    try {
      const fd = new FormData();
      if (trimmed) fd.append("body", trimmed);
      if (file) fd.append("file", file);
      const res = await fetch("/app/support/messages", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to send");
      setText("");
      setFile(null);
      await fetchMessages();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const endChat = async () => {
    await fetch("/app/support/close", { method: "POST" });
    await fetchMessages();
  };

  const startNew = async () => {
    await fetch("/app/support/reopen", { method: "POST" });
    await fetchMessages();
  };

  return (
    <>
      <style>{WIDGET_CSS}</style>
      <button className="opsc-launcher" onClick={() => setOpen((o) => !o)} aria-label="Support chat">
        {unread > 0 && !open && <span className="opsc-badge">{unread}</span>}
        {open
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        }
      </button>

      {open && (
        <div className="opsc-panel">
          <div className="opsc-head">
            <div className="opsc-head-title">
              <span className="opsc-head-dot" />
              Support
            </div>
            <div className="opsc-head-actions">
              {!closed && messages.length > 0 && (
                <button className="opsc-head-end" onClick={endChat} disabled={sending}>End chat</button>
              )}
              <button className="opsc-head-close" onClick={() => setOpen(false)} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div className="opsc-body">
            {messages.length === 0 && !closed && (
              <div className="opsc-empty">
                <p>👋 Hi! How can we help you?</p>
                <p style={{marginTop:4}}>Send us a message and we'll get back to you shortly.</p>
              </div>
            )}
            {messages.map((m) => {
              const isShop = m.sender === "shop";
              const isAdmin = m.sender === "admin";
              const isBot = m.sender === "bot" || m.sender === "BOT";
              const isSystem = m.sender === "system" || m.sender === "SYSTEM";
              if (isSystem) return <div key={m.id} className="opsc-system">{m.body}</div>;
              const rowClass = `opsc-row ${isShop ? "opsc-row--shop" : "opsc-row--admin"}`;
              const isImage = m.attachmentType?.startsWith("image/");
              return (
                <div key={m.id} className={rowClass}>
                  <div className="opsc-bubble">
                    {m.body && <div>{m.body}</div>}
                    {m.attachmentUrl && (
                      isImage
                        ? <img src={m.attachmentUrl} alt={m.attachmentName || "attachment"} className="opsc-attach-img" />
                        : <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="opsc-attach">📎 {m.attachmentName || "Attachment"}</a>
                    )}
                  </div>
                  <div className="opsc-time">
                    {isBot ? "Bot · " : isAdmin ? "Support · " : ""}
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })}
            {adminTyping && !closed && (
              <div className="opsc-row opsc-row--admin">
                <div className="opsc-bubble opsc-typing">typing...</div>
              </div>
            )}
            {closed && (
              <div className="opsc-closed-row">
                <span className="opsc-closed-label">This conversation is closed.</span>
                <button className="opsc-reopen-btn" onClick={startNew}>Start new chat</button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {!closed && (
            <div className="opsc-foot">
              {error && <div className="opsc-err">{error}</div>}
              {file && (
                <div className="opsc-filechip">
                  📎 {file.name}
                  <button onClick={() => setFile(null)}>✕</button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="opsc-inputrow">
                <button type="button" className="opsc-iconbtn" onClick={() => fileInputRef.current?.click()} aria-label="Attach">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                </button>
                <textarea
                  className="opsc-textarea"
                  rows={1}
                  placeholder="Type a message..."
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    const now = Date.now();
                    if (now - lastTypingSentAt.current > 2000) {
                      lastTypingSentAt.current = now;
                      fetch("/app/support/typing", { method: "POST" }).catch(() => {});
                    }
                  }}
                  onKeyDown={onKeyDown}
                />
                <button type="button" className="opsc-sendbtn" onClick={send} disabled={sending || (!text.trim() && !file)} aria-label="Send">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
