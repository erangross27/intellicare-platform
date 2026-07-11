import React, { useState, useRef, useEffect } from 'react';
import CloseIcon from '../../icons/CloseIcon';
import useAutocomplete from '../../../hooks/useAutocomplete';
import VoiceRecordingButton from '../VoiceRecordingButton.jsx';

const MessageInput = ({
  onSendMessage,
  isLoading,
  language,
  lastAgentMessage,
  onFilesChange,
  onStopGeneration,
  leftSidebarOpen = false,
  rightSidebarOpen = false,
  isProvider = false,
  patientContext = null,
  isRecording = false,
  setIsRecording,
  onTranscriptUpdate,
  onVoiceChatText,
  onVisitStarted,
  onVisitEnded,
  activeVisitId,
  isSpeaking = false,
  onStopSpeaking,
  onPatientFound,
  stopRecordingRef,
}) => {
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const isRTL = language === 'he';

  const { suggestion, acceptSuggestion, dismissSuggestion } = useAutocomplete({
    text: message,
    cursorPosition: message.length,
    patientContext,
    visitTranscript: '',
    enabled: !isRecording,
  });

  // Voice chat: text appears in input as user speaks. On edit (backspace),
  // we flush the ElevenLabs segment so new speech starts a fresh transcript.
  const recordingModeRef = useRef(null);
  const voiceFlushRef = useRef(null);       // flush function exposed by VoiceRecordingButton
  const voiceStopRef = useRef(null);        // stop function exposed by VoiceRecordingButton
  // If parent passes stopRecordingRef, use it so parent (LiveTranscriptCard) can call stop directly
  const effectiveStopRef = stopRecordingRef || voiceStopRef;
  const editUntilRef = useRef(0);           // timestamp — suppress voice text briefly after edit
  const lastPartialRef = useRef('');         // tracks current partial to replace on next update
  const pendingVoiceSendRef = useRef(null);  // queued voice message to send outside state updater
  const onSendMessageRef = useRef(onSendMessage); // always-current ref to avoid stale closures
  useEffect(() => { onSendMessageRef.current = onSendMessage; }, [onSendMessage]);
  const isLoadingRef = useRef(isLoading); // always-current ref — avoids stale closure in WebSocket handlers
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  useEffect(() => {
    if (!isRecording) {
      recordingModeRef.current = null;
      lastPartialRef.current = '';
      editUntilRef.current = 0;
    }
  }, [isRecording]);

  // Send queued voice message when isLoading becomes false (handles speak-while-agent-busy)
  useEffect(() => {
    if (!isLoading && pendingVoiceSendRef.current) {
      const textToSend = pendingVoiceSendRef.current;
      pendingVoiceSendRef.current = null;
      console.log('[VoiceChat] Sending queued voice message (agent now free):', textToSend.substring(0, 50));
      if (onSendMessageRef.current) {
        onSendMessageRef.current(textToSend);
      }
    }
  }, [isLoading]);

  const resizeTextarea = () => {
    if (inputRef.current) {
      inputRef.current.style.height = '41px';
      const scrollHeight = inputRef.current.scrollHeight;
      if (scrollHeight > 41) {
        inputRef.current.style.height = Math.min(scrollHeight, 300) + 'px';
        inputRef.current.style.overflow = scrollHeight > 300 ? 'auto' : 'hidden';
      }
    }
  };

  const handleVoiceChatText = (text, isPartial = false) => {
    if (!text) return; // ignore empty transcripts (e.g. from flush commits)
    // During edit window, skip ALL voice text — the flush will start a fresh segment
    if (Date.now() < editUntilRef.current) return;
    if (!isPartial) {
      console.log('[VoiceChat] committed text:', text.substring(0, 60), '| mode:', recordingModeRef.current, '| isLoadingRef:', isLoadingRef.current, '| hasSendFn:', !!onSendMessageRef.current);
    }

    if (isPartial) {
      setMessage(prev => {
        let base = prev;
        if (lastPartialRef.current && base.endsWith(lastPartialRef.current)) {
          base = base.slice(0, base.length - lastPartialRef.current.length);
          if (base.endsWith(' ')) base = base.slice(0, -1);
        }
        const separator = base ? ' ' : '';
        lastPartialRef.current = text;
        return base + separator + text;
      });
    } else {
      // Committed sentence — in voice mode, auto-send for fluent conversation
      if (recordingModeRef.current === 'voiceChat') {
        // In voice chat, committed text IS the full sentence — clear input and send directly
        lastPartialRef.current = '';
        setMessage('');
        resizeTextarea();

        const textToSend = text.trim();
        if (textToSend) {
          if (isLoadingRef.current) {
            // Agent still responding — queue for when isLoading becomes false
            pendingVoiceSendRef.current = textToSend;
            console.log('[VoiceChat] Agent busy — queued:', textToSend.substring(0, 50));
          } else {
            console.log('[VoiceChat] Sending voice message:', textToSend.substring(0, 50));
            if (onSendMessageRef.current) {
              onSendMessageRef.current(textToSend);
            } else {
              console.error('[VoiceChat] ERROR: onSendMessageRef.current is null — cannot send!');
            }
          }
        }
        return;
      }
      // Non-voice mode: accumulate in input as before
      setMessage(prev => {
        let base = prev;
        if (lastPartialRef.current && base.endsWith(lastPartialRef.current)) {
          base = base.slice(0, base.length - lastPartialRef.current.length);
          if (base.endsWith(' ')) base = base.slice(0, -1);
        }
        lastPartialRef.current = '';
        const separator = base.trim() ? ' ' : '';
        return base.trimEnd() + separator + text;
      });
    }
    resizeTextarea();
  };

  // Auto-submit when voiceChat recording stops — send any remaining text in the input
  const prevRecordingRef = useRef(false);
  const prevRecordingModeRef = useRef(null); // Snapshot mode BEFORE cleanup clears it
  useEffect(() => {
    if (prevRecordingRef.current && !isRecording && prevRecordingModeRef.current === 'voiceChat') {
      // Wait briefly for any final committed text to arrive
      setTimeout(() => {
        setMessage(prev => {
          const textToSend = prev.trim();
          if (textToSend) {
            console.log('[VoiceChat] Recording stopped — sending remaining text:', textToSend.substring(0, 50));
            // Schedule send outside the state updater (pure function constraint)
            setTimeout(() => {
              if (onSendMessageRef.current) {
                onSendMessageRef.current(textToSend);
              }
            }, 0);
          }
          return '';
        });
        resizeTextarea();
      }, 500);
    }
    // Snapshot current mode BEFORE the cleanup effect clears recordingModeRef
    prevRecordingModeRef.current = recordingModeRef.current;
    prevRecordingRef.current = isRecording;
  }, [isRecording]);

  // Initialize textarea height
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '41px';
      inputRef.current.style.overflow = 'hidden';
    }
  }, []);
  
  // Auto-focus input when loading state changes (after AI responds)
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);
  
  // Notify parent when files change
  useEffect(() => {
    if (onFilesChange) {
      onFilesChange(selectedFiles.length > 0);
    }
  }, [selectedFiles, onFilesChange]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    // Stop recording when sending during voiceChat
    if (isRecording && recordingModeRef.current === 'voiceChat') {
      if (effectiveStopRef.current) effectiveStopRef.current();
    }

    // If we have files, include file info in display message
    let finalDisplayMessage = message;
    if (selectedFiles.length > 0) {
      const fileNames = selectedFiles.map(f => f.name).join(', ');
      finalDisplayMessage += `\n📎 ${selectedFiles.length} ${language === 'he' ? 'קבצים מצורפים' : 'files attached'}: ${fileNames}`;
    }

    // Pass files to sendMessage
    process.env.NODE_ENV !== 'production' && console.log('📤 Sending message with files:', {
      message,
      filesCount: selectedFiles.length,
      fileNames: selectedFiles.map(f => f.name)
    });

    // CRITICAL: Clear files IMMEDIATELY to prevent UI from showing in middle of screen
    const filesToSend = [...selectedFiles];
    setMessage('');
    setSelectedFiles([]); // Clear BEFORE sending to prevent rendering flash

    // Reset textarea height after sending
    if (inputRef.current) {
      inputRef.current.style.height = '41px';
      inputRef.current.style.overflow = 'hidden';
    }

    onSendMessage(message, finalDisplayMessage, false, filesToSend);

    // Keep focus on input field - no need to wait
    inputRef.current?.focus();
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      const accepted = acceptSuggestion();
      if (accepted) setMessage(prev => prev + accepted);
    }
    if (e.key === 'Escape' && suggestion) {
      dismissSuggestion();
    }
  };

  // Auto-grow/shrink textarea as user types
  const handleInputChange = (e) => {
    setMessage(e.target.value);
    // When user edits during recording: flush the ElevenLabs segment (commits old text,
    // starts fresh) and suppress voice text for 1.5s so deleted text stays gone.
    if (isRecording) {
      const wasAlreadyEditing = Date.now() < editUntilRef.current;
      editUntilRef.current = Date.now() + 1500;
      lastPartialRef.current = '';
      // Only flush once per edit burst (not every keystroke during rapid backspacing)
      if (!wasAlreadyEditing && voiceFlushRef.current) voiceFlushRef.current();
    }

    // Auto-grow/shrink textarea - only grow when content exceeds height
    const textarea = e.target;

    // Reset height to base to get accurate scrollHeight
    textarea.style.height = '41px';

    // Get the actual content height
    const scrollHeight = textarea.scrollHeight;

    // Only grow if scrollHeight exceeds base height
    if (scrollHeight > 41) {
      const newHeight = Math.min(scrollHeight, 300);
      textarea.style.height = newHeight + 'px';
      textarea.style.overflow = scrollHeight > 300 ? 'auto' : 'hidden';
    } else {
      // Keep at base height
      textarea.style.height = '41px';
      textarea.style.overflow = 'hidden';
    }
  };
  
  // Container styles - now handled by parent wrapper in ChatArea
  const containerStyle = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  };
  
  const formStyle = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    width: '100%',
    maxWidth: '768px', // Reasonable input container width
    background: '#121E33',
    borderRadius: '26px',
    padding: '8px 16px', // Normal padding
    border: 'none',
    boxShadow: 'none',
    minHeight: 'auto' // Auto height based on content
  };

  const inputStyle = {
    flex: 1,
    padding: '8px', // Minimal padding
    fontSize: '18px', // Terminal font size
    fontFamily: 'Comfortaa, Geneva, Tahoma, sans-serif', // Terminal font
    lineHeight: '1.4', // Compact line height for single line
    letterSpacing: '0.5px', // Terminal letter spacing
    border: 'none',
    borderRadius: '0',
    outline: 'none',
    direction: isRTL ? 'rtl' : 'ltr',
    background: 'transparent',
    color: '#E9EFFA',
    height: '41px', // Fixed height for one line (18px * 1.4 + 8px*2 padding = ~41px)
    maxHeight: '300px', // Grow taller for multiline
    resize: 'none',
    overflow: 'hidden', // Hide scrollbar until needed
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    padding: '0',
    background: isLoading || !message.trim() ? '#2a2d3a' : '#E9EFFA',
    color: isLoading || !message.trim() ? '#93A2BE' : '#060A14',  // Lighter gray when disabled so icon is visible
    border: 'none',
    borderRadius: '50%',
    fontSize: '18px',
    fontWeight: '600',
    cursor: isLoading || !message.trim() ? 'not-allowed' : 'pointer',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  };

  const attachButtonStyle = {
    padding: '0',
    background: 'transparent',
    color: '#93A2BE',
    border: 'none',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '18px',
    flexShrink: 0
  };
  
  const indicatorStyle = {
    padding: '10px 16px',
    background: '#fef3c7',
    borderRadius: '12px',
    fontSize: '13px',
    color: '#92400e',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '500'
  };
  
  // Helper function to get file icon based on extension
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext)) return '🖼️';
    if (['dicom', 'dcm'].includes(ext)) return '🏥';
    if (['txt'].includes(ext)) return '📃';
    return '📎';
  };

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={containerStyle}>
      {/* File Upload List - Above input area */}
      {selectedFiles.length > 0 && (
        <div style={{
          width: '100%',
          maxWidth: '768px', // Match input width
          backgroundColor: '#060A14',
          borderRadius: '12px 12px 0 0',
          padding: '12px',
          marginBottom: '4px'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            color: '#94a3b8',
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            <span>
              📁 {selectedFiles.length} {isRTL ? (selectedFiles.length === 1 ? 'קובץ מצורף' : 'קבצים מצורפים') : (selectedFiles.length === 1 ? 'File Attached' : 'Files Attached')}
            </span>
            <button
              onClick={() => setSelectedFiles([])}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#2a2d3a';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '';
              }}
            >
              {isRTL ? 'הסר הכל' : 'Clear All'}
            </button>
          </div>

          {/* File List */}
          <div style={{
            maxHeight: '150px',
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRadius: '8px',
            backgroundColor: '#2a2d3a',
            padding: '4px',
          }}>
            {selectedFiles.map((file, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                marginBottom: index < selectedFiles.length - 1 ? '2px' : '0',
                backgroundColor: '#0E1626',
                borderRadius: '6px',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#121E33';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0E1626';
              }}>
                {/* File Icon */}
                <span style={{
                  fontSize: '20px',
                  marginRight: '12px',
                  flexShrink: 0
                }}>
                  {getFileIcon(file.name)}
                </span>

                {/* File Info */}
                <div style={{
                  flex: 1,
                  minWidth: 0,
                  marginRight: '12px'
                }}>
                  <div style={{
                    color: '#E9EFFA',
                    fontSize: '13px',
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: '2px'
                  }}>
                    {file.name}
                  </div>
                  <div style={{
                    color: '#93A2BE',
                    fontSize: '11px',
                  }}>
                    {formatFileSize(file.size)}
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => {
                    setSelectedFiles(files => files.filter((_, i) => i !== index));
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#93A2BE',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '4px',
                    lineHeight: '1',
                    borderRadius: '4px',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#ef4444';
                    e.target.style.backgroundColor = '#2a2d3a';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#93A2BE';
                    e.target.style.backgroundColor = '';
                  }}
                  title={isRTL ? 'הסר קובץ' : 'Remove file'}
                >
                  <CloseIcon size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} style={formStyle}>
          <button
            type="button"
            style={attachButtonStyle}
            onClick={() => fileInputRef.current?.click()}
            title={isRTL ? 'צרף קובץ' : 'Attach file'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.bmp,.svg,.dicom,.dcm"
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setSelectedFiles(prev => [...prev, ...files]);
              e.target.value = '';
            }}
          />
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={isRTL ? 'הקלד הודעה...' : 'Type a message...'}
            style={{
              ...inputStyle,
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              overflowY: 'auto'
            }}
            disabled={isLoading}
            autoFocus
            rows={1}
          />
          {suggestion && (
            <span style={{
              color: '#475569',
              pointerEvents: 'none',
              fontStyle: 'italic',
              fontSize: '14px',
              marginLeft: '4px',
            }}>
              {suggestion}
            </span>
          )}

          {isProvider && (
            <VoiceRecordingButton
              onTranscriptUpdate={onTranscriptUpdate}
              onVoiceChatText={handleVoiceChatText}
              onVisitStarted={onVisitStarted}
              onVisitEnded={onVisitEnded}
              patientContext={patientContext}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              visitId={activeVisitId}
              onRecordingModeChange={(mode) => { recordingModeRef.current = mode; }}
              flushRef={voiceFlushRef}
              stopRef={effectiveStopRef}
              isSpeaking={isSpeaking}
              onStopSpeaking={onStopSpeaking}
              onPatientFound={onPatientFound}
            />
          )}

          <button
            type={isLoading ? "button" : "submit"}
            style={buttonStyle}
            disabled={!isLoading && !message.trim()}
            onClick={isLoading ? (e) => {
              e.preventDefault();
              if (onStopGeneration) {
                onStopGeneration();
              }
            } : undefined}
            onMouseEnter={(e) => {
              if (!isLoading && message.trim()) {
                e.target.style.backgroundColor = '#B7C2D8';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && message.trim()) {
                e.target.style.backgroundColor = '#E9EFFA';
              }
            }}
          >
            {isLoading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
            )}
          </button>
        </form>
    </div>
  );
};

export default MessageInput;