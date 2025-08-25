import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

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
  Upload, Download, FileText, AlertCircle, CheckCircle2, Settings, 
  Shield, X, HelpCircle, Clock, Zap, Lock, Globe, ChevronRight,
  User, Building2, Menu, LogOut, CreditCard, BarChart3,
  Star, Crown, Sparkles, ArrowRight, Check, Users, Calendar,
  TrendingUp, Award, Headphones, Smartphone, Eye, History,
  DollarSign, Target, Activity, Briefcase, AlertTriangle, Mail,
  UserPlus
} from 'lucide-react';

// Excel processing
import * as XLSX from 'xlsx';

// ==========================================
// SECURE FIREBASE CONFIGURATION
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

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// ==========================================
// CONFIGURATION
// ==========================================
const SUPPORT_EMAIL = 'contact@iafrica.solutions';
const COMPANY_NAME = 'Intelligent Africa Solutions Ltd';
const ANONYMOUS_USAGE_KEY = 'crs_anonymous_usage';
const ANONYMOUS_LIMIT = 3;

const PRICING_PLANS = {
  free: {
    name: 'Free Plan',
    price: 0,
    conversions: 3,
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
    color: 'blue'
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
    color: 'purple'
  }
};

// ==========================================
// UTILITY FUNCTIONS
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

const trackEvent = (eventName, parameters = {}) => {
  try {
    if (analytics) {
      logEvent(analytics, eventName, {
        timestamp: new Date().toISOString(),
        ...parameters
      });
    }
  } catch (error) {
    console.error('Analytics error:', error);
  }
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
  
  return { valid: true };
};

const validateFIName = (name) => {
  if (!name || name.trim() === '') {
    return { valid: false, message: "Financial Institution name is required", severity: 'error' };
  }
  
  return { valid: true };
};

// ==========================================
// CRS XML GENERATION
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
      return result.user;
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
    default:
      return 'An error occurred. Please try again.';
  }
};

// ==========================================
// UTILITY FUNCTIONS
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
// COMPONENTS
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

  const usageStatus = getUserConversionStatus(user, userDoc);

  return (
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
              <div className="flex items-center space-x-3 text-sm">
                <div className="text-gray-600">
                  Free Trial: {usageStatus.remaining}/{usageStatus.limit} remaining
                </div>
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
                  Register Free
                </button>
              </div>
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
  );
};

const HeroSection = () => {
  const { user } = useAuth();
  const usageStatus = getUserConversionStatus(user, null);
  
  if (user) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center">
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

const AuthSection = () => {
  const { user, login, register, signInWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
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
      } else {
        await register(formData.email, formData.password, formData.displayName, formData.company);
        setMessage('Account created! Please verify your email.');
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

  if (user) {
    return null;
  }

  return (
    <div id="auth" className="py-20 bg-white">
      <div className="max-w-md mx-auto px-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isLogin ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="text-gray-600">
              {isLogin ? 'Access your dashboard and conversions' : 'Get 3 additional free conversions'}
            </p>
          </div>

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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>

            {message && (
              <div className={`p-3 rounded-md text-sm ${
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
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center"
            >
              <GoogleIcon className="w-5 h-5 mr-2" />
              Sign {isLogin ? 'in' : 'up'} with Google
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FileConverterSection = () => {
  const { user, userDoc, updateUserUsage } = useAuth();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [xmlResult, setXmlResult] = useState(null);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [settings, setSettings] = useState({
    reportingFI: {
      name: '',
      giin: '',
      country: 'MU',
      address: ''
    },
    messageRefId: `MSG-${Date.now()}`,
    taxYear: new Date().getFullYear() - 1
  });

  const fileInputRef = useRef(null);
  const usageStatus = getUserConversionStatus(user, userDoc);

  const handleFINameChange = (value) => {
    setSettings({
      ...settings,
      reportingFI: { ...settings.reportingFI, name: value }
    });
    
    const validation = validateFIName(value);
    if (!validation.valid) {
      setValidationErrors(prev => ({ ...prev, fiName: validation.message }));
    } else {
      setValidationErrors(prev => { const {fiName, ...rest} = prev; return rest; });
    }
  };

  const handleGIINChange = (value) => {
    setSettings({
      ...settings,
      reportingFI: { ...settings.reportingFI, giin: value.toUpperCase() }
    });
    
    const validation = validateGIIN(value);
    if (!validation.valid) {
      setValidationErrors(prev => ({ ...prev, giin: validation.message }));
    } else {
      setValidationErrors(prev => { const {giin, ...rest} = prev; return rest; });
    }
  };

  const handleTaxYearChange = (value) => {
    setSettings({
      ...settings,
      taxYear: parseInt(value)
    });
    
    const validation = validateTaxYear(parseInt(value));
    if (!validation.valid) {
      setValidationErrors(prev => ({ ...prev, taxYear: validation.message }));
    } else {
      setValidationErrors(prev => { const {taxYear, ...rest} = prev; return rest; });
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      
      if (validTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError('');
        setXmlResult(null);
      } else {
        setError('Please select a valid Excel (.xlsx, .xls) or CSV file.');
      }
    }
  };

  const processFile = async () => {
    if (!file) {
      setError('Please upload a file first.');
      return;
    }

    if (!usageStatus.canConvert) {
      setError(usageStatus.reason);
      return;
    }

    if (Object.keys(validationErrors).length > 0) {
      setError('Please fix the validation errors before processing.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const fileData = await file.arrayBuffer();
      let data = [];

      if (file.name.endsWith('.csv') || file.type.includes('csv')) {
        const text = new TextDecoder().decode(fileData);
        const lines = text.split('\n');
        if (lines.length === 0) {
          throw new Error('CSV file appears to be empty');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            data.push(row);
          }
        }
      } else {
        const workbook = XLSX.read(fileData, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      }

      if (data.length === 0) {
        setError('The file appears to be empty or in an unsupported format.');
        return;
      }

      const xmlContent = generateCRSXML(data, settings);
      setXmlResult(xmlContent);

      if (user) {
        await updateUserUsage();
        trackEvent('file_conversion', {
          file_type: file.type.includes('csv') ? 'csv' : 'excel',
          record_count: data.length,
          user_plan: userDoc?.plan || 'free',
          user_type: 'registered'
        });
      } else {
        updateAnonymousUsage();
        trackEvent('anonymous_conversion', {
          file_type: file.type.includes('csv') ? 'csv' : 'excel',
          record_count: data.length
        });
      }

    } catch (err) {
      console.error('Processing error:', err);
      setError('Failed to process the file. Please check the file format and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadXML = () => {
    if (xmlResult) {
      const blob = new Blob([xmlResult], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CRS_OECD_${settings.taxYear}_${Date.now()}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div id="converter" className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Convert Your Financial Data
          </h2>
          <p className="text-xl text-gray-600">
            Upload Excel or CSV files and convert them to regulatory-compliant reports
          </p>
          
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm">
            <Activity className="w-4 h-4 mr-2" />
            {usageStatus.userType === 'anonymous' 
              ? `Free Trial: ${usageStatus.remaining}/${usageStatus.limit} conversions remaining`
              : `${usageStatus.remaining}/${usageStatus.limit} conversions remaining this month`
            }
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reporting FI Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                FI Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settings.reportingFI.name}
                onChange={(e) => handleFINameChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  validationErrors.fiName 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Financial Institution Name"
              />
              {validationErrors.fiName && (
                <div className="mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-xs text-red-600">{validationErrors.fiName}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GIIN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settings.reportingFI.giin}
                onChange={(e) => handleGIINChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  validationErrors.giin 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="ABC123.00000.ME.123"
                maxLength={19}
              />
              {validationErrors.giin && (
                <div className="mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-xs text-red-600">{validationErrors.giin}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country <span className="text-red-500">*</span>
              </label>
              <select
                value={settings.reportingFI.country}
                onChange={(e) => setSettings({
                  ...settings,
                  reportingFI: { ...settings.reportingFI, country: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MU">Mauritius</option>
                <option value="ZA">South Africa</option>
                <option value="KE">Kenya</option>
                <option value="NG">Nigeria</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={settings.taxYear}
                onChange={(e) => handleTaxYearChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  validationErrors.taxYear 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                min="2014"
                max={new Date().getFullYear()}
              />
              {validationErrors.taxYear && (
                <div className="mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-xs text-red-600">{validationErrors.taxYear}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Your File</h3>
          
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              {file ? file.name : 'Choose your Excel or CSV file'}
            </p>
            <p className="text-gray-600 mb-4">
              Drop your file here or click to browse
            </p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          {file && !error && (
            <div className="mt-4 flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{file.name}</p>
                  <p className="text-sm text-green-700">Ready to process</p>
                </div>
              </div>
              <button
                onClick={processFile}
                disabled={isProcessing || !usageStatus.canConvert || Object.keys(validationErrors).length > 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isProcessing ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Convert to XML
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {xmlResult && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Generated XML</h3>
              <button
                onClick={downloadXML}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Download XML
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {xmlResult.substring(0, 1000)}{xmlResult.length > 1000 ? '...' : ''}
              </pre>
            </div>

            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-sm text-green-700">
                  Report generated successfully and ready for tax authority submission!
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function CRSXMLConverter() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <HeroSection />
        <FileConverterSection />
        <AuthSection />
        
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
              </div>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
