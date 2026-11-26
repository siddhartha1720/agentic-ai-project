# AutoMate AI

AutoMate AI is a full-stack agentic AI automation platform built with **React + Vite + Tailwind CSS** on the frontend and **Node.js + Express + MongoDB + LangGraph + MCP** on the backend. It lets users chat with custom AI agents, generate agent configurations and multi-step workflows from natural-language prompts, connect external accounts (Gmail, Google Calendar, Instagram), and enforce human-in-the-loop approvals before side-effect actions execute.

---

## Core Features

### Implemented
- **Authentication & Session Management**: Firebase Google Sign-In exchanged for an HttpOnly JWT cookie (`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`).
- **SaaS Dashboard (`/`)**: Overview metrics, quick prompt launchers into AI Agent Generator & Workflow Studio, active agent & workflow cards, pending approval banner, and live recent workflow activity.
- **AI Agent Generator (`/agents/generate`)**: Converts a natural-language prompt (`12–2000` chars) into an editable agent configuration (`name`, `description`, `instructions`, `model`, `temperature`, `tools`) via `POST /api/agents/generate`, displays capability warnings and integration readiness, and saves via `POST /api/agents`.
- **Manual Agent Management (`/agents`, `/agents/new`)**: Create, list, search, edit, and delete AI agents (`GET/POST /api/agents`, `PUT/DELETE /api/agents/:id`).
- **Agent Chat & Interrupt Approvals (`/chat`)**: Persistent thread conversations powered by LangGraph + Groq (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`) and MCP tools, Cloudinary image upload for vision analysis and Instagram publishing, and interactive approval cards for `send_email`, `create_calendar_event`, and `publish_instagram_image`.
- **Workflow Studio (`/workflows/studio`, `/workflows/studio/:id`)**: Prompt-to-workflow generation (`POST /api/workflows/generate`), interactive SVG/HTML DAG node-and-edge visualizer (`start`, `ai_task`, `condition`, `approval`, `tool_action`, `end`), node configuration inspector, JSON preview, Save (`POST /api/workflows`), and Run (`POST /api/workflows/:id/run`).
- **Workflow Management (`/workflows`)**: List, search, inspect node graphs, and execute saved workflows with optional initial input.
- **Execution History (`/executions`)**: Inspect workflow runs across workflows (`GET /api/workflows/runs`, `GET /api/workflows/:id/runs`) including run status, timestamps, executed node timeline (`history`), step outputs, errors, and action execution status.
- **Workflow Approval Queue (`/approvals`)**: Review paused `approval_required` runs (both `approval` nodes and protected `send_email` / `create_calendar_event` tool actions) and atomically approve/reject (`POST /api/workflows/runs/:runId/resume`) with SHA-256 action integrity verification.
- **Integrations (`/integrations`)**: OAuth connection and disconnection for **Gmail**, **Google Calendar**, and **Instagram** with encrypted token storage.
- **Credits & Payments (`/pricing`)**: Credit-based usage with **Razorpay** checkout (`POST /api/payment/create`, `POST /api/payment/verify`) for Pro (`500` credits) and Team (`2,000` credits) top-ups.

### Planned / Future Features
- **Agent Export** *(UI placeholder only — marked "Soon")*
- **Advanced Testing Studio** *(UI placeholder only — marked "Soon")*

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, shadcn / Base UI, Redux Toolkit, React Router v7, Axios, Lucide Icons, Sonner |
| **Backend** | Node.js (ESM), Express 5, MongoDB & Mongoose, Zod v4, JWT + Cookie Parser |
| **AI & Agents** | LangGraph, `@langchain/groq`, `@langchain/langgraph-checkpoint-mongodb`, `@langchain/mcp-adapters`, Model Context Protocol (MCP) SDK, Google GenAI (vision) |
| **Auth & Services** | Firebase Admin & Client SDK, Google OAuth (`googleapis`), Meta/Instagram Graph API, Cloudinary (client upload), Razorpay |

---

## Project Structure

```text
agentic-ai-project/
├── backend/
│   ├── config/            # MongoDB, Firebase Admin, Google OAuth, LangGraph checkpointer, Razorpay
│   ├── constants/         # Supported models, tools, and workflow executable tool IDs
│   ├── controllers/       # Route handlers (auth, agents, chat, agentChat, integrations, payment, workflow)
│   ├── mcp/               # MCP server, client, LangGraph MCP adapter, and tools
│   ├── middleware/        # Cookie JWT auth protection (protect.js)
│   ├── models/            # Mongoose schemas (User, Agent, IntegrationConnection, Payment, Workflow, WorkflowRun)
│   ├── routes/            # Express API routers mounted under /api/*
│   ├── services/          # agentGenerator, agentGraph, chatGraph
│   ├── tests/             # Node test suites (agent generator, approval security & concurrency)
│   ├── utils/             # Token encryption and credit deduction helpers
│   ├── workflows/         # Workflow schema, generator, executor, condition evaluator, checkpointing
│   └── index.js           # Express app entry point
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── layout/    # SaaS sidebar shell (AppLayout, AppShellContext)
    │   │   ├── ui/        # Reusable UI primitives
    │   │   └── workflows/ # WorkflowGraph visualizer, RunStatusBadge, ApprovalActionDetails
    │   ├── constants/     # Frontend capability & tool definitions aligned with backend
    │   ├── features/      # Axios API modules (auth, chat, agents, workflows, integrations)
    │   ├── hooks/         # Session hydration hook (useFetchMe)
    │   ├── lib/           # Formatters and class utilities
    │   ├── pages/         # Dashboard, Home (Chat), Agents, CreateAgent, AgentGenerator,
    │   │                  # Workflows, WorkflowStudio, ExecutionHistory, Approvals,
    │   │                  # Integration, Pricing, Login
    │   └── redux/         # Redux store & auth slice
    └── vite.config.js
```

---

## Prerequisites

- **Node.js** v20+ (required for built-in `node --test` and ESM support)
- **MongoDB** instance (Atlas or local)
- API keys / credentials for the services you use (Groq, Firebase, Google OAuth, Razorpay, Cloudinary, Instagram)

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Server & CORS
PORT=8000
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>
MONGODB_DB_NAME=automate_ai

# Security & Internal MCP Auth
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_byte_encryption_key
AUTOMATE_MCP_SECRET=your_mcp_jwt_secret

# LLM & Vision
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_VISION_MODEL=gemini-2.5-flash

# Google OAuth (Gmail + Calendar)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/integrations/google/callback

# Instagram Integration (optional)
INSTAGRAM_APP_ID=your_meta_app_id
INSTAGRAM_APP_SECRET=your_meta_app_secret
INSTAGRAM_CONFIG_ID=your_instagram_config_id
INSTAGRAM_REDIRECT_URI=http://localhost:8000/api/integrations/instagram/callback
INSTAGRAM_ACCOUNT_ID=your_instagram_account_id
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_GRAPH_VERSION=v23.0

# Razorpay Payments (optional)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

> Note: Backend Firebase Admin reads credentials from `backend/serviceAccountKey.json` (configured in [backend/config/firebase.js](file:///c:/Project/agentic-ai-project/backend/config/firebase.js)). Also ensure `backend/index.js` `PORT` matches `VITE_SERVER_URL` (the frontend defaults to `http://localhost:8000`, while `backend/index.js` falls back to `5000` if `PORT` is unset).

### Frontend (`frontend/.env`)

```env
VITE_SERVER_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

---

## Getting Started

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Run in Development

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser. All frontend API requests use `withCredentials: true` for cookie-based authentication.

---

## API Reference Overview

All protected routes require a valid `token` HttpOnly cookie set by `/api/auth/login`.

| Group | Endpoints |
| --- | --- |
| **Auth** | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| **Agents** | `POST /api/agents/generate`, `POST /api/agents`, `GET /api/agents`, `GET /api/agents/:id`, `PUT /api/agents/:id`, `DELETE /api/agents/:id` |
| **Chat** | `POST /api/chat`, `POST /api/agent-chat`, `POST /api/agent-chat/approve-email` |
| **Workflows** | `POST /api/workflows/generate`, `POST /api/workflows`, `GET /api/workflows`, `GET /api/workflows/runs`, `GET /api/workflows/:id`, `POST /api/workflows/:id/run`, `GET /api/workflows/:id/runs`, `POST /api/workflows/runs/:runId/resume` |
| **Integrations** | `GET /api/integrations`, `GET /api/integrations/google/connect`, `GET /api/integrations/google/callback`, `POST /api/integrations/google/disconnect`, `GET /api/integrations/instagram/auth`, `GET /api/integrations/instagram/callback`, `GET /api/integrations/instagram/status`, `POST /api/integrations/instagram/disconnect` |
| **Payments** | `POST /api/payment/create`, `POST /api/payment/verify` |

---

## Scripts & Testing

### Backend
```bash
cd backend
npm run test:agent-generator   # Unit tests for AI agent generation (no DB required)
npm test                       # Full backend test suite (requires MONGODB_URI for checkpoint/concurrency tests)
```

### Frontend
```bash
cd frontend
npm run build                  # Production Vite build
npm run lint                   # ESLint check
```
