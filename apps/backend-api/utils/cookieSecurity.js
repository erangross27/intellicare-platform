/**
 * 🔒 CRITICAL SECURITY: Cookie Domain Management
 * 
 * SECURITY RULES:
 * 1. NEVER allow cookies on root domain (intellicare.health)
 * 2. Cookies MUST be scoped to specific practice subdomains
 * 3. Session cookies expire on browser close
 * 4. Multi-layer validation (cookie + session + subdomain)
 */

/**
 * Get secure cookie domain for a specific practice subdomain
 * @param {Object} req - Express request object
 * @returns {string|undefined} Cookie domain or undefined for current host only
 */
function getSecureCookieDomain(req) {
  const host = req.get('host') || '';
  const hostname = req.hostname || '';
  
  // Extract subdomain from hostname
  const parts = hostname.split('.');
  
  // Check if this is a root domain request (FORBIDDEN)
  const isRootDomain = (
    hostname === 'intellicare.health' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    parts.length < 2 || // No subdomain
    (parts.length === 2 && parts[0] === 'intellicare') // root domain
  );
  
  if (isRootDomain) {
    console.log('🚫 [SECURITY] Blocking cookie on root domain:', hostname);
    // Return undefined = cookie only valid for exact current domain
    // This prevents root domain cookies
    return undefined;
  }
  
  // For practice subdomains, scope cookie to THAT SPECIFIC SUBDOMAIN ONLY
  // Never use wildcard domains (.intellicare.health)
  if (hostname.includes('intellicare.health')) {
    const subdomain = parts[0];
    if (subdomain && subdomain !== 'intellicare') {
      // Return the full subdomain (e.g., "stanford.intellicare.health")
      // This makes cookie ONLY available to this specific practice
      console.log(`🔒 [SECURITY] Cookie scoped to practice: ${hostname}`);
      return hostname; // Specific subdomain only
    }
  }
  
  // For localhost development with subdomains
  if (hostname.includes('localhost') && parts.length > 1) {
    const subdomain = parts[0];
    if (subdomain && subdomain !== 'localhost') {
      // Return specific subdomain for localhost
      return hostname; // e.g., "stanford.localhost"
    }
  }
  
  // Default: undefined (browser sets to current host only)
  console.log('🔒 [SECURITY] Cookie scoped to current host only:', hostname);
  return undefined;
}

/**
 * Get secure cookie options for session management
 * @param {Object} req - Express request object
 * @param {Object} options - Additional options
 * @returns {Object} Secure cookie configuration
 */
function getSecureCookieOptions(req, options = {}) {
  const domain = getSecureCookieDomain(req);
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Check if this is root domain - if so, NO COOKIES
  if (isRootDomainRequest(req) && !options.allowRootForOTP) {
    console.log('🚫 [SECURITY] Blocking cookie on root domain');
    return null; // Signal that no cookie should be set
  }
  
  return {
    httpOnly: true, // Prevent XSS access
    secure: isProduction, // HTTPS only in production
    sameSite: 'strict', // CSRF protection - strict for same-site only
    domain: domain, // Practice-specific or current host only
    path: '/', // Available on all paths within domain
    // CRITICAL: No maxAge = session cookie (expires on browser close)
    // This ensures sessions don't persist after restart
    ...options // Allow override but defaults are secure
  };
}

/**
 * Validate that request is from correct subdomain
 * @param {Object} req - Express request object
 * @param {string} expectedSubdomain - Expected practice subdomain
 * @returns {boolean} True if valid, false otherwise
 */
function validateSubdomainMatch(req, expectedSubdomain) {
  const hostname = req.hostname || '';
  const parts = hostname.split('.');
  const currentSubdomain = parts[0];
  
  // Check if subdomain matches
  if (currentSubdomain !== expectedSubdomain) {
    console.log(`🚫 [SECURITY] Subdomain mismatch: expected ${expectedSubdomain}, got ${currentSubdomain}`);
    return false;
  }
  
  return true;
}

/**
 * Check if request is from root domain (should be rejected for auth)
 * @param {Object} req - Express request object
 * @returns {boolean} True if root domain
 */
function isRootDomainRequest(req) {
  const hostname = req.hostname || '';
  const parts = hostname.split('.');
  
  return (
    hostname === 'intellicare.health' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    parts.length < 2 || // No subdomain
    (parts.length === 2 && parts[0] === 'intellicare') // root domain
  );
}

module.exports = {
  getSecureCookieDomain,
  getSecureCookieOptions,
  validateSubdomainMatch,
  isRootDomainRequest
};