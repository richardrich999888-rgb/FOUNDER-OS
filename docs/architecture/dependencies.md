# Dependency Choices

## Expo

Expo reduces native setup work and gives a clean path to App Store and Play Store builds through EAS.

## Next.js

Next.js works directly with Vercel and can host the landing site, legal pages, and a founder dashboard.

## FastAPI

FastAPI is lightweight, typed, and easy to deploy on Railway. It is a good fit for an MVP API.

## PostgreSQL and pgvector

PostgreSQL stores product data. pgvector stores embeddings for semantic memory search without adding a second database.

## Clerk

Clerk provides email, Google, and Apple login without custom password handling.

## OpenAI and Anthropic

OpenAI is the first AI provider. Anthropic is optional behind the same provider interface so model choice can change later.

## Zustand and React Query

Zustand handles small local UI state. React Query handles server state, caching, retries, and loading states.
