# Admin Setup - Do This BEFORE Deploying Rules

**IMPORTANT:** You need a permanent admin account before deploying security rules!

---

## Problem

Your current users are all **anonymous** (temporary). Anonymous UIDs change each session, so you can't use them as permanent admins.

---

## Solution: Create Email Admin Account

### Step 1: Enable Email Authentication

1. Firebase Console → **Authentication**
2. Click **Sign-in method** tab
3. Find **Email/Password** → Click it
4. Toggle **Enable**
5. Click **Save**

### Step 2: Create Your Admin Account

**Option A: Via Firebase Console (Easiest)**

1. Authentication → **Users** tab
2. Click **Add user**
3. **Email:** Your email (e.g., michael.smedley@gmail.com)
4. **Password:** Create a secure password
5. Click **Add user**
6. **Copy the User UID** that appears (e.g., `abc123xyz...`)

**Option B: Via App (After enabling email auth)**

1. Create a special admin signup page (we can build this)
2. Register with your email
3. Get your UID from Authentication tab

### Step 3: Set Yourself as Admin

1. Realtime Database → **Data** tab
2. Click `+` next to root `/`
3. **Name:** `admins`
4. Click `+` next to `admins`
5. **Name:** Paste your UID (from step 2)
6. **Value:** `true`
7. Click **Add**

Result:
```
/
  admins/
    abc123xyz...: true
```

### Step 4: NOW Deploy the Security Rules

Follow `FIREBASE_RULES_QUICKSTART.md` to deploy rules.

---

## Why This Order Matters

**If you deploy rules FIRST without an admin:**
1. ❌ You can't create shows (requires admin)
2. ❌ You can't publish activities (requires admin)
3. ❌ You're locked out of admin functions
4. ❌ You have to manually edit rules in console to add yourself

**If you create admin FIRST, then deploy rules:**
1. ✅ Rules recognize your admin status
2. ✅ You can immediately manage shows
3. ✅ Controller can authenticate as admin
4. ✅ Everything just works

---

## Current Error Explained

The "Failed to register" error is happening because:

1. You tried to register with nickname "Michael Smedley"
2. BUT the nickname uniqueness check is failing
3. Likely because the old rules don't have the `.indexOn` for displayName
4. OR there's already a user with that nickname from previous tests

**To fix:**
1. Clear test data: Firebase Console → Data → Delete `test/users` node
2. Try a different nickname (e.g., "Mike")
3. OR deploy the new rules (but do admin setup first!)

---

## Quick Fix for Right Now

### Option 1: Clear Old Data (Quick)

1. Firebase Console → Realtime Database → Data
2. Find `test/users` node
3. Click the `X` to delete it
4. Try registering again

### Option 2: Use Different Nickname

Just try "Mike" instead of "Michael Smedley"

### Option 3: Deploy Rules + Setup Admin (Proper)

Follow this document's steps 1-4 above

---

## After Admin Setup

Once you have a permanent admin account:

1. ✅ Deploy security rules
2. ✅ Test user registration
3. ✅ Controller can authenticate as admin
4. ✅ You can publish shows
5. ✅ Build the auth flow

---

## Next: Build Admin Login for Controller

The Controller needs to authenticate as your admin account. We'll need to:

1. Add email/password login to Controller
2. Store credentials securely
3. Use admin UID for Firebase writes

**Or:** Use a service account for Controller (more secure, we can set this up)

---

**Ready?** Let me know when you've created your admin email account and I'll help with the next steps!
