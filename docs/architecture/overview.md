# Architecture Overview

Ballast uses a simple monorepo so one developer can work across mobile, web, backend, and shared packages without coordinating multiple repositories.

## Main Pieces

- Mobile app: Expo React Native for iOS and Android.
- Web app: Next.js on Vercel for landing pages, legal pages, and dashboard.
- Backend: FastAPI on Railway for API, auth verification, AI calls, exports, and voice upload handling.
- Database: PostgreSQL with pgvector on Railway.
- Auth: Clerk, so Ballast does not store passwords.
- AI: OpenAI first, Anthropic optional through the provider layer.

## Tradeoffs

This avoids Kubernetes, queues, and microservices for the MVP. The tradeoff is that long-running jobs such as exports and weekly insight generation may need a queue later. For the first version, simple API endpoints plus scheduled jobs are easier to ship and debug.
