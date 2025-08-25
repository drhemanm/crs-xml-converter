import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

// Firebase imports - REAL authentication and database
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

// Import all the icons we'll use throughout the app
import { 
  Upload, Download, FileText, AlertCircle, CheckCircle2, Settings, 
  Shield, X, HelpCircle, Clock, Zap, Lock, Globe, ChevronRight,
  User, Building2, Menu, LogOut, CreditCard, BarChart3,
  Star, Crown, Sparkles, ArrowRight, Check, Users, Calendar,
  TrendingUp, Award, Headphones, Smartphone, Eye, History,
  DollarSign, Target, Activity, Briefcase, AlertTriangle, Mail
} from 'lucide-react';

// Import Excel processing library
import * as XLSX from 'xlsx';

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyAzb_3sb9Iwa8bnpZTib_eEimhIB8Fqf3Y",
  authDomain: "crs-xml-converter-saas.firebaseapp.com",
  projectId: "crs-xml-converter-saas",
  storageBucket: "crs-xml-converter-saas.firebasestorage.app",
  messagingSenderId: "120438086826",
  appId: "1:120438086826:web:089fcf98b869e677c104d3",
  measurementId: "G-0T1ZEY9XTL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

console.log('🔥 Firebase initialized successfully!');

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

const trackUserRegistration = (method, plan = 'free') => {
  trackEvent('user_registration', {
    method,
    plan,
    value: plan === 'free' ? 0 : plan === 'professional' ? 29 : 99
  });
};

const trackUserLogin = (method) => {
  trackEvent('user_login', { method });
};

const trackConversion = (fileType, recordCount, plan) => {
  trackEvent('file_conversion', {
    file_type: fileType,
    record_count: recordCount,
    user_plan: plan,
    conversion_value: plan === 'free' ? 0 : plan === 'professional' ? 0.29 : 0.099
  });
};

const trackPlanUpgrade = (fromPlan, toPlan, method = 'paypal') => {
  trackEvent('plan_upgrade', {
    from_plan: fromPlan,
    to_plan: toPlan,
    payment_method: method,
    value: toPlan === 'professional' ? 29 : 99
  });
};

const trackSupportContact = (method, plan) => {
  trackEvent('support_contact', {
    contact_method: method,
    user_plan: plan
  });
};

// ==========================================
// BUSINESS CONFIGURATION
// ==========================================

const SUPPORT_EMAIL = 'contact@iafrica.solutions';
const COMPANY_NAME = 'Intelligent Africa Solutions Ltd';

const PRICING_PLANS = {
  free: {
    name: 'Free Trial',
    price: 0,
    conversions: 3,
    features: [
      '3 free conversions',
      'Basic XML generation',
      'Email support',
      'Standard processing',
      'GDPR compliant'
    ],
    buttonText: 'Current Plan',
    popular: false,
    color: 'gray',
    paypalPlanId: null
  },
  professional: {
    name: 'Professional',
    price: 29,
    conversions: 100,
    features: [
      '100 conversions/month',
      'Priority processing',
      'Email + Chat support',
      'Bulk file processing',
      'Usage analytics',
      'Custom templates',
      'API access'
    ],
    buttonText: 'Upgrade to Pro',
    popular: true,
    color: 'blue',
    paypalPlanId: 'professional'
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    conversions: 1000,
    features: [
      '1,000 conversions/month',
      'White-label option',
      '24/7 phone support',
      'API access',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
      'Priority queue'
    ],
    buttonText: 'Upgrade to Enterprise',
    popular: false,
    color: 'purple',
    paypalPlanId: 'enterprise'
  }
};

// ==========================================
// PAYPAL COMPONENT
// ==========================================

const PayPalButton = ({ plan, user, onSuccess, onError }) => {
  const paypalRef = useRef();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load PayPal SDK
    const script = document.createElement('script');
    script.src = "https://www.paypal.com/sdk/js?client-id=AUJJg3yZa5HYgAYVsUXEv1LYK0Wi5zsGDqqYngj9MhJB8Mwr1ly-tzHh-kjWO5cqHGhw0VXKEL0yJJCj&currency=USD";
    script.async = true;
    script.onload = () => {
      setIsLoading(false);
      initPayPal();
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const initPayPal = () => {
    if (window.paypal && paypalRef.current) {
      window.paypal.Buttons({
        createOrder: (data, actions) => {
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: PRICING_PLANS[plan].price.toString(),
                currency_code: 'USD'
              },
              description: `CRS XML Converter - ${PRICING_PLANS[plan].name}`,
              custom_id: `${user.uid}_${plan}_${Date.now()}`
            }],
            application_context: {
              brand_name: 'iAfrica CRS Converter',
              user_action: 'PAY_NOW'
            }
          });
        },
        onApprove: async (data, actions) => {
          try {
            const order = await actions.order.capture();
            console.log('✅ PayPal payment successful:', order);
            onSuccess(order);
          } catch (error) {
            console.error('❌ PayPal capture error:', error);
            onError(error);
          }
        },
        onError: (err) => {
          console.error('❌ PayPal error:', err);
          onError(err);
        },
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
          height: 45
        }
      }).render(paypalRef.current);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Clock className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Loading PayPal...</span>
      </div>
    );
  }

  return <div ref={paypalRef}></div>;
};

// ==========================================
// VALIDATION FUNCTIONS (Enhanced)
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

const validateAllFields = (settings) => {
  const errors = [];
  const warnings = [];
  
  const fiNameValidation = validateFIName(settings.reportingFI.name);
  if (!fiNameValidation.valid) {
    errors.push(fiNameValidation.message);
  } else if (fiNameValidation.severity === 'warning') {
    warnings.push(fiNameValidation.message);
  }
  
  const giinValidation = validateGIIN(settings.reportingFI.giin);
  if (!giinValidation.valid) {
    errors.push(giinValidation.message);
  } else if (giinValidation.severity === 'warning') {
    warnings.push(giinValidation.message);
  }
  
  const taxYearValidation = validateTaxYear(settings.taxYear);
  if (!taxYearValidation.valid) {
    errors.push(taxYearValidation.message);
  } else if (taxYearValidation.severity === 'warning') {
    warnings.push(taxYearValidation.message);
  }
  
  return { errors, warnings };
};

// ==========================================
// BUSINESS LOGIC ENFORCEMENT
// ==========================================

const canUserConvert = (userDoc) => {
  if (!userDoc) return { canConvert: false, reason: 'User not found' };
  
  const { conversionsUsed = 0, conversionsLimit = 3, plan = 'free', subscriptionStatus = 'active' } = userDoc;
  
  // Check if subscription is active
  if (subscriptionStatus !== 'active') {
    return { canConvert: false, reason: 'Subscription inactive. Please contact support.' };
  }
  
  // Check usage limits
  if (conversionsUsed >= conversionsLimit) {
    return { 
      canConvert: false, 
      reason: `You've used all ${conversionsLimit} conversions for your ${plan} plan. Please upgrade to continue.` 
    };
  }
  
  return { 
    canConvert: true, 
    remaining: conversionsLimit - conversionsUsed,
    percentUsed: (conversionsUsed / conversionsLimit) * 100
  };
};

const getPlanLimits = (plan) => {
  const limits = {
    free: { conversions: 3, price: 0, features: ['Basic conversion', 'Email support'] },
    professional: { conversions: 100, price: 29, features: ['100 conversions/month', 'Priority support', 'API access'] },
    enterprise: { conversions: 1000, price: 99, features: ['1000 conversions/month', '24/7 support', 'Custom features'] }
  };
  
  return limits[plan] || limits.free;
};

// ==========================================
// ENHANCED AUTHENTICATION CONTEXT
// ==========================================

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDoc, setUserDoc] = useState(null);

  useEffect(() => {
    console.log('🔍 Setting up Firebase auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔄 Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');
      
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
      console.log('👤 Loading user data from Firestore...');
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        console.log('✅ User data loaded from Firestore:', userData);
        setUserDoc(userData);
      } else {
        console.log('⚠️ User document not found - creating new one...');
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
          provider: firebaseUser.providerData[0]?.providerId || 'email'
        };
        
        await setDoc(userDocRef, userData);
        setUserDoc(userData);
      }
      
      setUser(firebaseUser);
      
      // Track login
      trackUserLogin(firebaseUser.providerData[0]?.providerId || 'email');
      
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      setUser(firebaseUser);
      setUserDoc(null);
    }
  };

  const register = async (email, password, displayName, company) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
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
        provider: 'email'
      };
      
      await setDoc(doc(db, 'users', newUser.uid), userData);
      await sendEmailVerification(newUser);
      
      setUserDoc(userData);
      
      // Track registration
      trackUserRegistration('email', 'free');
      
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
      
      return loggedInUser;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error.code));
    }
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        await updateDoc(userDocRef, {
          lastLogin: serverTimestamp()
        });
      }
      
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
        // Check if user can convert
        const conversionCheck = canUserConvert(userDoc);
        if (!conversionCheck.canConvert) {
          throw new Error(conversionCheck.reason);
        }

        await updateDoc(doc(db, 'users', user.uid), {
          conversionsUsed: increment(1),
          lastConversion: serverTimestamp()
        });
        
        const newUsage = userDoc.conversionsUsed + 1;
        setUserDoc(prev => ({
          ...prev,
          conversionsUsed: newUsage
        }));
        
        // Log conversion for analytics
        await addDoc(collection(db, 'conversions'), {
          userId: user.uid,
          timestamp: serverTimestamp(),
          success: true,
          plan: userDoc.plan,
          usageCount: newUsage
        });
        
        console.log('✅ Usage updated successfully');
        return newUsage;
        
      } catch (error) {
        console.error('❌ Failed to update usage:', error);
        throw error;
      }
    }
  };

  const upgradePlan = async (plan, paypalOrderId = null) => {
    if (user) {
      try {
        const oldPlan = userDoc?.plan || 'free';
        const limits = getPlanLimits(plan);
        
        const updateData = {
          plan,
          conversionsLimit: limits.conversions,
          subscriptionStatus: 'active',
          planUpdatedAt: serverTimestamp(),
          paypalOrderId,
          lastBillingDate: serverTimestamp(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        };
        
        await updateDoc(doc(db, 'users', user.uid), updateData);
        setUserDoc(prev => ({ ...prev, ...updateData }));
        
        // Log subscription change
        await addDoc(collection(db, 'subscriptions'), {
          userId: user.uid,
          fromPlan: oldPlan,
          toPlan: plan,
          timestamp: serverTimestamp(),
          status: 'active',
          paypalOrderId,
          amount: limits.price
        });
        
        // Track upgrade
        trackPlanUpgrade(oldPlan, plan, 'paypal');
        
        console.log('✅ Plan upgraded successfully');
        
      } catch (error) {
        console.error('❌ Failed to upgrade plan:', error);
        throw error;
      }
    }
  };

  const getUserConversions = async () => {
    if (user) {
      try {
        const conversionsQuery = query(
          collection(db, 'conversions'),
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        
        const conversionsSnap = await getDocs(conversionsQuery);
        const conversions = conversionsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        return conversions;
      } catch (error) {
        console.error('❌ Failed to get conversions:', error);
        return [];
      }
    }
    return [];
  };

  return (
    <AuthContext.Provider value={{ 
      user, userDoc, loading, login, register, signInWithGoogle, logout, resetPassword, 
      updateUserUsage, upgradePlan, getUserConversions, canUserConvert
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
// CRS XML GENERATION LOGIC
// ==========================================

const generateCRSXML = (data, settings) => {
  const { reportingFI, messageRefId, taxYear } = settings;
  
  const formatDate = (date) => {
    return new Date(date).toISOString().split('T')[0];
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toFixed(2);
  };

  const generateAccountReport = (account) => {
    return `
      <crs:AccountReport>
        <crs:DocSpec>
          <stf:DocTypeIndic>OECD1</stf:DocTypeIndic>
          <stf:DocRefId>${account.AccountNumber || 'UNKNOWN'}</stf:DocRefId>
          <stf:CorrDocRefId></stf:CorrDocRefId>
        </crs:DocSpec>
        <crs:AccountNumber>${account.AccountNumber || ''}</crs:AccountNumber>
        <crs:AccountHolder>
          <crs:Individual>
            <crs:ResCountryCode>${account.ResCountryCode || 'XX'}</crs:ResCountryCode>
            <crs:TIN issuedBy="${account.ResCountryCode || 'XX'}">${account.TIN || ''}</crs:TIN>
            <crs:Name>
              <crs:FirstName>${account.FirstName || ''}</crs:FirstName>
              <crs:LastName>${account.LastName || ''}</crs:LastName>
            </crs:Name>
            <crs:Address>
              <crs:CountryCode>${account.AddressCountryCode || account.ResCountryCode || 'XX'}</crs:CountryCode>
              <crs:AddressFree>${account.Address || ''}</crs:AddressFree>
            </crs:Address>
            <crs:BirthInfo>
              <crs:BirthDate>${account.BirthDate ? formatDate(account.BirthDate) : ''}</crs:BirthDate>
              <crs:City>${account.BirthCity || ''}</crs:City>
              <crs:CountryInfo>
                <crs:CountryCode>${account.BirthCountryCode || 'XX'}</crs:CountryCode>
              </crs:CountryInfo>
            </crs:BirthInfo>
          </crs:Individual>
        </crs:AccountHolder>
        <crs:AccountBalance currCode="${account.CurrCode || 'USD'}">${formatCurrency(account.AccountBalance)}</crs:AccountBalance>
        <crs:Payment>
          <crs:Type>CRS501</crs:Type>
          <crs:PaymentAmnt currCode="${account.CurrCode || 'USD'}">${formatCurrency(account.PaymentAmount)}</crs:PaymentAmnt>
        </crs:Payment>
      </crs:AccountReport>`;
  };

  const accountReports = data.map(generateAccountReport).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<crs:CRS_OECD xmlns:crs="urn:oecd:ties:crs:v1" xmlns:stf="urn:oecd:ties:stf:v4" version="1.0">
  <crs:MessageSpec>
    <stf:SendingCompanyIN>${reportingFI.giin || ''}</stf:SendingCompanyIN>
    <stf:TransmittingCountry>${reportingFI.country || 'MU'}</stf:TransmittingCountry>
    <stf:ReceivingCountry>XX</stf:ReceivingCountry>
    <stf:MessageType>CRS</stf:MessageType>
    <stf:Warning>Generated by iAfrica CRS XML Converter</stf:Warning>
    <stf:Contact>${SUPPORT_EMAIL}</stf:Contact>
    <stf:MessageRefId>${messageRefId}</stf:MessageRefId>
    <stf:MessageTypeIndic>CRS701</stf:MessageTypeIndic>
    <stf:ReportingPeriod>${taxYear}</stf:ReportingPeriod>
    <stf:Timestamp>${new Date().toISOString()}</stf:Timestamp>
  </crs:MessageSpec>
  <crs:CrsBody>
    <crs:ReportingFI>
      <crs:ReportingFI_IN>${reportingFI.giin || ''}</crs:ReportingFI_IN>
      <crs:Name>${reportingFI.name || ''}</crs:Name>
      <crs:Address>
        <crs:CountryCode>${reportingFI.country || 'MU'}</crs:CountryCode>
        <crs:AddressFree>${reportingFI.address || ''}</crs:AddressFree>
      </crs:Address>
    </crs:ReportingFI>
    ${accountReports}
  </crs:CrsBody>
</crs:CRS_OECD>`;
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
// SUPPORT CONTACT COMPONENT
// ==========================================

const SupportContact = () => {
  const { userDoc } = useAuth();
  
  const handleSupportClick = (method) => {
    trackSupportContact(method, userDoc?.plan || 'free');
    
    if (method === 'email') {
      window.open(`mailto:${SUPPORT_EMAIL}?subject=CRS XML Converter Support - ${userDoc?.plan || 'Free'} Plan`, '_blank');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
           onClick={() => handleSupportClick('email')}
           title={`Contact Support: ${SUPPORT_EMAIL}`}>
        <Mail className="w-6 h-6" />
      </div>
    </div>
  );
};

// ==========================================
// NAVIGATION COMPONENT (Updated)
// ==========================================

const Navigation = () => {
  const { user, userDoc, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-500 bg-clip-text text-transparent">
              iAfrica
            </div>
            <div className="hidden md:block">
              <span className="text-lg font-semibold text-gray-900">CRS Converter</span>
              <span className="text-sm text-gray-500 ml-2">by {COMPANY_NAME}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              <>
                <button 
                  onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Convert
                </button>
                <button 
                  onClick={() => document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Pricing
                </button>
                
                <div className="flex items-center space-x-3 pl-6 border-l border-gray-200">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {userDoc?.displayName || user.email?.split('@')[0]}
                    </div>
                    <div className="text-gray-500 capitalize">
                      {userDoc?.plan || 'free'} Plan
                      {userDoc && ` (${userDoc.conversionsLimit - userDoc.conversionsUsed}/${userDoc.conversionsLimit})`}
                    </div>
                  </div>
                  {user && !user.emailVerified && userDoc?.provider === 'email' && (
                    <div className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                      Verify Email
                    </div>
                  )}
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
                <button 
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-gray-700 hover:text-blue-600"
                >
                  Features
                </button>
                <button 
                  onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-gray-700 hover:text-blue-600"
                >
                  Pricing
                </button>
                <button 
                  onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Get Started Free
                </button>
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

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            {user ? (
              <div className="space-y-3">
                <div className="px-4 py-2 bg-gray-50 rounded">
                  <div className="font-medium">{userDoc?.displayName || user.email?.split('@')[0]}</div>
                  <div className="text-sm text-gray-500 capitalize">
                    {userDoc?.plan || 'free'} Plan 
                    {userDoc && ` (${userDoc.conversionsLimit - userDoc.conversionsUsed}/${userDoc.conversionsLimit})`}
                  </div>
                </div>
                <button className="block w-full text-left px-4 py-2 text-gray-700">Convert</button>
                <button className="block w-full text-left px-4 py-2 text-gray-700">Dashboard</button>
                <button className="block w-full text-left px-4 py-2 text-gray-700">Pricing</button>
                <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-red-600">Sign Out</button>
              </div>
            ) : (
              <div className="space-y-3">
                <button className="block w-full text-left px-4 py-2 text-gray-700">Features</button>
                <button className="block w-full text-left px-4 py-2 text-gray-700">Pricing</button>
                <button className="block w-full text-left px-4 py-2 text-blue-600">Sign In</button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

// Continue with other components... (Hero, Features, Auth, Dashboard, Converter, Pricing)
// [Previous components remain the same but with support email updated]

// ==========================================
// MAIN APP COMPONENT
// ==========================================

export default function CRSXMLConverter() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <HeroSection />
        <FeaturesSection />
        <AuthSection />
        <DashboardSection />
        <FileConverterSection />
        <PricingSection />
        <SupportContact />
        
        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent">
                  iAfrica
                </div>
                <div>
                  <p className="text-lg font-semibold">{COMPANY_NAME}</p>
                  <p className="text-sm text-gray-400">Innovative financial technology solutions for Africa</p>
                </div>
              </div>
              <div className="text-center md:text-right text-sm text-gray-400">
                <p>Contact: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300">{SUPPORT_EMAIL}</a></p>
                <p className="font-medium text-white">{COMPANY_NAME}</p>
                <div className="flex items-center justify-center md:justify-end space-x-4 mt-2">
                  <span className="flex items-center">
                    Powered by Firebase
                    <Shield className="w-4 h-4 text-green-400 ml-1" />
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm text-gray-400">
              <p>© 2024 {COMPANY_NAME}. All rights reserved. | Professional CRS OECD XML Converter</p>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
