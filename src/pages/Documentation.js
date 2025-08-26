import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Book, FileText, Upload, Download, CheckCircle, AlertTriangle, Info, ArrowLeft, Home, Play, FileSpreadsheet, Settings, HelpCircle, Mail } from 'lucide-react';

const Documentation = () => {
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    { id: 'getting-started', title: 'Getting Started', icon: Play },
    { id: 'file-formats', title: 'File Formats', icon: FileSpreadsheet },
    { id: 'conversion-process', title: 'Conversion Process', icon: Settings },
    { id: 'troubleshooting', title: 'Troubleshooting', icon: HelpCircle },
    { id: 'api-reference', title: 'API Reference', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-16">
        
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors duration-200 backdrop-blur-sm border border-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Main Page
          </Link>
        </div>
        
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Book className="w-12 h-12 text-emerald-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">Documentation</h1>
          </div>
          <p className="text-xl text-gray-300">
            Complete guide to using the iAfrica CRS XML Converter
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          
          <div className="md:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-white mb-4">Contents</h3>
              <nav className="space-y-2">
                {sections.map((section) => {
                  const IconComponent = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center ${
                        activeSection === section.id
                          ? 'bg-emerald-600 text-white'
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <IconComponent className="w-4 h-4 mr-2" />
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
              
              {activeSection === 'getting-started' && (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center mb-4">
                      <Play className="w-6 h-6 text-emerald-400 mr-3" />
                      <h2 className="text-3xl font-bold text-white">Getting Started</h2>
                    </div>
                    <p className="text-gray-300 text-lg">
                      Welcome to the iAfrica CRS XML Converter! This guide will help you get started with converting your financial data to CRS OECD XML format.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">What is CRS?</h3>
                    <p className="text-gray-300 mb-4">
                      The Common Reporting Standard (CRS) is a global standard for the automatic exchange of financial account information between tax authorities. It was developed by the OECD to combat tax evasion and ensure tax transparency.
                    </p>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                      <div className="flex items-start">
                        <Info className="w-5 h-5 text-emerald-400 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-emerald-100">
                          <p className="font-medium">Key Benefits:</p>
                          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                            <li>Automated compliance reporting</li>
                            <li>Standardized XML format</li>
                            <li>Reduced manual errors</li>
                            <li>Time-saving bulk conversions</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Quick Start Guide</h3>
                    <div className="space-y-4">
                      <div className="flex items-start">
                        <div className="bg-emerald-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 mt-1">1</div>
                        <div>
                          <h4 className="font-semibold text-white">Prepare Your Data</h4>
                          <p className="text-gray-300">Ensure your data is in Excel (.xlsx) or CSV format with proper CRS fields.</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="bg-emerald-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 mt-1">2</div>
                        <div>
                          <h4 className="font-semibold text-white">Upload Your File</h4>
                          <p className="text-gray-300">Click "Choose File" and select your prepared data file.</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="bg-emerald-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 mt-1">3</div>
                        <div>
                          <h4 className="font-semibold text-white">Convert & Download</h4>
                          <p className="text-gray-300">Click "Convert to XML" and download your compliant CRS XML file.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Service Plans</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h4 className="font-semibold text-white mb-2">Free Plan</h4>
                        <p className="text-2xl font-bold text-emerald-400 mb-2">$0</p>
                        <ul className="text-sm text-gray-300 space-y-1">
                          <li>• 6 total conversions</li>
                          <li>• Basic XML generation</li>
                          <li>• Email support</li>
                        </ul>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-emerald-500/50">
                        <h4 className="font-semibold text-white mb-2">Professional</h4>
                        <p className="text-2xl font-bold text-emerald-400 mb-2">$79/month</p>
                        <ul className="text-sm text-gray-300 space-y-1">
                          <li>• 100 conversions/month</li>
                          <li>• Priority support</li>
                          <li>• Analytics dashboard</li>
                        </ul>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h4 className="font-semibold text-white mb-2">Enterprise</h4>
                        <p className="text-2xl font-bold text-emerald-400 mb-2">$299/month</p>
                        <ul className="text-sm text-gray-300 space-y-1">
                          <li>• 1,000 conversions/month</li>
                          <li>• Dedicated support</li>
                          <li>• Custom integrations</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'file-formats' && (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center mb-4">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-400 mr-3" />
                      <h2 className="text-3xl font-bold text-white">File Formats</h2>
                    </div>
                    <p className="text-gray-300 text-lg">
                      Understand the supported input formats and required data structure for successful CRS XML conversion.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Supported Input Formats</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                        <div className="flex items-center mb-3">
                          <FileSpreadsheet className="w-5 h-5 text-emerald-400 mr-2" />
                          <h4 className="font-semibold text-white">Excel Files (.xlsx)</h4>
                        </div>
                        <ul className="text-gray-300 space-y-2 text-sm">
                          <li>• Microsoft Excel 2007 or later</li>
                          <li>• Data should be in the first worksheet</li>
                          <li>• Headers in the first row</li>
                          <li>• Maximum file size: 10 MB</li>
                          <li>• Up to 10,000 rows supported</li>
                        </ul>
                      </div>
                      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                        <div className="flex items-center mb-3">
                          <FileText className="w-5 h-5 text-emerald-400 mr-2" />
                          <h4 className="font-semibold text-white">CSV Files (.csv)</h4>
                        </div>
                        <ul className="text-gray-300 space-y-2 text-sm">
                          <li>• UTF-8 encoding required</li>
                          <li>• Comma-separated values</li>
                          <li>• Headers in the first row</li>
                          <li>• Text fields in quotes if needed</li>
                          <li>• Maximum file size: 5 MB</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Required Data Fields</h3>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
                      <div className="flex items-start">
                        <AlertTriangle className="w-5 h-5 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-amber-100">
                          <p className="font-medium">Important:</p>
                          <p className="text-sm mt-1">All required fields must be present in your data. Missing fields will cause conversion errors.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-white/20">
                            <th className="text-left py-3 px-4 text-white font-semibold">Field Name</th>
                            <th className="text-left py-3 px-4 text-white font-semibold">Required</th>
                            <th className="text-left py-3 px-4 text-white font-semibold">Description</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-300">
                          <tr className="border-b border-white/10">
                            <td className="py-3 px-4 font-mono text-sm">account_number</td>
                            <td className="py-3 px-4"><span className="text-red-400">Yes</span></td>
                            <td className="py-3 px-4">Unique account identifier</td>
                          </tr>
                          <tr className="border-b border-white/10">
                            <td className="py-3 px-4 font-mono text-sm">account_holder_name</td>
                            <td className="py-3 px-4"><span className="text-red-400">Yes</span></td>
                            <td className="py-3 px-4">Full name of account holder</td>
                          </tr>
                          <tr className="border-b border-white/10">
                            <td className="py-3 px-4 font-mono text-sm">account_balance</td>
                            <td className="py-3 px-4"><span className="text-red-400">Yes</span></td>
                            <td className="py-3 px-4">Account balance in reporting currency</td>
                          </tr>
                          <tr className="border-b border-white/10">
                            <td className="py-3 px-4 font-mono text-sm">currency_code</td>
                            <td className="py-3 px-4"><span className="text-red-400">Yes</span></td>
                            <td className="py-3 px-4">3-letter ISO currency code (e.g., USD, EUR)</td>
                          </tr>
                          <tr className="border-b border-white/10">
                            <td className="py-3 px-4 font-mono text-sm">tax_identification_number</td>
                            <td className="py-3 px-4"><span className="text-emerald-400">Optional</span></td>
                            <td className="py-3 px-4">Tax ID number if available</td>
                          </tr>
                          <tr className="border-b border-white/10">
                            <td className="py-3 px-4 font-mono text-sm">birth_date</td>
                            <td className="py-3 px-4"><span className="text-emerald-400">Optional</span></td>
                            <td className="py-3 px-4">Date of birth (YYYY-MM-DD format)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Sample Data Structure</h3>
                    <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-emerald-400 text-sm">
{`account_number,account_holder_name,account_balance,currency_code,tax_identification_number
12345678,John Smith,150000.00,USD,123-45-6789
87654321,Jane Doe,75000.50,EUR,987-65-4321
11223344,Bob Johnson,200000.00,GBP,111-22-3333`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'conversion-process' && (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center mb-4">
                      <Settings className="w-6 h-6 text-emerald-400 mr-3" />
                      <h2 className="text-3xl font-bold text-white">Conversion Process</h2>
                    </div>
                    <p className="text-gray-300 text-lg">
                      Step-by-step guide to converting your financial data to CRS OECD XML format.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-6">Detailed Conversion Steps</h3>
                    <div className="space-y-8">
                      
                      <div className="relative">
                        <div className="flex items-start">
                          <div className="bg-emerald-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mr-6 mt-2">1</div>
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-white mb-3">Data Preparation</h4>
                            <div className="bg-white/5 rounded-lg p-4 mb-4">
                              <ul className="text-gray-300 space-y-2">
                                <li>• Ensure all required fields are present</li>
                                <li>• Verify data formats (dates, currencies, numbers)</li>
                                <li>• Remove any empty rows or columns</li>
                                <li>• Check for special characters that might cause issues</li>
                              </ul>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                              <p className="text-emerald-100 text-sm">
                                <strong>Tip:</strong> Download our sample template to ensure your data is structured correctly.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex items-start">
                          <div className="bg-emerald-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mr-6 mt-2">2</div>
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-white mb-3">File Upload</h4>
                            <div className="bg-white/5 rounded-lg p-4 mb-4">
                              <ul className="text-gray-300 space-y-2">
                                <li>• Click the "Choose File" button</li>
                                <li>• Select your prepared .xlsx or .csv file</li>
                                <li>• Wait for the upload progress to complete</li>
                                <li>• Verify the file name appears correctly</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex items-start">
                          <div className="bg-emerald-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mr-6 mt-2">3</div>
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-white mb-3">Validation & Processing</h4>
                            <div className="bg-white/5 rounded-lg p-4 mb-4">
                              <ul className="text-gray-300 space-y-2">
                                <li>• System validates data structure and required fields</li>
                                <li>• Data is processed and mapped to CRS XML schema</li>
                                <li>• Automatic validation against OECD standards</li>
                                <li>• Error checking and data integrity verification</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex items-start">
                          <div className="bg-emerald-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mr-6 mt-2">4</div>
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-white mb-3">XML Generation</h4>
                            <div className="bg-white/5 rounded-lg p-4 mb-4">
                              <ul className="text-gray-300 space-y-2">
                                <li>• Compliant CRS XML file is generated</li>
                                <li>• Proper XML schema and namespaces applied</li>
                                <li>• Digital signatures and validation included</li>
                                <li>• File ready for submission to tax authorities</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex items-start">
                          <div className="bg-emerald-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold mr-6 mt-2">5</div>
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-white mb-3">Download & Submit</h4>
                            <div className="bg-white/5 rounded-lg p-4 mb-4">
                              <ul className="text-gray-300 space-y-2">
                                <li>• Download your compliant XML file</li>
                                <li>• Verify the XML structure if needed</li>
                                <li>• Submit to relevant tax authorities</li>
                                <li>• Keep a copy for your records</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Processing Times</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h4 className="font-semibold text-white mb-2">Small Files</h4>
                        <p className="text-emerald-400 text-2xl font-bold mb-2">&lt; 1 min</p>
                        <p className="text-gray-300 text-sm">Up to 1,000 records</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h4 className="font-semibold text-white mb-2">Medium Files</h4>
                        <p className="text-emerald-400 text-2xl font-bold mb-2">2-5 min</p>
                        <p className="text-gray-300 text-sm">1,000 - 5,000 records</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h4 className="font-semibold text-white mb-2">Large Files</h4>
                        <p className="text-emerald-400 text-2xl font-bold mb-2">5-10 min</p>
                        <p className="text-gray-300 text-sm">5,000+ records</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'troubleshooting' && (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center mb-4">
                      <HelpCircle className="w-6 h-6 text-emerald-400 mr-3" />
                      <h2 className="text-3xl font-bold text-white">Troubleshooting</h2>
                    </div>
                    <p className="text-gray-300 text-lg">
                      Common issues and solutions for CRS XML conversion problems.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Common Error Messages</h3>
                    <div className="space-y-6">
                      
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <div className="flex items-start mb-3">
                          <AlertTriangle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                          <h4 className="font-semibold text-red-100">Missing required field: account_number</h4>
                        </div>
                        <p className="text-gray-300 mb-3">Your data is missing the account_number column or some rows have empty account numbers.</p>
                        <div className="bg-gray-800 rounded p-3">
                          <p className="text-emerald-400 text-sm font-semibold">Solution:</p>
                          <ul className="text-gray-300 text-sm mt-2 space-y-1">
                            <li>• Ensure your file has an account_number column</li>
                            <li>• Check that all rows have account numbers filled in</li>
                            <li>• Remove any empty rows from your data</li>
                          </ul>
                        </div>
                      </div>

                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <div className="flex items-start mb-3">
                          <AlertTriangle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                          <h4 className="font-semibold text-red-100">Invalid file format</h4>
                        </div>
                        <p className="text-gray-300 mb-3">The uploaded file is not in a supported format.</p>
                        <div className="bg-gray-800 rounded p-3">
                          <p className="text-emerald-400 text-sm font-semibold">Solution:</p>
                          <ul className="text-gray-300 text-sm mt-2 space-y-1">
                            <li>• Only .xlsx and .csv files are supported</li>
                            <li>• Save your Excel file as .xlsx (not .xls)</li>
                            <li>• Ensure CSV files are UTF-8 encoded</li>
                          </ul>
                        </div>
                      </div>

                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <div className="flex items-start mb-3">
                          <AlertTriangle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                          <h4 className="font-semibold text-red-100">File too large</h4>
                        </div>
                        <p className="text-gray-300 mb-3">Your file exceeds the maximum allowed size.</p>
                        <div className="bg-gray-800 rounded p-3">
                          <p className="text-emerald-400 text-sm font-semibold">Solution:</p>
                          <ul className="text-gray-300 text-sm mt-2 space-y-1">
                            <li>• Excel files: max 10 MB</li>
                            <li>• CSV files: max 5 MB</li>
                            <li>• Split large files into smaller batches</li>
                            <li>• Remove unnecessary columns or formatting</li>
                          </ul>
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                        <div className="flex items-start mb-3">
                          <AlertTriangle className="w-5 h-5 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                          <h4 className="font-semibold text-amber-100">Conversion taking longer than expected</h4>
                        </div>
                        <p className="text-gray-300 mb-3">Large files may take several minutes to process.</p>
                        <div className="bg-gray-800 rounded p-3">
                          <p className="text-emerald-400 text-sm font-semibold">What to do:</p>
                          <ul className="text-gray-300 text-sm mt-2 space-y-1">
                            <li>• Please be patient, do not refresh the page</li>
                            <li>• Large files (5,000+ records) can take 5-10 minutes</li>
                            <li>• Professional and Enterprise users get priority processing</li>
                          </ul>
                        </div>
                      </div>

                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Best Practices</h3>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-6">
                      <div className="space-y-4">
                        <div className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-emerald-400 mr-3 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold text-white">Test with Small Files First</h4>
                            <p className="text-gray-300 text-sm">Start with a small sample of your data to verify the format and structure work correctly.</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-emerald-400 mr-3 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold text-white">Use Our Template</h4>
                            <p className="text-gray-300 text-sm">Download our sample template to ensure your data structure matches our requirements.</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-emerald-400 mr-3 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold text-white">Validate Your XML</h4>
                            <p className="text-gray-300 text-sm">After conversion, verify the XML structure before submitting to tax authorities.</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-emerald-400 mr-3 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold text-white">Keep Backups</h4>
                            <p className="text-gray-300 text-sm">Always keep copies of both your original data and the converted XML files.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Still Need Help?</h3>
                    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                      <p className="text-gray-300 mb-4">If you are still experiencing issues after following this troubleshooting guide:</p>
                      <div className="flex flex-wrap gap-4">
                        <Link 
                          to="/support"
                          className="inline-flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Contact Support
                        </Link>
                        <a 
                          href="mailto:contact@iafrica.solutions"
                          className="inline-flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email Us Directly
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'api-reference' && (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center mb-4">
                      <FileText className="w-6 h-6 text-emerald-400 mr-3" />
                      <h2 className="text-3xl font-bold text-white">API Reference</h2>
                    </div>
                    <p className="text-gray-300 text-lg">
                      Coming soon! Programmatic access to our CRS XML conversion service.
                    </p>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6">
                    <div className="flex items-start">
                      <Info className="w-6 h-6 text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="text-lg font-semibold text-amber-100 mb-2">API Coming Soon</h3>
                        <p className="text-amber-100 mb-4">
                          We are working on a REST API that will allow you to integrate CRS XML conversion directly into your applications.
                        </p>
                        <h4 className="font-semibold text-amber-100 mb-2">Planned Features:</h4>
                        <ul className="text-amber-100 space-y-1 text-sm ml-4">
                          <li>• RESTful API endpoints</li>
                          <li>• JSON request/response format</li>
                          <li>• Authentication via API keys</li>
                          <li>• Bulk processing support</li>
                          <li>• Webhook notifications</li>
                          <li>• Rate limiting and usage analytics</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Interested in API Access?</h3>
                    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                      <p className="text-gray-300 mb-4">
                        Join our waitlist to be notified when the API becomes available. Enterprise customers will get early access.
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <Link 
                          to="/support"
                          className="inline-flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Join API Waitlist
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Sample API Usage (Preview)</h3>
                    <p className="text-gray-300 mb-4">Here is what the API might look like when it is ready:</p>
                    <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-emerald-400 text-sm">
{`// POST /api/v1/convert
{
  "file_data": "base64_encoded_file_content",
  "file_format": "xlsx",
  "options": {
    "reporting_year": 2024,
    "validate_output": true
  }
}

// Response
{
  "success": true,
  "conversion_id": "conv_123456789",
  "xml_data": "base64_encoded_xml_content",
  "validation_results": {
    "is_valid": true,
    "warnings": []
  }
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        <div className="text-center mt-8 mb-12">
          <Link 
            to="/" 
            className="inline-flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            <Home className="w-5 h-5 mr-2" />
            Return to CRS Converter
          </Link>
        </div>

        <div className="text-center">
          <p className="text-gray-400">
            © 2024 iAfrica Compliance. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
