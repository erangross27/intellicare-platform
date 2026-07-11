import React, { useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './config/languagesStatic';
import SecurityMonitor from './components/SecurityMonitor';
import MedicalSecurityOverlay from './components/MedicalSecurityOverlay';
import { useSessionManager } from './hooks/useSessionManager';
import { ToastContainer } from './components/ToastNotification';
import { enableChatCopy } from './utils/enableChatCopy';
import './App.css';

// Main chat interface - AI authentication with Claude
import ChatAuthAI from './components/ChatAuthAI';
import MagicLogin from './pages/MagicLogin';
import VerifyEmail from './pages/VerifyEmail';
import DevLoginCallback from './pages/DevLoginCallback';

// Lazy load the SessionWarningModal
const SessionWarningModal = lazy(() => import('./components/SessionWarningModal'));
process.env.NODE_ENV !== 'production' && console.log('🔥 App.jsx: ChatAuthAI imported successfully');

const AppContent = React.memo(() => {
  const { isRTL } = useLanguage();
  const { practice, user, logout } = useAuth();
  
  // Session management hook
  const { showWarning, countdown, extendSession, trackActivity } = useSessionManager(user, logout);

  // Update document title based on practice context
  useEffect(() => {
    if (practice?.name) {
      document.title = `IntelliCare - ${practice.name}`;
    } else {
      document.title = 'IntelliCare';
    }
  }, [practice]);

  // Enable copy functionality for chat messages
  useEffect(() => {
    const cleanup = enableChatCopy();
    return cleanup;
  }, []);

  useEffect(() => {
    // Apply RTL direction to the document
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [isRTL]);

  const appStyles = useMemo(() => ({
    minHeight: '100vh',
    direction: isRTL ? 'rtl' : 'ltr',
    background: '#060A14',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%'
  }), [isRTL]);

  return (
    <div style={appStyles}>
      <SecurityMonitor />
      <MedicalSecurityOverlay />
      <ToastContainer />
      {/* Routes for authentication pages */}
      <Routes>
        <Route path="/magic-login" element={<MagicLogin />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/dev-login-callback" element={<DevLoginCallback />} />
        <Route path="*" element={<ChatAuthAI />} />
      </Routes>
      
      {/* Session Warning Modal - Now inside LanguageProvider */}
      {user && (
        <Suspense fallback={null}>
          <SessionWarningModal
            isVisible={showWarning}
            timeRemaining={countdown}
            onExtendSession={extendSession}
            onLogout={logout}
          />
        </Suspense>
      )}
    </div>
  );
});

AppContent.displayName = 'AppContent';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <AppContent />
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
