import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2, Edit, Eye, ArrowLeft, Shield, Calendar, AlertTriangle, CheckCircle, Clock, Mail } from 'lucide-react';

const DataRequestPortal = () => {
  const [activeTab, setActiveTab] = useState('request');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    try {
      // In real implementation, this would be an API call to your backend
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Store request in localStorage for demo purposes
      const requestId = 'DR-' + Date.now();
      const request = {
        id: requestId,
        ...formData,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      const existingRequests = JSON.parse(localStorage.getItem('dataRequests') || '[]');
      existingRequests.push(request);
      localStorage.setItem('dataRequests', JSON.stringify(existingRequests));
      
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting request:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStoredRequests = () => {
    return JSON.parse(localStorage.getItem('dataRequests') || '[]');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'submitted': return <Clock className="w-4 h-4 text-amber-400" />;
      case 'processing': return <Clock className="w-4 h-4 text-blue-400" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'requires_verification': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'text-amber-400';
      case 'processing': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      case 'requires_verification': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        
        {/* Back Button */}
        <div className="mb-8">
          <Link 
            to="/privacy" 
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors duration-200 backdrop-blur-sm border border-white/20"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Privacy Policy
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-emerald-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">Data Request Portal</h1>
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Exercise your GDPR rights easily and securely. Submit requests to access, correct, or delete your personal data.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1">
            <button
              onClick={() => setActiveTab('request')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'request'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              Make a Request
            </button>
            <button
              onClick={() => setActiveTab('status')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'status'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              Check Status
            </button>
          </div>
        </div>

        {/* Make a Request Tab */}
        {activeTab === 'request' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            
            {!submitted ? (
              <>
                {/* Request Types */}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-white mb-6">Choose Your Request Type</h2>
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
                          className={`cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 ${
                            requestType === type.id
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-gray-600 bg-white/5 hover:border-gray-500'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <IconComponent className={`w-6 h-6 mt-1 ${
                              requestType === type.id ? 'text-emerald-400' : 'text-gray-400'
                            }`} />
                            <div className="flex-1">
                              <h3 className="font-semibold text-white mb-1">{type.title}</h3>
                              <p className="text-gray-300 text-sm mb-2">{type.description}</p>
                              <div className="flex items-center text-xs text-gray-400">
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
                    <h3 className="text-xl font-semibold text-white mb-4">Request Details</h3>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                      <p className="text-blue-100 text-sm">
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
                      <h3 className="text-xl font-semibold text-white mb-4">Your Information</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                            placeholder="your@email.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            First Name *
                          </label>
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                            placeholder="John"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    {/* Request Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Additional Details
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                        placeholder="Please provide any additional information that might help us process your request..."
                      />
                    </div>

                    {/* Urgency */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Urgency Level
                      </label>
                      <select
                        name="urgency"
                        value={formData.urgency}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="low">Low - Standard processing time</option>
                        <option value="normal">Normal - Within 30 days</option>
                        <option value="high">High - Urgent request (please explain why)</option>
                      </select>
                    </div>

                    {/* Verification Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Identity Verification Method
                      </label>
                      <select
                        name="verificationMethod"
                        value={formData.verificationMethod}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-white/10 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="email">Email verification (recommended)</option>
                        <option value="account">Account login verification</option>
                        <option value="document">Document verification (for high-risk requests)</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-2">
                        We may require additional verification for certain types of requests to protect your privacy.
                      </p>
                    </div>

                    {/* Legal Information */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertTriangle className="w-5 h-5 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-amber-100 text-sm">
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
                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                      >
                        {loading ? 'Submitting...' : 'Submit Request'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              /* Success Message */
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-white mb-4">Request Submitted Successfully</h2>
                <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                  Your data request has been received and is being processed. You will receive an email confirmation 
                  shortly with your request ID and next steps.
                </p>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 max-w-md mx-auto mb-6">
                  <p className="text-green-100 text-sm">
                    <strong>What happens next?</strong><br />
                    1. Email confirmation sent<br />
                    2. Identity verification (if required)<br />
                    3. Request processing (up to 30 days)<br />
                    4. Response delivered via email
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSubmitted(false);
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
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                >
                  Submit Another Request
                </button>
              </div>
            )}
          </div>
        )}

        {/* Check Status Tab */}
        {activeTab === 'status' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Your Data Requests</h2>
            
            {getStoredRequests().length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-300">No data requests found.</p>
                <button
                  onClick={() => setActiveTab('request')}
                  className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                >
                  Make Your First Request
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {getStoredRequests().map((request) => (
                  <div key={request.id} className="bg-white/5 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center">
                          {getStatusIcon(request.status)}
                          <span className={`ml-2 font-medium ${getStatusColor(request.status)}`}>
                            {request.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-300 font-mono text-sm">{request.id}</span>
                      </div>
                      <span className="text-gray-400 text-sm">
                        {new Date(request.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Request Type:</span>
                        <p className="text-white">
                          {requestTypes.find(type => type.id === request.requestType)?.title}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">Email:</span>
                        <p className="text-white">{request.email}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Estimated Completion:</span>
                        <p className="text-white">
                          {new Date(request.estimatedCompletion).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {request.description && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <span className="text-gray-400 text-sm">Additional Details:</span>
                        <p className="text-gray-300 text-sm mt-1">{request.description}</p>
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
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-blue-100 text-sm">
              <strong>Need Help?</strong><br />
              If you have questions about your data request or need assistance, contact our Data Protection Officer at{' '}
              <a href="mailto:dpo@iafrica.solutions" className="underline">dpo@iafrica.solutions</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataRequestPortal;
