import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where,
} from 'firebase/firestore';
import { Download, Trash2, Edit, Eye, ArrowLeft, Shield, Calendar, AlertTriangle, CheckCircle, Clock, Mail } from 'lucide-react';
import { auth, db } from '../components/CRSXMLConverter';

const SUPPORT_EMAIL = 'contacts@evologics.ai';

const DataRequestPortal = () => {
  const [activeTab, setActiveTab] = useState('request');
  // Requests are stored server-side, keyed on the authenticated account.
  // They used to be written to localStorage in the requester's own browser
  // after a fake two-second delay, so nobody at Evologics was ever told a
  // statutory request had been made -- while the page displayed a 30-day
  // response deadline. Being signed in is also how identity is verified: we
  // hold personal data only for registered accounts.
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestsError, setRequestsError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submittedId, setSubmittedId] = useState(null);
  const [requestType, setRequestType] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    requestType: '',
    description: '',
    urgency: 'normal',
    verificationMethod: 'email'
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestTypes = [
    {
      id: 'access',
      title: 'Right to Access',
      icon: Eye,
      description: 'Request a copy of all personal data we have about you',
      timeline: '30 days',
      details: 'You will receive a comprehensive report of all personal data we process, including data sources, processing purposes, and any third parties we share data with.'
    },
    {
      id: 'rectification',
      title: 'Right to Rectification',
      icon: Edit,
      description: 'Correct inaccurate or incomplete personal data',
      timeline: '30 days',
      details: 'We will correct any inaccurate personal data and complete any incomplete data based on your request and supporting documentation.'
    },
    {
      id: 'erasure',
      title: 'Right to Erasure',
      icon: Trash2,
      description: 'Request deletion of your personal data ("Right to be Forgotten")',
      timeline: '30 days',
      details: 'We will delete your personal data unless we have a legal basis to retain it. This may include data needed for legal compliance or legitimate business interests.'
    },
    {
      id: 'portability',
      title: 'Right to Data Portability',
      icon: Download,
      description: 'Receive your data in a structured, machine-readable format',
      timeline: '30 days',
      details: 'You will receive your data in JSON or CSV format that you can transfer to another service provider.'
    },
    {
      id: 'restriction',
      title: 'Right to Restrict Processing',
      icon: Shield,
      description: 'Limit how we process your personal data',
      timeline: '30 days',
      details: 'We will restrict processing of your data while we verify accuracy or process other requests, but we will not delete it entirely.'
    },
    {
      id: 'objection',
      title: 'Right to Object',
      icon: AlertTriangle,
      description: 'Object to processing based on legitimate interests or direct marketing',
      timeline: '30 days',
      details: 'We will stop processing your data for the specified purposes unless we can demonstrate compelling legitimate grounds.'
    }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setAuthReady(true);
    if (u?.email) setFormData(prev => ({ ...prev, email: u.email }));
  }), []);

  const loadRequests = useCallback(async () => {
    if (!user) { setRequests([]); return; }
    setRequestsError(null);
    try {
      const snap = await getDocs(query(
        collection(db, 'data_requests'),
        where('userId', '==', user.uid),
        orderBy('submittedAt', 'desc'),
        limit(50),
      ));
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      // Surfaced rather than swallowed: a request the user believes was
      // lodged and that we cannot show them is worse than an error message.
      setRequestsError(error.message);
    }
  }, [user]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setSubmitError(null);

    try {
      const ref = await addDoc(collection(db, 'data_requests'), {
        userId: user.uid,
        accountEmail: user.email || null,
        contactEmail: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        requestType: formData.requestType,
        description: formData.description,
        urgency: formData.urgency,
        status: 'received',
        submittedAt: serverTimestamp(),
      });
      setSubmittedId(ref.id);
      setSubmitted(true);
      loadRequests();
    } catch (error) {
      setSubmitError(
        `We could not record your request (${error.message}). ` +
        `Please email ${SUPPORT_EMAIL} instead so it is not lost.`
      );
    } finally {
      setLoading(false);
    }
  };

  // For anyone not signed in. A request made this way lands in a real inbox,
  // which is the whole point.
  const mailtoHref = () => {
    const type = requestTypes.find(t => t.id === requestType);
    const subject = `GDPR request: ${type ? type.title : 'data request'}`;
    const name = `${formData.firstName} ${formData.lastName}`.trim();
    const body = [
      `Request type: ${type ? type.title : requestType}`,
      name ? `Name: ${name}` : null,
      formData.email ? `Email: ${formData.email}` : null,
      '',
      formData.description || '(please add any detail that helps us identify your data)',
    ].filter(line => line !== null).join('\n');
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const formatDate = (value) => {
    const d = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString() : '—';
  };

  const dueDate = (value) => {
    const d = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
    if (!d || isNaN(d.getTime())) return '—';
    return new Date(d.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'received': return <Clock className="w-4 h-4 text-caution" />;
      case 'processing': return <Clock className="w-4 h-4 text-ink" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-affirm" />;
      case 'requires_verification': return <AlertTriangle className="w-4 h-4 text-caution" />;
      default: return <Clock className="w-4 h-4 text-ink-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'received': return 'text-caution';
      case 'processing': return 'text-ink';
      case 'completed': return 'text-affirm';
      case 'requires_verification': return 'text-caution';
      default: return 'text-ink-500';
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        
        {/* Back Button */}
        <div className="mb-8">
          <Link 
            to="/privacy" 
            className="inline-flex items-center px-4 py-2 bg-ink-50 hover:bg-white/20 text-ink rounded-card transition-colors duration-200 backdrop-blur-sm border border-ink-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Privacy Policy
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-accent mr-3" />
            <h1 className="text-4xl font-bold text-ink">Data Request Portal</h1>
          </div>
          <p className="text-xl text-ink-600 max-w-2xl mx-auto">
            Exercise your GDPR rights easily and securely. Submit requests to access, correct, or delete your personal data.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-ink-50 backdrop-blur-sm rounded-card p-1">
            <button
              onClick={() => setActiveTab('request')}
              className={`px-6 py-2 rounded-field transition-colors ${
                activeTab === 'request'
                  ? 'bg-accent text-ink'
                  : 'text-ink-600 hover:text-ink hover:bg-ink-50'
              }`}
            >
              Make a Request
            </button>
            <button
              onClick={() => setActiveTab('status')}
              className={`px-6 py-2 rounded-field transition-colors ${
                activeTab === 'status'
                  ? 'bg-accent text-ink'
                  : 'text-ink-600 hover:text-ink hover:bg-ink-50'
              }`}
            >
              Check Status
            </button>
          </div>
        </div>

        {/* Make a Request Tab */}
        {activeTab === 'request' && !authReady && (
          <div className="bg-ink-50 rounded-card p-8 text-center text-ink-500">Loading…</div>
        )}

        {/* Not signed in: route to a real inbox rather than pretend to file
            something. We hold personal data only for registered accounts, and
            an email is a request a person actually receives. */}
        {activeTab === 'request' && authReady && !user && (
          <div className="bg-ink-50 rounded-card p-8">
            <h2 className="text-2xl font-bold text-ink mb-3">Sign in, or email us</h2>
            <p className="text-ink-600 mb-6 max-w-2xl">
              Requests submitted here are tied to your account, which is how we
              confirm the request comes from you. If you do not have an account
              &mdash; or cannot sign in &mdash; send the request by email instead
              and we will handle it the same way, within the same 30 days.
            </p>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-ink mb-3">Choose your request type</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {requestTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => { setRequestType(type.id); setFormData(prev => ({ ...prev, requestType: type.id })); }}
                    className={`text-left p-4 rounded-card border transition-colors ${
                      requestType === type.id ? 'border-accent bg-accent/5' : 'border-ink-200 bg-white hover:border-ink-300'
                    }`}
                  >
                    <span className="block font-medium text-ink">{type.title}</span>
                    <span className="block text-sm text-ink-600 mt-1">{type.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <a
              href={requestType ? mailtoHref() : `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('GDPR request')}`}
              className="inline-flex items-center px-6 py-3 bg-accent hover:bg-accent-soft text-white rounded-card font-medium transition-colors"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email {SUPPORT_EMAIL}
            </a>
          </div>
        )}

        {activeTab === 'request' && authReady && user && (
          <div className="bg-ink-50 backdrop-blur-sm rounded-card p-8">

            {!submitted ? (
              <>
                {/* Request Types */}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-ink mb-6">Choose Your Request Type</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {requestTypes.map((type) => {
                      const IconComponent = type.icon;
                      return (
                        <div
                          key={type.id}
                          onClick={() => {
                            setRequestType(type.id);
                            setFormData(prev => ({ ...prev, requestType: type.id }));
                          }}
                          className={`cursor-pointer p-4 rounded-card border-2 transition-all duration-200 ${
                            requestType === type.id
                              ? 'border-accent bg-accent/10'
                              : 'border-gray-600 bg-ink-50 hover:border-gray-500'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <IconComponent className={`w-6 h-6 mt-1 ${
                              requestType === type.id ? 'text-accent' : 'text-ink-500'
                            }`} />
                            <div className="flex-1">
                              <h3 className="font-semibold text-ink mb-1">{type.title}</h3>
                              <p className="text-ink-600 text-sm mb-2">{type.description}</p>
                              <div className="flex items-center text-xs text-ink-500">
                                <Calendar className="w-3 h-3 mr-1" />
                                Response time: {type.timeline}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Request Details */}
                {requestType && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-ink mb-4">Request Details</h3>
                    <div className="bg-ink/10 border border-ink-200/20 rounded-card p-4">
                      <p className="text-ink text-sm">
                        {requestTypes.find(type => type.id === requestType)?.details}
                      </p>
                    </div>
                  </div>
                )}

                {/* Request Form */}
                {requestType && (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Personal Information */}
                    <div>
                      <h3 className="text-xl font-semibold text-ink mb-4">Your Information</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-ink-600 mb-2">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 bg-ink-50 border border-gray-600 rounded-card text-ink placeholder-gray-400 focus:outline-none focus:border-accent"
                            placeholder="your@email.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-ink-600 mb-2">
                            First Name *
                          </label>
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 bg-ink-50 border border-gray-600 rounded-card text-ink placeholder-gray-400 focus:outline-none focus:border-accent"
                            placeholder="John"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-ink-600 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-ink-50 border border-gray-600 rounded-card text-ink placeholder-gray-400 focus:outline-none focus:border-accent"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    {/* Request Description */}
                    <div>
                      <label className="block text-sm font-medium text-ink-600 mb-2">
                        Additional Details
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full px-4 py-3 bg-ink-50 border border-gray-600 rounded-card text-ink placeholder-gray-400 focus:outline-none focus:border-accent"
                        placeholder="Please provide any additional information that might help us process your request..."
                      />
                    </div>

                    {/* Urgency */}
                    <div>
                      <label className="block text-sm font-medium text-ink-600 mb-2">
                        Urgency Level
                      </label>
                      <select
                        name="urgency"
                        value={formData.urgency}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-ink-50 border border-gray-600 rounded-card text-ink focus:outline-none focus:border-accent"
                      >
                        <option value="low">Low - Standard processing time</option>
                        <option value="normal">Normal - Within 30 days</option>
                        <option value="high">High - Urgent request (please explain why)</option>
                      </select>
                    </div>

                    {/* Verification Method */}
                    <div>
                      <label className="block text-sm font-medium text-ink-600 mb-2">
                        Identity verification
                      </label>
                      <div className="bg-ink-50 rounded-card p-4 text-sm text-ink-600">
                        Your request is tied to the account you are signed in as
                        (<span className="text-ink">{user?.email}</span>), which is
                        how we verify who is asking. If we need anything further to
                        act on it, we will contact you at that address.
                      </div>
                    </div>

                    {/* Legal Information */}
                    <div className="bg-caution/10 border border-caution/20 rounded-card p-4">
                      <div className="flex items-start">
                        <AlertTriangle className="w-5 h-5 text-caution mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-caution text-sm">
                          <p className="font-medium mb-2">Important Legal Information:</p>
                          <ul className="space-y-1 text-xs">
                            <li>• We will respond to your request within 30 days (may be extended by 2 months for complex requests)</li>
                            <li>• We may request additional information to verify your identity</li>
                            <li>• Some requests may be refused if they are manifestly unfounded or excessive</li>
                            <li>• You have the right to lodge a complaint with your supervisory authority</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-3 bg-accent hover:bg-accent-soft disabled:bg-ink-200 disabled:text-ink-400 text-white rounded-card font-medium transition-colors"
                      >
                        {loading ? 'Submitting…' : 'Submit request'}
                      </button>
                    </div>

                    {submitError && (
                      <div className="rounded-card bg-critical-wash border border-critical/15 p-4 text-[14px] text-ink-700">
                        {submitError}
                      </div>
                    )}
                  </form>
                )}
              </>
            ) : (
              /* Success Message */
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-affirm mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-ink mb-4">Request recorded</h2>
                <p className="text-ink-600 mb-2 max-w-2xl mx-auto">
                  Your request is logged against your account and visible under
                  &ldquo;Check status&rdquo;. We will respond within 30 days.
                </p>
                {submittedId && (
                  <p className="text-ink-500 text-sm font-mono mb-6">Reference {submittedId}</p>
                )}
                <div className="bg-affirm/10 border border-affirm/20 rounded-card p-4 max-w-md mx-auto mb-6">
                  <p className="text-affirm text-sm">
                    <strong>What happens next</strong><br />
                    1. We review the request<br />
                    2. We contact you at {user?.email} if we need more from you<br />
                    3. We respond within 30 days
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setSubmittedId(null);
                    setSubmitError(null);
                    setRequestType('');
                    setFormData({
                      email: '',
                      firstName: '',
                      lastName: '',
                      requestType: '',
                      description: '',
                      urgency: 'normal',
                      verificationMethod: 'email'
                    });
                  }}
                  className="px-6 py-2 bg-accent hover:bg-accent text-ink rounded-card transition-colors"
                >
                  Submit Another Request
                </button>
              </div>
            )}
          </div>
        )}

        {/* Check Status Tab */}
        {activeTab === 'status' && (
          <div className="bg-ink-50 backdrop-blur-sm rounded-card p-8">
            <h2 className="text-2xl font-bold text-ink mb-6">Your data requests</h2>

            {!authReady ? (
              <p className="text-ink-500">Loading…</p>
            ) : !user ? (
              <div className="text-center py-12">
                <Mail className="w-16 h-16 text-ink-500 mx-auto mb-4" />
                <p className="text-ink-600 max-w-lg mx-auto">
                  Sign in to see requests logged against your account. Requests
                  sent by email are tracked in your correspondence with us at{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.
                </p>
              </div>
            ) : requestsError ? (
              <div className="rounded-card bg-critical-wash border border-critical/15 p-4 text-[14px] text-ink-700">
                We could not load your requests ({requestsError}). Nothing has been
                lost &mdash; email {SUPPORT_EMAIL} and we will confirm what we hold.
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-16 h-16 text-ink-500 mx-auto mb-4" />
                <p className="text-ink-600">No data requests found.</p>
                <button
                  onClick={() => setActiveTab('request')}
                  className="mt-4 px-6 py-2 bg-accent hover:bg-accent-soft text-white rounded-card transition-colors"
                >
                  Make your first request
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="bg-white rounded-card p-4 border border-ink-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center">
                          {getStatusIcon(request.status)}
                          <span className={`ml-2 font-medium ${getStatusColor(request.status)}`}>
                            {String(request.status || 'received').replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <span className="text-ink-500">&bull;</span>
                        <span className="text-ink-600 font-mono text-sm">{request.id}</span>
                      </div>
                      <span className="text-ink-500 text-sm">
                        {formatDate(request.submittedAt)}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-ink-500">Request type:</span>
                        <p className="text-ink">
                          {requestTypes.find(type => type.id === request.requestType)?.title || request.requestType}
                        </p>
                      </div>
                      <div>
                        <span className="text-ink-500">Contact email:</span>
                        <p className="text-ink">{request.contactEmail || request.accountEmail}</p>
                      </div>
                      <div>
                        <span className="text-ink-500">Response due by:</span>
                        <p className="text-ink">{dueDate(request.submittedAt)}</p>
                      </div>
                    </div>

                    {request.description && (
                      <div className="mt-3 pt-3 border-t border-ink-200">
                        <span className="text-ink-500 text-sm">Additional details:</span>
                        <p className="text-ink-600 text-sm mt-1">{request.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Information */}
        <div className="text-center mt-12">
          <div className="bg-ink/10 border border-ink-200/20 rounded-card p-4 max-w-2xl mx-auto">
            <p className="text-ink text-sm">
              <strong>Need Help?</strong><br />
              If you have questions about your data request or need assistance, contact our Data Protection Officer at{' '}
              <a href="mailto:contacts@evologics.ai" className="underline">contacts@evologics.ai</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataRequestPortal;
