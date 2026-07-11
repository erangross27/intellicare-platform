import React, { useState, useRef, useCallback, useEffect } from 'react';
import secureApi from '../../services/secureApiClient';
import './VoiceRecordingButton.css';

const VoiceRecordingButton = ({
  onTranscriptUpdate,
  onVoiceChatText,
  onVisitStarted,
  onVisitEnded,
  patientContext,
  isRecording,
  setIsRecording,
  visitId,
  onRecordingModeChange,
  flushRef,
  stopRef,
  isSpeaking = false,
  onStopSpeaking,
  onPatientFound,
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingMode, setRecordingMode] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null); // Processing status shown after recording stops
  // Voice-based patient lookup state
  const [lookupPhase, setLookupPhase] = useState(null); // null | 'listening' | 'searching' | 'found'

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const timerRef = useRef(null);
  const popupRef = useRef(null);
  const lookupAudioRef = useRef(null); // TTS audio element for lookup

  // Refs for callback props — avoids stale closures in WebSocket onmessage handler
  const onVoiceChatTextRef = useRef(onVoiceChatText);
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
  const onVisitEndedRef = useRef(onVisitEnded);
  const onPatientFoundRef = useRef(onPatientFound);
  useEffect(() => { onVoiceChatTextRef.current = onVoiceChatText; }, [onVoiceChatText]);
  useEffect(() => { onTranscriptUpdateRef.current = onTranscriptUpdate; }, [onTranscriptUpdate]);
  useEffect(() => { onVisitEndedRef.current = onVisitEnded; }, [onVisitEnded]);
  useEffect(() => { onPatientFoundRef.current = onPatientFound; }, [onPatientFound]);

  const patientContextRef = useRef(patientContext);
  useEffect(() => { patientContextRef.current = patientContext; }, [patientContext]);

  // Echo prevention: mute mic while TTS is playing (ref for onaudioprocess handler)
  const isSpeakingRef = useRef(false);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // Stop flag: prevents queued onaudioprocess events from sending after stopRecording
  const stoppedRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setShowPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Local TTS helper ───────────────────────────────────────────────
  // Speaks text via /api/tts/speak and manages isSpeakingRef for echo prevention.
  // Returns a promise that resolves when playback finishes.
  const speakTextLocal = useCallback(async (text) => {
    try {
      isSpeakingRef.current = true;
      const blob = await secureApi.post('/api/tts/speak', { text }, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      lookupAudioRef.current = audio;
      return new Promise((resolve) => {
        audio.onended = () => {
          isSpeakingRef.current = false;
          lookupAudioRef.current = null;
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          isSpeakingRef.current = false;
          lookupAudioRef.current = null;
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.play().catch(() => {
          isSpeakingRef.current = false;
          lookupAudioRef.current = null;
          resolve();
        });
      });
    } catch (err) {
      console.error('[Voice Lookup] TTS failed:', err);
      isSpeakingRef.current = false;
    }
  }, []);

  // ─── Shared audio pipeline setup ────────────────────────────────────
  // Used by both startRecording and startPatientLookup to avoid duplicating
  // the mic → AudioContext → ScriptProcessor → WebSocket pipeline.
  const setupAudioPipeline = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      }
    });
    mediaStreamRef.current = stream;

    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/visit-recording`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Wire audio processor — sends PCM to WebSocket
    processor.onaudioprocess = (e) => {
      if (stoppedRef.current) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      if (isSpeakingRef.current) return;
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      const float32 = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
      }
      const uint8 = new Uint8Array(int16.buffer);
      let binary = '';
      const chunkSize = 1024;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
      }
      ws.send(JSON.stringify({ type: 'audio', data: btoa(binary) }));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    return ws;
  }, []);

  // Clean up media/audio resources without touching WebSocket (for error recovery)
  const cleanupMedia = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (flushRef) flushRef.current = null;
    setIsRecording(false);
    setRecordingMode(null);
  }, [setIsRecording, flushRef]);

  // ─── Patient search via REST API ────────────────────────────────────
  const searchPatientByName = useCallback(async (name) => {
    try {
      const data = await secureApi.get(`/api/patients/search?name=${encodeURIComponent(name)}`);
      if (data.success && data.patients && data.patients.length > 0) {
        return data.patients;
      }
      return [];
    } catch (err) {
      console.error('[Voice Lookup] Patient search failed:', err);
      return [];
    }
  }, []);

  // Ref to break circular dependency: startPatientLookup → startRecording
  const startRecordingRef = useRef(null);

  // ─── Start recording (visit or voiceChat) ───────────────────────────
  // patientOverride lets us pass a just-found patient from voice lookup
  // without waiting for the prop to update.
  const startRecording = useCallback(async (mode, consentMethod = 'verbal', patientOverride = null) => {
    stoppedRef.current = false; // Reset stop flag for new recording
    const effectivePatient = patientOverride || patientContext;
    try {
      // For visit mode, create a visit document in the database FIRST so we have a real visitId
      let effectiveVisitId = visitId;
      if (mode === 'visit' && effectivePatient?.id) {
        try {
          const result = await secureApi.post('/api/visits/start', {
            patientId: effectivePatient.id,
            consentObtained: true,
            consentMethod,
          });
          if (result.success && result.visitId) {
            effectiveVisitId = result.visitId;
            console.log('[Voice Recording] Visit created:', effectiveVisitId);
          } else {
            setErrorMessage('Failed to create visit record.');
            setTimeout(() => setErrorMessage(null), 5000);
            return;
          }
        } catch (apiErr) {
          console.error('[Voice Recording] Visit creation failed:', apiErr);
          setErrorMessage('Failed to create visit record.');
          setTimeout(() => setErrorMessage(null), 5000);
          return;
        }
      }

      const ws = await setupAudioPipeline();

      ws.onopen = () => {
        console.log('[Voice Recording] WebSocket OPEN, sending start:', { visitId: effectiveVisitId, mode });
        ws.send(JSON.stringify({ type: 'start', visitId: effectiveVisitId, mode }));
        // Only mark as recording AFTER WebSocket is confirmed open
        setIsRecording(true);
        setRecordingMode(mode);
        if (onRecordingModeChange) onRecordingModeChange(mode);
        if (onVisitStarted) onVisitStarted(effectiveVisitId, mode);
      };

      ws.onerror = (err) => {
        console.error('[Voice Recording] WebSocket ERROR:', err);
        setErrorMessage('Connection failed. Please try again.');
        setTimeout(() => setErrorMessage(null), 5000);
        wsRef.current = null;
        cleanupMedia();
      };

      ws.onclose = (event) => {
        console.warn('[Voice Recording] WebSocket CLOSED:', event.code, event.reason);
        if (event.code !== 1000 && event.code !== 1005) {
          if (event.code === 1006) {
            setErrorMessage('Connection lost. Please try again.');
            setTimeout(() => setErrorMessage(null), 5000);
          }
          wsRef.current = null;
          cleanupMedia();
        }
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log('[Voice Recording] Received:', msg.type, msg.text ? msg.text.substring(0, 50) : '');
        switch (msg.type) {
          case 'session_started':
            console.log('[Voice Recording] STT session started');
            break;
          case 'partial':
            if (mode === 'voiceChat' && onVoiceChatTextRef.current) {
              onVoiceChatTextRef.current(msg.text, true);
            }
            if (onTranscriptUpdateRef.current) onTranscriptUpdateRef.current(msg.text, true);
            break;
          case 'committed':
            if (mode === 'voiceChat' && onVoiceChatTextRef.current) {
              onVoiceChatTextRef.current(msg.text, false);
            }
            if (onTranscriptUpdateRef.current) onTranscriptUpdateRef.current(msg.text, false, msg.speaker);
            break;
          case 'recording_ended':
          case 'recording_saved':
            // Close WebSocket now that we've received the server's final response
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            // Trigger SOAP generation via REST API, then notify parent
            if (msg.visitId && mode === 'visit') {
              console.log('[Voice Recording] Triggering SOAP generation for visit:', msg.visitId);
              setStatusMessage('Generating visit note...');
              secureApi.post(`/api/visits/${msg.visitId}/end`, {
                transcript: msg.transcript,
              })
                .then(data => {
                  console.log('[Voice Recording] SOAP generation result:', data.success);
                  setStatusMessage('Visit note saved!');
                  setTimeout(() => setStatusMessage(null), 3000);
                  if (onVisitEndedRef.current) {
                    onVisitEndedRef.current({ ...msg, aiSummary: data.aiSummary, patientId: patientContextRef.current?.id });
                  }
                })
                .catch(err => {
                  console.error('[Voice Recording] SOAP generation failed:', err);
                  setStatusMessage('Visit saved (note generation failed)');
                  setTimeout(() => setStatusMessage(null), 4000);
                  if (onVisitEndedRef.current) onVisitEndedRef.current({ ...msg, patientId: patientContextRef.current?.id });
                });
            } else {
              setStatusMessage(null);
              if (onVisitEndedRef.current) onVisitEndedRef.current({ ...msg, patientId: patientContextRef.current?.id });
            }
            break;
          case 'summary_ready':
            if (onVisitEndedRef.current) onVisitEndedRef.current({ ...msg, patientId: patientContextRef.current?.id });
            break;
          case 'error':
            console.error('[Voice Recording] Server error:', msg.message);
            setErrorMessage(msg.message || 'Recording error');
            setTimeout(() => setErrorMessage(null), 5000);
            break;
        }
      };

      // Expose flush function so MessageInput can commit the current segment on user edit
      if (flushRef) {
        flushRef.current = () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'flush' }));
          }
        };
      }
    } catch (err) {
      console.error('[Voice Recording] Failed to start:', err);
      setErrorMessage('Could not access microphone. Please check permissions.');
      setTimeout(() => setErrorMessage(null), 5000);
      cleanupMedia();
    }
  }, [visitId, patientContext, onVisitStarted, setIsRecording, onRecordingModeChange, flushRef, cleanupMedia, setupAudioPipeline]);

  // Keep ref in sync so startPatientLookup can call startRecording without circular dep
  startRecordingRef.current = startRecording;

  // ─── Voice-based patient lookup ─────────────────────────────────────
  // When "Record Visit" is clicked without a patient selected, this flow:
  //   1. Opens mic + STT WebSocket (voiceChat mode)
  //   2. TTS asks "What is the patient's name?"
  //   3. Captures spoken name (first committed text)
  //   4. Searches for patient via REST API
  //   5. If found: TTS confirms, notifies parent, starts visit recording
  //   6. If not found: TTS asks to try again
  const startPatientLookup = useCallback(async () => {
    stoppedRef.current = false; // Reset stop flag for new lookup
    setShowPopup(false);
    setLookupPhase('listening');

    try {
      const ws = await setupAudioPipeline();

      ws.onopen = () => {
        console.log('[Voice Lookup] WebSocket OPEN — starting patient name capture');
        ws.send(JSON.stringify({ type: 'start', visitId: null, mode: 'voiceChat' }));
        // Ask for patient name via TTS (mic auto-muted during playback)
        speakTextLocal("What is the patient's name?");
      };

      ws.onerror = (err) => {
        console.error('[Voice Lookup] WebSocket ERROR:', err);
        setErrorMessage('Connection failed. Please try again.');
        setTimeout(() => setErrorMessage(null), 5000);
        wsRef.current = null;
        cleanupMedia();
        setLookupPhase(null);
      };

      ws.onclose = (event) => {
        if (event.code !== 1000 && event.code !== 1005) {
          if (event.code === 1006) {
            setErrorMessage('Connection lost. Please try again.');
            setTimeout(() => setErrorMessage(null), 5000);
          }
          wsRef.current = null;
          cleanupMedia();
          setLookupPhase(null);
        }
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'committed' && msg.text && msg.text.trim().length >= 2) {
          // Extract just the patient name from conversational speech
          // e.g. "The patient name is David Wilson." → "David Wilson"
          let spokenName = msg.text.trim()
            .replace(/[.!?,;]+$/g, '') // strip trailing punctuation
            .replace(/^(the\s+)?patient('s)?\s+(name\s+is|is)\s+/i, '')
            .replace(/^(his|her|the|my)\s+name\s+is\s+/i, '')
            .replace(/^(it's|its|it is)\s+/i, '')
            .trim();
          // Fallback: if stripping removed everything, use original text sans punctuation
          if (spokenName.length < 2) {
            spokenName = msg.text.trim().replace(/[.!?,;]+$/g, '').trim();
          }
          console.log('[Voice Lookup] Got patient name:', spokenName, '(raw:', msg.text, ')');

          // Close the lookup STT session
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'end' }));
            wsRef.current.close();
          }
          wsRef.current = null;
          cleanupMedia();

          setLookupPhase('searching');

          // Search for patient
          const patients = await searchPatientByName(spokenName);

          if (patients.length > 0) {
            const patient = patients[0];
            const patientName = patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
            const patientId = patient._id;

            setLookupPhase('found');

            // Notify parent to update patient context
            if (onPatientFoundRef.current) {
              onPatientFoundRef.current({ id: patientId, name: patientName });
            }

            // Confirm via TTS, then start recording
            await speakTextLocal(`Patient ${patientName} found. Recording is on. You may start your visit.`);

            // Do NOT set lookupPhase=null here — keep 'found' so the stop button stays visible
            // while startRecording creates the new WebSocket. startRecording's ws.onopen will
            // set isRecording=true (keeping isActive=true) and stopRecording clears lookupPhase.

            // Start visit recording with the found patient (use ref to avoid circular dep)
            if (startRecordingRef.current) {
              startRecordingRef.current('visit', 'verbal', { id: patientId, name: patientName });
            }
          } else {
            // Patient not found
            setLookupPhase(null);
            await speakTextLocal(`No patient found with name ${spokenName}. Please try again.`);
            setErrorMessage(`Patient "${spokenName}" not found. Try again or select a patient first.`);
            setTimeout(() => setErrorMessage(null), 5000);
          }
        }
        // Ignore partials during lookup — we only care about committed text
      };

    } catch (err) {
      console.error('[Voice Lookup] Failed to start:', err);
      setErrorMessage('Could not access microphone. Please check permissions.');
      setTimeout(() => setErrorMessage(null), 5000);
      cleanupMedia();
      setLookupPhase(null);
    }
  }, [setupAudioPipeline, cleanupMedia, speakTextLocal, searchPatientByName]);

  const stopRecording = useCallback(() => {
    console.log('[Voice Recording] stopRecording() called');
    stoppedRef.current = true; // Immediately prevent any more audio from being sent

    // Stop TTS playback immediately when user clicks stop
    if (onStopSpeaking) onStopSpeaking();
    // Also stop any local TTS from voice lookup
    if (lookupAudioRef.current) {
      lookupAudioRef.current.pause();
      lookupAudioRef.current = null;
      isSpeakingRef.current = false;
    }

    // Show processing status to user
    setStatusMessage('Processing recording...');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
      // Do NOT close WebSocket here — wait for server's recording_ended response
      // so SOAP generation can be triggered. Safety timeout in case server never responds.
      const safetyWs = wsRef.current;
      setTimeout(() => {
        if (safetyWs.readyState !== WebSocket.CLOSED && safetyWs.readyState !== WebSocket.CLOSING) {
          console.warn('[Voice Recording] Safety timeout — closing WebSocket after 15s');
          safetyWs.close();
          wsRef.current = null;
          setStatusMessage('Visit saved (processing timed out)');
          setTimeout(() => setStatusMessage(null), 4000);
          if (onVisitEndedRef.current) onVisitEndedRef.current({ patientId: patientContextRef.current?.id });
        }
      }, 15000);
    } else {
      wsRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    if (flushRef) flushRef.current = null;
    setIsRecording(false);
    setRecordingMode(null);
    setLookupPhase(null);
  }, [setIsRecording, flushRef, onStopSpeaking]);

  // Expose stopRecording via ref so MessageInput can stop on send
  useEffect(() => {
    if (stopRef) {
      stopRef.current = (isRecording || lookupPhase) ? stopRecording : null;
    }
  }, [isRecording, lookupPhase, stopRecording, stopRef]);

  // Cleanup on unmount — stop recording if component is removed while active
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) {}
        wsRef.current = null;
      }
      if (processorRef.current) {
        try { processorRef.current.disconnect(); } catch (_) {}
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (lookupAudioRef.current) {
        lookupAudioRef.current.pause();
      }
    };
  }, []);

  const handleOptionClick = (mode) => {
    setShowPopup(false);
    if (mode === 'visit') {
      if (!patientContext?.id) {
        // No patient selected — start voice-based patient lookup
        startPatientLookup();
        return;
      }
      setShowConsent(true);
    } else {
      startRecording('voiceChat');
    }
  };

  const handleConsent = (method) => {
    setShowConsent(false);
    startRecording('visit', method);
  };

  const isActive = isRecording || lookupPhase;

  return (
    <div style={{ position: 'relative' }} ref={popupRef}>
      <button
        className={`voice-recording-btn ${isActive ? 'recording' : ''}`}
        onClick={() => {
          if (isActive) {
            stopRecording();
          } else {
            setShowPopup(!showPopup);
          }
        }}
        title={isActive ? 'Stop' : 'Voice options'}
      >
        {isRecording ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="recording-timer">{formatDuration(recordingDuration)}</span>
          </>
        ) : lookupPhase ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="recording-timer" style={{ fontSize: '10px' }}>
              {lookupPhase === 'listening' ? 'Listening...' :
               lookupPhase === 'searching' ? 'Searching...' :
               lookupPhase === 'found' ? 'Found!' : ''}
            </span>
          </>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {showPopup && !isActive && (
        <div className="voice-recording-popup">
          <button className="voice-recording-popup-option" onClick={() => handleOptionClick('visit')}>
            <span className="option-icon">&#9899;</span>
            <div>
              <div className="option-label">Record Visit</div>
              <div className="option-desc">Full encounter recording with SOAP note</div>
            </div>
          </button>
          <button className="voice-recording-popup-option" onClick={() => handleOptionClick('voiceChat')}>
            <span className="option-icon">&#127908;</span>
            <div>
              <div className="option-label">Voice Mode</div>
              <div className="option-desc">Talk to IntelliCare — agent speaks back</div>
            </div>
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="voice-recording-error" style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: '8px', padding: '8px 12px', background: 'rgba(220, 38, 38, 0.9)',
          color: '#fff', borderRadius: '6px', fontSize: '12px', whiteSpace: 'nowrap', zIndex: 100,
        }}>
          {errorMessage}
        </div>
      )}

      {statusMessage && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: '8px', padding: '8px 12px', background: 'rgba(34, 197, 94, 0.9)',
          color: '#fff', borderRadius: '6px', fontSize: '12px', whiteSpace: 'nowrap', zIndex: 100,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          {statusMessage.includes('...') && (
            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          )}
          {statusMessage}
        </div>
      )}

      {showConsent && (
        <div className="consent-overlay">
          <div className="consent-dialog">
            <h3>Patient Consent Required</h3>
            <p>This visit will be recorded for documentation purposes. Patient consent is required before proceeding.</p>
            <div className="consent-buttons">
              <button className="consent-btn primary" onClick={() => handleConsent('verbal')}>
                Patient Consents (Verbal)
              </button>
              <button className="consent-btn secondary" onClick={() => handleConsent('written')}>
                Written Consent on File
              </button>
              <button className="consent-btn cancel" onClick={() => setShowConsent(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecordingButton;
