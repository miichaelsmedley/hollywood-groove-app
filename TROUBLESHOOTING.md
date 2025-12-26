# Troubleshooting: Styles Not Showing

## Issue
After updating the signup screen design, the new cinematic styles aren't appearing in the browser.

---

## Quick Fixes (Try These First)

### 1. Hard Refresh Browser
The most common issue is browser cache.

**Chrome/Edge:**
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**Safari:**
- Mac: `Cmd + Option + R`

**Firefox:**
- Windows: `Ctrl + F5`
- Mac: `Cmd + Shift + R`

### 2. Clear Browser Cache Completely

**Chrome:**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Safari:**
1. Develop → Empty Caches
2. Refresh page

### 3. Restart Dev Server
```bash
# Stop the server (Ctrl+C)
# Then restart:
cd hollywood-groove-app
npm run dev
```

### 4. Clear Vite Cache
```bash
cd hollywood-groove-app
rm -rf node_modules/.vite
npm run dev
```

---

## Verification Steps

### 1. Check Dev Server Started Correctly
You should see:
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 2. Test URL Directly
Navigate to: `http://localhost:5173/shows/101/join`

You should see:
- **Logo:** "HOLLYWOOD GROOVE" in gold/amber text with glow
- **Background:** Deep black (#0B0B0D)
- **Cards:** Dark gray surface (#1C1C1E) with subtle borders
- **Button:** Amber/gold (#F59E0B) "Continue" button

### 3. Open Browser DevTools
**Check Console (F12):**
- Look for any CSS errors
- Look for 404 errors on CSS files

**Check Network Tab:**
- Filter to CSS
- Verify `index.css` is loading (200 status)
- Check file size (should be >10KB with Tailwind)

**Check Elements/Inspector:**
- Inspect the main div
- Should show `class="min-h-screen bg-cinema ..."`
- In Computed Styles, `background-color` should be `rgb(11, 11, 13)` (the cinema color)

---

## Advanced Troubleshooting

### Verify Tailwind Config is Loaded
```bash
cd hollywood-groove-app
cat tailwind.config.js | grep -A 5 "cinema:"
```

You should see:
```js
cinema: {
  DEFAULT: '#0B0B0D', // Deep black
  50: '#1C1C1E',      // Card surface
  ...
}
```

### Check CSS File is Updated
```bash
cat src/index.css | grep -A 3 "logo-text"
```

You should see:
```css
.logo-text {
  @apply text-primary;
  font-family: 'SF Pro Display', system-ui, -apple-system, sans-serif;
  letter-spacing: 0.05em;
```

### Verify Component File
```bash
grep -n "logo-text\|bg-cinema" src/pages/JoinShow.tsx | head -5
```

You should see multiple lines with these classes.

### Test with Simple HTML
Create a test file to verify Tailwind is working:

```bash
cat > test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #0B0B0D; color: #F2F2F7; }
    .logo-text { color: #F59E0B; text-shadow: 0 0 20px rgba(245, 158, 11, 0.3); }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center">
  <div class="text-center">
    <h1 class="logo-text text-6xl font-bold">HOLLYWOOD</h1>
    <h2 class="logo-text text-5xl font-bold">GROOVE</h2>
    <div class="mt-8 bg-gray-800 p-6 rounded-2xl border border-gray-700">
      <p class="text-gray-300">If you see gold text with a dark background, Tailwind is working!</p>
    </div>
  </div>
</body>
</html>
EOF
```

Open `test.html` in browser. If this works but the app doesn't, it's a build issue.

---

## Common Issues

### Issue 1: PostCSS Not Processing Tailwind
**Check:**
```bash
cat postcss.config.js
```

**Should contain:**
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Fix:** If missing, create it with the above content.

### Issue 2: Tailwind Not Scanning Files
**Check `tailwind.config.js` content array:**
```js
content: [
  "./index.html",
  "./src/**/*.{js,ts,jsx,tsx}",
],
```

This tells Tailwind to scan all your source files.

### Issue 3: CSS Not Imported
**Check `src/main.tsx`:**
Should have: `import "./index.css";`

### Issue 4: Node Modules Issue
```bash
cd hollywood-groove-app
rm -rf node_modules
rm package-lock.json
npm install
npm run dev
```

---

## What You Should See

### Before (Old Design)
- Generic dark gray background
- Simple form with multiple fields upfront
- No branding/logo
- Basic styling

### After (New Design)
- **Cinema black background** (#0B0B0D) with subtle gradient orbs
- **Gold "HOLLYWOOD GROOVE" logo** at top with glow effect
- **Show info card** with music icon, dark surface (#1C1C1E)
- **Simple nickname field** (progressive profiling)
- **Amber button** (#F59E0B) with glow on hover
- **Smooth animations** (slide-up on page load)
- **Loading state** with animated spinner + sparkle icon

---

## Still Not Working?

### Nuclear Option: Fresh Clone
If nothing works, try a fresh setup:

```bash
# Backup your changes
cp src/pages/JoinShow.tsx ~/JoinShow.backup.tsx
cp src/index.css ~/index.backup.css
cp tailwind.config.js ~/tailwind.backup.js

# Reinstall
cd hollywood-groove-app
rm -rf node_modules .vite dist
npm install
npm run dev
```

### Check Browser
Try a different browser:
- Chrome
- Firefox
- Safari

Some browsers aggressively cache CSS.

### Incognito Mode
Open `http://localhost:5173/shows/101/join` in incognito/private mode. This bypasses all cache.

---

## Screenshots to Verify

Take a screenshot and check for:
1. **Background color**: Should be very dark (almost black), not gray
2. **Logo**: "HOLLYWOOD GROOVE" should be gold/amber with glow
3. **Input field**: Should have amber border on focus
4. **Button**: Should be gold/amber, not blue or default

---

## Developer Tools Check

Open DevTools (F12) and run in Console:

```js
// Check if Tailwind classes are applied
const el = document.querySelector('.bg-cinema');
if (el) {
  console.log('✅ Element found');
  console.log('Background:', getComputedStyle(el).backgroundColor);
  console.log('Should be: rgb(11, 11, 13)');
} else {
  console.log('❌ Element with bg-cinema not found');
}

// Check logo text
const logo = document.querySelector('.logo-text');
if (logo) {
  console.log('✅ Logo found');
  console.log('Color:', getComputedStyle(logo).color);
  console.log('Should be: rgb(245, 158, 11) or similar');
} else {
  console.log('❌ Logo with logo-text not found');
}
```

---

## Contact Info

If still having issues, provide:
1. Browser + version (e.g., Chrome 120)
2. Operating system
3. Screenshot of the page
4. Console errors (if any)
5. Output of: `npm run dev`
6. Result of DevTools test above

---

**Most Likely Fix:** Hard refresh (Cmd+Shift+R / Ctrl+Shift+R) or clear cache!
