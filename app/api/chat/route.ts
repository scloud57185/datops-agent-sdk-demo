/**
 * DatOps Agent SDK Demo — API Route
 *
 * Shows trust-gated tool execution with Vercel AI SDK.
 * Works in two modes:
 *   1. Live mode: Real DatOps platform + real LLM (needs API keys)
 *   2. Demo mode: Simulated trust enforcement (no keys needed)
 */

import { NextRequest, NextResponse } from "next/server";

// ─── Trust enforcement types ────────────────────────────────────────

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  risk: "low" | "medium" | "high";
}

interface ToolResult {
  tool: string;
  risk: string;
  allowed: boolean;
  result?: string;
  blocked?: { reason: string; trustScore: number; sandboxLevel: string };
}

// ─── Sandbox logic (mirrors @datplatform/agent-sdk) ─────────────────

const SANDBOX_ALLOWED: Record<string, string[]> = {
  STRICT: ["low"],
  ADAPTIVE: ["low", "medium"],
  OPEN: ["low", "medium", "high"],
};

function getSandboxLevel(score: number): string {
  if (score < 30) return "STRICT";
  if (score < 70) return "ADAPTIVE";
  return "OPEN";
}

function isAllowed(risk: string, sandboxLevel: string): boolean {
  return (SANDBOX_ALLOWED[sandboxLevel] || []).includes(risk);
}

// ─── Tool definitions ───────────────────────────────────────────────

const TOOLS: Record<string, { risk: "low" | "medium" | "high"; description: string; execute: (args: any) => string }> = {
  read_file: {
    risk: "low",
    description: "Read a local file (low risk — available at any trust level)",
    execute: (args) => `Contents of ${args.path}: {"users": 142, "revenue": "$12,400"}`,
  },
  search_web: {
    risk: "medium",
    description: "Search the web (medium risk — requires trust >= 30)",
    execute: (args) => `Top results for "${args.query}": 1) NYC flights from $89 (JetBlue), 2) $120 round-trip (Delta), 3) $95 one-way (Spirit)`,
  },
  send_email: {
    risk: "high",
    description: "Send an email (high risk — requires trust >= 70)",
    execute: (args) => `Email sent to ${args.to}: "${args.subject}"`,
  },
  execute_trade: {
    risk: "high",
    description: "Execute a financial trade (high risk — requires trust >= 70)",
    execute: (args) => `Trade executed: ${args.action} ${args.quantity} ${args.symbol} at market price`,
  },
};

// ─── Intent detection (demo mode — no LLM needed) ──────────────────

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
        to: lower.includes("@") ? lower.match(/[\w.-]+@[\w.-]+/)?.[0] || "team@company.com" : "team@company.com",
        subject: "Update from DatOps Agent",
        body: message,
      },
      risk: "high",
    });
  }

  if (lower.includes("trade") || lower.includes("buy") || lower.includes("sell") || lower.includes("stock")) {
    calls.push({
      tool: "execute_trade",
      args: {
        action: lower.includes("sell") ? "SELL" : "BUY",
        symbol: "AAPL",
        quantity: 100,
      },
      risk: "high",
    });
  }

  // Default: if nothing matched, try search
  if (calls.length === 0) {
    calls.push({
      tool: "search_web",
      args: { query: message },
      risk: "medium",
    });
  }

  return calls;
}

// ─── POST handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { message, trustScore } = await req.json();

  // Compute sandbox level
  const score = typeof trustScore === "number" ? trustScore : 55;
  const sandboxLevel = getSandboxLevel(score);
  const allowedRisks = SANDBOX_ALLOWED[sandboxLevel];

  // Detect which tools the message needs
  const toolCalls = detectIntent(message);

  // Execute each tool through the trust gate
  const results: ToolResult[] = toolCalls.map((call) => {
    const tool = TOOLS[call.tool];
    if (!tool) {
      return { tool: call.tool, risk: call.risk, allowed: false, blocked: { reason: "Unknown tool", trustScore: score, sandboxLevel } };
    }

    if (score < 10) {
      return {
        tool: call.tool,
        risk: call.risk,
        allowed: false,
        blocked: { reason: `Trust score ${score.toFixed(1)} is below minimum threshold (10.0)`, trustScore: score, sandboxLevel },
      };
    }

    if (call.risk === "high" && score < 70) {
      return {
        tool: call.tool,
        risk: call.risk,
        allowed: false,
        blocked: { reason: `High-risk tool requires trust >= 70, current: ${score.toFixed(1)}`, trustScore: score, sandboxLevel },
      };
    }

    if (!isAllowed(call.risk, sandboxLevel)) {
      return {
        tool: call.tool,
        risk: call.risk,
        allowed: false,
        blocked: { reason: `${sandboxLevel} sandbox does not allow ${call.risk}-risk tools`, trustScore: score, sandboxLevel },
      };
    }

    // Tool is allowed — execute it
    return {
      tool: call.tool,
      risk: call.risk,
      allowed: true,
      result: tool.execute(call.args),
    };
  });

  // Build response text
  const parts: string[] = [];
  for (const r of results) {
    if (r.allowed) {
      parts.push(r.result!);
    } else {
      parts.push(`**BLOCKED**: \`${r.tool}\` — ${r.blocked!.reason}`);
    }
  }

  return NextResponse.json({
    response: parts.join("\n\n"),
    trustScore: score,
    sandboxLevel,
    allowedRisks,
    toolResults: results,
  });
}
