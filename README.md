# Hollywood Groove App (PWA)

Progressive Web App (React + TypeScript) for Hollywood Groove attendees.

## Status

Vite + React + TypeScript scaffold is in place. Next step is to implement crowd engagement features.

## Overview

The PWA is the attendee-facing app:
- Browse upcoming shows + venues (WordPress REST API)
- Join live trivia and crowd activities (Firebase Realtime Database)
- **Claim dancing points** (big button, median-based scoring)
- **Sign up for karaoke and stage participation** (fair queue system)
- **View and claim promotional offers**
- **Track loyalty status** (star tier, progress, season badges)
- Works on iOS Safari, Android Chrome, and desktop browsers (no app store)

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** TailwindCSS
- **Backend:** Firebase Web SDK (Realtime Database + Auth)
- **Offline:** Service Worker + IndexedDB (as needed)
- **Deployment:** Vercel, Netlify, or Azure Static Web Apps

## Local Development

Requirements:
- Node.js 18+ (20+ preferred)
- npm

```bash
npm install
npm run dev
```

## Firebase Setup (PWA)

1. Install dependencies (includes `firebase`):
   ```bash
   npm install
   ```
2. Firebase client setup lives at `src/lib/firebase.ts` (Realtime Database + Auth).
3. Test-mode path prefix:
   - In dev (`npm run dev`), the app defaults to `test/` to match the controller’s Test Mode.
   - Override via `VITE_RTDB_PREFIX` (example: `VITE_RTDB_PREFIX=` for production paths).
4. Dev test view renders live RTDB data for show `101` (prefixed by `VITE_RTDB_PREFIX` when set; default is `test/` in dev):
   - `test/shows/101/meta`
   - `test/shows/101/live/trivia`

## Features

### Crowd Engagement (Per-Show)

| Feature | Description |
|---------|-------------|
| **Trivia** | Answer questions, earn points (base + speed bonus + streak multiplier) |
| **Dancing** | Tap button to claim dance points (median of current scores, floor 50, cap 200) |
| **Sign-ups** | Join karaoke, stage participation queues |
| **Contests** | Enter costume contests, competitions |
| **Voting** | Vote in polls and competitions |
| **Leaderboard** | View live rankings with star tier badges |

### Loyalty Features (Persistent)

| Feature | Description |
|---------|-------------|
| **Star Tier Display** | Show current tier (Extra → Legend) with progress bar |
| **Starting Bonus** | Display bonus points applied at show start |
| **Season Badges** | View collected badges (Summer '24 Lead, etc.) |
| **All-Time Leaderboard** | Cross-show member rankings |
| **Show History** | Past attendance with points and stars earned |

### Promotional Offers

| Feature | Description |
|---------|-------------|
| **View Offers** | Browse active promotions for current show |
| **Claim Offers** | Tap to claim in-app offers (tracked) |
| **Show at Bar** | Display claimed offer to bartender |
| **Claim History** | View past claimed offers |

## Firebase Data Contract

Realtime Database schema and controller-driven responsibilities live in `../FIREBASE_TRIVIA_CONTRACT.md`.

### Key Paths (PWA Reads)

```
/shows/{showId}/meta              # Show info
/shows/{showId}/activities/       # Activity definitions
/shows/{showId}/live/trivia       # Current trivia state
/shows/{showId}/live/activity     # Current activity state
/shows/{showId}/leaderboard       # Top list
/shows/{showId}/offers/           # Promotional offers
/members/{odience}/               # Own member profile
/members/{odience}/stars/         # Star tier + breakdown
/members/{odience}/seasons/       # Season badge history
```

### Key Paths (PWA Writes)

```
/shows/{showId}/responses/{activityId}/{odience}/  # Trivia answers, dance claims
/shows/{showId}/offer_claims/{odience}/{offerId}/  # Offer claims
```

## UI Components (Planned)

### Show Screen
- Show details (venue, time, theme)
- Ticket purchase link
- Join button (starts participation)

### Live Participation Screen
- Current activity display (trivia question, dancing CTA)
- Answer buttons / dance claim button
- Live leaderboard (sidebar or collapsible)
- Offer banner (tap to view)

### Dancing Button
- **Always visible** during show (prominent, large)
- Shows current median value (e.g., "Claim 125 pts")
- Disabled during cooldown (shows timer)
- Animation on successful claim

### Member Profile Screen
- Star tier badge (visual)
- Progress bar to next tier
- Stars breakdown (how earned)
- Season badge collection
- All-time stats

### Leaderboard Screen
- Per-show leaderboard (live during show)
- All-time leaderboard (persistent)
- Tier badges next to names (⭐ = tier level)
- Highlight own position

### Offers Screen
- Grid of available offers
- Claim button (if claimable)
- "Show to bartender" display mode
- Claimed badge on used offers

## Scoring Reference

> Full details: `../ENGAGEMENT_SYSTEM.md`

### Per-Show Points

| Source | Calculation |
|--------|-------------|
| Trivia | `(base + speed_bonus) × streak_multiplier` |
| Dancing | `median(all_scores)` clamped to 50-200 |
| Participation | Fixed points (DJ-configured) |
| Starting Bonus | 0/10/25/50/75/100 based on tier |

### Star Tiers

| Tier | Stars | Starting Bonus |
|------|-------|----------------|
| Extra | 0-2 | +0 pts |
| Supporting Role | 3-7 | +10 pts |
| Featured | 8-15 | +25 pts |
| Lead | 16-30 | +50 pts |
| Director | 31-50 | +75 pts |
| Legend | 51+ | +100 pts |

## Project Structure (Planned)

```
src/
├── components/
│   ├── common/           # Buttons, inputs, cards
│   ├── trivia/           # TriviaQuestion, TriviaOptions, Timer
│   ├── dancing/          # DanceButton, MedianDisplay
│   ├── leaderboard/      # LeaderboardList, LeaderboardEntry, TierBadge
│   ├── offers/           # OfferCard, OfferClaim, ShowAtBar
│   └── profile/          # TierProgress, SeasonBadges, StarBreakdown
├── pages/
│   ├── Home.tsx          # Show listing
│   ├── Show.tsx          # Show details + join
│   ├── Live.tsx          # Live participation
│   ├── Leaderboard.tsx   # Rankings
│   ├── Offers.tsx        # Current offers
│   └── Profile.tsx       # Member profile
├── hooks/
│   ├── useFirebase.ts    # Firebase connection
│   ├── useShow.ts        # Current show state
│   ├── useLeaderboard.ts # Live leaderboard
│   ├── useMember.ts      # Member profile + stars
│   └── useOffers.ts      # Offer state
├── lib/
│   ├── firebase.ts       # Firebase config
│   └── api.ts            # WordPress API client
└── types/
    └── index.ts          # TypeScript interfaces
```

## Learn More

- [System Architecture](../MASTER_ARCHITECTURE.md)
- [Engagement System](../ENGAGEMENT_SYSTEM.md) — Scoring, tiers, loyalty
- [Firebase Contract](../FIREBASE_TRIVIA_CONTRACT.md) — RTDB schema
- [UI/UX Design](../UI_UX_DESIGN.md) — Visual design guidelines
- [Tech Stack Decisions](../TECH_STACK_DECISION.md)

## License

MIT License - see [LICENSE](LICENSE)
