# RTDB Rules And Show Index Rollout

Deploy in this order only. Do not deploy RTDB rules until the new functions are live, the show indexes are backfilled, and the PWA has been deployed.

## 0. Local Verification

```bash
cd /Users/michaelsmedley/HollywoodGroove/hollywood-groove-functions/functions
npm run build

cd /Users/michaelsmedley/HollywoodGroove/hollywood-groove-app
npm run build
node -e "JSON.parse(require('fs').readFileSync('firebase-rtdb-rules.json','utf8')); console.log('RTDB rules JSON parses')"
```

## 1. Deploy Functions First

```bash
cd /Users/michaelsmedley/HollywoodGroove
./hollywood-groove-app/node_modules/.bin/firebase deploy \
  --only functions:checkDisplayNameAvailable,functions:mirrorShowMetaToIndex,functions:mirrorTestShowMetaToIndex \
  --config firebase.json \
  --project theta-inkwell-448908-g9
```

Then run the one-off backfill. Use ADC or a service account with RTDB admin access.

```bash
cd /Users/michaelsmedley/HollywoodGroove/hollywood-groove-functions/functions
GCLOUD_PROJECT=theta-inkwell-448908-g9 \
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
node scripts/backfill-shows-index.mjs
```

Verify the backfill:

```bash
cd /Users/michaelsmedley/HollywoodGroove
./hollywood-groove-app/node_modules/.bin/firebase database:get /shows_index \
  --config firebase.json \
  --project theta-inkwell-448908-g9
./hollywood-groove-app/node_modules/.bin/firebase database:get /test/shows_index \
  --config firebase.json \
  --project theta-inkwell-448908-g9
```

Rollback note: if the functions misbehave, redeploy the previous functions revision or redeploy the previous source before continuing. If the backfill is wrong, do not continue; remove or overwrite `/shows_index` and `/test/shows_index`, then rerun the corrected backfill.

## 2. Deploy The PWA

```bash
cd /Users/michaelsmedley/HollywoodGroove/hollywood-groove-app
npm run deploy:cf
```

**Expected degraded window:** until Stage 3 deploys the new rules, `shows_index` is NOT readable by clients (the currently-deployed rules have no `shows_index` node and default-deny). So after this stage, RTDB-sourced show lists, `/join` live-show detection, test-show banners, and `/scores` live detection will be EMPTY (gracefully — no crashes). Ticketed shows still render from the Firestore ledger, and checkout/wallet/refunds are unaffected. Run Stage 3 immediately after this stage's checks to minimise the window.

Smoke checks before rules (limited by the degraded window above):

- `/tickets` still renders ticketed shows (Firestore ledger) and checkout works.
- Signup, join, and profile nickname checks call `checkDisplayNameAvailable`; callable failure allows submit.
- No console errors beyond the expected `shows_index` permission warnings.

Defer these to after Stage 3 (they depend on the new rules):

- `/shows` and `/tickets` render upcoming shows from `shows_index`.
- `/join` redirects to the latest active show when `shows/{id}/live` is active within 30 minutes.
- `/scores` uses the same 30-minute active-show rule and falls back to the last attended show.

Rollback note: roll back the Cloudflare Worker deployment if the PWA fails. Keep old RTDB rules in place while rolling back.

## 3. Deploy RTDB Rules Last

Only run this after Stage 2 is confirmed on the live PWA.

```bash
cd /Users/michaelsmedley/HollywoodGroove
./hollywood-groove-app/node_modules/.bin/firebase deploy \
  --only database \
  --config firebase.json \
  --project theta-inkwell-448908-g9
```

Post-rules smoke checks:

- Signed-in users can read `/shows_index`, `/shows/{showId}/meta`, `/shows/{showId}/live`, `/shows/{showId}/settings`, `/shows/{showId}/leaderboard`, and `/shows/{showId}/team_leaderboard`.
- Signed-in users cannot read the whole `/shows` tree.
- Users can read/write only their own `/shows/{showId}/responses/{activityId}/{uid}` and `/shows/{showId}/attendees/{uid}` records, unless platform admin.
- Users can write their own `/shows/{showId}/dance_claims/{uid}` only with `lastClaimAt`, `claimCount`, and `activityId`.
- Team owners can rename, remove members, transfer ownership, and disband teams without the `members/{otherUid}/current_team` write being denied.

Rollback note: redeploy the previous `firebase-rtdb-rules.json` immediately if the PWA cannot read show detail, live state, scores, or team flows. Because this stage is last, rolling rules back restores compatibility for both old and new PWA clients.

## Emulator Verification

There is no existing RTDB rules smoke script in the repo. If doing an emulator pass before production, use the root Firebase config:

```bash
cd /Users/michaelsmedley/HollywoodGroove
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
./hollywood-groove-app/node_modules/.bin/firebase emulators:start \
  --only auth,database,functions \
  --config firebase.json \
  --project theta-inkwell-448908-g9
```

In the emulator, seed a prod show and a test show, confirm the mirror functions create `/shows_index/{showId}` and `/test/shows_index/{showId}`, then use the Rules playground or a client SDK smoke script to verify the access checks listed in Stage 3.
