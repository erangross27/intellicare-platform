import React, { useState } from 'react';
import './HelpModal.css';
import CloseIcon from './icons/CloseIcon';

const HelpModal = ({ isOpen, onClose, language = 'he' }) => {
  const [activeTab, setActiveTab] = useState('getting-started');
  const isRTL = language === 'he';

  if (!isOpen) return null;

  const helpContent = {
    'getting-started': {
      title: isRTL ? 'התחלה מהירה' : 'Getting Started',
      content: isRTL ? (
        <div>
          <h3>ברוכים הבאים ל-IntelliCare AI</h3>
          <p>IntelliCare AI הוא העוזר הרפואי החכם שלך, המספק תמיכה מיידית בניהול מטופלים, אבחונים, וניהול המרפאה.</p>
          
          <h4>איך להתחיל:</h4>
          <ol>
            <li>הקלידו את השאלה או הבקשה שלכם בשדה הטקסט</li>
            <li>לחצו Enter או על כפתור השליחה</li>
            <li>המערכת תעבד את הבקשה ותספק תשובה מיידית</li>
          </ol>
          
          <h4>דוגמאות לשימוש:</h4>
          <ul>
            <li>"הוסף מטופל חדש בשם יוסי כהן"</li>
            <li>"חפש מטופל עם ת.ז. 123456789"</li>
            <li>"מה האבחנה המתאימה לכאבי ראש וחום?"</li>
            <li>"הצג את התורים שלי להיום"</li>
          </ul>
        </div>
      ) : (
        <div>
          <h3>Welcome to IntelliCare AI</h3>
          <p>IntelliCare AI is your intelligent medical assistant, providing instant support for patient management, diagnoses, and practice operations.</p>
          
          <h4>How to get started:</h4>
          <ol>
            <li>Type your question or request in the text field</li>
            <li>Press Enter or click the send button</li>
            <li>The system will process your request and provide an instant response</li>
          </ol>
          
          <h4>Usage examples:</h4>
          <ul>
            <li>"Add a new patient named John Smith"</li>
            <li>"Search for patient with SSN 123-45-6789"</li>
            <li>"What's the diagnosis for headache and fever?"</li>
            <li>"Show my appointments for today"</li>
          </ul>
        </div>
      )
    },
    'features': {
      title: isRTL ? 'תכונות' : 'Features',
      content: isRTL ? (
        <div>
          <h3>תכונות עיקריות</h3>
          
          <h4>🏥 ניהול מטופלים</h4>
          <ul>
            <li>הוספת מטופלים חדשים</li>
            <li>עדכון פרטי מטופלים</li>
            <li>חיפוש מטופלים לפי שם, ת.ז., או טלפון</li>
            <li>ניהול היסטוריה רפואית</li>
          </ul>
          
          <h4>🔬 אבחון רפואי</h4>
          <ul>
            <li>אבחון מבוסס AI לפי תסמינים</li>
            <li>המלצות טיפול</li>
            <li>זיהוי דגלים אדומים</li>
            <li>אבחונים דיפרנציאליים</li>
          </ul>
          
          <h4>📄 ניתוח מסמכים</h4>
          <ul>
            <li>סריקת מסמכים רפואיים</li>
            <li>חילוץ מידע אוטומטי</li>
            <li>זיהוי תרופות ואבחנות</li>
            <li>ארגון מסמכים לפי קטגוריות</li>
          </ul>
          
          <h4>📅 ניהול תורים</h4>
          <ul>
            <li>קביעת תורים</li>
            <li>ניהול יומן</li>
            <li>תזכורות אוטומטיות</li>
            <li>סנכרון עם לוח שנה</li>
          </ul>
        </div>
      ) : (
        <div>
          <h3>Key Features</h3>
          
          <h4>🏥 Patient Management</h4>
          <ul>
            <li>Add new patients</li>
            <li>Update patient information</li>
            <li>Search patients by name, ID, or phone</li>
            <li>Manage medical history</li>
          </ul>
          
          <h4>🔬 Medical Diagnosis</h4>
          <ul>
            <li>AI-based diagnosis from symptoms</li>
            <li>Treatment recommendations</li>
            <li>Red flag identification</li>
            <li>Differential diagnoses</li>
          </ul>
          
          <h4>📄 Document Analysis</h4>
          <ul>
            <li>Scan medical documents</li>
            <li>Automatic information extraction</li>
            <li>Identify medications and diagnoses</li>
            <li>Organize documents by categories</li>
          </ul>
          
          <h4>📅 Appointment Management</h4>
          <ul>
            <li>Schedule appointments</li>
            <li>Manage calendar</li>
            <li>Automatic reminders</li>
            <li>Calendar sync</li>
          </ul>
        </div>
      )
    },
    'shortcuts': {
      title: isRTL ? 'קיצורי מקלדת' : 'Keyboard Shortcuts',
      content: isRTL ? (
        <div>
          <h3>קיצורי מקלדת</h3>
          <table className="shortcuts-table">
            <thead>
              <tr>
                <th>קיצור</th>
                <th>פעולה</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><kbd>Enter</kbd></td>
                <td>שליחת הודעה</td>
              </tr>
              <tr>
                <td><kbd>Shift</kbd> + <kbd>Enter</kbd></td>
                <td>שורה חדשה</td>
              </tr>
              <tr>
                <td><kbd>Ctrl</kbd> + <kbd>/</kbd></td>
                <td>ניקוי השיחה</td>
              </tr>
              <tr>
                <td><kbd>Ctrl</kbd> + <kbd>K</kbd></td>
                <td>חיפוש מטופל</td>
              </tr>
              <tr>
                <td><kbd>Ctrl</kbd> + <kbd>N</kbd></td>
                <td>מטופל חדש</td>
              </tr>
              <tr>
                <td><kbd>Esc</kbd></td>
                <td>סגירת חלונות</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <h3>Keyboard Shortcuts</h3>
          <table className="shortcuts-table">
            <thead>
              <tr>
                <th>Shortcut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><kbd>Enter</kbd></td>
                <td>Send message</td>
              </tr>
              <tr>
                <td><kbd>Shift</kbd> + <kbd>Enter</kbd></td>
                <td>New line</td>
              </tr>
              <tr>
                <td><kbd>Ctrl</kbd> + <kbd>/</kbd></td>
                <td>Clear chat</td>
              </tr>
              <tr>
                <td><kbd>Ctrl</kbd> + <kbd>K</kbd></td>
                <td>Search patient</td>
              </tr>
              <tr>
                <td><kbd>Ctrl</kbd> + <kbd>N</kbd></td>
                <td>New patient</td>
              </tr>
              <tr>
                <td><kbd>Esc</kbd></td>
                <td>Close dialogs</td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    },
    'faq': {
      title: isRTL ? 'שאלות נפוצות' : 'FAQ',
      content: isRTL ? (
        <div>
          <h3>שאלות נפוצות</h3>
          
          <details>
            <summary>האם המידע שלי מאובטח?</summary>
            <p>כן, IntelliCare משתמש בהצפנה מקצה לקצה ועומד בתקני HIPAA לאבטחת מידע רפואי.</p>
          </details>
          
          <details>
            <summary>האם אפשר להשתמש במערכת במספר מכשירים?</summary>
            <p>כן, ניתן להתחבר למערכת מכל מכשיר עם דפדפן אינטרנט.</p>
          </details>
          
          <details>
            <summary>איך מוסיפים משתמשים נוספים למרפאה?</summary>
            <p>מנהלי מערכת יכולים להוסיף משתמשים דרך הגדרות המרפאה או לבקש מהמערכת "הוסף משתמש חדש".</p>
          </details>
          
          <details>
            <summary>האם המערכת תומכת בשפות נוספות?</summary>
            <p>כרגע המערכת תומכת בעברית ואנגלית. ניתן לשנות שפה בהגדרות המשתמש.</p>
          </details>
          
          <details>
            <summary>מה לעשות אם שכחתי סיסמה?</summary>
            <p>לחצו על "שכחתי סיסמה" במסך הכניסה או פנו למנהל המערכת.</p>
          </details>
        </div>
      ) : (
        <div>
          <h3>Frequently Asked Questions</h3>
          
          <details>
            <summary>Is my data secure?</summary>
            <p>Yes, IntelliCare uses end-to-end encryption and complies with HIPAA standards for medical data security.</p>
          </details>
          
          <details>
            <summary>Can I use the system on multiple devices?</summary>
            <p>Yes, you can access the system from any device with a web browser.</p>
          </details>
          
          <details>
            <summary>How do I add more users to the practice?</summary>
            <p>System administrators can add users through practice settings or request "Add new user" from the system.</p>
          </details>
          
          <details>
            <summary>Does the system support other languages?</summary>
            <p>Currently, the system supports Hebrew and English. You can change the language in user settings.</p>
          </details>
          
          <details>
            <summary>What if I forgot my password?</summary>
            <p>Click "Forgot password" on the login screen or contact your system administrator.</p>
          </details>
        </div>
      )
    },
    'support': {
      title: isRTL ? 'תמיכה' : 'Support',
      content: isRTL ? (
        <div>
          <h3>תמיכה ויצירת קשר</h3>
          
          <h4>📧 דוא"ל תמיכה</h4>
          <p>support@intellicare.health</p>
          
          <h4>📞 טלפון תמיכה</h4>
          <p>1-800-INTELLI (1-800-468-3554)</p>
          
          <h4>💬 צ'אט תמיכה</h4>
          <p>זמין 24/7 דרך הממשק הראשי</p>
          
          <h4>📚 מרכז ידע</h4>
          <p>בקרו במרכז הידע שלנו בכתובת: <a href="https://docs.intellicare.health" target="_blank" rel="noopener noreferrer">docs.intellicare.health</a></p>
          
          <h4>🎥 הדרכות וידאו</h4>
          <p>צפו בהדרכות וידאו בערוץ היוטיוב שלנו</p>
          
          <h4>זמני תמיכה</h4>
          <ul>
            <li>ימים א'-ה': 08:00-20:00</li>
            <li>יום ו': 08:00-14:00</li>
            <li>תמיכה דחופה: 24/7</li>
          </ul>
        </div>
      ) : (
        <div>
          <h3>Support & Contact</h3>
          
          <h4>📧 Support Email</h4>
          <p>support@intellicare.health</p>
          
          <h4>📞 Support Phone</h4>
          <p>1-800-INTELLI (1-800-468-3554)</p>
          
          <h4>💬 Live Chat</h4>
          <p>Available 24/7 through the main interface</p>
          
          <h4>📚 Knowledge Base</h4>
          <p>Visit our knowledge base at: <a href="https://docs.intellicare.health" target="_blank" rel="noopener noreferrer">docs.intellicare.health</a></p>
          
          <h4>🎥 Video Tutorials</h4>
          <p>Watch video tutorials on our YouTube channel</p>
          
          <h4>Support Hours</h4>
          <ul>
            <li>Monday-Thursday: 8:00 AM - 8:00 PM</li>
            <li>Friday: 8:00 AM - 2:00 PM</li>
            <li>Emergency Support: 24/7</li>
          </ul>
        </div>
      )
    }
  };

  const tabs = [
    { id: 'getting-started', icon: '🚀' },
    { id: 'features', icon: '✨' },
    { id: 'shortcuts', icon: '⌨️' },
    { id: 'faq', icon: '❓' },
    { id: 'support', icon: '💬' }
  ];

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div className={`help-modal ${isRTL ? 'rtl' : 'ltr'}`} onClick={e => e.stopPropagation()}>
        <div className="help-header">
          <h2>{isRTL ? 'מרכז עזרה' : 'Help Center'}</h2>
          <button className="close-button" onClick={onClose}><CloseIcon size={20} /></button>
        </div>

        <div className="help-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`help-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{helpContent[tab.id].title}</span>
            </button>
          ))}
        </div>

        <div className="help-content">
          {helpContent[activeTab].content}
        </div>

        <div className="help-footer">
          <p>{isRTL ? 'גרסה 2.0.0' : 'Version 2.0.0'}</p>
          <p>{isRTL ? '© 2024 IntelliCare. כל הזכויות שמורות.' : '© 2024 IntelliCare. All rights reserved.'}</p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;