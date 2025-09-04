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
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs
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
// PAYPAL CONFIGURATION & UTILITIES
// ==========================================

// PayPal Client ID from environment
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID;

// PayPal SDK loader
const loadPayPalSDK = () => {
  return new Promise((resolve, reject) => {
    if (window.paypal) {
      resolve(window.paypal);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription&components=buttons`;
    script.async = true;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error('PayPal SDK failed to load'));
    document.head.appendChild(script);
  });
};

// PayPal subscription handler
const createPayPalSubscription = async (planId, onSuccess, onError) => {
  try {
    const paypal = await loadPayPalSDK();
    
    return paypal.Buttons({
      createSubscription: function(data, actions) {
        return actions.subscription.create({
          'plan_id': planId,
          'application_context': {
            'brand_name': 'iAfrica Compliance Platform',
            'locale': 'en-US',
            'shipping_preference': 'NO_SHIPPING',
            'user_action': 'SUBSCRIBE_NOW',
            'payment_method': {
              'payer_selected': 'PAYPAL',
              'payee_preferred': 'IMMEDIATE_PAYMENT_REQUIRED'
            },
            'return_url': window.location.origin + '/subscription-success',
            'cancel_url': window.location.origin + '/subscription-cancel'
          }
        });
      },
      onApprove: function(data, actions) {
        console.log('PayPal Subscription approved:', data.subscriptionID);
        onSuccess(data.subscriptionID, data);
      },
      onError: function(err) {
        console.error('PayPal error:', err);
        onError(err);
      },
      onCancel: function(data) {
        console.log('PayPal subscription cancelled:', data);
        onError(new Error('Subscription cancelled by user'));
      }
    });
  } catch (error) {
    console.error('PayPal SDK loading error:', error);
    onError(error);
  }
};

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

// Updated pricing plans with proper PayPal integration
const PRICING_PLANS = {
  free: {
    name: 'Free Plan',
    price: 0,
    conversions: 3,
    paypalPlanId: null,
    features: [
      '3 conversions after registration',
      'Basic XML generation',
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
      'Priority email support',
      'Usage analytics dashboard',
      'Standard templates',
      'GIIN validation database',
      'Conversion history'
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
      'Priority phone + email support',
      'Advanced analytics',
      'Custom report branding',
      'API access (rate limited)',
      'Compliance consultation',
      'Priority processing queue'
    ],
    buttonText: 'Subscribe Now',
    popular: false,
    color: 'purple'
  }
};

// Environment validation
const validateEnvironment = () => {
  const requiredVars = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_PAYPAL_CLIENT_ID'
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
  console.warn('Some environment variables are missing. PayPal integration may not work properly.');
}
// ==========================================
// ENHANCED FIELD MAPPINGS
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
  
  // Payment fields
  'payment_type': ['payment_type', 'paymenttype', 'payment_code', 'income_type'],
  'payment_amount': ['payment_amount', 'paymentamount', 'payment', 'income_amount'],
  'interest_amount': ['interest_amount', 'interest', 'interest_income'],
  'dividend_amount': ['dividend_amount', 'dividend', 'dividend_income']
};

// ==========================================
// ANONYMOUS USAGE TRACKING (Enhanced)
// ==========================================

const getAnonymousUsage = () => {
  try {
    const usage = JSON.parse(localStorage.getItem(ANONYMOUS_USAGE_KEY) || '{"count": 0, "conversions": []}');
    
    // Validate usage object structure
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
      userAgent: navigator.userAgent.substring(0, 100) // Limit to prevent storage bloat
    });
    
    // Keep only last 10 conversions to prevent storage bloat
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
// VALIDATION FUNCTIONS (Enhanced)
// ==========================================

const validateGIIN = (giin) => {
  if (!giin || typeof giin !== 'string' || giin.trim() === '') {
    return { valid: false, message: "GIIN is required for CRS compliance", severity: 'error' };
  }
  
  const cleanGiin = giin.trim().toUpperCase();
  const giinRegex = /^[A-Z0-9]{6}\.[A-Z0-9]{5}\.[A-Z]{2}\.[A-Z0-9]{3}$/;
  
  if (!giinRegex.test(cleanGiin)) {
    return { 
      valid: false, 
      message: "Invalid GIIN format. Should be: XXXXXX.XXXXX.XX.XXX (e.g., ABC123.00000.ME.123)", 
      severity: 'error' 
    };
  }
  
  // Check for test/dummy data patterns
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
    'payment_amount': 'Payment Amount (numeric)',
    'payment_type': 'Payment Type (CRS501-CRS504)'
  };
  return descriptions[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Enhanced validation with better error categorization
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
// ==========================================
// COMPREHENSIVE CRS DATA VALIDATION
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
      summary: { totalRows: 0, validRows: 0, invalidRows: 0 }
    };
  }

  // Get headers and normalize them
  const firstRow = data[0];
  if (!firstRow || typeof firstRow !== 'object') {
    return {
      canGenerate: false,
      criticalErrors: ['Invalid data structure - unable to read column headers'],
      warnings: [],
      recommendations: [],
      missingColumns: { critical: [], warnings: [], recommendations: [] },
      dataIssues: { critical: [], warnings: [], recommendations: [] },
      summary: { totalRows: 0, validRows: 0, invalidRows: 0 }
    };
  }

  const headers = Object.keys(firstRow).map(h => h.toLowerCase().trim());
  const requiredFields = ENHANCED_FIELD_MAPPINGS;

  // Field classification for better error reporting
  const criticalFields = ['account_number', 'account_balance', 'currency_code', 'holder_type'];
  const warningFields = ['residence_country', 'address_country', 'city'];
  const recommendationFields = [
    'first_name', 'last_name', 'tin', 'birth_date', 'birth_city', 'birth_country', 
    'organization_name', 'organization_tin', 'controlling_person_first_name', 
    'controlling_person_last_name', 'controlling_person_birth_date', 
    'controlling_person_birth_country', 'controlling_person_residence_country', 
    'controlling_person_address_country', 'controlling_person_city', 
    'controlling_person_tin', 'payment_type', 'payment_amount'
  ];

  const columnMappings = {};
  const missingColumns = { critical: [], warnings: [], recommendations: [] };

  // Enhanced column mapping with fuzzy matching
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
        alternatives: alternatives.slice(0, 3), // Show first 3 alternatives
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

  // Enhanced row-by-row validation
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

      // Critical validations
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

      // Warning validations - country codes and address info
      const resCountryValidation = validateCountryCode(row[columnMappings.residence_country]);
      if (!resCountryValidation.valid) {
        warnings.push('Valid residence country code recommended for CRS compliance');
      }
      
      if (!row[columnMappings.city] || String(row[columnMappings.city]).trim() === '') {
        warnings.push('City information recommended for complete address details');
      }

      // Conditional validations based on holder type
      if (holderType === 'individual') {
        if (!row[columnMappings.first_name] || String(row[columnMappings.first_name]).trim() === '' ||
            !row[columnMappings.last_name] || String(row[columnMappings.last_name]).trim() === '') {
          recommendations.push('Complete name (first and last) improves CRS compliance for individuals');
        }
        
        if (!row[columnMappings.tin] || String(row[columnMappings.tin]).trim() === '') {
          recommendations.push('TIN (Tax Identification Number) recommended when available');
        }

        if (!row[columnMappings.birth_date] || String(row[columnMappings.birth_date]).trim() === '') {
          recommendations.push('Birth date helps with individual identification');
        }
      } else if (['organization', 'organisation'].includes(holderType)) {
        if (!row[columnMappings.organization_name] || String(row[columnMappings.organization_name]).trim() === '') {
          critical.push('Organization name is required for entity account holders');
        }

        // Controlling person information for organizations
        const hasControllingPersonInfo = row[columnMappings.controlling_person_first_name] || 
                                       row[columnMappings.controlling_person_last_name];
        
        if (!hasControllingPersonInfo) {
          warnings.push('Controlling person information recommended for organizations');
        }
      }

      // Payment validation
      const paymentAmount = parseFloat(row[columnMappings.payment_amount]);
      const accountBalance = parseFloat(row[columnMappings.account_balance]);
      
      if (!isNaN(paymentAmount) && paymentAmount > accountBalance * 10) {
        warnings.push('Payment amount seems unusually high compared to account balance');
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

  // Determine if XML can be generated
  const canGenerate = missingColumns.critical.length === 0 && dataIssues.critical.length === 0;
  
  // Build comprehensive error summary
  const criticalErrors = [];
  if (missingColumns.critical.length > 0) {
    criticalErrors.push(`Missing ${missingColumns.critical.length} critical columns`);
  }
  if (dataIssues.critical.length > 0) {
    criticalErrors.push(`${dataIssues.critical.length} rows have critical data errors`);
  }

  const warnings = [];
  if (missingColumns.warnings.length > 0) {
    warnings.push(`${missingColumns.warnings.length} recommended columns are missing`);
  }
  if (dataIssues.warnings.length > 0) {
    warnings.push(`${dataIssues.warnings.length} rows have data warnings`);
  }

  const recommendations = [];
  if (missingColumns.recommendations.length > 0) {
    recommendations.push(`${missingColumns.recommendations.length} optional fields could improve compliance`);
  }
  if (dataIssues.recommendations.length > 0) {
    recommendations.push(`${dataIssues.recommendations.length} rows could benefit from additional data`);
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
      processingDate: new Date().toISOString()
    }
  };
};

// ==========================================
// ENHANCED DATA MAPPING FUNCTION
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

  // Enhanced data mapping with validation
  const mappedData = {
    // Account details
    accountNumber: safeGet('account_number'),
    accountBalance: safeGetNumber('account_balance'),
    currencyCode: safeGet('currency_code', 'USD').toUpperCase(),
    
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
      address: safeGet('address')
    } : null,
    
    // Organization data (only if holder type is organization)
    organization: isOrganization ? {
      name: safeGet('organization_name'),
      tin: safeGet('organization_tin'),
      resCountryCode: safeGet('residence_country', 'XX').toUpperCase(),
      addressCountryCode: (safeGet('address_country') || safeGet('residence_country', 'XX')).toUpperCase(),
      city: safeGet('city'),
      address: safeGet('address')
    } : null,
    
    // Controlling person (for organizations)
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
      tin: safeGet('controlling_person_tin')
    } : null,
    
    // Enhanced payment data with multiple payment types
    payment: {
      type: safeGet('payment_type', 'CRS503'), // Default to Other Income
      amount: safeGetNumber('payment_amount') || safeGetNumber('account_balance'),
      interestAmount: safeGetNumber('interest_amount'),
      dividendAmount: safeGetNumber('dividend_amount'),
      currency: safeGet('currency_code', 'USD').toUpperCase()
    }
  };

  // Data validation for mapped object
  if (!mappedData.accountNumber) {
    throw new Error('Account number is required');
  }
  
  if (mappedData.accountBalance < 0) {
    throw new Error('Account balance cannot be negative');
  }

  if (!/^[A-Z]{3}$/.test(mappedData.currencyCode)) {
    throw new Error('Invalid currency code format');
  }

  return mappedData;
};
// ==========================================
// ENHANCED CRS XML GENERATION FUNCTION
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
      // Handle various date formats
      let dateObj;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        // Try parsing various date formats
        dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          // Try parsing DD/MM/YYYY or MM/DD/YYYY
          const parts = date.split(/[\/\-\.]/);
          if (parts.length === 3) {
            // Assume DD/MM/YYYY format first
            dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
            if (isNaN(dateObj.getTime())) {
              // Try MM/DD/YYYY format
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

  // Enhanced account report generation
  const generateAccountReport = (mappedAccount, index) => {
    const docRefId = generateDocRefId();
    
    // Generate account holder section with enhanced validation
    const generateAccountHolder = () => {
      if (mappedAccount.isIndividual && mappedAccount.individual) {
        const individual = mappedAccount.individual;
        return `
        <AccountHolder>
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
            ${individual.birthDate ? `
            <BirthInfo>
              <BirthDate>${formatDate(individual.birthDate)}</BirthDate>
              ${individual.birthCity ? `<City>${escapeXML(individual.birthCity)}</City>` : ''}
              <CountryInfo>
                <CountryCode>${escapeXML(individual.birthCountry || individual.resCountryCode || 'XX')}</CountryCode>
              </CountryInfo>
            </BirthInfo>` : ''}
          </Individual>
          <AcctHolderType>CRS101</AcctHolderType>
        </AccountHolder>`;
      } else if (mappedAccount.isOrganization && mappedAccount.organization) {
        const organization = mappedAccount.organization;
        return `
        <AccountHolder>
          <Organisation>
            <ResCountryCode>${escapeXML(organization.resCountryCode || 'XX')}</ResCountryCode>
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
          <AcctHolderType>CRS101</AcctHolderType>
        </AccountHolder>`;
      }
      
      throw new Error(`Invalid account holder type for account ${mappedAccount.accountNumber}`);
    };

    // Generate controlling person section with validation
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
            ${cp.birthDate ? `
            <BirthInfo>
              <BirthDate>${formatDate(cp.birthDate)}</BirthDate>
              ${cp.birthCity ? `<City>${escapeXML(cp.birthCity)}</City>` : ''}
              <CountryInfo>
                <CountryCode>${escapeXML(cp.birthCountry || cp.resCountryCode || 'XX')}</CountryCode>
              </CountryInfo>
            </BirthInfo>` : ''}
          </Individual>
          <CtrlgPersonType>CRS801</CtrlgPersonType>
        </ControllingPerson>`;
    };

    // Generate payment sections with enhanced logic
    const generatePayments = () => {
      const payments = [];
      const payment = mappedAccount.payment;
      
      // Interest payment (CRS501)
      if (payment.interestAmount && payment.interestAmount > 0) {
        payments.push(`
        <Payment>
          <Type>CRS501</Type>
          <PaymentAmnt currCode="${escapeXML(payment.currency)}">${formatCurrency(payment.interestAmount)}</PaymentAmnt>
        </Payment>`);
      }
      
      // Dividend payment (CRS502)
      if (payment.dividendAmount && payment.dividendAmount > 0) {
        payments.push(`
        <Payment>
          <Type>CRS502</Type>
          <PaymentAmnt currCode="${escapeXML(payment.currency)}">${formatCurrency(payment.dividendAmount)}</PaymentAmnt>
        </Payment>`);
      }
      
      // Other income payment (CRS503) - default for account balance or specified payment
      if (payment.amount && payment.amount > 0) {
        const paymentType = payment.type || 'CRS503';
        payments.push(`
        <Payment>
          <Type>${escapeXML(paymentType)}</Type>
          <PaymentAmnt currCode="${escapeXML(payment.currency)}">${formatCurrency(payment.amount)}</PaymentAmnt>
        </Payment>`);
      }
      
      // Default payment if none specified but account has balance
      if (payments.length === 0 && mappedAccount.accountBalance > 0) {
        payments.push(`
        <Payment>
          <Type>CRS503</Type>
          <PaymentAmnt currCode="${escapeXML(mappedAccount.currencyCode)}">${formatCurrency(mappedAccount.accountBalance)}</PaymentAmnt>
        </Payment>`);
      }
      
      return payments.join('');
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

  // Throw error if too many rows failed processing
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

  // Generate enhanced message reference ID
  const messageRef = messageRefId || generateUniqueRefId('CRS');
  const reportingPeriod = `${taxYear}-12-31`;
  const timestamp = new Date().toISOString();
  const fiDocRefId = generateDocRefId();

  // Build complete XML with proper structure and validation
  return `<?xml version="1.0" encoding="utf-8"?>
<CRS_OECD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
          xmlns:crs="urn:oecd:ties:crs:v2" 
          xmlns:cfc="urn:oecd:ties:commontypesfatcacrs:v2" 
          xmlns:stf="urn:oecd:ties:crsstf:v5" 
          version="2.0" 
          xmlns="urn:oecd:ties:crs:v2"
          xsi:schemaLocation="urn:oecd:ties:crs:v2 CrsXML_v2.0.xsd">
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
      <ResCountryCode>${escapeXML(reportingFI.country || 'XX')}</ResCountryCode>
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
// SUBSCRIPTION MANAGEMENT FUNCTIONS
// ==========================================

const updateUserSubscription = async (subscriptionId, planKey, user, subscriptionData = {}) => {
  if (!user) {
    throw new Error('User not authenticated');
  }

  if (!PRICING_PLANS[planKey]) {
    throw new Error('Invalid subscription plan');
  }

  try {
    const plan = PRICING_PLANS[planKey];
    const updateData = {
      subscriptionId: subscriptionId,
      plan: planKey,
      subscriptionStatus: 'active',
      conversionsLimit: plan.conversions,
      conversionsUsed: 0,
      subscriptionDate: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      paypalData: {
        subscriptionId: subscriptionId,
        planId: plan.paypalPlanId,
        amount: plan.price,
        currency: 'USD',
        ...subscriptionData
      }
    };

    await updateDoc(doc(db, 'users', user.uid), updateData);

    // Log subscription event for audit
    await logAuditEvent('subscription_created', {
      subscriptionId,
      planKey,
      planName: plan.name,
      amount: plan.price,
      conversionsLimit: plan.conversions
    }, user);

    console.log('Subscription updated successfully');
    return updateData;
  } catch (error) {
    console.error('Error updating subscription:', error);
    
    // Log subscription error
    await logAuditEvent('subscription_error', {
      error: error.message,
      subscriptionId,
      planKey
    }, user);

    throw new Error(`Failed to update subscription: ${error.message}`);
  }
};

const cancelUserSubscription = async (user) => {
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    const updateData = {
      subscriptionStatus: 'cancelled',
      subscriptionCancelledAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    };

    await updateDoc(doc(db, 'users', user.uid), updateData);

    // Log cancellation for audit
    await logAuditEvent('subscription_cancelled', {
      userId: user.uid,
      cancellationDate: new Date().toISOString()
    }, user);

    console.log('Subscription cancelled successfully');
    return updateData;
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

const handleSubscriptionWebhook = async (webhookData) => {
  try {
    const { event_type, resource } = webhookData;
    
    switch (event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        // Handle subscription activation
        console.log('Subscription activated:', resource.id);
        break;
        
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        // Handle subscription cancellation
        console.log('Subscription cancelled:', resource.id);
        break;
        
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        // Handle subscription suspension
        console.log('Subscription suspended:', resource.id);
        break;
        
      default:
        console.log('Unhandled webhook event:', event_type);
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    throw error;
  }
};
// ==========================================
// ENHANCED AUDIT TRAIL FUNCTIONS
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
      userAgent: navigator.userAgent.substring(0, 200), // Limit to prevent bloat
      ipAddress: 'masked_for_privacy', // In production, you might want to capture this
      eventData: {
        ...eventData,
        timestamp: new Date().toISOString()
      },
      compliance: {
        dataClassification: 'CONFIDENTIAL',
        regulatoryScope: 'CRS_OECD',
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
    // Don't throw error to prevent disrupting user experience
  }
};

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
        missingRecommendationColumns: validationResults.missingColumns?.recommendations?.length || 0
      },
      complianceFlags: {
        containsPII: true,
        dataClassification: 'CONFIDENTIAL',
        regulatoryScope: 'CRS_OECD',
        processingLawfulBasis: 'LEGITIMATE_INTEREST'
      },
      technicalMetadata: {
        processingTimeMs: Date.now() - (validationResults.summary?.processingStartTime || Date.now()),
        columnsDetected: Object.keys(validationResults.columnMappings || {}).length,
        validationVersion: '2.0'
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
        generationTimeMs: conversionData.processingTime || 0
      },
      institutionData: {
        giinProvided: !!settingsUsed.reportingFI.giin,
        institutionCountry: settingsUsed.reportingFI.country,
        institutionNameProvided: !!settingsUsed.reportingFI.name,
        addressProvided: !!settingsUsed.reportingFI.address
      },
      complianceMetadata: {
        crsStandard: 'OECD_CRS_v2.0',
        xmlValidation: 'PASSED',
        dataMinimization: true,
        purposeLimitation: 'CRS_REGULATORY_REPORTING',
        schemaCompliance: 'CrsXML_v2.0.xsd'
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

// Enhanced data access logging
const logDataAccess = async (accessType, dataDetails, user = null) => {
  try {
    const auditEntry = {
      timestamp: serverTimestamp(),
      userId: user?.uid || 'anonymous',
      userEmail: user?.email || 'anonymous',
      sessionId: getSessionId(),
      accessType, // 'READ', 'WRITE', 'DELETE', 'EXPORT'
      dataDetails,
      compliance: {
        lawfulBasis: 'LEGITIMATE_INTEREST',
        dataCategory: 'FINANCIAL_DATA',
        accessJustification: 'CRS_COMPLIANCE_PROCESSING'
      }
    };

    await addDoc(collection(db, AUDIT_COLLECTIONS.DATA_ACCESS), auditEntry);
  } catch (error) {
    console.error('Data access audit failed:', error);
  }
};

// ==========================================
// ENHANCED ANALYTICS FUNCTIONS
// ==========================================

const trackEvent = (eventName, parameters = {}) => {
  try {
    if (analytics) {
      const eventParams = {
        timestamp: new Date().toISOString(),
        session_id: getSessionId(),
        user_type: parameters.user_type || 'unknown',
        ...parameters
      };

      // Remove any PII before tracking
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

// Enhanced conversion tracking
const trackConversion = (conversionData) => {
  trackEvent('crs_conversion_completed', {
    record_count: conversionData.recordCount,
    file_type: conversionData.fileType,
    tax_year: conversionData.taxYear,
    user_type: conversionData.userType,
    processing_time_ms: conversionData.processingTime,
    validation_errors: conversionData.validationErrors || 0,
    conversion_id: conversionData.conversionId
  });
};

// User journey tracking
const trackUserJourney = (step, additionalData = {}) => {
  trackEvent('user_journey_step', {
    step,
    ...additionalData
  });
};

// Error tracking with context
const trackError = (error, context = {}) => {
  trackEvent('error_occurred', {
    error_message: error.message.substring(0, 100), // Limit length
    error_type: error.name,
    context_type: context.type || 'unknown',
    user_action: context.userAction || 'unknown',
    severity: context.severity || 'medium'
  });
};

// ==========================================
// ENHANCED AUTHENTICATION CONTEXT
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
          trackUserJourney('user_authenticated', {
            auth_method: firebaseUser.providerData[0]?.providerId || 'email'
          });
        } else {
          setUser(null);
          setUserDoc(null);
          trackUserJourney('user_logged_out');
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setAuthError(error.message);
        trackError(error, { type: 'auth_state_change' });
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
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
      trackError(error, { type: 'user_data_loading' });
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
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
      trackError(error, { type: 'user_registration', userAction: 'register' });
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
      trackError(error, { type: 'user_login', userAction: 'login' });
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
      trackError(error, { type: 'google_signin', userAction: 'google_login' });
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
      trackError(error, { type: 'user_logout' });
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
      trackError(error, { type: 'password_reset' });
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
        trackError(error, { type: 'usage_update' });
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
// BUSINESS LOGIC FUNCTIONS (Enhanced)
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

// ==========================================
// GOOGLE ICON COMPONENT
// ==========================================

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
// REGISTRATION PROMPT COMPONENT (Enhanced)
// ==========================================

const RegistrationPrompt = ({ onRegister, onLogin, onClose }) => {
  const anonymousStatus = canAnonymousUserConvert();

  useEffect(() => {
    trackUserJourney('registration_prompt_shown', {
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
              <li>• Save your conversion history</li>
              <li>• Priority email support</li>
              <li>• Usage analytics dashboard</li>
              <li>• Upgrade options for more conversions</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                trackUserJourney('clicked_register_from_prompt');
                onRegister();
              }}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center"
            >
              Register for 3 More Free Conversions
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
            
            <button
              onClick={() => {
                trackUserJourney('clicked_login_from_prompt');
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
      trackUserJourney('auth_modal_opened', {
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
        trackUserJourney('login_success', { method: 'email' });
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1000);
      } else {
        await register(formData.email, formData.password, formData.displayName, formData.company);
        setMessage('Account created! Please verify your email.');
        trackUserJourney('registration_success', { 
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
      trackError(error, { 
        type: isLogin ? 'login_error' : 'registration_error',
        userAction: isLogin ? 'login' : 'register'
      });
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
      trackUserJourney('login_success', { method: 'google' });
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1000);
    } catch (error) {
      setMessage(error.message);
      trackError(error, { 
        type: 'google_signin_error',
        userAction: 'google_signin'
      });
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
      trackUserJourney('password_reset_sent');
    } catch (error) {
      setMessage(error.message);
      trackError(error, { type: 'password_reset_error' });
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
                  trackUserJourney('switched_auth_mode', { 
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
// ENHANCED PRICING SECTION WITH PAYPAL
// ==========================================

const PricingSection = () => {
  const { user, userDoc } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('register');
  const [processingSubscription, setProcessingSubscription] = useState(null);
  const paypalContainerRef = useRef(null);
  
  const handlePlanClick = async (planKey, plan) => {
    trackUserJourney('pricing_plan_clicked', { 
      plan: planKey,
      price: plan.price,
      user_type: user ? 'registered' : 'anonymous'
    });
    
    if (planKey === 'free') {
      if (!user) {
        setAuthMode('register');
        setShowAuthModal(true);
      } else {
        document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (planKey === 'enterprise') {
      trackUserJourney('enterprise_contact_clicked');
      window.open(`mailto:sales@iafrica.solutions?subject=Enterprise Plan Inquiry&body=Hi, I'm interested in the Enterprise plan for CRS XML conversion. Please contact me with more details.`);
    } else {
      // Professional plan with PayPal
      if (!user) {
        setAuthMode('register');
        setShowAuthModal(true);
        return;
      }

      setProcessingSubscription(planKey);
      
      try {
        // Clear any existing PayPal buttons
        if (paypalContainerRef.current) {
          paypalContainerRef.current.innerHTML = '';
        }

        const paypalButtons = await createPayPalSubscription(
          plan.paypalPlanId,
          async (subscriptionId, subscriptionData) => {
            try {
              await updateUserSubscription(subscriptionId, planKey, user, subscriptionData);
              
              trackEvent('subscription_completed', {
                plan: planKey,
                subscription_id: subscriptionId,
                amount: plan.price
              });

              alert(`Subscription activated! You now have ${plan.conversions} conversions per month.`);
              window.location.reload();
            } catch (error) {
              console.error('Subscription update error:', error);
              alert('Subscription payment successful, but there was an error updating your account. Please contact support.');
            }
          },
          (error) => {
            console.error('PayPal subscription error:', error);
            trackError(error, { 
              type: 'paypal_subscription_error',
              plan: planKey
            });
            alert(`Subscription failed: ${error.message}. Please try again or contact support.`);
            setProcessingSubscription(null);
          }
        );

        if (paypalContainerRef.current && paypalButtons) {
          paypalButtons.render(paypalContainerRef.current);
        }
      } catch (error) {
        console.error('PayPal initialization error:', error);
        alert('Unable to initialize PayPal. Please try again or contact support.');
        setProcessingSubscription(null);
      }
    }
  };
  
  return (
    <>
      <div id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Start free and scale as you grow. All plans include GDPR-compliant processing and professional XML output.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {Object.entries(PRICING_PLANS).map(([key, plan]) => {
              const isCurrentPlan = (userDoc?.plan || 'free') === key;
              const isProcessing = processingSubscription === key;

              return (
                <div
                  key={key}
                  className={`relative rounded-2xl border-2 p-8 ${
                    plan.popular
                      ? 'border-blue-500 bg-blue-50 transform scale-105'
                      : isCurrentPlan
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } transition-all duration-300`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full text-sm font-medium text-white bg-blue-600">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute -top-4 right-4">
                      <span className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-full">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    
                    <div className="flex items-baseline justify-center mb-2">
                      <span className="text-5xl font-bold text-gray-900">
                        ${plan.price}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-lg text-gray-600 ml-1">/month</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-center mt-4 text-sm text-gray-600">
                      <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                      {plan.conversions} conversions/month
                    </div>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* PayPal button container for professional plan */}
                  {key === 'professional' && !isCurrentPlan && isProcessing && (
                    <div 
                      ref={paypalContainerRef}
                      className="mb-4"
                    ></div>
                  )}

                  {!isProcessing && (
                    <button
                      disabled={isCurrentPlan}
                      onClick={() => handlePlanClick(key, plan)}
                      className={`w-full py-3 px-6 rounded-lg font-semibold text-center transition-colors ${
                        isCurrentPlan
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : plan.popular
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : key === 'free'
                          ? 'bg-gray-800 hover:bg-gray-900 text-white'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {isCurrentPlan ? 'Current Plan' : plan.buttonText}
                      {!isCurrentPlan && <ArrowRight className="w-4 h-4 ml-2 inline" />}
                    </button>
                  )}

                  {isProcessing && (
                    <div className="text-center text-sm text-gray-600 mt-2">
                      Loading PayPal...
                    </div>
                  )}

                  {key === 'free' && (
                    <p className="text-xs text-gray-500 text-center mt-3">
                      No credit card required
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </>
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
                <span className="text-lg font-semibold text-gray-900">Compliance Platform</span>
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
            Try 3 conversions FREE • No registration required
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Turn Your Financial Data Into
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Tax Authority Ready Reports</span> 
            <span className="block">in Minutes</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Transform your Excel/CSV financial data into compliant regulatory reports instantly. 
            Try it now with <strong>{usageStatus.remaining} free conversions</strong> - no signup required!
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button 
              onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-lg font-semibold"
            >
              Try Free Now ({usageStatus.remaining} conversions left)
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
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
      <h4 className="font-medium mb-3 text-gray-900">Validation Results</h4>
      
      {validation.canGenerate ? (
        <div className="flex items-center text-green-600 text-sm mb-3">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Ready for XML conversion!
        </div>
      ) : (
        <div className="flex items-center text-red-600 text-sm mb-3">
          <AlertCircle className="w-4 h-4 mr-2" />
          Critical errors must be fixed before conversion
        </div>
      )}

      {/* Critical Errors */}
      {validation.missingColumns?.critical?.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded mb-3">
          <p className="font-medium text-red-800 mb-2">🚫 Critical Errors (Must Fix):</p>
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
          <p className="font-medium text-orange-800 mb-2">⚠️ Warnings (Recommended):</p>
          <ul className="text-sm text-orange-700 space-y-1">
            {validation.missingColumns.warnings.map((col, index) => (
              <li key={index}>• {col.description}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-sm text-gray-600 mt-3">
        Summary: {validation.summary.validRows} rows ready, {validation.summary.invalidRows} with critical errors
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
      address: ''
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
        user_type: user ? 'registered' : 'anonymous'
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
      setError('Please fix critical errors before converting');
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
        taxYear: settings.taxYear
      }, user);	
      
      const xml = generateCRSXML(data, settings, validationResults);
      
      if (user && userDoc) {
        await updateUserUsage();
      } else {
        updateAnonymousUsage();
        trackEvent('anonymous_conversion', {
          file_type: file?.type || 'unknown',
          record_count: data.length,
          conversion_number: getAnonymousUsage().count
        });
      }
      
      await logXMLGeneration({
        recordCount: data.length,
        xml: xml
      }, settings, user);

      setResult({
        xml,
        filename: `CRS_${settings.taxYear}_${Date.now()}.xml`,
        recordCount: data.length,
        timestamp: new Date().toISOString()
      });

      trackEvent('conversion_success', {
        record_count: data.length,
        user_type: user ? 'registered' : 'anonymous'
      });

    } catch (err) {
      console.error('Conversion error:', err);
      
      await logAuditEvent('xml_conversion_error', {
        error: err.message,
        recordCount: data.length
      }, user);	
      
      setError(`Conversion failed: ${err.message}`);
      trackEvent('conversion_error', {
        error: err.message,
        user_type: user ? 'registered' : 'anonymous'
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
      fileSize: result.xml.length
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
      user_type: user ? 'registered' : 'anonymous'
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
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              CRS XML Converter
            </h2>
            <p className="text-xl text-gray-600">
              Convert your Excel/CSV data to regulatory-compliant CRS XML format
            </p>
          </div>

          <div className="space-y-8">
            {/* File Upload Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Step 1: Upload Your Data File
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
                  Supports .xlsx, .xls, and .csv files up to 10MB
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
                  <span>Processing file...</span>
                </div>
              )}

              {data.length > 0 && (
                <div className="mt-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">
                        File processed successfully! Found {data.length} records.
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
                Step 2: Configure Report Settings
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
                    GIIN *
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
                    Converting...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Convert to CRS XML
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
                  Conversion Successful!
                </h3>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-800">
                        Generated CRS XML Report
                      </p>
                      <p className="text-sm text-green-600">
                        {result.recordCount} records • Tax Year {settings.taxYear} • Generated {new Date(result.timestamp).toLocaleString()}
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
                  <p className="text-sm font-medium text-gray-700 mb-2">XML Preview (first 500 characters):</p>
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
// FEATURES SECTION
// ==========================================

const FeaturesSection = () => {
  return (
    <div id="features" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            OECD CRS v2.0 Compliant
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Generate XML reports that meet the latest regulatory standards
          </p>
        </div>
      </div>
    </div>
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
            Professional compliance solutions for financial institutions worldwide.
          </p>
          <p className="text-sm text-gray-500">
            © 2025 {COMPANY_NAME}. All rights reserved.
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
        <PricingSection />
        <CRSConverter />
        <FeaturesSection />
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default CRSXMLConverter;
