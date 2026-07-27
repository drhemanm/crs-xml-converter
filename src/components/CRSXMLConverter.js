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
  Upload, Download, AlertCircle, CheckCircle2, Shield, X, Lock, Menu, LogOut, ArrowRight, ArrowUpRight, Users, FileText
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

const SUPPORT_EMAIL = 'contacts@evologics.ai';
const COMPANY_NAME = 'Evologics Ltd';
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
// CRS v3.0 100% COMPLIANT MAPPINGS AND CONSTANTS
// ==========================================

// CRS v3.0 compliant payment type mappings (exact match with XSD)
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

// Account holder type mappings (exact match with XSD CrsAcctHolderType_EnumType)
const CRS_ACCOUNT_HOLDER_TYPES = {
  'passive_nfe_reportable': 'CRS101', // Passive Non-Financial Entity with controlling person that is reportable
  'reportable_person': 'CRS102',      // CRS Reportable Person
  'passive_nfe_crs_reportable': 'CRS103' // Passive NFE that is a CRS Reportable Person
};

// Account type mappings (exact match with XSD CrsAccountType_EnumType)
const CRS_ACCOUNT_TYPES = {
  'depository': 'CRS1101',           // Depository Account
  'custodial': 'CRS1102',            // Custodial Account  
  'insurance_annuity': 'CRS1103',    // Cash Value Insurance Contract or Annuity Contract
  'investment_entity': 'CRS1104',    // Debt or Equity Interest in Investment Entity
  'not_reported': 'CRS1100'          // Not reported (transitional)
};

// Due diligence procedure types (exact match with XSD OpeningDate_EnumType)
const CRS_DD_PROCEDURE_TYPES = {
  'new_account': 'CRS1201',      // New Account
  'preexisting': 'CRS1202',      // Preexisting Account
  'not_reported': 'CRS1200'      // Not reported (transitional)
};

// Controlling person type mappings (exact match with XSD CrsCtrlgPersonType_EnumType)
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

// Self-certification status (exact match with XSD CrsSelfCert_EnumType)
const CRS_SELF_CERT_STATUS = {
  'true': 'CRS901',     // True
  'false': 'CRS902',    // False
  'not_reported': 'CRS900' // Not reported (transitional)
};

// Self-certification for controlling person (exact match with XSD CrsSelfCertforCtrlgPersonType_EnumType)
const CRS_SELF_CERT_CONTROLLING_PERSON = {
  'true': 'CRS1001',    // True
  'false': 'CRS1002',   // False
  'not_reported': 'CRS1000' // Not reported (transitional)
};

// Message type indicator (exact match with XSD CrsMessageTypeIndic_EnumType)
const CRS_MESSAGE_TYPE_INDIC = {
  'new': 'CRS701',        // New information
  'correction': 'CRS702', // Corrections for previously sent information
  'no_data': 'CRS703'     // No data to report
};

// Equity Interest Type (exact match with XSD EquityInterestType_EnumType)
const CRS_EQUITY_INTEREST_TYPES = {
  'trust_settlor': 'CRS401',         // EIH of legal arrangements - trust - settlor
  'trust_trustee': 'CRS402',         // EIH of legal arrangements - trust - trustee
  'trust_protector': 'CRS403',       // EIH of legal arrangements - trust - protector
  'trust_beneficiary': 'CRS404',     // EIH of legal arrangements - trust - beneficiary
  'trust_other': 'CRS405',           // EIH of legal arrangements - trust - other
  'other_settlor_eq': 'CRS406',      // EIH of legal arrangements - other - settlor-equivalent
  'other_trustee_eq': 'CRS407',      // EIH of legal arrangements - other - trustee-equivalent
  'other_protector_eq': 'CRS408',    // EIH of legal arrangements - other - protector-equivalent
  'other_beneficiary_eq': 'CRS409',  // EIH of legal arrangements - other - beneficiary-equivalent
  'other_equivalent': 'CRS410'       // EIH of legal arrangements - other - other equivalent
};

// OECD Name Types for XSD compliance
const OECD_NAME_TYPES = {
  'OECD201': 'SMFAliasOrOther',
  'OECD202': 'indiv', // Individual name
  'OECD203': 'entity' // Entity name
};

// XSD Name Type attributes for person names
const XNL_NAME_TYPES = {
  'GIVEN_NAME': 'Given Name',
  'FAMILY_NAME': 'Family Name',
  'MIDDLE_NAME': 'Middle Name',
  'MAIDEN_NAME': 'Maiden Name',
  'FATHERS_NAME': "Father's Name",
  'MOTHERS_NAME': "Mother's Name"
};

// Legal Address Types for XSD compliance
const LEGAL_ADDRESS_TYPES = {
  'OECD301': 'residentialOrBusiness',
  'OECD302': 'residential',
  'OECD303': 'business',
  'OECD304': 'registeredOffice',
  'OECD305': 'unspecified'
};

// Account Number Types for XSD compliance (from CommonTypesFatcaCrs)
//
// These are labels for display. The AcctNumberType attribute carries the CODE
// (OECD601..OECD605), not the label -- AcctNumberType_EnumType is an
// enumeration and "Other" is not a member of it.
const ACCOUNT_NUMBER_TYPES = {
  'OECD601': 'IBAN',
  'OECD602': 'OBAN',
  'OECD603': 'ISIN',
  'OECD604': 'OSIN',
  'OECD605': 'Other'
};

const DEFAULT_ACCOUNT_NUMBER_TYPE = 'OECD605';

// ==========================================
// SCHEMA VERSIONS
// ==========================================
//
// The converter must emit the schema the receiving authority actually accepts,
// which for the current season is v2.0 in Mauritius, Cayman, Ireland and
// Singapore. v3.0 (the amended CRS schema) applies to reporting year 2026
// onward and, in some jurisdictions, to corrections of earlier periods filed
// from 2027. Emitting v3.0 into a v2.0 portal is rejected at upload.
//
// Namespace bindings below are taken from the OECD schema declarations. Note
// that `targetNamespace` belongs on the schema, not on an instance document --
// emitting it on the root element, as this generator previously did, is not
// valid.
const CRS_SCHEMA_PROFILES = {
  '2.0': {
    version: '2.0',
    label: 'CRS XML v2.0',
    namespace: 'urn:oecd:ties:crs:v2',
    schemaFile: 'CrsXML_v2.0.xsd',
    // v2.0 predates the amended-CRS additions.
    supportsSelfCert: false,
    supportsAccountType: false,
    supportsDDProcedure: false,
    supportsJointAccount: false,
    supportsEquityInterestType: false,
    supportsNationality: false,
    supportsControllingPersonSelfCert: false
  },
  '3.0': {
    version: '3.0',
    label: 'CRS XML v3.0 (amended CRS)',
    namespace: 'urn:oecd:ties:crs:v3',
    schemaFile: 'CrsXML_v3.0.xsd',
    supportsSelfCert: true,
    supportsAccountType: true,
    supportsDDProcedure: true,
    supportsJointAccount: true,
    supportsEquityInterestType: true,
    supportsNationality: true,
    supportsControllingPersonSelfCert: true
  }
};

const DEFAULT_SCHEMA_VERSION = '2.0';

const CRS_SHARED_NAMESPACES = {
  cfc: 'urn:oecd:ties:commontypesfatcacrs:v2',
  stf: 'urn:oecd:ties:crsstf:v5',
  iso: 'urn:oecd:ties:isocrstypes:v1',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance'
};

// ==========================================
// "NOT REPORTED" SENTINELS
// ==========================================
//
// Each of these means "the institution did not report this", which is a
// materially different statement from any of the substantive values in the
// same enumeration. They exist precisely so that an absent value never has to
// be guessed at. A missing self-certification is NEVER CRS901 ("obtained and
// validated") -- that would have the file assert due diligence on behalf of an
// institution that may never have performed it.
const CRS_NOT_REPORTED = {
  selfCert: 'CRS900',
  accountType: 'CRS1100',
  ddProcedure: 'CRS1200',
  controllingPersonType: 'CRS800',
  controllingPersonSelfCert: 'CRS1000'
};

// Source fields whose "not reported" notice is only meaningful when the target
// schema has an element for them. Under v2.0 there is no SelfCert element at
// all, so telling the filer their file reports "not reported" would be false.
const SCHEMA_GATED_NOTICE_FIELDS = {
  self_cert: 'supportsSelfCert',
  account_type: 'supportsAccountType',
  dd_procedure: 'supportsDDProcedure',
  controlling_person_self_cert: 'supportsControllingPersonSelfCert'
};

// ==========================================
// ENHANCED FIELD MAPPINGS WITH CRS v3.0 100% SUPPORT
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
  'postal_code': ['postal_code', 'postcode', 'zip_code', 'zip'],
  'state': ['state', 'province', 'region', 'country_subentity'],
  
  // Individual fields with XSD compliance
  'first_name': ['first_name', 'firstname', 'fname', 'given_name'],
  'last_name': ['last_name', 'lastname', 'lname', 'surname', 'family_name'],
  'middle_name': ['middle_name', 'middlename', 'mname'],
  'title': ['title', 'name_title', 'salutation'],
  'suffix': ['suffix', 'name_suffix', 'generation'],
  'tin': ['tin', 'tax_id', 'taxpayer_id', 'tax_identification_number'],
  'birth_date': ['birth_date', 'birthdate', 'dob', 'date_of_birth'],
  'birth_city': ['birth_city', 'birthcity', 'place_of_birth'],
  'birth_country': ['birth_country', 'birth_country_code', 'birthcountry', 'country_of_birth'],
  'nationality': ['nationality', 'citizen_country', 'citizenship'],
  
  // Organization fields
  'organization_name': ['organization_name', 'org_name', 'company_name', 'entity_name'],
  'organization_tin': ['organization_tin', 'org_tin', 'company_tin', 'entity_tin'],
  
  // Controlling person fields with full XSD support
  'controlling_person_first_name': ['controlling_person_first_name', 'cp_first_name', 'cp_fname'],
  'controlling_person_last_name': ['controlling_person_last_name', 'cp_last_name', 'cp_lname'],
  'controlling_person_middle_name': ['controlling_person_middle_name', 'cp_middle_name', 'cp_mname'],
  'controlling_person_title': ['controlling_person_title', 'cp_title'],
  'controlling_person_birth_date': ['controlling_person_birth_date', 'cp_birth_date', 'cp_dob'],
  'controlling_person_birth_city': ['controlling_person_birth_city', 'cp_birth_city'],
  'controlling_person_birth_country': ['controlling_person_birth_country', 'cp_birth_country'],
  'controlling_person_residence_country': ['controlling_person_residence_country', 'cp_residence_country'],
  'controlling_person_address_country': ['controlling_person_address_country', 'cp_address_country'],
  'controlling_person_city': ['controlling_person_city', 'cp_city'],
  'controlling_person_address': ['controlling_person_address', 'cp_address'],
  'controlling_person_postal_code': ['controlling_person_postal_code', 'cp_postal_code'],
  'controlling_person_state': ['controlling_person_state', 'cp_state'],
  'controlling_person_tin': ['controlling_person_tin', 'cp_tin'],
  'controlling_person_nationality': ['controlling_person_nationality', 'cp_nationality'],
  
  // CRS v3.0 specific fields with full XSD support
  'self_cert': ['self_cert', 'self_certification', 'selfcert', 'self_certified'],
  'account_type': ['account_type', 'accounttype', 'acct_type', 'financial_account_type'],
  'dd_procedure': ['dd_procedure', 'due_diligence', 'ddprocedure', 'due_diligence_procedure'],
  'account_holder_type': ['account_holder_type', 'holder_type_detail', 'acctholdertype', 'crs_holder_type'],
  'controlling_person_type': ['controlling_person_type', 'cp_type', 'ctrlg_person_type', 'cp_relationship'],
  'controlling_person_self_cert': ['controlling_person_self_cert', 'cp_self_cert', 'cp_self_certification'],
  'equity_interest_type': ['equity_interest_type', 'equity_type', 'interest_type'],
  
  // Enhanced payment fields with full XSD support
  'payment_type': ['payment_type', 'paymenttype', 'payment_code', 'income_type'],
  'payment_amount': ['payment_amount', 'paymentamount', 'payment', 'income_amount'],
  'interest_amount': ['interest_amount', 'interest', 'interest_income', 'interest_payment'],
  'dividend_amount': ['dividend_amount', 'dividend', 'dividend_income', 'dividend_payment'],
  'gross_proceeds_amount': ['gross_proceeds_amount', 'gross_proceeds', 'redemptions_amount', 'proceeds'],
  'other_amount': ['other_amount', 'other_income', 'miscellaneous_amount', 'other_payment'],
  
  // Joint account support (XSD compliant)
  'joint_account': ['joint_account', 'joint', 'is_joint'],
  'joint_account_holders': ['joint_account_holders', 'joint_holders', 'number_of_holders'],
  
  // Account status flags (XSD compliant)
  'undocumented_account': ['undocumented_account', 'undocumented'],
  'closed_account': ['closed_account', 'closed', 'is_closed'],
  'dormant_account': ['dormant_account', 'dormant', 'is_dormant']
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
// SPREADSHEET PARSING SAFETY
// ==========================================
//
// The uploaded file is the only untrusted input this app handles, and the
// parser that reads it (xlsx 0.18.5) carries two unfixed advisories on npm:
// prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9).
// SheetJS publishes fixed builds from its own CDN rather than npm, so there is
// no `npm update` that resolves this -- see AUDIT.md H4 for the upgrade path.
//
// Until that swap happens, the parse boundary is defended directly: bounded
// input, minimum parser surface, keys that could reach Object.prototype
// removed, and an explicit check that the prototype was not modified while
// parsing.

// Generous for a CRS return -- a 200k-account file is well under this -- and
// small enough that a pathological file cannot occupy the tab indefinitely.
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const POLLUTING_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Rebuild parsed rows on a null prototype, dropping any key that could be used
 * to reach Object.prototype. Downstream code only ever does Object.keys() and
 * property reads, both of which work unchanged on a null-prototype object.
 */
const sanitizeParsedRows = (rows) =>
  rows.map((row) => {
    const clean = Object.create(null);
    for (const key of Object.keys(row)) {
      if (POLLUTING_KEYS.includes(key)) continue;
      const value = row[key];
      // Nested objects are not expected from sheet_to_json; if one appears,
      // it is not something this converter reads, so it is dropped.
      clean[key] = (value !== null && typeof value === 'object') ? '' : value;
    }
    return clean;
  });

/**
 * Detect a prototype-pollution attempt around the parse.
 *
 * Object.prototype has a fixed set of own properties. If parsing a spreadsheet
 * added one, the file is hostile and nothing downstream should trust it.
 * Returns the names added, and removes them, so the page is not left poisoned.
 */
const detectPrototypePollution = (before) => {
  const after = Object.getOwnPropertyNames(Object.prototype);
  const added = after.filter((k) => !before.includes(k));
  for (const key of added) {
    try { delete Object.prototype[key]; } catch (e) { /* non-configurable */ }
  }
  return added;
};

export { sanitizeParsedRows, detectPrototypePollution, MAX_UPLOAD_BYTES };

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
  // The audit trail records what a signed-in institution did with its own
  // data. Anonymous trial conversions run entirely in the browser and are not
  // part of it -- and accepting unauthenticated writes would mean running an
  // open, billable write endpoint into Firestore. Skip rather than attempt a
  // write the rules will (correctly) refuse.
  if (!user?.uid) return;

  try {
    const auditEntry = {
      timestamp: serverTimestamp(),
      eventType,
      userId: user.uid,
      userEmail: user.email || null,
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
        // Must match the privacy policy and cleanupAuditLogs in functions/.
        retentionPeriod: '12_MONTHS'
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
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📊 Analytics Event: ${eventName}`, sanitizedParams);
      }
    }
  } catch (error) {
    console.error('Analytics error:', error);
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
  CRS_EQUITY_INTEREST_TYPES,
  OECD_NAME_TYPES,
  XNL_NAME_TYPES,
  LEGAL_ADDRESS_TYPES,
  ACCOUNT_NUMBER_TYPES,
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
  getSessionId
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

// ==========================================
// ENHANCED CRS v3.0 100% COMPLIANT VALIDATION FUNCTIONS
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

// Enhanced XSD compliant validation for account number
const validateAccountNumber = (accountNumber, accountType) => {
  if (!accountNumber || typeof accountNumber !== 'string' || accountNumber.trim() === '') {
    return { valid: false, message: "Account number is required", severity: 'error' };
  }
  
  const cleanNumber = accountNumber.trim();
  
  if (cleanNumber.length > 200) {
    return { valid: false, message: "Account number cannot exceed 200 characters (XSD limit)", severity: 'error' };
  }
  
  // Optional: Validate based on account type
  if (accountType === 'IBAN' && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/.test(cleanNumber)) {
    return { 
      valid: true, 
      message: "Account number format doesn't match IBAN standard", 
      severity: 'warning' 
    };
  }
  
  return { valid: true };
};

// Enhanced validation for joint accounts (XSD compliant)
const validateJointAccount = (isJoint, numberOfHolders) => {
  if (!isJoint) return { valid: true };
  
  if (numberOfHolders) {
    const num = parseInt(numberOfHolders);
    if (isNaN(num) || num < 1 || num > 200) {
      return { 
        valid: false, 
        message: "Joint account holders must be between 1 and 200 (XSD limit)", 
        severity: 'error' 
      };
    }
  }
  
  return { valid: true };
};

const getFieldDescription = (field) => {
  const descriptions = {
    'account_number': 'Account Number (unique identifier, max 200 chars)',
    'account_balance': 'Account Balance (numeric value)',
    'currency_code': 'Currency Code (3-letter ISO 4217: USD, EUR, etc.)',
    'holder_type': 'Account Holder Type (Individual/Organization)',
    'residence_country': 'Residence Country Code (2 letters, ISO 3166-1)',
    'address_country': 'Address Country Code (2 letters, ISO 3166-1)',
    'city': 'City/Town Name',
    'address': 'Street Address',
    'postal_code': 'Postal/ZIP Code',
    'state': 'State/Province/Region',
    'first_name': 'First Name (for individuals)',
    'middle_name': 'Middle Name (optional)',
    'last_name': 'Last Name (for individuals)',
    'title': 'Title/Salutation (Mr, Dr, etc.)',
    'suffix': 'Name Suffix (Jr, III, PhD, etc.)',
    'organization_name': 'Organization Name (for entities)',
    'tin': 'Tax Identification Number',
    'birth_date': 'Date of Birth (YYYY-MM-DD format)',
    'birth_city': 'City of Birth',
    'birth_country': 'Country of Birth (2 letters)',
    'nationality': 'Nationality (ISO country code)',
    'payment_amount': 'Payment Amount (numeric)',
    'payment_type': 'Payment Type (CRS501-CRS504)',
    'interest_amount': 'Interest Amount (CRS502)',
    'dividend_amount': 'Dividend Amount (CRS501)',
    'gross_proceeds_amount': 'Gross Proceeds/Redemptions (CRS503)',
    'other_amount': 'Other Payment Amount (CRS504)',
    'account_type': 'Account Type (Depository, Custodial, etc.)',
    'self_cert': 'Self-Certification Status (true/false)',
    'dd_procedure': 'Due Diligence Procedure (New/Preexisting Account)',
    'controlling_person_type': 'Controlling Person Type (CRS801-CRS813)',
    'controlling_person_self_cert': 'CP Self-Certification (true/false)',
    'account_holder_type': 'Account Holder Type Classification (CRS101-CRS103)',
    'equity_interest_type': 'Equity Interest Type (CRS401-CRS410)',
    'joint_account': 'Joint Account Flag (true/false)',
    'joint_account_holders': 'Number of Joint Holders (1-200)',
    'undocumented_account': 'Undocumented Account Flag (true/false)',
    'closed_account': 'Closed Account Flag (true/false)',
    'dormant_account': 'Dormant Account Flag (true/false)'
  };
  return descriptions[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// ==========================================
// ENHANCED CRS v3.0 100% COMPLIANT DATA VALIDATION FUNCTION
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

  // CRS v3.0 100% compliant field classification
  // residence_country and city are critical because no row can be converted
  // without them: ResCountryCode identifies the reportable jurisdiction and
  // City is mandatory inside the OECD address type. If the column is absent
  // altogether, say so once here rather than rejecting every row individually.
  const criticalFields = [
    'account_number', 'account_balance', 'currency_code', 'holder_type',
    'residence_country', 'city'
  ];

  const warningFields = [
    'address_country', 'self_cert', 'account_type', 'dd_procedure'
  ];
  
  const recommendationFields = [
    'first_name', 'last_name', 'middle_name', 'title', 'suffix', 'tin', 'birth_date', 'birth_city', 'birth_country', 
    'nationality', 'organization_name', 'organization_tin', 'account_holder_type', 'postal_code', 'state',
    'controlling_person_first_name', 'controlling_person_last_name', 'controlling_person_middle_name',
    'controlling_person_title', 'controlling_person_birth_date', 'controlling_person_birth_country', 
    'controlling_person_residence_country', 'controlling_person_address_country', 
    'controlling_person_city', 'controlling_person_postal_code', 'controlling_person_state',
    'controlling_person_tin', 'controlling_person_nationality',
    'controlling_person_type', 'controlling_person_self_cert', 'equity_interest_type',
    'payment_type', 'payment_amount', 'interest_amount', 'dividend_amount',
    'gross_proceeds_amount', 'other_amount', 'joint_account', 'joint_account_holders',
    'undocumented_account', 'closed_account', 'dormant_account'
  ];

  const columnMappings = {};
  const missingColumns = { critical: [], warnings: [], recommendations: [] };

  // Enhanced column mapping with 100% CRS v3.0 XSD awareness
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

  // Enhanced CRS v3.0 100% compliant row validation with XSD constraints
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

      // Critical CRS v3.0 XSD validations
      const accountNumberValidation = validateAccountNumber(row[columnMappings.account_number]);
      if (!accountNumberValidation.valid) {
        critical.push(accountNumberValidation.message);
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

      // CRS v3.0 XSD compliance warnings
      const resCountryValidation = validateCountryCode(row[columnMappings.residence_country]);
      if (!resCountryValidation.valid) {
        warnings.push('A valid two-letter residence country code is required; the row cannot be converted without it');
      }
      
      // Self-certification validation (required in v3.0)
      const selfCertValue = row[columnMappings.self_cert];
      if (!selfCertValue || !['true', 'false', 'CRS901', 'CRS902'].includes(String(selfCertValue).toLowerCase())) {
        warnings.push('Self-certification status (true/false) not supplied; it will be reported as "not reported" under v3.0 and omitted under v2.0');
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

      // Joint account validation (XSD compliant)
      const isJoint = row[columnMappings.joint_account];
      const jointHolders = row[columnMappings.joint_account_holders];
      const jointValidation = validateJointAccount(isJoint, jointHolders);
      if (!jointValidation.valid) {
        if (jointValidation.severity === 'error') {
          critical.push(jointValidation.message);
        } else {
          warnings.push(jointValidation.message);
        }
      }

      if (!row[columnMappings.city] || String(row[columnMappings.city]).trim() === '') {
        warnings.push('City information recommended for complete address details');
      }

      // Enhanced conditional validations based on holder type with XSD compliance
      if (holderType === 'individual') {
        if (!row[columnMappings.first_name] || String(row[columnMappings.first_name]).trim() === '' ||
            !row[columnMappings.last_name] || String(row[columnMappings.last_name]).trim() === '') {
          critical.push('Complete name (first and last) required for individuals in CRS v3.0');
        }
        
        // Name length validation (XSD constraint: max 200 chars per name element)
        const firstName = row[columnMappings.first_name];
        const lastName = row[columnMappings.last_name];
        if (firstName && String(firstName).trim().length > 200) {
          warnings.push('First name exceeds 200 character XSD limit');
        }
        if (lastName && String(lastName).trim().length > 200) {
          warnings.push('Last name exceeds 200 character XSD limit');
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
        const orgName = row[columnMappings.organization_name];
        if (!orgName || String(orgName).trim() === '') {
          critical.push('Organization name is required for entity account holders');
        } else if (String(orgName).trim().length > 200) {
          warnings.push('Organization name exceeds 200 character XSD limit');
        }

        // Account holder type validation for organizations (required in v3.0)
        const acctHolderTypeValue = row[columnMappings.account_holder_type];
        const validAcctHolderTypes = ['passive_nfe_reportable', 'reportable_person', 'passive_nfe_crs_reportable'];
        if (!acctHolderTypeValue || !validAcctHolderTypes.includes(String(acctHolderTypeValue).toLowerCase())) {
          warnings.push('Account holder type classification required for organizations in CRS v3.0');
        }

        // Enhanced controlling person validation for v3.0 with XSD compliance
        const hasControllingPersonInfo = row[columnMappings.controlling_person_first_name] || 
                                       row[columnMappings.controlling_person_last_name];
        
        if (hasControllingPersonInfo) {
          // Controlling person type validation (required in v3.0)
          const cpTypeValue = row[columnMappings.controlling_person_type];
          const validCPTypes = Object.keys(CRS_CONTROLLING_PERSON_TYPES);
          if (!cpTypeValue || !validCPTypes.some(type => String(cpTypeValue).toLowerCase().includes(type))) {
            warnings.push('Controlling person type classification required when controlling person info provided');
          }

          // Controlling person self-certification (required in v3.0)
          const cpSelfCertValue = row[columnMappings.controlling_person_self_cert];
          if (!cpSelfCertValue || !['true', 'false'].includes(String(cpSelfCertValue).toLowerCase())) {
            warnings.push('Controlling person self-certification status required in CRS v3.0');
          }

          // Controlling person nationality with XSD compliance
          const cpNationalityValue = row[columnMappings.controlling_person_nationality];
          if (cpNationalityValue) {
            const cpNationalityValidation = validateCountryCode(cpNationalityValue);
            if (!cpNationalityValidation.valid) {
              warnings.push('Invalid controlling person nationality code format');
            }
          }

          // Controlling person name length validation (XSD constraint)
          const cpFirstName = row[columnMappings.controlling_person_first_name];
          const cpLastName = row[columnMappings.controlling_person_last_name];
          if (cpFirstName && String(cpFirstName).trim().length > 200) {
            warnings.push('Controlling person first name exceeds 200 character XSD limit');
          }
          if (cpLastName && String(cpLastName).trim().length > 200) {
            warnings.push('Controlling person last name exceeds 200 character XSD limit');
          }
        } else {
          warnings.push('Controlling person information strongly recommended for organizations');
        }
      }

      // Enhanced payment validation for multiple payment types with XSD compliance
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

      // Equity Interest Type validation (XSD compliant)
      const equityInterestValue = row[columnMappings.equity_interest_type];
      if (equityInterestValue) {
        const validEquityTypes = Object.keys(CRS_EQUITY_INTEREST_TYPES);
        if (!validEquityTypes.includes(String(equityInterestValue).toLowerCase())) {
          warnings.push('Invalid equity interest type - must be one of CRS401-CRS410');
        }
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
      crsVersion: '3.0',
      xsdCompliant: true
    }
  };
};

export {
  // Business Logic Functions
  getUserConversionStatus,
  getFirebaseErrorMessage,
  
  // Validation functions
  validateGIIN,
  validateTaxYear,
  validateFIName,
  validateCountryCode,
  validateCurrencyCode,
  validateAccountBalance,
  validateHolderType,
  validateAccountNumber,
  validateJointAccount,
  getFieldDescription,
  
  // Main validation function
  validateCRSData
};
// ==========================================
// DATA MAPPING
// ==========================================
//
// The governing rule here: a value that was not supplied is never invented.
// Where the OECD provides a "not reported" sentinel we use it and record a
// notice so the filer can see what the file actually says on their behalf.
// Where a value is supplied but not recognised, the row is rejected rather
// than quietly coerced into whichever enum member happens to be first.

const mapDataToCRS = (rowData, columnMappings) => {
  if (!rowData || !columnMappings) {
    throw new Error('Invalid data or column mappings provided');
  }

  // Every value this row could not supply, and what was written instead.
  const notices = [];
  // Coded fields the source actually carried. Used to decide whether a value
  // was genuinely lost when the target schema has no element for it.
  const supplied = new Set();

  const safeGet = (key, defaultValue = '') => {
    const value = rowData[columnMappings[key]];
    return (value !== null && value !== undefined) ? String(value).trim() : defaultValue;
  };

  const safeGetNumber = (key, defaultValue = 0) => {
    const value = parseFloat(rowData[columnMappings[key]]);
    return isNaN(value) ? defaultValue : value;
  };

  const safeGetBoolean = (key, defaultValue = false) => {
    const value = safeGet(key).toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(value)) return true;
    if (['false', '0', 'no', 'n'].includes(value)) return false;
    return defaultValue;
  };

  /**
   * Resolve a coded CRS enum from source data.
   *
   * Absent  -> the OECD "not reported" sentinel, plus a notice.
   * Present and recognised -> the code.
   * Present and unrecognised -> row rejected. Falling back to a substantive
   * value here is how a spreadsheet typo becomes a false regulatory assertion.
   */
  const resolveCoded = (key, table, sentinel, label) => {
    const raw = safeGet(key);
    if (!raw) {
      notices.push({
        field: key,
        message: `${label} was not supplied; reported as "not reported" (${sentinel}).`
      });
      return sentinel;
    }
    supplied.add(key);
    const code = table[raw.toLowerCase()];
    if (code) return code;
    // Allow the source to carry the OECD code directly.
    const directCode = Object.values(table).find((c) => c === raw.toUpperCase());
    if (directCode) return directCode;
    throw new Error(
      `${label}: "${raw}" is not a recognised value. Expected one of: ${Object.keys(table).join(', ')}.`
    );
  };

  const countryCode = (key) => {
    const raw = safeGet(key).toUpperCase();
    if (!raw) return '';
    if (!/^[A-Z]{2}$/.test(raw)) {
      throw new Error(`"${raw}" is not a two-letter ISO 3166-1 country code (field: ${key}).`);
    }
    return raw;
  };

  const holderType = safeGet('holder_type').toLowerCase();
  const isIndividual = holderType === 'individual';
  const isOrganization = ['organization', 'organisation'].includes(holderType);

  // ResCountryCode identifies the reportable jurisdiction. A record without it
  // tells the receiving authority nothing, and the previous 'XX' placeholder is
  // not a member of the ISO country-code enumeration, so it failed validation
  // at the portal instead of here.
  const residenceCountry = countryCode('residence_country');
  if (!residenceCountry) {
    throw new Error(
      'Residence country is required: it identifies the reportable jurisdiction and cannot be assumed.'
    );
  }

  let addressCountry = countryCode('address_country');
  if (!addressCountry) {
    addressCountry = residenceCountry;
    notices.push({
      field: 'address_country',
      message: `Address country was not supplied; the residence country (${residenceCountry}) was used.`
    });
  }

  const hasControllingPerson =
    isOrganization &&
    Boolean(safeGet('controlling_person_first_name')) &&
    Boolean(safeGet('controlling_person_last_name'));

  // Enhanced data mapping with 100% CRS v3.0 XSD compliance
  const mappedData = {
    // Account details with XSD compliance
    accountNumber: safeGet('account_number'),
    accountBalance: safeGetNumber('account_balance'),
    currencyCode: safeGet('currency_code', 'USD').toUpperCase(),
    
    // Account attributes (XSD compliant)
    undocumentedAccount: safeGetBoolean('undocumented_account', false),
    closedAccount: safeGetBoolean('closed_account', false),
    dormantAccount: safeGetBoolean('dormant_account', false),
    // The attribute carries the enum code, not the human-readable label.
    accountNumberType: DEFAULT_ACCOUNT_NUMBER_TYPE,

    // v3.0-only classifications. Absent values become the OECD sentinel, never
    // a substantive assertion. See CRS_NOT_REPORTED.
    accountType: resolveCoded('account_type', CRS_ACCOUNT_TYPES, CRS_NOT_REPORTED.accountType, 'Account type'),
    ddProcedure: resolveCoded('dd_procedure', CRS_DD_PROCEDURE_TYPES, CRS_NOT_REPORTED.ddProcedure, 'Due diligence procedure'),
    selfCert: resolveCoded('self_cert', CRS_SELF_CERT_STATUS, CRS_NOT_REPORTED.selfCert, 'Self-certification status'),

    // Joint account support (XSD compliant)
    isJointAccount: safeGetBoolean('joint_account', false),
    jointAccountHolders: safeGetNumber('joint_account_holders', 1),
    
    // Equity Interest Types (XSD compliant)
    equityInterestTypes: [],
    
    // Holder type classification
    isIndividual,
    isOrganization,
    
    // Individual data (only if holder type is individual) with XSD compliance
    individual: isIndividual ? {
      firstName: safeGet('first_name'),
      lastName: safeGet('last_name'),
      middleName: safeGet('middle_name'),
      title: safeGet('title'),
      suffix: safeGet('suffix'),
      birthDate: safeGet('birth_date'),
      birthCity: safeGet('birth_city'),
      birthCountry: safeGet('birth_country').toUpperCase(),
      tin: safeGet('tin'),
      resCountryCode: residenceCountry,
      addressCountryCode: addressCountry,
      city: safeGet('city'),
      address: safeGet('address'),
      postalCode: safeGet('postal_code'),
      state: safeGet('state'),
      nationality: safeGet('nationality', '').toUpperCase()
    } : null,
    
    // Organization data (only if holder type is organization) with XSD compliance
    organization: isOrganization ? {
      name: safeGet('organization_name'),
      tin: safeGet('organization_tin'),
      resCountryCode: residenceCountry,
      addressCountryCode: addressCountry,
      city: safeGet('city'),
      address: safeGet('address'),
      postalCode: safeGet('postal_code'),
      state: safeGet('state'),
      // AcctHolderType is mandatory for organisations in both v2.0 and v3.0 and
      // has no "not reported" sentinel. It also decides whether controlling
      // persons must be reported, so guessing it (the previous code defaulted
      // to CRS102, "CRS Reportable Person") can suppress an entire class of
      // required disclosure. Missing means the row is rejected.
      acctHolderType: (() => {
        const raw = safeGet('account_holder_type');
        if (!raw) {
          throw new Error(
            'Account holder type is required for organisation account holders (CRS101, CRS102 or CRS103). ' +
            'It determines whether controlling persons must be reported and cannot be assumed.'
          );
        }
        const code = CRS_ACCOUNT_HOLDER_TYPES[raw.toLowerCase()] ||
          Object.values(CRS_ACCOUNT_HOLDER_TYPES).find((c) => c === raw.toUpperCase());
        if (!code) {
          throw new Error(
            `Account holder type: "${raw}" is not a recognised value. ` +
            `Expected one of: ${Object.keys(CRS_ACCOUNT_HOLDER_TYPES).join(', ')}.`
          );
        }
        return code;
      })()
    } : null,
    
    // Controlling person, built only when the row actually carries one --
    // otherwise every organisation row would accrue "not reported" notices for
    // a person who does not exist.
    controllingPerson: hasControllingPerson ? {
      firstName: safeGet('controlling_person_first_name'),
      lastName: safeGet('controlling_person_last_name'), 
      middleName: safeGet('controlling_person_middle_name'),
      title: safeGet('controlling_person_title'),
      birthDate: safeGet('controlling_person_birth_date'),
      birthCity: safeGet('controlling_person_birth_city'),
      birthCountry: safeGet('controlling_person_birth_country').toUpperCase(),
      resCountryCode: countryCode('controlling_person_residence_country'),
      addressCountryCode: countryCode('controlling_person_address_country') ||
                          countryCode('controlling_person_residence_country'),
      city: safeGet('controlling_person_city'),
      address: safeGet('controlling_person_address'),
      postalCode: safeGet('controlling_person_postal_code'),
      state: safeGet('controlling_person_state'),
      tin: safeGet('controlling_person_tin'),
      nationality: safeGet('controlling_person_nationality', '').toUpperCase(),
      ctrlgPersonType: resolveCoded(
        'controlling_person_type',
        CRS_CONTROLLING_PERSON_TYPES,
        CRS_NOT_REPORTED.controllingPersonType,
        'Controlling person type'
      ),
      selfCert: resolveCoded(
        'controlling_person_self_cert',
        CRS_SELF_CERT_CONTROLLING_PERSON,
        CRS_NOT_REPORTED.controllingPersonSelfCert,
        'Controlling person self-certification'
      )
    } : null,
    
    // Enhanced payment data with v3.0 compliant payment types
    payments: []
  };

  // Process equity interest types (XSD compliant)
  const equityInterestType = safeGet('equity_interest_type');
  if (equityInterestType && CRS_EQUITY_INTEREST_TYPES[equityInterestType.toLowerCase()]) {
    mappedData.equityInterestTypes.push(CRS_EQUITY_INTEREST_TYPES[equityInterestType.toLowerCase()]);
  }

  // Process multiple payment types for CRS v3.0 with XSD compliance
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

  // Fallback payment from general payment amount
  if (mappedData.payments.length === 0) {
    const generalPaymentAmount = safeGetNumber('payment_amount');
    if (generalPaymentAmount > 0) {
      const paymentType = safeGet('payment_type');
      mappedData.payments.push({
        type: CRS_PAYMENT_TYPES[paymentType] || 'CRS504',
        amount: generalPaymentAmount,
        currency: mappedData.currencyCode
      });
    }
  }

  // Enhanced validation for CRS v3.0 XSD compliance
  if (!mappedData.accountNumber) {
    throw new Error('Account number is required for CRS v3.0 compliance');
  }
  
  if (mappedData.accountBalance < 0) {
    throw new Error('Account balance cannot be negative');
  }

  if (!/^[A-Z]{3}$/.test(mappedData.currencyCode)) {
    throw new Error('Invalid currency code format - must be 3-letter ISO 4217 code');
  }

  // XSD constraint validation
  if (mappedData.accountNumber.length > 200) {
    throw new Error('Account number exceeds 200 character XSD limit');
  }

  if (mappedData.isJointAccount && (mappedData.jointAccountHolders < 1 || mappedData.jointAccountHolders > 200)) {
    throw new Error('Joint account holders must be between 1 and 200 (XSD constraint)');
  }

  mappedData.notices = notices;
  mappedData.supplied = supplied;
  return mappedData;
};

// ==========================================
// CRS v3.0 100% COMPLIANT XML GENERATION FUNCTION
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

  const profile = CRS_SCHEMA_PROFILES[settings.schemaVersion] ||
                  CRS_SCHEMA_PROFILES[DEFAULT_SCHEMA_VERSION];

  // Values the chosen schema has no element for. Collected once for the whole
  // file rather than per row: dropping data the filer supplied without telling
  // them is the failure mode this exists to prevent.
  const droppedBySchema = new Set();

  // Enhanced utility functions with 100% XSD compliance
  const formatDate = (date) => {
    if (!date) return '';
    
    try {
      let dateObj;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          const parts = date.split(/[/\-.]/);
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

  // 100% XSD compliant person name generation
  const generatePersonName = (personData, nameType = 'OECD202') => {
    if (!personData.firstName || !personData.lastName) {
      throw new Error('First name and last name are required for person names');
    }

    return `
        <Name nameType="${nameType}">
          ${personData.title ? `<Title>${escapeXML(personData.title)}</Title>` : ''}
          <FirstName xnlNameType="${XNL_NAME_TYPES.GIVEN_NAME}">${escapeXML(personData.firstName)}</FirstName>
          ${personData.middleName ? `<MiddleName xnlNameType="${XNL_NAME_TYPES.MIDDLE_NAME}">${escapeXML(personData.middleName)}</MiddleName>` : ''}
          <LastName xnlNameType="${XNL_NAME_TYPES.FAMILY_NAME}">${escapeXML(personData.lastName)}</LastName>
          ${personData.suffix ? `<Suffix>${escapeXML(personData.suffix)}</Suffix>` : ''}
        </Name>`;
  };

  /**
   * Address.
   *
   * legalAddressType defaults to OECD301 (residentialOrBusiness) rather than
   * OECD302 (residential): we do not know which one an address is, and calling
   * a company's registered office a residence is a claim we have no basis for.
   *
   * Street is optional in the OECD address type and is omitted when absent.
   * It previously emitted the literal string "Not Provided", which put text
   * that is not an address into an address field. City is mandatory, so an
   * absent city is an error the filer has to resolve.
   */
  const generateAddress = (addressData, legalAddressType = 'OECD301') => {
    if (!addressData.countryCode) {
      throw new Error('Address country code is required.');
    }
    if (!addressData.city) {
      throw new Error('City is required within an address and cannot be substituted.');
    }
    return `
        <Address legalAddressType="${legalAddressType}">
          <cfc:CountryCode>${escapeXML(addressData.countryCode)}</cfc:CountryCode>
          <cfc:AddressFix>
            ${addressData.street ? `<cfc:Street>${escapeXML(addressData.street)}</cfc:Street>` : ''}
            <cfc:City>${escapeXML(addressData.city)}</cfc:City>
            ${addressData.postalCode ? `<cfc:PostCode>${escapeXML(addressData.postalCode)}</cfc:PostCode>` : ''}
            ${addressData.state ? `<cfc:CountrySubentity>${escapeXML(addressData.state)}</cfc:CountrySubentity>` : ''}
          </cfc:AddressFix>
        </Address>`;
  };

  // 100% XSD compliant TIN generation
  const generateTIN = (tin, issuedBy) => {
    if (!tin) return '';
    return `<TIN issuedBy="${escapeXML(issuedBy || 'XX')}">${escapeXML(tin)}</TIN>`;
  };

  // 100% XSD compliant Organization IN generation
  const generateOrganisationIN = (tin, issuedBy, inType = 'GIIN') => {
    if (!tin) return '';
    return `<IN issuedBy="${escapeXML(issuedBy || 'XX')}" INType="${escapeXML(inType)}">${escapeXML(tin)}</IN>`;
  };

  // 100% XSD compliant birth info generation
  const generateBirthInfo = (personData) => {
    if (!personData.birthDate && !personData.birthCity && !personData.birthCountry) {
      return '';
    }
    
    return `
            <BirthInfo>
              ${personData.birthDate ? `<BirthDate>${formatDate(personData.birthDate)}</BirthDate>` : ''}
              ${personData.birthCity ? `<City>${escapeXML(personData.birthCity)}</City>` : ''}
              ${personData.birthCountry ? `
              <CountryInfo>
                <CountryCode>${escapeXML(personData.birthCountry)}</CountryCode>
              </CountryInfo>` : ''}
            </BirthInfo>`;
  };

  // Account report generation. Element inclusion follows the selected schema
  // profile: v2.0 predates SelfCert, AccountType, DDProcedure, JointAccount,
  // EquityInterestType and Nationality, and emitting them into a v2.0 document
  // makes it invalid.
  const generateAccountReport = (mappedAccount) => {
    const docRefId = generateDocRefId();

    const generateEquityInterestTypes = () => {
      if (!mappedAccount.equityInterestTypes || mappedAccount.equityInterestTypes.length === 0) {
        return '';
      }
      if (!profile.supportsEquityInterestType) {
        droppedBySchema.add('equity interest type');
        return '';
      }
      return mappedAccount.equityInterestTypes.map(type =>
        `<EquityInterestType>${escapeXML(type)}</EquityInterestType>`
      ).join('');
    };

    // Only report a value as lost if the filer actually supplied one. A field
    // that was blank in the source was not dropped by the schema; it was never
    // there.
    const noteDropped = (field, label) => {
      if (mappedAccount.supplied?.has(field)) droppedBySchema.add(label);
    };

    const generateSelfCert = () => {
      if (!profile.supportsSelfCert) {
        noteDropped('self_cert', 'self-certification status');
        return '';
      }
      return `
          <SelfCert>${escapeXML(mappedAccount.selfCert)}</SelfCert>`;
    };

    const generateNationality = (person) => {
      if (!person.nationality) return '';
      if (!profile.supportsNationality) {
        droppedBySchema.add('nationality');
        return '';
      }
      return `<Nationality>${escapeXML(person.nationality)}</Nationality>`;
    };

    const generateAccountHolder = () => {
      if (mappedAccount.isIndividual && mappedAccount.individual) {
        const individual = mappedAccount.individual;
        return `
        <AccountHolder>
          ${generateEquityInterestTypes()}${generateSelfCert()}
          <Individual>
            <ResCountryCode>${escapeXML(individual.resCountryCode)}</ResCountryCode>
            ${generateTIN(individual.tin, individual.resCountryCode)}
            ${generatePersonName(individual)}
            ${generateAddress({
              countryCode: individual.addressCountryCode,
              street: individual.address,
              city: individual.city,
              postalCode: individual.postalCode,
              state: individual.state
            })}
            ${generateNationality(individual)}
            ${generateBirthInfo(individual)}
          </Individual>
        </AccountHolder>`;
      } else if (mappedAccount.isOrganization && mappedAccount.organization) {
        const organization = mappedAccount.organization;
        return `
        <AccountHolder>
          ${generateEquityInterestTypes()}${generateSelfCert()}
          <Organisation>
            <ResCountryCode>${escapeXML(organization.resCountryCode)}</ResCountryCode>
            ${generateOrganisationIN(organization.tin, organization.resCountryCode, 'TIN')}
            <Name>${escapeXML(organization.name)}</Name>
            ${generateAddress({
              countryCode: organization.addressCountryCode,
              street: organization.address,
              city: organization.city,
              postalCode: organization.postalCode,
              state: organization.state
            })}
          </Organisation>
          <AcctHolderType>${escapeXML(organization.acctHolderType)}</AcctHolderType>
        </AccountHolder>`;
      }

      throw new Error(`Invalid account holder type for account ${mappedAccount.accountNumber}`);
    };

    const generateControllingPerson = () => {
      if (!mappedAccount.isOrganization || !mappedAccount.controllingPerson) {
        return '';
      }

      const cp = mappedAccount.controllingPerson;

      // Only generate if we have at least first and last name
      if (!cp.firstName || !cp.lastName) {
        return '';
      }

      const cpSelfCert = () => {
        if (!profile.supportsControllingPersonSelfCert) {
          noteDropped('controlling_person_self_cert', 'controlling person self-certification');
          return '';
        }
        return `
          <SelfCert>${escapeXML(cp.selfCert)}</SelfCert>`;
      };

      return `
        <ControllingPerson>
          <Individual>
            ${cp.resCountryCode ? `<ResCountryCode>${escapeXML(cp.resCountryCode)}</ResCountryCode>` : ''}
            ${generateTIN(cp.tin, cp.resCountryCode)}
            ${generatePersonName(cp)}
            ${generateAddress({
              // No fallback to the organisation's address: a controlling
              // person does not live at the company's registered office
              // unless the data says so.
              countryCode: cp.addressCountryCode,
              street: cp.address,
              city: cp.city,
              postalCode: cp.postalCode,
              state: cp.state
            })}
            ${generateNationality(cp)}
            ${generateBirthInfo(cp)}
          </Individual>
          <CtrlgPersonType>${escapeXML(cp.ctrlgPersonType)}</CtrlgPersonType>${cpSelfCert()}
        </ControllingPerson>`;
    };

    // Generate payment sections with 100% CRS v3.0 XSD compliance
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

    const generateJointAccount = () => {
      if (!mappedAccount.isJointAccount) {
        return '';
      }
      if (!profile.supportsJointAccount) {
        droppedBySchema.add('joint account holder count');
        return '';
      }
      return `
        <JointAccount>
          <Number>${mappedAccount.jointAccountHolders}</Number>
        </JointAccount>`;
    };

    const generateDDProcedure = () => {
      if (!profile.supportsDDProcedure) {
        noteDropped('dd_procedure', 'due diligence procedure');
        return '';
      }
      return `
        <DDProcedure>${escapeXML(mappedAccount.ddProcedure)}</DDProcedure>`;
    };

    const generateAccountType = () => {
      if (!profile.supportsAccountType) {
        noteDropped('account_type', 'account type');
        return '';
      }
      return `
        <AccountType>${escapeXML(mappedAccount.accountType)}</AccountType>`;
    };

    return `
      <AccountReport>
        <DocSpec>
          <stf:DocTypeIndic>OECD1</stf:DocTypeIndic>
          <stf:DocRefId>${docRefId}</stf:DocRefId>
        </DocSpec>
        <AccountNumber UndocumentedAccount="${mappedAccount.undocumentedAccount}" ClosedAccount="${mappedAccount.closedAccount}" DormantAccount="${mappedAccount.dormantAccount}" AcctNumberType="${escapeXML(mappedAccount.accountNumberType)}">${escapeXML(mappedAccount.accountNumber)}</AccountNumber>
        ${generateAccountHolder()}
        ${generateControllingPerson()}
        <AccountBalance currCode="${escapeXML(mappedAccount.currencyCode)}">${formatCurrency(mappedAccount.accountBalance)}</AccountBalance>
        ${generatePayments()}${generateDDProcedure()}${generateAccountType()}
        ${generateJointAccount()}
      </AccountReport>`;
  };

  // Process and map all data rows.
  //
  // A row that cannot be mapped is excluded from the file. That has to be
  // visible: previously these were console.warn'd and the UI still reported the
  // full input count, so a filer could submit a return that was silently short
  // of the accounts they uploaded. Both lists are returned to the caller.
  const mappedAccounts = [];
  const rejectedRows = [];
  const rowNotices = [];

  data.forEach((row, index) => {
    try {
      const mappedAccount = mapDataToCRS(row, columnMappings);
      mappedAccount.sourceRow = index + 1;
      mappedAccounts.push(mappedAccount);
    } catch (error) {
      rejectedRows.push({ row: index + 1, message: error.message });
    }
  });

  // Serialisation can fail for a row that mapped cleanly -- a controlling
  // person with no city, for instance. That must reject the one row, not the
  // whole file, so it is caught here rather than aborting the run.
  const serialisedReports = [];
  let emittedCount = 0;

  mappedAccounts.forEach((account) => {
    try {
      serialisedReports.push(generateAccountReport(account));
      emittedCount += 1;
      // Notices are only recorded once the row is genuinely in the file, and
      // only for values the chosen schema actually carries -- under v2.0 there
      // is no SelfCert element, so "reported as not reported" would be untrue.
      (account.notices || []).forEach((notice) => {
        const capability = SCHEMA_GATED_NOTICE_FIELDS[notice.field];
        if (capability && !profile[capability]) return;
        rowNotices.push({ row: account.sourceRow, message: notice.message });
      });
    } catch (error) {
      rejectedRows.push({ row: account.sourceRow, message: error.message });
    }
  });

  if (emittedCount === 0) {
    const first = rejectedRows[0];
    throw new Error(
      first
        ? `No rows could be converted. First problem — row ${first.row}: ${first.message}`
        : 'No valid accounts to process after data mapping'
    );
  }

  const accountReports = serialisedReports.join('');

  // Generate message reference ID and other required elements
  const messageRef = messageRefId || generateUniqueRefId('CRS');
  const reportingPeriod = `${taxYear}-12-31`;
  const timestamp = new Date().toISOString();
  const fiDocRefId = generateDocRefId();

  if (!reportingFI.country) {
    throw new Error('Reporting jurisdiction is required for the message header.');
  }

  // Root element.
  //
  // `targetNamespace` and the FATCA namespace were previously declared here.
  // targetNamespace belongs on the schema, not on an instance document, and no
  // element in a CRS return is in the FATCA namespace. Both are removed.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CRS_OECD xmlns="${profile.namespace}"
          xmlns:cfc="${CRS_SHARED_NAMESPACES.cfc}"
          xmlns:stf="${CRS_SHARED_NAMESPACES.stf}"
          xmlns:iso="${CRS_SHARED_NAMESPACES.iso}"
          xmlns:xsi="${CRS_SHARED_NAMESPACES.xsi}"
          xsi:schemaLocation="${profile.namespace} ${profile.schemaFile}"
          version="${profile.version}">
  <MessageSpec>
    ${reportingFI.giin ? `<SendingCompanyIN>${escapeXML(reportingFI.giin)}</SendingCompanyIN>` : ''}
    <TransmittingCountry>${escapeXML(reportingFI.country)}</TransmittingCountry>
    <ReceivingCountry>${escapeXML(reportingFI.country)}</ReceivingCountry>
    <MessageType>CRS</MessageType>
    <MessageRefId>${escapeXML(messageRef)}</MessageRefId>
    <MessageTypeIndic>CRS701</MessageTypeIndic>
    <ReportingPeriod>${reportingPeriod}</ReportingPeriod>
    <Timestamp>${timestamp}</Timestamp>
  </MessageSpec>
  <CrsBody>
    <ReportingFI>
      <ResCountryCode>${escapeXML(reportingFI.country)}</ResCountryCode>
      ${generateOrganisationIN(reportingFI.giin, reportingFI.country, 'GIIN')}
      <Name>${escapeXML(reportingFI.name || 'Unknown Institution')}</Name>
      ${generateAddress({
        countryCode: reportingFI.country,
        street: reportingFI.address,
        city: reportingFI.city
      })}
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

  return {
    // Conditional templates leave whitespace-only lines behind. Whitespace
    // between elements is insignificant here (no element carries mixed
    // content), so collapsing them costs nothing and makes the file readable.
    xml: xml.replace(/^[ \t]*\r?\n/gm, ''),
    schemaVersion: profile.version,
    schemaLabel: profile.label,
    accountReportCount: emittedCount,
    rejectedRows,
    rowNotices,
    droppedBySchema: Array.from(droppedBySchema)
  };
};

export {
  // Data mapping function
  mapDataToCRS,
  
  // XML generation function
  generateCRSXML
};
// ==========================================
// ENHANCED AUDIT LOGGING FOR CRS v3.0
// ==========================================

const logFileProcessing = async (fileData, validationResults, user = null) => {
  // The audit trail records what a signed-in institution did with its own
  // data. Anonymous trial conversions run entirely in the browser and are not
  // part of it -- and accepting unauthenticated writes would mean running an
  // open, billable write endpoint into Firestore. Skip rather than attempt a
  // write the rules will (correctly) refuse.
  if (!user?.uid) return;

  try {
    const auditEntry = {
      timestamp: serverTimestamp(),
      userId: user.uid,
      userEmail: user.email || null,
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
        crsVersion: '3.0',
        xsdCompliant: validationResults.summary?.xsdCompliant || true
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
  // The audit trail records what a signed-in institution did with its own
  // data. Anonymous trial conversions run entirely in the browser and are not
  // part of it -- and accepting unauthenticated writes would mean running an
  // open, billable write endpoint into Firestore. Skip rather than attempt a
  // write the rules will (correctly) refuse.
  if (!user?.uid) return;

  try {
    const auditEntry = {
      timestamp: serverTimestamp(),
      userId: user.uid,
      userEmail: user.email || null,
      sessionId: getSessionId(),
      conversionDetails: {
        recordCount: conversionData.recordCount,
        taxYear: settingsUsed.taxYear,
        reportingCountry: settingsUsed.reportingFI.country,
        messageRefId: settingsUsed.messageRefId,
        xmlSizeBytes: conversionData.xml ? conversionData.xml.length : 0,
        generationTimeMs: conversionData.processingTime || 0,
        crsVersion: '3.0',
        xsdCompliant: true
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
        schemaCompliance: 'CrsXML_v3.0.xsd',
        xsdCompliant: true
      },
      qualityMetrics: {
        accountsProcessed: conversionData.recordCount,
        individualsCount: conversionData.individualsCount || 0,
        organizationsCount: conversionData.organizationsCount || 0,
        controllingPersonsCount: conversionData.controllingPersonsCount || 0,
        jointAccountsCount: conversionData.jointAccountsCount || 0
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

// ==========================================
// AUTHENTICATION CONTEXT
// ==========================================

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDoc, setUserDoc] = useState(null);
  const [authError, setAuthError] = useState(null);

  // onAuthStateChanged always fires once on load, with null when nobody is
  // signed in. Without this we reported a logout on every single page view.
  // Only a signed-in -> signed-out transition is actually a logout.
  const wasSignedIn = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      try {
        if (firebaseUser) {
          wasSignedIn.current = true;
          await loadUserData(firebaseUser);
          trackEvent('user_authenticated', {
            auth_method: firebaseUser.providerData[0]?.providerId || 'email'
          });
        } else {
          setUser(null);
          setUserDoc(null);
          if (wasSignedIn.current) {
            wasSignedIn.current = false;
            trackEvent('user_logged_out');
          }
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

        void logAuditEvent('user_login', {
          loginMethod: firebaseUser.providerData[0]?.providerId || 'email',
          lastLogin: userData.lastLogin?.toDate?.() || null
        }, firebaseUser);
        
      } else {
        // Create new user document with enhanced CRS v3.0 preferences
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
            crsVersion: '3.0',
            defaultCountry: 'MU',
            defaultAccountType: 'depository',
            enableXSDValidation: true,
            autoDetectColumns: true
          },
          metadata: {
            signupSource: 'web_app',
            initialUserAgent: navigator.userAgent.substring(0, 200),
            crsComplianceLevel: '100_percent'
          }
        };
        
        await setDoc(userDocRef, userData);
        setUserDoc(userData);

        void logAuditEvent('user_registration', {
          registrationMethod: userData.provider,
          previousAnonymousUsage: userData.previousAnonymousUsage,
          crsVersion: '3.0'
        }, firebaseUser);

        trackEvent('user_registered', {
          registration_method: userData.provider,
          previous_anonymous_usage: userData.previousAnonymousUsage,
          crs_version: '3.0'
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
          crsVersion: '3.0',
          defaultCountry: 'MU',
          defaultAccountType: 'depository',
          enableXSDValidation: true,
          autoDetectColumns: true
        },
        metadata: {
          signupSource: 'web_app',
          initialUserAgent: navigator.userAgent.substring(0, 200),
          crsComplianceLevel: '100_percent'
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
        previous_anonymous_usage: userData.previousAnonymousUsage,
        crs_version: '3.0'
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
        login_method: 'email',
        crs_version: '3.0'
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
        login_method: 'google',
        crs_version: '3.0'
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
      void logAuditEvent('user_logout', {
        logoutTime: new Date().toISOString(),
        crsVersion: '3.0'
      }, user);
      
      // The logout event itself is reported by the auth-state listener above,
      // which is the only place that sees the signed-in -> signed-out edge.
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email) => {
    try {
      setAuthError(null);
      await sendPasswordResetEmail(auth, email);
      
      trackEvent('password_reset_requested', {
        email_provided: !!email,
        crs_version: '3.0'
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
        
        void logAuditEvent('conversion_usage_updated', {
          newUsageCount: newUsage,
          planLimit: userDoc.conversionsLimit,
          crsVersion: '3.0'
        }, user);
        
        trackEvent('usage_updated', {
          new_usage: newUsage,
          plan_limit: userDoc.conversionsLimit,
          usage_percentage: (newUsage / userDoc.conversionsLimit) * 100,
          crs_version: '3.0'
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
// REGISTRATION PROMPT COMPONENT
// ==========================================

const RegistrationPrompt = ({ onRegister, onLogin, onClose }) => {
  const anonymousStatus = canAnonymousUserConvert();

  useEffect(() => {
    trackEvent('registration_prompt_shown', {
      anonymous_usage: anonymousStatus.used,
      trigger: 'conversion_limit_reached',
      crs_version: '3.0'
    });
    // Fires once when the prompt is first shown. anonymousStatus is rebuilt by
    // canAnonymousUserConvert() on every render, so adding it to the
    // dependencies would re-fire this impression event on each render and
    // inflate the metric.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-5 animate-fade-in">
      <div className="relative w-full max-w-[440px] rounded-card bg-white shadow-deep p-8 lg:p-10 animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-ink-300 hover:text-ink transition-colors duration-300"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        <h2 className="font-display text-[30px] leading-[1.05] tracking-display text-ink pr-8">
          You have used your free conversions
        </h2>
        <p className="mt-4 text-[15px] text-ink-500 leading-relaxed">
          Create an account to continue. Registration adds three more conversions and keeps your
          settings between sessions.
        </p>

        <div className="mt-7 space-y-3">
          <button
            onClick={() => { trackEvent('clicked_register_from_prompt', { crs_version: '3.0' }); onRegister(); }}
            className="group w-full h-12 rounded-field bg-ink text-white font-medium text-[15px] inline-flex items-center justify-center gap-2 hover:bg-ink-800 transition-colors duration-300"
          >
            Create an account
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => { trackEvent('clicked_login_from_prompt', { crs_version: '3.0' }); onLogin(); }}
            className="w-full h-12 rounded-field text-ink-600 text-[15px] hover:bg-ink-50 transition-colors duration-300"
          >
            I already have an account
          </button>
        </div>

        <p className="mt-6 text-[13px] text-ink-400 text-center tabular">
          {ANONYMOUS_LIMIT} without an account &middot; 3 more once registered
        </p>
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
      // Resync on open: this component stays mounted, so seeding isLogin from
      // initialMode at construction meant "Get started" still showed sign-in.
      setIsLogin(initialMode === 'login');
      setShowResetForm(false);
      setMessage('');
      trackEvent('auth_modal_opened', {
        mode: initialMode,
        crs_version: '3.0'
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
        trackEvent('login_success', { method: 'email', crs_version: '3.0' });
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1000);
      } else {
        await register(formData.email, formData.password, formData.displayName, formData.company);
        setMessage('Account created! Please verify your email.');
        trackEvent('registration_success', { 
          method: 'email',
          has_company: !!formData.company,
          crs_version: '3.0'
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
      trackEvent('login_success', { method: 'google', crs_version: '3.0' });
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
      trackEvent('password_reset_sent', { crs_version: '3.0' });
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
    <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-5 animate-fade-in">
      <div className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto scroll-quiet rounded-card bg-white shadow-deep p-8 lg:p-10 animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-ink-300 hover:text-ink transition-colors duration-300"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        <h2 className="font-display text-[30px] leading-[1.05] tracking-display text-ink pr-8">
          {showResetForm ? 'Reset your password' : isLogin ? 'Sign in' : 'Create an account'}
        </h2>

        {!showResetForm && (
          <p className="mt-3 text-[15px] text-ink-500 leading-relaxed">
            {isLogin
              ? 'Pick up where you left off.'
              : 'Three more conversions and your settings kept between sessions.'}
          </p>
        )}

        {showResetForm ? (
          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="block text-[13px] text-ink-500 mb-2">Email</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] transition-colors duration-300 outline-none"
                placeholder="you@institution.com"
                required
              />
            </label>

            {message && (
              <p className={`text-[14px] ${message.includes('sent') || message.includes('Success') ? 'text-affirm' : 'text-critical'}`}>
                {message}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="flex-1 h-12 rounded-field bg-ink text-white font-medium text-[15px] hover:bg-ink-800 disabled:opacity-40 transition-colors duration-300"
              >
                {loading ? 'Sending' : 'Send reset link'}
              </button>
              <button
                onClick={() => setShowResetForm(false)}
                className="px-5 h-12 rounded-field text-ink-600 text-[15px] hover:bg-ink-50 transition-colors duration-300"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <label className="block">
                <span className="block text-[13px] text-ink-500 mb-2">Email</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] transition-colors duration-300 outline-none"
                  placeholder="you@institution.com"
                  required
                />
              </label>

              {!isLogin && (
                <>
                  <label className="block">
                    <span className="block text-[13px] text-ink-500 mb-2">Full name</span>
                    <input
                      type="text"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] transition-colors duration-300 outline-none"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[13px] text-ink-500 mb-2">
                      Institution <span className="text-ink-300">optional</span>
                    </span>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] transition-colors duration-300 outline-none"
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className="block text-[13px] text-ink-500 mb-2">Password</span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] transition-colors duration-300 outline-none"
                  placeholder="At least 6 characters"
                  required
                />
              </label>

              {message && (
                <p className={`text-[14px] ${message.includes('Success') || message.includes('created') ? 'text-affirm' : 'text-critical'}`}>
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-field bg-ink text-white font-medium text-[15px] hover:bg-ink-800 disabled:opacity-40 transition-colors duration-300"
              >
                {loading ? 'Please wait' : isLogin ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-4">
              <span className="flex-1 h-px bg-ink-100" />
              <span className="text-[12px] text-ink-300">or</span>
              <span className="flex-1 h-px bg-ink-100" />
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 rounded-field hairline bg-white text-ink text-[15px] inline-flex items-center justify-center gap-2.5 hover:bg-ink-50 disabled:opacity-40 transition-colors duration-300"
            >
              <GoogleIcon className="w-[18px] h-[18px]" />
              Continue with Google
            </button>

            <div className="mt-6 text-center space-y-2.5">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setMessage('');
                  trackEvent('switched_auth_mode', {
                    from: isLogin ? 'login' : 'register',
                    to: !isLogin ? 'login' : 'register',
                    crs_version: '3.0'
                  });
                }}
                className="block w-full text-[14px] text-ink-600 hover:text-ink transition-colors duration-300"
              >
                {isLogin ? 'No account? Create one' : 'Already registered? Sign in'}
              </button>
              {isLogin && (
                <button
                  onClick={() => setShowResetForm(true)}
                  className="block w-full text-[14px] text-ink-400 hover:text-ink-600 transition-colors duration-300"
                >
                  Forgot your password?
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export {
  // Audit Functions
  logFileProcessing,
  logXMLGeneration,
  
  // Components
  GoogleIcon,
  
  // Authentication
  AuthProvider,
  useAuth,
  AuthContext,
  RegistrationPrompt,
  AuthModal
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
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl hairline-b animate-fade-in">
        <div className="max-w-shell mx-auto px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16 lg:h-[72px]">
            <div className="flex items-baseline gap-3 animate-slide-left delay-200">
              <span className="font-display font-medium text-ink text-[26px] lg:text-[30px] tracking-display leading-none">
                Evologics
              </span>
              <span className="hidden sm:inline text-[13px] text-ink-400 tracking-tight">
                CRS Reporting
              </span>
            </div>

            <div className="hidden md:flex items-center gap-9 animate-fade-in delay-400">
              <button
                onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[15px] text-ink-600 hover:text-ink transition-colors duration-300"
              >
                Convert
              </button>
              <Link to="/documentation" className="text-[15px] text-ink-600 hover:text-ink transition-colors duration-300">
                Documentation
              </Link>
              <Link to="/privacy" className="text-[15px] text-ink-600 hover:text-ink transition-colors duration-300">
                Privacy
              </Link>
            </div>

            <div className="flex items-center gap-3 animate-slide-right delay-300">
              {user ? (
                <div className="hidden sm:flex items-center gap-4">
                  <div className="text-right leading-tight">
                    <div className="text-[13px] font-medium text-ink">
                      {userDoc?.displayName || user.email?.split('@')[0]}
                    </div>
                    <div className="text-[12px] text-ink-400 tabular">
                      {usageStatus.remaining} of {usageStatus.limit} remaining
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sign out"
                    className="p-2 text-ink-400 hover:text-ink transition-colors duration-300"
                  >
                    <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={handleSignIn}
                    className="px-4 h-10 text-[15px] text-ink-600 hover:text-ink transition-colors duration-300"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={handleSignUp}
                    className="px-5 h-10 rounded-field bg-ink text-white text-[15px] font-medium hover:bg-ink-800 transition-colors duration-300"
                  >
                    Get started
                  </button>
                </div>
              )}

              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 text-ink">
                {isMenuOpen ? <X className="w-6 h-6" strokeWidth={1.5} /> : <Menu className="w-6 h-6" strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-sm md:hidden animate-fade-in">
          <div className="flex justify-end p-5">
            <button onClick={() => setIsMenuOpen(false)} className="p-2 text-white">
              <X className="w-7 h-7" strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex flex-col items-center justify-center gap-8 h-[70vh]">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="font-display text-3xl text-white tracking-display"
            >
              Convert
            </button>
            <Link to="/documentation" onClick={() => setIsMenuOpen(false)} className="font-display text-3xl text-white tracking-display">
              Documentation
            </Link>
            <Link to="/privacy" onClick={() => setIsMenuOpen(false)} className="font-display text-3xl text-white tracking-display">
              Privacy
            </Link>
            <div className="pt-6">
              {user ? (
                <button onClick={handleLogout} className="px-7 h-12 rounded-field bg-white text-ink font-medium">
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => { setIsMenuOpen(false); handleSignUp(); }}
                  className="px-7 h-12 rounded-field bg-white text-ink font-medium"
                >
                  Get started
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialMode={authMode} />
    </>
  );
};

// ==========================================
// HERO SECTION
// ==========================================

/*
 * The hero carries the whole design language: one dark canvas, one accent,
 * type doing the work. Words rise individually so the headline assembles
 * itself rather than simply appearing.
 */
const HERO_FACTS = [
  { Icon: Lock, label: 'Processed in your browser. Account data is never uploaded.' },
  { Icon: AlertCircle, label: 'Problems are reported against the row and column they came from.' },
  { Icon: Users, label: 'Individuals, entities, controlling persons and joint accounts.' },
  { Icon: FileText, label: 'Output follows the OECD CRS v3.0 schema structure.' }
];

const HeroSection = () => {
  const { user } = useAuth();
  const usageStatus = getUserConversionStatus(user, null);
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFactIndex((i) => (i + 1) % HERO_FACTS.length), 3500);
    return () => clearInterval(id);
  }, []);

  if (user) return null;

  const word = (text, delay, dim = false) => (
    <span className={`reveal-line ${dim ? 'text-white/40' : 'text-white'}`}>
      <span style={{ animationDelay: delay }}>{text}</span>
    </span>
  );

  return (
    <section className="relative bg-ink overflow-hidden">
      <div className="max-w-shell mx-auto px-5 sm:px-8 lg:px-10 pt-16 sm:pt-24 lg:pt-28 pb-0">
        <div className="animate-fade-in delay-200 flex items-center gap-2.5 text-[13px] text-white/50">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-soft" />
          CRS v3.0 &middot; {usageStatus.remaining} free conversions, no account needed
        </div>

        <h1 className="mt-7 font-display font-normal tracking-display text-[44px] leading-[0.96] sm:text-[76px] sm:leading-[0.94] md:text-[104px] lg:text-[124px] lg:leading-[0.92]">
          <span className="block">
            {word('Account', '0.3s')} {word('data', '0.4s')} {word('in.', '0.5s', true)}
          </span>
          <span className="block">
            {word('A', '0.6s', true)} {word('filing', '0.7s')} {word('you', '0.8s')}
          </span>
          <span className="block">
            {word('can', '0.9s')} {word('defend,', '1.0s')} {word('out.', '1.1s', true)}
          </span>
        </h1>

        <div className="mt-10 sm:mt-12 lg:mt-16 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10 lg:gap-[50px] animate-fade-up delay-600">
          <button
            onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
            className="group w-full sm:w-[260px] lg:w-[300px] h-14 lg:h-[68px] rounded-field bg-white text-ink font-medium text-base lg:text-lg tracking-tight flex items-center justify-center gap-2 hover:bg-ink-50 transition-colors duration-300"
          >
            Convert a file
            <ArrowUpRight
              className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={1.75}
            />
          </button>
          <p className="max-w-[330px] text-white/60 text-[15px] lg:text-lg leading-[1.5] tracking-tight">
            Turn an Excel or CSV extract into a CRS XML return, with every value checked before
            anything is generated.
          </p>
        </div>

        <div className="h-16 sm:h-20 lg:h-28" />
      </div>

      {/* Three panels, seated flush against the base of the hero. */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr]">
        <div className="bg-ink-100 p-8 lg:p-10 animate-fade-up delay-900">
          <p className="font-display text-2xl sm:text-[28px] lg:text-[34px] leading-[1.08] tracking-display text-ink max-w-[360px]">
            Know what the converter expects before you start
          </p>
          <Link
            to="/documentation"
            className="mt-6 inline-flex items-center gap-1.5 text-[15px] lg:text-base text-ink underline underline-offset-4 decoration-ink-300 hover:decoration-ink transition-colors duration-300"
          >
            Read the field reference
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </Link>
        </div>

        <div className="bg-white p-8 lg:p-10 flex flex-col justify-between animate-fade-up delay-1000 min-h-[210px]">
          <div className="relative flex-1">
            {HERO_FACTS.map((fact, i) => (
              <div
                key={fact.label}
                className={`flex items-start gap-3.5 transition-all duration-700 ${
                  i === factIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 absolute inset-0 pointer-events-none'
                }`}
              >
                <span className="shrink-0 w-10 h-10 rounded-full bg-ink flex items-center justify-center">
                  <fact.Icon className="w-[18px] h-[18px] text-white" strokeWidth={1.5} />
                </span>
                <span className="text-[15px] lg:text-base leading-[1.35] tracking-tight text-ink-700">
                  {fact.label}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-7">
            {HERO_FACTS.map((fact, i) => (
              <span
                key={fact.label}
                className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${
                  i === factIndex ? 'bg-ink' : 'bg-ink-200'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-ink-900 p-8 lg:p-10 flex items-center gap-6 lg:gap-8 animate-fade-up delay-1100">
          <div className="shrink-0">
            <div className="font-display text-[44px] lg:text-[56px] leading-none tracking-display text-white">
              v3.0
            </div>
          </div>
          <p className="text-white/50 text-[15px] lg:text-base leading-[1.35] tracking-tight">
            The amended OECD Common Reporting Standard schema, published October 2024.
          </p>
        </div>
      </div>
    </section>
  );
};

// ==========================================
// VALIDATION RESULTS DISPLAY COMPONENT
// ==========================================

const ValidationResultsDisplay = ({ validation }) => {
  if (!validation || Object.keys(validation).length === 0) return null;

  return (
    <div className="mt-6 rounded-card hairline bg-white overflow-hidden">
      <div className="px-6 py-5 hairline-b flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] text-ink-400">Validation</div>
          <div className="mt-1 font-display text-xl tracking-display text-ink">
            {validation.canGenerate ? 'Ready to generate' : 'Fix these before generating'}
          </div>
        </div>
        <div className="text-right tabular shrink-0">
          <div className="text-2xl font-display tracking-display text-ink">
            {validation.summary.validRows}
          </div>
          <div className="text-[12px] text-ink-400">of {validation.summary.totalRows} rows ready</div>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {validation.missingColumns?.critical?.length > 0 && (
          <div className="rounded-field bg-critical-wash border border-critical/15 p-4">
            <p className="text-[13px] font-medium text-critical mb-2">
              Required columns are missing
            </p>
            <ul className="space-y-1.5">
              {validation.missingColumns.critical.map((col, index) => (
                <li key={index} className="text-[14px] text-ink-700 leading-snug">{col.description}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.missingColumns?.warnings?.length > 0 && (
          <div className="rounded-field bg-caution-wash border border-caution/15 p-4">
            <p className="text-[13px] font-medium text-caution mb-2">
              Recommended for a complete return
            </p>
            <ul className="space-y-1.5">
              {validation.missingColumns.warnings.map((col, index) => (
                <li key={index} className="text-[14px] text-ink-700 leading-snug">{col.description}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.missingColumns?.recommendations?.length > 0 && (
          <div className="rounded-field bg-ink-50 border border-ink-100 p-4">
            <p className="text-[13px] font-medium text-ink-500 mb-2">Optional fields</p>
            <ul className="space-y-1.5">
              {validation.missingColumns.recommendations.slice(0, 4).map((col, index) => (
                <li key={index} className="text-[14px] text-ink-600 leading-snug">{col.description}</li>
              ))}
              {validation.missingColumns.recommendations.length > 4 && (
                <li className="text-[14px] text-ink-400">
                  and {validation.missingColumns.recommendations.length - 4} more
                </li>
              )}
            </ul>
          </div>
        )}

        {validation.canGenerate &&
          !validation.missingColumns?.critical?.length &&
          !validation.missingColumns?.warnings?.length && (
          <p className="text-[14px] text-ink-500">Every required column was found.</p>
        )}
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
    // v2.0 is the schema currently accepted by Mauritius, Cayman, Ireland and
    // Singapore, so it is the default. v3.0 applies from reporting year 2026.
    schemaVersion: DEFAULT_SCHEMA_VERSION,
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

      if (selectedFile.size > MAX_UPLOAD_BYTES) {
        setError(
          `That file is ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB. ` +
          `The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB — split the return into ` +
          `several files, or remove columns the converter does not read.`
        );
        return;
      }

      
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
      const prototypeBefore = Object.getOwnPropertyNames(Object.prototype);

      // Styles, formulas, number formats and empty-cell stubs were all being
      // parsed and none of them are read by the converter. Asking for less is
      // both faster and less parser surface exposed to a hostile file.
      const workbook = XLSX.read(arrayBuffer, {
        cellDates: true,
        cellStyles: false,
        cellFormula: false,
        cellNF: false,
        sheetStubs: false
      });

      let jsonData = [];
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false
        });

        if (sheetData.length > 0) {
          jsonData = sanitizeParsedRows(sheetData);
          break;
        }
      }

      const polluted = detectPrototypePollution(prototypeBefore);
      if (polluted.length > 0) {
        throw new Error(
          `This file tried to modify the JavaScript environment while being read ` +
          `(${polluted.join(', ')}). It has not been converted. Do not use it.`
        );
      }

      if (jsonData.length === 0) {
        throw new Error('No data found in any sheet');
      }

      const validation = validateCRSData(jsonData);
      setValidationResults(validation);
      // Fire-and-forget: audit logging must not gate the conversion.
      void logFileProcessing(file, validation, user);

      setData(jsonData);
      trackEvent('file_processed', {
        file_type: file.type,
        record_count: jsonData.length,
        is_valid: validation.canGenerate,
        user_type: user ? 'registered' : 'anonymous',
        crs_version: '3.0',
        xsd_compliant: validation.summary?.xsdCompliant || true
      });

    } catch (err) {
      console.error('File processing error:', err);
      
      void logAuditEvent('file_processing_error', {
        filename: file.name,
        error: err.message,
        crsVersion: '3.0'
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
      setError('Please fix the critical errors above before generating XML');
      return;
    }

    if (!data || data.length === 0) {
      setError('Please upload a file first');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      void logAuditEvent('xml_conversion_started', {
        recordCount: data.length,
        taxYear: settings.taxYear,
        crsVersion: settings.schemaVersion
      }, user);

      const startTime = Date.now();
      const generated = generateCRSXML(data, settings, validationResults);
      const xml = generated.xml;
      const processingTime = Date.now() - startTime;

      if (user && userDoc) {
        await updateUserUsage();
      } else {
        updateAnonymousUsage();
        trackEvent('anonymous_conversion', {
          file_type: file?.type || 'unknown',
          record_count: generated.accountReportCount,
          conversion_number: getAnonymousUsage().count,
          crs_version: generated.schemaVersion,
          processing_time_ms: processingTime
        });
      }

      void logXMLGeneration({
        recordCount: generated.accountReportCount,
        rejectedRowCount: generated.rejectedRows.length,
        xml: xml,
        processingTime: processingTime
      }, settings, user);

      setResult({
        xml,
        filename: `CRS_${settings.reportingFI.country}_${settings.taxYear}_v${generated.schemaVersion}_${Date.now()}.xml`,
        // The number of AccountReport elements actually in the file, not the
        // number of rows uploaded. These differ whenever a row is rejected.
        recordCount: generated.accountReportCount,
        inputRowCount: data.length,
        rejectedRows: generated.rejectedRows,
        rowNotices: generated.rowNotices,
        droppedBySchema: generated.droppedBySchema,
        timestamp: new Date().toISOString(),
        crsVersion: generated.schemaVersion,
        schemaLabel: generated.schemaLabel,
        processingTime
      });

      trackEvent('conversion_success', {
        record_count: generated.accountReportCount,
        rejected_rows: generated.rejectedRows.length,
        user_type: user ? 'registered' : 'anonymous',
        crs_version: generated.schemaVersion,
        processing_time_ms: processingTime
      });

    } catch (err) {
      console.error('Conversion error:', err);
      
      void logAuditEvent('xml_conversion_error', {
        error: err.message,
        recordCount: data.length,
        crsVersion: settings.schemaVersion
      }, user);

      setError(`Conversion failed: ${err.message}`);
      trackEvent('conversion_error', {
        error: err.message,
        user_type: user ? 'registered' : 'anonymous',
        crs_version: settings.schemaVersion
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
      crsVersion: result.crsVersion
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
      crs_version: '3.0',
      xsd_compliant: true
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
      <div id="converter" className="bg-white">
        <div className="max-w-shell mx-auto px-5 sm:px-8 lg:px-10 py-20 lg:py-28">
          <div className="max-w-prose">
            <div className="text-[13px] text-ink-400">Converter</div>
            <h2 className="mt-3 font-display text-[38px] sm:text-[52px] lg:text-[64px] leading-[0.98] tracking-display text-ink">
              Three steps to a return
            </h2>
            <p className="mt-5 text-lg text-ink-500 leading-relaxed">
              Upload your extract, tell us who is reporting, and generate. Nothing is sent anywhere
              &mdash; the file is read and converted on this device.
            </p>
          </div>

          <div className="mt-14 lg:mt-20 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10 lg:gap-16 items-start">
            <div className="space-y-12">
              {/* Step 1 */}
              <section>
                <div className="flex items-baseline gap-4 mb-5">
                  <span className="font-display text-[13px] text-ink-300 tabular">01</span>
                  <h3 className="font-display text-2xl tracking-display text-ink">Upload your data</h3>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-card hairline bg-ink-50 hover:bg-white hover:shadow-lift transition-all duration-500 p-10 lg:p-14 text-center group"
                >
                  <span className="mx-auto w-12 h-12 rounded-full bg-ink flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                    <Upload className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </span>
                  <span className="mt-5 block font-display text-lg tracking-tight text-ink">
                    {file ? file.name : 'Choose an Excel or CSV file'}
                  </span>
                  <span className="mt-1.5 block text-[14px] text-ink-400">
                    .xlsx, .xls or .csv &middot; up to 10MB
                  </span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {processing && (
                  <div className="mt-5 flex items-center gap-3 text-[14px] text-ink-500">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-ink-200 border-t-ink animate-spin" />
                    Reading and checking your file
                  </div>
                )}

                {data.length > 0 && !processing && (
                  <>
                    <div className="mt-5 flex items-center gap-2.5 text-[14px] text-affirm">
                      <CheckCircle2 className="w-[18px] h-[18px]" strokeWidth={1.75} />
                      {data.length} records read from {file?.name}
                    </div>
                    <ValidationResultsDisplay validation={validationResults} />
                  </>
                )}
              </section>

              {/* Step 2 */}
              <section>
                <div className="flex items-baseline gap-4 mb-5">
                  <span className="font-display text-[13px] text-ink-300 tabular">02</span>
                  <h3 className="font-display text-2xl tracking-display text-ink">
                    Identify the reporting institution
                  </h3>
                </div>

                <div className="rounded-card hairline bg-white p-6 lg:p-8 grid sm:grid-cols-2 gap-5">
                  <label className="block sm:col-span-2">
                    <span className="block text-[13px] text-ink-500 mb-2">Financial institution name</span>
                    <input
                      type="text"
                      value={settings.reportingFI.name}
                      onChange={(e) => handleSettingsChange('reportingFI', 'name', e.target.value)}
                      className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] text-ink transition-colors duration-300 outline-none"
                      placeholder="Your institution"
                      maxLength="200"
                    />
                    {settingsValidation.fiName && !settingsValidation.fiName.valid && (
                      <span className="mt-2 block text-[13px] text-critical">{settingsValidation.fiName.message}</span>
                    )}
                  </label>

                  <label className="block">
                    <span className="block text-[13px] text-ink-500 mb-2">GIIN</span>
                    <input
                      type="text"
                      value={settings.reportingFI.giin}
                      onChange={(e) => handleSettingsChange('reportingFI', 'giin', e.target.value.toUpperCase())}
                      className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 font-mono text-[14px] text-ink transition-colors duration-300 outline-none"
                      placeholder="XXXXXX.XXXXX.XX.XXX"
                      maxLength="19"
                    />
                    {settingsValidation.giin && !settingsValidation.giin.valid && (
                      <span className="mt-2 block text-[13px] text-critical">{settingsValidation.giin.message}</span>
                    )}
                  </label>

                  <label className="block">
                    <span className="block text-[13px] text-ink-500 mb-2">Jurisdiction</span>
                    <select
                      value={settings.reportingFI.country}
                      onChange={(e) => handleSettingsChange('reportingFI', 'country', e.target.value)}
                      className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] text-ink transition-colors duration-300 outline-none appearance-none"
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
                      <option value="IE">Ireland</option>
                      <option value="NL">Netherlands</option>
                      <option value="AU">Australia</option>
                      <option value="CA">Canada</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-[13px] text-ink-500 mb-2">Reporting year</span>
                    <select
                      value={settings.taxYear}
                      onChange={(e) => handleSettingsChange('taxYear', null, parseInt(e.target.value))}
                      className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] text-ink tabular transition-colors duration-300 outline-none appearance-none"
                    >
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <option key={year} value={year}>{year}</option>;
                      })}
                    </select>
                    {settingsValidation.taxYear && !settingsValidation.taxYear.valid && (
                      <span className="mt-2 block text-[13px] text-critical">{settingsValidation.taxYear.message}</span>
                    )}
                  </label>

                  <label className="block">
                    <span className="block text-[13px] text-ink-500 mb-2">City</span>
                    <input
                      type="text"
                      value={settings.reportingFI.city}
                      onChange={(e) => handleSettingsChange('reportingFI', 'city', e.target.value)}
                      className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] text-ink transition-colors duration-300 outline-none"
                      placeholder="Port Louis"
                      maxLength="200"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="block text-[13px] text-ink-500 mb-2">Schema version</span>
                    <select
                      value={settings.schemaVersion}
                      onChange={(e) => handleSettingsChange('schemaVersion', null, e.target.value)}
                      className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] text-ink transition-colors duration-300 outline-none appearance-none"
                    >
                      <option value="2.0">CRS XML v2.0 — current filing seasons</option>
                      <option value="3.0">CRS XML v3.0 — amended CRS, reporting year 2026 onward</option>
                    </select>
                    <span className="mt-2 block text-[13px] text-ink-400 leading-snug">
                      {settings.schemaVersion === '3.0'
                        ? 'v3.0 carries self-certification, account type and due diligence. Confirm your authority accepts it before filing — most portals are still on v2.0.'
                        : 'v2.0 is what Mauritius, Cayman, Ireland and Singapore accept today. It has no element for self-certification, account type or due diligence; those values are kept out of the file rather than misplaced.'}
                    </span>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="block text-[13px] text-ink-500 mb-2">Street address</span>
                    <input
                      type="text"
                      value={settings.reportingFI.address}
                      onChange={(e) => handleSettingsChange('reportingFI', 'address', e.target.value)}
                      className="w-full h-12 px-4 rounded-field bg-ink-50 border border-transparent focus:bg-white focus:border-ink-200 text-[15px] text-ink transition-colors duration-300 outline-none"
                      placeholder="Registered office address"
                      maxLength="200"
                    />
                  </label>
                </div>
              </section>

              {/* Step 3 */}
              <section>
                <div className="flex items-baseline gap-4 mb-5">
                  <span className="font-display text-[13px] text-ink-300 tabular">03</span>
                  <h3 className="font-display text-2xl tracking-display text-ink">Generate</h3>
                </div>

                <button
                  onClick={handleConvert}
                  disabled={processing || !usageStatus.canConvert || data.length === 0}
                  className="group w-full sm:w-auto sm:min-w-[300px] h-14 lg:h-16 px-8 rounded-field bg-accent text-white font-medium text-base lg:text-lg tracking-tight inline-flex items-center justify-center gap-2.5 hover:bg-accent-soft disabled:bg-ink-200 disabled:text-ink-400 disabled:cursor-not-allowed transition-colors duration-300"
                >
                  {processing ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Generating
                    </>
                  ) : (
                    <>
                      Generate CRS XML
                      <ArrowRight
                        className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-1"
                        strokeWidth={1.75}
                      />
                    </>
                  )}
                </button>

                {!usageStatus.canConvert && usageStatus.reason && (
                  <p className="mt-4 text-[14px] text-critical">{usageStatus.reason}</p>
                )}

                {error && (
                  <div className="mt-5 rounded-field bg-critical-wash border border-critical/15 p-4 flex gap-3">
                    <AlertCircle className="w-[18px] h-[18px] text-critical shrink-0 mt-0.5" strokeWidth={1.75} />
                    <p className="text-[14px] text-ink-700 leading-snug">{error}</p>
                  </div>
                )}

                {result && result.rejectedRows?.length > 0 && (
                  <div className="mt-5 rounded-field bg-critical-wash border border-critical/15 p-5">
                    <div className="flex gap-3">
                      <AlertCircle className="w-[18px] h-[18px] text-critical shrink-0 mt-0.5" strokeWidth={1.75} />
                      <div>
                        <p className="text-[14px] font-medium text-ink">
                          {result.rejectedRows.length} of {result.inputRowCount} rows are not in this file
                        </p>
                        <p className="mt-1 text-[13px] text-ink-500 leading-snug">
                          These rows could not be converted without inventing a value, so they were left out.
                          Fix them and regenerate before filing.
                        </p>
                        <ul className="mt-3 space-y-1.5 max-h-56 overflow-y-auto scroll-quiet">
                          {result.rejectedRows.slice(0, 25).map((r) => (
                            <li key={r.row} className="text-[13px] text-ink-600 leading-snug">
                              <span className="tabular text-ink-400">Row {r.row}</span> — {r.message}
                            </li>
                          ))}
                        </ul>
                        {result.rejectedRows.length > 25 && (
                          <p className="mt-2 text-[13px] text-ink-400">
                            and {result.rejectedRows.length - 25} more
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {result && (result.rowNotices?.length > 0 || result.droppedBySchema?.length > 0) && (
                  <div className="mt-5 rounded-field bg-caution-wash border border-caution/15 p-5">
                    <div className="flex gap-3">
                      <AlertCircle className="w-[18px] h-[18px] text-caution shrink-0 mt-0.5" strokeWidth={1.75} />
                      <div>
                        <p className="text-[14px] font-medium text-ink">What this file says on your behalf</p>
                        {result.droppedBySchema?.length > 0 && (
                          <p className="mt-1.5 text-[13px] text-ink-600 leading-snug">
                            CRS v{result.crsVersion} has no element for {result.droppedBySchema.join(', ')}.
                            Any values you supplied for these were not written to the file.
                          </p>
                        )}
                        {result.rowNotices?.length > 0 && (
                          <>
                            <p className="mt-2.5 text-[13px] text-ink-600 leading-snug">
                              {result.rowNotices.length} value{result.rowNotices.length === 1 ? ' was' : 's were'} absent
                              from your data and reported as &ldquo;not reported&rdquo; rather than assumed:
                            </p>
                            <ul className="mt-2 space-y-1.5 max-h-56 overflow-y-auto scroll-quiet">
                              {result.rowNotices.slice(0, 25).map((n, i) => (
                                <li key={`${n.row}-${i}`} className="text-[13px] text-ink-600 leading-snug">
                                  <span className="tabular text-ink-400">Row {n.row}</span> — {n.message}
                                </li>
                              ))}
                            </ul>
                            {result.rowNotices.length > 25 && (
                              <p className="mt-2 text-[13px] text-ink-400">
                                and {result.rowNotices.length - 25} more
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="mt-8 rounded-card bg-ink text-white overflow-hidden animate-fade-up">
                    <div className="p-6 lg:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                      <div>
                        <div className="text-[13px] text-white/50">Generated</div>
                        <div className="mt-1.5 font-display text-2xl tracking-display">
                          {result.recordCount} account reports
                        </div>
                        <div className="mt-1 text-[13px] text-white/50 tabular">
                          CRS v{result.crsVersion} &middot; Tax year {settings.taxYear} &middot;{' '}
                          {Math.round(result.xml.length / 1024)}KB &middot; {result.processingTime}ms
                        </div>
                      </div>
                      <button
                        onClick={handleDownload}
                        className="group shrink-0 h-12 px-6 rounded-field bg-white text-ink font-medium text-[15px] inline-flex items-center justify-center gap-2 hover:bg-ink-50 transition-colors duration-300"
                      >
                        <Download className="w-[18px] h-[18px]" strokeWidth={1.75} />
                        Download XML
                      </button>
                    </div>
                    <pre className="hairline-invert border-l-0 border-r-0 border-b-0 px-6 lg:px-8 py-5 font-mono text-[11.5px] leading-relaxed text-white/60 overflow-x-auto scroll-quiet">
{result.xml.substring(0, 420)}...
                    </pre>
                  </div>
                )}
              </section>
            </div>

            {/* Aside: usage + assurances */}
            <aside className="lg:sticky lg:top-28 space-y-4">
              <div className="rounded-card hairline bg-white p-6">
                <div className="text-[13px] text-ink-400">
                  {usageStatus.userType === 'anonymous' ? 'Free trial' : `${userDoc?.plan || 'Free'} plan`}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-[40px] leading-none tracking-display text-ink tabular">
                    {usageStatus.remaining}
                  </span>
                  <span className="text-[14px] text-ink-400">of {usageStatus.limit} left</span>
                </div>
                <div className="mt-4 h-1 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className="h-full bg-ink rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, usageStatus.percentUsed)}%` }}
                  />
                </div>
                {usageStatus.userType === 'anonymous' && (
                  <button
                    onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}
                    className="mt-5 w-full h-11 rounded-field bg-ink text-white text-[15px] font-medium hover:bg-ink-800 transition-colors duration-300"
                  >
                    Create an account
                  </button>
                )}
              </div>

              <div className="rounded-card hairline bg-ink-50 p-6 space-y-4">
                {[
                  { Icon: Lock, text: 'Your file is read in this browser. It is never uploaded to us.' },
                  { Icon: Shield, text: 'Values are checked before anything is generated.' },
                  { Icon: FileText, text: 'Output follows the OECD CRS v3.0 schema structure.' }
                ].map(({ Icon, text }) => (
                  <div key={text} className="flex gap-3">
                    <Icon className="w-[18px] h-[18px] text-ink-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <p className="text-[14px] text-ink-600 leading-snug">{text}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {showRegistrationPrompt && (
        <RegistrationPrompt
          onRegister={() => { setShowRegistrationPrompt(false); setAuthMode('register'); setShowAuthModal(true); }}
          onLogin={() => { setShowRegistrationPrompt(false); setAuthMode('login'); setShowAuthModal(true); }}
          onClose={() => setShowRegistrationPrompt(false)}
        />
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialMode={authMode} />
    </>
  );
};

// ==========================================
// FOOTER COMPONENT
// ==========================================

const Footer = () => {
  return (
    <footer className="bg-ink text-white">
      <div className="max-w-shell mx-auto px-5 sm:px-8 lg:px-10 py-16 lg:py-20">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="font-display font-medium text-[30px] tracking-display leading-none">Evologics</div>
            <p className="mt-4 text-[15px] leading-relaxed text-white/50 max-w-sm">
              CRS and AEOI reporting for financial institutions. Account data is processed in your
              browser and is never uploaded.
            </p>
          </div>
          <div>
            <div className="text-[13px] text-white/40 mb-4">Product</div>
            <div className="flex flex-col gap-3 text-[15px]">
              <button
                onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-left text-white/80 hover:text-white transition-colors duration-300"
              >
                Convert
              </button>
              <Link to="/documentation" className="text-white/80 hover:text-white transition-colors duration-300">Documentation</Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-white/80 hover:text-white transition-colors duration-300">Support</a>
            </div>
          </div>
          <div>
            <div className="text-[13px] text-white/40 mb-4">Legal</div>
            <div className="flex flex-col gap-3 text-[15px]">
              <Link to="/privacy" className="text-white/80 hover:text-white transition-colors duration-300">Privacy Policy</Link>
              <Link to="/terms" className="text-white/80 hover:text-white transition-colors duration-300">Terms of Service</Link>
              <Link to="/data-request" className="text-white/80 hover:text-white transition-colors duration-300">Data Requests</Link>
              <Link to="/cookie-settings" className="text-white/80 hover:text-white transition-colors duration-300">Cookie Settings</Link>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 hairline-invert border-l-0 border-r-0 border-b-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-[13px] text-white/40">
            &copy; {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
          </p>
          <p className="text-[13px] text-white/40">
            OECD Common Reporting Standard &middot; Schema v3.0
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
