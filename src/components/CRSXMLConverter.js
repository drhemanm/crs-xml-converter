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
  DollarSign, Target, Activity, Briefcase, AlertTriangle, Mail,
  UserPlus
} from 'lucide-react';

// Import Excel processing library
import * as XLSX from 'xlsx';

// Import PayPal
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

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

// PayPal Configuration
const PAYPAL_CONFIG = {
  clientId: process.env.REACT_APP_ENVIRONMENT === 'production' 
    ? process.env.REACT_APP_PAYPAL_CLIENT_ID_LIVE 
    : (process.env.REACT_APP_PAYPAL_CLIENT_ID || 'AQq1234567890_sandbox_client_id'), // Replace with your sandbox client ID
  currency: "USD",
  intent: "subscription",
  environment: process.env.REACT_APP_ENVIRONMENT || 'sandbox'
};

// PayPal Subscription Plans (You'll get these IDs from PayPal Dashboard)
const PAYPAL_PLANS = {
  professional: {
    planId: 'P-5ML4271244454362WXNWU5NQ', // Replace with your actual plan ID
    name: 'Professional Plan',
    price: 29,
    conversions: 100
  },
  enterprise: {
    planId: 'P-2UF78835G6983704MXNWU6FQ', // Replace with your actual plan ID
    name: 'Enterprise Plan', 
    price: 99,
    conversions: 1000
  }
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
// ANONYMOUS USAGE TRACKING
// ==========================================

const ANONYMOUS_USAGE_KEY = 'crs_anonymous_usage';
const ANONYMOUS_LIMIT = 3;

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
    
    // Keep only last 10 conversions
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

const trackAnonymousConversion = (fileType, recordCount) => {
  const usage = getAnonymousUsage();
  trackEvent('anonymous_conversion', {
    file_type: fileType,
    record_count: recordCount,
    conversion_number: usage.count + 1,
    remaining_anonymous: ANONYMOUS_LIMIT - usage.count - 1
  });
};

const trackRegistrationPrompt = (trigger = 'limit_reached') => {
  trackEvent('registration_prompt_shown', {
    trigger,
    anonymous_conversions_used: getAnonymousUsage().count
  });
};

const trackUserRegistration = (method, plan = 'free', wasAnonymous = false) => {
  const anonymousUsage = wasAnonymous ? getAnonymousUsage().count : 0;
  trackEvent('user_registration', {
    method,
    plan,
    value: plan === 'free' ? 0 : plan === 'professional' ? 29 : 99,
    previous_anonymous_usage: anonymousUsage
  });
};

// ==========================================
// BUSINESS CONFIGURATION
// ==========================================

const SUPPORT_EMAIL = 'contact@iafrica.solutions';
const COMPANY_NAME = 'Intelligent Africa Solutions Ltd';

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

// ==========================================
// PAYPAL SUBSCRIPTION COMPONENT
// ==========================================

const PayPalSubscription = ({ plan, onSuccess, onError, onCancel }) => {
  const { user, upgradePlan } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const createSubscription = (data, actions) => {
    const planDetails = PAYPAL_PLANS[plan];
    
    return actions.subscription.create({
      plan_id: planDetails.planId,
      application_context: {
        brand_name: 'iAfrica CRS Converter',
        user_action: 'SUBSCRIBE_NOW',
        return_url: `${window.location.origin}/subscription/success`,
        cancel_url: `${window.location.origin}/subscription/cancelled`
      },
      subscriber: {
        email_address: user?.email || ''
      }
    });
  };

  const onApprove = async (data, actions) => {
    setLoading(true);
    try {
      console.log('Subscription approved:', data);
      
      // Update user plan in Firebase
      await upgradePlan(plan, data.subscriptionID);
      
      onSuccess({
        subscriptionId: data.subscriptionID,
        plan: plan
      });
      
      trackEvent('subscription_success', {
        plan: plan,
        subscription_id: data.subscriptionID,
        value: PAYPAL_PLANS[plan].price
      });
      
    } catch (error) {
      console.error('Subscription error:', error);
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  const onCancelHandler = (data) => {
    console.log('Subscription cancelled:', data);
    onCancel();
    trackEvent('subscription_cancelled', { plan: plan });
  };

  const onErrorHandler = (err) => {
    console.error('PayPal error:', err);
    onError(err);
    trackEvent('subscription_error', { plan: plan, error: err.message });
  };

  return (
    <div className="paypal-container">
      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Processing subscription...</p>
        </div>
      )}
      
      <PayPalButtons
        style={{
          shape: 'rect',
          color: 'blue',
          layout: 'vertical',
          label: 'subscribe',
          height: 55
        }}
        createSubscription={createSubscription}
        onApprove={onApprove}
        onCancel={onCancelHandler}
        onError={onErrorHandler}
        disabled={loading}
      />
    </div>
  );
};

// ==========================================
// AUTHENTICATION SECTION (MISSING - THIS IS WHY SIGN IN WASN'T WORKING!)
// ==========================================

const AuthSection = () => {
  const { user, login, register, signInWithGoogle, resetPassword } = useAuth();
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

  if (user) {
    return null; // Don't show auth section if user is already logged in
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
          </div>

          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm ${
              message.includes('Success') || message.includes('sent') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </div>

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
    </div>
  );
};

// ==========================================
// BUSINESS LOGIC FUNCTIONS
// ==========================================

const getUserConversionStatus = (user, userDoc) => {
  const anonymousStatus = canAnonymousUserConvert();
  
  if (!user) {
    // Anonymous user
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
  
  // Registered user
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
// REGISTRATION PROMPT COMPONENT
// ==========================================

const RegistrationPrompt = ({ onRegister, onLogin, anonymousUsage }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Great! You've tried our converter
            </h2>
            <p className="text-gray-600 mb-4">
              You've used all <strong>{ANONYMOUS_LIMIT} free conversions</strong>. Register now to get <strong>3 more conversions</strong> and unlock additional features!
            </p>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-800 mb-2">🎉 What you get after registration:</h3>
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
          previousAnonymousUsage: anonymousUsage.count || 0
        };
        
        await setDoc(userDocRef, userData);
        setUserDoc(userData);
      }
      
      setUser(firebaseUser);
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
        previousAnonymousUsage: anonymousUsage.count || 0
      };
      
      await setDoc(doc(db, 'users', newUser.uid), userData);
      await sendEmailVerification(newUser);
      
      setUserDoc(userData);
      
      // Clear anonymous usage after registration
      clearAnonymousUsage();
      
      // Track registration
      trackUserRegistration('email', 'free', anonymousUsage.count > 0);
      
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
      
      // Clear anonymous usage after login
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
      
      // Clear anonymous usage after Google sign-in
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
        
        // Log conversion for analytics
        await addDoc(collection(db, 'conversions'), {
          userId: user.uid,
          timestamp: serverTimestamp(),
          success: true,
          plan: userDoc.plan,
          usageCount: newUsage
        });
        
        return newUsage;
      } catch (error) {
        throw error;
      }
    }
  };

  const upgradePlan = async (plan, paypalOrderId = null) => {
    if (user && userDoc) {
      try {
        const oldPlan = userDoc.plan || 'free';
        const limits = {
          free: 3,
          professional: 100,
          enterprise: 1000
        };
        
        const updateData = {
          plan,
          conversionsLimit: limits[plan],
          subscriptionStatus: 'active',
          planUpdatedAt: serverTimestamp(),
          paypalOrderId,
          lastBillingDate: serverTimestamp(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
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
          amount: PRICING_PLANS[plan].price
        });
        
        trackEvent('plan_upgrade', {
          from_plan: oldPlan,
          to_plan: plan,
          payment_method: 'paypal',
          value: PRICING_PLANS[plan].price
        });
        
      } catch (error) {
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
        return [];
      }
    }
    return [];
  };

  return (
    <AuthContext.Provider value={{ 
      user, userDoc, loading, login, register, signInWithGoogle, logout, resetPassword, 
      updateUserUsage, upgradePlan, getUserConversions
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

  // Get usage status for display
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
              <span className="text-lg font-semibold text-gray-900">CRS Converter</span>
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
                      {userDoc?.plan || 'free'} Plan ({usageStatus.remaining}/{usageStatus.limit})
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
                
                {/* Anonymous usage indicator */}
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
  );
};

// ==========================================
// HERO SECTION (Updated for Anonymous Trial)
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
            Convert CRS Data to
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> XML Format</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Transform Excel/CSV financial data into compliant CRS OECD XML format instantly. 
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
            <button 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center text-lg"
            >
              View Demo
              <FileText className="w-5 h-5 ml-2" />
            </button>
          </div>

          {/* Anonymous trial progress */}
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
              <div className="text-3xl font-bold text-blue-600">10,000+</div>
              <div className="text-gray-600">Files Converted</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">500+</div>
              <div className="text-gray-600">Happy Customers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">99.9%</div>
              <div className="text-gray-600">Accuracy Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// FEATURES SECTION
// ==========================================

const FeaturesSection = () => {
  const features = [
    {
      icon: <Zap className="w-8 h-8 text-yellow-600" />,
      title: "Try Before You Buy",
      description: "3 free conversions with no registration required. Test our quality first!"
    },
    {
      icon: <Shield className="w-8 h-8 text-green-600" />,
      title: "GDPR Compliant",
      description: "Client-side processing ensures your sensitive data never leaves your browser"
    },
    {
      icon: <Globe className="w-8 h-8 text-blue-600" />,
      title: "OECD Standards",
      description: "Generate XML files that meet all OECD CRS requirements and standards"
    },
    {
      icon: <Users className="w-8 h-8 text-purple-600" />,
      title: "Multi-Entity Support",
      description: "Handle both individual and entity accounts with controlling person data"
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-indigo-600" />,
      title: "Usage Analytics",
      description: "Track your conversion history and optimize your compliance workflows"
    },
    {
      icon: <Headphones className="w-8 h-8 text-pink-600" />,
      title: "Expert Support",
      description: "Get help from our CRS compliance experts via email, chat, or phone"
    }
  ];

  return (
    <div id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Why Choose Our CRS Converter?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Built specifically for financial institutions requiring OECD CRS compliance
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="p-6 bg-gray-50 rounded-xl hover:shadow-lg transition-shadow">
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Anonymous trial CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to try our converter?
            </h3>
            <p className="text-gray-600 mb-6">
              No commitment needed. Try 3 conversions completely free, then register for 3 more!
            </p>
            <button 
              onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Start Converting Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// ENHANCED FILE CONVERTER WITH ANONYMOUS SUPPORT
// ==========================================

const FileConverterSection = () => {
  const { user, userDoc, updateUserUsage } = useAuth();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [xmlResult, setXmlResult] = useState(null);
  const [error, setError] = useState('');
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [validationWarnings, setValidationWarnings] = useState({});
  const [isTestMode, setIsTestMode] = useState(false);
  const [settings, setSettings] = useState({
    reportingFI: {
      name: '',
      giin: '',
      country: 'MU',
      address: '',
      contact: ''
    },
    messageRefId: `MSG-${Date.now()}`,
    taxYear: new Date().getFullYear() - 1,
    reportingPeriod: `${new Date().getFullYear() - 1}-12-31`
  });

  const fileInputRef = useRef(null);

  // Get current usage status
  const usageStatus = getUserConversionStatus(user, userDoc);

  // Validation handlers (same as before)
  const handleFINameChange = (value) => {
    setSettings({
      ...settings,
      reportingFI: { ...settings.reportingFI, name: value }
    });
    
    const validation = validateFIName(value);
    if (!validation.valid) {
      setValidationErrors(prev => ({ ...prev, fiName: validation.message }));
      setValidationWarnings(prev => { const {fiName, ...rest} = prev; return rest; });
    } else {
      setValidationErrors(prev => { const {fiName, ...rest} = prev; return rest; });
      if (validation.severity === 'warning') {
        setValidationWarnings(prev => ({ ...prev, fiName: validation.message }));
      } else {
        setValidationWarnings(prev => { const {fiName, ...rest} = prev; return rest; });
      }
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
      setValidationWarnings(prev => { const {giin, ...rest} = prev; return rest; });
    } else {
      setValidationErrors(prev => { const {giin, ...rest} = prev; return rest; });
      if (validation.severity === 'warning') {
        setValidationWarnings(prev => ({ ...prev, giin: validation.message }));
      } else {
        setValidationWarnings(prev => { const {giin, ...rest} = prev; return rest; });
      }
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
      setValidationWarnings(prev => { const {taxYear, ...rest} = prev; return rest; });
    } else {
      setValidationErrors(prev => { const {taxYear, ...rest} = prev; return rest; });
      if (validation.severity === 'warning') {
        setValidationWarnings(prev => ({ ...prev, taxYear: validation.message }));
      } else {
        setValidationWarnings(prev => { const {taxYear, ...rest} = prev; return rest; });
      }
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

  const validateBeforeGeneration = () => {
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
    
    if (errors.length > 0) {
      setError(`Please fix the following errors:\n• ${errors.join('\n• ')}`);
      return false;
    }
    
    if (warnings.length > 0 && !isTestMode) {
      const proceed = window.confirm(
        `⚠️ Potential Issues Detected:\n\n${warnings.map(w => `• ${w}`).join('\n')}\n\nThis may cause issues with CRS submission. Proceed anyway?`
      );
      if (!proceed) return false;
    }
    
    return true;
  };

  const processFile = async () => {
    if (!file) {
      setError('Please upload a file first.');
      return;
    }

    // Check if user can convert
    if (!usageStatus.canConvert) {
      if (usageStatus.mustRegister && !user) {
        // Show registration prompt for anonymous users who hit limit
        trackRegistrationPrompt('conversion_limit_reached');
        setShowRegistrationPrompt(true);
        return;
      } else {
        setError(usageStatus.reason);
        return;
      }
    }

    // Validate before processing
    if (!validateBeforeGeneration()) {
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const fileData = await file.arrayBuffer();
      let data = [];

      if (file.name.endsWith('.csv') || file.type.includes('csv')) {
        // Process CSV file
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
        // Process Excel file
        const workbook = XLSX.read(fileData, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      }

      if (data.length === 0) {
        setError('The file appears to be empty or in an unsupported format.');
        return;
      }

      console.log('Processing', data.length, 'records...');

      // Generate XML
      const xmlContent = generateCRSXML(data, settings);
      setXmlResult(xmlContent);

      // Update usage tracking
      if (user) {
        // Registered user - update Firestore
        await updateUserUsage();
        trackEvent('file_conversion', {
          file_type: file.type.includes('csv') ? 'csv' : 'excel',
          record_count: data.length,
          user_plan: userDoc?.plan || 'free',
          user_type: 'registered'
        });
      } else {
        // Anonymous user - update localStorage
        const newCount = updateAnonymousUsage();
        trackAnonymousConversion(
          file.type.includes('csv') ? 'csv' : 'excel',
          data.length
        );
        
        console.log(`Anonymous conversion completed. Total: ${newCount}/${ANONYMOUS_LIMIT}`);
        
        // Show registration prompt if this was their last free conversion
        if (newCount >= ANONYMOUS_LIMIT) {
          setTimeout(() => {
            trackRegistrationPrompt('limit_reached');
            setShowRegistrationPrompt(true);
          }, 2000); // Show after 2 seconds to let them see the result
        }
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

  const copyToClipboard = () => {
    if (xmlResult) {
      navigator.clipboard.writeText(xmlResult).then(() => {
        alert('XML copied to clipboard!');
      }).catch(() => {
        alert('Failed to copy XML. Please select and copy manually.');
      });
    }
  };

  return (
    <div id="converter" className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-6">
        
        {/* Registration Prompt Modal */}
        {showRegistrationPrompt && (
          <RegistrationPrompt
            onRegister={() => {
              setShowRegistrationPrompt(false);
              document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onLogin={() => {
              setShowRegistrationPrompt(false);
              document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' });
            }}
            anonymousUsage={getAnonymousUsage()}
          />
        )}
        
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Convert Your CRS Data
          </h2>
          <p className="text-xl text-gray-600">
            Upload Excel or CSV files and convert them to OECD CRS XML format
          </p>
          
          {/* Usage Status Display */}
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm">
            <Activity className="w-4 h-4 mr-2" />
            {usageStatus.userType === 'anonymous' 
              ? `Free Trial: ${usageStatus.remaining}/${usageStatus.limit} conversions remaining`
              : `${usageStatus.remaining}/${usageStatus.limit} conversions remaining this month`
            }
          </div>
          
          {/* Progress bar for anonymous users */}
          {!user && usageStatus.used > 0 && (
            <div className="mt-4 max-w-xs mx-auto">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    usageStatus.percentUsed > 80 ? 'bg-red-500' : 
                    usageStatus.percentUsed > 60 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${usageStatus.percentUsed}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Anonymous user upgrade prompt */}
          {!user && usageStatus.used > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              <span>After {usageStatus.remaining} more conversions, </span>
              <button 
                onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-blue-600 hover:text-blue-700 font-medium underline"
              >
                register for 3 additional free conversions
              </button>
            </div>
          )}
        </div>

        {/* Test Mode Toggle */}
        <div className="mb-6 flex items-center justify-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isTestMode}
              onChange={(e) => setIsTestMode(e.target.checked)}
              className="sr-only"
            />
            <div className={`relative w-10 h-6 rounded-full transition-colors ${
              isTestMode ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                isTestMode ? 'transform translate-x-4' : ''
              }`}></div>
            </div>
            <span className="ml-3 text-sm font-medium text-gray-700">
              Test Mode (for development/testing)
            </span>
          </label>
        </div>

        {/* Test Mode Warning */}
        {isTestMode && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <div>
                <p className="font-medium text-red-800">TEST MODE ACTIVE</p>
                <p className="text-sm text-red-700">
                  This XML is for testing only. Do not submit to tax authorities.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Settings Form with Validation */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reporting FI Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* FI Name */}
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
                    : validationWarnings.fiName 
                    ? 'border-yellow-300 focus:ring-yellow-500' 
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
              {validationWarnings.fiName && !validationErrors.fiName && (
                <div className="mt-1 flex items-center">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mr-1" />
                  <span className="text-xs text-yellow-700">{validationWarnings.fiName}</span>
                </div>
              )}
            </div>

            {/* GIIN with Enhanced Validation */}
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
                    : validationWarnings.giin 
                    ? 'border-yellow-300 focus:ring-yellow-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="ABC123.00000.ME.123"
                pattern="[A-Z0-9]{6}\.[A-Z0-9]{5}\.[A-Z]{2}\.[A-Z0-9]{3}"
                maxLength={19}
              />
              <div className="mt-1 text-xs text-gray-500">
                Format: 6 chars + 5 chars + 2 country + 3 chars (e.g., ABC123.00000.ME.123)
              </div>
              {validationErrors.giin && (
                <div className="mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-xs text-red-600">{validationErrors.giin}</span>
                </div>
              )}
              {validationWarnings.giin && !validationErrors.giin && (
                <div className="mt-1 flex items-center">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mr-1" />
                  <span className="text-xs text-yellow-700">{validationWarnings.giin}</span>
                </div>
              )}
            </div>

            {/* Country */}
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
                <option value="EG">Egypt</option>
                <option value="MA">Morocco</option>
                <option value="GH">Ghana</option>
                <option value="UG">Uganda</option>
                <option value="TZ">Tanzania</option>
                <option value="RW">Rwanda</option>
              </select>
            </div>

            {/* Tax Year with Validation */}
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
                    : validationWarnings.taxYear 
                    ? 'border-yellow-300 focus:ring-yellow-500' 
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
              {validationWarnings.taxYear && !validationErrors.taxYear && (
                <div className="mt-1 flex items-center">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mr-1" />
                  <span className="text-xs text-yellow-700">{validationWarnings.taxYear}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File Upload */}
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
            <div className="text-sm text-gray-500">
              Supported formats: .xlsx, .xls, .csv (max 10MB)
            </div>
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
              <div>
                {error.split('\n').map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {file && !error && (
            <div className="mt-4 flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{file.name}</p>
                  <p className="text-sm text-green-700">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to process
                  </p>
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

          {/* Usage limit warning */}
          {!usageStatus.canConvert && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
                <div>
                  <p className="font-medium text-yellow-800">
                    {usageStatus.userType === 'anonymous' ? 'Free trial limit reached' : 'Conversion limit reached'}
                  </p>
                  <p className="text-sm text-yellow-700">
                    {usageStatus.reason}
                  </p>
                </div>
              </div>
              {usageStatus.userType === 'anonymous' ? (
                <button
                  onClick={() => {
                    trackRegistrationPrompt('manual_upgrade_click');
                    setShowRegistrationPrompt(true);
                  }}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Register for 3 More Free Conversions
                </button>
              ) : (
                <button
                  onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                >
                  View Pricing Plans
                </button>
              )}
            </div>
          )}
        </div>

        {/* XML Result */}
        {xmlResult && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Generated XML</h3>
              <div className="flex space-x-3">
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center text-sm"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Copy
                </button>
                <button
                  onClick={downloadXML}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center text-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download XML
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {xmlResult.substring(0, 2000)}{xmlResult.length > 2000 ? '...' : ''}
              </pre>
            </div>

            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-sm text-green-700">
                  XML file generated successfully and ready for OECD CRS submission!
                  {isTestMode && ' (TEST MODE - Do not submit to authorities)'}
                </span>
              </div>
            </div>
            
            {/* Post-conversion registration nudge for anonymous users */}
            {!user && usageStatus.remaining <= 1 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-900">Great result! Want to do more conversions?</p>
                    <p className="text-sm text-blue-700">
                      Register now to get 3 additional free conversions + save your history
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      trackRegistrationPrompt('post_conversion_nudge');
                      setShowRegistrationPrompt(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap"
                  >
                    Register Free
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// PRICING SECTION WITH PAYPAL INTEGRATION
// ==========================================

const PricingSection = () => {
  const { user, userDoc } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');

  const handleSubscriptionSuccess = (result) => {
    setSubscriptionStatus('success');
    setSelectedPlan(null);
    alert(`🎉 Successfully subscribed to ${result.plan} plan! Your account has been upgraded.`);
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleSubscriptionError = (error) => {
    setSubscriptionStatus('error');
    setSelectedPlan(null);
    alert(`❌ Subscription failed: ${error.message}. Please try again.`);
  };

  const handleSubscriptionCancel = () => {
    setSelectedPlan(null);
  };

  const handleUpgrade = (planKey) => {
    if (!user) {
      alert('Please sign in first to upgrade your plan.');
      document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    if (userDoc?.plan === planKey) {
      alert('You are already on this plan!');
      return;
    }
    
    setSelectedPlan(planKey);
    trackEvent('upgrade_attempt', { plan: planKey });
  };

  return (
    <div id="pricing" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the plan that fits your CRS conversion needs. All plans include GDPR compliance and expert support.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {Object.entries(PRICING_PLANS).map(([key, plan]) => {
            const isCurrentPlan = userDoc?.plan === key;
            const canUpgrade = user && !isCurrentPlan && key !== 'free';
            
            return (
              <div key={key} className={`relative bg-white rounded-xl shadow-lg p-8 ${
                plan.popular ? 'ring-2 ring-blue-500' : 'border border-gray-200'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center">
                      <Crown className="w-4 h-4 mr-1" />
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="flex items-center justify-center mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      ${plan.price}
                    </span>
                    {plan.price > 0 && <span className="text-gray-600 ml-2">/month</span>}
                  </div>
                  <p className="text-gray-600">
                    {plan.conversions} conversions {plan.price > 0 ? 'per month' : 'after registration'}
                  </p>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <Check className={`w-5 h-5 mr-3 ${plan.color === 'blue' ? 'text-blue-600' : plan.color === 'purple' ? 'text-purple-600' : 'text-gray-400'}`} />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  {isCurrentPlan ? (
                    <div className="py-3 bg-gray-100 text-gray-600 rounded-lg font-medium">
                      <Check className="w-5 h-5 inline mr-2" />
                      Current Plan
                    </div>
                  ) : canUpgrade ? (
                    <button
                      onClick={() => handleUpgrade(key)}
                      className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                        plan.color === 'blue' 
                          ? 'bg-blue-600 text-white hover:bg-blue-700' 
                          : plan.color === 'purple' 
                          ? 'bg-purple-600 text-white hover:bg-purple-700' 
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      {plan.buttonText}
                    </button>
                  ) : key === 'free' ? (
                    <button
                      onClick={() => !user && document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      {user ? 'Current Plan' : 'Sign Up Free'}
                    </button>
                  ) : (
                    <button
                      onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full py-3 bg-gray-200 text-gray-500 rounded-lg font-medium"
                    >
                      Sign In Required
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* PayPal Subscription Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Subscribe to {PRICING_PLANS[selectedPlan]?.name}
                </h3>
                <button
                  onClick={handleSubscriptionCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-blue-900">
                      ${PRICING_PLANS[selectedPlan]?.price}/month
                    </p>
                    <p className="text-sm text-blue-700">
                      {PRICING_PLANS[selectedPlan]?.conversions} conversions per month
                    </p>
                  </div>
                  <div className="text-blue-600">
                    <CreditCard className="w-8 h-8" />
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  You'll be redirected to PayPal to complete your subscription. Cancel anytime from your PayPal account.
                </p>
              </div>

              <PayPalSubscription
                plan={selectedPlan}
                onSuccess={handleSubscriptionSuccess}
                onError={handleSubscriptionError}
                onCancel={handleSubscriptionCancel}
              />

              <div className="mt-4 text-center">
                <button
                  onClick={handleSubscriptionCancel}
                  className="px-4 py-2 text-gray-600 hover:text-gray-700 text-sm"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 text-xs text-gray-500 text-center">
                Secure payment powered by PayPal • Cancel anytime
              </div>
            </div>
          </div>
        )}

        <div className="mt-16 text-center">
          <div className="bg-white rounded-xl p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Need a Custom Solution?
            </h3>
            <p className="text-gray-600 mb-6">
              High-volume processing, white-label options, or custom integrations available.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Custom CRS Solution Inquiry`}
              className="inline-flex items-center px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-semibold"
            >
              <Mail className="w-5 h-5 mr-2" />
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DASHBOARD SECTION
// ==========================================

const DashboardSection = () => {
  const { user, userDoc, getUserConversions } = useAuth();
  const [conversions, setConversions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConversions = async () => {
      if (user) {
        try {
          const userConversions = await getUserConversions();
          setConversions(userConversions);
        } catch (error) {
          console.error('Error loading conversions:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadConversions();
  }, [user, getUserConversions]);

  const usageStatus = getUserConversionStatus(user, userDoc);

  if (!user) return null;

  return (
    <div id="dashboard" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome back, {userDoc?.displayName || user.email?.split('@')[0]}!
          </h2>
          <p className="text-xl text-gray-600">
            Manage your CRS conversions and account settings
          </p>
        </div>

        {/* Usage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-lg p-3">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-900">Conversions Used</p>
                <p className="text-2xl font-bold text-blue-900">
                  {usageStatus.used}/{usageStatus.limit}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-lg p-3">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-900">Remaining</p>
                <p className="text-2xl font-bold text-green-900">{usageStatus.remaining}</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center">
              <div className="bg-purple-100 rounded-lg p-3">
                <Crown className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-900">Current Plan</p>
                <p className="text-2xl font-bold text-purple-900 capitalize">
                  {userDoc?.plan || 'Free'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Progress */}
        <div className="bg-gray-50 rounded-xl p-6 mb-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Usage</h3>
            <span className="text-sm text-gray-600">
              {Math.round(usageStatus.percentUsed)}% used
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                usageStatus.percentUsed > 90 ? 'bg-red-500' :
                usageStatus.percentUsed > 75 ? 'bg-yellow-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${Math.min(usageStatus.percentUsed, 100)}%` }}
            ></div>
          </div>
          
          {usageStatus.remaining === 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
                <div>
                  <p className="font-medium text-yellow-800">Conversion limit reached</p>
                  <p className="text-sm text-yellow-700">
                    Upgrade your plan to continue converting files this month.
                  </p>
                </div>
              </div>
              <button
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
              >
                View Pricing Plans
              </button>
            </div>
          )}
        </div>

        {/* Recent Conversions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Conversions</h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading conversions...</p>
            </div>
          ) : conversions.length > 0 ? (
            <div className="space-y-4">
              {conversions.map((conversion, index) => (
                <div key={conversion.id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="bg-green-100 rounded-full p-2 mr-4">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        CRS XML Conversion
                      </p>
                      <p className="text-sm text-gray-600">
                        {conversion.timestamp ? new Date(conversion.timestamp.seconds * 1000).toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Success
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No conversions yet</p>
              <button
                onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start Converting
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================

export default function CRSXMLConverter() {
  return (
    <PayPalScriptProvider 
      options={{
        'client-id': PAYPAL_CONFIG.clientId,
        components: 'buttons',
        intent: 'subscription',
        vault: true,
        currency: PAYPAL_CONFIG.currency
      }}
    >
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <HeroSection />
          <FeaturesSection />
          <FileConverterSection />
          <AuthSection />
          <DashboardSection />
          <PricingSection />
          
          {/* Support Contact */}
          <div className="fixed bottom-6 right-6 z-50">
            <div className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors cursor-pointer"
                 onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=CRS XML Converter Support`, '_blank')}
                 title={`Contact Support: ${SUPPORT_EMAIL}`}>
              <Mail className="w-6 h-6" />
            </div>
          </div>
          
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
                      Powered by Firebase + PayPal
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
    </PayPalScriptProvider>
  );
}
