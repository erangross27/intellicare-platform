import React from 'react';
const ReferralViewer = ({ document, language }) => {
  const isRTL = language === 'he';
  return (
    <div style={{ padding: '24px', color: '#e8eaf0' }}>
      <h2>📋 {isRTL ? 'הפניה' : 'Referral'}</h2>
      <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px' }}>
        <div>Document: {document?.fileName}</div>
        <div>Category: Referral</div>
      </div>
    </div>
  );
};
export default ReferralViewer;