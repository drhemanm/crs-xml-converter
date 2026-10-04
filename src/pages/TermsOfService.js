import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, FileText, CreditCard, Shield, AlertTriangle, Users, ArrowLeft, Home } from 'lucide-react';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        
        {/* Back Button */}
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center px-4 py-2 bg-ink-50 hover:bg-white/20 text-ink rounded-card transition-colors duration-200 backdrop-blur-sm border border-ink-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Main Page
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Scale className="w-12 h-12 text-accent mr-3" />
            <h1 className="text-4xl font-bold text-ink">Terms of Service</h1>
          </div>
          <p className="text-xl text-ink-600">
            Legal terms and conditions for using our services
          </p>
          <p className="text-sm text-ink-500 mt-2">
            Last updated: 4 October 2026
          </p>
        </div>

        {/* Content */}
        <div className="bg-ink-50 backdrop-blur-sm rounded-card p-8 space-y-8">
          
          {/* Introduction */}
          <section>
            <div className="flex items-center mb-4">
              <FileText className="w-6 h-6 text-accent mr-3" />
              <h2 className="text-2xl font-semibold text-ink">Agreement to Terms</h2>
            </div>
            <p className="text-ink-600 leading-relaxed">
              By accessing and using Evologics Ltd services at evologics.ai ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-2xl font-semibold text-ink mb-4">Service Description</h2>
            <div className="space-y-4 text-ink-600">
              <p>Evologics Ltd provides:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Conversion of spreadsheets (CSV, XLSX) into OECD CRS XML, schema versions 2.0 and 3.0, carried out in your browser</li>
                <li>For signed-in users, a filing history of references (not account data) so that later corrections and voids can point at what was filed</li>
                <li>Documentation, a downloadable template and email support</li>
              </ul>
            </div>
          </section>

          {/* User Accounts */}
          <section>
            <div className="flex items-center mb-4">
              <Users className="w-6 h-6 text-accent mr-3" />
              <h2 className="text-2xl font-semibold text-ink">User Accounts</h2>
            </div>
            <div className="space-y-4 text-ink-600">
              <p><strong>Account Creation:</strong> You must provide accurate information when creating an account.</p>
              <p><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials.</p>
              <p><strong>Account Activity:</strong> You are responsible for all activities that occur under your account.</p>
              <p><strong>Age Requirement:</strong> You must be at least 18 years old to use our services.</p>
            </div>
          </section>

          {/* Plans */}
          <section>
            <div className="flex items-center mb-4">
              <CreditCard className="w-6 h-6 text-accent mr-3" />
              <h2 className="text-2xl font-semibold text-ink">Plans and Charges</h2>
            </div>
            <div className="space-y-4 text-ink-600">
              <p><strong>Free use:</strong> 3 conversions in a browser without an account, and 3 conversions per calendar month (UTC) with an account.</p>
              <p><strong>No paid plans:</strong> We do not currently sell paid plans and will not charge you. If we introduce paid plans, we will update these Terms and tell registered users before any charge applies.</p>
            </div>
          </section>

          {/* Acceptable Use */}
          <section>
            <div className="flex items-center mb-4">
              <Shield className="w-6 h-6 text-accent mr-3" />
              <h2 className="text-2xl font-semibold text-ink">Acceptable Use Policy</h2>
            </div>
            <div className="space-y-4 text-ink-600">
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
            <h2 className="text-2xl font-semibold text-ink mb-4">Data Processing and Privacy</h2>
            <div className="space-y-4 text-ink-600">
              <p><strong>Local Processing:</strong> Your spreadsheet is read and converted in your browser. Its contents are not uploaded to our servers, and we do not store your files or the XML generated from them.</p>
              <p><strong>What We Store:</strong> For signed-in users we store account details, usage counts, an activity log and the filing history described in our Privacy Policy. None of these contain the account holders' names, account numbers, balances, addresses or tax identification numbers.</p>
              <p><strong>Privacy Policy:</strong> Our data handling practices are detailed in our Privacy Policy.</p>
            </div>
          </section>

          {/* Service Availability */}
          <section>
            <h2 className="text-2xl font-semibold text-ink mb-4">Service Availability</h2>
            <div className="space-y-4 text-ink-600">
              <p><strong>Uptime:</strong> We strive for 99.9% uptime but do not guarantee uninterrupted service.</p>
              <p><strong>Maintenance:</strong> Scheduled maintenance will be announced in advance when possible.</p>
              <p><strong>Service Limits:</strong> We may implement reasonable usage limits to ensure service quality.</p>
              <p><strong>Force Majeure:</strong> We are not liable for service interruptions due to events beyond our control.</p>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold text-ink mb-4">Intellectual Property</h2>
            <div className="space-y-4 text-ink-600">
              <p><strong>Our Property:</strong> The Service and its original content, features, and functionality are owned by Evologics Ltd.</p>
              <p><strong>Your Data:</strong> You retain all rights to data you upload to our Service.</p>
              <p><strong>License to Use:</strong> We grant you a limited, non-exclusive license to use our Service according to these Terms.</p>
              <p><strong>Restrictions:</strong> You may not copy, modify, distribute, or reverse engineer our Service.</p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-caution mr-3" />
              <h2 className="text-2xl font-semibold text-ink">Limitation of Liability</h2>
            </div>
            <div className="space-y-4 text-ink-600">
              <p><strong>Service "As Is":</strong> The Service is provided on an "as is" and "as available" basis.</p>
              <p><strong>No Warranties:</strong> We disclaim all warranties, express or implied, including warranties of merchantability and fitness.</p>
              <p><strong>Damage Limitation:</strong> Our liability shall not exceed the amount paid by you for the Service in the past 12 months.</p>
              <p><strong>Consequential Damages:</strong> We shall not be liable for any indirect, incidental, or consequential damages.</p>
              <p><strong>Your Filing:</strong> You are responsible for the data you convert and for every file you submit. The Service does not validate its output against the official XSD and does not submit anything to a tax authority. Validate each file against the official schema and your authority's portal before filing. Acceptance by a tax authority is not guaranteed.</p>
            </div>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold text-ink mb-4">Indemnification</h2>
            <p className="text-ink-600">
              You agree to indemnify and hold harmless Evologics Ltd from any claims, damages, or expenses arising from your use of the Service, violation of these Terms, or infringement of any third-party rights.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-ink mb-4">Termination</h2>
            <div className="space-y-4 text-ink-600">
              <p><strong>By You:</strong> You may close your account at any time by submitting a deletion request through our <Link to="/data-request" className="text-accent underline">Data Request page</Link> or by emailing contacts@evologics.ai.</p>
              <p><strong>By Us:</strong> We may terminate your account for violations of these Terms or other legitimate reasons.</p>
              <p><strong>Effect of Termination:</strong> Upon termination, your right to use the Service will cease immediately.</p>
              <p><strong>Data Deletion:</strong> We will delete your account data within 30 days of termination, except where the law requires us to keep it.</p>
            </div>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold text-ink mb-4">Governing Law</h2>
            <p className="text-ink-600">
              These Terms shall be governed by and construed in accordance with the laws of Mauritius. Any disputes shall be resolved in the courts of Mauritius.
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-ink mb-4">Changes to Terms</h2>
            <p className="text-ink-600">
              We reserve the right to modify these Terms at any time. We will notify users of significant changes by email or through our website. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-ink mb-4">Contact Us</h2>
            <div className="text-ink-600">
              <p>For questions about these Terms of Service, contact us:</p>
              <div className="mt-4 p-4 bg-accent/10 rounded-card border border-accent/20">
                <p><strong>Email:</strong> <a href="mailto:contacts@evologics.ai" className="text-accent hover:text-accent">contacts@evologics.ai</a></p>
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
            className="inline-flex items-center px-6 py-3 bg-accent hover:bg-accent text-white rounded-card transition-colors duration-200 font-medium"
          >
            <Home className="w-5 h-5 mr-2" />
            Return to CRS Converter
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-ink-500">
            © 2026 Evologics Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
