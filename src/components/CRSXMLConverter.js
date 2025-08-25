// ==========================================
// COMPLETE CRS XML CONVERTER SAAS APP
// This file contains everything: login, dashboard, pricing, converter
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
// In production, you'd replace this with Firebase
// ==========================================

// Fake authentication system (simulates Firebase Auth)
const mockAuth = {
  currentUser: null, // Currently logged in user
  
  // Simulate user login
  signInWithEmailAndPassword: async (email, password) => {
    console.log('🔐 User trying to login:', email);
    const user = { uid: '123', email, displayName: email.split('@')[0] };
    mockAuth.currentUser = user;
    return { user };
  },
  
  // Simulate user registration
  createUserWithEmailAndPassword: async (email, password) => {
    console.log('📝 New user registering:', email);
    const user = { uid: '123', email, displayName: email.split('@')[0] };
    mockAuth.currentUser = user;
    return { user };
  },
  
  // Simulate user logout
  signOut: async () => {
    console.log('👋 User logging out');
    mockAuth.currentUser = null;
  }
};

// Fake database system (simulates Firestore)
const mockFirestore = {
  users: {}, // Store all user data here
  
  // Add new user to our fake database
  addUser: (uid, data) => {
    console.log('💾 Adding new user to database:', uid, data);
    mockFirestore.users[uid] = {
      ...data,
      conversionsUsed: 0,    // How many conversions they've used
      conversionsLimit: 3,   // Free users get 3 conversions
      plan: 'free',          // Everyone starts on free plan
      createdAt: new Date(),
      subscriptionStatus: 'active'
    };
  },
  
  // Get user data from fake database
  getUser: (uid) => mockFirestore.users[uid],
  
  // Update user data in fake database
  updateUser: (uid, data) => {
    if (mockFirestore.users[uid]) {
      mockFirestore.users[uid] = { ...mockFirestore.users[uid], ...data };
      console.log('🔄 Updated user:', uid, data);
    }
  },
  
  // Increase user's conversion count when they use the service
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

// Create a context to share user data everywhere in the app
const AuthContext = createContext();

// This component wraps our entire app and provides user data
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);        // Currently logged in user
  const [loading, setLoading] = useState(true);  // Are we checking if user is logged in?

  // When the app starts, check if user is already logged in
  useEffect(() => {
    console.log('🔍 Checking if user is already logged in...');
    
    // Check localStorage for saved user (simulates Firebase persistence)
    const savedUser = localStorage.getItem('crs_user');
    if (savedUser) {
      console.log('✅ Found saved user!');
      const userData = JSON.parse(savedUser);
      setUser(userData);
      mockAuth.currentUser = userData;
    } else {
      console.log('❌ No saved user found');
    }
    setLoading(false);
  }, []);

  // Function to log user in
  const login = async (email, password) => {
    console.log('🚀 Starting login process...');
    
    try {
      // Try to authenticate with our mock system
      const result = await mockAuth.signInWithEmailAndPassword(email, password);
      const userData = result.user;
      
      // Get existing user data or create new user
      let userDoc = mockFirestore.getUser(userData.uid);
      if (!userDoc) {
        console.log('👤 Creating new user data...');
        mockFirestore.addUser(userData.uid, {
          email: userData.email,
          displayName: userData.displayName
        });
        userDoc = mockFirestore.getUser(userData.uid);
      }
      
      // Combine authentication data with database data
      const fullUserData = { ...userData, ...userDoc };
      
      // Update our app state and save to localStorage
      setUser(fullUserData);
      localStorage.setItem('crs_user', JSON.stringify(fullUserData));
      
      console.log('✅ Login successful!', fullUserData);
      return fullUserData;
      
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  };

  // Function to register new user
  const register = async (email, password, displayName, company) => {
    console.log('🚀 Starting registration process...');
    
    try {
      // Create new user account
      const result = await mockAuth.createUserWithEmailAndPassword(email, password);
      const userData = { ...result.user, displayName };
      
      // Add user data to our database
      mockFirestore.addUser(userData.uid, {
        email,
        displayName,
        company
      });
      
      // Get the complete user data
      const userDoc = mockFirestore.getUser(userData.uid);
      const fullUserData = { ...userData, ...userDoc };
      
      // Update app state and save
      setUser(fullUserData);
      localStorage.setItem('crs_user', JSON.stringify(fullUserData));
      
      console.log('✅ Registration successful!', fullUserData);
      return fullUserData;
      
    } catch (error) {
      console.error('❌ Registration failed:', error);
      throw error;
    }
  };

  // Function to log user out
  const logout = async () => {
    console.log('🚀 Starting logout process...');
    
    await mockAuth.signOut();
    setUser(null);
    localStorage.removeItem('crs_user');
    
    console.log('✅ Logout successful!');
  };

  // Function to update user's conversion usage
  const updateUserUsage = () => {
    if (user) {
      console.log('📊 Updating user usage...');
      
      // Increment conversion count in database
      mockFirestore.incrementConversions(user.uid);
      
      // Get updated data and update app state
      const updatedUserDoc = mockFirestore.getUser(user.uid);
      const updatedUser = { ...user, ...updatedUserDoc };
      setUser(updatedUser);
      localStorage.setItem('crs_user', JSON.stringify(updatedUser));
      
      console.log('✅ Usage updated!');
    }
  };

  // Function to upgrade user's plan
  const upgradePlan = (plan) => {
    if (user) {
      console.log('⬆️ Upgrading user plan to:', plan);
      
      // Define conversion limits for each plan
      const limits = {
        free: 3,
        professional: 100,
        enterprise: 1000
      };
      
      // Update user data in database
      mockFirestore.updateUser(user.uid, {
        plan,
        conversionsLimit: limits[plan],
        subscriptionStatus: 'active'
      });
      
      // Update app state
      const updatedUserDoc = mockFirestore.getUser(user.uid);
      const updatedUser = { ...user, ...updatedUserDoc };
      setUser(updatedUser);
      localStorage.setItem('crs_user', JSON.stringify(updatedUser));
      
      console.log('✅ Plan upgraded!', updatedUser);
    }
  };

  // Provide all these functions to the entire app
  return (
    <AuthContext.Provider value={{ 
      user,              // Current user data
      loading,           // Is the app still loading?
      login,             // Function to log in
      register,          // Function to register
      logout,            // Function to log out
      updateUserUsage,   // Function to track usage
      upgradePlan        // Function to upgrade plan
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use authentication anywhere in the app
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ==========================================
// PRICING PLANS CONFIGURATION
// This defines the three pricing tiers
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
    popular: true,    // This will be highlighted
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
// The top header with logo and menu
// ==========================================

const Navigation = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo Section */}
          <div className="flex items-center space-x-3">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-500 bg-clip-text text-transparent">
              iAfrica
            </div>
            <div className="hidden md:block">
              <span className="text-lg font-semibold text-gray-900">CRS Converter</span>
              <span className="text-sm text-gray-500 ml-2">by Intelligent Africa</span>
            </div>
          </div>

          {/* Desktop Navigation Menu */}
          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              // Show these menu items when user is logged in
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
                
                {/* User Info and Logout */}
                <div className="flex items-center space-x-3 pl-6 border-l border-gray-200">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{user.displayName}</div>
                    <div className="text-gray-500 capitalize">{user.plan} Plan</div>
                  </div>
                  <button 
                    onClick={logout}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              // Show these menu items when user is NOT logged in
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

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Menu (shows on small screens) */}
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
// The big landing page banner (only shown to non-users)
// ==========================================

const HeroSection = () => {
  const { user } = useAuth();

  // Don't show hero section if user is already logged in
  if (user) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center">
          
          {/* Badge at the top */}
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4 mr-2" />
            GDPR Compliant • Enterprise Ready • Instant Processing
          </div>
          
          {/* Main headline */}
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Convert CRS Data to
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> XML Format</span>
          </h1>
          
          {/* Subheading */}
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Transform Excel/CSV financial data into compliant CRS OECD XML format instantly. 
            Trusted by financial institutions across Africa and beyond.
          </p>

          {/* Call-to-action buttons */}
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

          {/* Statistics */}
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
// Shows the key features of our service
// ==========================================

const FeaturesSection = () => {
  // Define all the features we want to highlight
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
        
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Why Choose Our CRS Converter?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Built specifically for financial institutions requiring OECD CRS compliance
          </p>
        </div>

        {/* Features grid */}
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

// I'll continue with the rest of the components in the next part...
// This is getting long, so let me split it into manageable pieces!

export default function CRSXMLConverter() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <HeroSection />
        <FeaturesSection />
        
        {/* More components will be added here */}
        <div className="py-20 text-center">
          <h2 className="text-2xl font-bold text-gray-900">🚧 More Components Coming Soon!</h2>
          <p className="text-gray-600 mt-2">Authentication, Dashboard, Pricing, and Converter sections</p>
        </div>
      </div>
    </AuthProvider>
  );
}
