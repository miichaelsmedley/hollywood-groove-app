# Firebase Security Rules Setup

**Date:** 2025-12-21
**Status:** Ready to Deploy
**Project:** Hollywood Groove

---

## Overview

This document explains the Firebase Realtime Database security rules for Hollywood Groove, covering both development (`test/`) and production paths.

---

## Security Principles

### 1. **Authentication Required**
- All reads and writes require Firebase Authentication
- Anonymous auth is enabled and sufficient for most operations
- Users can only access their own data

### 2. **Admin Control**
- Admins have full control over show content and settings
- Admin status is determined by `/admins/{uid}` node
- Cloud Functions write to derived data paths

### 3. **Data Privacy**
- Users can only read their own profile data
- Users can only write their own responses
- Correct answers (`activities_private`) are admin-only

### 4. **Public Read Paths**
- Show metadata (`meta`)
- Activity definitions (`activities`)
- Live state (`live`)
- Leaderboards
- Offers

---

## Rule Structure

The rules file (`firebase-rtdb-rules.json`) covers TWO environments:

### Development: `test/*`
- Used during local development
- Controller Test Mode writes here
- PWA uses `VITE_RTDB_PREFIX=test/` in dev
- Can be cleared periodically without affecting production

### Production: Root level
- Used in live shows
- Controller Test Mode OFF writes here
- PWA production builds use root paths
- Contains real user data

**Both environments have IDENTICAL rules** to ensure consistency.

---

## Path-by-Path Breakdown

### 1. `/users/{uid}` (Legacy User Profiles)

**Purpose:** Simple user registration for signup flow

**Rules:**
```json
{
  ".read": "auth != null && auth.uid == $uid",
  ".write": "auth != null && auth.uid == $uid"
}
```

**Who can access:**
- ✅ User themselves (read + write)
- ❌ Other users (no access)
- ❌ Unauthenticated users (no access)

**Validation:**
- Must have: `uid`, `displayName`, `createdAt`, `lastSeenAt`, `showsAttended`, `preferences`
- `uid` must match the path variable
- `displayName` must be 1-50 characters
- Index on `displayName` for uniqueness checks

---

### 2. `/members/{odience}` (Persistent Profiles)

**Purpose:** Long-term member data with stars, tiers, and history

**Rules:**
```json
{
  ".read": "auth != null && auth.uid == $odience",
  ".write": "auth != null && (auth.uid == $odience || root.child('admins').child(auth.uid).exists())"
}
```

**Who can access:**
- ✅ Member themselves (read + write)
- ✅ Admins (read + write)
- ❌ Other users (no access)

**Contains:**
- Star totals and tier
- Season badge history
- Show attendance history
- Venue affinity

---

### 3. `/shows/{showId}/meta` (Show Metadata)

**Purpose:** Public show information for PWA entry screen

**Rules:**
```json
{
  ".read": true,
  ".write": "root.child('admins').child(auth.uid).exists()"
}
```

**Who can access:**
- ✅ Everyone (read) - even unauthenticated
- ✅ Admins only (write)

**Contains:**
- Show title, date, venue
- Schema version
- Published timestamp

---

### 4. `/shows/{showId}/settings` (Admin Settings)

**Purpose:** Scoring configuration and show rules

**Rules:**
```json
{
  ".read": "root.child('admins').child(auth.uid).exists()",
  ".write": "root.child('admins').child(auth.uid).exists()"
}
```

**Who can access:**
- ✅ Admins only (read + write)
- ❌ Everyone else (no access)

**Contains:**
- Dancing modes and cooldowns
- Streak multipliers
- Score caps and floors

---

### 5. `/shows/{showId}/activities/{activityId}` (Public Activities)

**Purpose:** Trivia questions and activity definitions

**Rules:**
```json
{
  ".read": true,
  ".write": "root.child('admins').child(auth.uid).exists()"
}
```

**Who can access:**
- ✅ Everyone (read)
- ✅ Admins only (write)

**Contains:**
- Trivia questions and options
- Activity prompts
- Duration settings
- **NOT correct answers** (those are in `activities_private`)

---

### 6. `/shows/{showId}/activities_private/{activityId}` (Correct Answers)

**Purpose:** Admin-only correct answers and scoring rules

**Rules:**
```json
{
  ".read": "root.child('admins').child(auth.uid).exists()",
  ".write": "root.child('admins').child(auth.uid).exists()"
}
```

**Who can access:**
- ✅ Admins only (read + write)
- ❌ Everyone else (no access)

**Security:**
- **CRITICAL:** Never expose this to PWA
- Contains correct answer indexes
- Contains option scoring weights

---

### 7. `/shows/{showId}/live/*` (Live State)

**Purpose:** Current trivia/activity state for real-time sync

**Rules:**
```json
{
  ".read": true,
  ".write": "root.child('admins').child(auth.uid).exists()"
}
```

**Who can access:**
- ✅ Everyone (read)
- ✅ Admins only (write)

**Contains:**
- Current activity ID
- Phase (idle/question/answer)
- Start timestamp
- Duration

---

### 8. `/shows/{showId}/attendees/{odience}` (Per-Show Attendance)

**Purpose:** Individual attendee scoring and participation

**Rules:**
```json
{
  ".read": true,
  ".write": "auth != null && (auth.uid == $odience || root.child('admins').child(auth.uid).exists())"
}
```

**Who can access:**
- ✅ Everyone (read) - for leaderboard
- ✅ Attendee themselves (write)
- ✅ Admins (write)

**Special case - Flags:**
```json
"flags": {
  ".read": "root.child('admins').child(auth.uid).exists()",
  ".write": "root.child('admins').child(auth.uid).exists()"
}
```
- Admin-only moderation flags

---

### 9. `/shows/{showId}/responses/{activityId}/{odience}` (User Answers)

**Purpose:** Raw trivia answers and activity responses

**Rules:**
```json
{
  ".read": true,
  ".write": "auth != null && auth.uid == $odience"
}
```

**Who can access:**
- ✅ Everyone (read) - for leaderboard updates
- ✅ Attendee themselves (write) - their own responses only

**Validation:**
- Must have children (non-empty)
- If `displayName` exists, must be string

---

### 10. `/shows/{showId}/results` (Scored Results)

**Purpose:** Cloud Functions-calculated scores

**Rules:**
```json
{
  ".read": true,
  ".write": "false"
}
```

**Who can access:**
- ✅ Everyone (read)
- ❌ No one (write) - Cloud Functions only

**Cloud Functions Service Account:**
- Has elevated permissions to write here
- Not subject to these rules

---

### 11. `/shows/{showId}/scores` (Running Totals)

**Purpose:** Aggregated scores across all activities

**Rules:**
```json
{
  ".read": true,
  ".write": "false"
}
```

**Who can access:**
- ✅ Everyone (read)
- ❌ No one (write) - Cloud Functions only

---

### 12. `/shows/{showId}/leaderboard` (Top Rankings)

**Purpose:** Sorted top performers for UI

**Rules:**
```json
{
  ".read": true,
  ".write": "false"
}
```

**Who can access:**
- ✅ Everyone (read)
- ❌ No one (write) - Cloud Functions only

---

### 13. `/shows/{showId}/offers` (Promotional Offers)

**Purpose:** Venue promotions and prizes

**Rules:**
```json
{
  ".read": true,
  ".write": "root.child('admins').child(auth.uid).exists()"
}
```

**Who can access:**
- ✅ Everyone (read)
- ✅ Admins only (write)

---

### 14. `/shows/{showId}/offer_claims/{odience}/{offerId}` (User Claims)

**Purpose:** Tracking who claimed which offers

**Rules:**
```json
{
  ".read": "auth != null && auth.uid == $odience",
  ".write": "auth != null && auth.uid == $odience"
}
```

**Who can access:**
- ✅ User themselves (read + write)
- ❌ Other users (no access)

---

### 15. `/seasons/*` (Season Data)

**Purpose:** Quarterly season snapshots and leaderboards

**Rules:**
```json
{
  ".read": true,
  ".write": "root.child('admins').child(auth.uid).exists()"
}
```

**Who can access:**
- ✅ Everyone (read)
- ✅ Admins + Cloud Functions (write)

---

### 16. `/between_show_trivia` (Email Trivia)

**Purpose:** Between-show engagement via email

**Rules:**
```json
{
  ".read": true,
  ".write": "root.child('admins').child(auth.uid).exists()",
  "responses": {
    "$odience": {
      ".read": "auth != null && auth.uid == $odience",
      ".write": "auth != null && auth.uid == $odience"
    }
  }
}
```

**Who can access:**
- ✅ Everyone (read questions)
- ✅ User themselves (write own response)
- ✅ Admins (write questions)

---

### 17. `/admins` (Admin Whitelist)

**Purpose:** List of admin UIDs

**Rules:**
```json
{
  ".read": "root.child('admins').child(auth.uid).exists()",
  ".write": "false"
}
```

**Who can access:**
- ✅ Admins (read) - to check their own status
- ❌ No one (write) - must be set via Firebase Console

**Setup:**
1. Go to Firebase Console → Realtime Database
2. Manually create `/admins/{your_uid}: true`
3. Get your UID from Authentication → Users tab

---

## Deployment Steps

### Step 1: Get Current Rules (Backup)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `theta-inkwell-448908-g9`
3. Navigate to: **Realtime Database → Rules**
4. Copy existing rules to a backup file
5. Save as `firebase-rtdb-rules-backup-YYYYMMDD.json`

### Step 2: Deploy New Rules

**Option A: Via Firebase Console (Recommended for first time)**

1. Open `firebase-rtdb-rules.json` (created above)
2. Copy entire contents
3. In Firebase Console → Rules tab
4. Paste into editor
5. Click **Publish**
6. Confirm warnings (if any)

**Option B: Via Firebase CLI**

```bash
cd hollywood-groove-app

# Install Firebase CLI if needed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Set the project
firebase use theta-inkwell-448908-g9

# Deploy rules
firebase deploy --only database

# Or deploy to specific database instance
firebase deploy --only database:theta-inkwell-448908-g9-default-rtdb
```

### Step 3: Set Up Admin User

**Get your Firebase UID:**

1. Firebase Console → Authentication → Users
2. Find your user (anonymous or email)
3. Copy the UID (e.g., `YgRguthyXAWkbTBLBwj0cdzVAC12`)

**Add yourself as admin:**

1. Firebase Console → Realtime Database → Data tab
2. Click "+" next to root
3. Add path: `admins/{your_uid}`
4. Value: `true`
5. Click **Add**

Example:
```
/admins/
  YgRguthyXAWkbTBLBwj0cdzVAC12: true
```

### Step 4: Test the Rules

**Test read access:**

1. Open your app: `http://localhost:5173/shows/101/join`
2. Check browser console for auth status
3. Verify no permission errors

**Test write access:**

1. Fill out signup form
2. Submit
3. Check Firebase Console → Data → `test/users/{uid}`
4. Should see your user data

**Test admin access:**

1. Try reading `/admins` from browser console:
   ```javascript
   import { ref, get } from 'firebase/database';
   import { db } from './lib/firebase';

   const adminRef = ref(db, 'admins');
   const snapshot = await get(adminRef);
   console.log('Admins:', snapshot.val());
   ```
2. If you're an admin, should see the list
3. If not an admin, should get permission denied

---

## Testing Checklist

### ✅ Anonymous User Tests

- [ ] Can read `/shows/101/meta`
- [ ] Can write to `/users/{their_uid}`
- [ ] Can write to `/shows/101/responses/{activityId}/{their_uid}`
- [ ] **Cannot** read `/users/{other_uid}`
- [ ] **Cannot** read `/shows/101/settings`
- [ ] **Cannot** read `/shows/101/activities_private`
- [ ] **Cannot** write to `/shows/101/scores`

### ✅ Admin User Tests

- [ ] Can read `/admins`
- [ ] Can write to `/shows/101/meta`
- [ ] Can write to `/shows/101/settings`
- [ ] Can write to `/shows/101/activities_private`
- [ ] Can read and write all paths

### ✅ Cloud Functions Tests

- [ ] Can write to `/shows/101/results`
- [ ] Can write to `/shows/101/scores`
- [ ] Can write to `/shows/101/leaderboard`
- [ ] Can write to `/members/{odience}/stars`

---

## Security Best Practices

### 1. **Never Expose Admin Keys**
- Don't hardcode admin UIDs in client code
- Use server-side verification (Cloud Functions)
- Rotate admin users if compromised

### 2. **Validate All Inputs**
- Rules include `.validate` for critical fields
- Enforce string length limits
- Require specific child keys

### 3. **Monitor Database Usage**
- Firebase Console → Usage tab
- Set up billing alerts
- Watch for unusual read/write spikes

### 4. **Regular Audits**
- Review `/admins` list monthly
- Check for orphaned data
- Clear `test/` paths periodically

### 5. **Rate Limiting**
- Consider Cloud Functions quotas
- Implement client-side debouncing
- Monitor for abuse patterns

---

## Common Scenarios

### Scenario 1: User Joins Show

1. User scans QR → lands on `/shows/101/join`
2. PWA reads `/shows/101/meta` (public)
3. User registers → writes to `/users/{uid}`
4. User gets starting bonus based on tier from `/members/{uid}/stars`
5. User answers trivia → writes to `/responses/{activityId}/{uid}`
6. Cloud Function scores answer → writes to `/results` and `/scores`
7. Leaderboard updates → writes to `/leaderboard`

**Rules applied:**
- ✅ Step 2: Public read allowed
- ✅ Step 3: User can write own profile
- ✅ Step 4: User can read own member data
- ✅ Step 5: User can write own response
- ✅ Steps 6-7: Cloud Functions write (elevated permissions)

### Scenario 2: DJ Publishes Question

1. Controller (admin authenticated) → writes to `/shows/101/activities/{id}`
2. Controller writes correct answer → `/activities_private/{id}`
3. Controller updates live state → `/live/trivia`
4. PWA users read activity → see question, not answer
5. Users submit responses → `/responses`

**Rules applied:**
- ✅ Steps 1-3: Admin write allowed
- ✅ Step 4: Public read (activity), no access (activities_private)
- ✅ Step 5: Users write own responses

### Scenario 3: Malicious User Attempts Cheating

**Attempt 1: Read correct answer**
```javascript
const answerRef = ref(db, 'test/shows/101/activities_private/trivia-001');
await get(answerRef);
// ❌ DENIED: Permission denied
```

**Attempt 2: Write fake high score**
```javascript
const scoreRef = ref(db, 'test/shows/101/scores/other-user-uid');
await set(scoreRef, { totalScore: 99999 });
// ❌ DENIED: Permission denied
```

**Attempt 3: Modify other user's response**
```javascript
const responseRef = ref(db, 'test/shows/101/responses/activity-1/other-user-uid');
await set(responseRef, { optionIndex: 1 });
// ❌ DENIED: Permission denied (can only write own UID)
```

**Attempt 4: Read other user's email**
```javascript
const userRef = ref(db, 'test/users/other-user-uid');
await get(userRef);
// ❌ DENIED: Permission denied (can only read own UID)
```

---

## Troubleshooting

### Issue: "Permission denied" when registering

**Cause:** User not authenticated

**Fix:**
1. Check Firebase Auth is initialized
2. Verify anonymous auth sign-in succeeded
3. Check `auth.currentUser` is not null

### Issue: "Permission denied" when reading show meta

**Cause:** Rules not deployed or incorrect

**Fix:**
1. Verify rules deployed in Firebase Console
2. Check rule syntax (no trailing commas in JSON)
3. Use Firebase Rules Simulator to test

### Issue: Nickname uniqueness check failing

**Cause:** Missing index on `displayName`

**Fix:**
1. Firebase Console → Rules
2. Ensure `.indexOn: ["displayName"]` is present
3. May take a few minutes to build index

### Issue: Cloud Functions can't write scores

**Cause:** Service account permissions

**Fix:**
1. Cloud Functions use elevated service account
2. Not subject to security rules by default
3. Check function logs for other errors

---

## Monitoring and Alerts

### Firebase Console Dashboards

**Usage Tab:**
- Monitor reads/writes per day
- Check bandwidth usage
- Set up billing alerts

**Rules Tab:**
- Use Rules Playground to test scenarios
- Simulate as specific users
- Test before deploying

**Data Tab:**
- Manually inspect data structure
- Verify rules are working
- Clean up test data

### Google Cloud Monitoring

**Set up alerts for:**
- High read/write operations (>10,000/min)
- Failed permission checks (>100/min)
- Large payload sizes (>1MB)
- Unusual geographic access patterns

---

## Next Steps

After deploying security rules:

1. ✅ **Test thoroughly** in development (`test/` paths)
2. ✅ **Add yourself as admin** (`/admins/{uid}`)
3. ✅ **Verify auth flow** works end-to-end
4. ✅ **Deploy Cloud Functions** for scoring
5. ✅ **Test in production** with real show
6. ✅ **Monitor usage** for first week
7. ✅ **Document any issues** and iterate

---

**Related Files:**
- `firebase-rtdb-rules.json` — The actual rules (deploy this)
- `FIREBASE_TRIVIA_CONTRACT.md` — Data structure reference
- `FIXES_APPLIED.md` — Initial rules draft

**Questions?** Check Firebase documentation: https://firebase.google.com/docs/database/security
