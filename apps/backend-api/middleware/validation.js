const { validationResult } = require('express-validator');

/**
 * Middleware to check validation results from express-validator
 * Returns 400 with validation errors if validation failed
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: {
        he: 'נתונים לא תקינים',
        en: 'Invalid request data'
      },
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

module.exports = {
  validateRequest
};