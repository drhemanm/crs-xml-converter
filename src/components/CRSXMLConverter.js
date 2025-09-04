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
  DATA_ACCESS: 'audit_data_access'
};

// Realistic pricing plans
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
    paypalPlanId: 'P-37021577G4809293BNCWWCBI',
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
    paypalPlanId: 'P-85257906JW695051MNCWWEIQ',
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
// ANONYMOUS USAGE TRACKING
// ==========================================

const getAnonymousUsage = () => {
  try {
    const usage = JSON.parse(localStorage.getItem(ANONYMOUS_USAGE_KEY) || '{"count": 0, "conversions": []}');
    return usage;
  } catch (error) {
    return { count: 0, conversions: [] };
  }
};

const updateAnonymousUsage = () => {
  try {
    const usage = getAnonymousUsage();
    usage.count += 1;
    usage.conversions.push({
      timestamp: new Date().toISOString(),
      success: true
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
  } catch (error) {
    console.error('Error clearing anonymous usage:', error);
  }
};

const canAnonymousUserConvert = () => {
  const usage = getAnonymousUsage();
  const remaining = ANONYMOUS_LIMIT - usage.count;
  
  return {
    canConvert: remaining > 0,
    remaining: Math.max(0, remaining),
    used: usage.count,
    limit: ANONYMOUS_LIMIT,
    percentUsed: (usage.count / ANONYMOUS_LIMIT) * 100,
    mustRegister: usage.count >= ANONYMOUS_LIMIT
  };
};

// ==========================================
// VALIDATION FUNCTIONS
// ==========================================

const validateGIIN = (giin) => {
  if (!giin || giin.trim() === '') {
    return { valid: false, message: "GIIN is required for CRS compliance", severity: 'error' };
  }
  
  const giinRegex = /^[A-Z0-9]{6}\.[A-Z0-9]{5}\.[A-Z]{2}\.[A-Z0-9]{3}$/;
  
  if (!giinRegex.test(giin.toUpperCase())) {
    return { 
      valid: false, 
      message: "Invalid GIIN format. Should be: XXXXXX.XXXXX.XX.XXX (e.g., ABC123.00000.ME.123)", 
      severity: 'error' 
    };
  }
  
  if (giin.toUpperCase().includes('TEST') || giin.includes('00000')) {
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
  const minYear = 2014;
  
  if (!year) {
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
  if (!name || name.trim() === '') {
    return { valid: false, message: "Financial Institution name is required", severity: 'error' };
  }
  
  if (name.toLowerCase().includes('test') || name.toLowerCase().includes('sample')) {
    return { 
      valid: true, 
      message: "This appears to be test data. Use your actual FI name for live submissions.", 
      severity: 'warning' 
    };
  }
  
  return { valid: true };
};

const getFieldDescription = (field) => {
  const descriptions = {
    'account_number': 'Account Number',
    'account_balance': 'Account Balance',
    'currency_code': 'Currency Code (USD, EUR, etc.)',
    'holder_type': 'Account Holder Type (Individual/Organization)',
    'residence_country': 'Residence Country Code (2 letters)',
    'address_country': 'Address Country Code (2 letters)',
    'city': 'City',
    'first_name': 'First Name',
    'last_name': 'Last Name',
    'organization_name': 'Organization Name',
    'payment_amount': 'Payment Amount',
    'payment_type': 'Payment Type (CRS501-CRS504)'
  };
  return descriptions[field] || field;
};

// ==========================================
// UPDATED VALIDATION FUNCTION
// ==========================================

const validateCRSData = (data) => {
  if (!data || data.length === 0) {
    return {
      canGenerate: false,
      criticalErrors: ['No data found in spreadsheet'],
      warnings: [],
      recommendations: [],
      missingColumns: { critical: [], warnings: [], recommendations: [] },
      dataIssues: { critical: [], warnings: [], recommendations: [] },
      summary: { totalRows: 0, validRows: 0, invalidRows: 0 }
    };
  }

  const headers = Object.keys(data[0]).map(h => h.toLowerCase().trim());
  const requiredFields = ENHANCED_FIELD_MAPPINGS; // Use the new mappings

  // Field classification
  const criticalFields = ['account_number', 'account_balance', 'currency_code', 'holder_type'];
  const warningFields = ['residence_country', 'address_country', 'city'];
  const recommendationFields = ['first_name', 'last_name', 'tin', 'birth_date', 'birth_city', 'birth_country', 'organization_name', 'organization_tin', 'controlling_person_first_name', 'controlling_person_last_name', 'controlling_person_birth_date', 'controlling_person_birth_country', 'controlling_person_residence_country', 'controlling_person_address_country', 'controlling_person_city', 'controlling_person_tin', 'payment_type', 'payment_amount'];

  const columnMappings = {};
  const missingColumns = { critical: [], warnings: [], recommendations: [] };

  // Check for missing columns
  Object.entries(requiredFields).forEach(([field, alternatives]) => {
    let found = false;
    for (const alt of alternatives) {
      if (headers.includes(alt.toLowerCase())) {
        columnMappings[field] = Object.keys(data[0]).find(h => 
          h.toLowerCase().trim() === alt.toLowerCase()
        );
        found = true;
        break;
      }
    }
    
    if (!found) {
      const fieldInfo = { field, alternatives, description: getFieldDescription(field) };
      
      if (criticalFields.includes(field)) {
        missingColumns.critical.push(fieldInfo);
      } else if (warningFields.includes(field)) {
        missingColumns.warnings.push(fieldInfo);
      } else if (recommendationFields.includes(field)) {
        missingColumns.recommendations.push(fieldInfo);
      }
    }
  });

  // Validate each row
  const dataIssues = { critical: [], warnings: [], recommendations: [] };
  let validRows = 0;
  let invalidRows = 0;

  data.forEach((row, index) => {
    const critical = [];
    const warnings = [];
    const recommendations = [];
    
    const holderType = row[columnMappings.holder_type]?.toLowerCase();

    // Critical validations
    if (!row[columnMappings.account_number]?.trim()) {
      critical.push('Account number is required');
    }
    
    const balance = parseFloat(row[columnMappings.account_balance]);
    if (isNaN(balance) || balance < 0) {
      critical.push('Valid account balance is required');
    }
    
    if (!row[columnMappings.currency_code]?.match(/^[A-Z]{3}$/)) {
      critical.push('Valid 3-letter currency code is required');
    }
    
    if (!['individual', 'organization', 'organisation'].includes(holderType)) {
      critical.push('Holder type must be Individual or Organization');
    }

    // Warning validations
    if (!row[columnMappings.residence_country]?.match(/^[A-Z]{2}$/)) {
      warnings.push('Residence country code recommended for compliance');
    }
    
    if (!row[columnMappings.city]?.trim()) {
      warnings.push('City information recommended');
    }

    // Recommendation validations
    if (holderType === 'individual') {
      if (!row[columnMappings.first_name]?.trim() || !row[columnMappings.last_name]?.trim()) {
        recommendations.push('Full name improves CRS compliance');
      }
      
      if (!row[columnMappings.tin]?.trim()) {
        recommendations.push('TIN number recommended when available');
      }
    }

    // Categorize issues
    if (critical.length > 0) {
      dataIssues.critical.push({ row: index + 1, errors: critical });
      invalidRows++;
    } else {
      validRows++;
    }
    
    if (warnings.length > 0) {
      dataIssues.warnings.push({ row: index + 1, errors: warnings });
    }
    
    if (recommendations.length > 0) {
      dataIssues.recommendations.push({ row: index + 1, errors: recommendations });
    }
  });

  // Determine if XML can be generated
  const canGenerate = missingColumns.critical.length === 0 && dataIssues.critical.length === 0;

  return {
    canGenerate,
    criticalErrors: missingColumns.critical.length > 0 ? ['Missing critical columns'] : [],
    warnings: missingColumns.warnings.length > 0 ? ['Missing recommended columns'] : [],
    recommendations: missingColumns.recommendations.length > 0 ? ['Optional fields missing'] : [],
    missingColumns,
    columnMappings,
    dataIssues,
    summary: { totalRows: data.length, validRows, invalidRows }
  };
};
// ==========================================
// CORRECTED DATA MAPPING FUNCTION
// ==========================================

const mapDataToCRS = (rowData, columnMappings) => {
  const holderType = rowData[columnMappings.holder_type]?.toLowerCase();
  
  return {
    // Account details
    accountNumber: rowData[columnMappings.account_number] || '',
    accountBalance: parseFloat(rowData[columnMappings.account_balance]) || 0,
    currencyCode: (rowData[columnMappings.currency_code] || 'USD').toUpperCase(),
    
    // Holder type determines structure
    isIndividual: holderType === 'individual',
    isOrganization: ['organization', 'organisation'].includes(holderType),
    
    // Individual data
    individual: holderType === 'individual' ? {
      firstName: rowData[columnMappings.first_name] || '',
      lastName: rowData[columnMappings.last_name] || '',
      birthDate: rowData[columnMappings.birth_date] || '',
      birthCity: rowData[columnMappings.birth_city] || '',
      birthCountry: rowData[columnMappings.birth_country] || '',
      tin: rowData[columnMappings.tin] || '',
      resCountryCode: (rowData[columnMappings.residence_country] || 'XX').toUpperCase(),
      addressCountryCode: (rowData[columnMappings.address_country] || rowData[columnMappings.residence_country] || 'XX').toUpperCase(),
      city: rowData[columnMappings.city] || '',
      address: rowData[columnMappings.address] || ''
    } : null,
    
    // Organization data
    organization: ['organization', 'organisation'].includes(holderType) ? {
      name: rowData[columnMappings.organization_name] || '',
      tin: rowData[columnMappings.organization_tin] || '',
      resCountryCode: (rowData[columnMappings.residence_country] || 'XX').toUpperCase(),
      addressCountryCode: (rowData[columnMappings.address_country] || rowData[columnMappings.residence_country] || 'XX').toUpperCase(),
      city: rowData[columnMappings.city] || '',
      address: rowData[columnMappings.address] || ''
    } : null,
    
    // Controlling person (required for organizations)
    controllingPerson: ['organization', 'organisation'].includes(holderType) ? {
      firstName: rowData[columnMappings.controlling_person_first_name] || '',
      lastName: rowData[columnMappings.controlling_person_last_name] || '',
      birthDate: rowData[columnMappings.controlling_person_birth_date] || '',
      birthCity: rowData[columnMappings.controlling_person_birth_city] || '',
      birthCountry: rowData[columnMappings.controlling_person_birth_country] || '',
      resCountryCode: (rowData[columnMappings.controlling_person_residence_country] || 'XX').toUpperCase(),
      addressCountryCode: (rowData[columnMappings.controlling_person_address_country] || rowData[columnMappings.controlling_person_residence_country] || 'XX').toUpperCase(),
      city: rowData[columnMappings.controlling_person_city] || '',
      address: rowData[columnMappings.controlling_person_address] || '',
      tin: rowData[columnMappings.controlling_person_tin] || ''
    } : null,
    
    // Enhanced payment data
    payment: {
      type: rowData[columnMappings.payment_type] || 'CRS503',
      amount: parseFloat(rowData[columnMappings.payment_amount]) || parseFloat(rowData[columnMappings.account_balance]) || 0,
      interestAmount: parseFloat(rowData[columnMappings.interest_amount]) || 0,
      dividendAmount: parseFloat(rowData[columnMappings.dividend_amount]) || 0,
      currency: (rowData[columnMappings.currency_code] || 'USD').toUpperCase()
    }
  };
};

// ==========================================
// CORRECTED CRS XML GENERATION FUNCTION
// ==========================================

const generateCRSXML = (data, settings, validationResults) => {
  const { reportingFI, messageRefId, taxYear } = settings;
  const { columnMappings } = validationResults;
  
  const formatDate = (date) => {
    if (!date) return '';
    // Ensure proper date format YYYY-MM-DD
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toFixed(2);
  };

  const generateUniqueRefId = (prefix = 'MU2024MU') => {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return prefix + result;
  };

  const generateDocRefId = () => {
    return generateUniqueRefId('MU2024MU');
  };

  const generateAccountReport = (mappedAccount, index) => {
    const docRefId = generateDocRefId();
    
    // Generate account holder section based on type
    const generateAccountHolder = () => {
      if (mappedAccount.isIndividual) {
        return `
        <AccountHolder>
          <Individual>
            <ResCountryCode>${mappedAccount.individual.resCountryCode || 'XX'}</ResCountryCode>
            <TIN issuedBy="${mappedAccount.individual.resCountryCode || 'XX'}">${mappedAccount.individual.tin || 'N/A'}</TIN>
            <Name nameType="OECD202">
              <FirstName>${mappedAccount.individual.firstName || ''}</FirstName>
              <LastName>${mappedAccount.individual.lastName || ''}</LastName>
            </Name>
            <Address legalAddressType="OECD302">
              <cfc:CountryCode>${mappedAccount.individual.addressCountryCode || mappedAccount.individual.resCountryCode || 'XX'}</cfc:CountryCode>
              <cfc:AddressFix>
                <cfc:Street>${mappedAccount.individual.address || ''}</cfc:Street>
                <cfc:City>${mappedAccount.individual.city || ''}</cfc:City>
              </cfc:AddressFix>
            </Address>
            ${mappedAccount.individual.birthDate ? `
            <BirthInfo>
              <BirthDate>${formatDate(mappedAccount.individual.birthDate)}</BirthDate>
              <City>${mappedAccount.individual.birthCity || ''}</City>
              <CountryInfo>
                <CountryCode>${mappedAccount.individual.birthCountry || mappedAccount.individual.resCountryCode || 'XX'}</CountryCode>
              </CountryInfo>
            </BirthInfo>` : ''}
          </Individual>
          <AcctHolderType>CRS101</AcctHolderType>
        </AccountHolder>`;
      } else if (mappedAccount.isOrganization) {
        return `
        <AccountHolder>
          <Organisation>
            <ResCountryCode>${mappedAccount.organization.resCountryCode || 'XX'}</ResCountryCode>
            <IN issuedBy="${mappedAccount.organization.resCountryCode || 'XX'}">${mappedAccount.organization.tin || 'N/A'}</IN>
            <Name>${mappedAccount.organization.name || ''}</Name>
            <Address>
              <cfc:CountryCode>${mappedAccount.organization.addressCountryCode || mappedAccount.organization.resCountryCode || 'XX'}</cfc:CountryCode>
              <cfc:AddressFix>
                <cfc:Street>${mappedAccount.organization.address || ''}</cfc:Street>
                <cfc:City>${mappedAccount.organization.city || ''}</cfc:City>
              </cfc:AddressFix>
            </Address>
          </Organisation>
          <AcctHolderType>CRS101</AcctHolderType>
        </AccountHolder>`;
      }
      return '';
    };

    // Generate controlling person section (only for organizations)
    const generateControllingPerson = () => {
      if (!mappedAccount.isOrganization || !mappedAccount.controllingPerson) {
        return '';
      }
      
      return `
        <ControllingPerson>
          <Individual>
            <ResCountryCode>${mappedAccount.controllingPerson.resCountryCode || 'XX'}</ResCountryCode>
            <TIN issuedBy="${mappedAccount.controllingPerson.resCountryCode || 'XX'}">${mappedAccount.controllingPerson.tin || 'N/A'}</TIN>
            <Name nameType="OECD202">
              <FirstName>${mappedAccount.controllingPerson.firstName || ''}</FirstName>
              <LastName>${mappedAccount.controllingPerson.lastName || ''}</LastName>
            </Name>
            <Address legalAddressType="OECD302">
              <cfc:CountryCode>${mappedAccount.controllingPerson.addressCountryCode || mappedAccount.controllingPerson.resCountryCode || 'XX'}</cfc:CountryCode>
              <cfc:AddressFix>
                <cfc:Street>${mappedAccount.controllingPerson.address || ''}</cfc:Street>
                <cfc:City>${mappedAccount.controllingPerson.city || ''}</cfc:City>
              </cfc:AddressFix>
            </Address>
            ${mappedAccount.controllingPerson.birthDate ? `
            <BirthInfo>
              <BirthDate>${formatDate(mappedAccount.controllingPerson.birthDate)}</BirthDate>
              <City>${mappedAccount.controllingPerson.birthCity || ''}</City>
              <CountryInfo>
                <CountryCode>${mappedAccount.controllingPerson.birthCountry || mappedAccount.controllingPerson.resCountryCode || 'XX'}</CountryCode>
              </CountryInfo>
            </BirthInfo>` : ''}
          </Individual>
          <CtrlgPersonType>CRS801</CtrlgPersonType>
        </ControllingPerson>`;
    };

    // Generate payment sections - handle multiple payments
    const generatePayments = () => {
      const payments = [];
      
      // Interest payment (CRS501)
      if (mappedAccount.payment.interestAmount && mappedAccount.payment.interestAmount > 0) {
        payments.push(`
        <Payment>
          <Type>CRS501</Type>
          <PaymentAmnt currCode="${mappedAccount.payment.currency}">${formatCurrency(mappedAccount.payment.interestAmount)}</PaymentAmnt>
        </Payment>`);
      }
      
      // Other income payment (CRS503) - typically account balance
      if (mappedAccount.payment.amount && mappedAccount.payment.amount > 0) {
        payments.push(`
        <Payment>
          <Type>CRS503</Type>
          <PaymentAmnt currCode="${mappedAccount.payment.currency}">${formatCurrency(mappedAccount.payment.amount)}</PaymentAmnt>
        </Payment>`);
      }
      
      // If no specific payments, create a default CRS503 payment with account balance
      if (payments.length === 0 && mappedAccount.accountBalance > 0) {
        payments.push(`
        <Payment>
          <Type>CRS503</Type>
          <PaymentAmnt currCode="${mappedAccount.currencyCode}">${formatCurrency(mappedAccount.accountBalance)}</PaymentAmnt>
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
        <AccountNumber UndocumentedAccount="true" AcctNumberType="OECD605">${mappedAccount.accountNumber}</AccountNumber>
        ${generateAccountHolder()}
        ${generateControllingPerson()}
        <AccountBalance currCode="${mappedAccount.currencyCode}">${formatCurrency(mappedAccount.accountBalance)}</AccountBalance>
        ${generatePayments()}
      </AccountReport>`;
  };
  
  // Map each row to CRS structure
  const mappedAccounts = data.map(row => mapDataToCRS(row, columnMappings));
  
  // Generate account reports
  const accountReports = mappedAccounts.map((account, index) => generateAccountReport(account, index)).join('');

  // Generate message reference ID with proper format
  const messageRef = messageRefId || generateUniqueRefId('MU2024MU');
  const reportingPeriod = `${taxYear}-12-31`;
  const timestamp = new Date().toISOString();

  return `<?xml version="1.0" encoding="utf-8"?>
<CRS_OECD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:crs="urn:oecd:ties:crs:v2" xmlns:cfc="urn:oecd:ties:commontypesfatcacrs:v2" xmlns:stf="urn:oecd:ties:crsstf:v5" version="2.0" xmlns="urn:oecd:ties:crs:v2">
  <MessageSpec>
    <SendingCompanyIN>${reportingFI.giin || ''}</SendingCompanyIN>
    <TransmittingCountry>${reportingFI.country || 'MU'}</TransmittingCountry>
    <ReceivingCountry>${reportingFI.country || 'MU'}</ReceivingCountry>
    <MessageType>CRS</MessageType>
    <MessageRefId>${messageRef}</MessageRefId>
    <MessageTypeIndic>CRS701</MessageTypeIndic>
    <ReportingPeriod>${reportingPeriod}</ReportingPeriod>
    <Timestamp>${timestamp}</Timestamp>
  </MessageSpec>
  <CrsBody>
    <ReportingFI>
      <ResCountryCode>${reportingFI.country || 'MU'}</ResCountryCode>
      <IN issuedBy="${reportingFI.country || 'MU'}" INType="TIN">${reportingFI.giin || ''}</IN>
      <Name>${reportingFI.name || ''}</Name>
      <Address>
        <cfc:CountryCode>${reportingFI.country || 'MU'}</cfc:CountryCode>
        <cfc:AddressFix>
          <cfc:Street>${reportingFI.address || ''}</cfc:Street>
          <cfc:City>${reportingFI.city || ''}</cfc:City>
        </cfc:AddressFix>
      </Address>
      <DocSpec>
        <stf:DocTypeIndic>OECD1</stf:DocTypeIndic>
        <stf:DocRefId>${generateDocRefId()}</stf:DocRefId>
      </DocSpec>
    </ReportingFI>
    <ReportingGroup>
      ${accountReports}
    </ReportingGroup>
  </CrsBody>
</CRS_OECD>`;
};
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
      userAgent: navigator.userAgent,
      eventData,
      compliance: {
        dataClassification: 'CONFIDENTIAL',
        regulatoryScope: 'CRS_OECD'
      }
    };

    await addDoc(collection(db, AUDIT_COLLECTIONS.USER_ACTIONS), auditEntry);
    console.log(`Audit Event Logged: ${eventType}`);
  } catch (error) {
    console.error('Audit logging failed:', error);
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
        recordCount: validationResults.summary?.totalRows || 0,
        validRecords: validationResults.summary?.validRows || 0,
        invalidRecords: validationResults.summary?.invalidRows || 0
      },
      validationResults: {
        canGenerate: validationResults.canGenerate,
        errorCount: validationResults.criticalErrors?.length || 0,
        missingColumns: (validationResults.missingColumns?.critical?.length || 0) + 
                       (validationResults.missingColumns?.warnings?.length || 0) + 
                       (validationResults.missingColumns?.recommendations?.length || 0)
      },
      complianceFlags: {
        containsPII: true,
        dataClassification: 'CONFIDENTIAL',
        regulatoryScope: 'CRS_OECD'
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
        xmlSize: conversionData.xml.length
      },
      institutionData: {
        giinProvided: !!settingsUsed.reportingFI.giin,
        institutionCountry: settingsUsed.reportingFI.country
      },
      complianceMetadata: {
        crsStandard: 'OECD_CRS_v2.0',
        xmlValidation: 'PASSED',
        dataMinimization: true,
        purposeLimitation: 'CRS_REGULATORY_REPORTING'
      }
    };

    await addDoc(collection(db, AUDIT_COLLECTIONS.XML_GENERATION), auditEntry);
    console.log('XML generation audit logged');
  } catch (error) {
    console.error('XML generation audit failed:', error);
  }
};

// ==========================================
// ANALYTICS FUNCTIONS
// ==========================================

const trackEvent = (eventName, parameters = {}) => {
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

// ==========================================
// AUTHENTICATION CONTEXT
// ==========================================

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDoc, setUserDoc] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await loadUserData(firebaseUser);
      } else {
        setUser(null);
        setUserDoc(null);
      }
      setLoading(false);
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
      } else {
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
          savedGIINs: []
        };
        
        await setDoc(userDocRef, userData);
        setUserDoc(userData);
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
        savedGIINs: []
      };
      
      await setDoc(doc(db, 'users', newUser.uid), userData);
      await sendEmailVerification(newUser);
      
      setUserDoc(userData);
      clearAnonymousUsage();
      
      return newUser;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error.code));
    }
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;
      
      await updateDoc(doc(db, 'users', loggedInUser.uid), {
        lastLogin: serverTimestamp()
      });
      
      clearAnonymousUsage();
      return loggedInUser;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error.code));
    }
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      clearAnonymousUsage();
      return user;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error.code));
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error.code));
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
        
        return newUsage;
      } catch (error) {
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, userDoc, loading, login, register, signInWithGoogle, logout, resetPassword, 
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
    default:
      return 'An error occurred. Please try again.';
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
  
  const { conversionsUsed = 0, conversionsLimit = 3, subscriptionStatus = 'active' } = userDoc;
  
  if (subscriptionStatus !== 'active') {
    return {
      canConvert: false,
      remaining: 0,
      used: conversionsUsed,
      limit: conversionsLimit,
      percentUsed: 100,
      userType: 'registered',
      reason: 'Subscription inactive. Please contact support.'
    };
  }
  
  const remaining = Math.max(0, conversionsLimit - conversionsUsed);
  const canConvert = remaining > 0;
  
  return {
    canConvert,
    remaining,
    used: conversionsUsed,
    limit: conversionsLimit,
    percentUsed: (conversionsUsed / conversionsLimit) * 100,
    userType: 'registered',
    reason: !canConvert ? `You've used all ${conversionsLimit} conversions for your ${userDoc.plan || 'free'} plan. Please upgrade to continue.` : null
  };
};
// ==========================================
// GOOGLE ICON COMPONENT
// ==========================================

const GoogleIcon = ({ className }) => (
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
// REGISTRATION PROMPT COMPONENT
// ==========================================

const RegistrationPrompt = ({ onRegister, onLogin }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
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
              onClick={onRegister}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center"
            >
              Register for 3 More Free Conversions
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
            
            <button
              onClick={onLogin}
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
// AUTHENTICATION MODAL
// ==========================================

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, register, signInWithGoogle, resetPassword } = useAuth();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    company: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        setMessage('Successfully signed in!');
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1000);
      } else {
        await register(formData.email, formData.password, formData.displayName, formData.company);
        setMessage('Account created! Please verify your email.');
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
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          {isLogin ? 'Access your dashboard and conversions' : 'Get 3 additional free conversions'}
        </p>

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
              message.includes('Success') || message.includes('sent') 
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

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        {isLogin && (
          <div className="mt-4 text-center">
            <button
              onClick={handleResetPassword}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Forgot your password?
            </button>
          </div>
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

          {usageStatus.used > 0 && (
            <div className="max-w-md mx-auto mb-8">
              <div className="bg-white rounded-lg shadow-sm p-4 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Free Trial Progress</span>
                  <span className="text-sm text-gray-600">{usageStatus.used}/{usageStatus.limit}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${usageStatus.percentUsed}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {usageStatus.remaining > 0 
                    ? `${usageStatus.remaining} free conversions remaining` 
                    : 'Register for 3 more free conversions!'
                  }
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">3 Free</div>
              <div className="text-gray-600">No registration</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">2025</div>
              <div className="text-gray-600">Latest Standards</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">Less than 5 Min</div>
              <div className="text-gray-600">Average Processing</div>
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

      {/* Recommendations */}
      {validation.missingColumns?.recommendations?.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded mb-3">
          <p className="font-medium text-blue-800 mb-2">💡 Suggestions (Optional):</p>
          <ul className="text-sm text-blue-700 space-y-1">
            {validation.missingColumns.recommendations.map((col, index) => (
              <li key={index}>• {col.description}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-gray-600 mt-3">
        Summary: {validation.summary.validRows} rows ready, {validation.summary.invalidRows} with critical errors
      </div>
    </div>
  );
};
// ==========================================
// PRICING SECTION COMPONENT
// ==========================================

const PricingSection = () => {
  const { user, userDoc } = useAuth();
  
  return (
    <div id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start free and scale as you grow. All plans include GDPR-compliant processing and professional XML output.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {Object.entries(PRICING_PLANS).map(([key, plan]) => {
            const isCurrentPlan = (userDoc?.plan || 'free') === key;

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
                {/* Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full text-sm font-medium text-white bg-blue-600">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current Plan Indicator */}
                {isCurrentPlan && (
                  <div className="absolute -top-4 right-4">
                    <span className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-full">
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Plan Header */}
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

                {/* Features List */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  disabled={isCurrentPlan}
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

                {/* Additional Info */}
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
            
            <div className="mt-6 inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border">
              <div className="flex items-center space-x-3">
                <div className="text-sm">
                  {user ? (
                    <span className="font-medium text-gray-900">
                      {usageStatus.remaining} of {usageStatus.limit} conversions remaining
                    </span>
                  ) : (
                    <span className="font-medium text-blue-600">
                      {usageStatus.remaining} free conversions remaining
                    </span>
                  )}
                </div>
                <div className="w-16 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(usageStatus.used / usageStatus.limit) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
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
                  <div className = "p-4 bg-green-50 border border-green-200 rounded-lg">
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Institution Address
                  </label>
                  <textarea
                    value={settings.reportingFI.address}
                    onChange={(e) => handleSettingsChange('reportingFI', 'address', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Full address of your financial institution"
                  />
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
// FEATURES SECTION (Simplified)
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
// FOOTER COMPONENT (Simplified)
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
// MAIN APP COMPONENT
// ==========================================

const App = () => {
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

const CRSXMLConverter = App;
export default CRSXMLConverter;
