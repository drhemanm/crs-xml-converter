import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, Database, Mail, FileText, ArrowLeft, Home } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        
        {/* Back Button */}
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors duration-200 backdrop-blur-sm border border-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Main Page
          </Link>
        </div>
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-emerald-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
          </div>
          <p className="text-xl text-gray-300">
            How we protect and handle your personal information
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Last updated: August 26, 2025
          </p>
        </div>

        {/* Content */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 space-y-8">
          
          {/* Introduction */}
          <section>
            <div className="flex items-center mb-4">
              <Eye className="w-6 h-6 text-emerald-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Introduction</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              iAfrica Compliance ("we," "our," or "us") operates iafrica-compliance.com. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our CRS XML conversion services.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <div className="flex items-center mb-4">
              <Database className="w-6 h-6 text-emerald-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Information We Collect</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Personal Information</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Email address (for account creation and communication)</li>
                  <li>Name (when provided during registration)</li>
                  <li>Payment information (processed securely through PayPal)</li>
                  <li>Usage data and analytics</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">File Data</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Files uploaded for CRS XML conversion (temporarily processed)</li>
                  <li>Conversion history and usage statistics</li>
                  <li>File metadata (size, format, conversion timestamp)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Technical Information</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>IP address and browser information</li>
                  <li>Device type and operating system</li>
                  <li>Usage patterns and feature interactions</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <div className="flex items-center mb-4">
              <FileText className="w-6 h-6 text-emerald-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">How We Use Your Information</h2>
            </div>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li>Provide and maintain our CRS XML conversion services</li>
              <li>Process your file conversions and manage your account</li>
              <li>Send important service updates and notifications</li>
              <li>Process payments and manage subscriptions</li>
              <li>Improve our services through analytics and usage data</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Ensure security and prevent fraud</li>
              <li>Comply with legal obligations and regulatory requirements</li>
            </ul>
          </section>

          {/* Data Security */}
          <section>
            <div className="flex items-center mb-4">
              <Lock className="w-6 h-6 text-emerald-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Data Security</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>We implement industry-standard security measures to protect your information:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Encryption:</strong> All data transmission is encrypted using SSL/TLS</li>
                <li><strong>Secure Storage:</strong> Data is stored on secure Firebase servers with encryption at rest</li>
                <li><strong>Access Control:</strong> Limited access to personal data on a need-to-know basis</li>
                <li><strong>File Processing:</strong> Uploaded files are processed temporarily and not permanently stored</li>
                <li><strong>Payment Security:</strong> Payment processing handled securely through PayPal</li>
              </ul>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Data Retention</h2>
            <div className="space-y-3 text-gray-300">
              <p><strong>Account Data:</strong> Retained while your account is active and for 2 years after account closure</p>
              <p><strong>Usage Data:</strong> Retained for analytics purposes for up to 3 years</p>
              <p><strong>Uploaded Files:</strong> Processed temporarily and deleted immediately after conversion</p>
              <p><strong>Payment Records:</strong> Retained for 7 years for tax and compliance purposes</p>
            </div>
          </section>

          {/* Your Rights (GDPR) */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Your Rights Under GDPR</h2>
            <p className="text-gray-300 mb-4">If you are a resident of the European Union, you have the following rights:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
              <li><strong>Right to Access:</strong> Request copies of your personal data</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
              <li><strong>Right to Restrict Processing:</strong> Request limitation of data processing</li>
              <li><strong>Right to Data Portability:</strong> Request transfer of your data</li>
              <li><strong>Right to Object:</strong> Object to processing of your personal data</li>
            </ul>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Cookies and Tracking</h2>
            <div className="space-y-3 text-gray-300">
              <p>We use cookies and similar technologies to:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Remember your preferences and settings</li>
                <li>Analyze website traffic and usage patterns</li>
                <li>Provide personalized experiences</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
              <p className="mt-3">You can control cookies through your browser settings.</p>
            </div>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Third-Party Services</h2>
            <p className="text-gray-300 mb-4">We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
              <li><strong>Firebase:</strong> Database and authentication services</li>
              <li><strong>PayPal:</strong> Payment processing</li>
              <li><strong>Google Analytics:</strong> Website usage analytics</li>
              <li><strong>Vercel:</strong> Website hosting and deployment</li>
            </ul>
            <p className="text-gray-300 mt-3">
              These services have their own privacy policies and data handling practices.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <div className="flex items-center mb-4">
              <Mail className="w-6 h-6 text-emerald-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Contact Us</h2>
            </div>
            <div className="text-gray-300">
              <p>For privacy-related questions or to exercise your rights, contact us:</p>
              <div className="mt-4 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <p><strong>Email:</strong> <a href="mailto:contact@iafrica.solutions" className="text-emerald-400 hover:text-emerald-300">contact@iafrica.solutions</a></p>
                <p><strong>Subject:</strong> Privacy Policy Inquiry</p>
                <p><strong>Response Time:</strong> Within 48 hours</p>
              </div>
            </div>
          </section>

          {/* Updates */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Policy Updates</h2>
            <p className="text-gray-300">
              We may update this Privacy Policy periodically. We will notify users of significant changes by email or through our website. The "Last updated" date at the top indicates when changes were last made.
            </p>
          </section>

        </div>

        {/* Back to Top Button */}
        <div className="text-center mt-8 mb-12">
          <Link 
            to="/" 
            className="inline-flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            <Home className="w-5 h-5 mr-2" />
            Return to CRS Converter
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-400">
            © 2024 iAfrica Compliance. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
