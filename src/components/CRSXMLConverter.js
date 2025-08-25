import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';

const CRSXMLConverter = () => {
  const [file, setFile] = useState(null);
  const [xmlOutput, setXmlOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState({
    transmittingCountry: 'MU',
    receivingCountry: 'MU',
    messageType: 'CRS',
    messageTypeIndic: 'CRS701',
    reportingPeriod: '2024-12-31'
  });
  const fileInputRef = useRef(null);

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
            <Name>
              <FirstName>${account[2] || ''}</FirstName>
              <LastName>${account[3] || ''}</LastName>
            </Name>
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
            <Name>${account[1] || 'Unknown Entity'}</Name>
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
            </Name>
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
      <Name>${businessInfo.name || 'Unknown Financial Institution'}</Name>
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

  // Handle file upload
  const handleFileUpload = (event) => {
    const uploadedFile = event.target.files[0];
    if (uploadedFile) {
      const fileName = uploadedFile.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        setFile(uploadedFile);
        setError('');
        setSuccess(`✅ ${uploadedFile.name} uploaded successfully! Ready to convert to XML.`);
      } else {
        setError('Please upload a supported file format: Excel (.xlsx, .xls) or CSV (.csv)');
        setSuccess('');
      }
    }
  };

  // Process file and generate XML
  const processFile = async () => {
    if (!file) {
      setError('Please upload a file first');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const fileBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, {
        cellStyles: true,
        cellFormulas: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true
      });

      // Check if required sheets exist
      const requiredSheets = ['Business Information', 'Individual Accounts', 'Entity Accounts'];
      const missingSheets = requiredSheets.filter(sheet => !workbook.SheetNames.includes(sheet));
      
      if (missingSheets.length > 0) {
        throw new Error(`Missing required sheets: ${missingSheets.join(', ')}`);
      }

      const xml = await generateXML(workbook);
      setXmlOutput(xml);
      setSuccess('XML generated successfully!');

    } catch (error) {
      setError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download XML
  const downloadXML = () => {
    if (!xmlOutput) return;

    // Create filename with timestamp and business info
    const timestamp = new Date().toISOString().split('T')[0];
    const businessName = xmlOutput.match(/<Name>(.*?)<\/Name>/)?.[1] || 'CRS_Report';
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
    
    setSuccess(`✅ XML file downloaded successfully as: ${filename}`);
  };

  // Clear all data
  const clearData = () => {
    setFile(null);
    setXmlOutput('');
    setError('');
    setSuccess('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CRS OECD XML Converter</h1>
          <p className="text-gray-600">Convert Excel/CSV data to CRS OECD XML format</p>
        </div>

        {/* Settings Section */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center mb-4">
            <Settings className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-800">XML Configuration</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transmitting Country</label>
              <input
                type="text"
                value={settings.transmittingCountry}
                onChange={(e) => setSettings({...settings, transmittingCountry: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receiving Country</label>
              <input
                type="text"
                value={settings.receivingCountry}
                onChange={(e) => setSettings({...settings, receivingCountry: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Period</label>
              <input
                type="date"
                value={settings.reportingPeriod}
                onChange={(e) => setSettings({...settings, reportingPeriod: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <FileText className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-800">Upload Excel/CSV File</h2>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-lg font-medium text-gray-700">
                {file ? file.name : 'Upload your Excel or CSV file'}
              </span>
              <div className="mt-2">
                <p className="text-gray-500">Supported formats:</p>
                <div className="flex justify-center gap-4 mt-2">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">.XLSX</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">.XLS</span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">.CSV</span>
                </div>
              </div>
            </label>
          </div>
          
          {/* File Details */}
          {file && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-green-600 mr-2" />
                  <div>
                    <p className="font-medium text-green-800">{file.name}</p>
                    <p className="text-sm text-green-600">
                      Size: {(file.size / 1024).toFixed(1)} KB | 
                      Type: {file.name.split('.').pop().toUpperCase()} |
                      Ready for XML conversion
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setSuccess('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mb-8 flex flex-wrap gap-4 justify-center">
          <button
            onClick={processFile}
            disabled={!file || isProcessing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
          >
            {isProcessing ? 'Processing Excel/CSV...' : 'Convert to CRS XML'}
          </button>
          
          {xmlOutput && (
            <div className="flex gap-3">
              <button
                onClick={downloadXML}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center font-medium shadow-lg"
              >
                <Download className="w-5 h-5 mr-2" />
                Download CRS XML File
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(xmlOutput);
                  setSuccess('✅ XML copied to clipboard!');
                }}
                className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center"
              >
                📋 Copy XML
              </button>
            </div>
          )}
          
          <button
            onClick={clearData}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Clear All
          </button>
        </div>

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

        {/* XML Output Preview */}
        {xmlOutput && (
          <div className="mt-8">
            {/* Download Summary Box */}
            <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-green-800">✅ CRS OECD XML Generated Successfully!</h3>
                  <p className="text-green-700">Your file is ready for download and submission</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={downloadXML}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center font-medium shadow-lg transform hover:scale-105 transition-transform"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download XML File
                  </button>
                </div>
              </div>
              
              {/* File Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white p-3 rounded border">
                  <div className="font-medium text-gray-700">File Size</div>
                  <div className="text-green-600 font-semibold">{(new Blob([xmlOutput]).size / 1024).toFixed(1)} KB</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="font-medium text-gray-700">Format</div>
                  <div className="text-blue-600 font-semibold">CRS OECD XML v2.0</div>
                </div>
                <div className="bg-white p-3 rounded border">
                  <div className="font-medium text-gray-700">Account Reports</div>
                  <div className="text-purple-600 font-semibold">
                    {(xmlOutput.match(/<AccountReport>/g) || []).length} Records
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-800 mb-4">Generated XML Preview</h2>
            <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {xmlOutput}
              </pre>
            </div>
            
            {/* Additional Download Options */}
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              <button
                onClick={downloadXML}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Main File
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(xmlOutput);
                  setSuccess('✅ Complete XML copied to clipboard!');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
              >
                📋 Copy to Clipboard
              </button>
              
              <button
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`<pre>${xmlOutput}</pre>`);
                  printWindow.document.close();
                  printWindow.print();
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center"
              >
                🖨️ Print XML
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Use:</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Configure the XML settings above (countries, reporting period)</li>
            <li><strong>Upload your Excel file (.xlsx/.xls)</strong> or CSV file with the required sheets: "Business Information", "Individual Accounts", "Entity Accounts"</li>
            <li>Click "Convert to CRS XML" to generate your XML file</li>
            <li><strong>Download the CRS OECD XML file</strong> - ready for submission!</li>
          </ol>
          
          <div className="mt-4 grid md:grid-cols-3 gap-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <h4 className="font-medium text-green-800 mb-2">✅ Excel Support (.xlsx/.xls)</h4>
              <p className="text-sm text-green-700">
                Reads multi-sheet Excel files with advanced formatting, formulas, and data validation. 
                Perfect for your CRS template files.
              </p>
            </div>
            
            <div className="p-3 bg-blue-100 rounded">
              <h4 className="font-medium text-blue-800 mb-2">📋 Required Sheet Structure</h4>
              <p className="text-sm text-blue-700">
                <strong>Business Information:</strong> FI details<br/>
                <strong>Individual Accounts:</strong> Personal accounts<br/>
                <strong>Entity Accounts:</strong> Corporate accounts + controlling persons
              </p>
            </div>
            
            <div className="p-3 bg-purple-50 border border-purple-200 rounded">
              <h4 className="font-medium text-purple-800 mb-2">📥 Download Options</h4>
              <p className="text-sm text-purple-700">
                <strong>• XML File:</strong> Smart naming with date<br/>
                <strong>• Copy/Clipboard:</strong> Quick access<br/>
                <strong>• Print:</strong> Physical records<br/>
                <strong>• File Stats:</strong> Size & validation
              </p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>💡 Pro Tip:</strong> The converter automatically handles Excel date formats, dropdown values 
              ("United Arab Emirates - AE"), currency codes, and generates proper OECD-compliant XML with unique IDs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRSXMLConverter;
