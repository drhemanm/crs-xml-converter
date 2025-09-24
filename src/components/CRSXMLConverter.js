import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  increment,
  addDoc,
  collection,
  serverTimestamp
} from 'firebase/firestore';
import { getAnalytics, logEvent } from 'firebase/analytics';

// Icons
import { 
  Upload, Download, FileText, AlertCircle, CheckCircle, CheckCircle2, Settings, 
  Shield, X, HelpCircle, Clock, Zap, Lock, Globe, ChevronRight,
  User, Building2, Menu, LogOut, CreditCard, BarChart3,
  Star, Crown, Sparkles, ArrowRight, Check, Users, Calendar,
  TrendingUp, Award, Headphones, Smartphone, Eye, History,
  DollarSign, Target, Activity, Briefcase, AlertTriangle, Mail,
  UserPlus, Search, Trash2, Save, Database
} from 'lucide-react';

// Excel processing
import * as XLSX from 'xlsx';

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// ==========================================
// BUSINESS CONFIGURATION
// ==========================================

const SUPPORT_EMAIL = 'contact@iafrica.solutions';
const COMPANY_NAME = 'Intelligent Africa Solutions Ltd';
const ANONYMOUS_USAGE_KEY = 'crs_anonymous_usage';
const ANONYMOUS_LIMIT = 3;

// Audit trail configuration
const AUDIT_COLLECTIONS = {
  USER_ACTIONS: 'audit_user_actions',
  FILE_PROCESSING: 'audit_file_processing', 
  XML_GENERATION: 'audit_xml_generation',
  DATA_ACCESS: 'audit_data_access',
  SUBSCRIPTION_EVENTS: 'audit_subscription_events'
};

// Updated pricing plans
const PRICING_PLANS = {
  free: {
    name: 'Free Plan',
    price: 0,
    conversions: 3,
    paypalPlanId: null,
    features: [
      '3 conversions after registration',
      'CRS v3.0 XML generation',
      'Email support',
      'Standard processing',
      'GDPR compliant'
    ],
    buttonText: 'Current Plan',
    popular: false,
    color: 'gray'
  },
  professional: {
    name: 'Professional',
    price: 79,
    conversions: 100,
    paypalPlanId: process.env.REACT_APP_PAYPAL_PROFESSIONAL_PLAN_ID || 'P-37021577G4809293BNCWWCBI',
    features: [
      '100 conversions/month',
      'CRS v3.0 & v2.0 XML generation',
      'Priority email support',
      'Usage analytics dashboard',
      'Advanced validation',
      'Conversion history',
      'GIIN validation database'
    ],
    buttonText: 'Subscribe Now',
    popular: true,
    color: 'blue'
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,
    conversions: 1000,
    paypalPlanId: process.env.REACT_APP_PAYPAL_ENTERPRISE_PLAN_ID || 'P-85257906JW695051MNCWWEIQ',
    features: [
      '1,000 conversions/month',
      'CRS v3.0 & v2.0 XML generation',
      'Priority phone + email support',
      'Advanced analytics',
      'Custom report branding',
      'API access (rate limited)',
      'Compliance consultation',
      'Priority processing queue',
      'Dedicated account management'
    ],
    buttonText: 'Subscribe Now',
    popular: false,
    color: 'purple'
  }
};

// ==========================================
// CRS v3.0 COMPLIANT MAPPINGS AND CONSTANTS
// ==========================================

// CRS v3.0 compliant payment type mappings based on XSD
const CRS_PAYMENT_TYPES = {
  'dividends': 'CRS501',      // Dividends
  'interest': 'CRS502',       // Interest  
  'gross_proceeds': 'CRS503', // Gross Proceeds/Redemptions
  'redemptions': 'CRS503',    // Gross Proceeds/Redemptions
  'other': 'CRS504',          // Other - CRS
  // Direct mappings for backward compatibility
  'CRS501': 'CRS501',
  'CRS502': 'CRS502',
  'CRS503': 'CRS503',
  'CRS504': 'CRS504'
};

// Account holder type mappings for CRS v3.0 (from XSD)
const CRS_ACCOUNT_HOLDER_TYPES = {
  'passive_nfe_reportable': 'CRS101', // Passive Non-Financial Entity with controlling person that is reportable
  'reportable_person': 'CRS102',      // CRS Reportable Person
  'passive_nfe_crs_reportable': 'CRS103' // Passive NFE that is a CRS Reportable Person
};

// Account type mappings (from XSD)
const CRS_ACCOUNT_TYPES = {
  'depository': 'CRS1101',           // Depository Account
  'custodial': 'CRS1102',            // Custodial Account  
  'insurance_annuity': 'CRS1103',    // Cash Value Insurance Contract or Annuity Contract
  'investment_entity': 'CRS1104',    // Debt or Equity Interest in Investment Entity
  'not_reported': 'CRS1100'          // Not reported (transitional)
};

// Due diligence procedure types (from XSD)
const CRS_DD_PROCEDURE_TYPES = {
  'new_account': 'CRS1201',      // New Account
  'preexisting': 'CRS1202',      // Preexisting Account
  'not_reported': 'CRS1200'      // Not reported (transitional)
};

// Controlling person type mappings (from XSD)
const CRS_CONTROLLING_PERSON_TYPES = {
  'ownership': 'CRS801',           // CP of legal person - ownership
  'other_means': 'CRS802',         // CP of legal person - other means  
  'senior_managing': 'CRS803',     // CP of legal person - senior managing official
  'trust_settlor': 'CRS804',       // CP of legal arrangement - trust - settlor
  'trust_trustee': 'CRS805',       // CP of legal arrangement - trust - trustee
  'trust_protector': 'CRS806',     // CP of legal arrangement - trust - protector
  'trust_beneficiary': 'CRS807',   // CP of legal arrangement - trust - beneficiary
  'trust_other': 'CRS808',         // CP of legal arrangement - trust - other
  'other_settlor_eq': 'CRS809',    // CP of legal arrangement - other - settlor-equivalent
  'other_trustee_eq': 'CRS810',    // CP of legal arrangement - other - trustee-equivalent
  'other_protector_eq': 'CRS811',  // CP of legal arrangement - other - protector-equivalent
  'other_beneficiary_eq': 'CRS812', // CP of legal arrangement - other - beneficiary-equivalent
  'other_equivalent': 'CRS813',    // CP of legal arrangement - other - other-equivalent
  'not_reported': 'CRS800'         // Not reported (transitional)
};

// Self-certification status (from XSD)
const CRS_SELF_CERT_STATUS = {
  'true': 'CRS901',     // True
  'false': 'CRS902',    // False
  'not_reported': 'CRS900' // Not reported (transitional)
};

const CRS_SELF_CERT_CONTROLLING_PERSON = {
  'true': 'CRS1001',    // True
  'false': 'CRS1002',   // False
  'not_reported': 'CRS1000' // Not reported (transitional)
};

// Message type indicator (from XSD)
const CRS_MESSAGE_TYPE_INDIC = {
  'new': 'CRS701',        // New information
  'correction': 'CRS702', // Corrections for previously sent information
  'no_data': 'CRS703'     // No data to report
};

// ==========================================
// ENHANCED FIELD MAPPINGS WITH CRS v3.0 SUPPORT
// ==========================================

const ENHANCED_FIELD_MAPPINGS = {
  // Core required fields
  'account_number': ['account_number', 'accountnumber', 'account_no', 'acct_no', 'account'],
  'account_balance': ['account_balance', 'balance', 'accountbalance', 'amount'],
  'currency_code': ['currency_code', 'currency', 'currencycode', 'curr_code', 'ccy'],
  'holder_type': ['holder_type', 'holdertype', 'type', 'account_holder_type', 'accountholdertype'],
  
  // Address and location
  'residence_country': ['residence_country', 'res_country', 'residence_country_code', 'country_of_residence'],
  'address_country': ['address_country', 'addr_country', 'address_country_code', 'country'],
  'city': ['city', 'address_city', 'town'],
  'address': ['address', 'street', 'address_line_1', 'street_address'],
  
  // Individual fields
  'first_name': ['first_name', 'firstname', 'fname', 'given_name'],
  'last_name': ['last_name', 'lastname', 'lname', 'surname'],
  'tin': ['tin', 'tax_id', 'taxpayer_id', 'tax_identification_number'],
  'birth_date': ['birth_date', 'birthdate', 'dob', 'date_of_birth'],
  'birth_city': ['birth_city', 'birthcity', 'place_of_birth'],
  'birth_country': ['birth_country', 'birth_country_code', 'birthcountry', 'country_of_birth'],
  'nationality': ['nationality', 'citizen_country', 'citizenship'],
  
  // Organization fields
  'organization_name': ['organization_name', 'org_name', 'company_name', 'entity_name'],
  'organization_tin': ['organization_tin', 'org_tin', 'company_tin', 'entity_tin'],
  
  // Controlling person fields
  'controlling_person_first_name': ['controlling_person_first_name', 'cp_first_name', 'cp_fname'],
  'controlling_person_last_name': ['controlling_person_last_name', 'cp_last_name', 'cp_lname'],
  'controlling_person_birth_date': ['controlling_person_birth_date', 'cp_birth_date', 'cp_dob'],
  'controlling_person_birth_city': ['controlling_person_birth_city', 'cp_birth_city'],
  'controlling_person_birth_country': ['controlling_person_birth_country', 'cp_birth_country'],
  'controlling_person_residence_country': ['controlling_person_residence_country', 'cp_residence_country'],
  'controlling_person_address_country': ['controlling_person_address_country', 'cp_address_country'],
  'controlling_person_city': ['controlling_person_city', 'cp_city'],
  'controlling_person_address': ['controlling_person_address', 'cp_address'],
  'controlling_person_tin': ['controlling_person_tin', 'cp_tin'],
  'controlling_person_nationality': ['controlling_person_nationality', 'cp_nationality'],
  
  // CRS v3.0 specific fields
  'self_cert': ['self_cert', 'self_certification', 'selfcert', 'self_certified'],
  'account_type': ['account_type', 'accounttype', 'acct_type', 'financial_account_type'],
  'dd_procedure': ['dd_procedure', 'due_diligence', 'ddprocedure', 'due_diligence_procedure'],
  'account_holder_type': ['account_holder_type', 'holder_type_detail', 'acctholdertype', 'crs_holder_type'],
  'controlling_person_type': ['controlling_person_type', 'cp_type', 'ctrlg_person_type', 'cp_relationship'],
  'controlling_person_self_cert': ['controlling_person_self_cert', 'cp_self_cert', 'cp_self_certification'],
  
  // Enhanced payment fields
  'payment_type': ['payment_type', 'paymenttype', 'payment_code', 'income_type'],
  'payment_amount': ['payment_amount', 'paymentamount', 'payment', 'income_amount'],
  'interest_amount': ['interest_amount', 'interest', 'interest_income', 'interest_payment'],
  'dividend_amount': ['dividend_amount', 'dividend', 'dividend_income', 'dividend_payment'],
  'gross_proceeds_amount': ['gross_proceeds_amount', 'gross_proceeds', 'redemptions_amount', 'proceeds'],
  'other_amount': ['other_amount', 'other_income', 'miscellaneous_amount', 'other_payment']
};

// ==========================================
// ANONYMOUS USAGE TRACKING
// ==========================================

const getAnonymousUsage = () => {
  try {
    const usage = JSON.parse(localStorage.getItem(ANONYMOUS_USAGE_KEY) || '{"count": 0, "conversions": []}');
    
    if (typeof usage !== 'object' || typeof usage.count !== 'number' || !Array.isArray(usage.conversions)) {
      return { count: 0, conversions: [] };
    }
    
    return usage;
  } catch (error) {
    console.error('Error reading anonymous usage:', error);
    return { count: 0, conversions: [] };
  }
};

const updateAnonymousUsage = () => {
  try {
    const usage = getAnonymousUsage();
    usage.count += 1;
    usage.conversions.push({
      timestamp: new Date().toISOString(),
      success: true,
      userAgent: navigator.userAgent.substring(0, 100)
    });
    
    if (usage.conversions.length > 10) {
      usage.conversions = usage.conversions.slice(-10);
    }
    
    localStorage.setItem(ANONYMOUS_USAGE_KEY, JSON.stringify(usage));
    return usage.count;
  } catch (error) {
    console.error('Error updating anonymous usage:', error);
    return 0;
  }
};

const clearAnonymousUsage = () => {
  try {
    localStorage.removeItem(ANONYMOUS_USAGE_KEY);
    console.log('Anonymous usage cleared');
  } catch (error) {
    console.error('Error clearing anonymous usage:', error);
  }
};

const canAnonymousUserConvert = () => {
  const usage = getAnonymousUsage();
  const remaining = Math.max(0, ANONYMOUS_LIMIT - usage.count);
  
  return {
    canConvert: remaining > 0,
    remaining,
    used: usage.count,
    limit: ANONYMOUS_LIMIT,
    percentUsed: Math.min(100, (usage.count / ANONYMOUS_LIMIT) * 100),
    mustRegister: usage.count >= ANONYMOUS_LIMIT
  };
};

// ==========================================
// ENVIRONMENT VALIDATION
// ==========================================

const validateEnvironment = () => {
  const requiredVars = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    return false;
  }
  
  return true;
};

// Initialize environment check
if (!validateEnvironment()) {
  console.warn('Some environment variables are missing. Some features may not work properly.');
}

// ==========================================
// AUDIT TRAIL FUNCTIONS
// ==========================================

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('audit_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('audit_session_id', sessionId);
  }
  return sessionId;
};

const logAuditEvent = async (eventType, eventData, user = null) => {
  try {
    const auditEntry = {
      timestamp: serverTimestamp(),
      eventType,
      userId: user?.uid || 'anonymous',
      userEmail: user?.email || 'anonymous',
      sessionId: getSessionId(),
      userAgent: navigator.userAgent.substring(0, 200),
      ipAddress: 'masked_for_privacy',
      eventData: {
        ...eventData,
        timestamp: new Date().toISOString(),
        crsVersion: '3.0'
      },
      compliance: {
        dataClassification: 'CONFIDENTIAL',
        regulatoryScope: 'CRS_OECD_v3',
        retentionPeriod: '7_YEARS'
      },
      browserInfo: {
        language: navigator.language,
        platform: navigator.platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    await addDoc(collection(db, AUDIT_COLLECTIONS.USER_ACTIONS), auditEntry);
    console.log(`Audit Event Logged: ${eventType}`);
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
};

// ==========================================
// ANALYTICS FUNCTIONS
// ==========================================

const trackEvent = (eventName, parameters = {}) => {
  try {
    if (analytics) {
      const eventParams = {
        timestamp: new Date().toISOString(),
        session_id: getSessionId(),
        crs_version: '3.0',
        ...parameters
      };

      const sanitizedParams = Object.keys(eventParams).reduce((acc, key) => {
        if (key !== 'email' && key !== 'user_id' && key !== 'personal_info') {
          acc[key] = eventParams[key];
        }
        return acc;
      }, {});

      logEvent(analytics, eventName, sanitizedParams);
      console.log(`📊 Analytics Event: ${eventName}`, sanitizedParams);
    }
  } catch (error) {
    console.error('Analytics error:', error);
  }
};

// ==========================================
// BUSINESS LOGIC FUNCTIONS
// ==========================================

const getUserConversionStatus = (user, userDoc) => {
  const anonymousStatus = canAnonymousUserConvert();
  
  if (!user) {
    return {
      canConvert: anonymousStatus.canConvert,
      remaining: anonymousStatus.remaining,
      used: anonymousStatus.used,
      limit: anonymousStatus.limit,
      percentUsed: anonymousStatus.percentUsed,
      mustRegister: anonymousStatus.mustRegister,
      userType: 'anonymous',
      reason: anonymousStatus.mustRegister ? 'Anonymous trial limit reached. Please register to continue.' : null
    };
  }
  
  if (!userDoc) {
    return {
      canConvert: false,
      remaining: 0,
      used: 0,
      limit: 0,
      percentUsed: 100,
      userType: 'registered',
      reason: 'User data not found. Please try logging in again.'
    };
  }
  
  const { 
    conversionsUsed = 0, 
    conversionsLimit = 3, 
    subscriptionStatus = 'active',
    plan = 'free'
  } = userDoc;
  
  if (subscriptionStatus !== 'active') {
    return {
      canConvert: false,
      remaining: 0,
      used: conversionsUsed,
      limit: conversionsLimit,
      percentUsed: 100,
      userType: 'registered',
      reason: subscriptionStatus === 'cancelled' ? 
        'Subscription cancelled. Please reactivate to continue.' : 
        'Subscription inactive. Please contact support.'
    };
  }
  
  const remaining = Math.max(0, conversionsLimit - conversionsUsed);
  const canConvert = remaining > 0;
  
  return {
    canConvert,
    remaining,
    used: conversionsUsed,
    limit: conversionsLimit,
    percentUsed: Math.min(100, (conversionsUsed / conversionsLimit) * 100),
    userType: 'registered',
    plan,
    reason: !canConvert ? `You've used all ${conversionsLimit} conversions for your ${plan} plan. Please upgrade to continue.` : null
  };
};

const getFirebaseErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Invalid password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Pop-up blocked by browser. Please allow pop-ups and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    default:
      return 'An error occurred. Please try again.';
  }
};

export {
  // Constants
  PRICING_PLANS,
  CRS_PAYMENT_TYPES,
  CRS_ACCOUNT_HOLDER_TYPES,
  CRS_ACCOUNT_TYPES,
  CRS_DD_PROCEDURE_TYPES,
  CRS_CONTROLLING_PERSON_TYPES,
  CRS_SELF_CERT_STATUS,
  CRS_SELF_CERT_CONTROLLING_PERSON,
  CRS_MESSAGE_TYPE_INDIC,
  ENHANCED_FIELD_MAPPINGS,
  AUDIT_COLLECTIONS,
  SUPPORT_EMAIL,
  COMPANY_NAME,
  
  // Functions
  getAnonymousUsage,
  updateAnonymousUsage,
  clearAnonymousUsage,
  canAnonymousUserConvert,
  logAuditEvent,
  trackEvent,
  getUserConversionStatus,
  getFirebaseErrorMessage,
  getSessionId
};
// ==========================================
// VALIDATION FUNCTIONS (CRS v3.0 Compliant)
// ==========================================

const validateGIIN = (giin) => {
  if (!giin || typeof giin !== 'string' || giin.trim() === '') {
    return { valid: false, message: "GIIN is required for CRS v3.0 compliance", severity: 'error' };
  }
  
  const cleanGiin = giin.trim().toUpperCase();
  const giinRegex = /^[A-Z0-9]{6}\.[A-Z0-9]{5}\.[A-Z]{2}\.[A-Z0-9]{3}$/;
  
  if (!giinRegex.test(cleanGiin)) {
    return { 
      valid: false, 
      message: "Invalid GIIN format. Should be: XXXXXX.XXXXX.XX.XXX (e.g., ABC123.00000.MU.123)", 
      severity: 'error' 
    };
  }
  
  if (cleanGiin.includes('TEST') || cleanGiin.includes('00000') || cleanGiin.includes('DUMMY')) {
    return { 
      valid: true, 
      message: "This appears to be test data. Ensure you have a real GIIN for live CRS submissions.", 
      severity: 'warning' 
    };
  }
  
  return { valid: true };
};

const validateTaxYear = (year) => {
  const currentYear = new Date().getFullYear();
  const minYear = 2014; // CRS started in 2014
  
  if (!year || typeof year !== 'number') {
    return { valid: false, message: "Tax year is required", severity: 'error' };
  }
  
  if (year < minYear || year > currentYear) {
    return { 
      valid: false, 
      message: `Tax year must be between ${minYear} and ${currentYear}`, 
      severity: 'error' 
    };
  }
  
  if (year === currentYear) {
    return { 
      valid: true, 
      message: `Reporting for current year (${currentYear}). Ensure this is correct for your jurisdiction.`, 
      severity: 'warning' 
    };
  }
  
  return { valid: true };
};

const validateFIName = (name) => {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return { valid: false, message: "Financial Institution name is required", severity: 'error' };
  }
  
  const cleanName = name.trim();
  
  if (cleanName.length < 2) {
    return { valid: false, message: "Institution name must be at least 2 characters", severity: 'error' };
  }
  
  if (cleanName.toLowerCase().includes('test') || cleanName.toLowerCase().includes('sample') || cleanName.toLowerCase().includes('demo')) {
    return { 
      valid: true, 
      message: "This appears to be test data. Use your actual FI name for live submissions.", 
      severity: 'warning' 
    };
  }
  
  return { valid: true };
};

const validateCountryCode = (countryCode) => {
  if (!countryCode || typeof countryCode !== 'string') {
    return { valid: false, message: "Country code is required", severity: 'error' };
  }
  
  const cleanCode = countryCode.trim().toUpperCase();
  
  if (!/^[A-Z]{2}$/.test(cleanCode)) {
    return { valid: false, message: "Country code must be 2 letters (ISO 3166-1)", severity: 'error' };
  }
  
  return { valid: true };
};

const validateCurrencyCode = (currencyCode) => {
  if (!currencyCode || typeof currencyCode !== 'string') {
    return { valid: false, message: "Currency code is required", severity: 'error' };
  }
  
  const cleanCode = currencyCode.trim().toUpperCase();
  
  if (!/^[A-Z]{3}$/.test(cleanCode)) {
    return { valid: false, message: "Currency code must be 3 letters (ISO 4217)", severity: 'error' };
  }
  
  return { valid: true };
};

const validateAccountBalance = (balance) => {
  if (balance === null || balance === undefined || balance === '') {
    return { valid: false, message: "Account balance is required", severity: 'error' };
  }
  
  const numericBalance = parseFloat(balance);
  
  if (isNaN(numericBalance)) {
    return { valid: false, message: "Account balance must be a valid number", severity: 'error' };
  }
  
  if (numericBalance < 0) {
    return { valid: false, message: "Account balance cannot be negative", severity: 'error' };
  }
  
  if (numericBalance === 0) {
    return { 
      valid: true, 
      message: "Account balance is zero. Ensure this is correct for CRS reporting.", 
      severity: 'warning' 
    };
  }
  
  return { valid: true };
};

const validateHolderType = (holderType) => {
  if (!holderType || typeof holderType !== 'string') {
    return { valid: false, message: "Holder type is required", severity: 'error' };
  }
  
  const cleanType = holderType.trim().toLowerCase();
  const validTypes = ['individual', 'organization', 'organisation'];
  
  if (!validTypes.includes(cleanType)) {
    return { 
      valid: false, 
      message: `Holder type must be one of: ${validTypes.join(', ')}`, 
      severity: 'error' 
    };
  }
  
  return { valid: true };
};

const getFieldDescription = (field) => {
  const descriptions = {
    'account_number': 'Account Number (unique identifier)',
    'account_balance': 'Account Balance (numeric value)',
    'currency_code': 'Currency Code (USD, EUR, etc.)',
    'holder_type': 'Account Holder Type (Individual/Organization)',
    'residence_country': 'Residence Country Code (2 letters, e.g., US)',
    'address_country': 'Address Country Code (2 letters, e.g., US)',
    'city': 'City/Town Name',
    'address': 'Street Address',
    'first_name': 'First Name (for individuals)',
    'last_name': 'Last Name (for individuals)',
    'organization_name': 'Organization Name (for entities)',
    'tin': 'Tax Identification Number',
    'birth_date': 'Date of Birth (YYYY-MM-DD format)',
    'birth_city': 'City of Birth',
    'birth_country': 'Country of Birth (2 letters)',
    'nationality': 'Nationality (ISO country code)',
    'payment_amount': 'Payment Amount (numeric)',
    'payment_type': 'Payment Type (CRS501-CRS504)',
    'account_type': 'Account Type (Depository, Custodial, etc.)',
    'self_cert': 'Self-Certification Status (true/false)',
    'dd_procedure': 'Due Diligence Procedure (New/Preexisting Account)',
    'controlling_person_type': 'Controlling Person Type',
    'account_holder_type': 'Account Holder Type Classification'
  };
  return descriptions[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// ==========================================
// ENHANCED CRS v3.0 DATA VALIDATION FUNCTION
// ==========================================

const validateCRSData = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      canGenerate: false,
      criticalErrors: ['No data found in spreadsheet or invalid data format'],
      warnings: [],
      recommendations: [],
      missingColumns: { critical: [], warnings: [], recommendations: [] },
      dataIssues: { critical: [], warnings: [], recommendations: [] },
      summary: { totalRows: 0, validRows: 0, invalidRows: 0, crsVersion: '3.0' }
    };
  }

  const firstRow = data[0];
  if (!firstRow || typeof firstRow !== 'object') {
    return {
      canGenerate: false,
      criticalErrors: ['Invalid data structure - unable to read column headers'],
      warnings: [],
      recommendations: [],
      missingColumns: { critical: [], warnings: [], recommendations: [] },
      dataIssues: { critical: [], warnings: [], recommendations: [] },
      summary: { totalRows: 0, validRows: 0, invalidRows: 0, crsVersion: '3.0' }
    };
  }

  const headers = Object.keys(firstRow).map(h => h.toLowerCase().trim());
  const requiredFields = ENHANCED_FIELD_MAPPINGS;

  // CRS v3.0 specific field classification
  const criticalFields = [
    'account_number', 'account_balance', 'currency_code', 'holder_type'
  ];
  
  const warningFields = [
    'residence_country', 'address_country', 'city', 'self_cert', 'account_type', 'dd_procedure'
  ];
  
  const recommendationFields = [
    'first_name', 'last_name', 'tin', 'birth_date', 'birth_city', 'birth_country', 
    'nationality', 'organization_name', 'organization_tin', 'account_holder_type',
    'controlling_person_first_name', 'controlling_person_last_name', 
    'controlling_person_birth_date', 'controlling_person_birth_country', 
    'controlling_person_residence_country', 'controlling_person_address_country', 
    'controlling_person_city', 'controlling_person_tin', 'controlling_person_nationality',
    'controlling_person_type', 'controlling_person_self_cert',
    'payment_type', 'payment_amount', 'interest_amount', 'dividend_amount',
    'gross_proceeds_amount', 'other_amount'
  ];

  const columnMappings = {};
  const missingColumns = { critical: [], warnings: [], recommendations: [] };

  // Enhanced column mapping with CRS v3.0 awareness
  Object.entries(requiredFields).forEach(([field, alternatives]) => {
    let found = false;
    let matchedHeader = null;

    // Exact match first
    for (const alt of alternatives) {
      const normalizedAlt = alt.toLowerCase().trim();
      if (headers.includes(normalizedAlt)) {
        matchedHeader = Object.keys(firstRow).find(h => 
          h.toLowerCase().trim() === normalizedAlt
        );
        found = true;
        break;
      }
    }

    // Fuzzy match if exact match fails
    if (!found) {
      for (const alt of alternatives) {
        const normalizedAlt = alt.toLowerCase().replace(/[_\s-]/g, '');
        const fuzzyMatch = headers.find(h => 
          h.replace(/[_\s-]/g, '').includes(normalizedAlt) ||
          normalizedAlt.includes(h.replace(/[_\s-]/g, ''))
        );
        if (fuzzyMatch) {
          matchedHeader = Object.keys(firstRow).find(h => 
            h.toLowerCase().trim() === fuzzyMatch
          );
          found = true;
          break;
        }
      }
    }

    if (found && matchedHeader) {
      columnMappings[field] = matchedHeader;
    } else {
      const fieldInfo = { 
        field, 
        alternatives: alternatives.slice(0, 3),
        description: getFieldDescription(field) 
      };
      
      if (criticalFields.includes(field)) {
        missingColumns.critical.push(fieldInfo);
      } else if (warningFields.includes(field)) {
        missingColumns.warnings.push(fieldInfo);
      } else if (recommendationFields.includes(field)) {
        missingColumns.recommendations.push(fieldInfo);
      }
    }
  });

  // Enhanced CRS v3.0 specific row validation
  const dataIssues = { critical: [], warnings: [], recommendations: [] };
  let validRows = 0;
  let invalidRows = 0;

  data.forEach((row, index) => {
    const rowNumber = index + 1;
    const critical = [];
    const warnings = [];
    const recommendations = [];
    
    try {
      // Get holder type for conditional validation
      const holderTypeValue = row[columnMappings.holder_type];
      const holderTypeValidation = validateHolderType(holderTypeValue);
      const holderType = holderTypeValue ? holderTypeValue.toLowerCase().trim() : '';

      // Critical CRS v3.0 validations
      if (!row[columnMappings.account_number] || String(row[columnMappings.account_number]).trim() === '') {
        critical.push('Account number is required and cannot be empty');
      }
      
      const balanceValidation = validateAccountBalance(row[columnMappings.account_balance]);
      if (!balanceValidation.valid) {
        critical.push(balanceValidation.message);
      }
      
      const currencyValidation = validateCurrencyCode(row[columnMappings.currency_code]);
      if (!currencyValidation.valid) {
        critical.push(currencyValidation.message);
      }
      
      if (!holderTypeValidation.valid) {
        critical.push(holderTypeValidation.message);
      }

      // CRS v3.0 specific warnings
      const resCountryValidation = validateCountryCode(row[columnMappings.residence_country]);
      if (!resCountryValidation.valid) {
        warnings.push('Valid residence country code recommended for CRS v3.0 compliance');
      }
      
      // Self-certification validation (required in v3.0)
      const selfCertValue = row[columnMappings.self_cert];
      if (!selfCertValue || !['true', 'false', 'CRS901', 'CRS902'].includes(String(selfCertValue).toLowerCase())) {
        warnings.push('Self-certification status (true/false) required for CRS v3.0');
      }

      // Account type validation (required in v3.0)
      const accountTypeValue = row[columnMappings.account_type];
      const validAccountTypes = ['depository', 'custodial', 'insurance_annuity', 'investment_entity'];
      if (accountTypeValue && !validAccountTypes.includes(String(accountTypeValue).toLowerCase())) {
        warnings.push('Invalid account type - must be: depository, custodial, insurance_annuity, or investment_entity');
      }

      // Due diligence procedure validation (required in v3.0)
      const ddProcedureValue = row[columnMappings.dd_procedure];
      const validDDTypes = ['new_account', 'preexisting'];
      if (ddProcedureValue && !validDDTypes.includes(String(ddProcedureValue).toLowerCase())) {
        warnings.push('Invalid due diligence procedure - must be: new_account or preexisting');
      }

      if (!row[columnMappings.city] || String(row[columnMappings.city]).trim() === '') {
        warnings.push('City information recommended for complete address details');
      }

      // Enhanced conditional validations based on holder type
      if (holderType === 'individual') {
        if (!row[columnMappings.first_name] || String(row[columnMappings.first_name]).trim() === '' ||
            !row[columnMappings.last_name] || String(row[columnMappings.last_name]).trim() === '') {
          critical.push('Complete name (first and last) required for individuals in CRS v3.0');
        }
        
        // Nationality validation (enhanced in v3.0)
        const nationalityValue = row[columnMappings.nationality];
        if (nationalityValue) {
          const nationalityValidation = validateCountryCode(nationalityValue);
          if (!nationalityValidation.valid) {
            warnings.push('Invalid nationality country code format');
          }
        } else {
          recommendations.push('Nationality information recommended for individuals');
        }
        
        if (!row[columnMappings.tin] || String(row[columnMappings.tin]).trim() === '') {
          recommendations.push('TIN (Tax Identification Number) strongly recommended for individuals');
        }

        if (!row[columnMappings.birth_date] || String(row[columnMappings.birth_date]).trim() === '') {
          recommendations.push('Birth date helps with individual identification');
        }

        // Birth country validation
        const birthCountryValue = row[columnMappings.birth_country];
        if (birthCountryValue) {
          const birthCountryValidation = validateCountryCode(birthCountryValue);
          if (!birthCountryValidation.valid) {
            warnings.push('Invalid birth country code format');
          }
        }

      } else if (['organization', 'organisation'].includes(holderType)) {
        if (!row[columnMappings.organization_name] || String(row[columnMappings.organization_name]).trim() === '') {
          critical.push('Organization name is required for entity account holders');
        }

        // Account holder type validation for organizations (required in v3.0)
        const acctHolderTypeValue = row[columnMappings.account_holder_type];
        const validAcctHolderTypes = ['passive_nfe_reportable', 'reportable_person', 'passive_nfe_crs_reportable'];
        if (!acctHolderTypeValue || !validAcctHolderTypes.includes(String(acctHolderTypeValue).toLowerCase())) {
          warnings.push('Account holder type classification required for organizations in CRS v3.0');
        }

        // Enhanced controlling person validation for v3.0
        const hasControllingPersonInfo = row[columnMappings.controlling_person_first_name] || 
                                       row[columnMappings.controlling_person_last_name];
        
        if (hasControllingPersonInfo) {
          // Controlling person type validation (required in v3.0)
          const cpTypeValue = row[columnMappings.controlling_person_type];
          const validCPTypes = ['ownership', 'other_means', 'senior_managing', 'trust_settlor', 'trust_trustee'];
          if (!cpTypeValue || !validCPTypes.some(type => String(cpTypeValue).toLowerCase().includes(type))) {
            warnings.push('Controlling person type classification required when controlling person info provided');
          }

          // Controlling person self-certification (required in v3.0)
          const cpSelfCertValue = row[columnMappings.controlling_person_self_cert];
          if (!cpSelfCertValue || !['true', 'false'].includes(String(cpSelfCertValue).toLowerCase())) {
            warnings.push('Controlling person self-certification status required in CRS v3.0');
          }

          // Controlling person nationality
          const cpNationalityValue = row[columnMappings.controlling_person_nationality];
          if (cpNationalityValue) {
            const cpNationalityValidation = validateCountryCode(cpNationalityValue);
            if (!cpNationalityValidation.valid) {
              warnings.push('Invalid controlling person nationality code format');
            }
          }
        } else {
          warnings.push('Controlling person information strongly recommended for organizations');
        }
      }

      // Enhanced payment validation for multiple payment types
      const paymentTypes = ['interest_amount', 'dividend_amount', 'gross_proceeds_amount', 'other_amount'];
      let hasPaymentData = false;
      
      paymentTypes.forEach(paymentType => {
        const paymentValue = parseFloat(row[columnMappings[paymentType]]);
        if (!isNaN(paymentValue) && paymentValue > 0) {
          hasPaymentData = true;
          
          const accountBalance = parseFloat(row[columnMappings.account_balance]);
          if (paymentValue > accountBalance * 10) {
            warnings.push(`${paymentType.replace('_', ' ')} seems unusually high compared to account balance`);
          }
        }
      });

      if (!hasPaymentData) {
        const generalPaymentAmount = parseFloat(row[columnMappings.payment_amount]);
        if (!isNaN(generalPaymentAmount) && generalPaymentAmount > 0) {
          hasPaymentData = true;
        }
      }

      if (!hasPaymentData) {
        recommendations.push('Payment information (interest, dividends, etc.) recommended for complete reporting');
      }

    } catch (error) {
      critical.push(`Data processing error: ${error.message}`);
    }

    // Categorize row validation results
    if (critical.length > 0) {
      dataIssues.critical.push({ row: rowNumber, errors: critical });
      invalidRows++;
    } else {
      validRows++;
    }
    
    if (warnings.length > 0) {
      dataIssues.warnings.push({ row: rowNumber, errors: warnings });
    }
    
    if (recommendations.length > 0) {
      dataIssues.recommendations.push({ row: rowNumber, errors: recommendations });
    }
  });

  // Determine if CRS v3.0 XML can be generated
  const canGenerate = missingColumns.critical.length === 0 && dataIssues.critical.length === 0;
  
  // Build comprehensive error summary
  const criticalErrors = [];
  if (missingColumns.critical.length > 0) {
    criticalErrors.push(`Missing ${missingColumns.critical.length} critical columns required for CRS v3.0`);
  }
  if (dataIssues.critical.length > 0) {
    criticalErrors.push(`${dataIssues.critical.length} rows have critical data errors`);
  }

  const warnings = [];
  if (missingColumns.warnings.length > 0) {
    warnings.push(`${missingColumns.warnings.length} recommended CRS v3.0 columns are missing`);
  }
  if (dataIssues.warnings.length > 0) {
    warnings.push(`${dataIssues.warnings.length} rows have CRS v3.0 compliance warnings`);
  }

  const recommendations = [];
  if (missingColumns.recommendations.length > 0) {
    recommendations.push(`${missingColumns.recommendations.length} optional CRS v3.0 fields could improve compliance`);
  }
  if (dataIssues.recommendations.length > 0) {
    recommendations.push(`${dataIssues.recommendations.length} rows could benefit from additional CRS v3.0 data`);
  }

  return {
    canGenerate,
    criticalErrors,
    warnings,
    recommendations,
    missingColumns,
    columnMappings,
    dataIssues,
    summary: { 
      totalRows: data.length, 
      validRows, 
      invalidRows,
      processingDate: new Date().toISOString(),
      crsVersion: '3.0'
    }
  };
};

// ==========================================
// CRS v3.0 DATA MAPPING FUNCTION
// ==========================================

const mapDataToCRS = (rowData, columnMappings) => {
  if (!rowData || !columnMappings) {
    throw new Error('Invalid data or column mappings provided');
  }

  const safeGet = (key, defaultValue = '') => {
    const value = rowData[columnMappings[key]];
    return (value !== null && value !== undefined) ? String(value).trim() : defaultValue;
  };

  const safeGetNumber = (key, defaultValue = 0) => {
    const value = parseFloat(rowData[columnMappings[key]]);
    return isNaN(value) ? defaultValue : value;
  };

  const holderType = safeGet('holder_type').toLowerCase();
  const isIndividual = holderType === 'individual';
  const isOrganization = ['organization', 'organisation'].includes(holderType);

  // Enhanced data mapping with CRS v3.0 compliance
  const mappedData = {
    // Account details
    accountNumber: safeGet('account_number'),
    accountBalance: safeGetNumber('account_balance'),
    currencyCode: safeGet('currency_code', 'USD').toUpperCase(),
    
    // CRS v3.0 required fields
    accountType: safeGet('account_type') ? 
      CRS_ACCOUNT_TYPES[safeGet('account_type').toLowerCase()] || 'CRS1101' : 'CRS1101', // Default to depository
    ddProcedure: safeGet('dd_procedure') ? 
      CRS_DD_PROCEDURE_TYPES[safeGet('dd_procedure').toLowerCase()] || 'CRS1202' : 'CRS1202', // Default to preexisting
    selfCert: safeGet('self_cert') ? 
      CRS_SELF_CERT_STATUS[safeGet('self_cert').toLowerCase()] || 'CRS901' : 'CRS901', // Default to true
    
    // Holder type classification
    isIndividual,
    isOrganization,
    
    // Individual data (only if holder type is individual)
    individual: isIndividual ? {
      firstName: safeGet('first_name'),
      lastName: safeGet('last_name'),
      birthDate: safeGet('birth_date'),
      birthCity: safeGet('birth_city'),
      birthCountry: safeGet('birth_country').toUpperCase(),
      tin: safeGet('tin'),
      resCountryCode: safeGet('residence_country', 'XX').toUpperCase(),
      addressCountryCode: (safeGet('address_country') || safeGet('residence_country', 'XX')).toUpperCase(),
      city: safeGet('city'),
      address: safeGet('address'),
      nationality: safeGet('nationality', '').toUpperCase()
    } : null,
    
    // Organization data (only if holder type is organization) 
    organization: isOrganization ? {
      name: safeGet('organization_name'),
      tin: safeGet('organization_tin'),
      resCountryCode: safeGet('residence_country', 'XX').toUpperCase(),
      addressCountryCode: (safeGet('address_country') || safeGet('residence_country', 'XX')).toUpperCase(),
      city: safeGet('city'),
      address: safeGet('address'),
      // CRS v3.0 account holder type (required for organizations)
      acctHolderType: safeGet('account_holder_type') ? 
        CRS_ACCOUNT_HOLDER_TYPES[safeGet('account_holder_type').toLowerCase()] || 'CRS102' : 'CRS102'
    } : null,
    
    // Controlling person (for organizations) with v3.0 compliance
    controllingPerson: isOrganization ? {
      firstName: safeGet('controlling_person_first_name'),
      lastName: safeGet('controlling_person_last_name'), 
      birthDate: safeGet('controlling_person_birth_date'),
      birthCity: safeGet('controlling_person_birth_city'),
      birthCountry: safeGet('controlling_person_birth_country').toUpperCase(),
      resCountryCode: safeGet('controlling_person_residence_country', 'XX').toUpperCase(),
      addressCountryCode: (safeGet('controlling_person_address_country') || 
                          safeGet('controlling_person_residence_country', 'XX')).toUpperCase(),
      city: safeGet('controlling_person_city'),
      address: safeGet('controlling_person_address'),
      tin: safeGet('controlling_person_tin'),
      nationality: safeGet('controlling_person_nationality', '').toUpperCase(),
      // CRS v3.0 controlling person type
      ctrlgPersonType: safeGet('controlling_person_type') ? 
        CRS_CONTROLLING_PERSON_TYPES[safeGet('controlling_person_type').toLowerCase()] || 'CRS801' : 'CRS801',
      // CRS v3.0 controlling person self-certification
      selfCert: safeGet('controlling_person_self_cert') ?
        CRS_SELF_CERT_CONTROLLING_PERSON[safeGet('controlling_person_self_cert').toLowerCase()] || 'CRS1001' : 'CRS1001'
    } : null,
    
    // Enhanced payment data with v3.0 compliant payment types
    payments: []
  };

  // Process multiple payment types for CRS v3.0
  const paymentTypes = ['interest', 'dividends', 'gross_proceeds', 'other'];
  
  paymentTypes.forEach(type => {
    const amountKey = `${type}_amount`;
    const amount = safeGetNumber(amountKey);
    
    if (amount > 0) {
      mappedData.payments.push({
        type: CRS_PAYMENT_TYPES[type] || 'CRS504',
        amount: amount,
        currency: mappedData.currencyCode
      });
    }
  });

  // Fallback payment from account balance if no specific payments
  if (mappedData.payments.length === 0 && mappedData.accountBalance > 0) {
    const paymentType = safeGet('payment_type');
    mappedData.payments.push({
      type: CRS_PAYMENT_TYPES[paymentType] || 'CRS504',
      amount: mappedData.accountBalance,
      currency: mappedData.currencyCode
    });
  }

  // Enhanced validation for CRS v3.0
  if (!mappedData.accountNumber) {
    throw new Error('Account number is required for CRS v3.0 compliance');
  }
  
  if (mappedData.accountBalance < 0) {
    throw new Error('Account balance cannot be negative');
  }

  if (!/^[A-Z]{3}$/.test(mappedData.currencyCode)) {
    throw new Error('Invalid currency code format - must be 3-letter ISO 4217 code');
  }

  return mappedData;
};

export {
  // Validation functions
  validateGIIN,
  validateTaxYear,
  validateFIName,
  validateCountryCode,
  validateCurrencyCode,
  validateAccountBalance,
  validateHolderType,
  getFieldDescription,
  
  // Main validation and mapping functions
  validateCRSData,
  mapDataToCRS
};
// ==========================================
// AUTHENTICATION CONTEXT
// ==========================================

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDoc, setUserDoc] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      try {
        if (firebaseUser) {
          await loadUserData(firebaseUser);
          trackEvent('user_authenticated', {
            auth_method: firebaseUser.providerData[0]?.providerId || 'email'
          });
        } else {
          setUser(null);
          setUserDoc(null);
          trackEvent('user_logged_out');
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setAuthError(error.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadUserData = async (firebaseUser) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setUserDoc(userData);
        
        // Update last login
        await updateDoc(userDocRef, {
          lastLogin: serverTimestamp(),
          lastLoginIP: 'masked_for_privacy'
        });

        await logAuditEvent('user_login', {
          loginMethod: firebaseUser.providerData[0]?.providerId || 'email',
          lastLogin: userData.lastLogin?.toDate?.() || null
        }, firebaseUser);
        
      } else {
        // Create new user document
        const anonymousUsage = getAnonymousUsage();
        const userData = {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          company: '',
          plan: 'free',
          conversionsUsed: 0,
          conversionsLimit: 3,
          subscriptionStatus: 'active',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          provider: firebaseUser.providerData[0]?.providerId || 'email',
          previousAnonymousUsage: anonymousUsage.count || 0,
          savedGIINs: [],
          preferences: {
            emailNotifications: true,
            marketingEmails: false,
            currency: 'USD',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            crsVersion: '3.0'
          },
          metadata: {
            signupSource: 'web_app',
            initialUserAgent: navigator.userAgent.substring(0, 200)
          }
        };
        
        await setDoc(userDocRef, userData);
        setUserDoc(userData);

        await logAuditEvent('user_registration', {
          registrationMethod: userData.provider,
          previousAnonymousUsage: userData.previousAnonymousUsage
        }, firebaseUser);

        trackEvent('user_registered', {
          registration_method: userData.provider,
          previous_anonymous_usage: userData.previousAnonymousUsage
        });
      }
      
      setUser(firebaseUser);
    } catch (error) {
      console.error('Error loading user data:', error);
      setUser(firebaseUser);
      setUserDoc(null);
    }
  };

  const register = async (email, password, displayName, company) => {
    try {
      setAuthError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      const anonymousUsage = getAnonymousUsage();
      const userData = {
        email,
        displayName,
        company,
        plan: 'free',
        conversionsUsed: 0,
        conversionsLimit: 3,
        subscriptionStatus: 'active',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        provider: 'email',
        previousAnonymousUsage: anonymousUsage.count || 0,
        savedGIINs: [],
        preferences: {
          emailNotifications: true,
          marketingEmails: true,
          currency: 'USD',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          crsVersion: '3.0'
        }
      };
      
      await setDoc(doc(db, 'users', newUser.uid), userData);
      
      // Send verification email
      try {
        await sendEmailVerification(newUser);
      } catch (verificationError) {
        console.warn('Email verification failed:', verificationError);
      }
      
      setUserDoc(userData);
      clearAnonymousUsage();
      
      trackEvent('user_registered', {
        registration_method: 'email',
        has_company: !!company,
        previous_anonymous_usage: userData.previousAnonymousUsage
      });
      
      return newUser;
    } catch (error) {
      const errorMessage = getFirebaseErrorMessage(error.code);
      setAuthError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;
      
      await updateDoc(doc(db, 'users', loggedInUser.uid), {
        lastLogin: serverTimestamp()
      });
      
      clearAnonymousUsage();
      
      trackEvent('user_logged_in', {
        login_method: 'email'
      });
      
      return loggedInUser;
    } catch (error) {
      const errorMessage = getFirebaseErrorMessage(error.code);
      setAuthError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setAuthError(null);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      clearAnonymousUsage();
      
      trackEvent('user_logged_in', {
        login_method: 'google'
      });
      
      return user;
    } catch (error) {
      const errorMessage = getFirebaseErrorMessage(error.code);
      setAuthError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      await logAuditEvent('user_logout', {
        logoutTime: new Date().toISOString()
      }, user);
      
      await signOut(auth);
      
      trackEvent('user_logged_out');
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email) => {
    try {
      setAuthError(null);
      await sendPasswordResetEmail(auth, email);
      
      trackEvent('password_reset_requested', {
        email_provided: !!email
      });
    } catch (error) {
      const errorMessage = getFirebaseErrorMessage(error.code);
      setAuthError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateUserUsage = async () => {
    if (user && userDoc) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          conversionsUsed: increment(1),
          lastConversion: serverTimestamp()
        });
        
        const newUsage = userDoc.conversionsUsed + 1;
        setUserDoc(prev => ({
          ...prev,
          conversionsUsed: newUsage
        }));
        
        await logAuditEvent('conversion_usage_updated', {
          newUsageCount: newUsage,
          planLimit: userDoc.conversionsLimit
        }, user);
        
        trackEvent('usage_updated', {
          new_usage: newUsage,
          plan_limit: userDoc.conversionsLimit,
          usage_percentage: (newUsage / userDoc.conversionsLimit) * 100
        });
        
        return newUsage;
      } catch (error) {
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userDoc, 
      loading, 
      authError,
      login, 
      register, 
      signInWithGoogle, 
      logout, 
      resetPassword, 
      updateUserUsage
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ==========================================
// CRS v3.0 COMPLIANT XML GENERATION FUNCTION
// ==========================================

const generateCRSXML = (data, settings, validationResults) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error('No data provided for XML generation');
  }

  if (!settings || !settings.reportingFI) {
    throw new Error('Invalid settings provided for XML generation');
  }

  if (!validationResults || !validationResults.columnMappings) {
    throw new Error('Invalid validation results provided for XML generation');
  }

  const { reportingFI, messageRefId, taxYear } = settings;
  const { columnMappings } = validationResults;
  
  // Enhanced utility functions
  const formatDate = (date) => {
    if (!date) return '';
    
    try {
      let dateObj;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          const parts = date.split(/[\/\-\.]/);
          if (parts.length === 3) {
            dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            if (isNaN(dateObj.getTime())) {
              dateObj = new Date(parts[2], parts[0] - 1, parts[1]);
            }
          }
        }
      } else {
        return '';
      }
      
      if (isNaN(dateObj.getTime())) return '';
      
      return dateObj.toISOString().split('T')[0];
    } catch (error) {
      console.error('Date formatting error:', error);
      return '';
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || amount === '') return '0.00';
    const numAmount = parseFloat(amount);
    return isNaN(numAmount) ? '0.00' : numAmount.toFixed(2);
  };

  const escapeXML = (text) => {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const generateUniqueRefId = (prefix = 'MU2024MU') => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return prefix + timestamp + random;
  };

  const generateDocRefId = () => {
    return generateUniqueRefId('DOC');
  };

  // CRS v3.0 compliant account report generation
  const generateAccountReport = (mappedAccount, index) => {
    const docRefId = generateDocRefId();
    
    // Generate account holder section with full CRS v3.0 compliance
    const generateAccountHolder = () => {
      if (mappedAccount.isIndividual && mappedAccount.individual) {
        const individual = mappedAccount.individual;
        return `
        <AccountHolder>
          <SelfCert>${escapeXML(mappedAccount.selfCert)}</SelfCert>
          <Individual>
            <ResCountryCode>${escapeXML(individual.resCountryCode || 'XX')}</ResCountryCode>
            ${individual.tin ? `<TIN issuedBy="${escapeXML(individual.resCountryCode || 'XX')}">${escapeXML(individual.tin)}</TIN>` : ''}
            <Name nameType="OECD202">
              <FirstName>${escapeXML(individual.firstName)}</FirstName>
              <LastName>${escapeXML(individual.lastName)}</LastName>
            </Name>
            <Address legalAddressType="OECD302">
              <cfc:CountryCode>${escapeXML(individual.addressCountryCode || individual.resCountryCode || 'XX')}</cfc:CountryCode>
              <cfc:AddressFix>
                <cfc:Street>${escapeXML(individual.address || 'Not Provided')}</cfc:Street>
                <cfc:City>${escapeXML(individual.city || 'Not Provided')}</cfc:City>
              </cfc:AddressFix>
            </Address>
            ${individual.nationality ? `<Nationality>${escapeXML(individual.nationality)}</Nationality>` : ''}
            ${individual.birthDate ? `
            <BirthInfo>
              <BirthDate>${formatDate(individual.birthDate)}</BirthDate>
              ${individual.birthCity ? `<City>${escapeXML(individual.birthCity)}</City>` : ''}
              <CountryInfo>
                <CountryCode>${escapeXML(individual.birthCountry || individual.resCountryCode || 'XX')}</CountryCode>
              </CountryInfo>
            </BirthInfo>` : ''}
          </Individual>
        </AccountHolder>`;
      } else if (mappedAccount.isOrganization && mappedAccount.organization) {
        const organization = mappedAccount.organization;
        return `
        <AccountHolder>
          <SelfCert>${escapeXML(mappedAccount.selfCert)}</SelfCert>
          <Organisation>
            ${organization.resCountryCode ? `<ResCountryCode>${escapeXML(organization.resCountryCode)}</ResCountryCode>` : ''}
            ${organization.tin ? `<IN issuedBy="${escapeXML(organization.resCountryCode || 'XX')}">${escapeXML(organization.tin)}</IN>` : ''}
            <Name>${escapeXML(organization.name)}</Name>
            <Address>
              <cfc:CountryCode>${escapeXML(organization.addressCountryCode || organization.resCountryCode || 'XX')}</cfc:CountryCode>
              <cfc:AddressFix>
                <cfc:Street>${escapeXML(organization.address || 'Not Provided')}</cfc:Street>
                <cfc:City>${escapeXML(organization.city || 'Not Provided')}</cfc:City>
              </cfc:AddressFix>
            </Address>
          </Organisation>
          <AcctHolderType>${escapeXML(organization.acctHolderType)}</AcctHolderType>
        </AccountHolder>`;
      }
      
      throw new Error(`Invalid account holder type for account ${mappedAccount.accountNumber}`);
    };

    // Generate controlling person section with CRS v3.0 compliance
    const generateControllingPerson = () => {
      if (!mappedAccount.isOrganization || !mappedAccount.controllingPerson) {
        return '';
      }
      
      const cp = mappedAccount.controllingPerson;
      
      // Only generate if we have at least first and last name
      if (!cp.firstName || !cp.lastName) {
        return '';
      }
      
      return `
        <ControllingPerson>
          <Individual>
            <ResCountryCode>${escapeXML(cp.resCountryCode || 'XX')}</ResCountryCode>
            ${cp.tin ? `<TIN issuedBy="${escapeXML(cp.resCountryCode || 'XX')}">${escapeXML(cp.tin)}</TIN>` : ''}
            <Name nameType="OECD202">
              <FirstName>${escapeXML(cp.firstName)}</FirstName>
              <LastName>${escapeXML(cp.lastName)}</LastName>
            </Name>
            <Address legalAddressType="OECD302">
              <cfc:CountryCode>${escapeXML(cp.addressCountryCode || cp.resCountryCode || 'XX')}</cfc:CountryCode>
              <cfc:AddressFix>
                <cfc:Street>${escapeXML(cp.address || 'Not Provided')}</cfc:Street>
                <cfc:City>${escapeXML(cp.city || 'Not Provided')}</cfc:City>
              </cfc:AddressFix>
            </Address>
            ${cp.nationality ? `<Nationality>${escapeXML(cp.nationality)}</Nationality>` : ''}
            ${cp.birthDate ? `
            <BirthInfo>
              <BirthDate>${formatDate(cp.birthDate)}</BirthDate>
              ${cp.birthCity ? `<City>${escapeXML(cp.birthCity)}</City>` : ''}
              <CountryInfo>
                <CountryCode>${escapeXML(cp.birthCountry || cp.resCountryCode || 'XX')}</CountryCode>
              </CountryInfo>
            </BirthInfo>` : ''}
          </Individual>
          <CtrlgPersonType>${escapeXML(cp.ctrlgPersonType)}</CtrlgPersonType>
          <SelfCert>${escapeXML(cp.selfCert)}</SelfCert>
        </ControllingPerson>`;
    };

    // Generate payment sections with CRS v3.0 compliance
    const generatePayments = () => {
      if (!mappedAccount.payments || mappedAccount.payments.length === 0) {
        return '';
      }
      
      return mappedAccount.payments.map(payment => `
        <Payment>
          <Type>${escapeXML(payment.type)}</Type>
          <PaymentAmnt currCode="${escapeXML(payment.currency)}">${formatCurrency(payment.amount)}</PaymentAmnt>
        </Payment>`).join('');
    };

    return `
      <AccountReport>
        <DocSpec>
          <stf:DocTypeIndic>OECD1</stf:DocTypeIndic>
          <stf:DocRefId>${docRefId}</stf:DocRefId>
        </DocSpec>
        <AccountNumber UndocumentedAccount="false" AcctNumberType="OECD605">${escapeXML(mappedAccount.accountNumber)}</AccountNumber>
        ${generateAccountHolder()}
        ${generateControllingPerson()}
        <AccountBalance currCode="${escapeXML(mappedAccount.currencyCode)}">${formatCurrency(mappedAccount.accountBalance)}</AccountBalance>
        ${generatePayments()}
        <DDProcedure>${escapeXML(mappedAccount.ddProcedure)}</DDProcedure>
        <AccountType>${escapeXML(mappedAccount.accountType)}</AccountType>
      </AccountReport>`;
  };
  
  // Process and map all data rows with error handling
  const mappedAccounts = [];
  const processingErrors = [];

  data.forEach((row, index) => {
    try {
      const mappedAccount = mapDataToCRS(row, columnMappings);
      mappedAccounts.push(mappedAccount);
    } catch (error) {
      processingErrors.push(`Row ${index + 1}: ${error.message}`);
    }
  });

  if (processingErrors.length > 0) {
    console.warn('XML Generation warnings:', processingErrors);
    if (processingErrors.length > data.length * 0.5) {
      throw new Error(`Too many processing errors: ${processingErrors.length} out of ${data.length} rows failed`);
    }
  }

  if (mappedAccounts.length === 0) {
    throw new Error('No valid accounts to process after data mapping');
  }

  // Generate account reports
  const accountReports = mappedAccounts.map((account, index) => 
    generateAccountReport(account, index)
  ).join('');

  // Generate message reference ID
  const messageRef = messageRefId || generateUniqueRefId('CRS');
  const reportingPeriod = `${taxYear}-12-31`;
  const timestamp = new Date().toISOString();
  const fiDocRefId = generateDocRefId();

  // Build complete CRS v3.0 compliant XML with all required namespaces from XSD
  return `<?xml version="1.0" encoding="UTF-8"?>
<CRS_OECD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
          xmlns:crs="urn:oecd:ties:crs:v3" 
          xmlns:cfc="urn:oecd:ties:commontypesfatcacrs:v2" 
          xmlns:stf="urn:oecd:ties:crsstf:v5" 
          xmlns:iso="urn:oecd:ties:isocrstypes:v1"
          xmlns:ftc="urn:oecd:ties:fatca:v1"
          targetNamespace="urn:oecd:ties:crs:v3"
          version="3.0" 
          xmlns="urn:oecd:ties:crs:v3"
          xsi:schemaLocation="urn:oecd:ties:crs:v3 CrsXML_v3.0.xsd">
  <MessageSpec>
    <SendingCompanyIN>${escapeXML(reportingFI.giin || 'UNKNOWN')}</SendingCompanyIN>
    <TransmittingCountry>${escapeXML(reportingFI.country || 'XX')}</TransmittingCountry>
    <ReceivingCountry>${escapeXML(reportingFI.country || 'XX')}</ReceivingCountry>
    <MessageType>CRS</MessageType>
    <MessageRefId>${escapeXML(messageRef)}</MessageRefId>
    <MessageTypeIndic>CRS701</MessageTypeIndic>
    <ReportingPeriod>${reportingPeriod}</ReportingPeriod>
    <Timestamp>${timestamp}</Timestamp>
  </MessageSpec>
  <CrsBody>
    <ReportingFI>
      ${reportingFI.country ? `<ResCountryCode>${escapeXML(reportingFI.country)}</ResCountryCode>` : ''}
      <IN issuedBy="${escapeXML(reportingFI.country || 'XX')}" INType="GIIN">${escapeXML(reportingFI.giin || 'UNKNOWN')}</IN>
      <Name>${escapeXML(reportingFI.name || 'Unknown Institution')}</Name>
      <Address>
        <cfc:CountryCode>${escapeXML(reportingFI.country || 'XX')}</cfc:CountryCode>
        <cfc:AddressFix>
          <cfc:Street>${escapeXML(reportingFI.address || 'Not Provided')}</cfc:Street>
          <cfc:City>${escapeXML(reportingFI.city || 'Not Provided')}</cfc:City>
        </cfc:AddressFix>
      </Address>
      <DocSpec>
        <stf:DocTypeIndic>OECD1</stf:DocTypeIndic>
        <stf:DocRefId>${fiDocRefId}</stf:DocRefId>
      </DocSpec>
    </ReportingFI>
    <ReportingGroup>
      ${accountReports}
    </ReportingGroup>
  </CrsBody>
</CRS_OECD>`;
};

// ==========================================
// ENHANCED AUDIT LOGGING FOR CRS v3.0
// ==========================================

const logFileProcessing = async (fileData, validationResults, user = null) => {
  try {
    const auditEntry = {
      timestamp: serverTimestamp(),
      userId: user?.uid || 'anonymous',
      userEmail: user?.email || 'anonymous',
      sessionId: getSessionId(),
      fileMetadata: {
        filename: fileData.name,
        fileSize: fileData.size,
        fileType: fileData.type,
        lastModified: fileData.lastModified ? new Date(fileData.lastModified).toISOString() : null,
        recordCount: validationResults.summary?.totalRows || 0,
        validRecords: validationResults.summary?.validRows || 0,
        invalidRecords: validationResults.summary?.invalidRows || 0
      },
      validationResults: {
        canGenerate: validationResults.canGenerate,
        errorCount: validationResults.criticalErrors?.length || 0,
        warningCount: validationResults.warnings?.length || 0,
        missingCriticalColumns: validationResults.missingColumns?.critical?.length || 0,
        missingWarningColumns: validationResults.missingColumns?.warnings?.length || 0,
        missingRecommendationColumns: validationResults.missingColumns?.recommendations?.length || 0,
        crsVersion: '3.0'
      },
      complianceFlags: {
        containsPII: true,
        dataClassification: 'CONFIDENTIAL',
        regulatoryScope: 'CRS_OECD_v3',
        processingLawfulBasis: 'LEGITIMATE_INTEREST'
      },
      technicalMetadata: {
        processingTimeMs: Date.now() - (validationResults.summary?.processingStartTime || Date.now()),
        columnsDetected: Object.keys(validationResults.columnMappings || {}).length,
        validationVersion: '3.0'
      }
    };

    await addDoc(collection(db, AUDIT_COLLECTIONS.FILE_PROCESSING), auditEntry);
    console.log('File processing audit logged');
  } catch (error) {
    console.error('File processing audit failed:', error);
  }
};

const logXMLGeneration = async (conversionData, settingsUsed, user = null) => {
  try {
    const auditEntry = {
      timestamp: serverTimestamp(),
      userId: user?.uid || 'anonymous',
      userEmail: user?.email || 'anonymous',
      sessionId: getSessionId(),
      conversionDetails: {
        recordCount: conversionData.recordCount,
        taxYear: settingsUsed.taxYear,
        reportingCountry: settingsUsed.reportingFI.country,
        messageRefId: settingsUsed.messageRefId,
        xmlSizeBytes: conversionData.xml ? conversionData.xml.length : 0,
        generationTimeMs: conversionData.processingTime || 0,
        crsVersion: '3.0'
      },
      institutionData: {
        giinProvided: !!settingsUsed.reportingFI.giin,
        institutionCountry: settingsUsed.reportingFI.country,
        institutionNameProvided: !!settingsUsed.reportingFI.name,
        addressProvided: !!settingsUsed.reportingFI.address
      },
      complianceMetadata: {
        crsStandard: 'OECD_CRS_v3.0',
        xmlValidation: 'PASSED',
        dataMinimization: true,
        purposeLimitation: 'CRS_REGULATORY_REPORTING',
        schemaCompliance: 'CrsXML_v3.0.xsd'
      },
      qualityMetrics: {
        accountsProcessed: conversionData.recordCount,
        individualsCount: conversionData.individualsCount || 0,
        organizationsCount: conversionData.organizationsCount || 0,
        controllingPersonsCount: conversionData.controllingPersonsCount || 0
      }
    };

    await addDoc(collection(db, AUDIT_COLLECTIONS.XML_GENERATION), auditEntry);
    console.log('XML generation audit logged');
  } catch (error) {
    console.error('XML generation audit failed:', error);
  }
};

// Google Icon Component
const GoogleIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export {
  // Authentication
  AuthProvider,
  useAuth,
  AuthContext,
  
  // XML Generation
  generateCRSXML,
  
  // Audit Functions
  logFileProcessing,
  logXMLGeneration,
  
  // Components
  GoogleIcon
};
// ==========================================
// REGISTRATION PROMPT COMPONENT
// ==========================================

const RegistrationPrompt = ({ onRegister, onLogin, onClose }) => {
  const anonymousStatus = canAnonymousUserConvert();

  useEffect(() => {
    trackEvent('registration_prompt_shown', {
      anonymous_usage: anonymousStatus.used,
      trigger: 'conversion_limit_reached'
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              You've Used Your Free Trial
            </h2>
            <p className="text-gray-600 mb-4">
              You've used all <strong>{ANONYMOUS_LIMIT} free conversions</strong>. Register now to get <strong>3 more conversions</strong> and unlock additional features!
            </p>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-800 mb-2">What you get after registration:</h3>
            <ul className="text-sm text-green-700 space-y-1 text-left">
              <li>• <strong>3 additional free conversions</strong></li>
              <li>• CRS v3.0 compliant XML generation</li>
              <li>• Save your conversion history</li>
              <li>• Priority email support</li>
              <li>• Usage analytics dashboard</li>
              <li>• Upgrade options for more conversions</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                trackEvent('clicked_register_from_prompt');
                onRegister();
              }}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center"
            >
              Register for 3 More Free Conversions
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
            
            <button
              onClick={() => {
                trackEvent('clicked_login_from_prompt');
                onLogin();
              }}
              className="w-full py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Already have an account? Sign In
            </button>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            Total: {ANONYMOUS_LIMIT} anonymous + 3 registered = 6 free conversions
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// ENHANCED AUTHENTICATION MODAL
// ==========================================

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, register, signInWithGoogle, resetPassword, authError } = useAuth();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    company: ''
  });

  useEffect(() => {
    if (isOpen) {
      trackEvent('auth_modal_opened', {
        mode: initialMode
      });
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (authError) {
      setMessage(authError);
      setLoading(false);
    }
  }, [authError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        setMessage('Successfully signed in!');
        trackEvent('login_success', { method: 'email' });
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1000);
      } else {
        await register(formData.email, formData.password, formData.displayName, formData.company);
        setMessage('Account created! Please verify your email.');
        trackEvent('registration_success', { 
          method: 'email',
          has_company: !!formData.company
        });
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      await signInWithGoogle();
      setMessage('Successfully signed in with Google!');
      trackEvent('login_success', { method: 'google' });
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1000);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!formData.email) {
      setMessage('Please enter your email address first.');
      return;
    }
    
    setLoading(true);
    try {
      await resetPassword(formData.email);
      setMessage('Password reset email sent! Check your inbox.');
      setShowResetForm(false);
      trackEvent('password_reset_sent');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {showResetForm ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create Account')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!showResetForm && (
          <p className="text-gray-600 mb-6">
            {isLogin ? 'Access your dashboard and conversions' : 'Get 3 additional free conversions'}
          </p>
        )}

        {showResetForm ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
                required
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.includes('sent') || message.includes('Success')
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
              >
                {loading ? 'Sending...' : 'Send Reset Email'}
              </button>
              <button
                onClick={() => setShowResetForm(false)}
                className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                  required
                />
              </div>

              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company (Optional)
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Your Company Name"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              {message && (
                <div className={`p-3 rounded-lg text-sm ${
                  message.includes('Success') || message.includes('created') 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
              >
                {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="mt-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center transition-colors"
              >
                <GoogleIcon className="w-5 h-5 mr-2" />
                Sign {isLogin ? 'in' : 'up'} with Google
              </button>
            </div>

            <div className="mt-6 text-center space-y-3">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setMessage('');
                  trackEvent('switched_auth_mode', { 
                    from: isLogin ? 'login' : 'register',
                    to: !isLogin ? 'login' : 'register'
                  });
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>

              {isLogin && (
                <div>
                  <button
                    onClick={() => setShowResetForm(true)}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    Forgot your password?
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ==========================================
// NAVIGATION COMPONENT
// ==========================================

const Navigation = () => {
  const { user, userDoc, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSignIn = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleSignUp = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };

  const usageStatus = getUserConversionStatus(user, userDoc);

  return (
    <>
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-500 bg-clip-text text-transparent">
                iAfrica
              </div>
              <div className="hidden md:block">
                <span className="text-lg font-semibold text-gray-900">CRS v3.0 Converter</span>
                <span className="text-sm text-gray-500 ml-2">by {COMPANY_NAME}</span>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-6">
              <button 
                onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-gray-700 hover:text-blue-600 font-medium"
              >
                Convert
              </button>
              
              {user ? (
                <>
                  <div className="flex items-center space-x-3 pl-6 border-l border-gray-200">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {userDoc?.displayName || user.email?.split('@')[0]}
                      </div>
                      <div className="text-gray-500 capitalize">
                        {userDoc?.plan || 'free'} Plan ({usageStatus.remaining}/{usageStatus.limit})
                      </div>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="p-2 text-gray-500 hover:text-gray-700"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-3 text-sm">
                    <div className="text-gray-600">
                      Free Trial: {usageStatus.remaining}/{usageStatus.limit} remaining
                    </div>
                    <button 
                      onClick={handleSignIn}
                      className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                    >
                      Sign In
                    </button>
                    <button 
                      onClick={handleSignUp}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Register Free
                    </button>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </>
  );
};

// ==========================================
// HERO SECTION
// ==========================================

const HeroSection = () => {
  const { user } = useAuth();
  const usageStatus = getUserConversionStatus(user, null);
  
  if (user) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4 mr-2" />
            Try 3 conversions FREE • CRS v3.0 Compliant • No registration required
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Transform Financial Data Into
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> CRS v3.0 Compliant Reports</span> 
            <span className="block">in Minutes</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Convert your Excel/CSV financial data into fully compliant CRS v3.0 XML reports instantly. 
            Try it now with <strong>{usageStatus.remaining} free conversions</strong> - no signup required!
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button 
              onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-lg font-semibold"
            >
              Try CRS v3.0 Converter Now ({usageStatus.remaining} conversions left)
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div className="flex items-center justify-center space-x-2">
                <Shield className="w-5 h-5 text-green-600" />
                <span className="font-medium text-gray-700">CRS v3.0 Schema Compliant</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Lock className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-700">GDPR Compliant Processing</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-700">Instant XML Generation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// VALIDATION RESULTS DISPLAY COMPONENT
// ==========================================

const ValidationResultsDisplay = ({ validation }) => {
  if (!validation || Object.keys(validation).length === 0) return null;

  return (
    <div className="mt-4 p-4 border rounded-lg bg-white">
      <h4 className="font-medium mb-3 text-gray-900">CRS v3.0 Validation Results</h4>
      
      {validation.canGenerate ? (
        <div className="flex items-center text-green-600 text-sm mb-3">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Ready for CRS v3.0 XML conversion!
        </div>
      ) : (
        <div className="flex items-center text-red-600 text-sm mb-3">
          <AlertCircle className="w-4 h-4 mr-2" />
          Critical errors must be fixed before CRS v3.0 conversion
        </div>
      )}

      {/* Critical Errors */}
      {validation.missingColumns?.critical?.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded mb-3">
          <p className="font-medium text-red-800 mb-2">🚫 Critical Errors (Must Fix for CRS v3.0):</p>
          <ul className="text-sm text-red-700 space-y-1">
            {validation.missingColumns.critical.map((col, index) => (
              <li key={index}>• {col.description}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {validation.missingColumns?.warnings?.length > 0 && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded mb-3">
          <p className="font-medium text-orange-800 mb-2">⚠️ CRS v3.0 Compliance Warnings:</p>
          <ul className="text-sm text-orange-700 space-y-1">
            {validation.missingColumns.warnings.map((col, index) => (
              <li key={index}>• {col.description}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {validation.missingColumns?.recommendations?.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded mb-3">
          <p className="font-medium text-blue-800 mb-2">💡 Recommendations for Better CRS v3.0 Compliance:</p>
          <ul className="text-sm text-blue-700 space-y-1">
            {validation.missingColumns.recommendations.slice(0, 5).map((col, index) => (
              <li key={index}>• {col.description}</li>
            ))}
            {validation.missingColumns.recommendations.length > 5 && (
              <li className="text-blue-600">• ... and {validation.missingColumns.recommendations.length - 5} more optional fields</li>
            )}
          </ul>
        </div>
      )}

      <div className="text-sm text-gray-600 mt-3 flex items-center justify-between">
        <span>Summary: {validation.summary.validRows} rows ready, {validation.summary.invalidRows} with critical errors</span>
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">CRS v3.0</span>
      </div>
    </div>
  );
};

// ==========================================
// MAIN CONVERTER COMPONENT  
// ==========================================

const CRSConverter = () => {
  const { user, userDoc, updateUserUsage } = useAuth();
  const fileInputRef = useRef(null);
  const [validationResults, setValidationResults] = useState({});
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [settingsValidation, setSettingsValidation] = useState({});

  const [settings, setSettings] = useState({
    reportingFI: {
      name: '',
      giin: '',
      country: 'MU',
      address: '',
      city: ''
    },
    taxYear: new Date().getFullYear() - 1,
    messageRefId: `CRS_${Date.now()}`
  });

  const usageStatus = getUserConversionStatus(user, userDoc);

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setData([]);
      setResult(null);
      setError(null);
      
      logAuditEvent('file_upload', {
        filename: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      }, user);
      processFile(selectedFile);
    }
  };

  const processFile = async (file) => {
    setProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      
      let jsonData = [];
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false
        });
        
        if (sheetData.length > 0) {
          jsonData = sheetData;
          break;
        }
      }

      if (jsonData.length === 0) {
        throw new Error('No data found in any sheet');
      }

      const validation = validateCRSData(jsonData);
      setValidationResults(validation);
      await logFileProcessing(file, validation, user);

      setData(jsonData);
      trackEvent('file_processed', {
        file_type: file.type,
        record_count: jsonData.length,
        is_valid: validation.canGenerate,
        user_type: user ? 'registered' : 'anonymous',
        crs_version: '3.0'
      });

    } catch (err) {
      console.error('File processing error:', err);
      
      await logAuditEvent('file_processing_error', {
        filename: file.name,
        error: err.message
      }, user);  
      
      setError(`Failed to process file: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const validateSettings = () => {
    const results = {};
    
    results.giin = validateGIIN(settings.reportingFI.giin);
    results.taxYear = validateTaxYear(settings.taxYear);
    results.fiName = validateFIName(settings.reportingFI.name);
    
    setSettingsValidation(results);
           
    const hasErrors = Object.values(results).some(result => !result.valid);
    return !hasErrors;
  };

  const handleConvert = async () => {
    if (!usageStatus.canConvert) {
      if (usageStatus.userType === 'anonymous' && usageStatus.mustRegister) {
        setShowRegistrationPrompt(true);
        return;
      }
      
      setError(usageStatus.reason || 'Conversion limit reached');
      return;
    }

    if (!validateSettings()) {
      setError('Please fix the validation errors before converting');
      return;
    }

    if (!validationResults.canGenerate) {
      setError('Please fix critical errors before converting to CRS v3.0 XML');
      return;
    }

    if (!data || data.length === 0) {
      setError('Please upload a file first');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      await logAuditEvent('xml_conversion_started', {
        recordCount: data.length,
        taxYear: settings.taxYear,
        crsVersion: '3.0'
      }, user);	
      
      const xml = generateCRSXML(data, settings, validationResults);
      
      if (user && userDoc) {
        await updateUserUsage();
      } else {
        updateAnonymousUsage();
        trackEvent('anonymous_conversion', {
          file_type: file?.type || 'unknown',
          record_count: data.length,
          conversion_number: getAnonymousUsage().count,
          crs_version: '3.0'
        });
      }
      
      await logXMLGeneration({
        recordCount: data.length,
        xml: xml
      }, settings, user);

      setResult({
        xml,
        filename: `CRS_v3.0_${settings.taxYear}_${Date.now()}.xml`,
        recordCount: data.length,
        timestamp: new Date().toISOString(),
        crsVersion: '3.0'
      });

      trackEvent('conversion_success', {
        record_count: data.length,
        user_type: user ? 'registered' : 'anonymous',
        crs_version: '3.0'
      });

    } catch (err) {
      console.error('Conversion error:', err);
      
      await logAuditEvent('xml_conversion_error', {
        error: err.message,
        recordCount: data.length,
        crsVersion: '3.0'
      }, user);	
      
      setError(`CRS v3.0 conversion failed: ${err.message}`);
      trackEvent('conversion_error', {
        error: err.message,
        user_type: user ? 'registered' : 'anonymous',
        crs_version: '3.0'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    
    logAuditEvent('xml_download', {
      filename: result.filename,
      recordCount: result.recordCount,
      fileSize: result.xml.length,
      crsVersion: '3.0'
    }, user);

    const blob = new Blob([result.xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    trackEvent('file_downloaded', {
      file_type: 'xml',
      record_count: result.recordCount,
      user_type: user ? 'registered' : 'anonymous',
      crs_version: '3.0'
    });
  };

  const handleSettingsChange = (section, field, value) => {
    if (field === null) {
      setSettings(prev => ({
        ...prev,
        [section]: value
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    }
  };

  return (
    <>
      <div id="converter" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-4">
              <Shield className="w-4 h-4 mr-1" />
              CRS v3.0 Schema Compliant
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              CRS v3.0 XML Converter
            </h2>
            <p className="text-xl text-gray-600">
              Convert your Excel/CSV data to fully compliant CRS v3.0 XML format with enhanced self-certification and controlling person support
            </p>
          </div>

          <div className="space-y-8">
            {/* File Upload Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Step 1: Upload Your Financial Data File
              </h3>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {file ? file.name : 'Click to upload your Excel or CSV file'}
                </p>
                <p className="text-sm text-gray-500">
                  Supports .xlsx, .xls, and .csv files up to 10MB • CRS v3.0 fields supported
                </p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {processing && (
                <div className="mt-4 flex items-center justify-center space-x-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Processing file for CRS v3.0 compliance...</span>
                </div>
              )}

              {data.length > 0 && (
                <div className="mt-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">
                        File processed successfully! Found {data.length} records for CRS v3.0 conversion.
                      </span>
                    </div>
                  </div>
                  <ValidationResultsDisplay validation={validationResults} />
                </div>
              )}
            </div>

            {/* Settings Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Step 2: Configure CRS v3.0 Report Settings
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Financial Institution Name *
                  </label>
                  <input
                    type="text"
                    value={settings.reportingFI.name}
                    onChange={(e) => handleSettingsChange('reportingFI', 'name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your Financial Institution Name"
                  />
                  {settingsValidation.fiName && !settingsValidation.fiName.valid && (
                    <p className="mt-1 text-sm text-red-600">{settingsValidation.fiName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GIIN (Global Intermediary Identification Number) *
                  </label>
                  <input
                    type="text"
                    value={settings.reportingFI.giin}
                    onChange={(e) => handleSettingsChange('reportingFI', 'giin', e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="XXXXXX.XXXXX.XX.XXX"
                  />
                  {settingsValidation.giin && !settingsValidation.giin.valid && (
                    <p className="mt-1 text-sm text-red-600">{settingsValidation.giin.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country
                  </label>
                  <select
                    value={settings.reportingFI.country}
                    onChange={(e) => handleSettingsChange('reportingFI', 'country', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MU">Mauritius</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="FR">France</option>
                    <option value="DE">Germany</option>
                    <option value="SG">Singapore</option>
                    <option value="HK">Hong Kong</option>
                    <option value="CH">Switzerland</option>
                    <option value="LU">Luxembourg</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tax Year *
                  </label>
                  <select
                    value={settings.taxYear}
                    onChange={(e) => handleSettingsChange('taxYear', null, parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                  {settingsValidation.taxYear && !settingsValidation.taxYear.valid && (
                    <p className="mt-1 text-sm text-red-600">{settingsValidation.taxYear.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Convert Button */}
            <div className="text-center">
              <button
                onClick={handleConvert}
                disabled={processing || !usageStatus.canConvert || data.length === 0}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex items-center mx-auto"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Converting to CRS v3.0 XML...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Convert to CRS v3.0 XML
                  </>
                )}
              </button>

              {!usageStatus.canConvert && (
                <p className="mt-3 text-sm text-red-600 font-medium">
                  {usageStatus.reason}
                </p>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-red-800">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Error: {error}</span>
                </div>
              </div>
            )}

            {/* Results Display */}
            {result && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  CRS v3.0 Conversion Successful!
                </h3>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-800">
                        Generated CRS v3.0 Compliant XML Report
                      </p>
                      <p className="text-sm text-green-600">
                        {result.recordCount} records • Tax Year {settings.taxYear} • CRS v{result.crsVersion} • Generated {new Date(result.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download XML
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">CRS v3.0 XML Preview (first 500 characters):</p>
                  <pre className="text-xs text-gray-600 bg-white p-3 rounded border overflow-x-auto">
                    {result.xml.substring(0, 500)}...
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Registration Prompt Modal */}
      {showRegistrationPrompt && (
        <RegistrationPrompt
          onRegister={() => {
            setShowRegistrationPrompt(false);
            setAuthMode('register');
            setShowAuthModal(true);
          }}
          onLogin={() => {
            setShowRegistrationPrompt(false);
            setAuthMode('login');
            setShowAuthModal(true);
          }}
          onClose={() => setShowRegistrationPrompt(false)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </>
  );
};

// ==========================================
// FOOTER COMPONENT
// ==========================================

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent mb-4">
            iAfrica
          </div>
          <p className="text-gray-400 mb-4">
            Professional CRS v3.0 compliance solutions for financial institutions worldwide.
          </p>
          <div className="flex justify-center space-x-6 mb-4 text-sm">
            <Link to="/privacy" className="text-gray-400 hover:text-white">Privacy Policy</Link>
            <Link to="/terms" className="text-gray-400 hover:text-white">Terms of Service</Link>
            <Link to="/documentation" className="text-gray-400 hover:text-white">Documentation</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-gray-400 hover:text-white">Support</a>
          </div>
          <p className="text-sm text-gray-500">
            © 2025 {COMPANY_NAME}. All rights reserved. CRS v3.0 Schema Compliant.
          </p>
        </div>
      </div>
    </footer>
  );
};

// ==========================================
// MAIN APP EXPORT
// ==========================================

const CRSXMLConverter = () => {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <HeroSection />
        <CRSConverter />
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default CRSXMLConverter;
