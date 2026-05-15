# Contributing

Keep changes small, clear, and easy to deploy.

## Branches

Use descriptive branches:

- `feature/reflection-create`
- `fix/clerk-token-verification`
- `docs/deployment-guide`

## Checks

Before opening a pull request:

```bash
pnpm format:check
pnpm typecheck
cd apps/backend && ruff check app alembic
```

## Privacy Rule

Do not log reflection text, transcripts, AI prompts containing personal content, auth tokens, cookies, or export URLs.
