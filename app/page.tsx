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

const SANDBOX_ALLOWED: Record<string, string[]> = {
  STRICT: ["low"],
  ADAPTIVE: ["low", "medium"],
  OPEN: ["low", "medium", "high"],
};

function isToolAllowed(risk: string, score: number): boolean {
  if (score < 10) return false;
  const level = getSandboxLevel(score);
  return (SANDBOX_ALLOWED[level] || []).includes(risk);
}

// ─── Tool definitions (simulated) ───────────────────────────────────

interface ToolDef {
  risk: "low" | "medium" | "high";
  execute: (args: Record<string, string>) => string;
}

const TOOL_DEFS: Record<string, ToolDef> = {
  read_file: {
    risk: "low",
    execute: (args) => `Contents of ${args.path || "data.txt"}: {"users": 142, "revenue": "$12,400"}`,
  },
  search_web: {
    risk: "medium",
    execute: (args) => `Top results for "${args.query || "flights"}": 1) NYC flights from $89 (JetBlue), 2) $120 round-trip (Delta), 3) $95 one-way (Spirit)`,
  },
  send_email: {
    risk: "high",
    execute: (args) => `Email sent to ${args.to || "team@company.com"}: "Update from DatOps Agent"`,
  },
  execute_trade: {
    risk: "high",
    execute: (args) => `Trade executed: ${args.action || "BUY"} ${args.quantity || "100"} ${args.symbol || "AAPL"} at market price`,
  },
};

// ─── Intent detection (all client-side) ─────────────────────────────

interface ToolCall {
  tool: string;
  args: Record<string, string>;
  risk: string;
}

function detectIntent(message: string): ToolCall[] {
  const lower = message.toLowerCase();
  const calls: ToolCall[] = [];

  if (lower.includes("read") || lower.includes("file") || lower.includes("open") || lower.includes("cat ")) {
    calls.push({
      tool: "read_file",
      args: { path: lower.includes("user") ? "users.json" : "data.txt" },
      risk: "low",
    });
  }

  if (lower.includes("search") || lower.includes("find") || lower.includes("look up") || lower.includes("flight") || lower.includes("weather") || lower.includes("google")) {
    const query = message.replace(/^(search|find|look up|google)\s*(for|about)?\s*/i, "") || "flights to NYC";
    calls.push({
      tool: "search_web",
      args: { query: query.trim() },
      risk: "medium",
    });
  }

  if (lower.includes("email") || lower.includes("send") || lower.includes("mail") || lower.includes("notify")) {
    calls.push({
      tool: "send_email",
      args: {
        to: lower.includes("@") ? (lower.match(/[\w.-]+@[\w.-]+/)?.[0] || "team@company.com") : "team@company.com",
      },
      risk: "high",
    });
  }

  if (lower.includes("trade") || lower.includes("buy") || lower.includes("sell") || lower.includes("stock") || lower.includes("shares")) {
    calls.push({
      tool: "execute_trade",
      args: {
        action: lower.includes("sell") ? "SELL" : "BUY",
        symbol: "AAPL",
        quantity: "100",
      },
      risk: "high",
    });
  }

  if (calls.length === 0) {
    calls.push({
      tool: "search_web",
      args: { query: message },
      risk: "medium",
    });
  }

  return calls;
}

function processMessage(message: string, trustScore: number): { toolResults: ToolResult[] } {
  const score = trustScore;
  const sandboxLevel = getSandboxLevel(score);
  const toolCalls = detectIntent(message);

  const results: ToolResult[] = toolCalls.map((call) => {
    const tool = TOOL_DEFS[call.tool];
    if (!tool) {
      return { tool: call.tool, risk: call.risk, allowed: false, blocked: { reason: "Unknown tool", trustScore: score, sandboxLevel } };
    }

    if (score < 10) {
      return {
        tool: call.tool,
        risk: call.risk,
        allowed: false,
        blocked: { reason: `Trust score ${score} is below minimum threshold (10)`, trustScore: score, sandboxLevel },
      };
    }

    if (call.risk === "high" && score < 70) {
      return {
        tool: call.tool,
        risk: call.risk,
        allowed: false,
        blocked: { reason: `High-risk tool requires trust >= 70, current: ${score}`, trustScore: score, sandboxLevel },
      };
    }

    if (!(SANDBOX_ALLOWED[sandboxLevel] || []).includes(call.risk)) {
      return {
        tool: call.tool,
        risk: call.risk,
        allowed: false,
        blocked: { reason: `${sandboxLevel} sandbox does not allow ${call.risk}-risk tools`, trustScore: score, sandboxLevel },
      };
    }

    return {
      tool: call.tool,
      risk: call.risk,
      allowed: true,
      result: tool.execute(call.args),
    };
  });

  return { toolResults: results };
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

  function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Simulate a brief processing delay
    setTimeout(() => {
      const { toolResults } = processMessage(text, trustScore);
      const agentMsg: ChatMessage = {
        role: "agent",
        text: "",
        toolResults,
      };
      setMessages((prev) => [...prev, agentMsg]);
      setLoading(false);
    }, 300);
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
