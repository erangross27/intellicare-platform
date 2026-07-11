import React, { useState } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import WelcomeHero from './WelcomeHero';

const ChatArea = ({
  sessionTitle,
  onNewChat,
  messages,
  onSendMessage,
  onStopGeneration,
  isLoading,
  language,
  lastAgentMessage,
  onFunctionAction,
  leftSidebarOpen,
  rightSidebarOpen,
  isProvider,
  artifactPanelOpen,
  onTranscriptUpdate,
  onVoiceChatText,
  onVisitStarted,
  onVisitEnded,
  isRecording,
  setIsRecording,
  activeVisitId,
  patientContext,
  onPatientFound,
  isSpeaking = false,
  ttsEnabled = true,
  onStopSpeaking,
  speakingMessageId,
  onSpeakMessage,
  stopRecordingRef,
}) => {
  const [hasFiles, setHasFiles] = useState(false);
  // Main chat area styles - glassmorphism
  const chatAreaStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'transparent'
  };

  const headerWrapperStyle = {
    position: 'relative',
    padding: '0',
    background: '#060A14', /* Unified deep blue-black backdrop, header blends into the chat field */
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  };

  const mainContentStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'transparent'
  };
  
  return (
    <div style={chatAreaStyle}>
      <div style={headerWrapperStyle}>
        <ChatHeader 
          sessionTitle={sessionTitle}
          onNewChat={onNewChat}
          language={language}
        />
      </div>
      
      <div style={mainContentStyle}>
        {messages.length === 0 ? (
          <>
            <WelcomeHero language={language} />
            <div style={{
              position: 'fixed',
              bottom: '30px',
              left: '64px',
              width: artifactPanelOpen
                ? 'calc(50% - 32px - 64px - 40px)'
                : 'calc(100% - 64px - 20px)',
              display: 'flex',
              justifyContent: 'center',
              padding: '0 20px',
              zIndex: 10
            }}>
              <MessageInput
                onSendMessage={onSendMessage}
                onStopGeneration={onStopGeneration}
                isLoading={isLoading}
                language={language}
                lastAgentMessage={lastAgentMessage}
                onFilesChange={setHasFiles}
                leftSidebarOpen={leftSidebarOpen}
                rightSidebarOpen={rightSidebarOpen}
                isProvider={isProvider}
                onTranscriptUpdate={onTranscriptUpdate}
                onVoiceChatText={onVoiceChatText}
                onVisitStarted={onVisitStarted}
                onVisitEnded={onVisitEnded}
                isRecording={isRecording}
                setIsRecording={setIsRecording}
                activeVisitId={activeVisitId}
                patientContext={patientContext}
                isSpeaking={isSpeaking}
                onStopSpeaking={onStopSpeaking}
                onPatientFound={onPatientFound}
                stopRecordingRef={stopRecordingRef}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{
              flex: 1,
              overflow: 'auto',
              paddingBottom: '120px'
            }}>
              <MessageList
                messages={messages}
                language={language}
                onFunctionAction={onFunctionAction}
                onSendMessage={onSendMessage}
                artifactPanelOpen={artifactPanelOpen}
                isLoading={isLoading}
                ttsEnabled={ttsEnabled}
                speakingMessageId={speakingMessageId}
                onSpeakMessage={onSpeakMessage}
                onStopSpeaking={onStopSpeaking}
                stopRecordingRef={stopRecordingRef}
              />
            </div>

            <div style={{
              position: 'fixed',
              bottom: '30px',
              left: '64px',  // Always start from collapsed sidebar position
              width: artifactPanelOpen
                ? 'calc(50% - 32px - 64px - 40px)'
                : 'calc(100% - 64px - 20px)',
              display: 'flex',
              justifyContent: 'center',
              padding: '0 20px',
              zIndex: 10
            }}>
              <MessageInput
                onSendMessage={onSendMessage}
                onStopGeneration={onStopGeneration}
                isLoading={isLoading}
                language={language}
                lastAgentMessage={lastAgentMessage}
                onFilesChange={setHasFiles}
                leftSidebarOpen={leftSidebarOpen}
                rightSidebarOpen={rightSidebarOpen}
                isProvider={isProvider}
                onTranscriptUpdate={onTranscriptUpdate}
                onVoiceChatText={onVoiceChatText}
                onVisitStarted={onVisitStarted}
                onVisitEnded={onVisitEnded}
                isRecording={isRecording}
                setIsRecording={setIsRecording}
                activeVisitId={activeVisitId}
                patientContext={patientContext}
                onPatientFound={onPatientFound}
                isSpeaking={isSpeaking}
                onStopSpeaking={onStopSpeaking}
                stopRecordingRef={stopRecordingRef}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatArea;