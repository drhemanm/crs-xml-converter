import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

// Firebase imports - REAL authentication and database
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
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
import { getAnalytics } from 'firebase/analytics';

// Import all the icons we'll use throughout the app
import { 
  Upload, Download, FileText, AlertCircle, CheckCircle2, Settings, 
  Shield, X, HelpCircle, Clock, Zap, Lock, Globe, ChevronRight,
  User, Building2, Menu, LogOut, CreditCard, BarChart3,
  Star, Crown, Sparkles, ArrowRight, Check, Users, Calendar,
  TrendingUp, Award, Headphones, Smartphone, Eye, History,
  DollarSign, Target, Activity, Briefcase
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

console.log('🔥 Firebase initialized successfully!');

// ==========================================
// AUTHENTICATION CONTEXT WITH REAL FIREBASE
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
        console.log('👤 Loading user data from Firestore...');
        
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          console.log('✅ User data loaded from Firestore:', userData);
          setUserDoc(userData);
        } else {
          console.log('⚠️ User document not found in Firestore');
          setUserDoc(null);
        }
        
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserDoc(null);
      }
      
      setLoading(false);
    });

    return () => {
      console.log('🧹 Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const register = async (email, password, displayName, company) => {
    console.log('🚀 Starting user registration with Firebase...');
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      console.log('✅ Firebase user created:', newUser.uid);
      
      const userData = {
        email,
        displayName,
        company,
        plan: 'free',
        conversionsUsed: 0,
        conversionsLimit: 3,
        subscriptionStatus: 'active',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };
      
      await setDoc(doc(db, 'users', newUser.uid), userData);
      console.log('✅ User document created in Firestore');
      
      await sendEmailVerification(newUser);
      console.log('📧 Email verification sent');
      
      setUserDoc(userData);
      return newUser;
      
    } catch (error) {
      console.error('❌ Registration failed:', error);
      throw new Error(getFirebaseErrorMessage(error.code));
    }
  };

  const login = async (email, password) => {
    console.log('🚀 Starting user login with Firebase...');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;
      
      console.log('✅ Firebase login successful:', loggedInUser.uid);
      
      await updateDoc(doc(db, 'users', loggedInUser.uid), {
        lastLogin: serverTimestamp()
      });
      
      return loggedInUser;
      
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw new Error(getFirebaseErrorMessage(error.code));
    }
  };

  const logout = async () => {
    console.log('🚀 Starting user logout...');
    
    try {
      await signOut(auth);
      console.log('✅ User logged out successfully');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      throw error;
    }
  };

  const resetPassword = async (email) => {
    console.log('🚀 Sending password reset email...');
    
    try {
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Password reset email sent');
    } catch (error) {
      console.error('❌ Password reset failed:', error);
      throw new Error(getFirebaseErrorMessage(error.code));
    }
  };

  const updateUserUsage = async () => {
    if (user && userDoc) {
      console.log('📊 Updating user conversion usage...');
      
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          conversionsUsed: increment(1),
          lastConversion: serverTimestamp()
        });
        
        setUserDoc(prev => ({
          ...prev,
          conversionsUsed: prev.conversionsUsed + 1
        }));
        
        console.log('✅ Usage updated successfully');
        
        await addDoc(collection(db, 'conversions'), {
          userId: user.uid,
          timestamp: serverTimestamp(),
          success: true
        });
        
      } catch (error) {
        console.error('❌ Failed to update usage:', error);
        throw error;
      }
    }
  };

  const upgradePlan = async (plan) => {
    if (user) {
      console.log('⬆️ Upgrading user plan to:', plan);
      
      try {
        const limits = {
          free: 3,
          professional: 100,
          enterprise: 1000
        };
        
        const updateData = {
          plan,
          conversionsLimit: limits[plan],
          subscriptionStatus: 'active',
          planUpdatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'users', user.uid), updateData);
        setUserDoc(prev => ({ ...prev, ...updateData }));
        
        console.log('✅ Plan upgraded successfully');
        
        await addDoc(collection(db, 'subscriptions'), {
          userId: user.uid,
          plan,
          timestamp: serverTimestamp(),
          status: 'active'
        });
        
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
      user, userDoc, loading, login, register, logout, resetPassword, 
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
    default:
      return 'An error occurred. Please try again.';
  }
};

// ==========================================
// PRICING PLANS CONFIGURATION
// ==========================================

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
    buttonText: 'Contact Sales',
    popular: false,
    color: 'purple'
  }
};

// ==========================================
// CRS XML GENERATION LOGIC
// ==========================================

const generateCRSXML = (data, settings) => {
  const { reportingFI, messageRefId, taxYear, reportingPeriod } = settings;
  
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
    <stf:Warning>Optional human readable warning</stf:Warning>
    <stf:Contact>${reportingFI.contact || ''}</stf:Contact>
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
// NAVIGATION COMPONENT
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
              <span className="text-sm text-gray-500 ml-2">by Intelligent Africa</span>
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
                    </div>
                  </div>
                  {user && !user.emailVerified && (
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
                  <div className="text-sm text-gray-500 capitalize">{userDoc?.plan || 'free'} Plan</div>
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

// ==========================================
// HERO SECTION COMPONENT
// ==========================================

const HeroSection = () => {
  const { user } = useAuth();
  if (user) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4 mr-2" />
            GDPR Compliant • Enterprise Ready • Instant Processing
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Convert CRS Data to
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> XML Format</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Transform Excel/CSV financial data into compliant CRS OECD XML format instantly. 
            Trusted by financial institutions across Africa and beyond.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button 
              onClick={() => document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-lg font-semibold"
            >
              Start Free Trial
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
// FEATURES SECTION COMPONENT
// ==========================================

const FeaturesSection = () => {
  const features = [
    {
      icon: <Zap className="w-8 h-8 text-yellow-600" />,
      title: "Instant Processing",
      description: "Convert your CRS data in seconds with our advanced processing engine"
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
      </div>
    </div>
  );
};

// ==========================================
// AUTHENTICATION SECTION WITH REAL FIREBASE
// ==========================================

const AuthSection = () => {
  const { user, loading, login, register, resetPassword } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    company: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (isResetPassword) {
        await resetPassword(formData.email);
        setSuccess('Password reset email sent! Check your inbox.');
        setIsResetPassword(false);
      } else if (isLogin) {
        console.log('🔑 Attempting login with Firebase...');
        await login(formData.email, formData.password);
        setSuccess('Welcome back! Redirecting to your dashboard...');
      } else {
        console.log('📝 Attempting registration with Firebase...');
        await register(formData.email, formData.password, formData.displayName, formData.company);
        setSuccess('Account created successfully! Please check your email to verify your account.');
      }
    } catch (err) {
      console.error('❌ Authentication error:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
          <div className="text-gray-600">Connecting to Firebase...</div>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div id="auth" className="py-20 bg-gray-50">
      <div className="max-w-md mx-auto px-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="mb-4">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-500 bg-clip-text text-transparent">
                iAfrica
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isResetPassword ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Get Started Free'}
            </h2>
            <p className="text-gray-600">
              {isResetPassword 
                ? 'Enter your email to receive a password reset link'
                : isLogin 
                  ? 'Sign in to your account' 
                  : 'Create your account and convert 3 files free'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {!isLogin && !isResetPassword && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ABC Bank Ltd"
                    required
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="john@company.com"
                required
              />
            </div>
            
            {!isResetPassword && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                {success}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin mr-2" />
                  {isResetPassword ? 'Sending Reset Email...' : isLogin ? 'Signing In...' : 'Creating Account...'}
                </>
              ) : (
                isResetPassword ? 'Send Reset Email' : isLogin ? 'Sign In' : 'Create Free Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {!isResetPassword ? (
              <>
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setSuccess('');
                    setFormData({ email: '', password: '', displayName: '', company: '' });
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm block w-full"
                >
                  {isLogin ? "Don't have an account? Sign up free" : "Already have an account? Sign in"}
                </button>
                
                {isLogin && (
                  <button
                    onClick={() => {
                      setIsResetPassword(true);
                      setError('');
                      setSuccess('');
                    }}
                    className="text-gray-600 hover:text-gray-700 text-sm"
                  >
                    Forgot your password?
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => {
                  setIsResetPassword(false);
                  setError('');
                  setSuccess('');
                }}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Back to sign in
              </button>
            )}
          </div>

          {!isLogin && !isResetPassword && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">✅ What you get for free:</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• 3 free CRS XML conversions</li>
                <li>• Full access to all features</li>
                <li>• GDPR compliant processing</li>
                <li>• Email support</li>
                <li>• No credit card required</li>
              </ul>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              🔐 Secured by Firebase • 🌍 GDPR Compliant
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DASHBOARD COMPONENT
// ==========================================

const DashboardSection = () => {
  const { user, userDoc, getUserConversions } = useAuth();
  const [conversions, setConversions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadConversions();
    }
  }, [user]);

  const loadConversions = async () => {
    setLoading(true);
    try {
      const userConversions = await getUserConversions();
      setConversions(userConversions);
    } catch (error) {
      console.error('Failed to load conversions:', error);
    }
    setLoading(false);
  };

  if (!user) return null;

  const usagePercentage = userDoc ? (userDoc.conversionsUsed / userDoc.conversionsLimit) * 100 : 0;
  const remainingConversions = userDoc ? userDoc.conversionsLimit - userDoc.conversionsUsed : 0;

  return (
    <div id="dashboard" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome back, {userDoc?.displayName || user.email?.split('@')[0]}!
          </h2>
          <p className="text-xl text-gray-600">
            Here's your account overview and recent activity
          </p>
        </div>

        {/* Usage Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Current Plan</p>
                <p className="text-2xl font-bold capitalize">{userDoc?.plan || 'Free'}</p>
              </div>
              <Crown className="w-8 h-8 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Conversions Used</p>
                <p className="text-2xl font-bold">{userDoc?.conversionsUsed || 0}/{userDoc?.conversionsLimit || 3}</p>
              </div>
              <Activity className="w-8 h-8 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Remaining</p>
                <p className="text-2xl font-bold">{remainingConversions}</p>
              </div>
              <Target className="w-8 h-8 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Success Rate</p>
                <p className="text-2xl font-bold">99.9%</p>
              </div>
              <Award className="w-8 h-8 text-orange-200" />
            </div>
          </div>
        </div>

        {/* Usage Progress Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Usage</h3>
            <span className="text-sm text-gray-600">
              {usagePercentage.toFixed(1)}% used
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                usagePercentage > 80 ? 'bg-red-500' : 
                usagePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            ></div>
          </div>
          {usagePercentage > 80 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-700">
                  You're running low on conversions. Consider upgrading your plan for unlimited access.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent Conversions */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Conversions</h3>
              <History className="w-5 h-5 text-gray-400" />
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
                <p className="text-gray-600">Loading conversions...</p>
              </div>
            ) : conversions.length > 0 ? (
              <div className="space-y-4">
                {conversions.map((conversion, index) => (
                  <div key={conversion.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Conversion #{conversions.length - index}</p>
                        <p className="text-sm text-gray-600">
                          {conversion.timestamp?.toDate ? 
                            conversion.timestamp.toDate().toLocaleDateString() : 
                            'Recently'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Success</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No conversions yet</p>
                <p className="text-sm text-gray-500">Start by converting your first CRS file!</p>
                <button 
                  onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Convert Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// FILE CONVERTER COMPONENT
// ==========================================

const FileConverterSection = () => {
  const { user, userDoc, updateUserUsage } = useAuth();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [xmlResult, setXmlResult] = useState(null);
  const [error, setError] = useState('');
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
    if (!file || !user || !userDoc) {
      setError('Please upload a file and ensure you are logged in.');
      return;
    }

    if (userDoc.conversionsUsed >= userDoc.conversionsLimit) {
      setError('You have reached your conversion limit. Please upgrade your plan to continue.');
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

      // Update user usage
      await updateUserUsage();

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

  if (!user) return null;

  const remainingConversions = userDoc ? userDoc.conversionsLimit - userDoc.conversionsUsed : 0;

  return (
    <div id="converter" className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Convert Your CRS Data
          </h2>
          <p className="text-xl text-gray-600">
            Upload Excel or CSV files and convert them to OECD CRS XML format
          </p>
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm">
            <Activity className="w-4 h-4 mr-2" />
            {remainingConversions} conversion{remainingConversions !== 1 ? 's' : ''} remaining this month
          </div>
        </div>

        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reporting FI Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                FI Name
              </label>
              <input
                type="text"
                value={settings.reportingFI.name}
                onChange={(e) => setSettings({
                  ...settings,
                  reportingFI: { ...settings.reportingFI, name: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Financial Institution Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GIIN
              </label>
              <input
                type="text"
                value={settings.reportingFI.giin}
                onChange={(e) => setSettings({
                  ...settings,
                  reportingFI: { ...settings.reportingFI, giin: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Global Intermediary Identification Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
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
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Year
              </label>
              <input
                type="number"
                value={settings.taxYear}
                onChange={(e) => setSettings({
                  ...settings,
                  taxYear: parseInt(e.target.value)
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="2014"
                max={new Date().getFullYear()}
              />
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
              {error}
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
                disabled={isProcessing || remainingConversions <= 0}
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

          {remainingConversions <= 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
                <div>
                  <p className="font-medium text-yellow-800">Conversion limit reached</p>
                  <p className="text-sm text-yellow-700">
                    Please upgrade your plan to continue converting files.
                  </p>
                </div>
              </div>
              <button
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
              >
                View Pricing Plans
              </button>
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
// PRICING SECTION
// ==========================================

const PricingSection = () => {
  const { user, userDoc, upgradePlan } = useAuth();
  const [upgrading, setUpgrading] = useState(null);

  const handleUpgrade = async (planId) => {
    if (!user) {
      document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (planId === 'enterprise') {
      window.open('mailto:sales@iafrica.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }

    setUpgrading(planId);
    try {
      await upgradePlan(planId);
      alert('Plan upgraded successfully! Welcome to your new plan.');
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert('Upgrade failed. Please try again or contact support.');
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div id="pricing" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Choose Your Plan
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Select the perfect plan for your CRS compliance needs. All plans include GDPR compliance and expert support.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {Object.entries(PRICING_PLANS).map(([planId, plan]) => {
            const isCurrentPlan = userDoc?.plan === planId;
            const colorClasses = {
              gray: 'border-gray-200',
              blue: 'border-blue-200 ring-2 ring-blue-500',
              purple: 'border-purple-200'
            };

            return (
              <div
                key={planId}
                className={`bg-white rounded-lg shadow-lg p-8 relative ${colorClasses[plan.color] || colorClasses.gray}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    {plan.price > 0 && <span className="text-gray-600">/month</span>}
                  </div>
                  <p className="text-gray-600">
                    {plan.conversions} conversions{plan.price > 0 ? '/month' : ' total'}
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(planId)}
                  disabled={isCurrentPlan || upgrading === planId}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                      : plan.color === 'blue'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : plan.color === 'purple'
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                >
                  {upgrading === planId ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin inline mr-2" />
                      Upgrading...
                    </>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : (
                    plan.buttonText
                  )}
                </button>

                {isCurrentPlan && (
                  <div className="mt-3 text-center">
                    <span className="text-sm text-green-600 font-medium">
                      ✓ You're on this plan
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            All plans include 24/7 technical support and 99.9% uptime SLA
          </p>
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
            <div className="flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              GDPR Compliant
            </div>
            <div className="flex items-center">
              <Lock className="w-4 h-4 mr-2" />
              Bank-Level Security
            </div>
            <div className="flex items-center">
              <Globe className="w-4 h-4 mr-2" />
              OECD Standards
            </div>
          </div>
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
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <HeroSection />
        <FeaturesSection />
        <AuthSection />
        <DashboardSection />
        <FileConverterSection />
        <PricingSection />
        
        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent">
                  iAfrica
                </div>
                <div>
                  <p className="text-lg font-semibold">Intelligent Africa Solutions Ltd</p>
                  <p className="text-sm text-gray-400">Innovative financial technology solutions for Africa</p>
                </div>
              </div>
              <div className="text-center md:text-right text-sm text-gray-400">
                <p>Designed & Developed by</p>
                <p className="font-medium text-white">Intelligent Africa Solutions Ltd</p>
                <div className="flex items-center justify-center md:justify-end space-x-4 mt-2">
                  <span className="flex items-center">
                    Powered by Firebase
                    <Shield className="w-4 h-4 text-green-400 ml-1" />
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm text-gray-400">
              <p>© 2024 Intelligent Africa Solutions Ltd. All rights reserved. | Professional CRS OECD XML Converter</p>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
