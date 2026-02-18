import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AIagentPage.css';

interface Message {
  id: number;
  type: 'user' | 'assistant' | 'error';
  text: string;
  time: string;
}

interface ContextCase {
  icon: string;
  label: string;
  status: 'review-needed' | 'processing' | 'completed' | 'draft';
  statusLabel: string;
}

const SUGGESTED_PROMPTS: string[] = [
  'Summarize all active cases with review needed',
  'What are the key risks in the Commercial Tenancies case?',
  'Draft a brief on EU Data Protection compliance',
  'Compare IP audit findings with industry standards',
];

const now = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fakeAIResponse = (query: string): Promise<string> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(`AI Integration In Progress - Can't Respond To: "${query}"`);
    }, 1200); // simulate typing delay
  });

const AIagentPage: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'assistant',
      text: "Hello, I'm your AI Legal Assistant. How can I help you today?",
      time: now(),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = (text ?? input).trim();
      if (!messageText || isTyping) return;

      setMessages((prev) => [
        ...prev,
        { id: Date.now(), type: 'user', text: messageText, time: now() },
      ]);
      setInput('');
      setIsTyping(true);

      try {
        const response = await fakeAIResponse(messageText);
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), type: 'assistant', text: response, time: now() },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: 'error',
            text: '⚠ An unexpected error occurred.',
            time: now(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const contextCases: ContextCase[] = [
    { icon: '📋', label: 'Commercial Tenancies Review', status: 'review-needed', statusLabel: 'REVIEW' },
    { icon: '🔄', label: 'Data Protection Bill Analysis', status: 'processing', statusLabel: 'PROCESSING' },
  ];

  return (
    <div className="ai-agent-page">
      {/* Header */}
      <header className="ai-agent-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          Back to Workspace
        </button>
      </header>

      {/* Body */}
      <div className="ai-agent-body">
        {/* Context Panel */}
        <aside className="context-panel">
          <div className="context-section">
            <h3 className="context-label">ACTIVE CONTEXT</h3>
            <div className="context-items">
              {contextCases.map((item, i) => (
                <div key={i} className="context-item">
                  <span className="context-item-icon">{item.icon}</span>
                  <span className="context-item-label">{item.label}</span>
                  <span className={`context-item-status status-${item.status}`}>
                    {item.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="context-section">
            <h3 className="context-label">SUGGESTED PROMPTS</h3>
            <div className="suggested-prompts">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  className="suggested-btn"
                  onClick={() => handleSend(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="chat-area">
          <div className="messages-list">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.type}`}>
                <div className={`message-bubble ${msg.type}`}>{msg.text}</div>
                <div className="message-time">{msg.time}</div>
              </div>
            ))}

            {isTyping && (
              <div className="message-row assistant">
                <div className="message-bubble typing-bubble">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="input-area">
            <div className="input-wrapper">
              <textarea
                ref={inputRef}
                className="message-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your AI assistant..."
              />
              <button
                className={`send-btn ${input.trim() && !isTyping ? 'active' : ''}`}
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
              >
                Send
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AIagentPage;
