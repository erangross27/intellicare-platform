import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../config/languagesStatic';

const Home = () => {
  const { user, practice } = useAuth();
  const { t } = useLanguage();

  // Cached styles for performance
  const containerStyle = useMemo(() => ({
    height: '100vh',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden'
  }), []);

  const backgroundStyle = useMemo(() => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
    zIndex: -1
  }), []);

  const contentStyle = useMemo(() => ({
    maxWidth: '1200px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1
  }), []);



  const headerStyle = useMemo(() => ({
    textAlign: 'center',
    marginBottom: '30px',
    paddingTop: '20px'
  }), []);

  const titleStyle = useMemo(() => ({
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
    letterSpacing: '-0.5px'
  }), []);

  const gridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '25px',
    height: 'calc(100vh - 200px)',
    overflow: 'auto',
    paddingBottom: '20px'
  }), []);

  const cardStyle = useMemo(() => ({
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
    color: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    height: '220px'
  }), []);

  const cardIconStyle = useMemo(() => ({
    fontSize: '3rem',
    marginBottom: '20px',
    display: 'block'
  }), []);

  const cardTitleStyle = useMemo(() => ({
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '15px'
  }), []);

  const cardDescriptionStyle = useMemo(() => ({
    fontSize: '1rem',
    color: '#4a5568',
    lineHeight: '1.6',
    margin: '0',
    flex: '1'
  }), []);

  return (
    <div style={containerStyle}>
      <div style={backgroundStyle}></div>
      
      <div style={contentStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>
            {t('homePageTitle')}
          </h1>
        </div>

        <div style={gridStyle}>
          {/* Diagnosis Card */}
          <Link to="/diagnosis" style={cardStyle}>
            <div style={{...cardIconStyle, color: '#667eea'}}>🩺</div>
            <h3 style={cardTitleStyle}>{t('diagnosis')}</h3>
            <p style={cardDescriptionStyle}>
              {t('diagnosisDescription')}
            </p>
          </Link>

          {/* Patients Card */}
          <Link to="/patients" style={cardStyle}>
            <div style={{...cardIconStyle, color: '#764ba2'}}>👥</div>
            <h3 style={cardTitleStyle}>{t('patients')}</h3>
            <p style={cardDescriptionStyle}>
              {t('patientsDescription')}
            </p>
          </Link>

          {/* Medical Records Card */}
          <Link to="/records" style={cardStyle}>
            <div style={{...cardIconStyle, color: '#f093fb'}}>📋</div>
            <h3 style={cardTitleStyle}>{t('medicalRecords')}</h3>
            <p style={cardDescriptionStyle}>
              {t('medicalRecordsDescription')}
            </p>
          </Link>

          {/* Analytics Card */}
          <Link to="/analytics" style={cardStyle}>
            <div style={{...cardIconStyle, color: '#667eea'}}>📊</div>
            <h3 style={cardTitleStyle}>{t('analytics')}</h3>
            <p style={cardDescriptionStyle}>
              {t('analyticsDescription')}
            </p>
          </Link>

          {/* Settings Card */}
          <Link to="/settings" style={cardStyle}>
            <div style={{...cardIconStyle, color: '#764ba2'}}>⚙️</div>
            <h3 style={cardTitleStyle}>{t('settings')}</h3>
            <p style={cardDescriptionStyle}>
              {t('settingsDescription')}
            </p>
          </Link>

          {/* Help Card */}
          <Link to="/help" style={cardStyle}>
            <div style={{...cardIconStyle, color: '#f093fb'}}>❓</div>
            <h3 style={cardTitleStyle}>{t('help')}</h3>
            <p style={cardDescriptionStyle}>
              {t('helpDescription')}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
