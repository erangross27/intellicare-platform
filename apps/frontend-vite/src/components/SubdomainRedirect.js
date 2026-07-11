import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

import secureStorage from '../utils/secureStorage';
const SubdomainRedirect = ({ children }) => {
  const { practice } = useAuth();

  useEffect(() => {
    const checkAndRedirectToSubdomain = () => {
      const currentHost = window.location.hostname;
      const currentPort = window.location.port;
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const currentHash = window.location.hash;

      // DISABLED: Skip subdomain redirects for simple localhost development
      if (currentHost === 'localhost') {
        process.env.NODE_ENV !== 'production' && console.log('🔧 SUBDOMAIN: Skipping redirect for localhost development');
        return;
      }

      // Redirect to proper subdomain based on environment
      const isLocalhost = currentHost === 'localhost' || currentHost === 'intellicare.health';
      const isDevelopment = currentPort === '3000' || currentPort === 3000;

      if (isLocalhost && practice && practice.subdomain) {
        const targetSubdomain = practice.subdomain;
        const baseDomain = isDevelopment ? 'intellicare.health' : 'intellicare.health';
        const targetHost = `${targetSubdomain}.${baseDomain}`;

        // Don't redirect if we're already on the correct subdomain
        if (currentHost !== targetHost) {
          const protocol = isDevelopment ? 'http' : 'https';
          const port = isDevelopment ? `:${currentPort || '3000'}` : '';
          const newUrl = `${protocol}://${targetHost}${port}${currentPath}${currentSearch}${currentHash}`;

          process.env.NODE_ENV !== 'production' && console.log(`🌐 Redirecting to practice subdomain: ${newUrl}`);
          process.env.NODE_ENV !== 'production' && console.log(`📋 Practice info:`, { name: practice.name, subdomain: practice.subdomain });

          // Perform the redirect
          window.location.href = newUrl;
          return;
        }
      }

      // Check if we're already on the correct subdomain
      if ((currentHost.includes('.localhost') || currentHost.includes('.intellicare.health')) && practice && practice.subdomain) {
        const currentSubdomain = currentHost.split('.')[0];
        if (currentSubdomain === practice.subdomain) {
          // We're already on the correct subdomain, no redirect needed
          process.env.NODE_ENV !== 'production' && console.log(`✅ Already on correct subdomain: ${currentHost}`);
          return;
        }
      }
      
      // For development: Also check localStorage for practice subdomain
      const storedPracticeSubdomain = secureStorage.getItem('practiceSubdomain');
      const isMainDomain = currentHost === 'localhost' || currentHost === 'intellicare.health';

      if (isMainDomain && storedPracticeSubdomain && storedPracticeSubdomain !== 'localhost') {
        const targetSubdomain = storedPracticeSubdomain;
        const baseDomain = isDevelopment ? 'intellicare.health' : 'intellicare.health';
        const targetHost = `${targetSubdomain}.${baseDomain}`;

        // Don't redirect if we're already on the correct subdomain
        if (currentHost !== targetHost) {
          const protocol = isDevelopment ? 'http' : 'https';
          const port = isDevelopment ? `:${currentPort || '3000'}` : '';
          const newUrl = `${protocol}://${targetHost}${port}${currentPath}${currentSearch}${currentHash}`;

          process.env.NODE_ENV !== 'production' && console.log(`🌐 Redirecting to stored practice subdomain: ${newUrl}`);
          process.env.NODE_ENV !== 'production' && console.log(`📋 Stored subdomain:`, storedPracticeSubdomain);

          // Perform the redirect
          window.location.href = newUrl;
          return;
        }
      }

      // Check if we're already on the correct subdomain from localStorage
      if (currentHost.includes('.localhost') && storedPracticeSubdomain) {
        const currentSubdomain = currentHost.split('.')[0];
        if (currentSubdomain === storedPracticeSubdomain) {
          // We're already on the correct subdomain, no redirect needed
          process.env.NODE_ENV !== 'production' && console.log(`✅ Already on correct stored subdomain: ${currentHost}`);
          return;
        }
      }
    };

    // Small delay to ensure auth context is loaded
    const timeoutId = setTimeout(checkAndRedirectToSubdomain, 100);
    
    return () => clearTimeout(timeoutId);
  }, [practice]);

  // Render children normally (no UI changes)
  return children;
};

export default SubdomainRedirect;
