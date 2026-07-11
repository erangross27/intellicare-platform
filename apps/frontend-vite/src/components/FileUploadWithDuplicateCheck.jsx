import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import secureApi from '../services/secureApiClient';
import { useLanguage } from '../config/languagesStatic';

const FileUploadWithDuplicateCheck = ({ patientId, onUploadSuccess, onUploadError }) => {
  const { t, currentLanguage } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [uploadResults, setUploadResults] = useState(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  // Helper function to get message in current language
  const getMessage = (message) => {
    if (typeof message === 'string') return message;
    if (typeof message === 'object' && message !== null) {
      return message[currentLanguage] || message.en || message.he || 'Error occurred';
    }
    return 'Error occurred';
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!patientId) {
      onUploadError?.('No patient selected');
      return;
    }

    // Check if too many files selected
    if (acceptedFiles.length > 100) {
      setUploadResults({
        success: false,
        message: currentLanguage === 'he' 
          ? `ניתן להעלות עד 100 קבצים בכל פעם. בחרת ${acceptedFiles.length} קבצים. אנא בחר פחות קבצים ונסה שוב.`
          : `Maximum 100 files allowed per upload. You selected ${acceptedFiles.length} files. Please select fewer files and try again.`
      });
      onUploadError?.('Too many files selected');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setDuplicateWarning(null);
    setUploadResults(null);

    try {
      const formData = new FormData();
      acceptedFiles.forEach(file => {
        formData.append('files', file);
      });

      // SECURE API: Checking for duplicate documents
      const response = await secureApi.post(
        `/api/documents/upload/${patientId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        }
      );

      // Handle successful uploads
      if (response.data.success && response.data.documents.length > 0) {
        setUploadResults({
          success: true,
          uploaded: response.data.documents,
          message: response.data.message
        });

        // Start AI processing monitoring
        setAiProcessing(true);
        setAiProgress(0);

        // Monitor AI analysis progress
        monitorAiAnalysis(response.data.documents || []);

        onUploadSuccess?.(response.data.documents);
      }

      // Handle duplicate file warnings
      if (response.data.duplicateFiles && response.data.duplicateFiles.length > 0) {
        setDuplicateWarning({
          files: response.data.duplicateFiles,
          message: response.data.duplicateWarning || 'Some files were rejected due to duplicates'
        });
      }

      // Handle mixed results (some success, some duplicates)
      if (response.data.errors && response.data.errors.length > 0) {
        const duplicates = response.data.errors.filter(e => e.error === 'Duplicate file detected');
        const otherErrors = response.data.errors.filter(e => e.error !== 'Duplicate file detected');
        
        if (duplicates.length > 0 && response.data.documents.length > 0) {
          // Partial success with duplicates
          setUploadResults({
            success: true,
            uploaded: response.data.documents,
            message: `${response.data.documents.length} files uploaded, ${duplicates.length} duplicates rejected`
          });
        }
        
        if (otherErrors.length > 0) {
          process.env.NODE_ENV !== 'production' && console.error('Upload errors:', otherErrors);
        }
      }

    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Upload failed:', error);
      
      if (error.response?.data?.duplicateFiles) {
        // All files were duplicates
        const errorMessage = getMessage(error.response.data.message) || t('duplicateFileMessage');
        setDuplicateWarning({
          files: error.response.data.duplicateFiles,
          message: errorMessage
        });
        setUploadResults({
          success: false,
          message: t('uploadFailed') + ': ' + t('duplicateFileDetected')
        });
      } else {
        const errorMessage = getMessage(error.response?.data?.message) || error.response?.data?.error || t('uploadError');
        setUploadResults({
          success: false,
          message: errorMessage
        });
        onUploadError?.(errorMessage);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [patientId, onUploadSuccess, onUploadError]);

  // Monitor AI analysis progress
  const monitorAiAnalysis = useCallback(async (documents) => {
    if (!documents || documents.length === 0) return;

    const maxWaitTime = 60000; // 60 seconds max
    const pollInterval = 2000; // Check every 2 seconds
    const startTime = Date.now();

    const checkAnalysisStatus = async () => {
      try {
        // Check if documents have been analyzed
        // SECURE API: Fetching patient documents
        const response = await secureApi.get(`/patients/${patientId}/documents`);
        const currentDocs = response.data.data || [];

        // Check if all uploaded documents have completed analysis
        const uploadedDocIds = documents.map(doc => doc._id);
        const analyzedDocs = currentDocs.filter(doc =>
          uploadedDocIds.includes(doc._id) &&
          doc.processingStatus === 'completed'
        );

        const progress = Math.round((analyzedDocs.length / documents.length) * 100);
        setAiProgress(progress);

        if (analyzedDocs.length === documents.length) {
          // All documents analyzed
          setAiProcessing(false);
          setAiProgress(100);

          // Update the UI without refreshing the page
          // Trigger a refresh of the medical history data instead of page reload
          if (window.refreshMedicalHistory) {
            window.refreshMedicalHistory();
          }
          return;
        }

        // Continue polling if not done and within time limit
        if (Date.now() - startTime < maxWaitTime) {
          setTimeout(checkAnalysisStatus, pollInterval);
        } else {
          // Timeout - stop monitoring
          setAiProcessing(false);
          setAiProgress(100);
        }

      } catch (error) {
        process.env.NODE_ENV !== 'production' && console.error('Error checking analysis status:', error);
        setAiProcessing(false);
      }
    };

    // Start monitoring after a short delay
    setTimeout(checkAnalysisStatus, 1000);
  }, [patientId]);

  const { getRootProps, getInputProps, isDragActive, rejectedFiles } = useDropzone({
    onDrop: (acceptedFiles, rejectedFiles) => {
      process.env.NODE_ENV !== 'production' && console.log('Dropzone: Accepted files:', acceptedFiles.length, 'Rejected files:', rejectedFiles.length);
      
      if (rejectedFiles.length > 0) {
        const rejectionReasons = rejectedFiles.map(rejection => {
          const errors = rejection.errors.map(error => {
            switch (error.code) {
              case 'file-too-large':
                return `File too large (max 50MB)`;
              case 'file-invalid-type':
                return `Invalid file type`;
              case 'too-many-files':
                return `Too many files (max 10)`;
              default:
                return error.message;
            }
          });
          return `${rejection.file.name}: ${errors.join(', ')}`;
        });
        
        setUploadResults({
          success: false,
          message: 'Some files were rejected',
          rejectedFiles: rejectionReasons
        });
      }
      
      if (acceptedFiles.length > 0) {
        onDrop(acceptedFiles);
      }
    },
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'],
      'application/dicom': ['.dcm']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 100 // Increased from 10 to 100 for bulk uploads
  });

  const handleDismissDuplicate = () => {
    setDuplicateWarning(null);
  };

  const handleDismissResults = () => {
    setUploadResults(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${uploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {uploading || aiProcessing ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            {uploading ? (
              <>
                <p className="text-sm text-gray-600">Uploading... {uploadProgress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </>
            ) : aiProcessing ? (
              <>
                <p className="text-sm text-gray-600">AI Analysis... {aiProgress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${aiProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">Processing medical data...</p>
              </>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-sm text-gray-600">
              {isDragActive ? (
                <p>Drop the files here...</p>
              ) : (
                <div>
                  <p><span className="font-semibold text-blue-600 hover:text-blue-500">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, Images, DICOM (max 50MB each)</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Duplicate Warning */}
      {duplicateWarning && (
        <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-4">
          <div className="flex justify-between items-start">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  {t('duplicateFileDetected')}
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p className="mb-2">{duplicateWarning.message}</p>
                  <ul className="list-disc list-inside space-y-1">
                    {duplicateWarning.files.map((file, index) => (
                      <li key={index} className="break-all">
                        <span className="font-medium">{file.filename}</span>
                        {file.existingFileDate && (
                          <span className="text-xs text-yellow-600 ml-2">
                            (existing file uploaded: {new Date(file.existingFileDate).toLocaleString()})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    💡 <strong>To upload these files:</strong> Delete the existing files first, or rename your files before uploading.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleDismissDuplicate}
              className="flex-shrink-0 ml-4 text-yellow-400 hover:text-yellow-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults && (
        <div className={`border rounded-lg p-4 ${
          uploadResults.success 
            ? 'border-green-200 bg-green-50' 
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex justify-between items-start">
            <div className="flex">
              <div className="flex-shrink-0">
                {uploadResults.success ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${
                  uploadResults.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {uploadResults.success ? t('uploadSuccess') : t('uploadFailed')}
                </h3>
                <p className={`mt-1 text-sm ${
                  uploadResults.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {uploadResults.message}
                </p>
                {uploadResults.uploaded && uploadResults.uploaded.length > 0 && (
                  <ul className={`mt-2 text-sm ${
                    uploadResults.success ? 'text-green-700' : 'text-red-700'
                  } list-disc list-inside`}>
                    {uploadResults.uploaded.map((file, index) => (
                      <li key={index}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</li>
                    ))}
                  </ul>
                )}
                {uploadResults.rejectedFiles && uploadResults.rejectedFiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-red-800 mb-1">Rejected files:</p>
                    <ul className="text-sm text-red-700 list-disc list-inside ml-2">
                      {uploadResults.rejectedFiles.map((rejection, index) => (
                        <li key={index} className="text-xs">{rejection}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleDismissResults}
              className={`flex-shrink-0 ml-4 ${
                uploadResults.success 
                  ? 'text-green-400 hover:text-green-500' 
                  : 'text-red-400 hover:text-red-500'
              }`}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadWithDuplicateCheck;
