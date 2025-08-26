import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie, Settings, Check, X, AlertTriangle, Shield, Eye, Target } from 'lucide-react';

const CookieSettings = () => {
  const [cookiePreferences, setCookiePreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    functional: false
  });
  const [saved, setSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Load existing preferences on component mount
  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (consent) {
      const savedPreferences = JSON.parse(consent);
      setCookiePreferences(savedPreferences);
    }
    
    const consentDate = localStorage.getItem('cookieConsentDate');
    if (consentDate) {
      setLastSaved(new Date(consentDate));
    }
  }, []);

  const togglePreference = (type) => {
    if (type === 'necessary') return; // Cannot disable necessary cookies
    setCookiePreferences(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const savePreferences = () => {
    localStorage.setItem('cookieConsent', JSON.stringify(cookiePreferences));
    const now = new Date();
    localStorage.setItem('cookieConsentDate', now.toISOString());
    setLastSaved(now);
    setSaved(true);
    
    // Initialize tracking based on preferences
    initializeTracking(cookiePreferences);
    
    // Hide success message after 3 seconds
    setTimeout(() => setSaved(false), 3000);
  };

  const initializeTracking = (preferences) => {
    // Initialize Google Analytics only if analytics cookies accepted
    if (preferences.analytics && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
    } else if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
      });
    }

    // Initialize other tracking services based on preferences
    if (preferences.marketing) {
      console.log('Marketing tracking initialized');
    }

    if (preferences.functional) {
      console.log('Functional cookies initialized');
    }
  };

  const resetPreferences = () => {
    localStorage.removeItem('cookieConsent');
    localStorage.removeItem('cookieConsentDate');
    setCookiePreferences({
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    });
    setLastSaved(null);
    setSaved(false);
  };

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true
    };
    setCookiePreferences(allAccepted);
    localStorage.setItem('cookieConsent', JSON.stringify(allAccepted));
    const now = new Date();
    localStorage.setItem('cookieConsentDate', now.toISOString());
    setLastSaved(now);
    setSaved(true);
    initializeTracking(allAccepted);
    setTimeout(() => setSaved(false), 3000);
  };

  const rejectAll = () => {
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    };
    setCookiePreferences(necessaryOnly);
    localStorage.setItem('cookieConsent', JSON.stringify(necessaryOnly));
    const now = new Date();
    localStorage.setItem('cookieConsentDate', now.toISOString());
    setLastSaved(now);
    setSaved(true);
    initializeTracking(necessaryOnly);
    setTimeout(() => setSaved(false), 3000);
  };

  const cookieCategories = [
    {
      id: 'necessary',
      title: 'Necessary Cookies',
      icon: Shield,
      color: 'green',
      required: true,
      description: 'Essential for the website to function properly. These cookies cannot be disabled.',
      purpose: 'Authentication, security, basic site functionality',
      examples: [
        'Session management and user authentication',
        'Security tokens and CSRF protection',
        'Load balancing and server routing',
        'Essential site functionality'
      ],
      retention: 'Session or until logout',
      thirdParty: false
    },
    {
      id: 'analytics',
      title: 'Analytics Cookies',
      icon: Eye,
      color: 'blue',
      required: false,
      description: 'Help us understand how visitors interact with our website by collecting anonymous information.',
      purpose: 'Website performance analysis, user behavior insights',
      examples: [
        'Google Analytics (anonymized IP addresses)',
        'Page view tracking and user paths',
        'Performance monitoring and error tracking',
        'A/B testing for service improvements'
      ],
      retention: '13 months (Google Analytics standard)',
      thirdParty: true
    },
    {
      id: 'functional',
      title: 'Functional Cookies',
      icon: Settings,
      color: 'purple',
      required: false,
      description: 'Enable enhanced functionality and personalization features.',
      purpose: 'Improved user experience, preference storage',
      examples: [
        'Language and region preferences',
        'Theme and display settings',
        'Form data and user preferences',
        'Accessibility settings'
      ],
      retention: '12 months or until changed',
      thirdParty: false
    },
    {
      id: 'marketing',
      title: 'Marketing Cookies',
      icon: Target,
      color: 'orange',
      required: false,
      description: 'Used to deliver relevant advertisements and track marketing campaign effectiveness.',
      purpose: 'Targeted advertising, conversion tracking',
      examples: [
        'Google Ads conversion tracking',
        'Social media pixels (Facebook, LinkedIn)',
        'Retargeting and remarketing',
        'Email marketing optimization'
      ],
      retention: '90 days to 2 years depending on service',
      thirdParty: true
    }
  ];

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
            <Cookie className="w-12 h-12 text-emerald-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">Cookie Settings</h1>
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Manage your cookie preferences and control how we collect and use data to improve your experience.
          </p>
        </div>

        {/* Success Message */}
        {saved && (
          <div className="mb-6">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center">
                <Check className="w-5 h-5 text-green-400 mr-2" />
                <span className="text-green-100 font-medium">
                  Cookie preferences saved successfully!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Last Saved Info */}
        {lastSaved && (
          <div className="mb-6">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-blue-100 text-sm">
                <strong>Last updated:</strong> {lastSaved.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Cookie Categories */}
        <div className="space-y-6 mb-8">
          {cookieCategories.map((category) => {
            const IconComponent = category.icon;
            const isEnabled = cookiePreferences[category.id];
            
            return (
              <div key={category.id} className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                <div className="p-6">
                  
                  {/* Category Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`bg-${category.color}-500/20 p-3 rounded-lg mr-4`}>
                        <IconComponent className={`w-6 h-6 text-${category.color}-400`} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">{category.title}</h2>
                        <p className="text-gray-300 text-sm">{category.description}</p>
                      </div>
                    </div>
                    
                    {/* Toggle Switch */}
                    <div className="flex items-center">
                      {category.required ? (
                        <div className="bg-green-500 rounded-full p-2">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      ) : (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => togglePreference(category.id)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Category Details */}
                  <div className="grid md:grid-cols-2 gap-6">
                    
                    {/* Purpose & Examples */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">PURPOSE</h3>
                      <p className="text-white text-sm mb-3">{category.purpose}</p>
                      
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">EXAMPLES</h3>
                      <ul className="text-gray-300 text-sm space-y-1">
                        {category.examples.map((example, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-emerald-400 mr-2">•</span>
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Technical Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">RETENTION PERIOD</h3>
                      <p className="text-white text-sm mb-3">{category.retention}</p>
                      
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">THIRD-PARTY COOKIES</h3>
                      <div className="flex items-center mb-3">
                        {category.thirdParty ? (
                          <X className="w-4 h-4 text-red-400 mr-2" />
                        ) : (
                          <Check className="w-4 h-4 text-green-400 mr-2" />
                        )}
                        <span className="text-white text-sm">
                          {category.thirdParty ? 'May include third-party services' : 'First-party only'}
                        </span>
                      </div>

                      {category.required && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2">
                          <div className="flex items-start">
                            <AlertTriangle className="w-4 h-4 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                            <p className="text-amber-100 text-xs">
                              Required for basic functionality. Cannot be disabled.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={savePreferences}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              Save Preferences
            </button>
            <button
              onClick={acceptAll}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={rejectAll}
              className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Necessary Only
            </button>
            <button
              onClick={resetPreferences}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8 space-y-6">
          
          {/* Impact of Disabling Cookies */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6">
            <div className="flex items-start">
              <AlertTriangle className="w-6 h-6 text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-amber-100 mb-2">Impact of Cookie Settings</h3>
                <div className="text-amber-100 text-sm space-y-2">
                  <p><strong>Analytics Disabled:</strong> We won't be able to understand how you use our service or improve it based on user behavior.</p>
                  <p><strong>Functional Disabled:</strong> You'll need to reset your preferences each visit, and personalization features won't work.</p>
                  <p><strong>Marketing Disabled:</strong> You may see less relevant advertising, and we can't measure marketing effectiveness.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Information */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-100 mb-2">Your Privacy Rights</h3>
            <div className="text-blue-100 text-sm space-y-2">
              <p>You can change these settings at any time. Your choices will be remembered for future visits.</p>
              <p>
                For more information about how we handle your data, see our{' '}
                <Link to="/privacy" className="underline hover:text-blue-200">Privacy Policy</Link> or{' '}
                <Link to="/data-request" className="underline hover:text-blue-200">submit a data request</Link>.
              </p>
              <p>If you have questions, contact our Data Protection Officer at dpo@iafrica.solutions</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">
            Cookie preferences last updated: {lastSaved ? lastSaved.toLocaleDateString() : 'Not set'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CookieSettings;
