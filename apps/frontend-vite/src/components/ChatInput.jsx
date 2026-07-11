import React, { useState, useRef, memo, useEffect } from 'react';

const ChatInput = memo(({ onSendMessage, isLoading, placeholder, isRTL }) => {
  const [inputMessage, setInputMessage] = useState('');
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Auto-focus on mount and keep focus after sending
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);
  
  const handleSend = () => {
    if (!inputMessage.trim() || isLoading) return;
    onSendMessage(inputMessage);
    setInputMessage('');
    // Focus after a small delay to ensure DOM updates
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Handle multiple files for batch processing
      if (files.length > 1) {
        process.env.NODE_ENV !== 'production' && console.log(`📦 Batch upload: ${files.length} files selected`);
        
        // Validate all files
        const oversizedFiles = Array.from(files).filter(f => f.size > 5 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
          alert(isRTL 
            ? `${oversizedFiles.length} קבצים גדולים מדי. גודל מקסימלי: 5MB` 
            : `${oversizedFiles.length} files too large. Maximum size: 5MB`);
          event.target.value = '';
          return;
        }
        
        // Process all files for batch upload - convert to base64
        process.env.NODE_ENV !== 'production' && console.log('📦 Converting files to base64 for batch upload...');
        
        const filePromises = Array.from(files).map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                fileName: file.name,
                fileSize: (file.size / (1024 * 1024)).toFixed(2),
                mimeType: file.type,
                content: e.target.result.split(',')[1] // Remove data:type;base64, prefix
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        });
        
        // Wait for all files to be converted
        try {
          const fileInfoArray = await Promise.all(filePromises);
          
          // Send batch upload message with base64 content
          const batchMessage = {
            type: 'batch_file_upload',
            files: fileInfoArray,
            count: files.length,
            totalSize: fileInfoArray.reduce((sum, f) => sum + parseFloat(f.fileSize), 0).toFixed(2)
          };
          
          process.env.NODE_ENV !== 'production' && console.log(`✅ Batch message ready with ${files.length} files`);
          onSendMessage(batchMessage);
        } catch (error) {
          process.env.NODE_ENV !== 'production' && console.error('Error converting files:', error);
          alert(isRTL ? 'שגיאה בהמרת הקבצים' : 'Error converting files');
        }
        
      } else {
        // Single file handling (existing logic)
        const file = files[0];
        const fileName = file.name;
        const fileSize = (file.size / (1024 * 1024)).toFixed(2); // Size in MB

        // Validate file size (max 5MB for security)
        if (file.size > 5 * 1024 * 1024) {
          alert(isRTL ? 'הקובץ גדול מדי. גודל מקסימלי: 5MB' : 'File too large. Maximum size: 5MB');
          event.target.value = '';
          return;
        }

      // Validate file type - strict whitelist including CSV for patient data
      const allowedTypes = [
        'application/pdf',
        'image/jpeg', 'image/png',
        'text/csv', 'application/vnd.ms-excel', // CSV files
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx files
      ];

      if (!allowedTypes.includes(file.type)) {
        alert(isRTL ? 'סוג קובץ לא נתמך. רק PDF, JPG, PNG, CSV ו-Excel' : 'Unsupported file type. Only PDF, JPG, PNG, CSV and Excel allowed');
        event.target.value = '';
        return;
      }

      // CRITICAL FIX: Detect CSV patient import vs regular file upload
      const isCSV = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || fileName.toLowerCase().endsWith('.csv');
      const isPatientsCSV = isCSV && (
        fileName.toLowerCase().includes('patient') ||
        fileName.toLowerCase().includes('import') ||
        fileName.toLowerCase().includes('new_') ||
        fileName.toLowerCase().includes('updated_')
      );

      if (isPatientsCSV) {
        process.env.NODE_ENV !== 'production' && console.log('📋 Patient CSV detected - routing to patient import');

        // Read CSV as base64 for backend upload system
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Content = e.target.result.split(',')[1]; // Remove data:type;base64, prefix

          // Send as file_upload with special marker for patient CSV
          const csvImportData = {
            type: 'file_upload',
            fileName: fileName,
            fileSize: fileSize,
            mimeType: file.type,
            content: base64Content,
            timestamp: new Date().toISOString(),
            isPatientCSV: true  // Special flag for backend detection
          };

          process.env.NODE_ENV !== 'production' && console.log('✅ Patient CSV ready for import');
          onSendMessage(csvImportData);
        };

        reader.onerror = () => {
          alert(isRTL ? 'שגיאה בקריאת קובץ CSV' : 'Error reading CSV file');
        };

        // Read as base64 like other files
        reader.readAsDataURL(file);

      } else {
        // Regular file upload (PDF, images, etc.)
        try {
          // Convert file to base64 for transmission through chat
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64Content = e.target.result.split(',')[1]; // Remove data:type;base64, prefix

            // Create structured message for file upload through chat
            // The agent will ask for patient ID through conversation
            const fileData = {
              type: 'file_upload',
              fileName: fileName,
              fileSize: fileSize,
              mimeType: file.type,
              content: base64Content,
              timestamp: new Date().toISOString()
            };

            // Send through the existing onSendMessage (which goes through secure proxy)
            // The Claude agent will handle asking for patient ID via function calling
            onSendMessage(fileData);
          };

          reader.onerror = () => {
            alert(isRTL ? 'שגיאה בקריאת הקובץ' : 'Error reading file');
          };

          // Read file as base64
          reader.readAsDataURL(file);

        } catch (error) {
          process.env.NODE_ENV !== 'production' && console.error('File processing error:', error);
          alert(isRTL ? 'שגיאה בעיבוד הקובץ' : 'Error processing file');
        }
      }
      } // End of single file else block
      
      // Clear the file input
      event.target.value = '';
    }
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const wrapperStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
    position: 'relative'
  };

  const containerStyle = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    padding: '0',
    background: 'transparent',
    width: '100%',
    marginBottom: '8px'
  };

  const decorativeLineStyle = {
    height: '2px',
    background: 'linear-gradient(90deg, transparent 0%, rgba(74, 158, 255, 0.3) 50%, transparent 100%)',
    width: '100%',
    borderRadius: '1px'
  };
  
  const uploadButtonStyle = {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(74, 158, 255, 0.1)',
    color: '#4a9eff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    marginBottom: '0'
  };
  
  const inputStyle = {
    flex: 1,
    minHeight: '50px',
    maxHeight: '120px',
    padding: '14px 20px',
    borderRadius: '22px',
    border: '1px solid #2a3050',
    background: '#1e2341',
    color: '#e8eaf0',
    fontSize: '16px',
    fontFamily: "'Inter', 'SF Pro Text', 'Segoe UI', system-ui, -apple-system, sans-serif",
    fontWeight: '400',
    lineHeight: '1.4',
    resize: 'none',
    outline: 'none',
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left'
  };
  
  const buttonStyle = {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    border: 'none',
    background: inputMessage.trim() ? 'linear-gradient(135deg, #4a9eff, #667eea)' : '#2a3050',
    color: '#ffffff',
    cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    opacity: inputMessage.trim() && !isLoading ? 1 : 0.5
  };
  
  const spinnerStyle = {
    width: '16px',
    height: '16px',
    border: '2px solid transparent',
    borderTop: '2px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  };

  return (
    <div style={wrapperStyle}>
      <div style={containerStyle}>
        {/* Hidden file input - BATCH ENABLED */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.dcm,.dicom,.ct,.mri"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          multiple={true}
        />
        
        {/* Upload button */}
        <button
          onClick={handleUploadClick}
          disabled={isLoading}
          style={{
            ...uploadButtonStyle,
            opacity: isLoading ? 0.5 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
          title={isRTL ? 'העלאת קבצים (PDF, תמונות, CSV, מסמכים, צילומי רנטגן, CT, MRI)' : 'Upload files (PDF, Images, CSV, Documents, X-ray, CT, MRI)'}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
        
        {/* Text input */}
        <textarea
          ref={inputRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={isLoading}
          rows="1"
          style={inputStyle}
          autoFocus
        />
        
        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={isLoading || !inputMessage.trim()}
          style={buttonStyle}
        >
          {isLoading ? (
            <div style={spinnerStyle} />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
      
      {/* Decorative line below input */}
      <div style={decorativeLineStyle}></div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;