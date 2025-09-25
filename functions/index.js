const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// PayPal Webhook Handler
exports.paypalWebhook = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookId = functions.config().paypal?.webhook_id;
    const event = req.body;
    
    console.log('PayPal webhook received:', event.event_type);

    // Handle different event types
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event);
        break;
      case 'BILLING.SUBSCRIPTION.CREATED':
        await handleSubscriptionCreated(event);
        break;
      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(event);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event);
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event);
        break;
      case 'BILLING.SUBSCRIPTION.UPDATED':
        await handleSubscriptionUpdated(event);
        break;
      default:
        console.log('Unhandled event type:', event.event_type);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleSubscriptionCreated(event) {
  console.log('Subscription created:', event.resource.id);
  
  // Log the event for tracking
  await db.collection('paypal_events').add({
    eventType: 'subscription_created',
    eventData: event.resource,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function handleSubscriptionActivated(event) {
  const subscriptionId = event.resource.id;
  const customerId = event.resource.subscriber?.email_address;
  
  if (!customerId) {
    console.error('No customer email in subscription activation');
    return;
  }
  
  try {
    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', customerId)
      .limit(1)
      .get();
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const planId = event.resource.plan_id;
      
      // Determine plan based on PayPal plan ID
      let plan = 'free';
      let conversionsLimit = 3;
      
      // These IDs should match what you've set up in PayPal
      // You can also store these in Firebase config
      if (planId === 'P-37021577G4809293BNCWWCBI') {
        plan = 'professional';
        conversionsLimit = 100;
      } else if (planId === 'P-85257906JW695051MNCWWEIQ') {
        plan = 'enterprise';
        conversionsLimit = 1000;
      }
      
      await userDoc.ref.update({
        plan: plan,
        conversionsLimit: conversionsLimit,
        conversionsUsed: 0,
        subscriptionStatus: 'active',
        paypalSubscriptionId: subscriptionId,
        paypalPlanId: planId,
        subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
        subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Subscription activated for user ${customerId}: ${plan}`);
      
      // Log the successful activation
      await db.collection('subscription_history').add({
        userId: userDoc.id,
        email: customerId,
        action: 'activated',
        plan: plan,
        subscriptionId: subscriptionId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      console.error(`User not found with email: ${customerId}`);
      
      // Store for later processing
      await db.collection('pending_subscriptions').add({
        email: customerId,
        subscriptionId: subscriptionId,
        planId: planId,
        status: 'user_not_found',
        eventData: event.resource,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error handling subscription activation:', error);
  }
}

async function handlePaymentCompleted(event) {
  console.log('Payment completed:', event.resource.id);
  
  // Log successful payment
  await db.collection('payment_history').add({
    eventType: 'payment_completed',
    eventData: event.resource,
    amount: event.resource.amount?.total,
    currency: event.resource.amount?.currency,
    payerEmail: event.resource.payer?.email_address,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function handleSubscriptionCancelled(event) {
  const subscriptionId = event.resource.id;
  const customerId = event.resource.subscriber?.email_address;
  
  if (!customerId) {
    console.error('No customer email in subscription cancellation');
    return;
  }
  
  try {
    const usersSnapshot = await db.collection('users')
      .where('email', '==', customerId)
      .limit(1)
      .get();
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      
      await userDoc.ref.update({
        plan: 'free',
        conversionsLimit: 3,
        subscriptionStatus: 'cancelled',
        subscriptionCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        paypalSubscriptionId: null
      });
      
      console.log(`Subscription cancelled for user ${customerId}`);
      
      // Log the cancellation
      await db.collection('subscription_history').add({
        userId: userDoc.id,
        email: customerId,
        action: 'cancelled',
        previousPlan: userDoc.data().plan,
        subscriptionId: subscriptionId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

async function handleSubscriptionSuspended(event) {
  const subscriptionId = event.resource.id;
  const customerId = event.resource.subscriber?.email_address;
  
  if (!customerId) return;
  
  try {
    const usersSnapshot = await db.collection('users')
      .where('email', '==', customerId)
      .limit(1)
      .get();
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      
      await userDoc.ref.update({
        subscriptionStatus: 'suspended',
        subscriptionSuspendedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Subscription suspended for user ${customerId}`);
    }
  } catch (error) {
    console.error('Error handling subscription suspension:', error);
  }
}

async function handleSubscriptionUpdated(event) {
  console.log('Subscription updated:', event.resource.id);
  
  // Log the update for tracking
  await db.collection('paypal_events').add({
    eventType: 'subscription_updated',
    eventData: event.resource,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
}

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
      
      const batch = db.batch();
      let updateCount = 0;
      
      usersSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          conversionsUsed: 0,
          lastResetDate: admin.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
      });
      
      await batch.commit();
      
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

// Clean up old audit logs (keep only last 90 days)
exports.cleanupAuditLogs = functions.pubsub
  .schedule('0 2 * * 0')  // Runs at 2 AM every Sunday
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting audit log cleanup...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    const collections = [
      'audit_user_actions',
      'audit_file_processing',
      'audit_xml_generation',
      'audit_data_access',
      'audit_subscription_events'
    ];
    
    let totalDeleted = 0;
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName)
          .where('timestamp', '<', cutoffDate)
          .limit(500)  // Process in batches to avoid timeouts
          .get();
        
        if (!snapshot.empty) {
          const batch = db.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          
          totalDeleted += snapshot.size;
          console.log(`Deleted ${snapshot.size} old records from ${collectionName}`);
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
    // Check if requesting user is admin (you should implement proper admin checking)
    // For now, this is a placeholder
    const requestingUser = await db.collection('users').doc(context.auth.uid).get();
    if (!requestingUser.exists || requestingUser.data().role !== 'admin') {
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
    console.error('Error resetting user:', error);
    throw new functions.https.HttpsError('internal', 'Failed to reset user conversions');
  }
});

// Export all functions
module.exports = {
  paypalWebhook: exports.paypalWebhook,
  resetMonthlyLimits: exports.resetMonthlyLimits,
  cleanupAuditLogs: exports.cleanupAuditLogs,
  manualResetUser: exports.manualResetUser
};
