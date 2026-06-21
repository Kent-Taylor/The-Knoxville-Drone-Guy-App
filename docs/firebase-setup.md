# Firebase Setup

This app runs in demo mode until Firebase values are added.

## Why This Is Required

Firebase must be configured before real clients use the app. Without Firebase, the app uses local demo data and users can lose projects, chats, media references, and progress updates when the app reloads or moves devices.

## Project Services

Enable these Firebase services:

- Authentication: email/password sign-in for clients and admin. Do not store passwords in Firestore.
- Firestore: users, chat threads, messages, jobs, updates, shoot requests, and live location.
- Storage: chat attachments and job media updates.
- Cloud Functions: invites, admin-only writes, push notification fanout, and location cleanup.
- Cloud Messaging: iOS push notifications through APNs.

Use a production Firebase project first. Add a separate staging project later if you need a safer testing lane.

## Expo Environment

Copy `.env.example` to `.env.local` and fill it with the web app config from Firebase console > Project settings > Your apps > Web app.

```sh
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_WEBSITE_URL=https://www.theknoxvilledroneguy.com
```

Restart Expo after changing `.env.local`.

When Firebase is configured correctly, the in-app demo-mode notice disappears.

## Deploy Rules and Functions

Install and log in to the Firebase CLI, then select your project:

```sh
npm install -g firebase-tools
firebase login
firebase use --add
```

If you want to set the project manually, copy `.firebaserc.example` to `.firebaserc` and replace `your-firebase-project-id`.

Deploy Firestore rules, Storage rules, and Cloud Functions:

```sh
npm run firebase:deploy
```

You can deploy only rules or only functions with:

```sh
npm run firebase:deploy:rules
npm run firebase:deploy:functions
```

## Admin Role

Set a custom claim on the owner account:

```js
await admin.auth().setCustomUserClaims(uid, { admin: true });
```

Clients should not receive the admin claim. Client access is controlled by `clientId` on chat threads and jobs.

After setting the claim, sign out and sign back in so the app receives a fresh token.

## Collections

- `users/{uid}`: email, displayName, role, notificationPreference, expoPushTokens, createdAt, updatedAt.
- `chatThreads/{threadId}`: clientId, clientName, lastMessage, updatedAt.
- `chatThreads/{threadId}/messages/{messageId}`: senderId, senderName, body, attachment, reference, createdAt.
- `jobs/{jobId}`: clientId, clientName, title, address, homeBaseAddress, routeDistanceMiles, routeTravelTimeMinutes, routeDistanceStatus, status, scheduledAt, liveLocation.
- `jobs/{jobId}/updates/{updateId}`: status, note, attachment, createdAt.
- `shootRequests/{requestId}`: clientId, clientName, requesterName, title, requestedWhen, requestedDate, requestedTime, projectAddress, homeBaseAddress, routeDistanceMiles, routeTravelTimeMinutes, routeDistanceStatus, services, otherDescription, videoEditFormat, videoEditOther, finishedVideoLength, finishedVideoLengthOther, details, isRecurring, recurrenceFrequency, recurrenceOther, recurrenceEndDate, status, createdAt.

Admin-created projects can include `projectClaimCode`, `claimStatus`, `claimedByUid`, and `claimedAt`. Clients claim those projects through Cloud Functions, not by directly updating `jobs`.

## Project Claim Codes

The app uses two callable functions:

- `validateProjectClaimCode`: checks whether a code exists and is still unclaimed before signup.
- `claimProjectByCode`: after signup, links the unclaimed project to the new authenticated user.

Clients must not have direct Firestore permission to claim or update jobs. The Cloud Function uses Admin SDK privileges, validates the project code, and updates only matching unclaimed jobs.

## Shoot Request Intake

Clients create requests from the app after signing in. The app requires name or business name, project name, a future date, project address, project details, and at least one selected service. Same-day requests are blocked in the UI by setting the minimum calendar date to tomorrow.

Address autocomplete is currently a local Knoxville placeholder list. If no suggestion matches, the app accepts the typed address. Production address validation should use a maps/geocoding provider before mileage pricing is finalized.

Recurring shoots store `isRecurring`, `recurrenceFrequency`, optional `recurrenceOther`, and `recurrenceEndDate`. The `Other` service stores its required description in `otherDescription`. If `Edit Into a Video` is selected, optional video-edit fields store the requested format and final video length.

## Location Rules

Only the admin app writes live location. It starts at `on_my_way`, remains visible through `arrived` and `shoot_started`, and is removed at `shoot_complete` or `job_complete`.

Do not store route history for v1. Store only the latest point and timestamp.

Admins can edit job progress updates if a status was tapped by mistake or entered late. Editable fields are status, note, and timestamp. After an edit, the app sets the job's current status from the newest progress update by timestamp.

## Route Distance Placeholder

The home base address is `742 Whitesburg Dr, Knoxville, TN 37918`. Route distance must mean driving distance, not straight-line distance.

For v1 testing, the app tries to calculate route distance and travel time automatically using address geocoding plus driving-route lookup, then stores `routeDistanceMiles` and `routeTravelTimeMinutes`. The Apple Maps button remains available for manual verification. Future production mileage should be calculated in a Cloud Function with a true routing API, then stored on the request/job. Pricing should remain separate until distance rates are finalized.

## Website Chat

Add a Firebase web widget to `https://www.theknoxvilledroneguy.com` that writes to the same `chatThreads` and `messages` collections. Website visitor identity can start as a lead thread, then be linked to a Firebase user after invitation.

## Backups and Recovery

Enable Firestore data protection before launch:

- Turn on Firestore point-in-time recovery for short-term accidental write/delete recovery.
- Add a scheduled Firestore backup, daily or weekly depending on usage and budget.
- Keep Firebase rules in this repo as the source of truth. If rules are edited in the console, copy the final version back into `firebase/firestore.rules` or `firebase/storage.rules`.

Storage files are not included in Firestore backups. For important delivered media, keep your original media archive outside the app as the business source of truth.

## Launch Checklist

- `.env.local` contains all `EXPO_PUBLIC_FIREBASE_*` values.
- Email/password auth is enabled.
- Firestore database is created in production mode.
- Storage bucket is created.
- `npm run firebase:deploy` succeeds.
- Owner account has `{ admin: true }` custom claim.
- Demo-mode banner is gone.
- A client can sign up, request a project, send chat, and see assigned projects.
- Admin can create/accept projects, upload media, and update progress.
- A client cannot see another client's jobs, requests, chats, or storage media.
