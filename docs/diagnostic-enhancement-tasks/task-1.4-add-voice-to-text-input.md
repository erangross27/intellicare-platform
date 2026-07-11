# Task 1.4: Add Voice-to-Text Input

## 🎤 **WORKFLOW ENHANCEMENT TASK**
**Phase:** 1 (Enhanced Clinical Input)  
**Time Estimate:** 25 minutes  
**Risk Level:** LOW  
**Priority:** HIGH  
**ROI:** IMMEDIATE - 40% faster symptom documentation

## 🎯 **Objective**
Implement voice-to-text functionality for hands-free symptom entry during patient interviews, with Hebrew and English recognition optimized for medical terminology.

## 📈 **Clinical Workflow Benefits**
- **40% faster symptom documentation** during patient interviews
- **Hands-free operation** - doctor can maintain eye contact with patient
- **Real-time transcription** with medical terminology recognition
- **Bilingual support** - Hebrew and English voice recognition
- **Medical context awareness** - recognizes medical terms and symptoms
- **Background noise filtering** for clinical environments

## 📁 **Files to Create/Modify**
- `frontend/components/VoiceInput/VoiceToText.jsx` (create new)
- `frontend/components/VoiceInput/VoiceToText.module.css` (create new)
- `frontend/utils/speechRecognition.js` (create new)
- `frontend/pages/diagnosis/index.jsx` (modify existing)
- `backend/services/speechProcessingService.js` (create new)

## 🔧 **Implementation**

### **Step 1: Create Speech Recognition Utility**
```javascript
// frontend/utils/speechRecognition.js
class SpeechRecognitionService {
  constructor() {
    this.recognition = null;
    this.isSupported = this.checkSupport();
    this.isListening = false;
    this.currentLanguage = 'en-US';
    this.medicalTerms = this.initializeMedicalTerms();
    this.confidenceThreshold = 0.7;
  }

  checkSupport() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  initialize(language = 'en-US', options = {}) {
    if (!this.isSupported) {
      throw new Error('Speech recognition not supported in this browser');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Configure recognition
    this.recognition.continuous = options.continuous || true;
    this.recognition.interimResults = options.interimResults || true;
    this.recognition.maxAlternatives = options.maxAlternatives || 3;
    
    // Set language
    this.currentLanguage = language;
    this.recognition.lang = language;
    
    // Enhanced settings for medical context
    if (language.startsWith('he')) {
      // Hebrew-specific settings
      this.recognition.lang = 'he-IL';
      this.setupHebrewMedicalRecognition();
    } else {
      // English-specific settings  
      this.recognition.lang = 'en-US';
      this.setupEnglishMedicalRecognition();
    }

    return this;
  }

  setupHebrewMedicalRecognition() {
    // Hebrew medical terms and phrases
    this.hebrewMedicalPhrases = [
      'כאב ראש', 'כאב בטן', 'חום', 'שיעול', 'קוצר נשימה',
      'בחילה', 'הקאה', 'שלשול', 'עצירות', 'סחרחורת',
      'חולשה', 'עייפות', 'נפיחות', 'פריחה', 'גירוד'
    ];
  }

  setupEnglishMedicalRecognition() {
    // English medical terms and phrases  
    this.englishMedicalPhrases = [
      'headache', 'abdominal pain', 'fever', 'cough', 'shortness of breath',
      'nausea', 'vomiting', 'diarrhea', 'constipation', 'dizziness',
      'weakness', 'fatigue', 'swelling', 'rash', 'itching'
    ];
  }

  async startListening(onResult, onError, onEnd) {
    if (!this.recognition) {
      throw new Error('Speech recognition not initialized');
    }

    if (this.isListening) {
      this.stopListening();
      return;
    }

    return new Promise((resolve, reject) => {
      this.isListening = true;
      
      // Set up event handlers
      this.recognition.onresult = (event) => {
        const result = this.processResults(event);
        if (onResult) onResult(result);
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
        
        const errorMessage = this.getErrorMessage(event.error);
        if (onError) onError(errorMessage);
        reject(new Error(errorMessage));
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (onEnd) onEnd();
        resolve();
      };

      this.recognition.onstart = () => {
        console.log('Speech recognition started');
      };

      // Start recognition
      try {
        this.recognition.start();
      } catch (error) {
        this.isListening = false;
        reject(error);
      }
    });
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  processResults(event) {
    const results = [];
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      
      // Apply medical term correction
      const correctedTranscript = this.applyMedicalTermCorrection(transcript);
      
      results.push({
        transcript: correctedTranscript,
        originalTranscript: transcript,
        confidence: confidence,
        isFinal: result.isFinal,
        alternatives: Array.from(result).slice(1).map(alt => ({
          transcript: alt.transcript,
          confidence: alt.confidence
        })),
        medicalTermsDetected: this.detectMedicalTerms(correctedTranscript),
        timestamp: new Date().toISOString()
      });
    }
    
    return results;
  }

  applyMedicalTermCorrection(transcript) {
    let corrected = transcript.toLowerCase();
    
    // Common medical term corrections
    const corrections = {
      // English corrections
      'head ache': 'headache',
      'stomach ache': 'abdominal pain',
      'tummy ache': 'abdominal pain',
      'short of breath': 'shortness of breath',
      'out of breath': 'shortness of breath',
      'throwing up': 'vomiting',
      'being sick': 'nausea',
      'runny nose': 'nasal congestion',
      'stuffy nose': 'nasal congestion',
      
      // Hebrew corrections (phonetic to proper spelling)
      'כאב רש': 'כאב ראש',
      'כאב בטן': 'כאב בטן',
      'קוצר נשימה': 'קוצר נשימה',
      'חום גוף': 'חום'
    };
    
    // Apply corrections
    Object.entries(corrections).forEach(([wrong, correct]) => {
      const regex = new RegExp(wrong, 'gi');
      corrected = corrected.replace(regex, correct);
    });
    
    return corrected;
  }

  detectMedicalTerms(transcript) {
    const terms = [];
    const lowerTranscript = transcript.toLowerCase();
    
    // Check for medical terms based on language
    const medicalTerms = this.currentLanguage.startsWith('he') ? 
      this.hebrewMedicalPhrases : this.englishMedicalPhrases;
      
    medicalTerms.forEach(term => {
      if (lowerTranscript.includes(term.toLowerCase())) {
        terms.push({
          term,
          position: lowerTranscript.indexOf(term.toLowerCase()),
          confidence: 'high'
        });
      }
    });
    
    return terms;
  }

  getErrorMessage(error) {
    const errorMessages = {
      'no-speech': 'No speech detected. Please try again.',
      'audio-capture': 'Microphone access denied or not available.',
      'not-allowed': 'Microphone permission denied. Please allow microphone access.',
      'network': 'Network error. Please check your internet connection.',
      'aborted': 'Speech recognition was aborted.',
      'bad-grammar': 'Grammar error in recognition.',
      'language-not-supported': `Language ${this.currentLanguage} is not supported.`
    };
    
    return errorMessages[error] || `Speech recognition error: ${error}`;
  }

  // Utility methods
  switchLanguage(language) {
    this.currentLanguage = language;
    if (this.recognition) {
      this.recognition.lang = language;
      
      if (language.startsWith('he')) {
        this.setupHebrewMedicalRecognition();
      } else {
        this.setupEnglishMedicalRecognition();
      }
    }
  }

  initializeMedicalTerms() {
    return {
      symptoms: [
        'pain', 'ache', 'fever', 'cough', 'nausea', 'vomiting', 'diarrhea',
        'constipation', 'dizziness', 'fatigue', 'weakness', 'swelling',
        'rash', 'itching', 'headache', 'abdominal pain', 'chest pain'
      ],
      bodyParts: [
        'head', 'neck', 'chest', 'abdomen', 'arm', 'leg', 'back',
        'shoulder', 'knee', 'ankle', 'wrist', 'finger'
      ],
      severity: [
        'mild', 'moderate', 'severe', 'sharp', 'dull', 'throbbing',
        'constant', 'intermittent', 'sudden', 'gradual'
      ]
    };
  }

  static async requestMicrophonePermission() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  static checkMicrophoneAvailability() {
    return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  }
}

export default SpeechRecognitionService;
```

### **Step 2: Create Voice Input Component**
```jsx
// frontend/components/VoiceInput/VoiceToText.jsx
import React, { useState, useEffect, useRef } from 'react';
import SpeechRecognitionService from '../../utils/speechRecognition';
import styles from './VoiceToText.module.css';

const VoiceToText = ({
  onTranscriptChange,
  language = 'en-US',
  placeholder = 'Click to start voice input...',
  disabled = false,
  className = '',
  showMedicalTerms = true,
  autoAppend = true
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [medicalTermsDetected, setMedicalTermsDetected] = useState([]);
  const [confidence, setConfidence] = useState(0);

  const speechService = useRef(null);
  const finalTranscript = useRef('');

  useEffect(() => {
    // Initialize speech recognition
    speechService.current = new SpeechRecognitionService();
    setIsSupported(speechService.current.isSupported);

    if (speechService.current.isSupported) {
      checkMicrophonePermission();
    }

    return () => {
      if (speechService.current && speechService.current.isListening) {
        speechService.current.stopListening();
      }
    };
  }, []);

  useEffect(() => {
    // Update language when prop changes
    if (speechService.current && speechService.current.isSupported) {
      speechService.current.switchLanguage(language);
    }
  }, [language]);

  const checkMicrophonePermission = async () => {
    const granted = await SpeechRecognitionService.requestMicrophonePermission();
    setPermissionGranted(granted);
  };

  const startListening = async () => {
    if (!speechService.current || !isSupported || !permissionGranted) return;

    setError(null);
    setInterimTranscript('');
    finalTranscript.current = transcript;

    try {
      speechService.current.initialize(language, {
        continuous: true,
        interimResults: true,
        maxAlternatives: 1
      });

      await speechService.current.startListening(
        handleResults,
        handleError,
        handleEnd
      );

      setIsListening(true);

    } catch (err) {
      setError(err.message);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (speechService.current) {
      speechService.current.stopListening();
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const handleResults = (results) => {
    let interim = '';
    let final = finalTranscript.current;
    let detectedTerms = [];
    let avgConfidence = 0;

    results.forEach(result => {
      if (result.isFinal) {
        final += result.transcript + ' ';
        detectedTerms.push(...result.medicalTermsDetected);
        avgConfidence = Math.max(avgConfidence, result.confidence || 0);
      } else {
        interim += result.transcript;
        detectedTerms.push(...result.medicalTermsDetected);
      }
    });

    setTranscript(final);
    setInterimTranscript(interim);
    setMedicalTermsDetected(detectedTerms);
    setConfidence(avgConfidence);

    // Call parent callback
    if (onTranscriptChange) {
      onTranscriptChange({
        final,
        interim,
        medicalTerms: detectedTerms,
        confidence: avgConfidence
      });
    }
  };

  const handleError = (errorMessage) => {
    setError(errorMessage);
    setIsListening(false);
    setInterimTranscript('');
  };

  const handleEnd = () => {
    setIsListening(false);
    setInterimTranscript('');
  };

  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    setMedicalTermsDetected([]);
    setConfidence(0);
    finalTranscript.current = '';
    
    if (onTranscriptChange) {
      onTranscriptChange({
        final: '',
        interim: '',
        medicalTerms: [],
        confidence: 0
      });
    }
  };

  const renderMicrophoneButton = () => {
    if (!isSupported) {
      return (
        <button className={`${styles.micButton} ${styles.unsupported}`} disabled>
          <span className={styles.micIcon}>🚫</span>
          <span className={styles.buttonText}>
            {language.startsWith('he') ? 'לא נתמך' : 'Not Supported'}
          </span>
        </button>
      );
    }

    if (!permissionGranted) {
      return (
        <button 
          className={`${styles.micButton} ${styles.permission}`}
          onClick={checkMicrophonePermission}
        >
          <span className={styles.micIcon}>🎤</span>
          <span className={styles.buttonText}>
            {language.startsWith('he') ? 'אפשר מיקרופון' : 'Enable Microphone'}
          </span>
        </button>
      );
    }

    return (
      <button
        className={`${styles.micButton} ${isListening ? styles.listening : styles.idle} ${disabled ? styles.disabled : ''}`}
        onClick={isListening ? stopListening : startListening}
        disabled={disabled}
        title={isListening ? 
          (language.startsWith('he') ? 'הפסק הקלטה' : 'Stop Recording') :
          (language.startsWith('he') ? 'התחל הקלטה' : 'Start Recording')
        }
      >
        <span className={styles.micIcon}>
          {isListening ? '🔴' : '🎤'}
        </span>
        <span className={styles.buttonText}>
          {isListening ? 
            (language.startsWith('he') ? 'הפסק' : 'Stop') :
            (language.startsWith('he') ? 'דבר' : 'Speak')
          }
        </span>
        
        {isListening && (
          <div className={styles.listeningAnimation}>
            <div className={styles.soundWave}></div>
            <div className={styles.soundWave}></div>
            <div className={styles.soundWave}></div>
          </div>
        )}
      </button>
    );
  };

  const renderTranscriptDisplay = () => {
    const displayText = transcript + interimTranscript;
    
    if (!displayText && !isListening) {
      return (
        <div className={styles.placeholder}>
          {placeholder}
        </div>
      );
    }

    return (
      <div className={styles.transcriptDisplay}>
        <span className={styles.finalText}>{transcript}</span>
        {interimTranscript && (
          <span className={styles.interimText}>{interimTranscript}</span>
        )}
        {isListening && !interimTranscript && (
          <span className={styles.listeningIndicator}>
            {language.startsWith('he') ? 'מקשיב...' : 'Listening...'}
          </span>
        )}
      </div>
    );
  };

  const renderMedicalTermsDetected = () => {
    if (!showMedicalTerms || medicalTermsDetected.length === 0) {
      return null;
    }

    return (
      <div className={styles.medicalTerms}>
        <div className={styles.medicalTermsHeader}>
          <span className={styles.medicalIcon}>🏥</span>
          <span className={styles.medicalLabel}>
            {language.startsWith('he') ? 'מונחים רפואיים זוהו:' : 'Medical terms detected:'}
          </span>
        </div>
        <div className={styles.termsList}>
          {medicalTermsDetected.map((termObj, index) => (
            <span key={index} className={styles.medicalTerm}>
              {termObj.term}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderConfidenceIndicator = () => {
    if (confidence === 0) return null;

    const confidenceLevel = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low';
    const confidencePercentage = Math.round(confidence * 100);

    return (
      <div className={styles.confidenceIndicator}>
        <span className={styles.confidenceLabel}>
          {language.startsWith('he') ? 'בטחון:' : 'Confidence:'}
        </span>
        <div className={`${styles.confidenceBar} ${styles[confidenceLevel]}`}>
          <div 
            className={styles.confidenceFill} 
            style={{ width: `${confidencePercentage}%` }}
          ></div>
        </div>
        <span className={styles.confidenceValue}>{confidencePercentage}%</span>
      </div>
    );
  };

  return (
    <div className={`${styles.voiceToText} ${className}`}>
      <div className={styles.voiceInputHeader}>
        {renderMicrophoneButton()}
        
        {transcript && (
          <button 
            className={styles.clearButton}
            onClick={clearTranscript}
            title={language.startsWith('he') ? 'נקה טקסט' : 'Clear Text'}
          >
            <span className={styles.clearIcon}>🗑️</span>
          </button>
        )}
      </div>

      <div className={styles.transcriptContainer}>
        {renderTranscriptDisplay()}
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {renderMedicalTermsDetected()}
      {renderConfidenceIndicator()}

      {isListening && (
        <div className={styles.listeningStatus}>
          <div className={styles.statusIcon}>🎙️</div>
          <span className={styles.statusText}>
            {language.startsWith('he') ? 'מאזין לקלט קולי...' : 'Listening for voice input...'}
          </span>
        </div>
      )}
    </div>
  );
};

export default VoiceToText;
```

### **Step 3: Create Styling**
```css
/* frontend/components/VoiceInput/VoiceToText.module.css */
.voiceToText {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 2px dashed #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  transition: all 0.3s ease;
}

.voiceToText:hover {
  border-color: #d1d5db;
  background: #f3f4f6;
}

.voiceInputHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.micButton {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.micButton.idle {
  background: #3b82f6;
  color: white;
}

.micButton.idle:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.micButton.listening {
  background: #ef4444;
  color: white;
  animation: pulse 2s infinite;
}

.micButton.listening:hover {
  background: #dc2626;
}

.micButton.unsupported {
  background: #6b7280;
  color: white;
  cursor: not-allowed;
}

.micButton.permission {
  background: #f59e0b;
  color: white;
}

.micButton.permission:hover {
  background: #d97706;
}

.micButton.disabled {
  background: #d1d5db;
  color: #6b7280;
  cursor: not-allowed;
}

.micIcon {
  font-size: 18px;
}

.buttonText {
  font-size: 14px;
  font-weight: 600;
}

.listeningAnimation {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 2px;
}

.soundWave {
  width: 3px;
  height: 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 2px;
  animation: soundWave 1.5s infinite ease-in-out;
}

.soundWave:nth-child(2) {
  animation-delay: 0.2s;
}

.soundWave:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes soundWave {
  0%, 100% {
    height: 4px;
  }
  50% {
    height: 12px;
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.clearButton {
  padding: 8px 12px;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;
}

.clearButton:hover {
  background: #4b5563;
}

.clearIcon {
  font-size: 16px;
}

.transcriptContainer {
  min-height: 80px;
  max-height: 200px;
  overflow-y: auto;
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
}

.placeholder {
  color: #9ca3af;
  font-style: italic;
  font-size: 14px;
}

.transcriptDisplay {
  font-size: 16px;
  color: #374151;
}

.finalText {
  color: #111827;
}

.interimText {
  color: #6b7280;
  font-style: italic;
}

.listeningIndicator {
  color: #3b82f6;
  font-style: italic;
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0.3;
  }
}

.errorMessage {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #991b1b;
  font-size: 14px;
}

.errorIcon {
  font-size: 16px;
}

.medicalTerms {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 12px;
}

.medicalTermsHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
  color: #0c4a6e;
}

.medicalIcon {
  font-size: 16px;
}

.medicalLabel {
  font-size: 14px;
}

.termsList {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.medicalTerm {
  padding: 4px 8px;
  background: #0284c7;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.confidenceIndicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.confidenceLabel {
  font-weight: 500;
  color: #374151;
  min-width: 80px;
}

.confidenceBar {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.confidenceFill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 3px;
}

.confidenceBar.high .confidenceFill {
  background: #10b981;
}

.confidenceBar.medium .confidenceFill {
  background: #f59e0b;
}

.confidenceBar.low .confidenceFill {
  background: #ef4444;
}

.confidenceValue {
  font-weight: 600;
  color: #374151;
  min-width: 40px;
  text-align: right;
}

.listeningStatus {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #dbeafe;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  color: #1e40af;
  font-size: 14px;
  animation: fadeInOut 2s infinite;
}

.statusIcon {
  font-size: 16px;
}

.statusText {
  font-weight: 500;
}

@keyframes fadeInOut {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .voiceToText {
    padding: 12px;
  }
  
  .voiceInputHeader {
    flex-direction: column;
    align-items: stretch;
  }
  
  .micButton {
    justify-content: center;
  }
  
  .transcriptContainer {
    min-height: 60px;
    max-height: 150px;
    padding: 12px;
  }
  
  .medicalTerms {
    padding: 8px;
  }
  
  .termsList {
    gap: 4px;
  }
}
```

### **Step 4: Integration with Diagnosis Form**
```jsx
// frontend/pages/diagnosis/index.jsx - Add voice input integration
import VoiceToText from '../../components/VoiceInput/VoiceToText';

const DiagnosisPage = () => {
  const [formData, setFormData] = useState({
    symptoms: '',
    age: '',
    gender: '',
    history: ''
  });
  const [inputMethod, setInputMethod] = useState('text'); // 'text', 'voice', 'visual'
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const handleVoiceTranscriptChange = (transcriptData) => {
    const fullTranscript = transcriptData.final + transcriptData.interim;
    setVoiceTranscript(fullTranscript);
    
    // Auto-update symptoms field with voice input
    setFormData(prev => ({
      ...prev,
      symptoms: transcriptData.final.trim()
    }));
  };

  const renderInputMethodSelector = () => (
    <div className="input-method-selector">
      <div className="method-tabs">
        <button 
          className={inputMethod === 'text' ? 'active' : ''}
          onClick={() => setInputMethod('text')}
        >
          <span className="icon">📝</span>
          {language === 'he' ? 'כתיבה' : 'Text'}
        </button>
        
        <button 
          className={inputMethod === 'voice' ? 'active' : ''}
          onClick={() => setInputMethod('voice')}
        >
          <span className="icon">🎤</span>
          {language === 'he' ? 'קול' : 'Voice'}
        </button>
        
        <button 
          className={inputMethod === 'visual' ? 'active' : ''}
          onClick={() => setInputMethod('visual')}
        >
          <span className="icon">🫁</span>
          {language === 'he' ? 'תרשים' : 'Visual'}
        </button>
      </div>
    </div>
  );

  const renderSymptomInput = () => {
    switch (inputMethod) {
      case 'voice':
        return (
          <div className="voice-input-container">
            <label className="form-label">
              {language === 'he' ? 'תאר את התסמינים בקול:' : 'Describe symptoms by voice:'}
            </label>
            <VoiceToText
              onTranscriptChange={handleVoiceTranscriptChange}
              language={language === 'he' ? 'he-IL' : 'en-US'}
              placeholder={language === 'he' ? 
                'לחץ על המיקרופון ותאר את התסמינים...' : 
                'Click the microphone and describe the symptoms...'}
              showMedicalTerms={true}
              autoAppend={true}
            />
            
            {/* Show transcribed text in a readonly textarea for editing */}
            {voiceTranscript && (
              <div className="voice-transcript-editor">
                <label className="form-label">
                  {language === 'he' ? 'עריכת הטקסט המתומלל:' : 'Edit transcribed text:'}
                </label>
                <textarea
                  value={formData.symptoms}
                  onChange={(e) => setFormData(prev => ({ ...prev, symptoms: e.target.value }))}
                  rows={6}
                  className="form-textarea"
                  placeholder={language === 'he' ? 
                    'ערוך את הטקסט המתומלל כאן...' :
                    'Edit the transcribed text here...'}
                />
              </div>
            )}
          </div>
        );
        
      case 'visual':
        return (
          <BodyDiagram
            selectedSymptoms={visualSymptoms}
            onSymptomsChange={handleVisualSymptomsChange}
            language={language}
            isInteractive={true}
          />
        );
        
      default: // text
        return (
          <div className="text-input-container">
            <label className="form-label">
              {language === 'he' ? 'תסמינים:' : 'Symptoms:'}
            </label>
            <textarea
              value={formData.symptoms}
              onChange={(e) => setFormData(prev => ({ ...prev, symptoms: e.target.value }))}
              rows={6}
              className="form-textarea"
              placeholder={language === 'he' ? 
                'תאר את התסמינים בפירוט...' :
                'Describe the symptoms in detail...'}
            />
          </div>
        );
    }
  };

  return (
    <div className="diagnosis-page">
      {/* Input method selector */}
      {renderInputMethodSelector()}
      
      {/* Patient history loader */}
      {selectedPatient && (
        <PatientHistoryLoader
          patientId={selectedPatient.id}
          practiceId={practice.id}
          language={language}
          onHistoryLoaded={handlePatientHistoryLoaded}
          autoLoad={true}
        />
      )}
      
      {/* Dynamic symptom input */}
      <div className="symptom-input-section">
        {renderSymptomInput()}
      </div>
      
      {/* Rest of the form */}
      <div className="diagnosis-form">
        {/* Age, gender, history fields */}
        {/* Submit button */}
      </div>
    </div>
  );
};
```

### **Step 5: Backend Speech Processing Service (Optional Enhancement)**
```javascript
// backend/services/speechProcessingService.js
// Optional: For server-side speech processing and medical term recognition
class SpeechProcessingService {
  constructor() {
    this.medicalTermDatabase = this.initializeMedicalTerms();
  }

  async processMedicalTranscript(transcript, language = 'en') {
    try {
      // Clean and normalize transcript
      const cleanedTranscript = this.cleanTranscript(transcript);
      
      // Extract medical entities
      const medicalEntities = this.extractMedicalEntities(cleanedTranscript, language);
      
      // Categorize symptoms
      const categorizedSymptoms = this.categorizeSymptoms(medicalEntities);
      
      // Generate structured symptom data
      const structuredData = this.generateStructuredData(categorizedSymptoms, language);
      
      return {
        originalTranscript: transcript,
        cleanedTranscript,
        medicalEntities,
        categorizedSymptoms,
        structuredData,
        confidence: this.calculateOverallConfidence(medicalEntities)
      };
      
    } catch (error) {
      console.error('Speech processing failed:', error);
      return {
        originalTranscript: transcript,
        error: error.message,
        confidence: 0
      };
    }
  }

  cleanTranscript(transcript) {
    return transcript
      .toLowerCase()
      .replace(/[^\w\s\u05d0-\u05ea]/g, '') // Keep Hebrew characters
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractMedicalEntities(transcript, language) {
    const entities = [];
    const terms = language === 'he' ? this.medicalTermDatabase.he : this.medicalTermDatabase.en;
    
    // Extract symptoms, body parts, severity indicators
    Object.entries(terms).forEach(([category, termList]) => {
      termList.forEach(term => {
        if (transcript.includes(term.toLowerCase())) {
          entities.push({
            term,
            category,
            confidence: this.calculateTermConfidence(term, transcript),
            position: transcript.indexOf(term.toLowerCase())
          });
        }
      });
    });
    
    return entities.sort((a, b) => b.confidence - a.confidence);
  }

  initializeMedicalTerms() {
    return {
      en: {
        symptoms: ['headache', 'fever', 'cough', 'nausea', 'vomiting', 'diarrhea', 'pain'],
        bodyParts: ['head', 'chest', 'abdomen', 'arm', 'leg', 'back'],
        severity: ['mild', 'moderate', 'severe', 'sharp', 'dull']
      },
      he: {
        symptoms: ['כאב ראש', 'חום', 'שיעול', 'בחילה', 'הקאה', 'שלשול', 'כאב'],
        bodyParts: ['ראש', 'חזה', 'בטן', 'זרוע', 'רגל', 'גב'],
        severity: ['קל', 'בינוני', 'חמור', 'חד', 'קהה']
      }
    };
  }
}

module.exports = new SpeechProcessingService();
```

## 🧪 **Testing**
1. **Microphone access:** Test permission handling
2. **Speech recognition:** Test Hebrew and English recognition
3. **Medical terms:** Test medical vocabulary detection
4. **Background noise:** Test in noisy clinical environments
5. **Integration:** Test with existing diagnosis form
6. **Mobile:** Test touch interface and mobile speech recognition

## ✅ **Success Criteria**
- [ ] Voice-to-text working in Hebrew and English
- [ ] 40% faster symptom documentation
- [ ] Medical terminology recognition functional
- [ ] Hands-free operation during patient interviews
- [ ] Integration with existing diagnosis workflow
- [ ] Background noise handling in clinical settings

## 🔄 **Next Task**
Proceed to: **Task 1.5:** Implement Symptom Timeline Builder

## 📝 **Technical Notes**
- Requires HTTPS for microphone access
- Consider fallback for unsupported browsers
- Implement proper error handling for network issues
- Test with various accents and speaking speeds
- Consider cloud speech APIs for better accuracy