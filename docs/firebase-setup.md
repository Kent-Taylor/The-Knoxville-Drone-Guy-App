# Firebase Setup

This app runs in demo mode until Firebase values are added.

## Project Services

Enable these Firebase services:

- Authentication: email/password or email-link sign-in for invited clients.
- Firestore: users, chat threads, messages, jobs, updates, and live location.
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

- `users/{uid}`: email, displayName, role, expoPushTokens.
- `chatThreads/{threadId}`: clientId, clientName, lastMessage, updatedAt.
- `chatThreads/{threadId}/messages/{messageId}`: senderId, senderName, body, attachment, createdAt.
- `jobs/{jobId}`: clientId, clientName, title, address, status, scheduledAt, liveLocation.
- `jobs/{jobId}/updates/{updateId}`: status, note, attachment, createdAt.

## Location Rules

Only the admin app writes live location. It starts at `on_my_way`, remains visible through `arrived`, `shoot_started`, and `shoot_complete`, and is removed at `job_complete`.

Do not store route history for v1. Store only the latest point and timestamp.

## Website Chat

Add a Firebase web widget to `https://www.theknoxvilledroneguy.com` that writes to the same `chatThreads` and `messages` collections. Website visitor identity can start as a lead thread, then be linked to a Firebase user after invitation.
