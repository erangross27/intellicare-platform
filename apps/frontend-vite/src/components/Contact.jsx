import React from 'react';
import { useLanguage } from '../config/languagesStatic';
import Navigation from './Navigation';

const Contact = () => {
  const { t, currentLanguage, isRTL } = useLanguage();

  // Determine text direction based on language
  const textDirection = isRTL ? 'rtl' : 'ltr';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      direction: textDirection,
      position: 'relative'
    }}>
      <style>
        {`
          .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            position: sticky;
            top: 0;
            z-index: 1000;
          }
          
          .nav-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-direction: ${isRTL ? 'row-reverse' : 'row'};
          }
          
          .logo {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 1.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-decoration: none;
          }
          
          .logo-icon {
            font-size: 2rem;
            filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3));
          }
          
          .nav-menu {
            display: flex;
            align-items: center;
            gap: 2rem;
            list-style: none;
            margin: 0;
            padding: 0;
          }
          
          .nav-link {
            color: #4a5568;
            text-decoration: none;
            font-weight: 500;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            transition: all 0.3s ease;
          }
          
          .nav-link:hover, .nav-link.active {
            color: #667eea;
            background: rgba(102, 126, 234, 0.1);
          }
          
          .nav-auth {
            display: flex;
            align-items: center;
            gap: 1rem;
          }
          
          .auth-button {
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            font-size: 0.9rem;
          }
          
          .login-button {
            background: transparent;
            color: #667eea;
            border: 2px solid #667eea;
          }
          
          .login-button:hover {
            background: #667eea;
            color: white;
          }
          
          .signup-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: 2px solid transparent;
          }
          
          .signup-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
          
          .logout-button {
            background: #dc2626;
            color: white;
            border: 2px solid transparent;
          }
          
          .logout-button:hover {
            background: #b91c1c;
            transform: translateY(-2px);
          }
          
          .nav-right {
            display: flex;
            align-items: center;
            gap: 2rem;
            flex-direction: ${isRTL ? 'row-reverse' : 'row'};
          }
          
          .content-section {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            margin: 2rem;
            border-radius: 2rem;
            padding: 4rem 2rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            max-width: 1200px;
            margin-left: auto;
            margin-right: auto;
          }
          
          .page-title {
            font-size: clamp(2.5rem, 5vw, 3.5rem);
            font-weight: 800;
            text-align: center;
            margin: 0 0 2rem 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .contact-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin: 2rem 0;
          }
          
          .contact-card {
            background: rgba(255, 255, 255, 0.8);
            border: 1px solid rgba(102, 126, 234, 0.1);
            border-radius: 1rem;
            padding: 2rem;
            text-align: center;
            transition: all 0.3s ease;
          }
          
          .contact-card:hover {
            box-shadow: 0 8px 16px rgba(102, 126, 234, 0.15);
            border-color: rgba(102, 126, 234, 0.3);
          }
          
          .contact-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3));
          }
          
          .contact-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #4a5568;
            margin: 0 0 0.75rem 0;
          }
          
          .contact-info {
            color: #718096;
            line-height: 1.6;
            margin: 0.5rem 0;
          }
          
          .map-container {
            margin: 2rem 0;
            border-radius: 1rem;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          }
          
          .map-iframe {
            width: 100%;
            height: 400px;
            border: none;
          }
          
          .address-highlight {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 245, 255, 0.95) 100%);
            border: 1px solid rgba(139, 92, 246, 0.15);
            padding: 2rem;
            border-radius: 1rem;
            margin: 2rem 0;
            text-align: center;
            box-shadow: 0 8px 16px rgba(139, 92, 246, 0.1);
          }
          
          .address-title {
            font-size: clamp(1.8rem, 4vw, 2.2rem);
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-align: center;
            position: relative;
            padding: 1rem 0;
            margin: 0 0 1rem 0;
          }
          
          .address-title::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 3px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 2px;
          }
          
          .address-text {
            font-size: 1.1rem;
            color: #4a5568;
            margin: 0.5rem 0;
            line-height: 1.6;
          }
          
          .temp-notice {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid rgba(255, 193, 7, 0.3);
            color: #856404;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 1rem 0;
            text-align: center;
            font-weight: 500;
          }
        `}
      </style>

      {/* Navigation */}
      <Navigation />

      {/* Contact Content */}
      <section className="content-section">
        <h1 className="page-title">{t('contactUs')}</h1>
        
        <div className="address-highlight">
          <h2 className="address-title">{t('ourLocation')}</h2>
          <p className="address-text">{t('addressStreet')}</p>
          <p className="address-text">{t('addressCity')}</p>
          <p className="address-text">{t('zipCode')}: 7405954</p>
        </div>

        {/* Google Map */}
        <div className="map-container">
          <iframe
            className="map-iframe"
            src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3386.8!2d34.7919!3d31.9242!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1502b7c0000000%3A0x0!2s16%20David%20Lando%20St%2C%20Ness%20Ziona%2C%20Israel!5e0!3m2!1s${currentLanguage}!2s${currentLanguage === 'he' ? 'il' : 'us'}!4v1640995200000!5m2!1s${currentLanguage}!2s${currentLanguage === 'he' ? 'il' : 'us'}`}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="IntelliCare Office Location"
          ></iframe>
        </div>

        <div className="contact-grid">
          <div className="contact-card">
            <div className="contact-icon">📧</div>
            <h3 className="contact-title">{t('email')}</h3>
            <p className="contact-info">info@intellicare.com</p>
            <p className="contact-info">support@intellicare.com</p>
          </div>
          
          <div className="contact-card">
            <div className="contact-icon">📞</div>
            <h3 className="contact-title">{t('phone')}</h3>
            <p className="contact-info">{t('phonenumber')}</p>
            <p className="contact-info">{t('businessHours')}: 9:00-17:00</p>
          </div>
          
          <div className="contact-card">
            <div className="contact-icon">🕒</div>
            <h3 className="contact-title">{t('officeHours')}</h3>
            <p className="contact-info">{t('sunday')} - {t('thursday')}: 9:00-17:00</p>
            <p className="contact-info">{t('friday')}: 9:00-13:00</p>
            <p className="contact-info">{t('saturday')}: {t('closed')}</p>
          </div>
          
          <div className="contact-card">
            <div className="contact-icon">🌐</div>
            <h3 className="contact-title">{t('onlineSupport')}</h3>
            <p className="contact-info">{t('available24_7')}</p>
            <p className="contact-info">{t('responseTime')}: 2-4 {t('hours')}</p>
          </div>
        </div>

      </section>
    </div>
  );
};

export default Contact;
