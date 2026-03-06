# Security: Trivia Answer Protection

**Issue:** Trivia correct answers must NEVER be exposed to the PWA client.

## Data Separation

### Public Path: `/shows/{showId}/activities/{activityId}`
This data is readable by all users and should contain:
```json
{
  "type": "trivia",
  "trivia": {
    "question": "What year was Hollywood Groove founded?",
    "kind": "multi",
    "options": [
      { "index": 0, "text": "2020" },
      { "index": 1, "text": "2021" },
      { "index": 2, "text": "2022" },
      { "index": 3, "text": "2023" }
    ]
  }
}
```

### Private Path: `/shows/{showId}/activities_private/{activityId}`
This data is **admin-only** and contains:
```json
{
  "correctIndex": 2,
  "scoring": {
    "basePoints": 100,
    "speedBonus": 50
  }
}
```

## Security Rules

1. **NEVER** include any of these fields in public activity data:
   - `correctIndex`
   - `correctAnswer`
   - `isCorrect`
   - `correct`
   - Any field that indicates which answer is correct

2. **Options must only contain:**
   - `index` (number)
   - `text` (string)

3. **Firebase Security Rules** prevent reading `/activities_private/` from the PWA

4. **PWA Defense:** The Trivia page explicitly strips any extra fields from options:
   ```typescript
   const options = Array.isArray(triviaData?.options)
     ? triviaData.options.map(({ index, text }) => ({ index, text }))
     : [];
   ```

## Controller Checklist

When publishing trivia activities from the controller:

- [ ] Correct answer goes ONLY to `/activities_private/{activityId}`
- [ ] Public activity at `/activities/{activityId}` has NO correctness indicators
- [ ] Options array contains ONLY `index` and `text` fields
- [ ] Test by viewing the public activity data in Firebase Console
- [ ] Verify PWA does not show any answer highlighting before user selects

## Testing

To verify answers are not exposed:

1. Open Firebase Console → Realtime Database
2. Navigate to `/shows/{showId}/activities/{activityId}`
3. Check that options have NO fields except `index` and `text`
4. Open the PWA in browser DevTools
5. View Network tab or Firebase reads
6. Verify NO reads to `/activities_private/`
7. Try the trivia in the app - no answers should be pre-highlighted

## If Answers Are Exposed

If you discover correct answers are visible in the PWA:

1. **Immediate Fix:**
   - Delete the public activity: `/shows/{showId}/activities/{activityId}`
   - Re-publish WITHOUT correctness indicators
   - Correct answer goes to `/activities_private/{activityId}` only

2. **Root Cause:**
   - Check controller code that publishes activities
   - Ensure separation between public and private data
   - Review Firebase Security Rules

3. **Prevention:**
   - Update controller to use separate paths
   - Add validation before publishing
   - Test every trivia type (multi, boolean, scale, freeform)

## Example: Multi-Choice Question

### ✅ CORRECT (Public)
```json
{
  "type": "trivia",
  "trivia": {
    "question": "Who directed Pulp Fiction?",
    "kind": "multi",
    "options": [
      { "index": 0, "text": "Spielberg" },
      { "index": 1, "text": "Tarantino" },
      { "index": 2, "text": "Scorsese" }
    ]
  }
}
```

### ❌ WRONG (Exposes Answer)
```json
{
  "type": "trivia",
  "trivia": {
    "question": "Who directed Pulp Fiction?",
    "kind": "multi",
    "correctAnswer": 1,  // ❌ NEVER DO THIS
    "options": [
      { "index": 0, "text": "Spielberg" },
      { "index": 1, "text": "Tarantino", "isCorrect": true },  // ❌ NEVER DO THIS
      { "index": 2, "text": "Scorsese" }
    ]
  }
}
```

## Related Files

- `src/pages/Trivia.tsx` - Strips extra option fields
- `firebase-rtdb-rules.json` - Security rules for activities_private
- `FIREBASE_SECURITY_SETUP.md` - Full security documentation
- `src/types/firebaseContract.ts` - TypeScript types (should NOT include correct answer fields)
