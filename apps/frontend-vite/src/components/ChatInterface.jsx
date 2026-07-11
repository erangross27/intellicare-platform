import React from 'react';
import ChatContainer from './chat/ChatContainer';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../config/languagesStatic';
import LanguageSwitcher from './LanguageSwitcher';

import secureStorage from '../utils/secureStorage';
/**
 * ChatInterface - Optimized version using new modular chat
 * 
 * Previous: 3288 lines of complex code
 * Now: Simple wrapper around modular ChatContainer (818 total lines)
 * 
 * Features:
 * - Automatic password masking (••••••••)
 * - Session persistence across refreshes
 * - Small modular components (all under 200 lines)
 * - Clean inline styles (no complex CSS)
 */
const ChatInterface = ({ 
  apiEndpoint = '/api/agent/chat',
  initialMessages = [],
  onContextUpdate
}) => {
  const { user, practice } = useAuth();
  const { currentLanguage, isRTL } = useLanguage();
  
  // Get auth token from storage (token is stored separately, not in user object)
  const authToken = secureStorage.getItem('token') || secureStorage.getItem('authToken');
  
  // Get practice from context or default
  const practiceName = practice?.subdomain || 'developer';
  
  // Build full API URL (using proxy)
  const apiUrl = '/api';
  
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <ChatContainer
        apiUrl={apiUrl}
        practice={practiceName}
        authToken={authToken}
        language={currentLanguage}
        initialMessages={initialMessages}
        onContextUpdate={onContextUpdate}
      />
    </div>
  );
};

export default ChatInterface;