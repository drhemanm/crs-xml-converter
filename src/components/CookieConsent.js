import React, { useState, useEffect } from 'react';
import { Cookie, Settings, X, Check, AlertTriangle, ExternalLink } from 'lucide-react';

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cookiePreferences, setCookiePreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    functional: false
  });

  // Check if user has already made a choice
  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Show banner after a brief delay for better UX
      setTimeout(() => setShowBanner(true), 1500);
    } else {
      const savedPreferences = JSON.parse(consent);
      setCookiePreferences(savedPreferences);
      // Initialize tracking based on saved preferences
      initializeTracking(savedPreferences);
    }
  }, []);

  const initializeTracking = (preferences) => {
    // Initialize Google Analytics only if analytics cookies accepted
    if (preferences.analytics && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
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

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true
    };
    setCookiePreferences(allAccepted);
    localStorage.setItem('cookieConsent', JSON.stringify(allAccepted));
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    initializeTracking(allAccepted);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptNecessaryOnly = () => {
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    };
    setCookiePreferences(necessaryOnly);
    localStorage.setItem('cookieConsent', JSON.stringify(necessaryOnly));
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    initializeTracking(necessaryOnly);
    setShowBanner(false);
    setShowSettings(false);
  };

  const saveCustomPreferences = () => {
    localStorage.setItem('cookieConsent', JSON.stringify(cookiePreferences));
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    initializeTracking(cookiePreferences);
    setShowBanner(false);
    setShowSettings(false);
  };

  const togglePreference = (type) => {
    if (type === 'necessary') return; // Cannot disable necessary cookies
    setCookiePreferences(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Cookie Banner - Industry Standard Layout */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/98 backdrop-blur-md border-t border-gray-700 shadow-2xl">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-start justify-between gap-6">
            
            {/* Left Side - Icon and Content */}
            <div className="flex items-start gap-4 flex-1">
              <Cookie className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  We use cookies to enhance your experience
                </h3>
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                  We use essential cookies to make our site work. With your consent, we may also use non-essential cookies to improve user experience and analyze website traffic. By clicking "Accept All," you agree to our use of cookies.
                </p>
                
                {/* Cookie Categories - Horizontal Layout */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-md p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs font-medium text-green-100">Necessary</span>
                    </div>
                    <p className="text-xs text-green-200">Always active</p>
                  </div>
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span className="text-xs font-medium text-blue-100">Analytics</span>
                    </div>
                    <p className="text-xs text-blue-200">Usage insights</p>
                  </div>
                  
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-md p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                      <span className="text-xs font-medium text-purple-100">Functional</span>
                    </div>
                    <p className="text-xs text-purple-200">Preferences</p>
                  </div>
                  
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-md p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                      <span className="text-xs font-medium text-orange-100">Marketing</span>
                    </div>
                    <p className="text-xs text-orange-200">Personalization</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Action Buttons */}
            <div className="flex flex-col gap-3 min-w-fit">
              <button
                onClick={acceptAll}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Accept All
              </button>
              
              <button
                onClick={acceptNecessaryOnly}
                className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Reject All
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className="px-6 py-2.5 bg-transparent hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors border border-gray-500 hover:border-gray-400 whitespace-nowrap"
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Manage
              </button>
            </div>
          </div>

          {/* Legal Links */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 flex flex-wrap items-center gap-4">
              <span>
                By continuing, you agree to our{' '}
                <a href="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</a>
                {' '}and{' '}
                <a href="/terms" className="text-emerald-400 hover:underline">Terms of Service</a>
              </span>
              <span className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                <a href="/cookie-settings" className="text-emerald-400 hover:underline">
                  Change settings anytime
                </a>
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Cookie Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center">
                <Settings className="w-6 h-6 text-emerald-400 mr-3" />
                <h2 className="text-xl font-bold text-white">Cookie Preferences</h2>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="p-6 space-y-6">
                
                {/* Introduction */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-blue-100 text-sm">
                    We use cookies to provide basic functionality and enhance your experience. 
                    You can enable or disable each category below. Some cookies are essential and cannot be disabled.
                  </p>
                </div>

                {/* Necessary Cookies */}
                <div className="bg-white/5 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                        Strictly Necessary Cookies
                      </h3>
                      <p className="text-sm text-gray-300 mt-1">Essential for website functionality</p>
                    </div>
                    <div className="bg-green-500 rounded-full p-2">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="text-gray-300">
                      These cookies are essential for the website to function and cannot be disabled in our systems. 
                      They are usually only set in response to actions made by you which amount to a request for services.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-400">
                      <div>
                        <span className="font-medium">Examples:</span>
                        <ul className="mt-1 space-y-1">
                          <li>• Authentication & security</li>
                          <li>• Session management</li>
                        </ul>
                      </div>
                      <div>
                        <span className="font-medium">Retention:</span>
                        <ul className="mt-1 space-y-1">
                          <li>• Session cookies: Until browser closes</li>
                          <li>• Persistent: Up to 1 year</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="bg-white/5 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                        Performance & Analytics Cookies
                      </h3>
                      <p className="text-sm text-gray-300 mt-1">Help us understand website usage</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cookiePreferences.analytics}
                        onChange={() => togglePreference('analytics')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="text-gray-300">
                      These cookies allow us to count visits and traffic sources so we can measure and improve website performance. 
                      All information collected is aggregated and anonymous.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-400">
                      <div>
                        <span className="font-medium">Examples:</span>
                        <ul className="mt-1 space-y-1">
                          <li>• Google Analytics</li>
                          <li>• Page view tracking</li>
                          <li>• Error monitoring</li>
                        </ul>
                      </div>
                      <div>
                        <span className="font-medium">Data collected:</span>
                        <ul className="mt-1 space-y-1">
                          <li>• Page visits (anonymous)</li>
                          <li>• Time spent on site</li>
                          <li>• Browser information</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Functional Cookies */}
                <div className="bg-white/5 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                        Functional Cookies
                      </h3>
                      <p className="text-sm text-gray-300 mt-1">Enable enhanced functionality and personalization</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cookiePreferences.functional}
                        onChange={() => togglePreference('functional')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="text-gray-300">
                      These cookies enable enhanced functionality and personalization. They may be set by us or by 
                      third-party providers whose services we have added to our pages.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-400">
                      <div>
                        <span className="font-medium">Examples:</span>
                        <ul className="mt-1 space-y-1">
                          <li>• Language preferences</li>
                          <li>• Theme settings</li>
                          <li>• Form data storage</li>
                        </ul>
                      </div>
                      <div>
                        <span className="font-medium">Impact if disabled:</span>
                        <ul className="mt-1 space-y-1">
                          <li>• Preferences reset each visit</li>
                          <li>• Reduced personalization</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="bg-white/5 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                        Targeting & Advertising Cookies
                      </h3>
                      <p className="text-sm text-gray-300 mt-1">Used to deliver relevant advertisements</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cookiePreferences.marketing}
                        onChange={() => togglePreference('marketing')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="text-gray-300">
                      These cookies may be set through our site by our advertising partners to build a profile of your 
                      interests and show you relevant adverts on other sites.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-400">
                      <div>
                        <span className="font-medium">Examples:</span>
                        <ul className="mt-1 space-y-1">
                          <li>• Google Ads</li>
                          <li>• Facebook Pixel</li>
                          <li>• Retargeting tags</li>
                        </ul>
                      </div>
                      <div>
                        <span className="font-medium">Third-party partners:</span>
                        <ul className="mt-1 space-y-1">
                          <li>• Google</li>
                          <li>• Facebook/Meta</li>
                          <li>• LinkedIn</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap gap-3 p-6 border-t border-gray-700 bg-gray-800/50">
              <button
                onClick={saveCustomPreferences}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
              >
                Save Preferences
              </button>
              <button
                onClick={acceptAll}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={acceptNecessaryOnly}
                className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-6 py-2.5 bg-transparent hover:bg-white/10 text-white font-medium rounded-lg transition-colors border border-gray-500"
              >
                Cancel
              </button>
            </div>

            {/* Privacy Links */}
            <div className="px-6 pb-4 text-center">
              <p className="text-xs text-gray-500">
                Learn more in our{' '}
                <a href="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</a>
                {' '}and{' '}
                <a href="/cookie-settings" className="text-emerald-400 hover:underline">Cookie Policy</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieConsent;
