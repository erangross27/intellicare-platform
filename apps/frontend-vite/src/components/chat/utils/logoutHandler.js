import secureStorage from '../../../utils/secureStorage';
import secureApi from '../../../services/secureApiClient';

/**
 * Logout command detection and handling
 */

// List of logout commands in different languages
const LOGOUT_COMMANDS = [
  'logout',
  'disconnect',
  'exit',
  'quit',
  'signout',
  'sign out',
  'log out',
  // Hebrew commands
  'התנתק',
  'יציאה',
  'צא',
  'להתנתק',
  'לצאת'
];

/**
 * Check if message is a logout command
 * @param {string} message - User message
 * @returns {boolean} - True if message is a logout command
 */
export const isLogoutCommand = (message) => {
  if (!message) return false;
  
  const normalizedMessage = message.toLowerCase().trim();
  return LOGOUT_COMMANDS.includes(normalizedMessage);
};

/**
 * Handle logout - call API and clear auth
 */
export const handleLogout = async () => {
  // Set flag BEFORE logout to prevent auto-reconnect
  sessionStorage.setItem('intentionalLogout', 'true');
  
  try {
    // Call logout API endpoint first - use practice-auth endpoint for proper session cleanup
    await secureApi.post('/api/practice-auth/logout');
  } catch (error) {
    // Try alternative logout endpoint if practice-auth fails
    try {
      await secureApi.post('/api/auth/logout');
    } catch (secondError) {
      // Continue with logout even if API calls fail
      process.env.NODE_ENV !== 'production' && console.error('Logout API failed:', error, secondError);
    }
  }
  
  // Clear all authentication data
  secureStorage.clear();
  
  // Keep the logout flag in sessionStorage (it survives secureStorage.clear())
  sessionStorage.setItem('intentionalLogout', 'true');
  
  // Remove any cookies (if any)
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
  
  // Reload the page to show login screen
  window.location.reload();
};

export default {
  isLogoutCommand,
  handleLogout
};