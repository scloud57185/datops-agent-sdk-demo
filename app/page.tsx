"use client";

import { useState, useRef, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────

interface ToolResult {
  tool: string;
  risk: string;
  allowed: boolean;
  result?: string;
  blocked?: { reason: string; trustScore: number; sandboxLevel: string };
}

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  toolResults?: ToolResult[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function getSandboxLevel(score: number): string {
  if (score < 30) return "STRICT";
  if (score < 70) return "ADAPTIVE";
  return "OPEN";
}

function getSandboxClass(score: number): string {
  if (score < 30) return "strict";
  if (score < 70) return "adaptive";
  return "open";
}

const TOOLS = [
  { name: "read_file", risk: "low", label: "Read File" },
  { name: "search_web", risk: "medium", label: "Search Web" },
  { name: "send_email", risk: "high", label: "Send Email" },
  { name: "execute_trade", risk: "high", label: "Execute Trade" },
];

function isToolAllowed(risk: string, score: number): boolean {
  if (score < 10) return false;
  const level = getSandboxLevel(score);
  const allowed: Record<string, string[]> = {
    STRICT: ["low"],
    ADAPTIVE: ["low", "medium"],
    OPEN: ["low", "medium", "high"],
  };
  return (allowed[level] || []).includes(risk);
}

const SUGGESTIONS = [
  "Read the users.json file",
  "Search for flights to NYC",
  "Send an email to team@company.com",
  "Buy 100 shares of AAPL",
];

// ─── Component ──────────────────────────────────────────────────────

export default function DemoPage() {
  const [trustScore, setTrustScore] = useState(55);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sandboxLevel = getSandboxLevel(trustScore);
  const sandboxClass = getSandboxClass(trustScore);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, trustScore }),
      });
      const data = await res.json();

      const agentMsg: ChatMessage = {
        role: "agent",
        text: data.response,
        toolResults: data.toolResults,
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: "Connection error. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      {/* ─── Left Panel: Trust Controls ─────────────────────────── */}
      <div className="trust-panel">
        <div className="logo">
          DatOps <span>Agent SDK</span>
        </div>

        {/* Trust Score */}
        <div className="card">
          <h3>Agent Trust Score</h3>
          <div className="trust-score-display">
            <div className={`trust-number ${sandboxClass}`}>
              {trustScore}
            </div>
            <div className={`sandbox-badge ${sandboxClass}`}>
              {sandboxLevel}
            </div>
          </div>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="100"
              value={trustScore}
              onChange={(e) => setTrustScore(Number(e.target.value))}
            />
            <div className="slider-labels">
              <span>0 Untrusted</span>
              <span>50</span>
              <span>100 Trusted</span>
            </div>
          </div>
        </div>

        {/* Tool Access */}
        <div className="card">
          <h3>Tool Access at Current Trust</h3>
          <div className="sandbox-rules">
            {TOOLS.map((tool) => {
              const allowed = isToolAllowed(tool.risk, trustScore);
              return (
                <div key={tool.name} className={`rule-row ${allowed ? "allowed" : "blocked"}`}>
                  <span className="dot" />
                  <span className="tool-name">{tool.label}</span>
                  <span className="risk-tag">{tool.risk}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SDK Code */}
        <div className="card">
          <h3>Your Code (2 Lines)</h3>
          <div className="code-block">
            <span className="kw">import</span> {"{ DatOps }"} <span className="kw">from</span> <span className="str">{`'@datplatform/agent-sdk'`}</span>;<br />
            <br />
            <span className="cm">{"// Wrap your tools — that's it"}</span><br />
            <span className="kw">const</span> tools = <span className="fn">DatOps.wrapVercelTools</span>(myTools, {"{"}<br />
            {"  "}apiKey: <span className="str">{`'dat_xxx'`}</span>,<br />
            {"  "}toolRiskLevels: {"{"}<br />
            {"    "}read_file: <span className="str">{`'low'`}</span>,<br />
            {"    "}search_web: <span className="str">{`'medium'`}</span>,<br />
            {"    "}send_email: <span className="str">{`'high'`}</span>,<br />
            {"  "}{"}"}<br />
            {"}"});
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Chat ──────────────────────────────────── */}
      <div className="chat-panel">
        <div className="chat-header">
          <span className="pulse" />
          Agent Session — Trust {trustScore} / {sandboxLevel}
        </div>

        <div className="messages">
          {messages.length === 0 && (
            <div className="message agent">
              Try sending a message. Drag the trust slider on the left to see tools get blocked in real-time.
              <br /><br />
              <strong>Try these:</strong><br />
              Low risk: <code>read users.json</code><br />
              Medium risk: <code>search for flights</code><br />
              High risk: <code>send email to john@co.com</code><br />
              High risk: <code>buy 100 shares of AAPL</code>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              {msg.role === "agent" && msg.toolResults ? (
                <>
                  {msg.toolResults.map((tr, j) => (
                    <div key={j} className={`tool-card ${tr.allowed ? "allowed" : "blocked"}`}>
                      <span className="icon">{tr.allowed ? "\u2705" : "\u26D4"}</span>
                      <div className="tool-info">
                        <div className="tool-header">
                          {tr.tool} <span className="risk-tag" style={{ marginLeft: 6 }}>{tr.risk}</span>
                        </div>
                        <div className="tool-detail">
                          {tr.allowed
                            ? tr.result
                            : tr.blocked?.reason}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <span>{msg.text}</span>
              )}
            </div>
          ))}

          {loading && (
            <div className="message agent" style={{ opacity: 0.5 }}>
              Checking trust gate...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="suggestion"
              onClick={() => sendMessage(s)}
              disabled={loading}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="chat-input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Try a command..."
            disabled={loading}
          />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
