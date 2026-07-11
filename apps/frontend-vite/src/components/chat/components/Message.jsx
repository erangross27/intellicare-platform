import React, { useEffect, useState, useRef } from 'react';
import MedicalDataGrid from '../../viewers/MedicalDataGrid';
import MedicalGridRenderer from '../../grids/MedicalGridRenderer';
import DataTypeRenderer from './DataTypeRenderer';
import AIInsightsCard from '../../medical/AIInsightsCard';
import MedicalCategoriesCard from '../../medical/MedicalCategoriesCard';
import SingleCategoryCard from '../../medical/SingleCategoryCard';
import CategoriesListExport from '../../CategoriesListExport';
import typography from '../styles/typography';

const { colors, textStyles, componentStyles, fontFamily, fontWeight } = typography;

// Typewriter component for smooth character-by-character display
const Typewriter = ({ text, delay = 30 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, delay);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, delay]);

  // Reset when text changes (new content arrives)
  useEffect(() => {
    if (text.length < displayedText.length) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
    } else if (text.length > displayedText.length) {
      // New content added, continue from where we left off
      setCurrentIndex(displayedText.length);
    }
  }, [text]);

  return <>{displayedText}</>;
};

const Message = ({ message, isRTL, onSendMessage, artifactPanelOpen, ttsEnabled = true, speakingMessageId, onSpeakMessage, onStopSpeaking }) => {
  const isUser = message.type === 'user';
  // Only check the isMasked flag, not the content itself
  const isMasked = message.isMasked === true;
  const [copied, setCopied] = React.useState(false);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const exportMenuRef = React.useRef(null);
  const dropdownMenuRef = React.useRef(null);

  // Copy message content to clipboard
  const handleCopy = async () => {
    if (!message.content) return;

    try {
      // Get plain text content (strip markdown if any)
      const textContent = typeof message.content === 'string' ? message.content : String(message.content);
      const plainText = textContent
        .replace(/\*\*/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/(?<!\n)\*(?!\*)/g, '')
        .replace(/`/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Check if clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        // Use modern clipboard API
        await navigator.clipboard.writeText(plainText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback for browsers without clipboard API
        throw new Error('Clipboard API not available');
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers or insecure contexts
      try {
        const textContent = typeof message.content === 'string' ? message.content : String(message.content);
        const plainText = textContent
          .replace(/\*\*/g, '')
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/(?<!\n)\*(?!\*)/g, '')
          .replace(/`/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        const textArea = document.createElement('textarea');
        textArea.value = plainText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          console.error('Copy command was unsuccessful');
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        alert('Failed to copy to clipboard. Please copy manually.');
      }
    }
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  // Scroll dropdown into view when it opens
  useEffect(() => {
    if (showExportMenu && dropdownMenuRef.current) {
      // Small delay to ensure the dropdown is rendered
      setTimeout(() => {
        dropdownMenuRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }, 50);
    }
  }, [showExportMenu]);

  // Trigger artifact panel when backend requests it
  // CRITICAL: Use localStorage-backed ref so "auto-open once per message id" survives
  // BOTH a page refresh AND a full browser close/reopen. sessionStorage is wiped on
  // browser close, which made historical messages re-fire openArtifactPanel on reopen;
  // combined with the restore-last-conversation login flow those stale events thrash and
  // close the localStorage-restored artifact panel (user saw chat only, no artifact).
  // localStorage persists across close, so the restored panel is left undisturbed.
  const hasTriggeredRef = React.useRef((() => {
    try {
      const stored = localStorage.getItem('_artifactTriggered');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  })());
  const markTriggered = (msgId) => {
    hasTriggeredRef.current.add(msgId);
    try {
      const arr = [...hasTriggeredRef.current].slice(-50);
      localStorage.setItem('_artifactTriggered', JSON.stringify(arr));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    console.log('🔍 [Message useEffect] Checking message:', {
      id: message.id,
      displayType: message.displayType,
      hasArtifactPanel: !!message.artifactPanel,
      artifactPanel: message.artifactPanel,
      hasCategories: !!message.categories,
      alreadyTriggered: hasTriggeredRef.current.has(message.id),
      fullMessage: message
    });

    // Skip if we've already triggered for this message ID
    if (hasTriggeredRef.current.has(message.id)) {
      console.log('⏭️ [Message] Skipping - already triggered artifact for message:', message.id);
      return;
    }

    // Handle openArtifactPanel type (direct artifact triggers)
    if (message.displayType === 'openArtifactPanel' && message.artifactPanel) {
      markTriggered(message.id);
      console.log('🎯 [Message] Triggering artifact panel with:', message.artifactPanel);
      console.log('🔍 [Message Debug] artifactPanel.data:', message.artifactPanel.data);
      console.log('🔍 [Message Debug] message.displayData:', message.displayData);
      console.log('🔍 [Message Debug] message.data:', message.data);

      const event = new CustomEvent('openArtifactPanel', {
        detail: {
          patientId: message.artifactPanel.patientId,
          category: message.artifactPanel.category,
          documentId: message.artifactPanel.documentId,
          type: message.artifactPanel.type,  // 'grid' or 'document'
          // FIXED: Use artifactPanel.data, or fallback to displayData or message.data
          gridData: message.artifactPanel.data || message.displayData || message.data,
          columns: message.artifactPanel.columns,
          headers: message.artifactPanel.headers,
          title: message.artifactPanel.title,
          patientName: message.artifactPanel.patientName || message.patientName
        }
      });

      console.log('📤 [Message] Dispatching openArtifactPanel event:', event.detail);
      console.log('🔍 [Message Debug] gridData being sent:', event.detail.gridData);
      window.dispatchEvent(event);
    }
    // MULTI-COLLECTION SUPPORT: Handle openArtifactPanelMultiple type (multiple collections in same agent turn)
    else if (message.displayType === 'openArtifactPanelMultiple' && message.artifactPanels) {
      markTriggered(message.id);
      console.log('🎯 [Message] MULTI-COLLECTION: Triggering artifact panel selector with:', message.artifactPanels.length, 'collections');
      console.log('🔍 [Message Debug] Collections:', message.artifactPanels.map(p => p.category).join(', '));

      const event = new CustomEvent('openArtifactPanel', {
        detail: {
          patientId: message.artifactPanels[0]?.patientId, // Use first panel's patientId
          category: null, // No specific category - show selector
          documentId: null,
          type: 'multipleCollections',
          artifactPanels: message.artifactPanels, // Pass all panels
          patientName: message.artifactPanels[0]?.patientName || message.patientName
        }
      });

      console.log('📤 [Message] Dispatching openArtifactPanel event for MULTI-COLLECTION:', event.detail);
      window.dispatchEvent(event);
    }
    // Handle categoriesList type (getCollectionsWithData)
    else if (message.displayType === 'categoriesList') {
      markTriggered(message.id);
      console.log('🎯 [Message] categoriesList displayType detected:', {
        hasCategories: !!message.categories,
        categoriesType: typeof message.categories,
        categoriesLength: Array.isArray(message.categories) ? message.categories.length : 'not array',
        categoriesData: message.categories,
        patientId: message.patientId,
        patientName: message.patientName
      });

      if (message.categories && message.patientId) {
        console.log('🎯 [Message] Triggering artifact panel for categoriesList:', {
          patientId: message.patientId,
          patientName: message.patientName,
          categoriesCount: message.categories.length
        });

        const event = new CustomEvent('openArtifactPanel', {
          detail: {
            patientId: message.patientId,
            category: null, // No specific category selected
            documentId: null,
            type: 'categoriesList',
            categories: message.categories, // Pass the categories array
            patientName: message.patientName
          }
        });

        console.log('📤 [Message] Dispatching openArtifactPanel event for categoriesList:', event.detail);
        window.dispatchEvent(event);
      } else {
        console.warn('⚠️ [Message] categoriesList detected but missing required data:', {
          hasCategories: !!message.categories,
          hasPatientId: !!message.patientId,
          message: message
        });
      }
    }
    // CRITICAL FIX: Also handle case where artifactPanel exists without explicit displayType
    // This can happen when streaming returns artifactPanel in the response
    else if (message.artifactPanel && !message.displayType) {
      markTriggered(message.id);
      console.log('🎯 [Message] Found orphaned artifactPanel without displayType - triggering panel');

      const event = new CustomEvent('openArtifactPanel', {
        detail: {
          patientId: message.artifactPanel.patientId,
          category: message.artifactPanel.category || null,
          documentId: message.artifactPanel.documentId || null,
          type: message.artifactPanel.type || 'categoriesList',
          categories: message.artifactPanel.categories || message.categories,
          gridData: message.artifactPanel.data || message.displayData || message.data,
          patientName: message.artifactPanel.patientName || message.patientName
        }
      });

      console.log('📤 [Message] Dispatching artifact panel for orphaned artifactPanel:', event.detail);
      window.dispatchEvent(event);
    }
  }, [message.displayType, message.artifactPanel, message.categories, message.patientId]);


  // Debug logging for grid and display data
  if (message.gridFormat || message.displayType || message.displayData) {
    console.log('🎨 [Message] Rendering with data:', {
      gridFormat: message.gridFormat,
      displayType: message.displayType,
      hasDisplayData: !!message.displayData,
      dataLength: message.data?.length || message.displayData?.data?.length || 0,
      messageType: message.type
    });
  }
  
  // Message wrapper - glassmorphism transparent
  // CRITICAL: Thinking messages have NO vertical spacing (tight line-by-line display)
  const isThinkingMessage = message.isThinking;
  const wrapperStyle = {
    display: 'flex',
    justifyContent: isUser ? 'flex-end' : 'flex-start',  // User: right (flex-end), Agent: left (flex-start)
    padding: isThinkingMessage ? '2px 0 2px 0' : (isUser ? '20px 0 10px 0' : '10px 0 20px 0'),
    width: '100%',
    background: 'transparent'
  };
  
  // Check for special message types
  const isServiceMessage = message.isServiceMessage;
  const isErrorMessage = message.isError;
  const requiresAction = message.requiresAction;
  
  // Message content style - solid dark theme with terminal formatting for BOTH user and agent
  const bubbleStyle = {
    padding: isThinkingMessage ? '2px 16px' : (isServiceMessage || isErrorMessage ? '16px' : '16px'),
    color: isServiceMessage || isErrorMessage ? '#ffa500' : '#E9EFFA',
    lineHeight: isThinkingMessage ? '1.3' : '1.9',  // Tighter line height for thinking
    fontWeight: '400',
    direction: isRTL ? 'rtl' : 'ltr',
    wordBreak: 'break-word',
    userSelect: 'text',
    WebkitUserSelect: 'text',
    MozUserSelect: 'text',
    msUserSelect: 'text',
    background: isServiceMessage || isErrorMessage
      ? 'rgba(255, 165, 0, 0.1)'
      : (isUser
          ? 'linear-gradient(135deg, rgba(61,139,255,0.18), rgba(23,58,120,0.30))'  // branded blue glass for the user's voice
          : 'transparent'),
    borderRadius: isUser ? '18px 18px 6px 18px' : '16px',
    border: isServiceMessage || isErrorMessage
      ? '1px solid rgba(255, 165, 0, 0.3)'
      : (isUser ? '1px solid #244b86' : 'none'),  // blue hairline for user bubble; agent stays open text
    boxShadow: (isUser && !(isServiceMessage || isErrorMessage))
      ? '0 2px 16px rgba(6, 10, 20, 0.55)'
      : 'none',
    marginTop: isThinkingMessage ? '4px' : '8px',
    marginBottom: isThinkingMessage ? '4px' : '8px',
    // Terminal-style monospace font for BOTH user and agent messages
    fontFamily: isMasked ? 'monospace' : 'Comfortaa, Geneva, Tahoma, sans-serif',
    fontSize: isMasked ? '15px' : '18px',
    letterSpacing: isMasked ? '2px' : '0.5px',
    whiteSpace: 'pre-line',  // pre-line preserves line breaks but wraps long lines
    textAlign: 'left'  // FORCE left alignment for all text
  };
  
  // Timestamp style - subtle
  const timestampStyle = {
    fontSize: '11px',
    color: '#93A2BE',
    marginTop: '4px',
    direction: isRTL ? 'rtl' : 'ltr'
  };
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Format content - TERMINAL STYLE: no markdown processing
  const formatContent = (content) => {
    if (!content) return '';

    // Handle encrypted content objects
    if (typeof content === 'object' && content.encrypted) {
      // If content is encrypted but not decrypted yet, show placeholder
      return <span style={{ color: '#93A2BE', fontStyle: 'italic' }}>Loading encrypted message...</span>;
    }

    // Ensure content is a string
    const textContent = typeof content === 'string' ? content : String(content);

    // Try DataTypeRenderer first for structured data only (not text)
    if (!textContent.includes('**') && !textContent.includes('##')) {
      const specialRenderer = DataTypeRenderer({ content: textContent, isRTL });
      if (specialRenderer) {
        return specialRenderer;
      }
    }

    // Terminal-style rendering: strip ALL markdown and display as plain text
    // Remove markdown symbols but keep the text content
    let plainText = textContent
      // Remove ** (bold markers)
      .replace(/\*\*/g, '')
      // Remove ## (heading markers)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove * (italic markers) - but keep bullet points
      .replace(/(?<!\n)\*(?!\*)/g, '')
      // Remove ` (code markers)
      .replace(/`/g, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Render line content — detect image URLs (QR codes etc.) and clickable links
    const renderLine = (line) => {
      // Match URLs in the line
      const urlRegex = /(https?:\/\/[^\s,)]+)/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = urlRegex.exec(line)) !== null) {
        // Text before the URL
        if (match.index > lastIndex) {
          parts.push(line.slice(lastIndex, match.index));
        }
        const url = match[1];
        // Check if URL is an image endpoint (QR code, .png, .jpg, .gif, .webp)
        if (/\/(qr|qrcode)\//i.test(url) || /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url)) {
          parts.push(
            <img
              key={`img-${match.index}`}
              src={url}
              alt="QR Code"
              style={{
                display: 'block',
                maxWidth: '200px',
                maxHeight: '200px',
                borderRadius: '8px',
                margin: '8px 0',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          );
        } else {
          // Render as clickable link
          parts.push(
            <a
              key={`link-${match.index}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#74AEFF', textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {url}
            </a>
          );
        }
        lastIndex = urlRegex.lastIndex;
      }
      // Remaining text after last URL
      if (lastIndex < line.length) {
        parts.push(line.slice(lastIndex));
      }
      return parts.length > 0 ? parts : line;
    };

    // Split into lines and render with proper line breaks, images, and clickable links
    return plainText.split('\n').map((line, idx) => (
      <React.Fragment key={idx}>
        {renderLine(line)}
        {idx < plainText.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));

    // OLD markdown parsing code below - KEPT FOR REFERENCE BUT NOT USED
    const parseMarkdown = (text, messageType = 'user') => {
      console.log('🔍 [parseMarkdown] ENTERED with messageType:', messageType);
      console.log('🔍 [parseMarkdown] text length:', text?.length);

      // Add debugging for the return value
      const debugWrapper = (elements) => {
        if (text.includes('patients') && messageType !== 'user') {
          console.log('🔍 [parseMarkdown] Returning elements:', elements);
          console.log('🔍 [parseMarkdown] Number of elements:', elements.flat ? elements.flat().length : elements.length);
        }
        return elements;
      };

      const elements = [];
      let currentIndex = 0;

      // Regex patterns for markdown
      const patterns = {
        bold: /\*\*([^*]+?)\*\*/g,
        italic: /(?<!\*)\*([^*]+?)\*(?!\*)/g,
        code: /`([^`]+)`/g,
        codeBlock: /```([\s\S]*?)```/g,
        heading: /^(#{1,6})\s+(.*)$/gm,
        bulletPoint: /^[-*•]\s+(.*)$/,
        numberedList: /^\d+\.\s+(.*)$/,
        table: /\|.+\|/g
      };

      // Debug log the original text if it contains patient info
      if (text.includes('patients') && messageType !== 'user') {
        console.log('🔍 [parseMarkdown] Original text before cleanup:', text);
        console.log('🔍 [parseMarkdown] Text starts with:', text.substring(0, 50));
        console.log('🔍 [parseMarkdown] Message type:', messageType);
      }

      // Clean up markdown formatting - FIX standalone ** on separate lines first
      let fixedText = text
        // FIRST: Fix ellipsis patterns that look ugly
        .replace(/\.\.\.\s*$/gm, '')  // Remove trailing ellipsis
        .replace(/\s+\.\.\.\s+/g, ' ')  // Replace mid-sentence ellipsis with space
        .replace(/([a-z])\s*\.\.\.\s*([A-Z])/g, '$1. $2')  // Fix ellipsis between sentences
        .replace(/\bas\s+\.\.\.\s*$/gm, '')  // Remove "as ..." at end of lines
        // Remove standalone ** on their own line
        .replace(/^\*\*\s*$/gm, '')
        // Fix pattern with standalone ** before numbered lists
        .replace(/\*\*\s*\n(\d+\.)/gm, '\n$1')
        // Fix malformed bold: "1. Label:** text" -> "1. **Label:** text"
        .replace(/^(\d+\.)\s*([^:]+):\*\*\s+/gm, '$1 **$2:** ')
        // Fix numbered list with missing space after period
        .replace(/^(\d+)\.([A-Z])/gm, '$1. $2')
        // Fix double ** at the end of lines
        .replace(/\*\*$/gm, '')
        // Original cleanups
        .replace(/\b(Dr\.?|Doctor)\s*\n+/gi, '$1 ')  // Remove newlines after Dr. or Doctor
        .replace(/\.\s*##/g, '.\n\n##')  // Ensure line breaks before headers
        .replace(/([.!?])\s*##/g, '$1\n\n##')  // Add proper spacing before headers
        .replace(/•\s*/g, '\n• ')  // Put each bullet point on a new line
        .replace(/\|\s*-+\s*\|/g, '|---|')  // Fix table separators
        .replace(/\n{3,}/g, '\n\n');  // Limit consecutive line breaks

      // Debug log the cleaned text
      if (text.includes('patients') && messageType !== 'user') {
        console.log('🔍 [parseMarkdown] Text after cleanup:', fixedText);
      }
      
      // Process bold text first
      let processedText = fixedText;
      const boldMatches = [...fixedText.matchAll(patterns.bold)];
      
      // Split text and create elements
      const lines = fixedText.split('\n');
      const allElements = [];

      lines.forEach((line, lineIndex) => {
        let lineElements = [];
        let lastIndex = 0;
        
        // Check for headings - Terminal style: render as plain text with just spacing
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
          const headingText = headingMatch[2];
          // Terminal-style: Just add spacing, no big fonts or styling
          lineElements.push(
            <div key={`heading-${lineIndex}`} style={{
              fontSize: typography.fontSize.base,  // Same size as normal text
              fontWeight: typography.fontWeight.normal,  // No bold
              color: colors.text.secondary,  // Slightly dimmer
              marginTop: '12px',
              marginBottom: '6px',
              letterSpacing: '0.2px'
            }}>
              {parseInlineMarkdown(headingText)}
            </div>
          );
        } else if (line.match(patterns.bulletPoint)) {
          // Handle bullet points
          const bulletMatch = line.match(patterns.bulletPoint);
          lineElements.push(
            <div key={`bullet-${lineIndex}`} style={{
              ...componentStyles.list.item,
              marginBottom: '8px'
            }}>
              <span style={componentStyles.list.bullet}>•</span>
              {parseInlineMarkdown(bulletMatch[1])}
            </div>
          );
        } else if (line.match(patterns.numberedList)) {
          // Handle numbered lists
          const numberMatch = line.match(patterns.numberedList);
          lineElements.push(
            <div key={`numbered-${lineIndex}`} style={{
              paddingLeft: '20px',
              position: 'relative',
              marginTop: '2px',
              marginBottom: '2px',
              fontSize: '15px',
              lineHeight: '1.5',
              color: '#e5e7eb',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}>
              <span style={{
                position: 'absolute',
                left: '0',
                color: '#93A2BE',
                fontWeight: '500',
                fontSize: '15px',
                minWidth: '20px',
                display: 'inline-block'
              }}>{line.match(/^\d+/)[0]}.</span>
              {parseInlineMarkdown(numberMatch[1])}
            </div>
          );
        } else if (line.trim()) {
          // Parse inline markdown for regular lines
          lineElements.push(
            <React.Fragment key={`line-${lineIndex}`}>
              {parseInlineMarkdown(line)}
            </React.Fragment>
          );
        }
        
        // Add all elements from this line to the main array
        lineElements.forEach(el => allElements.push(el));

        // Don't add line breaks after numbered list items or if next line is a numbered list
        const nextLine = lines[lineIndex + 1];
        const isNumberedList = line.match(/^\d+\.\s+/);
        const nextIsNumberedList = nextLine && nextLine.match(/^\d+\.\s+/);

        // Only add line break if needed
        if (lineIndex < lines.length - 1 &&
            line.trim() !== '' &&
            !isNumberedList &&
            !nextIsNumberedList) {
          allElements.push(<br key={`br-${lineIndex}`} />);
        }
      });

      // Debug before returning
      if (text.includes('patients') && messageType !== 'user') {
        console.log('🔍 [parseMarkdown] Returning allElements count:', allElements.length);
        console.log('🔍 [parseMarkdown] First few elements:', allElements.slice(0, 5));
      }

      // Return with debugging
      return debugWrapper(allElements);
    };
    
    // Parse inline markdown (bold, italic, code)
    const parseInlineMarkdown = (text) => {
      const elements = [];

      // Fix malformed bold markdown patterns
      let fixedText = text
        // Remove orphaned ** at the end of lines
        .replace(/\*\*\s*$/gm, '')
        // Remove standalone ** on their own line
        .replace(/^\*\*$/gm, '')
        // Fix patterns where opening/closing ** are mismatched
        .replace(/(\d+\.)\*\*([^:]+):\s*([^*]+)\*\*/g, '$1 **$2:** $3')
        .trim();

      let remaining = fixedText;
      let key = 0;

      while (remaining.length > 0) {
        // Find the next markdown pattern - simplified bold matching
        const boldMatch = remaining.match(/\*\*([^*]+?)\*\*/);
        const codeMatch = remaining.match(/`([^`]+?)`/);
        const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);

        // Find which pattern comes first
        const matches = [];
        if (boldMatch) matches.push({ type: 'bold', match: boldMatch, index: boldMatch.index });
        if (codeMatch) matches.push({ type: 'code', match: codeMatch, index: codeMatch.index });
        if (italicMatch && (!boldMatch || italicMatch.index < boldMatch.index)) {
          matches.push({ type: 'italic', match: italicMatch, index: italicMatch.index });
        }
        
        if (matches.length === 0) {
          // No more markdown patterns
          elements.push(<span key={key++}>{remaining}</span>);
          break;
        }
        
        // Sort by index to get the earliest match
        matches.sort((a, b) => a.index - b.index);
        const nextMatch = matches[0];
        
        // Add text before the match
        if (nextMatch.index > 0) {
          elements.push(
            <span key={key++}>{remaining.substring(0, nextMatch.index)}</span>
          );
        }
        
        // Add the formatted element
        switch (nextMatch.type) {
          case 'bold':
            // Terminal-style: render bold as plain text (same as regular text for readability)
            elements.push(
              <span key={key++} style={{
                fontWeight: typography.fontWeight.normal,
                color: colors.text.secondary,  // Slightly dimmer for subtle emphasis
                letterSpacing: '0.1px'
              }}>
                {nextMatch.match[1]}
              </span>
            );
            break;
          case 'code':
            elements.push(
              <code key={key++} style={textStyles.code}>
                {nextMatch.match[1]}
              </code>
            );
            break;
          case 'italic':
            elements.push(
              <em key={key++} style={{
                fontStyle: 'italic',
                color: colors.text.secondary,
                letterSpacing: '0.1px'
              }}>
                {nextMatch.match[1]}
              </em>
            );
            break;
        }
        
        // Remove the processed part
        remaining = remaining.substring(nextMatch.index + nextMatch.match[0].length);
      }
      
      return elements;
    };
    
    // Pass the message type (user or agent) to parseMarkdown
    const messageType = isUser ? 'user' : 'agent';

    if (!isUser && textContent.includes('patients')) {
      console.log('🔍 [formatContent] AGENT MESSAGE DETECTED');
      console.log('🔍 [formatContent] messageType:', messageType);
      console.log('🔍 [formatContent] textContent.length:', textContent.length);
      console.log('🔍 [formatContent] textContent preview:', textContent.substring(0, 100));
    }

    console.log('🔍 [formatContent] About to call parseMarkdown with messageType:', messageType);
    console.log('🔍 [formatContent] textContent:', textContent);

    try {
      const result = parseMarkdown(textContent, messageType);
      console.log('🔍 [formatContent] parseMarkdown returned:', result);
      return result;
    } catch (error) {
      console.error('❌ [formatContent] parseMarkdown failed:', error);
      // Fallback to plain text
      return <span>{textContent}</span>;
    }
  };
  
  // Avatar style - glassmorphism icons
  const avatarStyle = {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 'normal',
    marginRight: isRTL ? '16px' : (isUser ? '0' : '16px'),
    marginLeft: isRTL ? '0' : (isUser ? '16px' : '0'),
    flexShrink: 0
  };
  
  // Check if this message contains a grid - grids need full width
  const isGridMessage = message.gridFormat ||
    (message.displayData && message.displayData.gridFormat) ||
    message.displayType === 'medicalGrid' ||
    message.displayType === 'multiCategoryGrid' ||
    message.displayType === 'aiInsights' ||
    message.displayType === 'medicalCategories' ||
    message.displayType === 'singleCategory';

  const messageContainerStyle = {
    display: 'flex',
    alignItems: 'flex-start',  // Left align items
    flexDirection: 'column',
    maxWidth: (message.displayType === 'aiInsights' || message.displayType === 'medicalCategories' || message.displayType === 'singleCategory')
      ? '1200px'
      : (isGridMessage ? '90%' : (artifactPanelOpen ? '600px' : '800px')),  // Narrower when artifact panel is open
    width: '100%',
    padding: '0 20px',
    margin: '0 auto'  // Both centered
  };
  
  // Final check before rendering
  if (message.gridFormat || (message.displayData && message.displayData.gridFormat)) {
    console.log('✅ [Message] RENDERING MedicalGridRenderer:', {
      gridFormat: message.gridFormat || message.displayData?.gridFormat,
      dataLength: message.data?.length || message.displayData?.data?.length || 0,
      columns: message.columns?.length || message.displayData?.columns?.length || 0
    });
  }

  // If this is a thinking message, show it like a regular agent message
  if (message.isThinking) {
    const messageContainerStyle = {
      display: 'flex',
      alignItems: 'flex-start',
      flexDirection: 'column',
      maxWidth: artifactPanelOpen ? '600px' : '800px',
      width: '100%',
      padding: '0 20px',
      margin: '0 auto'
    };

    return (
      <div style={wrapperStyle}>
        <div style={messageContainerStyle} className="chat-message-content">
          <div style={{ position: 'relative', width: '100%' }}>
            <div
              className={message.isStreaming ? 'streaming-text-content' : ''}
              style={{
                ...bubbleStyle,
                maxWidth: isUser ? '600px' : '800px',
                width: '100%',
                display: 'block',
                textAlign: 'left',
                paddingLeft: '16px',
                paddingRight: '16px'
              }}
            >
              {message.isStreaming ? (
                <Typewriter text={message.content} delay={30} />
              ) : (
                message.content
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={wrapperStyle}>
        <div style={messageContainerStyle} className="chat-message-content">
          {/* Show the text message UNLESS we have multiCategoryGrid (to avoid duplication) */}
          {message.content && message.displayType !== 'multiCategoryGrid' && (
            <div style={{ position: 'relative', width: '100%' }}>
              <div
                className={message.isStreaming ? 'streaming-text-content' : ''}
                style={{
                  ...bubbleStyle,
                  maxWidth: isGridMessage ? '600px' : (isUser ? '600px' : '800px'),  // Consistent max-width for user messages
                  width: '100%',
                  display: 'block',  // Ensure block display
                  textAlign: 'left',  // FORCE left alignment here too
                  paddingLeft: isUser ? '16px' : '16px',  // Consistent left padding
                  paddingRight: isUser ? '40px' : '16px'  // More right padding for user to push text left
                }}
              >
              {isMasked ? (
                <span style={{ opacity: 0.9 }}>{message.content}</span>
              ) : (
                (() => {
                  // For user messages with attachments, append the attachment info to the content
                  let displayContent = message.content;
                  if (isUser && message.attachments && message.attachments.length > 0) {
                    // Add attachment info inline with the message
                    const attachmentText = `\n⬆️ ${message.attachments.length} files attached: ${message.attachments.map(att => att.fileName).join(', ')}`;
                    displayContent = (message.content || 'Analyze this document') + attachmentText;
                  }

                  // Use typewriter effect for streaming messages
                  if (message.isStreaming && !isUser) {
                    return <Typewriter text={displayContent} delay={30} />;
                  }

                  const formatted = formatContent(displayContent);
                  return formatted;
                })()
              )}
            </div>

          </div>
        )}

        {/* Action buttons row - only for agent messages */}
        {!isUser && message.content && message.displayType !== 'multiCategoryGrid' && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '8px',
            marginLeft: '16px',
            alignItems: 'center',
            position: 'relative'
          }}>
            {/* Copy button - standalone */}
            <button
              onClick={handleCopy}
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
                color: '#93A2BE',
                fontSize: '18px',
                fontFamily: 'Comfortaa, Geneva, Tahoma, sans-serif',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = '#E9EFFA';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#93A2BE';
              }}
              title={copied ? 'Copied!' : 'Copy'}
            >
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </>
              )}
            </button>

            {/* Speaker / Stop TTS button */}
            {ttsEnabled && onSpeakMessage && (
              <button
                onClick={() => {
                  if (speakingMessageId === message.id) {
                    onStopSpeaking();
                  } else {
                    const textContent = typeof message.content === 'string' ? message.content : String(message.content);
                    const plainText = textContent
                      .replace(/\*\*/g, '')
                      .replace(/^#{1,6}\s+/gm, '')
                      .replace(/(?<!\n)\*(?!\*)/g, '')
                      .replace(/`/g, '')
                      .replace(/\n{3,}/g, '\n\n')
                      .trim();
                    onSpeakMessage(plainText, message.id);
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s ease',
                  color: speakingMessageId === message.id ? '#10a37f' : '#93A2BE',
                  fontSize: '18px',
                  fontFamily: 'Comfortaa, Geneva, Tahoma, sans-serif',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  if (speakingMessageId !== message.id) e.currentTarget.style.color = '#E9EFFA';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  if (speakingMessageId !== message.id) e.currentTarget.style.color = '#93A2BE';
                }}
                title={speakingMessageId === message.id ? 'Stop reading' : 'Read aloud'}
              >
                {speakingMessageId === message.id ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                  </svg>
                )}
              </button>
            )}

            {/* More options button with dropdown - only for exportable content */}
            {message.displayType === 'categoriesList' && message.exportable && message.categories && (
              <div ref={exportMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease',
                    color: showExportMenu ? '#E9EFFA' : '#93A2BE',
                    fontSize: '18px',
                    fontFamily: 'Comfortaa, Geneva, Tahoma, sans-serif',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#E9EFFA';
                  }}
                  onMouseLeave={(e) => {
                    if (!showExportMenu) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#93A2BE';
                    }
                  }}
                  title="More options"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="12" cy="5" r="1"></circle>
                    <circle cx="12" cy="19" r="1"></circle>
                  </svg>
                </button>

                {/* Dropdown menu */}
                {showExportMenu && (
                  <div
                    ref={dropdownMenuRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '0',
                      marginTop: '4px',
                      background: '#1B2C4A',
                      border: '1px solid #121E33',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                      minWidth: '160px',
                      zIndex: 1000,
                      overflow: 'hidden'
                    }}
                  >
                    <CategoriesListExport
                      categories={message.categories}
                      patientName={message.patientName}
                      patientId={message.patientId}
                      onExportComplete={() => setShowExportMenu(false)}
                      isDropdown={true}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Don't show attachments separately - they should be part of the message content */}

        {/* Then show grid data if it exists (in addition to text) */}
        {/* Use MedicalGridRenderer for all grid displays */}
        {/* Skip if we have categoryGrids (multi-category display) */}
        {/* Skip if displayType is openArtifactPanel (artifact panel will handle display) */}
        {(message.displayType === 'grid' || message.gridFormat || (message.displayData && message.displayData.gridFormat)) &&
         !(message.categoryGrids && Array.isArray(message.categoryGrids) && message.categoryGrids.length > 0) &&
         message.displayType !== 'openArtifactPanel' && (
            <MedicalGridRenderer
              data={message.displayData || message}
              language={isRTL ? 'he' : 'en'}
            />
        )}

        {/* Or show medical grid if it's that type */}
        {(message.displayType === 'medicalGrid' && message.displayData && !message.gridFormat && !(message.displayData && message.displayData.gridFormat)) && (
          <MedicalDataGrid
            data={message.displayData}
            language={isRTL ? 'he' : 'en'}
          />
        )}

        {/* Show multi-category grids if present */}
        {console.log('🔍 [Message] Checking multiCategoryGrid:', {
          displayType: message.displayType,
          hasCategoryGrids: !!message.categoryGrids,
          categoryGridsType: typeof message.categoryGrids,
          categoryGridsLength: Array.isArray(message.categoryGrids) ? message.categoryGrids.length : 'not array'
        })}

        {/* Show AI Insights Card when backend requests it */}
        {message.displayType === 'aiInsights' && (
          <AIInsightsCard
            language={isRTL ? 'he' : 'en'}
            categoryGrids={message.categoryGrids || []}
          />
        )}

        {/* Show Single Category Card when backend requests it */}
        {message.displayType === 'singleCategory' && message.displayData && (
          <SingleCategoryCard
            category={message.displayData}
            language={isRTL ? 'he' : 'en'}
          />
        )}

        {/* Show Medical Categories Card when backend requests it */}
        {message.displayType === 'medicalCategories' && (
          <MedicalCategoriesCard
            language={isRTL ? 'he' : 'en'}
            categoryGrids={message.categoryGrids || []}
            message={message}
          />
        )}

        {/* ONLY use DataTypeRenderer for categoryGrids if NOT using special display types */}
        {message.categoryGrids && Array.isArray(message.categoryGrids) && message.categoryGrids.length > 0 &&
         message.displayType !== 'aiInsights' && message.displayType !== 'singleCategory' && message.displayType !== 'medicalCategories' && message.displayType !== 'openArtifactPanel' && (
          <DataTypeRenderer
            categoryGrids={message.categoryGrids}
            isRTL={isRTL}
          />
        )}

        {/* Show fallback provider indicator if using backup service */}
        {message.usedFallback && message.fallbackProvider && (
          <div style={{ 
            fontSize: '11px', 
            color: '#93A2BE', 
            marginTop: '4px',
            fontStyle: 'italic' 
          }}>
            {message.fallbackProvider === 'economy_mode' 
              ? '⚡ IntelliCare AI - Economy Mode' 
              : message.fallbackProvider === 'gemini' 
                ? '⚡ IntelliCare AI - Backup System' 
                : `⚡ IntelliCare AI - ${message.fallbackProvider}`}
          </div>
        )}
        
        {(message.timestamp || message.createdAt) && (
          <div style={timestampStyle}>
            {formatTime(message.timestamp || message.createdAt)}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default Message;