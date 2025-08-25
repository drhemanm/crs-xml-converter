import { analytics } from '../components/CRSXMLConverter';
import { logEvent } from 'firebase/analytics';

// Custom analytics events
export const trackEvent = (eventName, parameters = {}) => {
  try {
    if (analytics) {
      logEvent(analytics, eventName, {
        timestamp: new Date().toISOString(),
        ...parameters
      });
      console.log(`📊 Analytics Event: ${eventName}`, parameters);
    }
  } catch (error) {
    console.error('Analytics error:', error);
  }
};

// Specific tracking functions
export const trackUserRegistration = (method, plan = 'free') => {
  trackEvent('user_registration', {
    method, // 'email' or 'google'
    plan,
    value: plan === 'free' ? 0 : plan === 'professional' ? 29 : 99
  });
};

export const trackUserLogin = (method) => {
  trackEvent('user_login', { method });
};

export const trackConversion = (fileType, recordCount, plan) => {
  trackEvent('file_conversion', {
    file_type: fileType,
    record_count: recordCount,
    user_plan: plan,
    conversion_value: plan === 'free' ? 0 : plan === 'professional' ? 0.29 : 0.099
  });
};

export const trackPlanUpgrade = (fromPlan, toPlan, method = 'paypal') => {
  trackEvent('plan_upgrade', {
    from_plan: fromPlan,
    to_plan: toPlan,
    payment_method: method,
    value: toPlan === 'professional' ? 29 : 99
  });
};

export const trackSupportContact = (method, plan) => {
  trackEvent('support_contact', {
    contact_method: method,
    user_plan: plan
  });
};
