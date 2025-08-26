import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, FileText, CreditCard, Shield, AlertTriangle, Users, ArrowLeft, Home } from 'lucide-react';

const TermsOfService = () => {
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
            <Scale className="w-12 h-12 text-emerald-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
          </div>
          <p className="text-xl text-gray-300">
            Legal terms and conditions for using our services
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
              <FileText className="w-6 h-6 text-emerald-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Agreement to Terms</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              By accessing and using iAfrica Compliance services at iafrica-compliance.com ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Service Description</h2>
            <div className="space-y-4 text-gray-300">
              <p>iAfrica Compliance provides:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>CRS OECD XML conversion services</li>
                <li>FATCA compliance reporting tools</li>
                <li>Financial data processing and conversion</li>
                <li>Regulatory compliance assistance</li>
                <li>Customer support and documentation</li>
              </ul>
            </div>
          </section>

          {/* User Accounts */}
          <section>
            <div className="flex items-center mb-4">
              <Users className="w-6 h-6 text-emerald-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">User Accounts</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p><strong>Account Creation:</strong> You must provide accurate information when creating an account.</p>
              <p><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials.</p>
              <p><strong>Account Activity:</strong> You are responsible for all activities that occur under your account.</p>
              <p><strong>Age Requirement:</strong> You must be at least 18 years old to use our services.</p>
            </div>
          </section>

          {/* Service Plans */}
          <section>
            <div className="flex items-center mb-4">
              <CreditCard className="w-6 h-6 text-emerald-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Service Plans and Pricing</h2>
            </div>
            <div className="space-y-6 text-gray-300">
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Free Plan - $0</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>6 total conversions (3 anonymous + 3 after registration)</li>
                  <li>Basic XML generation</li>
                  <li>Email support</li>
                  <li>Standard processing</li>
                  <li>GDPR compliant</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Professional Plan - $79/month</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>100 conversions per month</li>
                  <li>Priority email support</li>
                  <li>Usage analytics dashboard</li>
                  <li>Standard templates</li>
                  <li>GIIN validation database</li>
                  <li>Conversion history</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Enterprise Plan - $299/month</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>1,000 conversions per month</li>
                  <li>Priority support</li>
                  <li>All features included</li>
                  <li>Dedicated account management</li>
                  <li>Custom integrations</li>
                </ul>
              </div>

            </div>
          </section>

          {/* Payment Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Payment and Billing</h2>
            <div className="space-y-4 text-gray-300">
              <p><strong>Payment Processing:</strong> All payments are processed securely through PayPal.</p>
              <p><strong>Billing Cycle:</strong> Paid plans are billed monthly in advance.</p>
              <p><strong>Payment Methods:</strong> We accept all major payment methods supported by PayPal.</p>
              <p><strong>Currency:</strong> All prices are listed in USD.</p>
              <p><strong>Taxes:</strong> You are responsible for any applicable taxes.</p>
              <p><strong>Failed Payments:</strong> Service may be suspended if payment fails. Account will be restored upon successful payment.</p>
            </div>
          </section>

          {/* Refund Policy */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Refund and Cancellation Policy</h2>
            <div className="space-y-4 text-gray-300">
              <p><strong>Cancellation:</strong> You may cancel your subscription at any time through your account settings.</p>
              <p><strong>Service Continuation:</strong> Paid services continue until the end of the current billing period.</p>
              <p><strong>Refund Eligibility:</strong> Refunds may be provided within 7 days of initial purchase for legitimate service issues.</p>
              <p><strong>Refund Process:</strong> Contact support at contact@iafrica.solutions to request a refund.</p>
              <p><strong>No Partial Refunds:</strong> We do not provide partial refunds for unused conversions.</p>
            </div>
          </section>

          {/* Acceptable Use */}
          <section>
            <div className="flex items-center mb-4">
              <Shield className="w-6 h-6 text-emerald-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Acceptable Use Policy</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>You agree NOT to use our services for:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Any illegal or unauthorized purpose</li>
                <li>Processing fraudulent or stolen data</li>
                <li>Uploading malicious files or malware</li>
                <li>Attempting to breach our security systems</li>
                <li>Reselling or redistributing our services without permission</li>
                <li>Reverse engineering our software or systems</li>
                <li>Violating any applicable laws or regulations</li>
              </ul>
            </div>
          </section>

          {/* Data and Privacy */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Data Processing and Privacy</h2>
            <div className="space-y-4 text-gray-300">
              <p><strong>File Processing:</strong> Uploaded files are processed temporarily and deleted immediately after conversion.</p>
              <p><strong>Data Security:</strong> We implement industry-standard security measures to protect your data.</p>
              <p><strong>Privacy Policy:</strong> Our data handling practices are detailed in our Privacy Policy.</p>
              <p><strong>Compliance:</strong> We comply with GDPR and other applicable data protection laws.</p>
              <p><strong>No Data Storage:</strong> We do not permanently store your uploaded files or converted XML data.</p>
            </div>
          </section>

          {/* Service Availability */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Service Availability</h2>
            <div className="space-y-4 text-gray-300">
              <p><strong>Uptime:</strong> We strive for 99.9% uptime but do not guarantee uninterrupted service.</p>
              <p><strong>Maintenance:</strong> Scheduled maintenance will be announced in advance when possible.</p>
              <p><strong>Service Limits:</strong> We may implement reasonable usage limits to ensure service quality.</p>
              <p><strong>Force Majeure:</strong> We are not liable for service interruptions due to events beyond our control.</p>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Intellectual Property</h2>
            <div className="space-y-4 text-gray-300">
              <p><strong>Our Property:</strong> The Service and its original content, features, and functionality are owned by iAfrica Compliance.</p>
              <p><strong>Your Data:</strong> You retain all rights to data you upload to our Service.</p>
              <p><strong>License to Use:</strong> We grant you a limited, non-exclusive license to use our Service according to these Terms.</p>
              <p><strong>Restrictions:</strong> You may not copy, modify, distribute, or reverse engineer our Service.</p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400 mr-3" />
              <h2 className="text-2xl font-semibold text-white">Limitation of Liability</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p><strong>Service "As Is":</strong> The Service is provided on an "as is" and "as available" basis.</p>
              <p><strong>No Warranties:</strong> We disclaim all warranties, express or implied, including warranties of merchantability and fitness.</p>
              <p><strong>Damage Limitation:</strong> Our liability shall not exceed the amount paid by you for the Service in the past 12 months.</p>
              <p><strong>Consequential Damages:</strong> We shall not be liable for any indirect, incidental, or consequential damages.</p>
              <p><strong>Data Accuracy:</strong> While we strive for accuracy, you are responsible for verifying all converted data.</p>
            </div>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Indemnification</h2>
            <p className="text-gray-300">
              You agree to indemnify and hold harmless iAfrica Compliance from any claims, damages, or expenses arising from your use of the Service, violation of these Terms, or infringement of any third-party rights.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Termination</h2>
            <div className="space-y-4 text-gray-300">
              <p><strong>By You:</strong> You may terminate your account at any time through your account settings.</p>
              <p><strong>By Us:</strong> We may terminate your account for violations of these Terms or other legitimate reasons.</p>
              <p><strong>Effect of Termination:</strong> Upon termination, your right to use the Service will cease immediately.</p>
              <p><strong>Data Deletion:</strong> We will delete your account data within 30 days of termination.</p>
            </div>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Governing Law</h2>
            <p className="text-gray-300">
              These Terms shall be governed by and construed in accordance with the laws of Mauritius. Any disputes shall be resolved in the courts of Mauritius.
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Changes to Terms</h2>
            <p className="text-gray-300">
              We reserve the right to modify these Terms at any time. We will notify users of significant changes by email or through our website. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
            <div className="text-gray-300">
              <p>For questions about these Terms of Service, contact us:</p>
              <div className="mt-4 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <p><strong>Email:</strong> <a href="mailto:contact@iafrica.solutions" className="text-emerald-400 hover:text-emerald-300">contact@iafrica.solutions</a></p>
                <p><strong>Subject:</strong> Terms of Service Inquiry</p>
                <p><strong>Response Time:</strong> Within 48 hours</p>
              </div>
            </div>
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

export default TermsOfService;
