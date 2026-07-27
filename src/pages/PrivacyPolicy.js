import React from 'react';
import { Link } from 'react-router-dom';
import { Shield,  ArrowLeft,  Eye,  Lock,  Trash2,  Download,  AlertTriangle,  CheckCircle } from 'lucide-react';

const PrivacyPolicy = () => {
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
            <Shield className="w-12 h-12 text-accent mr-3" />
            <h1 className="text-4xl font-bold text-ink">Privacy Policy</h1>
          </div>
          <div className="bg-accent/10 border border-accent/20 rounded-card p-4 max-w-2xl mx-auto">
            <p className="text-accent text-sm">
              <strong>GDPR Compliant</strong> • Last updated: August 26, 2025
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-ink-50 backdrop-blur-sm rounded-card p-8 space-y-8">
          
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">1. Introduction</h2>
            <p className="text-ink-600 mb-4">
              Evologics Ltd ("we," "our," or "us") is committed to protecting your privacy and personal data. 
              This Privacy Policy explains how we collect, use, process, and protect your information when you use 
              our CRS XML Converter service, in compliance with the General Data Protection Regulation (GDPR) and 
              other applicable data protection laws.
            </p>
            <div className="bg-ink/10 border border-ink-200/20 rounded-card p-4">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-ink mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-ink">
                  <p className="font-medium">Your Rights Under GDPR:</p>
                  <p className="text-sm mt-1">You have the right to access, rectify, erase, restrict, port, and object to processing of your personal data.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Data Controller */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">2. Data Controller</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <p className="text-ink-600 mb-2"><strong>Data Controller:</strong> Evologics Ltd</p>
              <p className="text-ink-600 mb-2"><strong>Address:</strong> [Your Business Address]</p>
              <p className="text-ink-600 mb-2"><strong>Email:</strong> contacts@evologics.ai</p>
              <p className="text-ink-600 mb-2"><strong>DPO Contact:</strong> contacts@evologics.ai</p>
              <p className="text-ink-600"><strong>EU Representative:</strong> [If applicable]</p>
            </div>
          </section>

          {/* Personal Data Collection */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">3. Personal Data We Collect</h2>
            
            <div className="space-y-4">
              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">3.1 Account Information</h3>
                <ul className="text-ink-600 space-y-2">
                  <li>• Email address (for authentication and communication)</li>
                  <li>• Name (for personalization and support)</li>
                  <li>• Company information (if applicable)</li>
                  <li>• Account preferences and settings</li>
                </ul>
                <p className="text-sm text-caution mt-2">
                  <strong>Legal Basis:</strong> Contract performance and legitimate interests
                </p>
              </div>

              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">3.2 File Processing Data</h3>
                <ul className="text-ink-600 space-y-2">
                  <li>• Financial data uploaded for conversion (temporarily processed)</li>
                  <li>• File metadata (size, type, upload timestamp)</li>
                  <li>• Conversion logs and error reports</li>
                </ul>
                <div className="bg-critical/10 border border-critical/20 rounded p-3 mt-3">
                  <div className="flex items-start">
                    <AlertTriangle className="w-4 h-4 text-critical mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-critical text-sm">
                      <p><strong>Important:</strong> Uploaded files are processed temporarily and automatically deleted within 24 hours. We do not permanently store your financial data.</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-caution mt-2">
                  <strong>Legal Basis:</strong> Contract performance
                </p>
              </div>

              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">3.3 Technical Data</h3>
                <ul className="text-ink-600 space-y-2">
                  <li>• IP address (anonymized after 30 days)</li>
                  <li>• Browser type and version</li>
                  <li>• Usage analytics (anonymized)</li>
                  <li>• Error logs and performance metrics</li>
                </ul>
                <p className="text-sm text-caution mt-2">
                  <strong>Legal Basis:</strong> Legitimate interests (service improvement and security)
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Data */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">4. How We Use Your Personal Data</h2>
            <div className="space-y-4">
              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">Service Provision</h3>
                <ul className="text-ink-600 space-y-1">
                  <li>• Process file conversions to CRS XML format</li>
                  <li>• Provide user authentication and account management</li>
                  <li>• Monitor usage limits and billing</li>
                  <li>• Provide customer support</li>
                </ul>
              </div>
              
              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">Legal Obligations</h3>
                <ul className="text-ink-600 space-y-1">
                  <li>• Comply with financial regulations</li>
                  <li>• Maintain audit logs as required by law</li>
                  <li>• Respond to lawful requests from authorities</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">5. Data Sharing and Third Parties</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <p className="text-ink-600 mb-4">We do not sell, rent, or share your personal data except in the following circumstances:</p>
              <ul className="text-ink-600 space-y-2">
                <li>• <strong>Service Providers:</strong> Cloud hosting (AWS/Google Cloud), payment processing (Stripe), email services</li>
                <li>• <strong>Legal Requirements:</strong> When required by law or to protect our legal rights</li>
                <li>• <strong>Business Transfers:</strong> In case of merger, acquisition, or sale of assets</li>
              </ul>
              <div className="bg-affirm/10 border border-affirm/20 rounded p-3 mt-4">
                <p className="text-affirm text-sm">
                  <strong>Data Processing Agreements:</strong> All third-party processors are bound by GDPR-compliant data processing agreements.
                </p>
              </div>
            </div>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">6. International Data Transfers</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <p className="text-ink-600 mb-3">
                Your data may be processed in countries outside the European Economic Area (EEA). 
                We ensure adequate protection through:
              </p>
              <ul className="text-ink-600 space-y-2">
                <li>• EU Standard Contractual Clauses</li>
                <li>• Adequacy decisions by the European Commission</li>
                <li>• Certification schemes (e.g., Privacy Shield successors)</li>
              </ul>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">7. Data Retention</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">Account Data</h3>
                <ul className="text-ink-600 text-sm space-y-1">
                  <li>• Active accounts: Stored while account is active</li>
                  <li>• Inactive accounts: Deleted after 3 years</li>
                  <li>• Account deletion: 30 days after request</li>
                </ul>
              </div>
              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">Processing Data</h3>
                <ul className="text-ink-600 text-sm space-y-1">
                  <li>• Uploaded files: Deleted within 24 hours</li>
                  <li>• Conversion logs: 12 months</li>
                  <li>• Technical logs: 30 days (anonymized)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">8. Your Rights Under GDPR</h2>
            <div className="space-y-3">
              <div className="flex items-start bg-ink-50 rounded-card p-3">
                <Eye className="w-5 h-5 text-ink mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-ink font-medium">Right to Access</h3>
                  <p className="text-ink-600 text-sm">Request a copy of your personal data we hold</p>
                </div>
              </div>
              
              <div className="flex items-start bg-ink-50 rounded-card p-3">
                <Lock className="w-5 h-5 text-affirm mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-ink font-medium">Right to Rectification</h3>
                  <p className="text-ink-600 text-sm">Correct inaccurate or incomplete personal data</p>
                </div>
              </div>
              
              <div className="flex items-start bg-ink-50 rounded-card p-3">
                <Trash2 className="w-5 h-5 text-critical mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-ink font-medium">Right to Erasure ("Right to be Forgotten")</h3>
                  <p className="text-ink-600 text-sm">Request deletion of your personal data</p>
                </div>
              </div>
              
              <div className="flex items-start bg-ink-50 rounded-card p-3">
                <Download className="w-5 h-5 text-ink mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-ink font-medium">Right to Data Portability</h3>
                  <p className="text-ink-600 text-sm">Receive your data in a structured, machine-readable format</p>
                </div>
              </div>
            </div>
            
            <div className="bg-accent/10 border border-accent/20 rounded-card p-4 mt-4">
              <p className="text-accent font-medium mb-2">How to Exercise Your Rights:</p>
              <p className="text-accent text-sm mb-2">
                Contact us at <a href="mailto:contacts@evologics.ai" className="underline">contacts@evologics.ai</a> 
                or use our <Link to="/data-request" className="underline">Data Request Portal</Link>
              </p>
              <p className="text-accent text-sm">
                We will respond to your request within 30 days (may be extended by 2 months for complex requests).
              </p>
            </div>
          </section>

          {/* Security */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">9. Data Security</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <p className="text-ink-600 mb-3">We implement industry-standard security measures:</p>
              <div className="grid md:grid-cols-2 gap-4">
                <ul className="text-ink-600 space-y-2">
                  <li>• End-to-end encryption (AES-256)</li>
                  <li>• Secure data transmission (TLS 1.3)</li>
                  <li>• Regular security audits</li>
                  <li>• Access controls and monitoring</li>
                </ul>
                <ul className="text-ink-600 space-y-2">
                  <li>• Data breach response procedures</li>
                  <li>• Regular backup and recovery testing</li>
                  <li>• Staff security training</li>
                  <li>• Incident response plan</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">10. Cookies and Tracking</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <p className="text-ink-600 mb-3">We use the following types of cookies:</p>
              <ul className="text-ink-600 space-y-2">
                <li>• <strong>Essential Cookies:</strong> Required for basic site functionality (no consent required)</li>
                <li>• <strong>Analytics Cookies:</strong> Anonymous usage statistics (consent required)</li>
                <li>• <strong>Preference Cookies:</strong> Remember your settings (consent required)</li>
              </ul>
              <p className="text-ink-600 text-sm mt-3">
                You can manage cookie preferences in our <Link to="/cookie-settings" className="text-accent underline">Cookie Settings</Link>.
              </p>
            </div>
          </section>

          {/* Contact and Complaints */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">11. Contact Us and Complaints</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-ink font-medium mb-2">Privacy Inquiries:</h3>
                  <p className="text-ink-600 text-sm mb-1">Email: contacts@evologics.ai</p>
                  <p className="text-ink-600 text-sm">Response time: Within 72 hours</p>
                </div>
                <div>
                  <h3 className="text-ink font-medium mb-2">Supervisory Authority:</h3>
                  <p className="text-ink-600 text-sm mb-1">You have the right to lodge a complaint with your local data protection authority.</p>
                  <p className="text-ink-600 text-sm">EU: Find your local DPA at <span className="text-accent">edpb.europa.eu</span></p>
                </div>
              </div>
            </div>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">12. Changes to This Policy</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <p className="text-ink-600 mb-3">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by:
              </p>
              <ul className="text-ink-600 space-y-1">
                <li>• Email notification to registered users</li>
                <li>• Prominent notice on our website</li>
                <li>• In-app notifications</li>
              </ul>
              <p className="text-ink-600 text-sm mt-3">
                Continued use of our services after changes indicates acceptance of the updated policy.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <Link 
              to="/data-request"
              className="inline-flex items-center px-6 py-3 bg-accent hover:bg-accent text-ink rounded-card transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Request Your Data
            </Link>
            <Link 
              to="/cookie-settings"
              className="inline-flex items-center px-6 py-3 bg-ink-50 hover:bg-white/20 text-ink rounded-card transition-colors"
            >
              <Lock className="w-4 h-4 mr-2" />
              Cookie Settings
            </Link>
          </div>
          <p className="text-ink-500 text-sm">
            This Privacy Policy is effective as of August 26, 2025
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
