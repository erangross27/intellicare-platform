import React from 'react';
import { useLanguage } from '../config/languagesStatic';

const LandingPage = () => {
  const { t, isRTL } = useLanguage();

  // Determine text direction based on language
  const textDirection = isRTL ? 'rtl' : 'ltr';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      direction: textDirection,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Simplified background elements - removed heavy animations */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '15%',
        width: '150px',
        height: '150px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute',
        top: '60%',
        right: '10%',
        width: '120px',
        height: '120px',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '20%',
        width: '100px',
        height: '100px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }}></div>

      <style>
        {`
          /* Simplified animations for better performance */
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          /* Reduced animation complexity */
          @keyframes slideInSimple {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
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
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            transition: all 0.3s ease;
            background: linear-gradient(145deg, #ffffff, #f0f4f8);
            box-shadow: 
              0 4px 8px rgba(0, 0, 0, 0.1),
              inset 0 1px 0 rgba(255, 255, 255, 0.8),
              inset 0 -1px 0 rgba(0, 0, 0, 0.05);
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          .nav-link:hover {
            color: #667eea;
            background: rgba(102, 126, 234, 0.1);
          }
          
          .nav-link:active {
            background: rgba(102, 126, 234, 0.15);
          }
          
          .dropdown {
            position: relative;
          }
          
          .dropdown-button {
            color: #4a5568;
            text-decoration: none;
            font-weight: 500;
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            transition: all 0.3s ease;
            background: linear-gradient(145deg, #ffffff, #f0f4f8);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            font-size: inherit;
            box-shadow: 
              0 4px 8px rgba(0, 0, 0, 0.1),
              inset 0 1px 0 rgba(255, 255, 255, 0.8),
              inset 0 -1px 0 rgba(0, 0, 0, 0.05);
            position: relative;
            overflow: hidden;
          }
          
          .dropdown-button:hover {
            color: #667eea;
            background: rgba(102, 126, 234, 0.1);
          }
          
          .dropdown-button:active {
            background: rgba(102, 126, 234, 0.15);
          }
          
          .dropdown-menu {
            position: absolute;
            top: 100%;
            ${isRTL ? 'right: 0;' : 'left: 0;'}
            background: white;
            border-radius: 0.5rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            border: 1px solid rgba(102, 126, 234, 0.1);
            min-width: 160px;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            transition: all 0.3s ease;
          }
          
          .dropdown-menu.open {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
          }
          
          .dropdown-item {
            display: block;
            padding: 0.75rem 1rem;
            color: #4a5568;
            text-decoration: none;
            transition: all 0.3s ease;
            border-bottom: 1px solid rgba(102, 126, 234, 0.05);
          }
          
          .dropdown-item:last-child {
            border-bottom: none;
          }
          
          .dropdown-item:hover {
            background: rgba(102, 126, 234, 0.1);
            color: #667eea;
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
          
          .mobile-menu-button {
            display: none;
            background: none;
            border: none;
            font-size: 1.5rem;
            color: #4a5568;
            cursor: pointer;
          }
          
          .hero-section {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem 2rem 1rem 2rem;
            text-align: center;
          }
          
          .hero-title {
            font-size: clamp(2.5rem, 6vw, 4rem);
            font-weight: 800;
            margin: 0 0 1rem 0;
            color: white;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            line-height: 1.2;
          }
          
          .hero-subtitle {
            font-size: clamp(1.2rem, 3vw, 1.5rem);
            color: rgba(255, 255, 255, 0.9);
            margin: 0 0 2rem 0;
            font-weight: 500;
            line-height: 1.4;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
          }
          
          .hero-buttons {
            display: flex;
            gap: 1.5rem;
            justify-content: center;
            flex-wrap: wrap;
            margin-bottom: 4rem;
          }
          
          .hero-button {
            padding: 1rem 2rem;
            border-radius: 0.75rem;
            font-size: 1.1rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            min-width: 160px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          
          .primary-hero-button {
            background: rgba(255, 255, 255, 0.95);
            color: #667eea;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          }
          
          .primary-hero-button:hover {
            background: white;
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          }
          
          .secondary-hero-button {
            background: transparent;
            color: white;
            border: 2px solid rgba(255, 255, 255, 0.8);
          }
          
          .secondary-hero-button:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: white;
            transform: translateY(-3px);
          }
          
          .features-section {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            margin: 2rem;
            border-radius: 2rem;
            padding: 4rem 2rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          }
          
          .section-title {
            font-size: clamp(2rem, 4vw, 2.5rem);
            font-weight: 700;
            text-align: center;
            margin: 0 0 3rem 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
          }
          
          .feature-card {
            text-align: center;
            padding: 2rem;
            border-radius: 1rem;
            background: rgba(255, 255, 255, 0.8);
            border: 1px solid rgba(102, 126, 234, 0.1);
            transition: all 0.3s ease;
          }
          
          .feature-card:hover {
            box-shadow: 0 8px 16px rgba(102, 126, 234, 0.15);
            border-color: rgba(102, 126, 234, 0.3);
          }
          
          .feature-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3));
          }
          
          .feature-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #4a5568;
            margin: 0 0 0.75rem 0;
          }
          
          .feature-description {
            color: #718096;
            line-height: 1.6;
            margin: 0;
          }
          
          .about-section {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
          }
          
          .founder-info {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 1rem;
            margin: 2rem 0;
          }
          
          .founder-name {
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0 0 0.5rem 0;
          }
          
          .founder-title {
            font-size: 1rem;
            opacity: 0.9;
            margin: 0;
          }
          
          .mission-text {
            font-size: 1.1rem;
            line-height: 1.7;
            color: #4a5568;
            margin: 2rem 0;
          }
          
          .cta-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 3rem 2rem;
            margin: 2rem;
            border-radius: 2rem;
            animation: slideIn 1s ease-out 0.9s both;
          }
          
          .cta-title {
            font-size: clamp(1.8rem, 4vw, 2.2rem);
            font-weight: 700;
            margin: 0 0 1rem 0;
          }
          
          .cta-description {
            font-size: 1.1rem;
            opacity: 0.9;
            margin: 0 0 2rem 0;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
          }
          
          .cta-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
          }
          
          .cta-button {
            padding: 1rem 2rem;
            border-radius: 0.75rem;
            font-size: 1rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
            border: 2px solid transparent;
            cursor: pointer;
            min-width: 150px;
          }
          
          .cta-primary {
            background: white;
            color: #667eea;
          }
          
          .cta-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(255, 255, 255, 0.3);
          }
          
          .cta-secondary {
            background: transparent;
            color: white;
            border-color: rgba(255, 255, 255, 0.8);
          }
          
          .cta-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: white;
            transform: translateY(-3px);
          }
          
          .nav-right {
            display: flex;
            align-items: center;
            gap: 2rem;
            flex-direction: ${isRTL ? 'row-reverse' : 'row'};
          }
          
          @media (max-width: 768px) {
            .nav-right {
              display: flex;
              position: absolute;
              top: 100%;
              left: 0;
              right: 0;
              background: rgba(255, 255, 255, 0.98);
              backdrop-filter: blur(20px);
              flex-direction: column;
              padding: 1rem;
              border-top: 1px solid rgba(102, 126, 234, 0.1);
              gap: 1rem;
            }
            
            .nav-menu {
              flex-direction: column;
              gap: 0.5rem;
              width: 100%;
            }
            
            .mobile-menu-button {
              display: block;
            }
            
            .nav-auth {
              flex-direction: column;
              gap: 0.5rem;
              width: 100%;
            }
            
            .auth-button {
              width: 100%;
              text-align: center;
            }
            
            .hero-buttons {
              flex-direction: column;
              align-items: center;
            }
            
            .hero-button {
              width: 100%;
              max-width: 280px;
            }
            
            .cta-buttons {
              flex-direction: column;
              align-items: center;
            }
            
            .cta-button {
              width: 100%;
              max-width: 280px;
            }
          }
        `}
      </style>

      {/* Navigation will be rendered by App.jsx */}

      {/* Hero Section */}
      <section id="home" className="hero-section">
        <h1 className="hero-title">IntelliCare</h1>
        <p className="hero-subtitle">
          {t('intelligentMedicalAssistant')}
        </p>
        
      </section>

      {/* Features Section */}
      <section id="about" className="features-section">
        <h2 className="section-title">{t('whyChooseUs')}</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3 className="feature-title">{t('aiPowered')}</h3>
            <p className="feature-description">{t('aiPoweredDesc')}</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3 className="feature-title">{t('secure')}</h3>
            <p className="feature-description">{t('secureDesc')}</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3 className="feature-title">{t('accurate')}</h3>
            <p className="feature-description">{t('accurateDesc')}</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🛟</div>
            <h3 className="feature-title">{t('support')}</h3>
            <p className="feature-description">{t('supportDesc')}</p>
          </div>
        </div>
        
      </section>

    </div>
  );
};

export default LandingPage;
