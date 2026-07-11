import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import secureApi from '../services/secureApiClient';
import secureStorage from '../utils/secureStorage';

/**
 * Domain Router Component
 * Handles intelligent routing based on domain context
 * - Top domain (intellicare.health) → Registration/Login detection
 * - Subdomain → Normal practice flow
 */
const DomainRouter = ({ children }) => {
  const { user, practice, checkAuthStatus } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [domainContext, setDomainContext] = useState(null);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState(null);

  useEffect(() => {
    const detectDomainContext = async () => {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      
      // Determine if we're on top domain or subdomain
      const isTopDomain = 
        hostname === 'intellicare.health' ||
        hostname === 'localhost' ||
        parts[0] === 'intellicare' ||
        (parts.length === 2 && parts[1] === 'health');
      
      const isSubdomain = !isTopDomain && parts.length > 2;
      const subdomain = isSubdomain ? parts[0] : null;
      
      console.log('🌐 Domain Context:', {
        hostname,
        isTopDomain,
        isSubdomain,
        subdomain
      });
      
      setDomainContext({
        isTopDomain,
        isSubdomain,
        subdomain,
        hostname
      });
      
      // If on top domain, check for existing session
      if (isTopDomain) {
        try {
          // Check if user has an active session
          const sessionCheck = await checkAuthStatus();
          
          if (sessionCheck && sessionCheck.user && sessionCheck.practice) {
            // User is logged in, redirect to their practice
            const practiceSubdomain = sessionCheck.practice.subdomain;
            const protocol = window.location.protocol;
            const port = window.location.port ? `:${window.location.port}` : '';
            const targetUrl = `${protocol}//${practiceSubdomain}.intellicare.health${port}/`;
            
            console.log('🔄 User has session, redirecting to practice:', targetUrl);
            setShouldRedirect(true);
            setRedirectUrl(targetUrl);
            
            // Perform redirect after a brief delay to show loading state
            setTimeout(() => {
              window.location.href = targetUrl;
            }, 1000);
          } else {
            // No session, show registration/login interface
            console.log('👤 No session found, showing auth interface');
            setIsChecking(false);
          }
        } catch (error) {
          console.log('❌ Session check error:', error);
          // Error checking session, show auth interface
          setIsChecking(false);
        }
      } else if (isSubdomain) {
        // On subdomain, verify it's the correct practice
        try {
          const sessionCheck = await checkAuthStatus();
          
          if (sessionCheck && sessionCheck.user && sessionCheck.practice) {
            // Check if user is on the correct subdomain
            if (sessionCheck.practice.subdomain !== subdomain) {
              // Wrong subdomain, redirect to correct one
              const correctSubdomain = sessionCheck.practice.subdomain;
              const protocol = window.location.protocol;
              const port = window.location.port ? `:${window.location.port}` : '';
              const targetUrl = `${protocol}//${correctSubdomain}.intellicare.health${port}/`;
              
              console.log('⚠️ Wrong practice subdomain, redirecting:', targetUrl);
              setShouldRedirect(true);
              setRedirectUrl(targetUrl);
              
              setTimeout(() => {
                window.location.href = targetUrl;
              }, 1000);
            } else {
              // Correct subdomain, proceed normally
              console.log('✅ Correct practice subdomain');
              setIsChecking(false);
            }
          } else {
            // No session on subdomain, proceed with login
            setIsChecking(false);
          }
        } catch (error) {
          console.log('❌ Subdomain check error:', error);
          setIsChecking(false);
        }
      }
    };
    
    detectDomainContext();
  }, [checkAuthStatus]);
  
  // Handle email-based practice detection
  const detectUserPractice = async (email) => {
    try {
      // Call API to check which practice this email belongs to
      const response = await secureApi.post('/api/auth/detect-practice', { email });
      
      if (response.data.success && response.data.practice) {
        return {
          exists: true,
          subdomain: response.data.practice.subdomain,
          needsRedirect: domainContext.isTopDomain
        };
      }
      
      return {
        exists: false,
        needsRedirect: false
      };
    } catch (error) {
      console.error('❌ Error detecting user practice:', error);
      return {
        exists: false,
        needsRedirect: false
      };
    }
  };
  
  // Handle successful authentication
  const handleAuthSuccess = (userData, practiceData) => {
    if (domainContext.isTopDomain && practiceData.subdomain) {
      // Redirect to practice subdomain
      const protocol = window.location.protocol;
      const port = window.location.port ? `:${window.location.port}` : '';
      const targetUrl = `${protocol}//${practiceData.subdomain}.intellicare.health${port}/`;
      
      console.log('🚀 Authentication successful, redirecting to:', targetUrl);
      
      // Store session info for cross-domain access
      secureStorage.setItem('pendingAuth', {
        user: userData,
        practice: practiceData,
        timestamp: Date.now()
      });
      
      // Smooth redirect with loading state
      setShouldRedirect(true);
      setRedirectUrl(targetUrl);
      
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 1500);
    }
  };
  
  // Loading state while checking domain context
  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>
          🏥
        </div>
        <h2 style={{ color: '#667eea', marginBottom: '10px' }}>IntelliCare</h2>
        <p style={{ color: '#6c757d' }}>Loading...</p>
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }
  
  // Redirect loading state
  if (shouldRedirect && redirectUrl) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px',
          animation: 'bounce 0.6s ease-in-out infinite'
        }}>
          ✨
        </div>
        <h2 style={{ color: '#27ae60', marginBottom: '10px' }}>
          Redirecting to your practice...
        </h2>
        <p style={{ color: '#6c757d', fontSize: '14px' }}>
          Taking you to {redirectUrl}
        </p>
        <div style={{
          marginTop: '20px',
          width: '200px',
          height: '4px',
          backgroundColor: '#e0e0e0',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            backgroundColor: '#667eea',
            animation: 'loading 1.5s ease-in-out infinite'
          }} />
        </div>
        <style>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes loading {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 100%; }
          }
        `}</style>
      </div>
    );
  }
  
  // Pass domain context to children
  return React.cloneElement(children, {
    domainContext,
    detectUserPractice,
    handleAuthSuccess
  });
};

export default DomainRouter;