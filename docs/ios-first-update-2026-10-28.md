# iOS first update candidate — 2026-10-28

2026-10-30: Subsequent attendance/report/new-family changes require coordinated backend migrations. For the current candidate, use [the updated audit and release order](ios-update-audit-2026-10-30.md); the frontend-only boundary below describes the earlier candidate.

## Release boundary
- Base: approved iOS 1.0.0(4), commit 84354834d21aeb4f7a37ad53130d4def798895cd.
- Candidate branch: codex/ios-first-update. Proposed version 1.0.1; build number must be checked in App Store Connect before signing.
- Keep app name 뉴웨이브 플로우 and bundle ID app.newaveflow.mobile.
- No merge into main, Android release, Railway/backend/DB deployment, real push, or public web deployment.
- Vercel deployment is disabled for this branch. Native binaries are built from source by CI; checked-in web dist is not updated.

## Included
- Home menu overview, pending badges, three bottom tabs (home/calendar/profile), TTS entry opens personal checks.
- Readability and wrapping improvements for teacher and administrator screens, calendar labels, roster/student/class management.
- Explicit event attendance/absence choices; TTS per-field save/complete/error feedback and batched serial saves to reduce unnecessary refreshes.
- Teacher quarterly rankings and administrator statistics use the same recorded-total mean, pass/below/no-record assessment, green/red/neutral cards, name-only search and status filters. Missing records are excluded from the mean; comparison uses the unrounded mean, equality passes.
- Search/filter state survives screen remounts within the same account. Stats refresh on re-entry, foreground and reconnect. Offline/loading/error notices keep selected conditions visible.
- TTS saves invalidate both teacher and administrator statistics.
- Explicit normal/synthetic account selection, service status, Apple login behavior, visible synthetic data banner and full app guide from the approved build are preserved. Guide navigation reflects the new home menu.

## Deferred (requires coordinated work)
- Sunday addition, effective start week, historical achievement preservation and revision/day-patch write protocol. Current server's Monday–Saturday contract remains in use; cross-device stale writes are not claimed solved by this UI release.
- Actual push delivery, APNs/FCM setup, pilot accounts, recovery queues and reminder backend migrations.
- New re-login automatic return flow: approved login implementation is retained for this candidate.
- Android update and app renaming.

## Validation
- 158 frontend tests passed; production web build passed locally (existing bundle-size warning remains).
- Source compatibility checked against deployed db8c547 calendarQuarters, weeklyScores and editableDays contracts.
- iOS simulator/native CI, signed upload, TestFlight physical-device checks and App Store update review are separate outstanding gates.
- Physical iPhone checklist: production login/Apple login; synthetic teacher/admin selection; home navigation; rapid TTS checks and app reopen; attendance/absence; quarter filter/search and offline reconnect; account logout; large text; iPad layout if available.

## Activation order
1. Pass regression and iPhone/iPad native CI on exact candidate commit.
2. Authorize this exact branch in the protected ios-testflight environment, retaining reviewers; build and upload unused version/build.
3. Check install/upgrade from App Store 1.0.0 on iPhone; confirm saved records and main menus.
4. Submit the iOS update with detailed notes describing UI changes and all account roles/features. No hidden functionality or review-only behavior.
5. Release after approval and successful verification. Existing production remains available throughout.
