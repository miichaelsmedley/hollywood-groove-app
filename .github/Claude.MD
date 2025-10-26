# Hollywood Groove - PWA Customer App

**Project Context Document for AI Assistants (Claude, ChatGPT, Gemini)**

Last Updated: October 26, 2025  
Owner: Michael Smedley  
Location: Melbourne, Australia (timezone: Australia/Melbourne)

---

## 🎯 Project Overview

**Hollywood Groove** is a film + live music event series in Melbourne where audiences watch iconic films with live band performances. This PWA (Progressive Web App) is the **customer-facing application** for attendees at venues.

### Core Purpose
Enable punters at venues to:
1. Sign up in 10-15 seconds (frictionless, they're drinking and having fun)
2. Play a film trivia quiz during the show
3. Win prizes based on quiz performance
4. Build attendance history across multiple shows
5. Get recognized as returning customers

### Business Goals
- **Capture customer data** (email, phone, name) for marketing
- **Build a centralized customer database** across all shows/venues
- **Drive engagement** via gamification (quiz, prizes, leaderboards)
- **Enable marketing automation** (email/SMS campaigns post-show)
- **Provide analytics** to venues on attendance and engagement

---

## 🏗️ Architecture Decision: PWA + Firebase

### Why PWA (Not Native App)
✅ **Zero friction** - QR code → opens instantly in browser  
✅ **No app store** - no $99/year fees, no approval delays  
✅ **Works on all phones** - iPhone + Android with one codebase  
✅ **Instant updates** - change quiz questions, deploy immediately  
✅ **Can still "install"** - add to home screen, works offline, push notifications  

### Why Firebase Backend
✅ **Real-time database** (Firestore) - live quiz updates  
✅ **Authentication built-in** - phone/Google/email sign-in  
✅ **Hosting included** - deploy PWA directly  
✅ **Generous free tier** - 50k reads/day, 20k writes/day free  
✅ **Scales automatically** - handles viral growth  
✅ **Cloud functions** - serverless automation (email triggers, etc.)  

### The Stack
```
┌─────────────────────────────────────┐
│   PWA (Progressive Web App)         │
│   - HTML/CSS/JavaScript             │
│   - React/Vue (framework TBD)       │
│   - Firebase Web SDK                │
│   - Hosted: Firebase Hosting        │
│   - URL: app.hollywoodgroove.com.au│
└──────────────┬──────────────────────┘
               │
               │ Firebase Web SDK (JavaScript)
               │
┌──────────────▼──────────────────────┐
│   FIREBASE (Cloud Backend)          │
│   - Firestore (NoSQL Database)      │
│   - Authentication (Phone/Google)   │
│   - Cloud Functions (Automation)    │
│   - Hosting (Static files)          │
│   - Storage (Images/videos)         │
└─────────────────────────────────────┘
```

---

## 📊 Firebase Database Schema

### Collections Structure

#### 1. `users/{userId}`
```javascript
{
  email: "john@example.com",           // string
  name: "John Smith",                  // string
  phone: "+61412345678",               // string (optional)
  source: "app",                       // "app" | "web" | "social"
  createdAt: Timestamp,                // when they first signed up
  lastLoginAt: Timestamp,              // last activity
  preferences: {                       // map
    notifications: true,
    favoriteGenres: ["action", "thriller"]
  },
  
  // SUBCOLLECTION
  attendances: {                       // subcollection
    {attendanceId}: {
      showId: ref("/shows/abc123"),    // reference
      attendedAt: Timestamp,
      quizScore: 85,                   // number (0-100)
      won: true,                       // boolean
      prizeCollected: false            // boolean
    }
  }
}
```

**Why subcollection for attendances?**  
Easier to query "all shows this user attended" and keeps user document size manageable.

#### 2. `shows/{showId}`
```javascript
{
  name: "Pulp Fiction",                // string
  date: Timestamp,                     // show date/time
  venueId: ref("/venues/xyz789"),      // reference
  venueName: "The Tote Hotel",         // string (denormalized for display)
  doors: Timestamp,                    // doors open time
  capacity: 300,                       // number
  ticketUrl: "https://...",            // string
  priceFrom: 35,                       // number (AUD)
  ageRestriction: "18+",               // string
  theme: "90s Crime",                  // string
  status: "upcoming",                  // "upcoming" | "live" | "completed" | "cancelled"
  
  quizQuestions: [                     // array of objects
    {
      question: "What's in the briefcase?",
      options: ["Gold", "Money", "Diamonds", "We never find out"],
      correctAnswer: 3,                // index (0-based)
      points: 10
    },
    // ... more questions
  ],
  
  totalAttendees: 0,                   // number (updated as people check in)
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Why store quiz questions IN the show?**  
Simpler - one read gets everything. Alternative would be separate `quizzes/{showId}` collection.

#### 3. `venues/{venueId}`
```javascript
{
  name: "The Tote Hotel",
  address: "71 Johnston St",
  city: "Collingwood",
  state: "VIC",
  postcode: "3066",
  capacity: 300,
  mapsUrl: "https://maps.google.com/...",
  contactEmail: "bookings@thetote.com.au",
  contactPhone: "+61394191320",
  geo: GeoPoint(lat, lng),             // optional, for proximity search
  images: ["url1", "url2"],            // array of strings
  createdAt: Timestamp
}
```

#### 4. `recaps/{recapId}` (Post-event content)
```javascript
{
  showId: ref("/shows/abc123"),
  showName: "Pulp Fiction",            // denormalized
  date: Timestamp,
  highlights: [                        // array of strings
    "Record turnout of 280 people!",
    "Winner scored perfect 100%"
  ],
  winners: [                           // array of objects
    {
      userId: ref("/users/user123"),
      name: "Sarah J.",
      prize: "VIP tickets to next show"
    }
  ],
  gallery: ["image_url1", "image_url2"], // array of image URLs
  playlist: "https://open.spotify.com/...", // Spotify playlist URL
  videoUrl: "https://youtube.com/...",      // optional recap video
  attendeeCount: 280,
  published: true,                     // boolean (show on website)
  createdAt: Timestamp
}
```

#### 5. `admins/{userId}` (Access control)
```javascript
{
  email: "michael@ssw.com.au",
  role: "superadmin",                  // "superadmin" | "venue_manager" | "editor"
  venueIds: [],                        // array (if venue_manager, which venues)
  createdAt: Timestamp
}
```

#### 6. `config/app` (System settings)
```javascript
{
  maintenanceMode: false,
  currentActiveShow: ref("/shows/abc123"), // featured "happening now"
  featuredShows: [                         // array of references
    ref("/shows/xyz789"),
    ref("/shows/def456")
  ],
  socialMedia: {
    instagram: "@hollywoodgroove",
    facebook: "hollywoodgroovemelb",
    tiktok: "@hollywoodgroove"
  },
  branding: {
    primaryColor: "#FF6B35",
    logoUrl: "https://..."
  }
}
```

### Data Relationships
- **Users** → **Attendances** (subcollection) → **Shows** (reference)
- **Shows** → **Venues** (reference)
- **Recaps** → **Shows** (reference) → **Winners** (user references)

---

## 🔐 Authentication Strategy

### Two User Types

#### 1. **Punters (Customers)** - Ultra-Frictionless
**Goal:** 10-15 second sign-up at venue (they're drinking, having fun)

**Enabled Methods:**
- ✅ **Phone (SMS)** - RECOMMENDED PRIMARY
  - Tap "Continue with Phone"
  - Enter mobile number
  - Get SMS code, enter it
  - Done
  - ⚠️ Requires Firebase Blaze plan (pay-as-you-go, ~$0.006/verification)
  
- ✅ **Google Sign-In** - ONE TAP
  - Best for Android users
  - Most iPhone users have Google too
  - Zero typing required
  
- ✅ **Email Link (Magic Link)** - FALLBACK
  - Enter email
  - Get link, click it
  - Auto-logged in (no password)

**Avoid:**
- ❌ Email + Password (too complex, forgotten passwords)
- ❌ Facebook (declining popularity, privacy concerns)

#### 2. **Admins** (You, Venue Managers) - Secure
**Goal:** Secure access to manage shows, view analytics

**Method:**
- Email + Password (strong passwords required)
- Access via admin panel (separate from main app)
- Maybe 2FA for superadmins later

### User Flow Examples

**First-time punter at venue:**
```
1. Scan QR code on table/wall
2. Opens: app.hollywoodgroove.com.au
3. See: "Sign up in 10 seconds"
4. Choose: [📱 Continue with Phone] or [🔐 Continue with Google]
5. Phone: Enter number → Get code → Enter code → Done
6. OR Google: One tap → Done
7. Redirected to: Quiz screen
```

**Returning punter at next show:**
```
1. Scan QR code (same URL)
2. App opens
3. Automatically logged in (recognizes them)
4. See: "Welcome back, Sarah! You won at Pulp Fiction! 🎉"
5. Straight to: New quiz for tonight's show
```

---

## 📧 Marketing & Customer Database Strategy

### Centralized Customer Data Platform (CDP) Approach

**Decision:** Database lives in **centralized Firebase backend** (NOT in WordPress, NOT distributed)

### Why Centralized?
✅ **360-degree customer view** across all shows/venues  
✅ **No data silos** - one source of truth  
✅ **Cross-channel tracking** - web, app, social all feed same DB  
✅ **Marketing automation** - trigger emails based on behavior  
✅ **GDPR compliance** - easier to manage consent & data requests  

### Data Capture Points

#### 1. **At Venue (PWA)**
- QR code scan → Opens PWA
- Sign-up form (phone/Google)
- Quiz completion (proves engagement)
- Prize win status

#### 2. **On Website**
- Newsletter signup (homepage popup)
- "Get early access" lead magnet
- Show registration forms
- Blog content (requires email to access recaps)

#### 3. **Social Media**
- Instagram/Facebook followers (via APIs)
- Tagged posts & mentions (social listening)
- Contest entries
- Story interactions

### Marketing Automation Workflows

**Trigger-based campaigns:**

1. **Welcome Series**
   - New subscriber → Email 1: Welcome + what is Hollywood Groove
   - +2 days → Email 2: How the quiz works + prizes
   - +5 days → Email 3: Next show announcement + ticket link

2. **Post-Show**
   - Attended show → Thank you email
   - Include: Gallery, winners, Spotify playlist
   - CTA: Register for next show

3. **Win-Back**
   - No show attendance for 3 months → "We miss you" email
   - Special offer: 20% off next ticket

4. **Birthday/Anniversary**
   - User's birthday → VIP offer or free drink voucher

5. **Cart Abandonment** (if ticket purchases in app)
   - Started checkout, didn't complete → Reminder email

### Social Media Integration

**Hashtag Strategy:**
- Primary: `#HollywoodGrooveMelb`
- Show-specific: `#HGPulpFiction`, `#HGTopGun`
- Place around venue, on marketing, in app

**Tag Capture:**
- Social listening tools (Hootsuite, Sprout Social)
- Monitor venue location tags
- Instagram/Facebook APIs to import engaged users
- With consent, add to database

**Venue Activation:**
- QR codes everywhere (tables, walls, bathrooms)
- Live social wall projected on screen (encourages tagging)
- Photo booth/backdrop → "Tag us for a chance to win!"

### Tools Integration (Recommended Start)

**Phase 1: MVP**
- Firebase (backend database)
- Mailchimp or Brevo (email marketing, $0-25/month)
- Buffer or Later (social scheduling, $15-30/month)
- Built-in Firebase Analytics (free)

**Phase 2: Growth**
- CleverTap or OneSignal (mobile marketing automation)
- HubSpot CRM (free tier, paid for advanced automation)
- Zapier (connect Firebase → Mailchimp → etc)

---

## 🚀 Current Status

### ✅ Completed
- Firebase project created: `hollywood-groove`
- Authentication methods enabled:
  - Email/Password ✓
  - Email link (passwordless) ✓
  - Phone (SMS) ✓
  - Google (ready to configure)
- Web app registered in Firebase
- Firebase config keys obtained (stored in `Firebase-config.txt`)

### 🔄 In Progress
- Setting up Firestore database
- Writing documentation (claude.md, schema, issues)

### ⏳ Next Steps
1. Create Firestore collections (users, shows, venues, recaps, admins, config)
2. Set up security rules
3. Build PWA frontend (HTML/CSS/JS + Firebase SDK)
4. Implement authentication flows
5. Build quiz interface
6. Deploy to Firebase Hosting
7. Test at first show

---

## 🗂️ Repository Structure

```
/hollywood-groove-app/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── user_story.md
│   └── workflows/
│       └── ci.yml
├── public/                     # PWA static files
│   ├── index.html             # Landing/sign-up page
│   ├── app.html               # Main quiz interface
│   ├── manifest.json          # PWA configuration
│   ├── service-worker.js      # Offline support
│   └── assets/
│       ├── images/
│       └── icons/
├── src/                       # Source code (if using build tool)
│   ├── firebase-config.js     # Firebase initialization
│   ├── auth.js                # Authentication logic
│   ├── quiz.js                # Quiz functionality
│   ├── api.js                 # Firestore queries
│   └── utils.js               # Helper functions
├── docs/                      # Documentation
│   ├── FIREBASE_SCHEMA.md     # Database design
│   ├── ARCHITECTURE.md        # System design
│   ├── API_SPEC.md           # API contracts
│   └── SECURITY_RULES.md     # Firestore rules
├── Firebase-config.txt        # Firebase config keys
├── claude.md                  # THIS FILE - AI context
├── README.md                  # Project README
└── package.json               # Dependencies (if using npm)
```

---

## 🛠️ Development Workflow

### Working with Multiple AI Assistants
This project uses Claude, ChatGPT, and Gemini for code generation.

**Context Management:**
- **This file (claude.md)** provides full context to any AI
- **Start new chats** with: "Read claude.md first, then help me with [task]"
- **GitHub Issues** are pre-written as user stories
- **Keep context constrained** - each AI works on isolated features

**Git Workflow:**
```bash
# Feature branch for each issue
git checkout -b feature/auth-implementation
# Work on feature
git add .
git commit -m "feat: implement phone authentication"
git push origin feature/auth-implementation
# Create PR, merge to main
```

---

## 🎨 PWA Design Principles

### Mobile-First
- Designed for phone screens (350-430px width)
- Large tap targets (min 44x44px)
- Easy one-handed use
- Fast loading (<2s on 3G)

### Hollywood Groove Brand
- **Colors:** TBD (vibrant, film-inspired)
- **Typography:** Bold, readable, modern
- **Imagery:** Film stills, live band photos, venue shots
- **Tone:** Fun, energetic, inclusive

### Key Screens
1. **Landing/Sign-up** - 10-second conversion
2. **Quiz** - Engaging, real-time, competitive
3. **Leaderboard** - Social proof, FOMO
4. **Profile** - Show history, prizes won
5. **Next Show** - CTA to register/buy tickets

---

## 📋 Key User Journeys

### Journey 1: First-time Punter
```
At venue → Scan QR → Sign up (10s) → Play quiz → See score → 
Check leaderboard → Winner announced → Collect prize
```

### Journey 2: Returning Punter
```
At venue → Scan QR → Recognized → "Welcome back!" → 
See past wins → Play new quiz → Compare to previous scores
```

### Journey 3: Venue Manager
```
Admin panel → View tonight's show → See live attendance → 
Check quiz engagement → See leaderboard → Announce winner
```

---

## 🔒 Security & Privacy

### GDPR Compliance
- Clear consent checkboxes on sign-up
- Privacy policy linked prominently
- Easy unsubscribe from emails
- Data export available (user can download their data)
- Data deletion on request
- Store consent timestamp and source

### Firebase Security Rules
- **Users:** Can read own data, admins can write
- **Shows:** Publicly readable, admin writable
- **Venues:** Publicly readable, admin writable
- **Recaps:** Publicly readable (if published), admin writable
- **Admins:** Only superadmin can read/write

---

## 📈 Success Metrics

### Primary KPIs
- **Sign-up rate** at venues (target: 60% of attendees)
- **Quiz completion rate** (target: 80% of sign-ups)
- **Return customer rate** (target: 30% attend 2+ shows)
- **Email engagement** (open rate target: 35%, click rate: 10%)

### Secondary Metrics
- Average quiz score
- Social media mentions/tags per show
- Time to sign-up (target: <15 seconds)
- PWA install rate
- Show attendance growth (month-over-month)

---

## 🚨 Critical Decisions & Rationale

### 1. PWA instead of Native App
**Rationale:** Zero friction at point of engagement (venue) is more important than native app polish. Can always build native later if needed.

### 2. Firebase over Custom Backend
**Rationale:** Speed to market, built-in scaling, generous free tier, real-time capabilities for quiz. Can migrate later if needed.

### 3. Phone Auth as Primary
**Rationale:** Universal (everyone has a phone), captures SMS channel for marketing, no dependency on social accounts.

### 4. Quiz Questions in Show Document
**Rationale:** Simpler architecture, one read operation, questions don't change after show starts. Separate collection would add complexity for minimal benefit.

### 5. Attendances as Subcollection
**Rationale:** Easy to query "show me all shows user attended", keeps user document lightweight, natural data hierarchy.

---

## 🤝 How to Use This Document

**For Claude (or any AI assistant):**
1. Read this entire file before starting any task
2. Ask clarifying questions if anything is unclear
3. Refer to specific sections when implementing features
4. Update this file if architecture decisions change

**When starting a new chat:**
```
"I'm working on Hollywood Groove PWA. Please read the claude.md 
file first (it's in the repo root), then help me with [specific task]."
```

**For code generation:**
```
"Based on the Firebase schema in claude.md, generate the Firestore 
security rules for the users collection."
```

---

## 📞 Contact & Support

**Project Owner:** Michael Smedley  
**Location:** Melbourne, Australia  
**Timezone:** Australia/Melbourne (AEDT/AEST)

**Related Repositories:**
- `hollywood-groove-site` - WordPress marketing site
- `hollywood-groove-automation` - Backend automation (future)
- `hollywood-groove-infra` - Infrastructure as code (future)

---

## 📝 Document History

- **2025-10-26:** Initial creation (this conversation with Claude)
- Architecture decided: PWA + Firebase
- Database schema v1 defined
- Authentication strategy finalized
- Marketing automation approach outlined

---

**END OF CONTEXT DOCUMENT**

*This file should be updated as decisions are made and architecture evolves. Keep it as the single source of truth for AI assistants working on this project.*