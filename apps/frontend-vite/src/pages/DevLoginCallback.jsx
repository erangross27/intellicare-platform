import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import secureApi from '../services/secureApiClient';
import secureStorage from '../utils/secureStorage';

/**
 * DEV-ONLY landing route for the cross-subdomain dev-login flow.
 *
 * Registration happens on the root domain (intellicare.health) but each practice
 * logs in at its own subdomain (e.g. yale.intellicare.health). dev-login, when
 * called from the root domain, creates a session and redirects the browser here
 * with ?token=&csrf=. This page exchanges those URL params for an httpOnly
 * session cookie (POST /api/passwordless-auth/dev-login-callback) and then does a
 * full reload into the app so AuthContext picks up the new session.
 *
 * Without this route the token in the URL is never turned into a cookie, leaving a
 * stale/empty session — which is exactly the "redirected but could not login" bug.
 */
const DevLoginCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing'); // 'processing' | 'error'
  const ranRef = useRef(false);

  const lang = secureStorage.getItem('selectedLanguage') || 'en';
  const isHebrew = lang === 'he';
  const t = (en, he) => (isHebrew ? he : en);

  useEffect(() => {
    // Guard against React StrictMode double-invoke in dev.
    if (ranRef.current) return;
    ranRef.current = true;

    const run = async () => {
      const token = searchParams.get('token');
      const csrf = searchParams.get('csrf');

      if (!token || !csrf) {
        console.error('❌ [dev-login-callback] Missing token/csrf in URL');
        setStatus('error');
        return;
      }

      try {
        const resp = await secureApi.post('/api/passwordless-auth/dev-login-callback', { token, csrf });
        const data = resp?.data || resp;

        if (data?.success) {
          console.log('✅ [dev-login-callback] Session established — entering app');
          // Full reload to the app root so AuthContext re-checks the (now valid)
          // session cookie and renders the authenticated app.
          window.location.replace('/');
          return;
        }

        console.error('❌ [dev-login-callback] Backend did not establish session:', data);
        setStatus('error');
      } catch (e) {
        console.error('❌ [dev-login-callback] Failed to establish session:', e);
        setStatus('error');
      }
    };

    run();
  }, [searchParams]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#060A14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#E9EFFA',
      direction: isHebrew ? 'rtl' : 'ltr',
      fontFamily: "'Comfortaa', 'Segoe UI', sans-serif"
    }}>
      <div style={{
        background: '#0E1626',
        border: '1px solid #1A2740',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)'
      }}>
        {status === 'processing' ? (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(61,139,255,0.2)',
              borderTop: '4px solid #3D8BFF',
              borderRadius: '50%',
              margin: '0 auto 22px',
              animation: 'dlcSpin 1s linear infinite'
            }} />
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: '#E9EFFA' }}>
              {t('Logging you in…', 'מתחבר אותך…')}
            </h2>
            <p style={{ margin: 0, color: '#93A2BE', fontSize: '14px' }}>
              {t('Setting up your practice session.', 'מגדיר את החיבור למרפאה שלך.')}
            </p>
          </>
        ) : (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'rgba(239,68,68,0.15)',
              border: '2px solid rgba(239,68,68,0.5)',
              borderRadius: '50%',
              margin: '0 auto 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              color: '#ffffff'
            }}>✕</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: '#E9EFFA' }}>
              {t('Could not sign you in', 'לא הצלחנו לחבר אותך')}
            </h2>
            <p style={{ margin: '0 0 22px', color: '#93A2BE', fontSize: '14px' }}>
              {t('The login link may have expired. Please go back and sign in.',
                 'ייתכן שקישור ההתחברות פג תוקף. חזור והתחבר שוב.')}
            </p>
            <button
              onClick={() => window.location.replace('/')}
              style={{
                background: '#173a78',
                color: '#E9EFFA',
                border: '1px solid #3D8BFF',
                borderRadius: '10px',
                padding: '11px 22px',
                cursor: 'pointer',
                fontSize: '15px',
                fontFamily: 'inherit'
              }}
            >
              {t('Go to login', 'למסך ההתחברות')}
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes dlcSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default DevLoginCallback;
