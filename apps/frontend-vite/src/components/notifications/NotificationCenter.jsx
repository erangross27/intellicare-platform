import React, { useState, useEffect, useRef, useCallback } from 'react';
import secureApi from '../../services/secureApiClient';
import { roleLabel } from '../../config/roleConfig';

const NotificationCenter = ({
  userId,
  language = 'en',
  socket = null,
  maxItems = 20,
  onSendMessage = null,
  onUnreadCountChange = null
}) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread
  const [reviewSending, setReviewSending] = useState(null); // tracks which notification review is sending
  const isRTL = language === 'he';

  // Ref for userId — keeps socket listeners current even if userId prop loads after socket setup
  const userIdRef = useRef(userId ? String(userId) : null);
  useEffect(() => {
    userIdRef.current = userId ? String(userId) : null;
  }, [userId]);

  // Report unread count changes to parent for badge display
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);
  
  // Move labels outside component to prevent recreation
  const t = React.useMemo(() => {
    const labels = {
      en: {
        title: 'Notifications',
        all: 'All',
        unread: 'Unread',
        markAsRead: 'Mark as read',
        markAllAsRead: 'Mark all as read',
        noNotifications: 'No notifications',
        newAppointment: 'New Appointment',
        appointmentCancelled: 'Appointment Cancelled',
        appointmentRescheduled: 'Appointment Rescheduled',
        appointmentReminder: 'Appointment Reminder',
        batchComplete: 'Document Analysis Complete',
        batchCompleteMessage: '{count} documents analyzed successfully',
        processingDocuments: 'Processing Documents...',
        justNow: 'Just now',
        minutesAgo: '{minutes}m ago',
        hoursAgo: '{hours}h ago',
        yesterday: 'Yesterday',
        daysAgo: '{days} days ago',
        permissionRequest: 'Permission Request',
        roleRequest: 'Role Request',
        permissionApproved: 'Permission Approved',
        permissionDenied: 'Permission Denied',
        reviewRequest: 'Review'
      },
      he: {
        title: 'התראות',
        all: 'הכל',
        unread: 'לא נקראו',
        markAsRead: 'סמן כנקרא',
        markAllAsRead: 'סמן הכל כנקרא',
        noNotifications: 'אין התראות',
        newAppointment: 'תור חדש',
        appointmentCancelled: 'תור בוטל',
        appointmentRescheduled: 'תור נדחה',
        appointmentReminder: 'תזכורת לתור',
        batchComplete: 'ניתוח המסמכים הושלם',
        batchCompleteMessage: '{count} מסמכים נותחו בהצלחה',
        processingDocuments: 'מעבד מסמכים...',
        justNow: 'עכשיו',
        minutesAgo: 'לפני {minutes} דק׳',
        hoursAgo: 'לפני {hours} שעות',
        yesterday: 'אתמול',
        daysAgo: 'לפני {days} ימים',
        permissionRequest: 'בקשת הרשאה',
        roleRequest: 'בקשת תפקיד',
        permissionApproved: 'הרשאה אושרה',
        permissionDenied: 'בקשת הרשאה נדחתה',
        reviewRequest: 'סקירה'
      }
    };
    return labels[language] || labels.en;
  }, [language]);
  
  // Load notifications from database on mount
  useEffect(() => {
    const loadNotifications = async () => {
      console.log('🔔 NotificationCenter - Loading notifications (session-based auth)');

      // We don't need userId - using session-based authentication
      setLoading(true);
      try {
        // Fetch notifications from database
        const response = await secureApi.get('/api/notifications', {
          params: {
            limit: maxItems,
            sort: '-createdAt'
          }
        });

        // secureApi returns the data directly, not wrapped in response.data
        const dbNotifications = response?.notifications || [];
        console.log('📬 Loaded notifications from database:', dbNotifications);
        console.log('📬 First notification status:', dbNotifications[0]?.status);
        console.log('📬 First notification read check:', dbNotifications[0]?.status === 'read');

        // Format notifications for display
        const formattedNotifications = dbNotifications.map(notif => {
          // Determine title based on notification type
          let title = notif.title;
          if (!title) {
            switch(notif.type) {
              case 'batch_complete':
                title = t.batchComplete;
                break;
              case 'document_analysis':
                title = 'Document Analysis';
                break;
              case 'permission_request':
                title = t.permissionRequest;
                break;
              case 'permission_approved':
                title = t.permissionApproved;
                break;
              case 'permission_denied':
                title = t.permissionDenied;
                break;
              case 'system':
                title = 'System Notification';
                break;
              default:
                title = 'Notification';
            }
          }

          return {
            id: notif._id || `notif_${notif.batchId || Date.now()}`,
            type: notif.type || 'batch_complete',
            title: title,
            message: notif.message || t.batchCompleteMessage.replace('{count}', notif.fileCount || 0),
            data: notif,
            read: notif.status === 'read',
            createdAt: notif.createdAt || notif.completedAt || new Date().toISOString(),
            batchId: notif.batchId,
            fileCount: notif.fileCount
          };
        });

        setNotifications(formattedNotifications);
        setUnreadCount(formattedNotifications.filter(n => !n.read).length);

        // Check localStorage for any offline notifications (only if userId is available)
        if (userId) {
          const stored = localStorage.getItem(`notifications_${userId}`);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              // Merge with database notifications (avoid duplicates)
              const merged = [...formattedNotifications];
              parsed.forEach(localNotif => {
                if (!merged.some(n => n.id === localNotif.id)) {
                  merged.push(localNotif);
                }
              });
              if (merged.length > formattedNotifications.length) {
                setNotifications(merged.slice(0, maxItems));
                setUnreadCount(merged.filter(n => !n.read).length);
                console.log('📬 Merged with localStorage, total notifications:', merged.length);
              }
            } catch (e) {
              console.error('Failed to parse stored notifications:', e);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load notifications from database:', error);

        // Fallback to localStorage
        const stored = localStorage.getItem(`notifications_${userId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setNotifications(parsed);
            setUnreadCount(parsed.filter(n => !n.read).length);
          } catch (e) {
            console.error('Failed to parse stored notifications:', e);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [maxItems, language]); // Dependencies: maxItems and language only
  
  // Save notifications to localStorage
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(notifications));
    }
  }, [notifications, userId]);

  // Add appointment reminders on component mount
  useEffect(() => {
    // Fetch appointments and add reminders for upcoming ones
    const addAppointmentReminders = async () => {
      try {
        const response = await secureApi.get('/api/appointments/provider/' + userId, {
          params: {
            status: 'scheduled',
            fromDate: new Date().toISOString(),
            limit: 10
          }
        });

        const appointments = response?.data || response || [];
        const now = new Date();

        appointments.forEach(apt => {
          const aptDateTime = new Date(apt.scheduledDate);
          const [hours, minutes] = apt.scheduledTime.split(':');
          aptDateTime.setHours(parseInt(hours), parseInt(minutes));

          const hoursUntil = Math.floor((aptDateTime - now) / (1000 * 60 * 60));

          // Add reminder for appointments in next 24 hours
          if (hoursUntil > 0 && hoursUntil <= 24) {
            const reminder = {
              id: `reminder_${apt._id}`,
              type: 'appointment_reminder',
              title: t.appointmentReminder,
              message: `${apt.patientName || 'Patient'} - ${apt.scheduledTime} (in ${hoursUntil} hours)`,
              data: apt,
              read: false,
              createdAt: new Date().toISOString()
            };

            setNotifications(prev => {
              // Don't add duplicate reminders
              if (prev.some(n => n.id === reminder.id)) return prev;
              return [reminder, ...prev].slice(0, 50);
            });
            setUnreadCount(prev => prev + 1);
          }
        });
      } catch (error) {
        console.error('Failed to fetch appointment reminders:', error);
      }
    };

    if (userId) {
      addAppointmentReminders();
    }
  }, [userId, t]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket) {
      console.log('⏳ NotificationCenter: Waiting for socket connection...');
      return;
    }

    console.log('✅ NotificationCenter: Socket connected, setting up event listeners');

    const handleNewAppointment = (data) => {
      const notification = {
        id: `notif_${Date.now()}_${Math.random()}`,
        type: 'new_appointment',
        title: t.newAppointment,
        message: `${data.patientName} - ${data.scheduledTime}`,
        data: data,
        read: false,
        createdAt: new Date().toISOString()
      };
      
      setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification if permitted
      showBrowserNotification(notification);
    };
    
    const handleAppointmentCancelled = (data) => {
      const notification = {
        id: `notif_${Date.now()}_${Math.random()}`,
        type: 'appointment_cancelled',
        title: t.appointmentCancelled,
        message: `${data.patientName} - ${data.scheduledTime}`,
        data: data,
        read: false,
        createdAt: new Date().toISOString()
      };
      
      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      showBrowserNotification(notification);
    };
    
    socket.on('new_appointment', handleNewAppointment);
    socket.on('appointment_cancelled', handleAppointmentCancelled);
    socket.on('appointment_rescheduled', (data) => {
      const notification = {
        id: `notif_${Date.now()}_${Math.random()}`,
        type: 'appointment_rescheduled',
        title: t.appointmentRescheduled,
        message: `${data.patientName} - ${data.oldTime} → ${data.newTime}`,
        data: data,
        read: false,
        createdAt: new Date().toISOString()
      };

      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      showBrowserNotification(notification);
    });

    // Handle batch processing progress
    const handleBatchProgress = (data) => {
      console.log('📊 NotificationCenter received batch_progress event:', data);

      // Batch polling is now continuous - no need to track active batches

      // Create or update progress notification
      const notificationId = `batch_progress_${data.batchId}`;
      const progressPercent = data.progress || data.percentComplete || 0;
      const documentsProcessed = data.documentsProcessed || 0;
      const totalDocuments = data.totalDocuments || 0;

      const notification = {
        id: notificationId,
        type: 'batch_progress',
        title: 'Processing Documents...',
        message: `${data.patientName || 'Patient'} - ${documentsProcessed}/${totalDocuments} documents (${progressPercent}%)`,
        data: data,
        read: true, // Progress notifications are auto-read
        createdAt: new Date().toISOString(),
        progress: progressPercent
      };

      setNotifications(prev => {
        // Replace existing progress notification or add new one
        const existing = prev.findIndex(n => n.id === notificationId);
        if (existing !== -1) {
          const updated = [...prev];
          updated[existing] = notification;
          return updated;
        }
        return [notification, ...prev].slice(0, 50);
      });
    };

    // Helper: check if a socket event is targeted at the current user
    // Uses userIdRef so it always reads the latest userId, even if the prop loaded after effect setup
    const isForMe = (data) => {
      const myId = userIdRef.current;
      if (!data?.targetUserIds) return true; // No targeting info → allow (legacy)
      if (!myId) return false; // Targeted notification but user not loaded yet → skip
      return data.targetUserIds.includes(myId);
    };

    // Handle batch processing completion
    const handleBatchComplete = (data) => {
      if (!isForMe(data)) return;
      console.log('📚 NotificationCenter received batch_complete event:', data);

      // Batch polling is now continuous - no need to track active batches

      // Remove progress notification for this batch
      const progressNotificationId = `batch_progress_${data.batchId}`;
      setNotifications(prev => prev.filter(n => n.id !== progressNotificationId));

      // Map the data fields correctly from backend
      const documentCount = data.documentsProcessed || data.successCount || data.fileCount || data.successful || 1;
      const patientName = data.patientName || 'Patient';

      // Include key findings if available
      let message = `✅ ${documentCount} document${documentCount !== 1 ? 's' : ''} analyzed for ${patientName}`;
      if (data.keyFindings && data.keyFindings.length > 0) {
        message += '\n📋 Key findings:';
        data.keyFindings.forEach(finding => {
          message += `\n• ${finding}`;
        });
      }

      const notification = {
        id: `notif_${Date.now()}_${Math.random()}`,
        type: 'batch_complete',
        title: t.batchComplete,
        message: message,
        data: data,
        read: false,
        createdAt: new Date().toISOString()
      };

      console.log('📝 Creating batch notification:', notification);

      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      showBrowserNotification(notification);
    };

    // Handle Phase 1 completion with Claude's reasoning
    const handlePhase1Complete = (data) => {
      if (!isForMe(data)) return;
      console.log('📝 NotificationCenter received phase1_complete event:', data);

      const notification = {
        id: `phase1_${data.batchId}_${Date.now()}`,
        type: 'phase1_complete',
        title: '📝 Phase 1 Complete',
        message: `Selected ${data.selectedCollections?.length || 0} collections for ${data.patientName || 'Patient'}\n\n${data.reasoning?.substring(0, 200) || ''}...`,
        data: data,
        read: false,
        createdAt: new Date().toISOString(),
        reasoning: data.reasoning,
        selectedCollections: data.selectedCollections
      };

      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      showBrowserNotification(notification);
    };

    // Handle Phase 2 completion - document analysis finished
    const handlePhase2Complete = (data) => {
      if (!isForMe(data)) return;
      console.log('✅ NotificationCenter received phase2_complete event:', data);

      const notification = {
        id: `phase2_${data.batchId}_${Date.now()}`,
        type: 'phase2_complete',
        title: '✅ Document Analysis Complete',
        message: `Medical data extracted for ${data.patientName || 'Patient'}. ${data.selectedCollections?.length || 0} data categories saved.`,
        data: data,
        read: false,
        createdAt: new Date().toISOString(),
        selectedCollections: data.selectedCollections
      };

      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      showBrowserNotification(notification);
    };

    // Handle batch processing start - immediate notification
    const handleBatchStarted = (data) => {
      if (!isForMe(data)) return;
      console.log('🚀 NotificationCenter received batch_started event:', data);

      const notification = {
        id: `batch_started_${data.batchId}`,
        type: 'batch_started',
        title: '📤 Processing Started',
        message: `Processing ${data.documentCount} document(s)...`,
        data: data,
        read: true, // Auto-read as it's informational
        createdAt: new Date().toISOString(),
        showProgressBar: true,
        progress: 0
      };

      setNotifications(prev => [notification, ...prev].slice(0, 50));
    };

    // Handle permission request notifications
    const handlePermissionRequest = (data) => {
      if (!isForMe(data)) return;
      console.log('🔐 NotificationCenter received permission_request event:', data);
      // A request can be for a permission or for a role upgrade (requestType === 'role').
      const isRoleReq = data.requestType === 'role';
      const requesterRoleLabel = data.requesterRole ? roleLabel(data.requesterRole, language) : '';
      // Surface the requester's current role next to their name in the message.
      let message = data.message || '';
      if (requesterRoleLabel && data.requesterName && message.includes(data.requesterName)) {
        message = message.replace(data.requesterName, `${data.requesterName} (${requesterRoleLabel})`);
      }
      const notification = {
        id: data._id || `perm_req_${Date.now()}_${Math.random()}`,
        type: 'permission_request',
        title: isRoleReq ? t.roleRequest : t.permissionRequest,
        message,
        data: data,
        read: false,
        createdAt: data.createdAt || new Date().toISOString()
      };
      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      showBrowserNotification(notification);
    };

    // Handle permission approved notifications
    const handlePermissionApproved = (data) => {
      if (!isForMe(data)) return;
      console.log('✅ NotificationCenter received permission_approved event:', data);
      const notification = {
        id: data._id || `perm_appr_${Date.now()}_${Math.random()}`,
        type: 'permission_approved',
        title: t.permissionApproved,
        message: data.message,
        data: data,
        read: false,
        createdAt: data.createdAt || new Date().toISOString()
      };
      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      showBrowserNotification(notification);
    };

    // Listen for batch events via WebSocket
    if (socket) {
      console.log('🔌 NotificationCenter: Setting up batch listeners on socket');
      socket.on('batch_progress', handleBatchProgress);
      socket.on('batch_complete', handleBatchComplete);
      socket.on('phase1_complete', handlePhase1Complete);
      socket.on('phase2_complete', handlePhase2Complete);  // NEW: Phase 2 completion
      socket.on('batch_started', handleBatchStarted);
      socket.on('permission_request', handlePermissionRequest);
      socket.on('permission_approved', handlePermissionApproved);
    } else {
      console.warn('⚠️ NotificationCenter: No socket available for batch events');
    }

    return () => {
      if (socket) {
        socket.off('new_appointment', handleNewAppointment);
        socket.off('appointment_cancelled', handleAppointmentCancelled);
        socket.off('appointment_rescheduled');
        socket.off('batch_progress', handleBatchProgress);
        socket.off('batch_complete', handleBatchComplete);
        socket.off('phase1_complete', handlePhase1Complete);
        socket.off('phase2_complete', handlePhase2Complete);
        socket.off('batch_started', handleBatchStarted);
        socket.off('permission_request', handlePermissionRequest);
        socket.off('permission_approved', handlePermissionApproved);
        console.log('🔌 NotificationCenter: Cleaned up socket listeners');
      }
    };
  }, [socket, t]);
  
  // SSE for real-time batch progress updates
  const sseRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const [isSSEConnected, setIsSSEConnected] = useState(false);
  const [isPollingActive, setIsPollingActive] = useState(false);

  // Function to poll batch progress
  const pollBatchProgress = async () => {
    try {
      const result = await secureApi.get('/api/agent/batch-progress');

      if (result && result.success) {
        // Check if we have active batches
        const hasActiveBatches = result.hasActiveBatches || (result.data && result.data.length > 0);

        if (hasActiveBatches) {
          console.log('📊 Active batches found, continuing polling');
        }

        if (result.data && result.data.length > 0) {
          // Filter to only show the most recent/relevant batch
          // Prefer msgbatch over preparing batches
          const activeBatches = result.data.filter(b => b.status === 'processing');
          const msgBatches = activeBatches.filter(b => b.batchId && b.batchId.startsWith('msgbatch_'));
          const batchesToShow = msgBatches.length > 0 ? msgBatches : activeBatches.slice(0, 1);

          // Process each batch progress record
          batchesToShow.forEach(progressData => {
            console.log('📊 Batch progress from DB:', progressData);

            // Create or update progress notification
            const notificationId = `batch_progress_${progressData.batchId}`;
            const progressPercent = Math.round(progressData.progress || 0);
            const documentsProcessed = progressData.documentsProcessed || 0;
            const totalDocuments = progressData.totalDocuments || 0;

            // Build a clearer message
            let displayMessage = '';
            if (progressPercent > 0) {
              displayMessage = `Processing: ${documentsProcessed}/${totalDocuments} documents (${progressPercent}% complete)`;
            } else if (totalDocuments > 0) {
              displayMessage = `Starting to process ${totalDocuments} document${totalDocuments !== 1 ? 's' : ''}...`;
            } else {
              displayMessage = progressData.message || 'Processing documents...';
            }

            const notification = {
              id: notificationId,
              type: 'batch_progress',
              title: t.processingDocuments || 'Processing Documents',
              message: displayMessage,
              data: progressData,
              read: true, // Progress notifications are auto-read
              createdAt: new Date().toISOString(),
              progress: progressPercent,
              showProgressBar: true
            };

            setNotifications(prev => {
              // Remove any preparing notifications if this is a msgbatch
              let filtered = prev;
              if (progressData.batchId && progressData.batchId.startsWith('msgbatch_')) {
                filtered = prev.filter(n => !n.id || !n.id.includes('preparing_'));
              }

              // Replace existing progress notification or add new one
              const existing = filtered.findIndex(n => n.id === notificationId);
              if (existing !== -1) {
                const updated = [...filtered];
                updated[existing] = notification;
                return updated;
              }
              return [notification, ...filtered].slice(0, 50);
            });

            // If batch is completed, remove the progress notification
            if (progressData.status === 'completed' || progressData.status === 'failed') {
              // Remove progress notification after a short delay
              setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notificationId));
              }, 2000);
            }
          });
        }
      }
    } catch (error) {
      // Silently ignore errors to avoid console spam
      // Only log if it's not a 500 error (which means no batches)
      if (error.status !== 500) {
        console.error('Error polling batch progress:', error);
      }
    }
  };


  // Setup SSE for real-time batch progress
  useEffect(() => {
    console.log('📊 Starting batch progress monitoring with SSE...');
    let reconnectTimeout = null;
    let reconnectAttempts = 0;

    const setupSSE = () => {
      try {
        console.log('📡 Attempting SSE connection for real-time progress...');

        // Get practice subdomain to include in SSE URL
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        let practiceSubdomain = null;

        // Check if we have a subdomain
        if (parts.length >= 3 || (parts.length >= 2 && parts[1] === 'localhost')) {
          const subdomain = parts[0];
          if (!['www', 'api', 'admin', 'app'].includes(subdomain)) {
            practiceSubdomain = subdomain;
          }
        }

        // Fallback to localStorage
        if (!practiceSubdomain) {
          practiceSubdomain = localStorage.getItem('practiceSubdomain');
        }

        // Build SSE URL with practice parameter
        // CRITICAL: Use same origin to ensure cookies are sent
        const sseUrl = practiceSubdomain
          ? `/api/agent/batch-progress-stream?practice=${practiceSubdomain}`
          : `/api/agent/batch-progress-stream`;

        const eventSource = new EventSource(sseUrl, {
          withCredentials: true
        });

        sseRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('✅ SSE real-time connection established!');
          setIsSSEConnected(true);
          reconnectAttempts = 0;

          // Stop polling if running
          if (pollingIntervalRef.current) {
            console.log('🔄 Stopping polling, using real-time SSE');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setIsPollingActive(false);
          }
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'connected') {
              console.log('📡 SSE ready:', data.message);
              return;
            }

            // Real-time batch progress update
            if (data.batchId && data.progress !== undefined) {
              console.log(`⚡ Real-time: Batch ${data.batchId} - ${data.progress}% - ${data.message}`);

              const notificationId = `batch_progress_${data.batchId}`;
              const progressPercent = Math.round(data.progress || 0);
              const documentsProcessed = data.documentsProcessed || 0;
              const totalDocuments = data.totalDocuments || 0;

              // Build a clearer message with progress
              let displayMessage = data.message || '';

              // Show different messages based on batch type and progress
              if (data.batchId.startsWith('preparing_')) {
                displayMessage = `Preparing ${totalDocuments} document${totalDocuments !== 1 ? 's' : ''} for analysis...`;
              } else if (progressPercent > 0) {
                displayMessage = `Processing: ${documentsProcessed}/${totalDocuments} documents (${progressPercent}% complete)`;
              } else if (data.status === 'processing' && totalDocuments > 0) {
                // Batch submitted but not yet started processing
                displayMessage = `Submitted ${totalDocuments} document${totalDocuments !== 1 ? 's' : ''} to Claude for processing...`;
              } else {
                displayMessage = data.message || 'Processing documents...';
              }

              const progressNotification = {
                id: notificationId,
                type: 'batch_progress',
                title: t.processingDocuments || 'Processing Documents',
                message: displayMessage,
                progress: progressPercent,
                documentsProcessed,
                totalDocuments,
                status: data.status,
                data: data,
                read: true,
                showProgressBar: true, // Ensure progress bar is shown
                createdAt: data.updatedAt || new Date().toISOString()
              };

              setNotifications(prev => {
                // Skip preparing batches if we have a msgbatch already
                if (data.batchId.startsWith('preparing_')) {
                  const hasMsgBatch = prev.some(n =>
                    n.id && n.id.includes('msgbatch_')
                  );
                  if (hasMsgBatch) {
                    console.log('⏭️ Skipping preparing notification - msgbatch already exists');
                    return prev; // Skip this preparing notification
                  }
                }

                // Remove any existing notification for this batch
                let filtered = prev.filter(n => n.id !== notificationId);

                // Also remove any "preparing" notifications if this is a msgbatch
                if (data.batchId.startsWith('msgbatch_')) {
                  const preparingNotifications = prev.filter(n => n.id && n.id.includes('preparing_'));
                  if (preparingNotifications.length > 0) {
                    console.log('🔄 Replacing preparing notification(s) with msgbatch');
                    filtered = filtered.filter(n => !n.id || !n.id.includes('preparing_'));
                  }
                }

                const cleanedNotifications = filtered;

                // Remove on completion/failure
                if (data.status === 'completed' || data.status === 'failed') {
                  setTimeout(() => {
                    setNotifications(p => p.filter(n => n.id !== notificationId));
                  }, 3000);
                  return cleanedNotifications;
                }

                // Add/update progress notification at top
                return [progressNotification, ...filtered].slice(0, 50);
              });
            }
          } catch (error) {
            console.error('SSE message error:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.warn('🔴 SSE disconnected, will retry or fallback');
          setIsSSEConnected(false);
          eventSource.close();
          sseRef.current = null;

          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

          if (reconnectAttempts >= 3) {
            console.log('🔄 SSE unavailable, using polling fallback');
            startPollingFallback();
          } else {
            console.log(`🔄 Reconnecting SSE in ${delay}ms`);
            reconnectTimeout = setTimeout(setupSSE, delay);
          }
        };

      } catch (error) {
        console.error('SSE setup failed:', error);
        startPollingFallback();
      }
    };

    const startPollingFallback = () => {
      if (!pollingIntervalRef.current && !isPollingActive) {
        console.log('📊 Using polling fallback (5s interval)');
        setIsPollingActive(true);
        pollBatchProgress();
        pollingIntervalRef.current = setInterval(pollBatchProgress, 5000);
      }
    };

    // Start with SSE
    setupSSE();

    // Cleanup
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (sseRef.current) {
        console.log('📡 Closing SSE');
        sseRef.current.close();
        sseRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsSSEConnected(false);
      setIsPollingActive(false);
    };
  }, [t]); // Depend on t for translations

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
  
  // Show browser notification
  const showBrowserNotification = (notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: false
      });
    }
  };
  
  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) return t.justNow;
    if (diffMinutes < 60) return t.minutesAgo.replace('{minutes}', diffMinutes);
    if (diffHours < 24) return t.hoursAgo.replace('{hours}', diffHours);
    if (diffDays === 1) return t.yesterday;
    return t.daysAgo.replace('{days}', diffDays);
  };
  
  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      // Update local state immediately for better UX
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Persist to database
      await secureApi.put(`/api/notifications/${notificationId}/read`);
      console.log('✅ Notification marked as read:', notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Revert local state on error
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
      );
      setUnreadCount(prev => prev + 1);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      // Capture previous state for rollback
      const previousNotifications = [...notifications];
      const previousUnreadCount = unreadCount;

      // Update local state immediately
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);

      // Persist to database
      await secureApi.put('/api/notifications/read-all');
      console.log('✅ All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      // Revert on error
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    }
  };
  
  // Get notification icon
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_appointment':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        );
      case 'appointment_cancelled':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        );
      case 'appointment_rescheduled':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        );
      case 'appointment_reminder':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        );
      case 'batch_complete':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <polyline points="9 11 12 14 16 10"/>
          </svg>
        );
      case 'batch_progress':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <circle cx="12" cy="12" r="3">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="2s" repeatCount="indefinite"/>
            </circle>
          </svg>
        );
      case 'permission_request':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        );
      case 'permission_approved':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            <polyline points="9 16 11 18 15 14"/>
          </svg>
        );
      case 'permission_denied':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            <line x1="9" y1="15" x2="15" y2="19"/>
            <line x1="15" y1="15" x2="9" y2="19"/>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c1.1 0 2 .9 2 2H2c0-1.1.9-2 2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22 6 12 13 2 6"/>
          </svg>
        );
    }
  };
  
  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });
  
  const styles = {
    container: {
      padding: '0',
      direction: isRTL ? 'rtl' : 'ltr',
      backgroundColor: 'transparent'
    },
    
    header: {
      display: 'none'  // Hide header since we use accordion title
    },
    
    title: {
      display: 'none'  // Hide title since we use accordion title
    },
    
    badge: {
      backgroundColor: '#dc3545',
      color: 'white',
      borderRadius: '12px',
      padding: '2px 8px',
      fontSize: '12px',
      fontWeight: 'bold'
    },
    
    filterTabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '12px'
    },
    
    filterTab: {
      padding: '6px 12px',
      borderRadius: '20px',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#1e2129',
      backgroundColor: '#363a46',
      color: '#a0a0b0',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.2s'
    },
    
    activeTab: {
      backgroundColor: '#007bff',
      color: 'white',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#007bff'
    },
    
    markAllButton: {
      fontSize: '12px',
      color: '#4dabf7',
      cursor: 'pointer',
      textDecoration: 'underline'
    },
    
    notificationItem: {
      backgroundColor: '#363a46',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#1e2129',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      position: 'relative'
    },
    
    unreadNotification: {
      backgroundColor: '#2c3e50',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#34495e'
    },
    
    notificationHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '4px'
    },
    
    notificationTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      fontWeight: '600',
      color: '#ffffff'
    },
    
    notificationTime: {
      fontSize: '12px',
      color: '#a0a0b0'
    },
    
    notificationMessage: {
      fontSize: '14px',
      color: '#d0d0e0',
      marginTop: '4px'
    },
    
    unreadDot: {
      position: 'absolute',
      top: '12px',
      [isRTL ? 'left' : 'right']: '12px',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: '#4dabf7'
    },
    
    noNotifications: {
      textAlign: 'center',
      padding: '32px',
      color: '#a0a0b0',
      fontSize: '14px'
    },

    reviewButton: {
      marginTop: '8px',
      padding: '6px 16px',
      backgroundColor: '#fbbf24',
      color: '#000',
      border: 'none',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    reviewButtonSending: {
      marginTop: '8px',
      padding: '6px 16px',
      backgroundColor: '#22c55e',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'default',
      opacity: 0.9,
      transition: 'all 0.2s'
    }
  };
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          {t.title}
          {unreadCount > 0 && (
            <span style={styles.badge}>{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <span 
            style={styles.markAllButton}
            onClick={markAllAsRead}
          >
            {t.markAllAsRead}
          </span>
        )}
      </div>
      
      <div style={styles.filterTabs}>
        {['all', 'unread'].map(tab => (
          <div
            key={tab}
            style={{
              ...styles.filterTab,
              ...(filter === tab ? styles.activeTab : {})
            }}
            onClick={() => setFilter(tab)}
          >
            {t[tab]}
          </div>
        ))}
      </div>
      
      {filteredNotifications.length === 0 ? (
        <div style={styles.noNotifications}>{t.noNotifications}</div>
      ) : (
        filteredNotifications.map(notification => (
          <div
            key={notification.id}
            style={{
              ...styles.notificationItem,
              ...(notification.read ? {} : styles.unreadNotification)
            }}
            onClick={() => !notification.read && markAsRead(notification.id)}
          >
            {!notification.read && <div style={styles.unreadDot} />}
            
            <div style={styles.notificationHeader}>
              <div style={styles.notificationTitle}>
                <span>{getNotificationIcon(notification.type)}</span>
                <span>{notification.title}</span>
              </div>
              <div style={styles.notificationTime}>
                {formatTimeAgo(notification.createdAt)}
              </div>
            </div>
            
            <div style={styles.notificationMessage}>
              {notification.message}
            </div>

            {/* Review button for permission_request notifications */}
            {notification.type === 'permission_request' && onSendMessage && (
              <button
                style={reviewSending === notification.id ? styles.reviewButtonSending : styles.reviewButton}
                disabled={reviewSending === notification.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setReviewSending(notification.id);
                  const data = notification.data || {};
                  const requesterName = data.requesterName || data.requesterEmail || 'Unknown';
                  const isRoleReq = data.requestType === 'role';
                  const requesterRoleLabel = data.requesterRole ? roleLabel(data.requesterRole, language) : '';
                  const requesterWithRole = requesterRoleLabel ? `${requesterName} (${requesterRoleLabel})` : requesterName;
                  const permLabel = (data.permission || '').replace(/[_:]/g, ' ');
                  const requestedRoleLabel = data.requestedRole ? roleLabel(data.requestedRole, language) : '';
                  // Full message for the agent
                  const agentMsg = isRoleReq
                    ? `Review role request: ${data.requesterEmail || requesterName} (current role: ${requesterRoleLabel || 'unknown'}) is requesting the '${requestedRoleLabel}' role. Reason: ${data.message || notification.message}. Request ID: ${data.requestId || notification.id}. Should I approve or deny this request?`
                    : `Review permission request: ${data.requesterEmail || requesterName} (role: ${requesterRoleLabel || 'unknown'}) is requesting '${permLabel}' permission. Reason: ${data.message || notification.message}. Request ID: ${data.requestId || notification.id}. Should I approve or deny this request?`;
                  // Short display message for the chat bubble
                  const displayMsg = isRoleReq
                    ? (isRTL
                        ? `סקור בקשת תפקיד מ-${requesterWithRole} עבור תפקיד '${requestedRoleLabel}'`
                        : `Review role request from ${requesterWithRole} for the '${requestedRoleLabel}' role`)
                    : (isRTL
                        ? `סקור בקשת הרשאה מ-${requesterWithRole} עבור '${permLabel}'`
                        : `Review permission request from ${requesterWithRole} for '${permLabel}'`);
                  onSendMessage(agentMsg, displayMsg);
                  if (!notification.read) markAsRead(notification.id);
                  // Reset after 5 seconds
                  setTimeout(() => setReviewSending(null), 5000);
                }}
                onMouseEnter={(e) => {
                  if (reviewSending !== notification.id) {
                    e.currentTarget.style.backgroundColor = '#f59e0b';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (reviewSending !== notification.id) {
                    e.currentTarget.style.backgroundColor = '#fbbf24';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                {reviewSending === notification.id
                  ? (isRTL ? '✓ נשלח לצ׳אט' : '✓ Sent to chat')
                  : t.reviewRequest}
              </button>
            )}

            {/* Progress bar for batch_progress notifications */}
            {notification.type === 'batch_progress' && notification.progress !== undefined && (
              <div style={{
                marginTop: '8px',
                height: '6px',
                backgroundColor: '#1e2129',
                borderRadius: '3px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(notification.progress, 2)}%`, // Minimum 2% width for visibility
                  backgroundColor: notification.progress === 0 ? '#6c757d' : '#4dabf7', // Gray when starting
                  transition: 'width 0.3s ease, background-color 0.3s ease',
                  borderRadius: '3px',
                  position: 'absolute',
                  left: 0,
                  top: 0
                }}/>
                {/* Show percentage text on the bar if progress > 0 */}
                {notification.progress > 0 && (
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    textShadow: '0 0 2px rgba(0,0,0,0.5)',
                    pointerEvents: 'none'
                  }}>
                    {notification.progress}%
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default NotificationCenter;