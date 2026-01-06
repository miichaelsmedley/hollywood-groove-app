# Mobile Authentication Diagnostic Guide

This guide will help you diagnose why Google sign-in is failing on mobile devices.

## Step 1: Verify Google Cloud Console Configuration

**CRITICAL:** Did you change the redirect URI in Google Cloud Console?

1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Web client (auto created by Google Service)"
3. Check **Authorized redirect URIs** - it should have:
   ```
   https://proud-plant-02f697200.4.azurestaticapps.net/__/auth/handler
   ```
   NOT:
   ```
   https://proud-plant-02f697200.4.azurestaticapps.net
   ```

If you JUST made this change, **wait 10 minutes** before testing. Google's servers need time to propagate the change.

## Step 2: Access Mobile Browser Console

### For iPhone (Safari):
1. On your Mac, open Safari → Preferences → Advanced
2. Enable "Show Develop menu in menu bar"
3. Connect your iPhone via USB
4. On iPhone, open Settings → Safari → Advanced
5. Enable "Web Inspector"
6. On Mac, Safari → Develop → [Your iPhone] → [Your website]
7. Console tab will show all logs

### For Android (Chrome):
1. On your phone, enable Developer Options:
   - Settings → About Phone → Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging
3. Connect phone to computer via USB
4. On computer, open Chrome and go to: `chrome://inspect`
5. Your phone's Chrome tabs will appear
6. Click "Inspect" next to your app's tab
7. Console tab will show all logs

### Alternative - Use Remote Console Service:
If USB debugging is too complex, use a remote console:
1. Add this to your `src/main.tsx` or `src/App.tsx` at the very top:
   ```typescript
   // Remote console for mobile debugging
   const script = document.createElement('script');
   script.src = 'https://cdn.jsdelivr.net/npm/eruda';
   document.body.appendChild(script);
   script.onload = () => (window as any).eruda.init();
   ```
2. Rebuild and deploy
3. A console icon will appear on your mobile browser
4. Tap it to see console logs

## Step 3: Capture the Diagnostic Logs

Once you have console access, try signing in with Google on mobile and capture:

1. **Before clicking sign-in**, you should see:
   ```
   🔍 Checking for redirect result...
   Current URL: https://your-domain.com/...
   Auth domain configured: theta-inkwell-448908-g9.firebaseapp.com
   No redirect result found (normal page load)
   ```

2. **When you click sign-in**, you should see:
   ```
   🔐 Starting Google sign-in (redirect mode)...
   User agent: Mozilla/5.0 (iPhone...)
   Auth domain: theta-inkwell-448908-g9.firebaseapp.com
   Current URL: https://your-domain.com/...
   📱 Initiating redirect flow for mobile...
   ✅ Redirect initiated, waiting for redirect...
   ```

3. **After redirecting back from Google**, you should see:
   ```
   🔍 Checking for redirect result...
   Current URL: https://your-domain.com/...
   Auth domain configured: theta-inkwell-448908-g9.firebaseapp.com
   ✅ Successfully signed in/linked with Google after redirect:
   ```

## Step 4: Check for Errors

If you see an error instead, look for:

### Error: `auth/unauthorized-domain`
```
❌ Error handling redirect result: FirebaseError: auth/unauthorized-domain
```
**Fix:** The domain is not in Firebase Console authorized domains
1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Make sure your domain is listed

### Error: `redirect_uri_mismatch` or `400 Bad Request`
```
❌ Error handling redirect result: FirebaseError: auth/internal-error
Error message: redirect_uri_mismatch
```
**Fix:** The Google Cloud Console redirect URI is wrong
1. Go to Google Cloud Console → Credentials
2. Make sure the URI ends with `/__/auth/handler`
3. Wait 10 minutes after fixing

### Error: `auth/network-request-failed`
```
❌ Error handling redirect result: FirebaseError: auth/network-request-failed
```
**Fix:** Network or CORS issue
1. Check if your mobile has internet connection
2. Try on cellular data instead of WiFi (or vice versa)
3. Check if your domain uses HTTPS (required for OAuth)

### No error but nothing happens
If you redirect to Google, sign in, but then just return to your app without being signed in:
1. Check if `getRedirectResult` is being called in your App.tsx
2. The app might be re-initializing and clearing state
3. Check if there's a Service Worker interfering

## Step 5: Quick Checks

Run these checks:

### Check 1: Is your app deployed to Azure?
The code changes need to be deployed. Check that Azure built the latest commit:
1. Go to GitHub Actions
2. Verify the latest commit was deployed successfully

### Check 2: Clear browser cache
On mobile:
- **iOS Safari:** Settings → Safari → Clear History and Website Data
- **Android Chrome:** Settings → Privacy → Clear Browsing Data

### Check 3: Test on different mobile browser
Try:
- iOS: Safari, Chrome, Firefox
- Android: Chrome, Firefox, Samsung Internet

## What to Send Me

If it's still not working, please send:

1. **Screenshot of Google Cloud Console** showing the authorized redirect URIs
2. **Screenshot or copy of console logs** from mobile browser showing the error
3. **Which mobile browser** and OS version (e.g., "iOS 17 Safari" or "Android 13 Chrome")
4. **Exact behavior:**
   - Does it redirect to Google?
   - Can you sign in with Google?
   - Does it redirect back?
   - What happens after redirecting back?

## Quick Test Command

To verify your Firebase config, run this in the browser console on mobile:
```javascript
console.log('Firebase Config:', {
  authDomain: firebase.app().options.authDomain,
  currentUser: firebase.auth().currentUser,
  currentURL: window.location.href
});
```

This will show what Firebase is configured to use.
