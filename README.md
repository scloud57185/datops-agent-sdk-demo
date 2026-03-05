# DatOps Agent SDK — Interactive Demo

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/scloud57185/datops-agent-sdk-demo)

**Trust-gated AI agent tool execution in the browser.** No API keys needed.

This is a Next.js demo showing how the [DatOps Agent SDK](https://www.npmjs.com/package/@datplatform/agent-sdk) enforces trust-based access control on AI agent tools.

## What It Shows

Drag the **trust slider** to see tools get blocked in real-time:

| Trust Level | Sandbox | Tools Allowed |
|-------------|---------|---------------|
| 0–29 | STRICT | Low risk only (read files) |
| 30–69 | ADAPTIVE | Low + medium (read files, search web) |
| 70–100 | OPEN | All tools (including email, trades) |

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

The demo simulates the DatOps trust gate without needing real API keys:

1. **Client** sends a message + current trust score to `/api/chat`
2. **Server** detects which tools are needed (keyword matching)
3. **Trust gate** checks each tool's risk level against the sandbox rules
4. **Result** shows which tools were allowed/blocked and why

In production, replace the demo logic with the real SDK:

```typescript
import { DatOps } from '@datplatform/agent-sdk';

const tools = DatOps.wrapVercelTools(myTools, {
  apiKey: 'dat_xxx',
  toolRiskLevels: {
    read_file: 'low',
    search_web: 'medium',
    send_email: 'high',
  }
});
```

## Stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [DatOps Agent SDK](https://www.npmjs.com/package/@datplatform/agent-sdk)
- No database, no LLM API keys required

## Links

- [npm: @datplatform/agent-sdk](https://www.npmjs.com/package/@datplatform/agent-sdk)
- [PyPI: datops-agent-sdk](https://pypi.org/project/datops-agent-sdk/)
- [DatOps Platform](https://www.datops.ai)
