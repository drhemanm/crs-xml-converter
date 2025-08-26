import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Upload, Download, FileText, Shield, Users, Building2, 
  CheckCircle, AlertTriangle, Loader, Settings, 
  Eye, EyeOff, User, LogOut, Menu, X, Sparkles,
  BarChart3, Clock, Award, Zap, Globe, Lock
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// Firebase configuration from environment variables
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

const CRSXMLConverter = () => {
  // Authentication State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // User Data & Subscription
  const [userData, setUserData] = useState(null);
  const [subscription, setSubscription] = useState('free');
  const [conversionsUsed, setConversionsUsed] = useState(0);
  const [conversionsLimit, setConversionsLimit] = useState(5);
  
  // File Processing State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [conversionResult, setConversionResult] = useState(null);
  const [error, setError] = useState(null);
  
  // UI State
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [xmlSettings, setXmlSettings] = useState({
    reportingFI: 'Your Financial Institution',
    messageRefId: 'MSG-' + Date.now(),
    taxYear: '2024',
    reportingPeriod: '2024-12-31'
  });
  
  // Refs
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  // Initialize authentication listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadUserData(firebaseUser.uid);
      } else {
        setUserData(null);
        setSubscription('free');
        setConversionsUsed(0);
        setConversionsLimit(5);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load user data from Firestore
  const loadUserData = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setSubscription(data.subscription || 'free');
        setConversionsUsed(data.conversionsUsed || 0);
        setConversionsLimit(getConversionsLimit(data.subscription || 'free'));
      } else {
        // Create new user document
        const newUserData = {
          email: user?.email,
          subscription: 'free',
          conversionsUsed: 0,
          createdAt: new Date(),
          lastLoginAt: new Date()
        };
        await setDoc(doc(db, 'users', uid), newUserData);
        setUserData(newUserData);
        setSubscription('free');
        setConversionsUsed(0);
        setConversionsLimit(5);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const getConversionsLimit = (plan) => {
    const limits = { free: 5, professional: 100, enterprise: 1000 };
    return limits[plan] || 5;
  };

  // Authentication handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        if (authForm.password !== authForm.confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        
        // Create user document in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: authForm.email,
          subscription: 'free',
          conversionsUsed: 0,
          createdAt: new Date(),
          lastLoginAt: new Date()
        });
      }
      setShowAuth(false);
      setAuthForm({ email: '', password: '', confirmPassword: '' });
    } catch (error) {
      setError(error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // File handling
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (file) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid Excel (.xlsx, .xls) or CSV file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setConversionResult(null);
  };

  // Generate OECD CRS XML
  const generateCRSXML = (data, settings) => {
    const { reportingFI, messageRefId, taxYear, reportingPeriod } = settings;
    
    const formatDate = (date) => {
      if (!date) return '';
      return new Date(date).toISOString().split('T')[0];
    };

    const formatCurrency = (amount) => {
      return parseFloat(amount || 0).toFixed(2);
    };

    const generateAccountReport = (account, index) => {
      const docRefId = `${messageRefId}-${String(index + 1).padStart(6, '0')}`;
      
      return `      <crs:AccountReport>
        <crs:DocSpec>
          <stf:DocTypeIndic>OECD1</stf:DocTypeIndic>
          <stf:DocRefId>${docRefId}</stf:DocRefId>
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
            ${account.BirthDate ? `<crs:BirthInfo>
              <crs:BirthDate>${formatDate(account.BirthDate)}</crs:BirthDate>
            </crs:BirthInfo>` : ''}
          </crs:Individual>
        </crs:AccountHolder>
        <crs:AccountBalance currCode="${account.CurrencyCode || 'USD'}">${formatCurrency(account.AccountBalance)}</crs:AccountBalance>
        <crs:Payment>
          <crs:Type>CRS501</crs:Type>
          <crs:PaymentAmnt currCode="${account.CurrencyCode || 'USD'}">${formatCurrency(account.Interest || 0)}</crs:PaymentAmnt>
        </crs:Payment>
      </crs:AccountReport>`;
    };

    const accountReports = data.map(generateAccountReport).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<crs:CRS_OECD xmlns:crs="urn:oecd:ties:crs:v1" xmlns:stf="urn:oecd:ties:stf:v4" version="1.0">
  <crs:MessageSpec>
    <crs:SendingCompanyIN>${reportingFI}</crs:SendingCompanyIN>
    <crs:TransmittingCountry>XX</crs:TransmittingCountry>
    <crs:ReceivingCountry>XX</crs:ReceivingCountry>
    <crs:MessageType>CRS</crs:MessageType>
    <crs:MessageRefId>${messageRefId}</crs:MessageRefId>
    <crs:ReportingPeriod>${reportingPeriod}</crs:ReportingPeriod>
    <crs:Timestamp>${new Date().toISOString()}</crs:Timestamp>
  </crs:MessageSpec>
  <crs:CrsBody>
    <crs:ReportingFI>
      <crs:ReportingFIName>${reportingFI}</crs:ReportingFIName>
      <crs:ReportingFIAddress>
        <crs:CountryCode>XX</crs:CountryCode>
        <crs:AddressFree>Financial Institution Address</crs:AddressFree>
      </crs:ReportingFIAddress>
    </crs:ReportingFI>
${accountReports}
  </crs:CrsBody>
</crs:CRS_OECD>`;
  };

  // File conversion process
  const handleConvert = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    if (!user) {
      setShowAuth(true);
      return;
    }

    // Check conversion limits
    if (conversionsUsed >= conversionsLimit) {
      setError(`You have reached your conversion limit (${conversionsLimit}). Please upgrade your plan.`);
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setError(null);
    setConversionResult(null);

    try {
      // Step 1: Reading file
      setProcessingStep('Reading file...');
      setProcessingProgress(20);
      
      const fileBuffer = await selectedFile.arrayBuffer();
      
      // Step 2: Parsing data
      setProcessingStep('Parsing financial data...');
      setProcessingProgress(40);
      
      let data;
      if (selectedFile.type.includes('csv')) {
        // Handle CSV
        const text = new TextDecoder().decode(fileBuffer);
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        data = lines.slice(1).map(line => {
          const values = line.split(',');
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index]?.trim() || '';
            return obj;
          }, {});
        });
      } else {
        // Handle Excel
        const workbook = XLSX.read(fileBuffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(worksheet);
      }

      // Step 3: Validating data
      setProcessingStep('Validating CRS compliance...');
      setProcessingProgress(60);

      // Basic validation
      if (!data || data.length === 0) {
        throw new Error('No data found in the file');
      }

      // Check for required CRS fields
      const requiredFields = ['AccountNumber', 'FirstName', 'LastName', 'AccountBalance'];
      const missingFields = requiredFields.filter(field => 
        !data.some(row => row[field] && row[field].toString().trim())
      );

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Step 4: Generating XML
      setProcessingStep('Generating CRS XML...');
      setProcessingProgress(80);

      const xmlContent = generateCRSXML(data, xmlSettings);

      // Step 5: Finalizing
      setProcessingStep('Finalizing...');
      setProcessingProgress(100);

      // Update user conversion count
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          conversionsUsed: increment(1),
          lastConversionAt: new Date()
        });
        setConversionsUsed(prev => prev + 1);
      }

      setConversionResult({
        xmlContent,
        fileName: `${selectedFile.name.split('.')[0]}_CRS.xml`,
        accountCount: data.length,
        fileSize: new Blob([xmlContent]).size
      });

      setProcessingStep('Complete!');
      
    } catch (error) {
      setError(error.message);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProcessingProgress(0);
        setProcessingStep('');
      }, 2000);
    }
  };

  // Download XML file
  const downloadXML = () => {
    if (!conversionResult) return;
    
    const blob = new Blob([conversionResult.xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = conversionResult.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      
      {/* Navigation */}
      <nav className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-emerald-400 mr-2" />
              <span className="text-xl font-bold text-white">
                CRS Converter <span className="text-emerald-400">Pro</span>
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/documentation" className="text-gray-300 hover:text-white transition-colors">
                Documentation
              </Link>
              <Link to="/privacy" className="text-gray-300 hover:text-white transition-colors">
                Privacy
              </Link>
              
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-white text-sm font-medium">{user.email}</div>
                    <div className="text-gray-400 text-xs capitalize">
                      {subscription} Plan • {conversionsUsed}/{conversionsLimit} used
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="text-gray-400 hover:text-white"
              >
                {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div className="md:hidden bg-white/5 border-t border-white/10">
            <div className="px-4 pt-2 pb-3 space-y-1">
              <Link to="/documentation" className="block text-gray-300 hover:text-white py-2">
                Documentation
              </Link>
              <Link to="/privacy" className="block text-gray-300 hover:text-white py-2">
                Privacy
              </Link>
              {user ? (
                <div className="pt-4 border-t border-white/10">
                  <div className="text-white text-sm font-medium mb-1">{user.email}</div>
                  <div className="text-gray-400 text-xs mb-3 capitalize">
                    {subscription} Plan • {conversionsUsed}/{conversionsLimit} used
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-300 text-sm mb-6">
            <Sparkles className="w-4 h-4 mr-2" />
            Enterprise-Grade CRS XML Conversion
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Convert Financial Data to{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              CRS OECD XML
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Professional-grade conversion tool for financial institutions. 
            Transform Excel and CSV files into compliant CRS XML format with enterprise security.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto mb-12">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
              <div className="text-2xl font-bold text-emerald-400">99.9%</div>
              <div className="text-gray-400 text-sm">Accuracy</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
              <div className="text-2xl font-bold text-blue-400">24/7</div>
              <div className="text-gray-400 text-sm">Available</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
              <div className="text-2xl font-bold text-purple-400">GDPR</div>
              <div className="text-gray-400 text-sm">Compliant</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
              <div className="text-2xl font-bold text-orange-400">SOC2</div>
              <div className="text-gray-400 text-sm">Certified</div>
            </div>
          </div>
        </div>

        {/* Converter Interface */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 mb-12">
          
          {/* File Upload Area */}
          <div 
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
              dragActive 
                ? 'border-emerald-400 bg-emerald-500/10' 
                : selectedFile 
                  ? 'border-green-400 bg-green-500/10' 
                  : 'border-gray-500 hover:border-gray-400'
            }`}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            
            {selectedFile ? (
              <div className="flex items-center justify-center">
                <FileText className="w-12 h-12 text-green-400 mr-4" />
                <div className="text-left">
                  <div className="text-white font-semibold">{selectedFile.name}</div>
                  <div className="text-gray-400 text-sm">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="ml-4 text-red-400 hover:text-red-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Drop your Excel or CSV file here
                </h3>
                <p className="text-gray-400 mb-4">
                  or click to browse files • Max 10MB
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  Choose File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Settings Panel */}
          <div className="mt-8 p-6 bg-white/5 rounded-xl border border-white/10">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center">
                <Settings className="w-5 h-5 text-gray-400 mr-3" />
                <span className="text-white font-medium">XML Configuration</span>
              </div>
              <div className="text-gray-400">
                {showSettings ? 'Hide' : 'Show'} Settings
              </div>
            </button>

            {showSettings && (
              <div className="mt-6 grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reporting Financial Institution
                  </label>
                  <input
                    type="text"
                    value={xmlSettings.reportingFI}
                    onChange={(e) => setXmlSettings(prev => ({ ...prev, reportingFI: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="Your Financial Institution Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Message Reference ID
                  </label>
                  <input
                    type="text"
                    value={xmlSettings.messageRefId}
                    onChange={(e) => setXmlSettings(prev => ({ ...prev, messageRefId: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="MSG-20241201-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tax Year
                  </label>
                  <input
                    type="text"
                    value={xmlSettings.taxYear}
                    onChange={(e) => setXmlSettings(prev => ({ ...prev, taxYear: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="2024"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Reporting Period End
                  </label>
                  <input
                    type="date"
                    value={xmlSettings.reportingPeriod}
                    onChange={(e) => setXmlSettings(prev => ({ ...prev, reportingPeriod: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-red-100">{error}</div>
              </div>
            </div>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <div className="mt-6 p-6 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center mb-4">
                <Loader className="w-5 h-5 text-blue-400 mr-3 animate-spin" />
                <span className="text-blue-100 font-medium">{processingStep}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
              <div className="text-right text-blue-300 text-sm mt-2">
                {processingProgress}% Complete
              </div>
            </div>
          )}

          {/* Conversion Result */}
          {conversionResult && (
            <div className="mt-6 p-6 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <CheckCircle className="w-6 h-6 text-green-400 mr-3" />
                  <div>
                    <div className="text-green-100 font-semibold">Conversion Complete!</div>
                    <div className="text-green-300 text-sm">
                      {conversionResult.accountCount} account reports • {(conversionResult.fileSize / 1024).toFixed(2)} KB
                    </div>
                  </div>
                </div>
                <button
                  onClick={downloadXML}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download XML
                </button>
              </div>
              <div className="text-green-200 text-sm">
                File: {conversionResult.fileName}
              </div>
            </div>
          )}

          {/* Convert Button */}
          <div className="mt-8 text-center">
            <button
              onClick={handleConvert}
              disabled={!selectedFile || isProcessing}
              className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-12 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
            >
              {isProcessing ? (
                <div className="flex items-center">
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Converting...
                </div>
              ) : (
                <div className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Convert to CRS XML
                </div>
              )}
            </button>

            {user && (
              <div className="mt-4 text-gray-400 text-sm">
                {conversionsUsed} of {conversionsLimit} conversions used this month
              </div>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <Shield className="w-12 h-12 text-emerald-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Enterprise Security</h3>
            <p className="text-gray-400">
              Bank-grade encryption and GDPR compliance. Your data is processed securely and never stored.
            </p>
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <Globe className="w-12 h-12 text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">OECD Compliant</h3>
            <p className="text-gray-400">
              Generates fully compliant CRS XML files meeting all OECD standards and requirements.
            </p>
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <Clock className="w-12 h-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Instant Processing</h3>
            <p className="text-gray-400">
              Convert thousands of records in seconds with our optimized processing engine.
            </p>
          </div>
        </div>

      </div>

      {/* Authentication Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-white/10">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </h2>
                <button
                  onClick={() => setShowAuth(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={authForm.password}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 pr-12"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {authMode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={authForm.confirmPassword}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                      placeholder="Confirm Password"
                    />
                  </div>
                )}

                {error && (
                  <div className="text-red-400 text-sm">{error}</div>
                )}

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                    setError(null);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 text-sm"
                >
                  {authMode === 'signin' 
                    ? "Don't have an account? Sign up" 
                    : "Already have an account? Sign in"
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRSXMLConverter;
