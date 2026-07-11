// IntelliCare Voice Interface Component
// Provides voice command functionality for AI agent interaction

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '../config/languagesStatic';
import secureApi from '../services/secureApiClient';

const VoiceInterface = ({ onResponse, sessionId, disabled = false }) => {
  const { t, currentLanguage, isRTL } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  // Memoized styles for performance
  const containerStyle = useMemo(() => ({
    padding: '20px',
    border: '2px solid #667eea',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.03) 100%)',
    marginBottom: '20px',
    textAlign: 'center',
    direction: isRTL ? 'rtl' : 'ltr'
  }), [isRTL]);

  const buttonStyle = useMemo(() => ({
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: 'none',
    background: isRecording 
      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    fontSize: '2rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
    transition: 'all 0.3s ease',
    opacity: disabled ? 0.5 : 1,
    marginBottom: '15px'
  }), [isRecording, disabled]);

  const statusStyle = useMemo(() => ({
    fontSize: '1.1rem',
    fontWeight: '600',
    color: isRecording ? '#ef4444' : '#667eea',
    marginBottom: '10px'
  }), [isRecording]);

  const transcriptStyle = useMemo(() => ({
    background: '#f8faff',
    border: '1px solid rgba(102, 126, 234, 0.2)',
    borderRadius: '12px',
    padding: '15px',
    marginTop: '15px',
    fontSize: '1rem',
    lineHeight: '1.6',
    color: '#2d3748',
    textAlign: isRTL ? 'right' : 'left',
    direction: isRTL ? 'rtl' : 'ltr',
    fontFamily: isRTL ? 'Arial, sans-serif' : 'inherit'
  }), [isRTL]);

  const responseStyle = useMemo(() => ({
    background: 'linear-gradient(135deg, #f0fff4 0%, #f7fafc 100%)',
    border: '1px solid rgba(72, 187, 120, 0.2)',
    borderRadius: '12px',
    padding: '15px',
    marginTop: '15px',
    fontSize: '1rem',
    lineHeight: '1.6',
    color: '#2d3748',
    textAlign: isRTL ? 'right' : 'left',
    direction: isRTL ? 'rtl' : 'ltr',
    fontFamily: isRTL ? 'Arial, sans-serif' : 'inherit'
  }), [isRTL]);

  const errorStyle = useMemo(() => ({
    background: '#fef2f2',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '12px',
    padding: '15px',
    marginTop: '15px',
    fontSize: '1rem',
    color: '#dc2626',
    textAlign: isRTL ? 'right' : 'left',
    direction: isRTL ? 'rtl' : 'ltr'
  }), [isRTL]);

  // Start recording audio
  const startRecording = useCallback(async () => {
    try {
      setError('');
      setTranscript('');
      setResponse('');
      setAudioUrl('');

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        processAudio();
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error starting recording:', error);
      setError(t('microphoneAccessError') || 'Microphone access denied');
    }
  }, [t]);

  // Stop recording audio
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Process recorded audio
  const processAudio = useCallback(async () => {
    try {
      setIsProcessing(true);

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-command.webm');
      formData.append('sessionId', sessionId);
      formData.append('language', currentLanguage === 'he' ? 'he-IL' : 'en-US');

      const result = await secureApi.post('/agent/voice-command', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (result.success) {
        setTranscript(result.data.transcript);
        setResponse(result.data.response);

        // Play audio response if available
        if (result.data.audioResponse) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(result.data.audioResponse), c => c.charCodeAt(0))],
            { type: 'audio/mp3' }
          );
          const audioUrl = URL.createObjectURL(audioBlob);
          setAudioUrl(audioUrl);
          
          // Auto-play the response
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.play().catch(error => {
              process.env.NODE_ENV !== 'production' && console.error('Error playing audio:', error);
            });
          }
        }

        // Notify parent component
        if (onResponse) {
          onResponse({
            transcript: result.data.transcript,
            response: result.data.response,
            toolUsed: result.data.toolUsed,
            toolResult: result.data.toolResult,
            confidence: result.data.confidence
          });
        }

      } else {
        setError(result.error || t('voiceProcessingError'));
      }

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error processing audio:', error);
      setError(t('voiceProcessingError') || 'Voice processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, currentLanguage, onResponse, t]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (disabled) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, disabled, startRecording, stopRecording]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (isProcessing) return t('processingVoice') || 'Processing...';
    if (isRecording) return t('recording') || 'Recording...';
    return t('clickToSpeak') || 'Click to speak';
  }, [isProcessing, isRecording, t]);

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 20px 0', color: '#667eea' }}>
        {t('voiceAssistant') || 'Voice Assistant'}
      </h3>
      
      <button
        style={buttonStyle}
        onClick={toggleRecording}
        disabled={disabled || isProcessing}
        title={getStatusText()}
      >
        {isProcessing ? '⏳' : isRecording ? '⏹️' : '🎤'}
      </button>
      
      <div style={statusStyle}>
        {getStatusText()}
      </div>

      {transcript && (
        <div style={transcriptStyle}>
          <strong>{t('youSaid') || 'You said:'}</strong>
          <br />
          {transcript}
        </div>
      )}

      {response && (
        <div style={responseStyle}>
          <strong>{t('assistantResponse') || 'Assistant:'}</strong>
          <br />
          {response}
          {audioUrl && (
            <div style={{ marginTop: '10px' }}>
              <audio ref={audioRef} controls style={{ width: '100%' }}>
                <source src={audioUrl} type="audio/mp3" />
                {t('audioNotSupported') || 'Audio not supported'}
              </audio>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={errorStyle}>
          <strong>{t('error') || 'Error:'}</strong>
          <br />
          {error}
        </div>
      )}
    </div>
  );
};

export default React.memo(VoiceInterface);
