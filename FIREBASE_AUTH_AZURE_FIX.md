# Firebase Authentication Azure Domain Fix

**Issue:** Google sign-in redirects to Google OAuth screen but doesn't return to the app.

**Root Cause:** Firebase Authentication needs to know which domains are authorized to handle OAuth redirects.

## Solution

You need to add your Azure Static Web App domain to Firebase's authorized domains list.

### Step 1: Find Your Azure Domain

Your Azure Static Web App domain is likely one of:
- `proud-plant-02f697200.azurestaticapps.net` (default Azure domain)
- Your custom domain (if configured)

To find it:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Static Web App resource
3. Look for the URL under "URL" in the Overview section

### Step 2: Add Domain to Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **theta-inkwell-448908-g9**
3. Navigate to: **Authentication → Settings → Authorized domains**
4. Click **Add domain**
5. Enter your Azure domain (e.g., `proud-plant-02f697200.azurestaticapps.net`)
6. Click **Add**

If you have a custom domain (like `hollywoodgroove.com`), add that as well.

### Step 3: Configure Google Cloud Console (OAuth Consent Screen)

The authorized redirect URIs also need to be configured in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project: **theta-inkwell-448908-g9**
3. Navigate to: **APIs & Services → Credentials**
4. Find your OAuth 2.0 Client ID (Web client)
5. Click to edit
6. Under **Authorized redirect URIs**, add:
   - `https://theta-inkwell-448908-g9.firebaseapp.com/__/auth/handler`
   - `https://YOUR-AZURE-DOMAIN/__/auth/handler` (e.g., `https://proud-plant-02f697200.azurestaticapps.net/__/auth/handler`)
7. Click **Save**

### Step 4: Set Environment Variable (Optional)

You can optionally set the `VITE_FIREBASE_AUTH_DOMAIN` environment variable to match your Azure domain. This is not strictly necessary if you've added your domain to Firebase's authorized domains.

In Azure Static Web Apps:
1. Go to Azure Portal → Your Static Web App
2. Navigate to: **Configuration → Application settings**
3. Add new setting:
   - Name: `VITE_FIREBASE_AUTH_DOMAIN`
   - Value: `YOUR-AZURE-DOMAIN` (e.g., `proud-plant-02f697200.azurestaticapps.net`)
4. Click **Save**

Alternatively, add to `.env.production`:
```
VITE_FIREBASE_AUTH_DOMAIN=YOUR-AZURE-DOMAIN
```

## Why This Happens

Firebase Authentication uses OAuth 2.0 for Google sign-in. The flow is:

1. User clicks "Sign in with Google" on your Azure domain
2. App redirects to Google OAuth screen
3. User authenticates with Google
4. Google redirects back to `https://{authDomain}/__/auth/handler`
5. Firebase completes the authentication
6. App redirects back to your page

If your Azure domain isn't in the authorized domains list, step 5 fails because Firebase doesn't recognize the domain making the request.

## Testing

After configuring:
1. Clear browser cache and cookies for your app
2. Visit your Azure domain
3. Try signing in with Google
4. You should be redirected back to your app successfully

## Troubleshooting

### Still not working?
- Check browser console for specific error messages
- Verify all domains are added (both Firebase and Google Cloud Console)
- Make sure to use HTTPS (OAuth requires secure connections)
- Try incognito/private browsing mode to rule out cached credentials

### Error: "redirect_uri_mismatch"
- The redirect URI in Google Cloud Console doesn't match
- Format must be exact: `https://YOUR-DOMAIN/__/auth/handler`
- No trailing slashes

### Error: "auth/unauthorized-domain"
- Domain not added to Firebase authorized domains
- Check spelling and protocol (https vs http)

## Quick Checklist

- [ ] Added Azure domain to Firebase Console → Authentication → Authorized domains
- [ ] Added redirect URI to Google Cloud Console → OAuth Client
- [ ] Cleared browser cache
- [ ] Tested sign-in flow
- [ ] Custom domain (if any) also added

## Related Files

- `src/lib/firebase.ts` - Firebase configuration
- `src/lib/auth.ts` - Authentication logic
- `.env.production` - Production environment variables
