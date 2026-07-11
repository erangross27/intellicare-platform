// Content Security Policy (CSP) Middleware
// Sets CSP headers and generates nonces for inline scripts

const cspService = require('../services/cspService');
const secureConfigService = require('../services/secureConfigService');

/**
 * CSP Middleware - Sets Content Security Policy headers
 * @param {Object} options - Configuration options
 * @param {string} options.environment - Environment (production/development)
 * @param {boolean} options.reportOnly - Whether to use Report-Only mode
 */
function cspMiddleware(options = {}) {
  const {
    environment = secureConfigService.get('NODE_ENV') || 'production',
    reportOnly = false
  } = options;

  return (req, res, next) => {
    try {
      // Generate CSP header
      const cspHeader = cspService.buildCSPHeader(req, environment);
      
      // Set the appropriate CSP header
      const headerName = reportOnly 
        ? 'Content-Security-Policy-Report-Only' 
        : 'Content-Security-Policy';
      
      res.setHeader(headerName, cspHeader);
      
      // Set Report-To header for CSP reporting
      res.setHeader('Report-To', cspService.getReportToHeader());
      
      // Add nonce to locals for template engines
      if (req.cspNonce) {
        res.locals.cspNonce = req.cspNonce;
      }
      
      // Log CSP header in development
      if (environment === 'development') {
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔒 CSP Header set for ${req.path}`);
      }
      
      next();
    } catch (error) {
      console.error('❌ CSP Middleware error:', error);
      // Don't block the request on CSP errors
      next();
    }
  };
}

/**
 * CSP Nonce Generator Middleware
 * Generates a nonce for inline scripts and makes it available in templates
 */
function cspNonceMiddleware(req, res, next) {
  try {
    // Generate nonce
    const nonce = cspService.generateNonce(req);
    
    // Make nonce available in various ways
    req.cspNonce = nonce;
    res.locals.cspNonce = nonce;
    
    // Add helper function for templates
    res.locals.getCSPNonce = () => nonce;
    
    next();
  } catch (error) {
    console.error('❌ CSP Nonce generation error:', error);
    next();
  }
}

module.exports = {
  cspMiddleware,
  cspNonceMiddleware
};