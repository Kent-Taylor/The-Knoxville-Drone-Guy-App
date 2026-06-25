const admin = require('firebase-admin');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

admin.initializeApp();

const db = admin.firestore();

function normalizeProjectClaimCode(value) {
  const cleaned = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return '';
  const withoutPrefix = cleaned.startsWith('KDG') ? cleaned.slice(3) : cleaned;
  return `KDG-${withoutPrefix}`;
}

async function findUnclaimedProjects(code) {
  const normalizedCode = normalizeProjectClaimCode(code);
  if (!normalizedCode) return { normalizedCode, snapshot: null };

  const snapshot = await db
    .collection('jobs')
    .where('projectClaimCode', '==', normalizedCode)
    .where('claimStatus', '==', 'unclaimed')
    .get();

  return { normalizedCode, snapshot };
}

exports.validateProjectClaimCode = onCall(async (request) => {
  const { snapshot } = await findUnclaimedProjects(request.data?.code);
  return { valid: Boolean(snapshot && !snapshot.empty) };
});

exports.claimProjectByCode = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before claiming a project.');
  }

  const { normalizedCode, snapshot } = await findUnclaimedProjects(request.data?.code);
  if (!normalizedCode || !snapshot || snapshot.empty) {
    throw new HttpsError('not-found', 'That project ID is invalid or has already been claimed.');
  }

  const userId = request.auth.uid;
  const [authUser, userDoc] = await Promise.all([
    admin.auth().getUser(userId),
    db.collection('users').doc(userId).get(),
  ]);
  const userData = userDoc.data() || {};
  const displayName = userData.displayName || authUser.displayName || authUser.email || 'Client';
  const email = userData.email || authUser.email || '';
  const projectIds = [];
  const previousClientIds = new Set();

  await db.runTransaction(async (transaction) => {
    const freshSnapshot = await transaction.get(
      db
        .collection('jobs')
        .where('projectClaimCode', '==', normalizedCode)
        .where('claimStatus', '==', 'unclaimed'),
    );

    if (freshSnapshot.empty) {
      throw new HttpsError('already-exists', 'That project ID has already been claimed.');
    }

    freshSnapshot.docs.forEach((projectDoc) => {
      const projectData = projectDoc.data() || {};
      if (projectData.clientId && String(projectData.clientId).startsWith('unclaimed-')) {
        previousClientIds.add(projectData.clientId);
      }
      projectIds.push(projectDoc.id);
      transaction.update(projectDoc.ref, {
        clientId: userId,
        clientName: displayName,
        clientEmail: email,
        claimStatus: 'claimed',
        claimedByUid: userId,
        claimedAt: Date.now(),
      });
    });
  });

  await Promise.all(
    [...previousClientIds].map(async (previousClientId) => {
      const threadsSnapshot = await db.collection('chatThreads').where('clientId', '==', previousClientId).get();
      const batch = db.batch();
      threadsSnapshot.docs.forEach((threadDoc) => {
        batch.update(threadDoc.ref, {
          clientId: userId,
          clientName: displayName,
          updatedAt: Date.now(),
        });
      });
      batch.delete(db.collection('users').doc(previousClientId));
      await batch.commit();
    }),
  );

  return { projectIds };
});
