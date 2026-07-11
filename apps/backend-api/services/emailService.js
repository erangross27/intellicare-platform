const sgMail = require('@sendgrid/mail');
const secureConfigService = require('../services/secureConfigService');
const serviceAccountManager = require('./serviceAccountManager');
const productionKMS = require('./productionKMS');

class EmailService {
  constructor() {
    // API key will be loaded from KMS during initialization
    this.fromEmail = secureConfigService.get('FROM_EMAIL') || 'IntelliCare <eran@gross.support>';
    this.serviceToken = null;
    this.initialized = false;
    this.apiKeyLoaded = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Load SendGrid API key from KMS
    try {
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      const sendGridKey = await productionKMS.getInternalKey('SENDGRID_API_KEY');
      
      if (sendGridKey && sendGridKey !== 'your-sendgrid-api-key') {
        sgMail.setApiKey(sendGridKey);
        this.apiKeyLoaded = true;
        console.log('✅ [Email Service] SendGrid API key loaded from KMS');
      } else {
        console.warn('⚠️ [Email Service] SendGrid API key not found in KMS, email sending disabled');
      }
    } catch (error) {
      console.error('❌ [Email Service] Failed to load SendGrid key from KMS:', error.message);
    }
    
    this.serviceToken = await serviceAccountManager.authenticate('email-service');
    this.initialized = true;
  }

  /**
   * Check if the email service is initialized
   * @returns {boolean} Whether the service is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  async sendEmailVerification(email, verificationToken, userId, practiceName, practiceSubdomain = null) {
    // ALWAYS use subdomain URL for verification - this is where users will login
    let baseUrl;
    if (practiceSubdomain && practiceSubdomain !== '') {
      // Always use subdomain URL - this is the user's permanent login URL
      if (secureConfigService.get('NODE_ENV') === 'production') {
        baseUrl = `https://${practiceSubdomain}.intellicare.health`;
      } else {
        // Development mode - use intellicare.health with port 3000
        baseUrl = `http://${practiceSubdomain}.intellicare.health:3000`;
      }
    } else {
      // This should not happen - subdomain is required
      console.error('⚠️ No subdomain provided for email verification!');
      baseUrl = secureConfigService.get('FRONTEND_URL') || 'http://intellicare.health:3000';
    }
    
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&userId=${userId}&practice=${practiceSubdomain || ''}`;

    const msg = {
      to: email,
      from: this.fromEmail,
      subject: `Verify Your Email - ${practiceName}`,
      text: `
        Verify Your Email Address - ${practiceName}

        Hello,

        Please visit the following link to verify your email address:
        ${verificationUrl}

        This link will expire in 24 hours.

        If you didn't request this verification, please ignore this email.
      `,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Email - ${practiceName}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c5aa0;">Verify Your Email Address</h2>
            <p>Hello,</p>
            <p>Please click the button below to verify your email address and login to ${practiceName}:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}"
                 style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email & Login
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            
            <div style="background: #f0f8ff; padding: 15px; border-left: 4px solid #2c5aa0; margin: 20px 0;">
              <p style="margin: 0; font-weight: bold; color: #2c5aa0;">📍 Important: Your Practice Login URL</p>
              <p style="margin: 10px 0 0 0;">From now on, always login at:</p>
              <p style="margin: 5px 0; font-family: monospace; font-size: 14px; color: #000;">
                <strong>http://${practiceSubdomain}.intellicare.health:3000</strong>
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                Bookmark this address for easy access to your practice.
              </p>
            </div>
            
            <p><strong>This verification link will expire in 24 hours.</strong></p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
              This email was sent from ${practiceName}. If you didn't request this verification, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `
    };

    // Check if API key is loaded
    if (!this.apiKeyLoaded) {
      console.warn('⚠️ [Email Service] Cannot send email - SendGrid API key not loaded');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const result = await sgMail.send(msg);
      console.log(`✅ Email verification sent to: ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send email verification:', error);
      throw error;
    }
  }

  async sendCalendarSyncUrl(email, providerName, syncUrl, instructions, subject, practiceName) {
    const msg = {
      to: email,
      from: this.fromEmail,
      subject: subject,
      text: `
        Calendar Sync for ${providerName}
        
        Hello ${providerName},
        
        Your IntelliCare calendar subscription URL is ready.
        
        Calendar URL:
        ${syncUrl}
        
        Instructions are included in the HTML version of this email.
        
        This URL is permanent and will automatically sync your appointments.
        
        Best regards,
        ${practiceName} Team
      `,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c5aa0;">Calendar Sync for ${providerName}</h2>
            
            <p>Hello ${providerName},</p>
            
            <p>Your IntelliCare calendar subscription URL is ready. This will automatically sync all your appointments to your personal calendar.</p>
            
            ${instructions}
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="margin-top: 0;">Your Calendar URL:</h4>
              <p style="word-break: break-all; font-family: monospace; color: #0066cc;">
                ${syncUrl}
              </p>
            </div>
            
            <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #0066cc;">📱 Important Notes:</h4>
              <ul>
                <li>This URL is unique to you - do not share it</li>
                <li>The calendar will update automatically every hour</li>
                <li>Patient information is encrypted for privacy</li>
                <li>You can disable sync anytime from IntelliCare</li>
              </ul>
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="font-size: 12px; color: #666;">
              This email was sent from ${practiceName} IntelliCare system.<br>
              If you need assistance, please contact your system administrator.
            </p>
          </div>
        </body>
        </html>
      `
    };

    try {
      const result = await sgMail.send(msg);
      console.log(`✅ Calendar sync URL sent to: ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send calendar sync URL:', error);
      throw error;
    }
  }

  async sendOTPCode(email, code, practiceName) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.apiKeyLoaded) {
      console.warn('⚠️ [Email Service] SendGrid not configured, skipping OTP email');
      console.log(`📧 OTP Code for ${email}: ${code}`);
      return { success: true, skipped: true };
    }

    const msg = {
      to: email,
      from: this.fromEmail,
      subject: `Your Verification Code - ${practiceName}`,
      text: `
        Your Verification Code for ${practiceName}

        Your verification code is: ${code}

        This code will expire in 10 minutes.

        If you didn't request this code, please ignore this email.

        For security reasons, never share this code with anyone.
      `,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Your Verification Code</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f5f7fa;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
              text-align: center;
            }
            .logo {
              font-size: 48px;
              margin-bottom: 20px;
            }
            .timer {
              color: #666;
              font-size: 14px;
              margin-top: 20px;
            }
            .timer-icon {
              display: inline-block;
              margin-right: 5px;
            }
            .security-notice {
              background-color: #fef5e7;
              border-left: 4px solid #f39c12;
              padding: 15px;
              margin: 30px 0;
              border-radius: 6px;
              text-align: left;
            }
            .security-notice h3 {
              margin: 0 0 10px 0;
              color: #e67e22;
              font-size: 16px;
            }
            .security-notice p {
              margin: 0;
              color: #7f8c8d;
              font-size: 14px;
            }
            .footer {
              background-color: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #6c757d;
              font-size: 12px;
              border-top: 1px solid #e9ecef;
            }
            .practice-name {
              color: #667eea;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verification Code</h1>
            </div>
            <div class="content">
              <div class="logo">🔐</div>
              <p style="font-size: 18px; color: #495057; margin-bottom: 10px;">
                Hello! Your verification code for <span class="practice-name">${practiceName}</span> is:
              </p>
              
              <!-- Simple, copyable code display -->
              <div style="text-align: center; margin: 40px 0;">
                <div style="display: inline-block; background-color: #f8f9fa; border: 2px solid #667eea; border-radius: 8px; padding: 25px 40px;">
                  <div style="font-size: 14px; color: #666; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
                    Your Code
                  </div>
                  <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 42px; font-weight: bold; color: #2c3e50; letter-spacing: 8px; user-select: all; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all;">
                    ${code}
                  </div>
                  <div style="font-size: 12px; color: #999; margin-top: 10px;">
                    Copy and paste this code
                  </div>
                </div>
              </div>
              
              <div class="timer">
                <span class="timer-icon">⏱️</span>
                This code expires in <strong>10 minutes</strong>
              </div>
              
              <div class="security-notice">
                <h3>🛡️ Security Notice</h3>
                <p>
                  • Never share this code with anyone<br>
                  • We will never call or text you for this code<br>
                  • If you didn't request this code, please ignore this email
                </p>
              </div>
              
              <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
                Having trouble? Contact support at support@intellicare.health
              </p>
            </div>
            <div class="footer">
              <p>© 2025 IntelliCare. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const result = await sgMail.send(msg);
      console.log(`✅ OTP code sent to: ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send OTP code:', error);
      // In development, log the code
      if (secureConfigService.get('NODE_ENV') === 'development') {
        console.log(`📧 Development Mode - OTP Code for ${email}: ${code}`);
      }
      throw error;
    }
  }

  async sendMagicLoginLink(email, loginToken, userId, practiceName, practiceSubdomain = null) {
    console.log('📧 sendMagicLoginLink called with:', { email, practiceName, practiceSubdomain });
    
    // Build the login URL with subdomain if available
    let baseUrl;
    if (practiceSubdomain && practiceSubdomain !== '') {
      // Use subdomain URL for practice-specific login
      // Check if we have a custom frontend URL first
      if (secureConfigService.get('FRONTEND_URL') && secureConfigService.get('FRONTEND_URL').includes('intellicare.health')) {
        // Use intellicare.health domain with subdomain
        baseUrl = `http://${practiceSubdomain}.intellicare.health:3000`;
      } else if (secureConfigService.get('NODE_ENV') === 'production') {
        baseUrl = `https://${practiceSubdomain}.intellicare.health`;
      } else {
        // Development mode - use localhost
        baseUrl = `http://${practiceSubdomain}.localhost:3000`;
      }
    } else {
      // Fallback - but log warning
      console.warn('⚠️ No practice subdomain provided for magic login link!');
      baseUrl = secureConfigService.get('FRONTEND_URL') || 'http://localhost:3000';
    }
    
    const loginUrl = `${baseUrl}/magic-login?token=${loginToken}&userId=${userId}&practice=${practiceSubdomain || ''}`;
    console.log('🔗 Generated login URL:', loginUrl);

    const msg = {
      to: email,
      from: this.fromEmail,
      subject: `Login to ${practiceName}`,
      text: `
        Login to ${practiceName}

        Hello,

        Please visit the following link to log in to your account:
        ${loginUrl}

        This link will expire in 15 minutes for security.

        If you didn't request this login, please ignore this email.
      `,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Login to ${practiceName}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c5aa0;">Login to ${practiceName}</h2>
            <p>Hello,</p>
            <p>Click the button below to securely log in to your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}"
                 style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Login to ${practiceName}
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${loginUrl}</p>
            <p><strong>This link will expire in 15 minutes for security.</strong></p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
              This login link was requested for ${practiceName}. If you didn't request this, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `
    };

    try {
      const result = await sgMail.send(msg);
      console.log(`✅ Magic login link sent to: ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send magic login link:', error);
      throw error;
    }
  }
  async sendPasswordReset(email, resetToken, userId, practiceName, practiceSubdomain = null) {
    // Build the reset URL with subdomain if available
    let baseUrl;
    if (practiceSubdomain && practiceSubdomain !== '') {
      // Use subdomain URL for practice-specific reset
      // Check if we have a custom frontend URL first
      if (secureConfigService.get('FRONTEND_URL') && secureConfigService.get('FRONTEND_URL').includes('intellicare.health')) {
        // Use intellicare.health domain with subdomain
        baseUrl = `http://${practiceSubdomain}.intellicare.health:3000`;
      } else if (secureConfigService.get('NODE_ENV') === 'production') {
        baseUrl = `https://${practiceSubdomain}.intellicare.health`;
      } else {
        // Development mode - use localhost
        baseUrl = `http://${practiceSubdomain}.localhost:3000`;
      }
    } else {
      // Fallback to main domain
      baseUrl = secureConfigService.get('FRONTEND_URL') || 'http://localhost:3000';
    }
    
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&userId=${userId}`;

    const msg = {
      to: email,
      from: this.fromEmail,
      subject: `Reset Your Password - ${practiceName}`,
      text: `
        Reset Your Password - ${practiceName}

        Hello,

        Please visit the following link to reset your password:
        ${resetUrl}

        This link will expire in 1 hour for security.

        If you didn't request this password reset, please ignore this email.
      `,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password - ${practiceName}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc3545;">Reset Your Password</h2>
            <p>Hello,</p>
            <p>Click the button below to reset your password for ${practiceName}:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour for security.</strong></p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
              This password reset was requested for ${practiceName}. If you didn't request this, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `
    };

    try {
      const result = await sgMail.send(msg);
      console.log(`✅ Password reset email sent to: ${email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }
  }
  
  async sendCustomEmail({ to, subject, text, html }) {
    const msg = {
      to: to,
      from: this.fromEmail,
      subject: subject,
      text: text,
      html: html || text
    };

    try {
      const result = await sgMail.send(msg);
      console.log(`✅ Custom email sent to: ${to}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send custom email:', error);
      throw error;
    }
  }
  
  async sendAppointmentReminder(appointment, patient, provider, hoursBeforeAppointment = 24) {
    const appointmentDate = new Date(appointment.appointmentDate);
    const appointmentTime = appointment.appointmentTime;
    
    const msg = {
      to: patient.email,
      from: this.fromEmail,
      subject: `Appointment Reminder - ${provider.name}`,
      text: `
        Appointment Reminder
        
        Dear ${patient.name},
        
        This is a reminder that you have an appointment scheduled:
        
        Doctor: ${provider.name}
        Date: ${appointmentDate.toLocaleDateString()}
        Time: ${appointmentTime}
        
        Please arrive 10 minutes early to complete any necessary paperwork.
        
        If you need to cancel or reschedule, please contact us as soon as possible.
        
        Thank you,
        IntelliCare Team
      `,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Appointment Reminder</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #2c5aa0; text-align: center;">
              <span style="font-size: 30px;">📅</span> Appointment Reminder
            </h2>
            
            <p>Dear ${patient.name},</p>
            
            <p>This is a reminder that you have an appointment scheduled:</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Doctor:</strong> ${provider.name}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${appointmentDate.toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${appointmentTime}</p>
            </div>
            
            <p style="color: #666;">
              <span style="color: #28a745;">✓</span> Please arrive 10 minutes early to complete any necessary paperwork.
            </p>
            
            <p style="color: #666;">
              If you need to cancel or reschedule, please contact us as soon as possible.
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="font-size: 12px; color: #666; text-align: center;">
              Thank you,<br>
              IntelliCare Team
            </p>
          </div>
        </body>
        </html>
      `
    };

    try {
      const result = await sgMail.send(msg);
      console.log(`✅ Appointment reminder sent to: ${patient.email}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send appointment reminder:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
