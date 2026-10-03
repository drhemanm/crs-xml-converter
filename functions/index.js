const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// There is deliberately no PayPal webhook here.
//
// One used to live in this file. It never verified PayPal's signature, and it
// upgraded whichever account matched the email in the request body -- so one
// unauthenticated POST could grant any account a paid plan. It had never been
// deployed only because the project is on Spark, and the deploy workflow
// deploys functions on every push to main, so enabling billing would have put
// it live. A replacement must verify every event against PayPal's
// verify-webhook-signature API before acting, and must resolve the account
// from data we issued (a custom_id carrying the uid), not from an email.

// Scheduled function to reset monthly conversion limits
exports.resetMonthlyLimits = functions.pubsub
  .schedule('0 0 1 * *')  // Runs at midnight on the 1st of each month
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting monthly conversion limits reset...');
    
    try {
      const usersSnapshot = await db.collection('users')
        .where('subscriptionStatus', '==', 'active')
        .get();

      // Firestore caps a WriteBatch at 500 operations. This was a single batch
      // over every active user, so the monthly reset would throw once the user
      // base passed 500 -- and then nobody's quota reset at all.
      const BATCH_LIMIT = 500;
      let updateCount = 0;

      for (let i = 0; i < usersSnapshot.docs.length; i += BATCH_LIMIT) {
        const chunk = usersSnapshot.docs.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        chunk.forEach(doc => {
          batch.update(doc.ref, {
            conversionsUsed: 0,
            lastResetDate: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
        updateCount += chunk.length;
      }

      console.log(`Reset conversion limits for ${updateCount} active users`);
      
      // Log the reset
      await db.collection('system_events').add({
        eventType: 'monthly_reset',
        usersReset: updateCount,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
    } catch (error) {
      console.error('Error resetting monthly limits:', error);
    }
    
    return null;
  });

// Clean up old audit logs.
//
// The window is 12 months because that is what the published privacy policy
// commits to for conversion logs. It used to be 90 days here while audit
// entries were stamped '7_YEARS' and the policy said 12 months -- three
// different numbers for one retention period. If this changes, the privacy
// policy and the metadata stamp in CRSXMLConverter.js change with it.
exports.cleanupAuditLogs = functions.pubsub
  .schedule('0 2 * * 0')  // Runs at 2 AM every Sunday
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting audit log cleanup...');
    
    const cutoffDate = new Date();
    const RETENTION_DAYS = 365;
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    
    const collections = [
      'audit_user_actions',
      'audit_file_processing',
      'audit_xml_generation',
      'audit_data_access',
      'audit_subscription_events'
    ];
    
    let totalDeleted = 0;
    
    // Bounded so a single invocation cannot run past the function timeout,
    // but repeated so one week's expiry is actually cleared. The previous
    // version deleted at most 500 documents per collection per week, which
    // never catches up once volume exceeds that.
    const MAX_PASSES = 20;

    for (const collectionName of collections) {
      try {
        for (let pass = 0; pass < MAX_PASSES; pass++) {
          const snapshot = await db.collection(collectionName)
            .where('timestamp', '<', cutoffDate)
            .limit(500)
            .get();

          if (snapshot.empty) break;

          const batch = db.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();

          totalDeleted += snapshot.size;
          console.log(`Deleted ${snapshot.size} old records from ${collectionName}`);

          if (snapshot.size < 500) break;
        }
      } catch (error) {
        console.error(`Error cleaning up ${collectionName}:`, error);
      }
    }
    
    // Log the cleanup
    await db.collection('system_events').add({
      eventType: 'audit_cleanup',
      recordsDeleted: totalDeleted,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Cleanup complete. Total records deleted: ${totalDeleted}`);
    
    return null;
  });

// HTTP function to manually trigger conversion reset (admin use)
exports.manualResetUser = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { userId } = data;
  
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }
  
  try {
    // Admin is a custom claim, verified from the ID token. It used to be read
    // from users/{uid}.role -- a field the user it describes could write, so
    // anyone could make themselves an admin and then reset any account.
    // Claims are set with the Admin SDK and are not writable from a client.
    if (context.auth.token.admin !== true) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can reset user limits');
    }
    
    // Reset the user's conversions
    await db.collection('users').doc(userId).update({
      conversionsUsed: 0,
      manualResetAt: admin.firestore.FieldValue.serverTimestamp(),
      resetBy: context.auth.uid
    });
    
    return { success: true, message: 'User conversions reset successfully' };
  } catch (error) {
    // Do not repackage an HttpsError as 'internal' -- that turned the
    // permission-denied above into an opaque 500 for the caller.
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('Error resetting user:', error);
    throw new functions.https.HttpsError('internal', 'Failed to reset user conversions');
  }
});

// Export all functions
module.exports = {
  resetMonthlyLimits: exports.resetMonthlyLimits,
  cleanupAuditLogs: exports.cleanupAuditLogs,
  manualResetUser: exports.manualResetUser
};
