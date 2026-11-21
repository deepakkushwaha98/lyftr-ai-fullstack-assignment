import { useEffect, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot, Check, ChevronDown, Copy, Download, Menu, MessageSquare,
  Moon, MoreHorizontal, Pencil, Plus, Search, Send, Settings,
  Sun, Trash2, User, X, Loader2, LogOut
} from "lucide-react";
import "./index.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const readStorage = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};
const newId = () => crypto.randomUUID();
const initialId = () => newId(); // Every page load starts a new session
const defaultSettings = { name: "Guest User", email: "", theme: "dark", systemPrompt: "" };

function App() {
  const [activeId, setActiveId] = useState(initialId);
  const [conversations, setConversations] = useState(() => readStorage("conversations", []));
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatMenuId, setChatMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [settings, setSettings] = useState(() => ({ ...defaultSettings, ...readStorage("chat_settings", {}) }));
  const [draftSettings, setDraftSettings] = useState(settings);
  const endRef = useRef(null);
  const requestSeq = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => { localStorage.setItem("chat_session_id", activeId); }, [activeId]);
  useEffect(() => { localStorage.setItem("conversations", JSON.stringify(conversations)); }, [conversations]);
  useEffect(() => { localStorage.setItem("chat_settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { document.documentElement.dataset.chatTheme = settings.theme; }, [settings.theme]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    const controller = new AbortController();
    const seq = ++requestSeq.current;
    setLoadingHistory(true);
    setError("");
    setMessages([]);
    axios.get(`${API_URL}/sessions/${encodeURIComponent(activeId)}/messages`, { signal: controller.signal })
      .then(({ data }) => {
        if (seq !== requestSeq.current) return;
        setMessages(data.messages.map(({ role, content, metadata }) => ({ role, content, metadata })));
        if (data.messages.length) {
          setConversations(prev => prev.some(c => c.id === activeId) ? prev : [
            { id: activeId, title: data.messages.find(m => m.role === "user")?.content.slice(0, 42) || "Conversation" }, ...prev
          ]);
        }
      })
      .catch(err => {
        if (seq !== requestSeq.current || err.code === "ERR_CANCELED") return;
        if (err.response?.status !== 404 && err.code !== "ERR_CANCELED") setError("Could not load this conversation. Check that the backend is running.");
      })
      .finally(() => { if (seq === requestSeq.current) setLoadingHistory(false); });
    return () => controller.abort();
  }, [activeId]);

  const startNewChat = () => {
    if (loadingRef.current) return;
    const id = newId();
    setConversations(prev => [{ id, title: "New Chat" }, ...prev]);
    setActiveId(id);
    setInput("");
    setError("");
    setSidebarOpen(false);
    setChatMenuId(null);
  };

  const switchChat = id => {
    if (loadingRef.current || id === activeId) return;
    setActiveId(id);
    setInput("");
    setSidebarOpen(false);
    setChatMenuId(null);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loadingRef.current || loadingHistory) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);

     setConversations(prev => {
      const existing = prev.find(c => c.id === activeId);
      const title = text.length > 42 ? text.slice(0, 42) + "…" : text;
      if (!existing) return [{ id: activeId, title }, ...prev];
      return prev.map(c => c.id === activeId && c.title === "New Chat" ? { ...c, title } : c);
    });
    try {
      const payload = { session_id: activeId, message: text };
      if (settings.systemPrompt.trim()) payload.system_prompt = settings.systemPrompt.trim();
      const { data } = await axios.post(`${API_URL}/chat`, payload, { timeout: 90000 });
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, metadata: data.metadata }]);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      const readableDetail = typeof detail === "string" ? detail : null;
      setError(
        status === 503 ? "All AI providers are unavailable. Please try again later." :
        status === 422 ? (readableDetail || "Invalid message. Please check your input.") :
        (readableDetail || "Unable to send message. Check the backend and try again.")
      );
      // Remove the optimistic user message because the backend may not have saved it.
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const renameChat = id => {
    const title = editingTitle.trim();
    if (title) setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    setEditingId(null);
    setChatMenuId(null);
  };
  const deleteChat = id => {
    if (loadingRef.current || !window.confirm("Remove this chat from the sidebar? Its messages will remain in SQLite.")) return;
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    setChatMenuId(null);
    if (activeId === id) setActiveId(remaining[0]?.id || newId());
  };
  const copyText = async (value, id) => {
    try { await navigator.clipboard.writeText(value); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); }
    catch { setError("Copy failed. Please copy the text manually."); }
  };
  const exportChat = () => {
    const blob = new Blob([JSON.stringify({ session_id: activeId, messages }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chat-${activeId.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const openSettings = () => { setDraftSettings(settings); setSettingsOpen(true); setProfileOpen(false); };
  const saveSettings = () => { setSettings({ ...draftSettings, name: draftSettings.name.trim() || "Guest User" }); setSettingsOpen(false); };
  const visibleChats = conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="chat-shell">
      {sidebarOpen && <button className="mobile-backdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}
      <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><span className="brand-icon"><Bot size={24}/></span><strong>AI Chatbot</strong><button className="mobile-close icon-button" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={20}/></button></div>
        <button className="new-chat" onClick={startNewChat} disabled={loading}><Plus size={19}/> New Chat</button>
        <div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></div>
        <div className="sidebar-label">Conversations</div>
        <div className="chat-list">
          {visibleChats.length === 0 && <p className="empty-list">{search ? "No matching chats" : "Your chats will appear here"}</p>}
          {visibleChats.map(chat => (
            <div key={chat.id} className={`chat-list-item ${activeId === chat.id ? "active" : ""}`}>
              {editingId === chat.id ? (
                <input className="rename-input" autoFocus value={editingTitle} onChange={e => setEditingTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") renameChat(chat.id); if (e.key === "Escape") setEditingId(null); }} onBlur={() => renameChat(chat.id)} />
              ) : (
                <button className="chat-select" onClick={() => switchChat(chat.id)}><MessageSquare size={17}/><span>{chat.title}</span></button>
              )}
              <button className="chat-more icon-button" aria-label={`Options for ${chat.title}`} onClick={() => setChatMenuId(chatMenuId === chat.id ? null : chat.id)}><MoreHorizontal size={18}/></button>
              {chatMenuId === chat.id && <div className="chat-popup"><button onClick={() => { setEditingTitle(chat.title); setEditingId(chat.id); setChatMenuId(null); }}><Pencil size={15}/> Rename</button><button className="danger" onClick={() => deleteChat(chat.id)}><Trash2 size={15}/> Remove from list</button></div>}
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-settings" onClick={openSettings}><Settings size={19}/> Settings</button>
          <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}><span className="avatar">{settings.name.charAt(0).toUpperCase()}</span><span className="profile-name"><strong>{settings.name}</strong><small>Local profile</small></span><ChevronDown size={16}/></button>
          {profileOpen && <div className="profile-menu"><button onClick={openSettings}><User size={16}/> Edit profile & preferences</button><p>Authentication is not enabled yet.</p></div>}
          <div className="powered">Powered by Gemini + FastAPI</div>
        </div>
      </aside>
      <main className="chat-main">
        <header className="chat-header"><div className="header-left"><button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={22}/></button><div><strong>Gemini AI Assistant</strong><small>Ask anything, keep the conversation going</small></div></div><div className="header-actions"><button className="icon-button" title="Export current conversation" onClick={exportChat} disabled={!messages.length}><Download size={18}/></button><span className="online-indicator"><span/> Ready</span></div></header>
        <div className="messages-scroll"><div className="messages-inner">
          {!loadingHistory && messages.length === 0 && <div className="welcome"><div className="welcome-icon"><Bot size={36}/></div><h1>How can I help you today?</h1><p>Ask a question, brainstorm an idea, or explore a topic.</p><div className="suggestions">{["Explain REST APIs simply", "Help me prepare for an interview", "Write a Python example"].map(text => <button key={text} onClick={() => setInput(text)}>{text}</button>)}</div></div>}
          {loadingHistory && <div className="loading-history"><Loader2 className="spin" size={20}/> Loading conversation...</div>}
          {messages.map((message, index) => <div key={`${activeId}-${index}`} className={`message-row ${message.role === "user" ? "from-user" : "from-assistant"}`}>
            <span className={`message-avatar ${message.role === "user" ? "user-avatar" : "bot-avatar"}`}>{message.role === "user" ? <User size={19}/> : <Bot size={19}/>}</span>
            <div className="message-stack" {...(message.role === "assistant" ? { "data-testid": "assistant-message" } : {})}><div className={`message-bubble ${message.role === "user" ? "user-bubble" : "assistant-bubble"}`}>{message.role === "assistant" ? <div className="ai-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div> : <span>{message.content}</span>}</div>
              {message.role === "assistant" && <>
                {message.metadata && <div className="message-metadata" style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                  <span>Source: <span data-testid="meta-source">{message.metadata.resolution_source}</span></span>
                  <span>Model: <span data-testid="meta-model">{message.metadata.model}</span></span>
                  <span>Latency: <span data-testid="meta-latency">{message.metadata.latency_ms} ms</span></span>
                  <span>Input tokens: <span data-testid="meta-input-tokens">{message.metadata.input_tokens}</span></span>
                  <span>Output tokens: <span data-testid="meta-output-tokens">{message.metadata.output_tokens}</span></span>
                </div>}
                <div className="message-tools"><button onClick={() => copyText(message.content, index)} title="Copy response">{copiedId === index ? <Check size={14}/> : <Copy size={14}/>} {copiedId === index ? "Copied" : "Copy"}</button></div>
              </>}
            </div>
          </div>)}
          {error && <div role="alert" className="message-row from-assistant"><span className="bot-avatar message-avatar"><Bot size={19}/></span><div className="message-stack"><div className="message-bubble assistant-bubble" style={{ border: "1px solid #ef4444" }}>{String(error)}</div></div></div>}
          {loading && <div className="thinking"><span className="bot-avatar message-avatar"><Bot size={19}/></span><Loader2 className="spin" size={18}/> Thinking...</div>}
          <div ref={endRef}/>
        </div></div>
        <div className="composer-wrap"><div className="composer"><textarea data-testid="chat-input" maxLength={4000} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }} placeholder="Message AI Chatbot..." rows={1} disabled={loading || loadingHistory}/><button data-testid="send-button" className="send-button" onClick={handleSend} disabled={!input.trim() || loading || loadingHistory} aria-label="Send message">{loading ? <Loader2 className="spin" size={19}/> : <Send size={19}/>}</button></div><p className="disclaimer">AI can make mistakes. Verify important information.</p></div>
      </main>
      {settingsOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}><div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings"><div className="modal-header"><div><h2>Settings & Profile</h2><p>Customize your local chatbot experience</p></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={21}/></button></div><div className="modal-content"><div className="settings-section"><h3>Profile</h3><label>Display name<input value={draftSettings.name} onChange={e => setDraftSettings(s => ({ ...s, name: e.target.value }))} maxLength={50}/></label><label>Email (optional, local only)<input type="email" value={draftSettings.email} onChange={e => setDraftSettings(s => ({ ...s, email: e.target.value }))} placeholder="you@example.com" /></label><p className="settings-note">These details are stored only in this browser. No account is created and no email is verified.</p></div><div className="settings-section"><h3>Appearance</h3><div className="theme-options"><button className={draftSettings.theme === "dark" ? "selected" : ""} onClick={() => setDraftSettings(s => ({ ...s, theme: "dark" }))}><Moon size={18}/> Dark</button><button className={draftSettings.theme === "light" ? "selected" : ""} onClick={() => setDraftSettings(s => ({ ...s, theme: "light" }))}><Sun size={18}/> Light</button></div></div><div className="settings-section"><h3>AI preferences</h3><label>System prompt (optional)<textarea data-testid="system-prompt-input" rows={4} value={draftSettings.systemPrompt} onChange={e => setDraftSettings(s => ({ ...s, systemPrompt: e.target.value }))} placeholder="Example: Answer briefly and use simple language." /></label><p className="settings-note">Changing the system prompt changes future requests, not earlier messages.</p></div><div className="settings-section"><h3>Account</h3><p className="settings-note">Guest mode only. Signup, login, and cloud-synced profiles are not implemented.</p></div></div><div className="modal-footer"><button className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button" onClick={saveSettings}>Save changes</button></div></div></div>}
    </div>
  );
}

export default App;