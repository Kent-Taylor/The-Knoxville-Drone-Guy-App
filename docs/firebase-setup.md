# Firebase Setup

This app runs in demo mode until Firebase values are added.

## Project Services

Enable these Firebase services:

- Authentication: email/password sign-in for clients and admin. Do not store passwords in Firestore.
- Firestore: users, chat threads, messages, jobs, updates, shoot requests, and live location.
- Storage: chat attachments and job media updates.
- Cloud Functions: invites, admin-only writes, push notification fanout, and location cleanup.
- Cloud Messaging: iOS push notifications through APNs.

## Expo Environment

Create `.env.local` with:

```sh
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_WEBSITE_URL=https://www.theknoxvilledroneguy.com
```

## Admin Role

Set a custom claim on the owner account:

```js
await admin.auth().setCustomUserClaims(uid, { admin: true });
```

Clients should not receive the admin claim. Client access is controlled by `clientId` on chat threads and jobs.

## Collections

- `users/{uid}`: email, displayName, role, notificationPreference, expoPushTokens, createdAt, updatedAt.
- `chatThreads/{threadId}`: clientId, clientName, lastMessage, updatedAt.
- `chatThreads/{threadId}/messages/{messageId}`: senderId, senderName, body, attachment, reference, createdAt.
- `jobs/{jobId}`: clientId, clientName, title, address, homeBaseAddress, routeDistanceMiles, routeTravelTimeMinutes, routeDistanceStatus, status, scheduledAt, liveLocation.
- `jobs/{jobId}/updates/{updateId}`: status, note, attachment, createdAt.
- `shootRequests/{requestId}`: clientId, clientName, requesterName, title, requestedWhen, requestedDate, requestedTime, projectAddress, homeBaseAddress, routeDistanceMiles, routeTravelTimeMinutes, routeDistanceStatus, services, otherDescription, videoEditFormat, videoEditOther, finishedVideoLength, finishedVideoLengthOther, details, isRecurring, recurrenceFrequency, recurrenceOther, recurrenceEndDate, status, createdAt.

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
