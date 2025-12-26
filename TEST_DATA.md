# Firebase Test Data (Dev / Test Mode)

This project uses a single Firebase project, and isolates dev/test writes under a `test/` namespace.

## Preferred: Seed via the Mac Controller (recommended)

1. Run `hollywood-groove-controller` in **Debug**.
2. Ensure **Test Mode** is ON (amber banner).
3. Trigger a publish:
   - Menu: **View → Firebase Demo: Push Trivia Question**
   - Or launch with `--firebase-test-sync` (same behavior)

Expected writes (Test Mode ON):
- `test/shows/101/meta`
- `test/shows/101/activities/demo-<uuid>`
- `test/shows/101/activities_private/demo-<uuid>`
- `test/shows/101/live/trivia` (phase `question`)

## Run the PWA against the same namespace

1. From `hollywood-groove-app/`: `npm run dev`
2. Confirm prefix at `http://localhost:5173/firebase-test` (should show `RTDB Prefix: test/`)
3. Visit `http://localhost:5173/shows` → open show `101` → answer trivia

Expected writes from the PWA:
- `test/shows/101/responses/<activityId>/<odience>`

If Cloud Functions are deployed, expected derived writes:
- `test/shows/101/results/<activityId>/<odience>`
- `test/shows/101/scores/<odience>`
- `test/shows/101/leaderboard`

## Manual seed (optional: show cards only)

If you just want `Shows` to render without running the controller, write this minimal structure:

```json
{
  "test": {
    "shows": {
      "101": {
        "meta": {
          "title": "Test Show 101",
          "startDate": "2026-01-01T20:00:00+11:00",
          "venueName": "The Grand Ballroom",
          "schemaVersion": 1,
          "publishedAt": 1734520800000,
          "status": "active"
        },
        "live": {
          "trivia": {
            "activityId": null,
            "phase": "idle",
            "startedAt": 0,
            "durationSeconds": 0
          }
        }
      }
    }
  }
}
```

## Cleanup

To remove dev/test data:
- Firebase Console → Realtime Database → delete the `test` node
