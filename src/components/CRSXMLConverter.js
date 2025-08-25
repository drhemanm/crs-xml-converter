import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Settings, 
  Shield, 
  X, 
  HelpCircle,
  Clock,
  Zap,
  Lock,
  Globe,
  ChevronRight,
  User,
  Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';

const CRSXMLConverter = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState(null);
  const [xmlOutput, setXmlOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(true);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [showHelp, setShowHelp] = useState({});
  const [accountStats, setAccountStats] = useState({ individual: 0, entity: 0 });
  const [settings, setSettings] = useState({
    transmittingCountry: 'MU',
    receivingCountry: 'MU',
    messageType: 'CRS',
    messageTypeIndic: 'CRS701',
    reportingPeriod: '2024-12-31'
  });
  const fileInputRef = useRef(null);

  // Check for existing cookie consent
  useEffect(() => {
    const consent = localStorage.getItem('iAfrica_cookieConsent');
    if (consent) {
      setShowCookieBanner(false);
    }
  }, []);

  // Auto-clear XML for privacy (10 minutes)
  useEffect(() => {
    if (xmlOutput) {
      const timer = setTimeout(() => {
        setXmlOutput('');
        setSuccess('✅ XML output cleared automatically for privacy protection');
      }, 600000); // 10 minutes

      return () => clearTimeout(timer);
    }
  }, [xmlOutput]);

  // Cookie consent handlers
  const acceptCookies = (type) => {
    const consent = {
      necessary: true,
      analytics: type === 'all',
      marketing: type === 'all',
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('iAfrica_cookieConsent', JSON.stringify(consent));
    setShowCookieBanner(false);
  };

  // Toggle help sections
  const toggleHelp = (section) => {
    setShowHelp(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Progress simulation during processing
  const simulateProgress = () => {
    setProcessingProgress(0);
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
    return interval;
  };

  // Generate unique IDs for XML elements
  const generateId = (prefix = '') => {
    const randomHex = Math.random().toString(16).substring(2, 34);
    return `${prefix}${randomHex}`;
  };

  // Format date to XML format
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (typeof dateValue === 'number') {
      // Excel date serial number
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else {
      return '';
    }
    
    return date.toISOString().split('T')[0];
  };

  // Parse country code from dropdown format
  const parseCountryCode = (countryString) => {
    if (!countryString) return '';
    const match = countryString.toString().match(/- ([A-Z]{2})/);
    return match ? match[1] : countryString;
  };

  // Parse currency code
  const parseCurrencyCode = (currencyString) => {
    if (!currencyString) return 'USD';
    const match = currencyString.toString().match(/- ([A-Z]{3})/);
    return match ? match[1] : 'USD';
  };

  // Convert amount to proper format
  const formatAmount = (amount) => {
    if (!amount || amount === 'null' || amount === '') return '0.00';
    const num = parseFloat(amount);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // Process business information
  const processBusinessInfo = (businessData) => {
    const businessInfo = {};
    businessData.forEach((row, index) => {
      if (row && row.length > 1 && row[0]) {
        const key = row[0].toString().toLowerCase().replace(/[^a-z]/g, '');
        businessInfo[key] = row[1];
      }
    });
    return businessInfo;
  };

  // Generate XML for Individual Account
  const generateIndividualAccountXML = (account, docRefId) => {
    const accountNumber = account[32] || 'Unknown';
    const undocumentedAccount = account[33] === 'UndocumentedAccount' ? 'true' : 'false';
    const accountNumberType = account[34] ? account[34].split(' - ')[0] : 'OECD605';
    const currencyCode = parseCurrencyCode(account[35]);
    const balance = formatAmount(account[36]);
    const paymentAmount = formatAmount(account[38]);
    
    return `      <AccountReport>
        <DocSpec>
          <stf:DocTypeIndic>OECD1</stf:DocTypeIndic>
          <stf:DocRefId>${docRefId}</stf:DocRefId>
        </DocSpec>
        <AccountNumber UndocumentedAccount="${undocumentedAccount}" AcctNumberType="${accountNumberType}">${accountNumber}</AccountNumber>
        <AccountHolder>
          <Individual>
            <ResCountryCode>${parseCountryCode(account[13])}</ResCountryCode>
            <TIN issuedBy="${parseCountryCode(account[15])}">${account[14] || 'N/A'}</TIN>
            <n>
              <FirstName>${account[2] || ''}</FirstName>
              <LastName>${account[3] || ''}</LastName>
            </n>
            <Address>
              <cfc:CountryCode>${parseCountryCode(account[12])}</cfc:CountryCode>
              <cfc:AddressFix>
                ${account[6] ? `<cfc:Street>${account[6]}</cfc:Street>` : ''}
                ${account[5] ? `<cfc:BuildingIdentifier>${account[5]}</cfc:BuildingIdentifier>` : ''}
                ${account[7] ? `<cfc:FloorIdentifier>${account[7]}</cfc:FloorIdentifier>` : ''}
                ${account[10] ? `<cfc:DistrictName>${account[10]}</cfc:DistrictName>` : ''}
                <cfc:City>${account[9] || 'Unknown'}</cfc:City>
                ${account[11] ? `<cfc:PostCode>${account[11]}</cfc:PostCode>` : ''}
              </cfc:AddressFix>
            </Address>
            <BirthInfo>
              <BirthDate>${formatDate(account[16])}</BirthDate>
              ${account[18] ? `<City>${account[18]}</City>` : ''}
              <CountryInfo>
                <CountryCode>${parseCountryCode(account[17])}</CountryCode>
              </CountryInfo>
            </BirthInfo>
          </Individual>
        </AccountHolder>
        <AccountBalance currCode="${currencyCode}">${balance}</AccountBalance>
        <Payment>
          <Type>CRS503</Type>
          <PaymentAmnt currCode="${currencyCode}">${paymentAmount}</PaymentAmnt>
        </Payment>
      </AccountReport>`;
  };

  // Generate XML for Entity Account
  const generateEntityAccountXML = (account, docRefId) => {
    const accountNumber = account[52] || 'Unknown';
    const undocumentedAccount = account[53] === 'UndocumentedAccount' ? 'true' : 'false';
    const accountNumberType = account[54] ? account[54].split(' - ')[0] : 'OECD605';
    const currencyCode = parseCurrencyCode(account[55]);
    const balance = formatAmount(account[56]);
    const paymentAmount = formatAmount(account[58]);
    
    return `      <AccountReport>
        <DocSpec>
          <stf:DocTypeIndic>OECD1</stf:DocTypeIndic>
          <stf:DocRefId>${docRefId}</stf:DocRefId>
        </DocSpec>
        <AccountNumber UndocumentedAccount="${undocumentedAccount}" AcctNumberType="${accountNumberType}">${accountNumber}</AccountNumber>
        <AccountHolder>
          <Organisation>
            <ResCountryCode>${parseCountryCode(account[12])}</ResCountryCode>
            <IN issuedBy="${parseCountryCode(account[14])}">${account[13] || 'N/A'}</IN>
            <n>${account[1] || 'Unknown Entity'}</n>
            <Address>
              <cfc:CountryCode>${parseCountryCode(account[11])}</cfc:CountryCode>
              <cfc:AddressFix>
                ${account[6] ? `<cfc:Street>${account[6]}</cfc:Street>` : ''}
                ${account[4] ? `<cfc:BuildingIdentifier>${account[4]}</cfc:BuildingIdentifier>` : ''}
                ${account[7] ? `<cfc:FloorIdentifier>${account[7]}</cfc:FloorIdentifier>` : ''}
                ${account[9] ? `<cfc:DistrictName>${account[9]}</cfc:DistrictName>` : ''}
                <cfc:City>${account[8] || 'Unknown'}</cfc:City>
                ${account[10] ? `<cfc:PostCode>${account[10]}</cfc:PostCode>` : ''}
              </cfc:AddressFix>
            </Address>
          </Organisation>
          <AcctHolderType>${account[19] ? account[19].split(' - ')[1] : 'CRS101'}</AcctHolderType>
        </AccountHolder>
        ${generateControllingPersonXML(account)}
        <AccountBalance currCode="${currencyCode}">${balance}</AccountBalance>
        <Payment>
          <Type>CRS503</Type>
          <PaymentAmnt currCode="${currencyCode}">${paymentAmount}</PaymentAmnt>
        </Payment>
      </AccountReport>`;
  };

  // Generate Controlling Person XML
  const generateControllingPersonXML = (account) => {
    if (!account[22] || !account[23]) return ''; // No controlling person data
    
    return `        <ControllingPerson>
          <Individual>
            <ResCountryCode>${parseCountryCode(account[33])}</ResCountryCode>
            <TIN issuedBy="${parseCountryCode(account[35])}">${account[34] || 'N/A'}</TIN>
            <Name nameType="${account[21] ? account[21].split(' - ')[0] : 'OECD202'}">
              <FirstName>${account[22] || ''}</FirstName>
              <LastName>${account[23] || ''}</LastName>
            </n>
            <Address legalAddressType="${account[24] ? account[24].split(' - ')[0] : 'OECD302'}">
              <cfc:CountryCode>${parseCountryCode(account[32])}</cfc:CountryCode>
              <cfc:AddressFix>
                ${account[26] ? `<cfc:Street>${account[26]}</cfc:Street>` : ''}
                ${account[25] ? `<cfc:BuildingIdentifier>${account[25]}</cfc:BuildingIdentifier>` : ''}
                ${account[27] ? `<cfc:FloorIdentifier>${account[27]}</cfc:FloorIdentifier>` : ''}
                ${account[30] ? `<cfc:DistrictName>${account[30]}</cfc:DistrictName>` : ''}
                <cfc:City>${account[29] || 'Unknown'}</cfc:City>
                ${account[31] ? `<cfc:PostCode>${account[31]}</cfc:PostCode>` : ''}
              </cfc:AddressFix>
            </Address>
            <BirthInfo>
              <BirthDate>${formatDate(account[36])}</BirthDate>
              <CountryInfo>
                <CountryCode>${parseCountryCode(account[37])}</CountryCode>
              </CountryInfo>
            </BirthInfo>
          </Individual>
          <CtrlgPersonType>${account[20] ? account[20].split(' - ')[1] : 'CRS801'}</CtrlgPersonType>
        </ControllingPerson>`;
  };

  // Main XML generation function
  const generateXML = async (workbook) => {
    try {
      // Process business information
      const businessSheet = workbook.Sheets['Business Information'];
      const businessData = XLSX.utils.sheet_to_json(businessSheet, { header: 1 });
      const businessInfo = processBusinessInfo(businessData);

      // Process individual accounts
      const individualSheet = workbook.Sheets['Individual Accounts'];
      const individualData = XLSX.utils.sheet_to_json(individualSheet, { header: 1 });
      const individualAccounts = individualData.filter(row => row && typeof row[0] === 'number');

      // Process entity accounts
      const entitySheet = workbook.Sheets['Entity Accounts'];
      const entityData = XLSX.utils.sheet_to_json(entitySheet, { header: 1 });
      const entityAccounts = entityData.filter(row => row && typeof row[0] === 'number');

      // Update stats
      setAccountStats({
        individual: individualAccounts.length,
        entity: entityAccounts.length
      });

      // Generate IDs
      const messageRefId = `${settings.transmittingCountry}${settings.reportingPeriod.split('-')[0]}${settings.receivingCountry}${generateId()}`;
      const reportingFIDocRefId = `${settings.transmittingCountry}${settings.reportingPeriod.split('-')[0]}${settings.receivingCountry}${generateId()}`;
      const timestamp = new Date().toISOString();

      // Start building XML
      let xml = `<?xml version="1.0" encoding="utf-8"?>
<CRS_OECD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:crs="urn:oecd:ties:crs:v2" xmlns:cfc="urn:oecd:ties:commontypesfatcacrs:v2" xmlns:stf="urn:oecd:ties:crsstf:v5" version="2.0" xmlns="urn:oecd:ties:crs:v2">
  <MessageSpec>
    <SendingCompanyIN>${businessInfo.tin || '11223344'}</SendingCompanyIN>
    <TransmittingCountry>${settings.transmittingCountry}</TransmittingCountry>
    <ReceivingCountry>${settings.receivingCountry}</ReceivingCountry>
    <MessageType>${settings.messageType}</MessageType>
    <MessageRefId>${messageRefId}</MessageRefId>
    <MessageTypeIndic>${settings.messageTypeIndic}</MessageTypeIndic>
    <ReportingPeriod>${settings.reportingPeriod}</ReportingPeriod>
    <Timestamp>${timestamp}</Timestamp>
  </MessageSpec>
  <CrsBody>
    <ReportingFI>
      <ResCountryCode>${parseCountryCode(businessInfo.countrycode) || 'MU'}</ResCountryCode>
      <IN issuedBy="${parseCountryCode(businessInfo.countrycode) || 'MU'}" INType="TIN">${businessInfo.tin || '11223344'}</IN>
      <n>${businessInfo.name || 'Unknown Financial Institution'}</n>
      <Address>
        <cfc:CountryCode>${parseCountryCode(businessInfo.countrycode) || 'MU'}</cfc:CountryCode>
        <cfc:AddressFix>
          ${businessInfo.streetname ? `<cfc:Street>${businessInfo.streetname}</cfc:Street>` : ''}
          ${businessInfo.building ? `<cfc:BuildingIdentifier>${businessInfo.building}</cfc:BuildingIdentifier>` : ''}
          ${businessInfo.floornumber ? `<cfc:FloorIdentifier>${businessInfo.floornumber}</cfc:FloorIdentifier>` : ''}
          ${businessInfo.stateprovinceregion ? `<cfc:DistrictName>${businessInfo.stateprovinceregion}</cfc:DistrictName>` : ''}
          <cfc:City>${businessInfo.city || 'Unknown'}</cfc:City>
        </cfc:AddressFix>
      </Address>
      <DocSpec>
        <stf:DocTypeIndic>OECD1</stf:DocTypeIndic>
        <stf:DocRefId>${reportingFIDocRefId}</stf:DocRefId>
      </DocSpec>
    </ReportingFI>
    <ReportingGroup>`;

      // Add individual accounts
      individualAccounts.forEach(account => {
        const docRefId = `${settings.transmittingCountry}${settings.reportingPeriod.split('-')[0]}${settings.receivingCountry}${generateId()}`;
        xml += generateIndividualAccountXML(account, docRefId);
      });

      // Add entity accounts
      entityAccounts.forEach(account => {
        const docRefId = `${settings.transmittingCountry}${settings.reportingPeriod.split('-')[0]}${settings.receivingCountry}${generateId()}`;
        xml += generateEntityAccountXML(account, docRefId);
      });

      xml += `
    </ReportingGroup>
  </CrsBody>
</CRS_OECD>`;

      return xml;

    } catch (error) {
      throw new Error(`XML Generation Error: ${error.message}`);
    }
  };

  // Handle file upload with GDPR consent check
  const handleFileUpload = (event) => {
    if (!gdprConsent) {
      setError('Please confirm GDPR consent before uploading files containing personal data');
      return;
    }

    const uploadedFile = event.target.files[0];
    if (uploadedFile) {
      const fileName = uploadedFile.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        setFile(uploadedFile);
        setError('');
        setSuccess(`✅ File uploaded successfully! Click "Analyze File" to preview the data.`);
        setCurrentStep(3);
      } else {
        setError('Please upload a supported file format: Excel (.xlsx, .xls) or CSV (.csv)');
        setSuccess('');
      }
    }
  };

  // Analyze uploaded file
  const analyzeFile = async () => {
    if (!file) return;

    try {
      const fileBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { cellStyles: true });

      // Check sheets
      const requiredSheets = ['Business Information', 'Individual Accounts', 'Entity Accounts'];
      const availableSheets = workbook.SheetNames;
      const missingSheets = requiredSheets.filter(sheet => !availableSheets.includes(sheet));
      
      if (missingSheets.length > 0) {
        setError(`Missing required sheets: ${missingSheets.join(', ')}`);
        return;
      }

      // Quick preview of data
      const individualData = XLSX.utils.sheet_to_json(workbook.Sheets['Individual Accounts'], { header: 1 });
      const entityData = XLSX.utils.sheet_to_json(workbook.Sheets['Entity Accounts'], { header: 1 });
      
      const individualCount = individualData.filter(row => row && typeof row[0] === 'number').length;
      const entityCount = entityData.filter(row => row && typeof row[0] === 'number').length;

      setAccountStats({ individual: individualCount, entity: entityCount });
      setSuccess(`✅ File analysis complete! Found ${individualCount} individual accounts and ${entityCount} entity accounts.`);
      setCurrentStep(4);

    } catch (error) {
      setError(`File analysis error: ${error.message}`);
    }
  };

  // Process file and generate XML
  const processFile = async () => {
    if (!file || !gdprConsent) {
      setError('Please upload a file and confirm GDPR consent');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');
    const progressInterval = simulateProgress();

    try {
      const fileBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, {
        cellStyles: true,
        cellFormulas: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true
      });

      const xml = await generateXML(workbook);
      
      // Complete progress
      setProcessingProgress(100);
      setTimeout(() => {
        setXmlOutput(xml);
        setSuccess('🎉 XML generated successfully! File will auto-clear in 10 minutes for privacy.');
        setCurrentStep(5);
        
        // Clear file from memory for privacy
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 500);

    } catch (error) {
      clearInterval(progressInterval);
      setError(error.message);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(0);
      }, 1000);
    }
  };

  // Download XML
  const downloadXML = () => {
    if (!xmlOutput) return;

    const timestamp = new Date().toISOString().split('T')[0];
    const businessName = xmlOutput.match(/<n>(.*?)<\/Name>/)?.[1] || 'CRS_Report';
    const cleanBusinessName = businessName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${cleanBusinessName}_CRS_OECD_${timestamp}.xml`;

    const blob = new Blob([xmlOutput], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setSuccess(`✅ XML file downloaded: ${filename}`);
  };

  // Reset process
  const resetProcess = () => {
    setFile(null);
    setXmlOutput('');
    setError('');
    setSuccess('');
    setCurrentStep(1);
    setAccountStats({ individual: 0, entity: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Step indicator component
  const StepIndicator = () => {
    const steps = [
      { num: 1, title: 'Setup', desc: 'Configure settings' },
      { num: 2, title: 'Privacy', desc: 'GDPR consent' },
      { num: 3, title: 'Upload', desc: 'Select file' },
      { num: 4, title: 'Analyze', desc: 'Preview data' },
      { num: 5, title: 'Convert', desc: 'Generate XML' }
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.num} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= step.num 
                  ? 'bg-blue-600 border-blue-600 text-white' 
                  : 'border-gray-300 text-gray-500'
              }`}>
                {currentStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.num}
              </div>
              <div className="ml-3">
                <div className={`text-sm font-medium ${
                  currentStep >= step.num ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </div>
                <div className="text-xs text-gray-400">{step.desc}</div>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-400 mx-4" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Cookie Consent Banner */}
      {showCookieBanner && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50 shadow-lg">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm">
                🍪 We use necessary cookies for optimal performance. 
                <button 
                  onClick={() => setShowPrivacyPolicy(true)}
                  className="underline ml-1 hover:text-blue-300"
                >
                  View Privacy Policy
                </button>
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => acceptCookies('necessary')}
                className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm"
              >
                Essential Only
              </button>
              <button 
                onClick={() => acceptCookies('all')}
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 text-sm"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Simple text-based logo - easy to replace */}
            <div className="flex items-center">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-red-500 bg-clip-text text-transparent">
                iAfrica
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CRS XML Converter</h1>
              <p className="text-sm text-gray-600">by Intelligent Africa Solutions</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              <Shield className="w-4 h-4" />
              <span>GDPR Compliant</span>
            </div>
            <button 
              onClick={() => setShowPrivacyPolicy(true)}
              className="text-gray-600 hover:text-gray-800"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Professional CRS OECD XML Converter
            </h2>
            <p className="text-gray-600 text-lg">
              Convert Excel/CSV financial data to compliant CRS OECD XML format
            </p>
            <div className="flex items-center justify-center space-x-6 mt-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Zap className="w-4 h-4 text-green-600" />
                <span>Instant Processing</span>
              </div>
              <div className="flex items-center space-x-1">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>Privacy-First</span>
              </div>
              <div className="flex items-center space-x-1">
                <Globe className="w-4 h-4 text-purple-600" />
                <span>OECD Compliant</span>
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <StepIndicator />

          {/* Privacy Features */}
          <div className="mb-8 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
            <div className="flex items-center mb-3">
              <Shield className="w-5 h-5 text-green-600 mr-2" />
              <h3 className="font-medium text-green-800">🔒 Enterprise-Grade Privacy Protection</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-green-700">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Client-Side Processing</div>
                  <div>Files never leave your browser</div>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Auto-Deletion</div>
                  <div>Data cleared after 10 minutes</div>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">GDPR Compliant</div>
                  <div>Built for European standards</div>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Section - Step 1 */}
          {currentStep >= 1 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">1</div>
                  <h3 className="text-lg font-semibold text-gray-800">XML Configuration Settings</h3>
                </div>
                <button 
                  onClick={() => toggleHelp('settings')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>

              {showHelp.settings && (
                <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm text-blue-700">
                  <p><strong>Transmitting Country:</strong> The country sending the CRS data</p>
                  <p><strong>Receiving Country:</strong> The country receiving the CRS data</p>
                  <p><strong>Reporting Period:</strong> The tax year being reported</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transmitting Country
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={settings.transmittingCountry}
                    onChange={(e) => setSettings({...settings, transmittingCountry: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., MU"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receiving Country
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={settings.receivingCountry}
                    onChange={(e) => setSettings({...settings, receivingCountry: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., MU"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reporting Period
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="date"
                    value={settings.reportingPeriod}
                    onChange={(e) => setSettings({...settings, reportingPeriod: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {currentStep === 1 && (
                <div className="mt-4 text-center">
                  <button 
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center mx-auto"
                  >
                    Next: Privacy Consent
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* GDPR Consent Section - Step 2 */}
          {currentStep >= 2 && (
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</div>
                <h3 className="text-lg font-semibold text-gray-800">Data Processing Consent (GDPR)</h3>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-2">Important Privacy Notice</h4>
                    <p className="text-sm text-yellow-700 mb-3">
                      Your file contains sensitive personal financial data. Before proceeding:
                    </p>
                    <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside mb-4">
                      <li>Confirm you have legal authority to process this data</li>
                      <li>All processing happens locally in your browser (client-side)</li>
                      <li>Files are never uploaded to servers or stored</li>
                      <li>Data is automatically deleted after conversion</li>
                    </ul>
                    <label className="flex items-start">
                      <input 
                        type="checkbox" 
                        checked={gdprConsent}
                        onChange={(e) => setGdprConsent(e.target.checked)}
                        className="mr-3 mt-1"
                      />
                      <span className="text-sm text-yellow-800">
                        <strong>I confirm</strong> that I have the legal right to process this data under GDPR Article 6(1)(a) 
                        and consent to client-side processing for XML conversion purposes only.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {currentStep === 2 && (
                <div className="mt-4 text-center">
                  <button 
                    onClick={() => setCurrentStep(3)}
                    disabled={!gdprConsent}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center mx-auto"
                  >
                    Next: Upload File
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* File Upload Section - Step 3 */}
          {currentStep >= 3 && (
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">3</div>
                <h3 className="text-lg font-semibold text-gray-800">Upload Your CRS Data File</h3>
              </div>

              <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                gdprConsent && !file ? 'border-blue-300 hover:border-blue-400 bg-blue-50' : 
                file ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'
              }`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  id="file-upload"
                  disabled={!gdprConsent}
                />
                
                <div className="space-y-4">
                  {file ? (
                    <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />
                  ) : (
                    <Upload className="w-16 h-16 mx-auto text-gray-400" />
                  )}
                  
                  <div>
                    <label htmlFor="file-upload" className={`cursor-pointer ${!gdprConsent ? 'opacity-50' : ''}`}>
                      <div className="text-xl font-medium text-gray-700">
                        {file ? file.name : 'Drop your Excel/CSV file here or click to browse'}
                      </div>
                      <div className="text-gray-500 mt-2">
                        {file ? 
                          `${(file.size / 1024).toFixed(1)} KB • ${file.name.split('.').pop().toUpperCase()}` :
                          'Supports .xlsx, .xls, and .csv formats'
                        }
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-center space-x-3">
                    <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">.XLSX</span>
                    <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">.XLS</span>
                    <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">.CSV</span>
                  </div>

                  {!gdprConsent && (
                    <p className="text-red-600 text-sm">Please confirm GDPR consent above to upload files</p>
                  )}
                </div>
              </div>

              {file && currentStep === 3 && (
                <div className="mt-4 text-center space-x-3">
                  <button 
                    onClick={analyzeFile}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center mx-auto"
                  >
                    Analyze File
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* File Analysis - Step 4 */}
          {currentStep >= 4 && accountStats.individual + accountStats.entity > 0 && (
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">4</div>
                <h3 className="text-lg font-semibold text-gray-800">File Analysis Results</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <User className="w-8 h-8 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{accountStats.individual}</div>
                      <div className="text-sm text-blue-700">Individual Accounts</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Building2 className="w-8 h-8 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-600">{accountStats.entity}</div>
                      <div className="text-sm text-green-700">Entity Accounts</div>
                    </div>
                  </div>
                </div>
              </div>

              {currentStep === 4 && (
                <div className="mt-4 text-center">
                  <button 
                    onClick={processFile}
                    disabled={!file || !gdprConsent || isProcessing}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center mx-auto text-lg font-medium"
                  >
                    {isProcessing ? 'Converting to XML...' : 'Convert to CRS XML'}
                    {!isProcessing && <Zap className="w-5 h-5 ml-2" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Clock className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="font-medium text-blue-800">Processing your CRS data...</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
              <div className="text-sm text-blue-600 mt-2">{Math.round(processingProgress)}% complete</div>
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
              <div>
                <h3 className="text-red-800 font-medium">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
              <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
              <div>
                <h3 className="text-green-800 font-medium">Success</h3>
                <p className="text-green-700">{success}</p>
              </div>
            </div>
          )}

          {/* XML Output - Step 5 */}
          {xmlOutput && currentStep >= 5 && (
            <div className="mt-8">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">✓</div>
                <h3 className="text-lg font-semibold text-gray-800">CRS XML Generated Successfully!</h3>
              </div>

              {/* Download Summary */}
              <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-green-800">🎉 Your CRS OECD XML is Ready!</h3>
                    <p className="text-green-700">File is ready for download and regulatory submission</p>
                  </div>
                  <button
                    onClick={downloadXML}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center font-medium shadow-lg transform hover:scale-105 transition-transform"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download XML File
                  </button>
                </div>
                
                {/* File Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-white p-3 rounded border">
                    <div className="font-medium text-gray-700">File Size</div>
                    <div className="text-green-600 font-semibold">{(new Blob([xmlOutput]).size / 1024).toFixed(1)} KB</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="font-medium text-gray-700">Format</div>
                    <div className="text-blue-600 font-semibold">CRS OECD XML v2.0</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="font-medium text-gray-700">Individual Accounts</div>
                    <div className="text-purple-600 font-semibold">{accountStats.individual}</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="font-medium text-gray-700">Entity Accounts</div>
                    <div className="text-orange-600 font-semibold">{accountStats.entity}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-center mb-6">
                <button
                  onClick={downloadXML}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </button>
                
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(xmlOutput);
                    setSuccess('✅ XML copied to clipboard!');
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                >
                  📋 Copy to Clipboard
                </button>
                
                <button
                  onClick={resetProcess}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Convert Another File
                </button>
              </div>

              {/* XML Preview */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">XML Preview</h4>
                <div className="bg-gray-900 rounded-lg p-4 max-h-80 overflow-auto">
                  <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                    {xmlOutput}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6">
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
                <button 
                  onClick={() => setShowPrivacyPolicy(true)}
                  className="hover:text-white underline"
                >
                  Privacy Policy
                </button>
                <span>•</span>
                <span className="flex items-center">
                  GDPR Compliant
                  <Shield className="w-4 h-4 text-green-400 ml-1" />
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-700 text-center text-sm text-gray-400">
            <p>© 2024 Intelligent Africa Solutions Ltd. All rights reserved. | Professional CRS OECD XML Converter</p>
          </div>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Privacy Policy</h2>
                <button 
                  onClick={() => setShowPrivacyPolicy(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="text-sm text-gray-700 space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Data We Process</h3>
                  <p>We process financial data uploaded by you for CRS XML conversion purposes only. This includes personal names, addresses, tax identification numbers, and financial account information.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">How We Process Data</h3>
                  <p>All processing happens entirely in your browser (client-side). Files are never uploaded to our servers. Data is automatically deleted after processing completion.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Your Rights</h3>
                  <p>Under GDPR, you have rights to access, rectification, erasure, and portability of your data. Since we don't store your data, these rights are automatically fulfilled through our privacy-by-design approach.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Contact</h3>
                  <p>For privacy questions, contact: privacy@intelligentafrica.com</p>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <p className="text-green-800 text-sm">✅ This service is GDPR compliant by design with client-side processing and automatic data deletion.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRSXMLConverter;
