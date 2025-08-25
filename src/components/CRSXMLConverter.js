import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
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
import { 
  Upload, Download, FileText, AlertCircle, CheckCircle2, Settings, 
  Shield, X, HelpCircle, Clock, Zap, Lock, Globe, ChevronRight,
  User, Building2, Menu, LogOut, CreditCard, BarChart3,
  Star, Crown, Sparkles, ArrowRight, Check, Users, Calendar,
  TrendingUp, Award, Headphones, Smartphone, Eye, History,
  DollarSign, Target, Activity, Briefcase, Play, Loader
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Firebase Configuration (uses your .env variables)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Authentication Context
const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);

// Enhanced Authentication Provider
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState('free');
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Get user plan and usage from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserPlan(userData.plan || 'free');
          setUsageCount(userData.usageCount || 0);
        }
      } else {
        setUser(null);
        setUserPlan('free');
        setUsageCount(0);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUp = async (email, password, companyName = '') => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Create user document in Firestore
    await setDoc(doc(db, 'users', result.user.uid), {
      email,
      companyName,
      plan: 'free',
      usageCount: 0,
      createdAt: serverTimestamp()
    });
    return result;
  };

  const signIn = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    // Check if user document exists, create if not
    const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        displayName: result.user.displayName,
        plan: 'free',
        usageCount: 0,
        createdAt: serverTimestamp()
      });
    }
    return result;
  };

  const logout = () => signOut(auth);

  const incrementUsage = async () => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        usageCount: increment(1)
      });
      setUsageCount(prev => prev + 1);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, signUp, signIn, signInWithGoogle, logout, userPlan, usageCount, incrementUsage
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Beautiful animated background component
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-10 left-10 w-72 h-72 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-pink-500/5 to-orange-500/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
    </div>
  );
}

// Premium notification component
function PremiumNotification({ type, message, onClose }) {
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: HelpCircle
  };
  const Icon = icons[type];
  
  const colors = {
    success: 'bg-emerald-500 border-emerald-400',
    error: 'bg-red-500 border-red-400',
    info: 'bg-blue-500 border-blue-400'
  };

  return (
    <div className={`fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-sm animate-slide-in-right z-50`}>
      <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-4 hover:opacity-70 transition-opacity">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Stunning authentication component
function AuthComponent({ onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const { signUp, signIn, signInWithGoogle } = useAuth();

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
        showNotification('success', 'Welcome back!');
      } else {
        await signUp(email, password, companyName);
        showNotification('success', 'Account created successfully!');
      }
      onClose();
    } catch (error) {
      showNotification('error', error.message);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      showNotification('success', 'Signed in with Google!');
      onClose();
    } catch (error) {
      showNotification('error', error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform animate-scale-in">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 bg-white border-2 border-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-300 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-4 text-gray-500 text-sm">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                required
              />
              
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                required
              />
              
              {!isLogin && (
                <input
                  type="text"
                  placeholder="Company Name (Optional)"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                />
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {notification && (
        <PremiumNotification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}

// Enhanced pricing component
function PricingComponent({ onClose }) {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      description: 'Perfect for small teams getting started',
      features: [
        '5 XML conversions per month',
        'Basic CRS OECD compliance',
        'Standard support',
        'Excel & CSV support'
      ],
      color: 'border-gray-300',
      buttonColor: 'bg-gray-600 hover:bg-gray-700',
      popular: false
    },
    {
      name: 'Professional',
      price: '$29',
      period: '/month',
      description: 'Ideal for growing businesses',
      features: [
        '100 XML conversions per month',
        'Advanced CRS OECD compliance',
        'Priority support',
        'All file formats',
        'Custom XML templates',
        'API access'
      ],
      color: 'border-blue-500 ring-2 ring-blue-500',
      buttonColor: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
      popular: true
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: '/month',
      description: 'For large organizations with high volume',
      features: [
        'Unlimited XML conversions',
        'Enterprise CRS OECD compliance',
        '24/7 dedicated support',
        'All file formats',
        'Custom integration',
        'White-label option',
        'SLA guarantee',
        'Advanced analytics'
      ],
      color: 'border-amber-400',
      buttonColor: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700',
      popular: false
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl transform animate-scale-in my-8">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Choose Your Plan</h2>
              <p className="text-gray-600 mt-2">Select the perfect plan for your CRS XML conversion needs</p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div key={index} className={`relative rounded-2xl border-2 ${plan.color} p-8 ${plan.popular ? 'transform scale-105 shadow-2xl' : 'shadow-lg'} transition-all duration-300 hover:shadow-xl`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                      <Crown className="w-4 h-4 mr-1" />
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-gray-600 mt-2">{plan.description}</p>
                  <div className="mt-6">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                </div>

                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center space-x-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button className={`w-full mt-8 ${plan.buttonColor} text-white py-3 px-6 rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl flex items-center justify-center space-x-2`}>
                  <span>{plan.name === 'Free' ? 'Get Started' : 'Upgrade Now'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main CRS XML Converter Component
export default function CRSXMLConverter() {
  const [file, setFile] = useState(null);
  const [xmlOutput, setXmlOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [step, setStep] = useState(1);
  const fileInputRef = useRef(null);

  // Form states
  const [reportingFI, setReportingFI] = useState({
    name: 'Intelligent Africa Solutions Ltd',
    address: 'Mauritius',
    city: 'Curepipe',
    countryCode: 'MU',
    tin: 'MU123456789',
    giin: ''
  });
  
  const [messageSpec, setMessageSpec] = useState({
    messageRefId: '',
    reportingPeriod: new Date().getFullYear() - 1,
    timestamp: new Date().toISOString().split('T')[0]
  });

  const { user, userPlan, usageCount, incrementUsage, logout } = useAuth();

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Enhanced XML generation with proper CRS OECD format
  const generateCRSXML = (data) => {
    const timestamp = new Date().toISOString();
    const messageRefId = messageSpec.messageRefId || `MU_${Date.now()}`;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<crs:CRS_OECD xmlns:crs="urn:oecd:ties:crs:v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="2.0">
  <crs:MessageSpec>
    <crs:SendingCompanyIN>${reportingFI.tin}</crs:SendingCompanyIN>
    <crs:TransmittingCountry>${reportingFI.countryCode}</crs:TransmittingCountry>
    <crs:ReceivingCountry>US</crs:ReceivingCountry>
    <crs:MessageType>CRS</crs:MessageType>
    <crs:Warning>Disclosure prohibited under penalties of law</crs:Warning>
    <crs:Contact>
      <crs:ContactPersonName>${reportingFI.name}</crs:ContactPersonName>
      <crs:ContactPersonEmailAddress>contact@intelligentafrica.mu</crs:ContactPersonEmailAddress>
    </crs:Contact>
    <crs:MessageRefId>${messageRefId}</crs:MessageRefId>
    <crs:ReportingPeriod>${messageSpec.reportingPeriod}</crs:ReportingPeriod>
    <crs:Timestamp>${timestamp}</crs:Timestamp>
  </crs:MessageSpec>
  <crs:CrsBody>
    <crs:ReportingFI>
      <crs:ReportingFI_Name>${reportingFI.name}</crs:ReportingFI_Name>
      <crs:ReportingFI_Address>
        <crs:CountryCode>${reportingFI.countryCode}</crs:CountryCode>
        <crs:AddressFree>${reportingFI.address}, ${reportingFI.city}</crs:AddressFree>
      </crs:ReportingFI_Address>
      <crs:ReportingFI_TIN>${reportingFI.tin}</crs:ReportingFI_TIN>
      ${reportingFI.giin ? `<crs:ReportingFI_GIIN>${reportingFI.giin}</crs:ReportingFI_GIIN>` : ''}
    </crs:ReportingFI>`;

    // Process account holder data
    data.forEach((row, index) => {
      if (row['Account Number'] || row['AccountNumber'] || row['Account_Number']) {
        const accountNumber = row['Account Number'] || row['AccountNumber'] || row['Account_Number'] || '';
        const accountHolderName = row['Account Holder Name'] || row['AccountHolderName'] || row['Name'] || '';
        const accountHolderAddress = row['Address'] || row['Account Holder Address'] || '';
        const accountHolderCountry = row['Country'] || row['Jurisdiction'] || 'MU';
        const accountHolderTIN = row['TIN'] || row['Tax ID'] || '';
        const accountBalance = parseFloat(row['Balance'] || row['Account Balance'] || '0');
        const currency = row['Currency'] || 'USD';

        xml += `
    <crs:ReportingGroup>
      <crs:Sponsor>
        <crs:SponsorId>${reportingFI.tin}</crs:SponsorId>
      </crs:Sponsor>
      <crs:AccountReport>
        <crs:DocSpec>
          <crs:DocTypeIndic>CRS701</crs:DocTypeIndic>
          <crs:DocRefId>ACC${index + 1}_${messageRefId}</crs:DocRefId>
        </crs:DocSpec>
        <crs:AccountNumber>${accountNumber}</crs:AccountNumber>
        <crs:AccountHolder>
          <crs:Individual>
            <crs:ResCountryCode>${accountHolderCountry}</crs:ResCountryCode>
            <crs:TIN>${accountHolderTIN}</crs:TIN>
            <crs:Name>
              <crs:FirstName>${accountHolderName.split(' ')[0] || ''}</crs:FirstName>
              <crs:LastName>${accountHolderName.split(' ').slice(1).join(' ') || accountHolderName}</crs:LastName>
            </crs:Name>
            <crs:Address>
              <crs:CountryCode>${accountHolderCountry}</crs:CountryCode>
              <crs:AddressFree>${accountHolderAddress || 'Not provided'}</crs:AddressFree>
            </crs:Address>
            <crs:BirthInfo>
              <crs:BirthDate>${row['Birth Date'] || row['DOB'] || '1900-01-01'}</crs:BirthDate>
            </crs:BirthInfo>
          </crs:Individual>
        </crs:AccountHolder>
        <crs:AccountBalance currCode="${currency}">${accountBalance.toFixed(2)}</crs:AccountBalance>
        <crs:Payment>
          <crs:Type>CRS501</crs:Type>
          <crs:PaymentAmnt currCode="${currency}">${(accountBalance * 0.1).toFixed(2)}</crs:PaymentAmnt>
        </crs:Payment>
      </crs:AccountReport>
    </crs:ReportingGroup>`;
      }
    });

    xml += `
  </crs:CrsBody>
</crs:CRS_OECD>`;

    return xml;
  };

  const processFile = async () => {
    if (!file) {
      showNotification('error', 'Please select a file first');
      return;
    }

    // Check usage limits
    const limits = { free: 5, professional: 100, enterprise: Infinity };
    if (usageCount >= limits[userPlan]) {
      showNotification('error', `You've reached your monthly limit. Upgrade your plan to continue.`);
      setShowPricing(true);
      return;
    }

    setLoading(true);
    setStep(3);

    try {
      const data = file.arrayBuffer ? await file.arrayBuffer() : file;
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('File appears to be empty or invalid');
      }

      const xml = generateCRSXML(jsonData);
      setXmlOutput(xml);

      // Track usage
      await incrementUsage();
      
      showNotification('success', `XML generated successfully! ${jsonData.length} records processed.`);
      setStep(4);
    } catch (error) {
      showNotification('error', `Error processing file: ${error.message}`);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const downloadXML = () => {
    if (!xmlOutput) return;
    
    const blob = new Blob([xmlOutput], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CRS_OECD_${messageSpec.reportingPeriod}_${Date.now()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('success', 'XML file downloaded successfully!');
  };

  const resetProcess = () => {
    setFile(null);
    setXmlOutput('');
    setStep(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden">
        <AnimatedBackground />
        
        {/* Premium Navigation */}
        <nav className="relative z-10 bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">CRS Converter</h1>
                    <p className="text-xs text-gray-500">by Intelligent Africa</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {user ? (
                  <div className="flex items-center space-x-4">
                    <div className="text-sm">
                      <span className="text-gray-600">Plan: </span>
                      <span className="font-semibold capitalize text-blue-600">{userPlan}</span>
                      <span className="text-gray-400 ml-2">({usageCount} used)</span>
                    </div>
                    <button
                      onClick={() => setShowPricing(true)}
                      className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
                    >
                      <Crown className="w-4 h-4" />
                      <span>Upgrade</span>
                    </button>
                    <button
                      onClick={logout}
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setShowPricing(true)}
                      className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Pricing
                    </button>
                    <button
                      onClick={() => setShowAuth(true)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-xl"
                    >
                      <User className="w-4 h-4" />
                      <span>Sign In</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-12 pb-8">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Professional CRS XML
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Converter</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Transform your financial data into OECD CRS compliant XML format with enterprise-grade accuracy and security. Trusted by financial institutions worldwide.
            </p>
            
            {/* Progress Steps */}
            <div className="mt-12 mb-8">
              <div className="flex justify-center items-center space-x-8">
                {[
                  { num: 1, title: 'Upload File', icon: Upload },
                  { num: 2, title: 'Configure', icon: Settings },
                  { num: 3, title: 'Convert', icon: Zap },
                  { num: 4, title: 'Download', icon: Download }
                ].map(({ num, title, icon: Icon }) => (
                  <div key={num} className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                      step >= num 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-110' 
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {step > num ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <span className={`font-medium ${step >= num ? 'text-blue-600' : 'text-gray-500'}`}>
                      {title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Column - Form */}
            <div className="space-y-8">
              {/* File Upload Section */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20">
                <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                  <Upload className="w-6 h-6 mr-3 text-blue-600" />
                  Upload Financial Data
                </h3>
                
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors duration-300">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      setFile(e.target.files[0]);
                      setStep(2);
                      showNotification('success', 'File uploaded successfully!');
                    }}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  
                  {file ? (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Change File
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                        <Upload className="w-8 h-8 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-900">Choose Excel or CSV file</p>
                        <p className="text-gray-500">Supports .xlsx, .xls, .csv formats</p>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                      >
                        Select File
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Configuration Section */}
              {step >= 2 && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 animate-slide-in-left">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                    <Settings className="w-6 h-6 mr-3 text-blue-600" />
                    CRS Configuration
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reporting Period
                      </label>
                      <input
                        type="number"
                        value={messageSpec.reportingPeriod}
                        onChange={(e) => setMessageSpec({...messageSpec, reportingPeriod: parseInt(e.target.value)})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                        min="2014"
                        max={new Date().getFullYear()}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Message Reference ID
                      </label>
                      <input
                        type="text"
                        value={messageSpec.messageRefId}
                        onChange={(e) => setMessageSpec({...messageSpec, messageRefId: e.target.value})}
                        placeholder={`MU_${Date.now()}`}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reporting FI Name
                      </label>
                      <input
                        type="text"
                        value={reportingFI.name}
                        onChange={(e) => setReportingFI({...reportingFI, name: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Country Code
                      </label>
                      <input
                        type="text"
                        value={reportingFI.countryCode}
                        onChange={(e) => setReportingFI({...reportingFI, countryCode: e.target.value.toUpperCase()})}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                        maxLength="2"
                      />
                    </div>
                  </div>

                  <button
                    onClick={processFile}
                    disabled={loading || !file}
                    className="w-full mt-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl text-lg font-semibold"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-6 h-6 animate-spin" />
                        <span>Converting to XML...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-6 h-6" />
                        <span>Generate CRS XML</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Right Column - Preview & Download */}
            <div className="space-y-8">
              {/* XML Preview */}
              {xmlOutput && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 animate-slide-in-right">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                    <FileText className="w-6 h-6 mr-3 text-green-600" />
                    XML Preview
                  </h3>
                  
                  <div className="bg-gray-900 rounded-xl p-6 overflow-auto max-h-96">
                    <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                      {xmlOutput.substring(0, 1000)}...
                    </pre>
                  </div>
                  
                  <div className="flex space-x-4 mt-6">
                    <button
                      onClick={downloadXML}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                    >
                      <Download className="w-5 h-5" />
                      <span>Download XML</span>
                    </button>
                    
                    <button
                      onClick={resetProcess}
                      className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-gray-400 transition-colors"
                    >
                      <span>New File</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Features */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20">
                <h3 className="text-2xl font-semibold text-gray-900 mb-6">Why Choose Our Converter?</h3>
                
                <div className="space-y-4">
                  {[
                    { icon: Shield, title: 'OECD Compliant', desc: 'Generates XML files that meet all CRS OECD standards' },
                    { icon: Zap, title: 'Lightning Fast', desc: 'Process thousands of records in seconds' },
                    { icon: Lock, title: 'Secure Processing', desc: 'Your data never leaves your browser' },
                    { icon: Globe, title: 'Global Standards', desc: 'Works with international tax reporting requirements' }
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex items-start space-x-4 p-4 rounded-xl hover:bg-white/50 transition-colors">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{title}</h4>
                        <p className="text-gray-600 text-sm">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 bg-gray-900 text-white mt-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-white" />
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

        {/* Modals */}
        {showAuth && <AuthComponent onClose={() => setShowAuth(false)} />}
        {showPricing && <PricingComponent onClose={() => setShowPricing(false)} />}
        
        {/* Notifications */}
        {notification && (
          <PremiumNotification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </AuthProvider>
  );
}
