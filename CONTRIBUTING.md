# Contributing to Hollywood Groove App (PWA)

Before starting, skim:
- `../MASTER_ARCHITECTURE.md`
- `../TECH_STACK_DECISION.md`
- `../FIREBASE_TRIVIA_CONTRACT.md` (crowd/trivia RTDB schema)

## 5 Core Rules

### 1. Branch Naming
- Feature: `feature/issue-123-description`
- Bug fix: `bugfix/issue-123-description`
- Example: `feature/issue-4-show-listing`

### 2. Commits
- Clear, descriptive messages
- Reference issue: `feat: implement show listing (closes #4)`
- Format: `type: description`
- Types: feat, fix, docs, style, refactor, test, chore

### 3. Pull Requests
- Title references issue: `#4 - Implement show listing`
- Description explains what and why
- All CI checks must pass
- At least 1 approval required

### 4. C# Code Style
The app is a **React + TypeScript PWA** (not .NET MAUI).

- TypeScript strict mode (when scaffold exists)
- ESLint + Prettier for formatting/linting
- Prefer functional components and hooks
- Keep API + Firebase access behind a small `services/` layer
- Keep shared types in `src/types/` and align with `FIREBASE_TRIVIA_CONTRACT.md`

### 5. Testing
- Unit tests: Vitest
- Component tests: React Testing Library
- Keep Firebase reads/writes mocked in unit tests
- Smoke test in mobile Safari/Chrome before merging (PWA install + offline)

## Getting Started

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request
