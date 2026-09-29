# RecoverOS - Local Setup & Developer Guide

## Prerequisites
*   Node.js v20+ or v22+
*   npm v10+

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Set GEMINI_API_KEY in .env

# 3. Run automated tests
npm test

# 4. Start local development server
npm run dev
# App will launch on http://localhost:3000
```

## Available Scripts

*   `npm run dev`: Starts the Vite development server on port 3000.
*   `npm test`: Executes the automated test suite (Calculations, Isolation, RBAC, Benchmark).
*   `npm run build`: Compiles production TypeScript bundle into `/dist`.
*   `npm run lint`: Verifies static types and linting integrity.
