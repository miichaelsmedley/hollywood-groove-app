# Hollywood Groove — Signup Screen Design

**Created:** 2025-12-21
**Status:** ✅ Complete
**Component:** PWA Signup Flow

---

## Overview

The signup screen has been redesigned with a cinematic Hollywood Groove theme featuring:

- **Simplified flow:** Nickname-only entry (progressive profiling for future)
- **Cinematic design:** Dark theme with amber/gold accents
- **Brand-focused:** Logo-first experience with clear hierarchy
- **Mobile-first:** Optimized for phone use (primary use case)
- **Visual effects:** Subtle glows, animations, and depth

---

## Design System Applied

### Colors

```css
Cinema Dark:
- Background: #0B0B0D (deep black)
- Surface: #1C1C1E (card backgrounds)
- Elevated: #2C2C2E (hover states)
- Border: #3A3A3C (subtle dividers)
- Text: #F2F2F7 (near white)
- Muted: #8E8E93 (secondary text)

Primary (Hollywood Gold):
- Default: #F59E0B
- Hover: #D97706
- Glow: rgba(245, 158, 11, 0.3)

Accent Colors:
- Success: #30D158
- Error: #FF453A
- Info: #64D2FF
```

### Typography

```css
Font Families:
- Display: 'SF Pro Display', system-ui
- Body: system-ui, -apple-system
- Mono: 'SF Mono', Monaco, Consolas

Sizes:
- Hero: 3.5rem (56px) — Logo text
- Display: 2.5rem (40px) — Large headings
- H2: 1.5rem (24px) — Form titles
- Body: 1rem (16px) — Form fields
- Small: 0.75rem (12px) — Helper text
```

### Components

**Card (.card-cinema):**
- Background: cinema-50 (#1C1C1E)
- Border: cinema-200 (#3A3A3C)
- Border radius: 1rem (16px)
- Shadow: cinema (0 10px 40px rgba(0,0,0,0.5))
- Backdrop blur: 10px

**Button (.btn-primary):**
- Background: primary (#F59E0B)
- Text: cinema (dark)
- Padding: 0.75rem 1.5rem
- Border radius: 0.75rem
- Hover: Glow shadow effect
- Active: Scale down to 95%

**Input (.input-cinema):**
- Background: cinema (#0B0B0D)
- Border: 2px solid cinema-200
- Border radius: 0.75rem
- Focus: primary border + ring
- Padding: 1rem 1rem 1rem 3rem (icon space)

---

## User Flow

### Step 1: Initial Screen

```
┌──────────────────────────────────────┐
│                                      │
│          HOLLYWOOD                   │  ← Logo (glowing gold)
│          GROOVE                      │
│          ─────────                   │
│                                      │
│  ┌────────────────────────────────┐ │
│  │    [Music Icon]                │ │
│  │    Footloose — Trivia Live     │ │  ← Show info card
│  │    The Grand, Melbourne        │ │
│  │    Experience live DJ events...│ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ What should we call you?       │ │
│  │                                │ │
│  │ Nickname                       │ │
│  │ ┌──────────────────────────┐  │ │  ← Nickname input
│  │ │ 👤 Enter your nickname   │  │ │
│  │ └──────────────────────────┘  │ │
│  │ This will appear on leaderboard │ │
│  │                                │ │
│  │ ┌──────────────────────────┐  │ │
│  │ │     Continue      ➜      │  │ │  ← Primary button
│  │ └──────────────────────────┘  │ │
│  │                                │ │
│  │ By joining, you agree to...   │ │
│  └────────────────────────────────┘ │
│                                      │
│  Join the crowd. Win prizes.        │
│                                      │
└──────────────────────────────────────┘
```

### Step 2: Contact Details (Future)

After an hour, or on next visit, ask for email/phone. This step is built but not currently active in the flow.

---

## Technical Implementation

### Files Modified

1. **tailwind.config.js**
   - Added cinema color palette
   - Added accent colors for engagement
   - Added tier colors (for loyalty system)
   - Custom animations (fade-in, slide-up, glow-pulse)
   - Custom shadows (glow, cinema)

2. **src/index.css**
   - Added CSS custom properties
   - Custom scrollbar styling
   - Component utility classes (logo-text, card-cinema, btn-primary)
   - Webkit text stroke for outline effect

3. **src/pages/JoinShow.tsx**
   - Simplified to nickname-only entry
   - Added cinematic background effects (subtle gradient orbs)
   - Hollywood Groove logo with text glow
   - Show info card with icon
   - Progressive profiling ready (step state variable)
   - Enhanced loading and error states

---

## Activation Steps

### 1. Install Dependencies (if needed)

```bash
cd hollywood-groove-app
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The app will start at `http://localhost:5173`

### 3. Test the Signup Flow

**Option A: Direct URL**
Navigate to: `http://localhost:5173/shows/101/join`
(Replace `101` with any show ID)

**Option B: Via QR Code Flow**
1. Go to `http://localhost:5173/app?show=101`
2. App will redirect to join page if not registered

### 4. Test Scenarios

**Scenario 1: New User**
1. Navigate to `/shows/101/join`
2. See logo, show info, and nickname form
3. Enter nickname (e.g., "RockFan42")
4. Click "Continue"
5. Should register user and redirect to show detail

**Scenario 2: Returning User**
1. Navigate to `/shows/101/join` again
2. Should auto-redirect to show detail (already registered)

**Scenario 3: Loading State**
1. Slow down network in DevTools
2. Navigate to `/shows/101/join`
3. See animated loading spinner with sparkle icon

**Scenario 4: Invalid Show**
1. Navigate to `/shows/999/join` (non-existent)
2. See "Show Not Found" error state

### 5. Mobile Testing

**iOS Safari Simulator:**
```bash
# Open in iOS Simulator
xcrun simctl openurl booted "http://localhost:5173/shows/101/join"
```

**Chrome DevTools:**
1. Open DevTools (F12)
2. Click device toolbar (Ctrl+Shift+M)
3. Select iPhone 12 Pro / Pixel 5
4. Test touch interactions

**Responsive Breakpoints:**
- Mobile: 375px - 428px (primary target)
- Tablet: 768px - 1024px
- Desktop: 1280px+

---

## Design Checklist

- ✅ Logo with cinematic styling
- ✅ Dark theme with cinema color palette
- ✅ Primary amber/gold branding
- ✅ Simplified nickname-only flow
- ✅ Progressive profiling ready (contact step)
- ✅ Loading state with animation
- ✅ Error state (show not found)
- ✅ Mobile-first responsive design
- ✅ Accessible form labels
- ✅ Focus states on inputs
- ✅ Disabled state on button
- ✅ Subtle background effects
- ✅ Custom scrollbar
- ✅ Smooth transitions
- ✅ Glow effects on primary elements

---

## Next Steps

1. **Add Logo Asset:**
   - Create SVG or PNG logo in `public/` folder
   - Replace text logo with image component
   - Add marquee light bulb effect to logo outline

2. **Progressive Profiling:**
   - After 1 hour in show, trigger step 2 (contact details)
   - Store completion timestamp in localStorage
   - Show modal overlay: "Help us stay connected"

3. **Animations:**
   - Add confetti effect on successful signup
   - Particle effects on button hover
   - Slide-in transitions between steps

4. **Accessibility:**
   - Test with VoiceOver/TalkBack
   - Add aria-labels to all inputs
   - Keyboard navigation flow

5. **Testing:**
   - Unit tests for form validation
   - Integration tests for Firebase registration
   - Visual regression tests for design

---

## Design References

**Inspiration:**
- Apple Music signup flow (progressive, minimal)
- Netflix onboarding (cinematic dark theme)
- Spotify (glowing brand colors)
- Cinema marquee lights (logo outline effect)

**Files to Review:**
- `/MASTER_ARCHITECTURE.md` — Overall system
- `/UI_UX_DESIGN.md` — Controller UI specs
- `/ENGAGEMENT_SYSTEM.md` — Loyalty tiers

---

**Questions?**
See MASTER_ARCHITECTURE.md for overall system design or CLAUDE.md for project context.
