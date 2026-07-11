import React, { useRef, useEffect } from 'react';
import './LiveTranscriptCard.css';

const LiveTranscriptCard = ({
  transcript = [],
  partialText = '',
  duration = 0,
  patientName = 'Patient',
  onEndVisit,
  isProcessing = false,
}) => {
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [transcript, partialText]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatSpeaker = (speaker) => {
    switch (speaker) {
      case 'doctor': return 'Doctor';
      case 'patient': return 'Patient';
      default: return 'Speaker';
    }
  };

  return (
    <div className="live-transcript-card">
      <div className="live-transcript-header">
        <div className="live-transcript-header-left">
          <div className="recording-dot" />
          <span className="live-transcript-title">Recording Visit — {patientName}</span>
        </div>
        <span className="live-transcript-timer">{formatDuration(duration)}</span>
      </div>

      <div className="live-transcript-body" ref={bodyRef}>
        {transcript.map((segment, idx) => (
          <div key={idx} className="transcript-segment">
            <div className={`transcript-speaker ${segment.speaker || 'unknown'}`}>
              [{formatSpeaker(segment.speaker)}]
            </div>
            <div className="transcript-text">{segment.text}</div>
          </div>
        ))}

        {partialText && (
          <div className="transcript-segment">
            <div className="transcript-partial">{partialText}</div>
          </div>
        )}

        {isProcessing && (
          <div className="processing-spinner">
            Generating visit summary...
          </div>
        )}
      </div>

      {!isProcessing && (
        <div className="live-transcript-footer">
          <button className="end-visit-btn" onClick={onEndVisit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            End Visit
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveTranscriptCard;
