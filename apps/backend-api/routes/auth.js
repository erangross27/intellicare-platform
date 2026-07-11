const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const SecureDataAccess = require('../services/secureDataAccess');
const { body, validationResult } = require('express-validator');

const { model: User } = require('../models/User');
const { auth } = require('../middleware/auth');
const roleModel = require('../config/roles');

// @route   POST /api/auth/signup
// @desc    Register user
// @access  Public
router.post(
  '/signup',
  [
    body('firstName', 'First name is required').notEmpty(),
    body('lastName', 'Last name is required').notEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, password, role } = req.body;

    try {
      // Check if user already exists
      const userResults = await SecureDataAccess.query('users', { email }, { limit: 1 }, context);

      const user = userResults[0];
      if (user) {
        return res.status(400).json({ errors: [{ msg: 'User already exists' }] });
      }

      // Create new user object
      user = new User({
        email,
        password,
        profile: {
          firstName,
          lastName
        },
        roles: roleModel.normalizeRoles([role || 'user'])
      });

      // Encrypt password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      // Save user to database
      await SecureDataAccess.update('collection', { _id: user._id }, user, context);

      // Return jsonwebtoken
      const payload = {
        user: {
          id: user.id
        }
      };

      jwt.sign(
        payload,
        config.get('jwtSecret'),
        { expiresIn: 360000 },
        (err, token) => {
          if (err) throw err;
          res.json({ 
            token,
            user: {
              id: user.id,
              firstName: user.profile.firstName,
              lastName: user.profile.lastName,
              email: user.email,
              roles: user.roles
            }
          });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/login',
  [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Check if user exists
      const userResults = await SecureDataAccess.query('users', { email }, { limit: 1 }, context);

      const user = userResults[0];
      if (!user) {
        return res.status(400).json({ errors: [{ msg: 'Invalid Credentials' }] });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ errors: [{ msg: 'Invalid Credentials' }] });
      }

      // Return jsonwebtoken
      const payload = {
        user: {
          id: user.id
        }
      };

      jwt.sign(
        payload,
        config.get('jwtSecret'),
        { expiresIn: 360000 },
        (err, token) => {
          if (err) throw err;
          res.json({ 
            token,
            user: {
              id: user.id,
              firstName: user.profile?.firstName || user.firstName,
              lastName: user.profile?.lastName || user.lastName,
              email: user.email,
              roles: user.roles,
              preferredLanguage: user.preferredLanguage || 'en'
            }
          });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   PUT /api/auth/language
// @desc    Update user's preferred language
// @access  Private
router.put(
  '/language',
  [
    auth,
    body('language', 'Language must be either en or he').isIn(['en', 'he'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { language } = req.body;

    try {
      // Define security context for SecureDataAccess
      const context = {
        userId: req.user?.id || 'anonymous',
        operation: 'updateUserLanguage',
        practiceId: req.practice?._id || 'global'
      };

      // Update user's preferred language
      await SecureDataAccess.update('users', 
        { _id: req.user.id }, 
        { $set: { preferredLanguage: language } }, 
        context
      );

      // Get updated user without password
      const users = await SecureDataAccess.query('users', 
        { _id: req.user.id }, 
        { limit: 1, projection: { password: 0 } }, 
        context
      );
      const user = users[0];

      if (!user) {
        return res.status(404).json({ errors: [{ msg: 'User not found' }] });
      }

      console.log(`🌐 [BACKEND] User ${user.name} (${user.email}) changed language preference to: ${language}`);

      res.json({
        success: true,
        message: 'Language preference updated successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          preferredLanguage: user.preferredLanguage
        }
      });
    } catch (err) {
      console.error('Error updating language preference:', err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;
