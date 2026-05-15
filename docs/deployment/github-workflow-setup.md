# GitHub Workflow Setup

GitHub is the source of truth for code and deployment automation.

## Repository Permissions

Use GitHub with:

- protected `main` branch
- pull requests before production changes
- required CI checks once workflow push permission is fixed

## Token Scope Issue

GitHub rejected `.github/workflows/ci.yml` because the current token does not have `workflow` scope.

Fix:

1. Create a new GitHub Personal Access Token.
2. Enable scopes:
   - `repo`
   - `workflow`
3. Update local Git authentication.
4. Add and push `.github/workflows/ci.yml`.

Command after token fix:

```bash
git add .github/workflows/ci.yml
git commit -m "Add CI workflow"
git push origin main
```

## Branch Protection

After CI is pushed:

1. Go to GitHub repo settings.
2. Open **Branches**.
3. Add protection for `main`.
4. Require pull request before merging.
5. Require status checks.
6. Include administrators only if you want stricter discipline.

## Deployment Automation

- Vercel watches GitHub and deploys web changes.
- Railway watches GitHub and deploys backend changes.
- Expo builds are manually triggered for alpha.

Do not auto-submit mobile builds during alpha.
