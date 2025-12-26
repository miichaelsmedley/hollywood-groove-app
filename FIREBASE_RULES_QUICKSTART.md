# Firebase Security Rules - Quick Start

**5-Minute Setup Guide**

---

## Step 1: Deploy Rules (2 minutes)

### Option A: Firebase Console (Easiest)

1. Open [Firebase Console](https://console.firebase.google.com/project/theta-inkwell-448908-g9/database/theta-inkwell-448908-g9-default-rtdb/rules)
2. You'll see the current rules (probably wide open):
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
3. **Delete everything** in the editor
4. Open `firebase-rtdb-rules.json` in your project
5. **Copy all contents** (Cmd+A, Cmd+C)
6. **Paste into Firebase Console**
7. Click **Publish**
8. ✅ Rules are now live!

### Option B: Firebase CLI (Advanced)

```bash
cd hollywood-groove-app
firebase use theta-inkwell-448908-g9
firebase deploy --only database
```

---

## Step 2: Add Yourself as Admin (1 minute)

1. **Get your Firebase UID:**
   - Firebase Console → **Authentication → Users**
   - Find your user (might be "Anonymous User")
   - Copy the **User UID** (looks like: `YgRguthyXAWkbTBLBwj0cdzVAC12`)

2. **Add admin flag:**
   - Firebase Console → **Realtime Database → Data**
   - Hover over root `/` → click `+` button
   - **Name:** `admins`
   - Press Enter
   - Hover over `admins` → click `+`
   - **Name:** Paste your UID
   - **Value:** `true`
   - Click **Add**

3. **Verify:**
   - You should see:
     ```
     /
       admins/
         YgRguthyXAWkbTBLBwj0cdzVAC12: true
     ```

---

## Step 3: Test the Rules (2 minutes)

### Test 1: User Registration (Should Work)

1. Open app: `http://localhost:5173/shows/101/join`
2. Fill out form with nickname + email/phone
3. Submit
4. ✅ Should register successfully
5. Check Firebase Console → Data → `test/users/{your_uid}`
6. ✅ Should see your user profile

### Test 2: Nickname Uniqueness (Should Work)

1. Try registering with same nickname again
2. ✅ Should show "nickname taken" error
3. ✅ Should suggest alternatives (e.g., `Mike_001`)

### Test 3: Security (Should Fail)

Open browser console and try:

```javascript
// Try to read someone else's data
const otherUserRef = ref(db, 'test/users/fake-uid-12345');
await get(otherUserRef);
// ❌ Should fail: "Permission denied"

// Try to read correct answers
const answerRef = ref(db, 'test/shows/101/activities_private/trivia-1');
await get(answerRef);
// ❌ Should fail: "Permission denied"
```

If both fail with "Permission denied", your rules are working! 🎉

---

## What Changed?

### Before (DANGEROUS):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
☠️ **Anyone can read/write EVERYTHING**

### After (SECURE):
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "shows": {
      "$showId": {
        "meta": {
          ".read": true,
          ".write": "root.child('admins').child(auth.uid).exists()"
        }
      }
    }
  }
}
```
✅ **Users can only access their own data**
✅ **Admins control show content**
✅ **Public data is read-only**

---

## Quick Reference

| Path | Who Can Read | Who Can Write |
|------|--------------|---------------|
| `/users/{uid}` | User only | User only |
| `/members/{uid}` | User + admin | User + admin |
| `/shows/{id}/meta` | Everyone | Admins only |
| `/shows/{id}/settings` | Admins only | Admins only |
| `/shows/{id}/activities` | Everyone | Admins only |
| `/shows/{id}/activities_private` | Admins only | Admins only |
| `/shows/{id}/responses` | Everyone | User (own) |
| `/shows/{id}/scores` | Everyone | Cloud Functions only |
| `/shows/{id}/leaderboard` | Everyone | Cloud Functions only |

---

## Troubleshooting

### "Permission denied" on registration
- Check that anonymous auth is enabled
- Verify user is authenticated (`auth.currentUser !== null`)
- Check browser console for auth errors

### "Permission denied" on nickname check
- Ensure `.indexOn: ["displayName"]` is in rules
- Wait a few minutes for index to build
- Check Firebase Console → Rules → Indexes tab

### "Can't read show meta"
- Verify rules are deployed
- Check JSON syntax (no trailing commas)
- Use Firebase Rules Simulator to debug

---

## Next Steps

✅ Rules deployed and tested
✅ Admin access configured
✅ User registration working

**Now you can:**
1. Build the auth flow (signup/login)
2. Deploy to Azure with confidence
3. Sleep well knowing your data is secure

---

**Full Documentation:** See `FIREBASE_SECURITY_SETUP.md`

**Rules File:** `firebase-rtdb-rules.json`

**Need help?** Firebase Rules Docs: https://firebase.google.com/docs/database/security
