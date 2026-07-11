import React, { useEffect, useRef } from 'react';
import Message from './Message';
import WelcomeHero from './WelcomeHero';
import { useLanguage } from '../../../config/languagesStatic';
import SummaryCard from '../../SummaryCard';
import CompactionDivider from './CompactionDivider';
import CompactionProgress from './CompactionProgress';

const MessageList = ({ messages, language, onFunctionAction, onSendMessage, artifactPanelOpen, isLoading = false, ttsEnabled = true, speakingMessageId, onSpeakMessage, onStopSpeaking }) => {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const previousMessagesLength = useRef(messages.length);
  const isRTL = language === 'he';
  const { t } = useLanguage();

  // Auto-scroll to bottom when new messages are added OR when content is being streamed
  useEffect(() => {
    // Check if we have messages
    if (messages.length === 0) return;

    // Get the last message
    const lastMessage = messages[messages.length - 1];

    // Auto-scroll if:
    // 1. New message was added (message count increased)
    // 2. Last message is from agent AND is currently being streamed (isLoading)
    const messageCountIncreased = messages.length > previousMessagesLength.current;
    const isStreamingAgentMessage = isLoading && lastMessage && lastMessage.type === 'agent';

    if (messageCountIncreased || isStreamingAgentMessage) {
      // CRITICAL: Scroll the container, not just the ref element
      // The parent container has overflow-y: auto, so we need to scroll IT
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }

    // Update the previous length for next comparison
    previousMessagesLength.current = messages.length;
  }, [messages, isLoading]);

  // Display messages as-is (backend ensures correct order)
  // Backend reorders thinking before response in updatedMessages (ChatContainer.js:1524-1540)
  // Database persistence preserves this order
  const displayMessages = messages;

  // Log thinking message display status with FULL details
  if (displayMessages.length > 0) {
    const hasThinking = displayMessages.some(m => m.isThinking || m.id === 'msg_thinking');
    const lastThreeMessages = displayMessages.slice(-3);
    console.log('📊 [MessageList] RENDERING messages - LAST 3:', {
      totalCount: displayMessages.length,
      hasThinking,
      last3: lastThreeMessages.map((m, idx) => ({
        position: displayMessages.length - 3 + idx,
        id: m.id,
        type: m.type,
        isThinking: m.isThinking,
        contentPreview: m.content?.substring(0, 30) || 'empty'
      }))
    });
  }

  // Container style - clean seamless background
  const containerStyle = {
    flex: 1,
    overflowY: messages.length > 0 ? 'auto' : 'hidden',
    padding: '40px 0 20px 0',
    backgroundColor: 'transparent',
    minHeight: '400px',
    maxHeight: 'calc(100vh - 140px)',
    direction: isRTL ? 'rtl' : 'ltr',
    position: 'relative'
  };

  // Empty state — the shared blue-dark landing hero (same component ChatArea
  // renders), so the "no messages yet" view stays in lockstep with the welcome
  // screen instead of drifting into its own look.
  if (displayMessages.length === 0) {
    return (
      <div style={{ height: '100%', direction: isRTL ? 'rtl' : 'ltr' }}>
        <WelcomeHero language={language} />
      </div>
    );
  }

  return (
    <div ref={containerRef} style={containerStyle}>
      {displayMessages.map((message, index) => {
        // Render SummaryCard for batch_summary messages
        if (message.type === 'batch_summary') {
          return (
            <SummaryCard
              key={message.id || index}
              summary={message.content}
            />
          );
        }

        // Render the live progress card while compaction is running (Phase 3)
        if (message.type === 'compaction_progress') {
          return (
            <CompactionProgress
              key={message.id || index}
              message={message}
              isRTL={isRTL}
            />
          );
        }

        // Render CompactionDivider for conversation-compaction markers (Phase 3)
        if (message.type === 'compaction_marker') {
          return (
            <CompactionDivider
              key={message.id || index}
              message={message}
              isRTL={isRTL}
            />
          );
        }

        // Render normal Message for all other types
        return (
          <Message
            key={message.id || index}
            message={message}
            isRTL={isRTL}
            onFunctionAction={onFunctionAction}
            onSendMessage={onSendMessage}
            artifactPanelOpen={artifactPanelOpen}
            ttsEnabled={ttsEnabled}
            speakingMessageId={speakingMessageId}
            onSpeakMessage={onSpeakMessage}
            onStopSpeaking={onStopSpeaking}
          />
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
