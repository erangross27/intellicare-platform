/**
 * Chat configuration settings
 */

export const CHAT_CONFIG = {
  // API settings
  API: {
    DEFAULT_URL: '/api',
    DEFAULT_CLINIC: 'developer',
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3
  },
  
  // Message settings
  MESSAGES: {
    MAX_LENGTH: 5000,
    MIN_LENGTH: 1,
    PASSWORD_MASK: '••••••••'
  },
  
  // Session settings
  SESSION: {
    MAX_MESSAGES: 1000,
    AUTO_SAVE_INTERVAL: 5000, // 5 seconds
    TITLE_MAX_LENGTH: 50
  },
  
  // UI settings
  UI: {
    SIDEBAR_WIDTH: '280px',
    HEADER_HEIGHT: '60px',
    MESSAGE_ANIMATION_DURATION: 300,
    TYPING_INDICATOR_DELAY: 500
  },
  
  // Theme colors
  THEME: {
    DARK: {
      background: '#1e1e1e',
      sidebar: '#252525',
      header: '#2d2d2d',
      border: '#3a3a3a',
      text: '#e0e0e0',
      textMuted: '#888888',
      userMessage: '#3b82f6',
      agentMessage: '#2d2d2d',
      error: '#dc2626',
      success: '#10b981'
    }
  },
  
  // Language settings
  LANGUAGES: {
    HEBREW: 'he',
    ENGLISH: 'en'
  },
  
  // File upload settings
  FILE_UPLOAD: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: [
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.txt',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.svg'
    ]
  }
};

export default CHAT_CONFIG;