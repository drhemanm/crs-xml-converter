/ ==========================================
// COMPLETE CRS XML CONVERTER SAAS APP - STEP 4
// This adds: Authentication, Dashboard, Pricing, Enhanced Converter
// Replace your ENTIRE CRSXMLConverter.js file with this code
// ==========================================

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

// Import all the icons we'll use throughout the app
import { 
  Upload, Download, FileText, AlertCircle, CheckCircle2, Settings, 
  Shield, X, HelpCircle, Clock, Zap, Lock, Globe, ChevronRight,
  User, Building2, Menu, LogOut, CreditCard, BarChart3,
  Star, Crown, Sparkles, ArrowRight, Check, Users, Calendar,
  TrendingUp, Award, Headphones, Smartphone
} from 'lucide-react';

// Import Excel processing library
import * as XLSX from 'xlsx';

// ==========================================
// MOCK DATA AND AUTHENTICATION
// This simulates a real database and user system
// ==========================================

// Fake authentication system (simulates Firebase Auth)
const mockAuth = {
  currentUser: null,
  
  signInWithEmailAndPassword: async (email, password) => {
    // Simulate loading time
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('🔐 User trying to login:', email);
    const user = { uid: 'user_' + Date.now(), email, displayName: email.split('@')[0] };
    mockAuth.currentUser = user;
    return { user };
  },
  
  createUserWithEmailAndPassword: async (email, password) => {
    // Simulate loading time  
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('📝 New user registering:', email);
    const user = { uid: 'user_' + Date.now(), email, displayName: email.split('@')[0] };
    mockAuth.currentUser = user;
    return { user };
  },
  
  signOut: async () => {
    console.log('👋 User logging out');
    mockAuth.currentUser = null;
  }
};

// Fake database system (simulates Firestore)
const mockFirestore = {
  users: {},
  
  addUser: (uid, data) => {
    console.log('💾 Adding new user to database:', uid, data);
    mockFirestore.users[uid] = {
      ...data,
      conversionsUsed: 0,
      conversionsLimit: 3,
      plan: 'free',
      createdAt: new Date(),
      subscriptionStatus: 'active'
    };
  },
  
  getUser: (uid) => mockFirestore.users[uid],
  
  updateUser: (uid, data) => {
    if (mockFirestore.users[uid]) {
      mockFirestore.users[uid] = { ...mockFirestore.users[uid], ...data };
      console.log('🔄 Updated user:', uid, data);
    }
  },
  
  incrementConversions: (uid) => {
    if (mockFirestore.users[uid]) {
      mockFirestore.users[uid].conversionsUsed += 1;
      console.log('📈 User conversion count:', mockFirestore.users[uid].conversionsUsed);
    }
  }
};

// ==========================================
// AUTHENTICATION CONTEXT
// This manages user login state across the entire app
// ==========================================

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔍 Checking if user is already logged in...');
    const savedUser = localStorage.getItem('crs_user');
    if (savedUser) {
      console.log('✅ Found saved user!');
      const userData = JSON.parse(savedUser);
      setUser(userData);
      mockAuth.currentUser = userData;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const result = await mockAuth.signInWithEmailAndPassword(email, password);
    const userData = result.user;
    
    let userDoc = mockFirestore.getUser(userData.uid);
    if (!userDoc) {
      mockFirestore.addUser(userData.uid, {
        email: userData.email,
        displayName: userData.displayName
      });
      userDoc = mockFirestore.getUser(userData.uid);
    }
    
    const fullUserData = { ...userData, ...userDoc };
    setUser(fullUserData);
    localStorage.setItem('crs_user', JSON.stringify(fullUserData));
    return fullUserData;
  };

  const register = async (email, password, displayName, company) => {
    const result = await mockAuth.createUserWithEmailAndPassword(email, password);
    const userData = { ...result.user, displayName };
    
    mockFirestore.addUser(userData.uid, {
      email,
      displayName,
      company
    });
    
    const userDoc = mockFirestore.getUser(userData.uid);
    const fullUserData = { ...userData, ...userDoc };
    setUser(fullUserData);
    localStorage.setItem('crs_user', JSON.stringify(fullUserData));
    return fullUserData;
  };

  const logout = async () => {
    await mockAuth.signOut();
    setUser(null);
    localStorage.removeItem('crs_user');
  };

  const updateUserUsage = () => {
    if (user) {
      mockFirestore.incrementConversions(user.uid);
      const updatedUserDoc = mockFirestore.getUser(user.uid);
      const updatedUser = { ...user, ...updatedUserDoc };
      setUser(updatedUser);
      localStorage.setItem('crs_user', JSON.stringify(updatedUser));
    }
  };

  const upgradePlan = (plan) => {
    if (user) {
      const limits = { free: 3, professional: 100, enterprise: 1000 };
      
      mockFirestore.updateUser(user.uid, {
        plan,
        conversionsLimit: limits[plan],
        subscriptionStatus: 'active'
      });
      
      const updatedUserDoc = mockFirestore.getUser(user.uid);
      const updatedUser = { ...user, ...updatedUserDoc };
      setUser(updatedUser);
      localStorage.setItem('crs_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, login, register, logout, updateUserUsage, upgradePlan 
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
// NAVIGATION COMPONENT
// ==========================================

const Navigation = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
                    <div className="font-medium text-gray-900">{user.displayName}</div>
                    <div className="text-gray-500 capitalize">{user.plan} Plan</div>
                  </div>
                  <button 
                    onClick={logout}
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
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-sm text-gray-500 capitalize">{user.plan} Plan</div>
                </div>
                <button className="block w-full text-left px-4 py-2 text-gray-700">Convert</button>
                <button className="block w-full text-left px-4 py-2 text-gray-700">Dashboard</button>
                <button className="block w-full text-left px-4 py-2 text-gray-700">Pricing</button>
                <button onClick={logout} className="block w-full text-left px-4 py-2 text-red-600">Sign Out</button>
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
// AUTHENTICATION SECTION COMPONENT
// This handles user login and registration
// ==========================================

const AuthSection = () => {
  const { user, login, register, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);    // Toggle between login and register
  const [formData, setFormData] = useState({       // Form input data
    email: '',
    password: '',
    displayName: '',
    company: ''
  });
  const [error, setError] = useState('');          // Error message
  const [isSubmitting, setIsSubmitting] = useState(false);  // Is form being submitted?

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (isLogin) {
        console.log('🔑 Attempting login...');
        await login(formData.email, formData.password);
      } else {
        console.log('📝 Attempting registration...');
        await register(formData.email, formData.password, formData.displayName, formData.company);
      }
      console.log('✅ Authentication successful!');
    } catch (err) {
      console.error('❌ Authentication failed:', err);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't show auth section if user is already logged in
  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div id="auth" className="py-20 bg-gray-50">
      <div className="max-w-md mx-auto px-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Form Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isLogin ? 'Welcome Back' : 'Get Started Free'}
            </h2>
            <p className="text-gray-600">
              {isLogin ? 'Sign in to your account' : 'Create your account and convert 3 files free'}
            </p>
          </div>

          {/* Login/Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Show these fields only for registration */}
            {!isLogin && (
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
                    required={!isLogin}
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
                    required={!isLogin}
                  />
                </div>
              </>
            )}
            
            {/* Email field (always shown) */}
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
            
            {/* Password field (always shown) */}
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

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin mr-2" />
                  {isLogin ? 'Signing In...' : 'Creating Account...'}
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Free Account'
              )}
            </button>
          </form>

          {/* Toggle between login and register */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData({ email: '', password: '', displayName: '', company: '' });
              }}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              {isLogin ? "Don't have an account? Sign up free" : "Already have an account? Sign in"}
            </button>
          </div>

          {/* Free trial benefits (only shown during registration) */}
          {!isLogin && (
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
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DASHBOARD COMPONENT
// Shows user stats, usage, and account info
// ==========================================

const Dashboard = () => {
  const { user, upgradePlan } = useAuth();

  // Don't show dashboard if user is not logged in
  if (!user) return null;

  // Calculate usage statistics
  const usagePercentage = (user.conversionsUsed / user.conversionsLimit) * 100;
  const remaining = user.conversionsLimit - user.conversionsUsed;
  const isNearLimit = usagePercentage > 80;
  const isAtLimit = remaining <= 0;

  return (
    <div id="dashboard" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.displayName}! 👋
          </h2>
          <p className="text-gray-600">Manage your CRS conversions and account settings</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Conversions Used */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{user.conversionsUsed}</div>
                <div className="text-sm text-gray-600">Conversions Used</div>
              </div>
            </div>
          </div>

          {/* Remaining Conversions */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${remaining > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <CheckCircle2 className={`w-6 h-6 ${remaining > 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${remaining > 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {remaining}
                </div>
                <div className="text-sm text-gray-600">Remaining</div>
              </div>
            </div>
          </div>

          {/* Current Plan */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Crown className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 capitalize">{user.plan}</div>
                <div className="text-sm text-gray-600">Current Plan</div>
              </div>
            </div>
          </div>

          {/* Monthly Limit */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{user.conversionsLimit}</div>
                <div className="text-sm text-gray-600">Monthly Limit</div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Progress Bar */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Usage</h3>
            <span className="text-sm text-gray-600">
              {user.conversionsUsed} / {user.conversionsLimit} ({Math.round(usagePercentage)}%)
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className={`h-4 rounded-full transition-all duration-300 ${
                usagePercentage > 90 ? 'bg-red-500' :
                usagePercentage > 70 ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            ></div>
          </div>
          
          {/* Usage Warning */}
          {isNearLimit && (
            <div className={`mt-4 p-4 rounded-lg border ${
              isAtLimit ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-start space-x-3">
                <AlertCircle className={`w-5 h-5 mt-0.5 ${
                  isAtLimit ? 'text-red-600' : 'text-yellow-600'
                }`} />
                <div>
                  <h4 className={`font-medium ${
                    isAtLimit ? 'text-red-800' : 'text-yellow-800'
                  }`}>
                    {isAtLimit ? 'Usage Limit Reached!' : 'Usage Warning'}
                  </h4>
                  <p className={`text-sm mb-3 ${
                    isAtLimit ? 'text-red-700' : 'text-yellow-700'
                  }`}>
                    {isAtLimit 
                      ? 'You have reached your monthly conversion limit. Upgrade your plan to continue converting files.'
                      : `You've used ${Math.round(usagePercentage)}% of your monthly conversions. Consider upgrading to avoid interruption.`
                    }
                  </p>
                  {(user.plan === 'free' || isAtLimit) && (
                    <button 
                      onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                      className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${
                        isAtLimit ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'
                      }`}
                    >
                      {isAtLimit ? 'Upgrade Now Required' : 'Upgrade Plan'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          {/* Convert Files */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button 
                onClick={() => document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' })}
                disabled={isAtLimit}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Upload className="w-5 h-5 mr-2" />
                {isAtLimit ? 'Upgrade Required to Convert' : 'Convert New File'}
              </button>
              
              <button 
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center"
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                View Pricing Plans
              </button>
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="text-gray-900">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Plan:</span>
                <span className="text-gray-900 capitalize font-medium">{user.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Member since:</span>
                <span className="text-gray-900">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="text-green-600 font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// PRICING SECTION COMPONENT
// Shows the three pricing tiers with upgrade buttons
// ==========================================

const PricingSection = () => {
  const { user, upgradePlan } = useAuth();

  // Handle plan upgrade (in real app, this would integrate with Stripe)
  const handleUpgrade = (planKey) => {
    if (!user) {
      // If user is not logged in, scroll to auth section
      document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    console.log('🚀 User wants to upgrade to:', planKey);
    
    if (planKey === 'professional' || planKey === 'enterprise') {
      // In a real app, this would:
      // 1. Create a Stripe checkout session
      // 2. Redirect to Stripe payment page
      // 3. Handle successful payment webhook
      // 4. Update user's plan in database
      
      // For demo purposes, we'll just simulate the upgrade
      if (confirm(`Upgrade to ${PRICING_PLANS[planKey].name} plan for $${PRICING_PLANS[planKey].price}/month?`)) {
        upgradePlan(planKey);
        alert('🎉 Plan upgraded successfully! (This is a demo - no actual payment processed)');
      }
    }
  };

  return (
    <div id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the plan that fits your CRS compliance needs. Start free, upgrade anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {Object.entries(PRICING_PLANS).map(([planKey, plan]) => {
            const isCurrentPlan = user && user.plan === planKey;
            const canUpgrade = user && user.plan !== planKey;
            
            return (
              <div 
                key={planKey}
                className={`relative bg-white rounded-2xl shadow-lg border-2 p-8 ${
                  plan.popular 
                    ? 'border-blue-500 transform scale-105' 
                    : isCurrentPlan 
                      ? 'border-green-500'
                      : 'border-gray-200'
                }`}
              >
                
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-green-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Current Plan
                    </div>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    {plan.price > 0 && <span className="text-gray-600">/month</span>}
                  </div>
                  <p className="text-gray-600">
                    {plan.conversions} conversion{plan.conversions !== 1 ? 's' : ''} per month
                  </p>
                </div>

                {/* Features List */}
                <div className="mb-8">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleUpgrade(planKey)}
                  disabled={isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    isCurrentPlan
                      ? 'bg-green-100 text-green-800 cursor-default'
                      : plan.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {isCurrentPlan ? '✓ Current Plan' : plan.buttonText}
                </button>

                {/* Trial Info */}
                {planKey === 'free' && !user && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600">No credit card required</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            Need more conversions or custom features? 
          </p>
          <button className="text-blue-600 hover:text-blue-700 font-medium">
            Contact our sales team →
          </button>
        </div>
      </div>
    </div>
  );
};

// I'll continue with the CRS Converter component in the next part...
// This file is getting quite long, so let me break it here and add the converter + footer

// ==========================================
// MAIN APP COMPONENT
// This puts everything together
// ==========================================

export default function CRSXMLConverter() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <HeroSection />
        <FeaturesSection />
        <AuthSection />
        <Dashboard />
        <PricingSection />
        
        {/* Temporary message - we'll add the actual converter next */}
        <div className="py-20 text-center bg-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🚧 CRS Converter Component Coming Next!</h2>
          <p className="text-gray-600">The enhanced converter with usage limits will be added in the next update</p>
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
                  <p className="text-lg font-semibold">Intelligent Africa Solutions Ltd</p>
                  <p className="text-sm text-gray-400">Innovative financial technology solutions for Africa</p>
                </div>
              </div>
              <div className="text-center md:text-right text-sm text-gray-400">
                <p>Designed & Developed by</p>
                <p className="font-medium text-white">Intelligent Africa Solutions Ltd</p>
                <div className="flex items-center justify-center md:justify-end space-x-4 mt-2">
                  <span className="flex items-center">
                    GDPR Compliant
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
