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
              Last updated: 4 October 2026
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-ink-50 backdrop-blur-sm rounded-card p-8 space-y-8">
          
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">1. Introduction</h2>
            <p className="text-ink-600 mb-4">
              Evologics Ltd ("we," "our," or "us") runs the CRS XML Converter. This policy explains what
              personal data we collect, why, who processes it for us, and your rights under the General Data
              Protection Regulation (GDPR) and the Mauritius Data Protection Act 2017.
            </p>
            <div className="bg-ink/10 border border-ink-200/20 rounded-card p-4">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-ink mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-ink">
                  <p className="font-medium">The short version</p>
                  <p className="text-sm mt-1">
                    The spreadsheet you convert is read and converted in your browser. Its contents (the
                    names, account numbers, balances, addresses and tax identification numbers of the
                    people you report on) are never sent to us.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Data Controller */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">2. Data Controller</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <p className="text-ink-600 mb-2"><strong>Data Controller:</strong> Evologics Ltd</p>
              <p className="text-ink-600 mb-2"><strong>Email:</strong> contacts@evologics.ai</p>
              <p className="text-ink-600"><strong>Data protection contact:</strong> contacts@evologics.ai</p>
            </div>
          </section>

          {/* Personal Data Collection */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">3. Personal Data We Collect</h2>
            <div className="space-y-4">
              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">3.1 Your account (if you create one)</h3>
                <ul className="text-ink-600 space-y-2">
                  <li>• Email address and display name, and how you sign in (email and password, or Google)</li>
                  <li>• Conversion counts for usage limits, and your account preferences</li>
                  <li>• Whether you agreed to marketing email (off unless you opt in)</li>
                </ul>
                <p className="text-sm text-caution mt-2">
                  <strong>Legal Basis:</strong> Performance of our contract with you
                </p>
              </div>

              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">3.2 Your filings (signed-in users)</h3>
                <ul className="text-ink-600 space-y-2">
                  <li>• <strong>Filing history:</strong> the reporting institution's name, TAN and GIIN, country, tax year, schema version, the message and document reference IDs of each filing, and record counts</li>
                  <li>• <strong>Account keys:</strong> for each reported account, a SHA-256 hash of the account number, scoped to the institution and year. The account number itself is not stored. A hash reduces exposure but is not encryption: a short account number could in principle be recovered from it by trial.</li>
                  <li>• <strong>Activity log:</strong> sign-ins, uploads and conversions, with the file name, size and type, row counts, and error messages with values from your file removed, plus your browser type, language and time zone</li>
                </ul>
                <div className="bg-critical/10 border border-critical/20 rounded p-3 mt-3">
                  <div className="flex items-start">
                    <AlertTriangle className="w-4 h-4 text-critical mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-critical text-sm">
                      <p><strong>Not collected:</strong> the contents of your spreadsheet or of the XML generated from it. Both stay in your browser, and the XML is saved only where you download it.</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-caution mt-2">
                  <strong>Legal Basis:</strong> Performance of our contract with you; legitimate interest in being able to show what was filed
                </p>
              </div>

              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">3.3 Technical data</h3>
                <ul className="text-ink-600 space-y-2">
                  <li>• <strong>Usage analytics, only if you accept analytics cookies:</strong> pages and features used, through Google Analytics for Firebase</li>
                  <li>• <strong>Error reports, if enabled:</strong> technical details of a failure, sent to Sentry with values, emails and numbers removed and without your IP address being stored</li>
                  <li>• <strong>Server logs:</strong> our hosting provider records requests, including IP addresses, to operate and secure the service</li>
                </ul>
                <p className="text-sm text-caution mt-2">
                  <strong>Legal Basis:</strong> Consent (analytics); legitimate interests (error reports, security)
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Data */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">4. How We Use Your Personal Data</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <ul className="text-ink-600 space-y-1">
                <li>• To sign you in and apply usage limits</li>
                <li>• To keep the filing history that corrections and voids depend on</li>
                <li>• To find and fix failures, and to protect the service from abuse</li>
                <li>• To answer support and data protection requests</li>
                <li>• To understand how the service is used, only if you consent to analytics</li>
              </ul>
              <p className="text-ink-600 text-sm mt-3">We do not sell your data and do not use it for advertising.</p>
            </div>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">5. Who Processes Data for Us</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <ul className="text-ink-600 space-y-2">
                <li>• <strong>Google (Firebase):</strong> sign-in, database (account, filing history, activity log), and analytics if you consent</li>
                <li>• <strong>Vercel:</strong> hosting of the website</li>
                <li>• <strong>Sentry:</strong> error reports, when enabled</li>
                <li>• <strong>Authorities or courts:</strong> only when the law requires it</li>
              </ul>
              <p className="text-ink-600 text-sm mt-3">
                We do not take payments, so no payment processor receives your data.
              </p>
            </div>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">6. International Data Transfers</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <p className="text-ink-600">
                The providers above may process data outside Mauritius and the European Economic Area. Where
                the law requires it, these transfers rely on the providers' standard contractual clauses.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">7. Data Retention</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">Account and filings</h3>
                <ul className="text-ink-600 text-sm space-y-1">
                  <li>• Account and filing history: while your account is open</li>
                  <li>• After a deletion request: deleted within 30 days, except what the law requires us to keep</li>
                </ul>
              </div>
              <div className="bg-ink-50 rounded-card p-4">
                <h3 className="text-lg font-semibold text-ink mb-3">Logs</h3>
                <ul className="text-ink-600 text-sm space-y-1">
                  <li>• Your spreadsheet and XML: never leave your browser, so there is nothing for us to delete</li>
                  <li>• Activity log: up to 12 months</li>
                  <li>• Error reports and server logs: the standard retention period of the provider</li>
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
              <ul className="text-ink-600 space-y-2">
                <li>• All traffic is encrypted in transit over HTTPS</li>
                <li>• Data at rest is encrypted by our database provider</li>
                <li>• Database rules let each account read only its own records, and filing records cannot be changed once written</li>
                <li>• Account numbers are stored only as hashes</li>
                <li>• The website is served with a strict Content Security Policy and other security headers</li>
              </ul>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-ink mb-4">10. Cookies and Local Storage</h2>
            <div className="bg-ink-50 rounded-card p-4">
              <ul className="text-ink-600 space-y-2">
                <li>• <strong>Essential:</strong> keeping you signed in, your cookie choice, and the count of free conversions in this browser. These need no consent.</li>
                <li>• <strong>Analytics:</strong> Google Analytics cookies, set only after you accept analytics. Withdrawing consent stops collection and removes them.</li>
              </ul>
              <p className="text-ink-600 text-sm mt-3">
                Fonts are served from this website, not from a third party. You can change your choice at any
                time in <Link to="/cookie-settings" className="text-accent underline">Cookie Settings</Link>.
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
              className="inline-flex items-center px-6 py-3 bg-accent hover:bg-accent text-white rounded-card transition-colors"
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
            This Privacy Policy is effective as of 4 October 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
