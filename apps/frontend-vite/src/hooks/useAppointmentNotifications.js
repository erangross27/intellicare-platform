import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isClinicalRole, canonicalRole } from '../config/roleConfig';

export const useAppointmentNotifications = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const socketRef = useRef(null);
  const { user, practice } = useAuth();

  // Ref for user ID — keeps socket listeners current even when user loads after socket setup
  // Note: session-check returns "id" (not "_id"), so check both
  const userIdRef = useRef(user?._id ? String(user._id) : user?.id ? String(user.id) : null);
  useEffect(() => {
    userIdRef.current = user?._id ? String(user._id) : user?.id ? String(user.id) : null;
  }, [user]);
  
  useEffect(() => {
    // Only connect if user is authenticated and is a doctor/provider
    if (!user || !user._id) return;
    
    // Clinical staff (doctor/nurse) get provider-style appointment notifications.
    const isDoctorOrProvider = user.roles && user.roles.some(isClinicalRole);

    // Admins and basic users (front-desk) get the staff appointment feed.
    const isFrontDesk = user.roles && (
      isAdmin(user.roles) || user.roles.some((r) => canonicalRole(r) === 'user')
    );

    if (!isDoctorOrProvider && !isFrontDesk) return;
    
    // Create socket connection
    const newSocket = io('/', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = newSocket;
    
    // Connection handlers
    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      setConnected(true);

      // Join session room for batch notifications
      let sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        sessionId = `session_${Date.now()}`;
        localStorage.setItem('sessionId', sessionId);
      }
      newSocket.emit('join_session', sessionId);
      console.log(`📱 Joined session room: ${sessionId}`);

      // Subscribe to appropriate channels
      if (isDoctorOrProvider) {
        const doctorId = user.providerInfo?.providerId || user._id;
        newSocket.emit('doctor_online', doctorId);
        console.log(`👨‍⚕️ Subscribed to doctor notifications: ${doctorId}`);
        console.log('👨‍⚕️ User object:', user);
        console.log('👨‍⚕️ Provider info:', user.providerInfo);
      }

      if (isSecretary || isDoctorOrProvider) {
        // Try multiple sources for practice subdomain
        let practiceId = practice?.subdomain || practice?.id || user.practiceId;

        // Fallback: get from localStorage (set on login)
        if (!practiceId) {
          practiceId = localStorage.getItem('practiceSubdomain');
        }

        // Fallback: extract from hostname (e.g., yale.localhost → yale)
        if (!practiceId) {
          const hostname = window.location.hostname;
          const parts = hostname.split('.');
          if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'api') {
            practiceId = parts[0];
          }
        }

        if (practiceId) {
          newSocket.emit('subscribe_practice', practiceId);
          console.log(`🏥 Subscribed to practice notifications: ${practiceId}`);
        } else {
          console.warn('⚠️ Could not determine practiceId for socket subscription');
        }
      }
    });
    
    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
      setConnected(false);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });
    
    // Appointment event handlers
    newSocket.on('new_appointment', (data) => {
      console.log('📅 New appointment notification:', data);
      
      // Add to notifications
      const notification = {
        id: `notif_${Date.now()}`,
        type: 'new_appointment',
        data: data,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      setNotifications(prev => [notification, ...prev]);
      
      // Show toast notification
      showToastNotification('New Appointment', 
        `${data.patientName} - ${data.scheduledTime}`);
      
      // Play notification sound if enabled
      playNotificationSound();
    });
    
    newSocket.on('appointment_created', (data) => {
      console.log('🏥 Practice appointment created:', data);
      
      // Refresh appointments list if this is for the current provider
      if (isDoctorOrProvider && 
          (data.providerId === user.providerInfo?.providerId || 
           data.providerId === user._id)) {
        // Trigger appointment list refresh
        setAppointments(prev => [...prev, data]);
      }
    });
    
    newSocket.on('appointment_cancelled', (data) => {
      console.log('❌ Appointment cancelled:', data);
      
      const notification = {
        id: `notif_${Date.now()}`,
        type: 'appointment_cancelled',
        data: data,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      setNotifications(prev => [notification, ...prev]);
      showToastNotification('Appointment Cancelled', 
        `${data.patientName} - ${data.scheduledTime}`);
    });
    
    newSocket.on('appointment_rescheduled', (data) => {
      console.log('🔄 Appointment rescheduled:', data);

      const notification = {
        id: `notif_${Date.now()}`,
        type: 'appointment_rescheduled',
        data: data,
        timestamp: new Date().toISOString(),
        read: false
      };

      setNotifications(prev => [notification, ...prev]);
      showToastNotification('Appointment Rescheduled',
        `${data.patientName} - New time: ${data.newTime}`);
    });

    // Batch processing event handlers
    // Note: batch_progress is now handled via database polling in NotificationCenter
    // Only batch_complete events still use WebSocket for instant notification
    newSocket.on('batch_complete', (data) => {
      console.log('📚 Socket received batch_complete event:', data);
      // The NotificationCenter will handle display
    });

    // Permission request events — track in unreadCount for badge
    // Use userIdRef (not closure variable) so the check always uses the latest user ID
    newSocket.on('permission_request', (data) => {
      const myId = userIdRef.current;
      if (data?.targetUserIds && myId && !data.targetUserIds.includes(myId)) {
        return; // Not targeted at this user
      }
      if (!myId) return; // User not loaded yet — skip
      console.log('🔐 Socket received permission_request event (for me):', data);
      const notification = {
        id: `perm_req_${Date.now()}`,
        type: 'permission_request',
        data: data,
        timestamp: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [notification, ...prev]);
    });

    newSocket.on('permission_approved', (data) => {
      const myId = userIdRef.current;
      if (data?.targetUserIds && myId && !data.targetUserIds.includes(myId)) {
        return; // Not targeted at this user
      }
      if (!myId) return; // User not loaded yet — skip
      console.log('✅ Socket received permission_approved event (for me):', data);
      const notification = {
        id: `perm_appr_${Date.now()}`,
        type: 'permission_approved',
        data: data,
        timestamp: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [notification, ...prev]);
    });

    setSocket(newSocket);
    
    // Cleanup on unmount
    return () => {
      if (isDoctorOrProvider) {
        const doctorId = user.providerInfo?.providerId || user._id;
        newSocket.emit('doctor_offline', doctorId);
      }
      newSocket.close();
      socketRef.current = null;
    };
  }, [user, practice]);
  
  // Show toast notification
  const showToastNotification = (title, message) => {
    // Check if browser notifications are enabled
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: 'appointment-notification',
        requireInteraction: false
      });
    }
    
    // Also show in-app toast
    // This would integrate with your existing toast system
    const event = new CustomEvent('showToast', {
      detail: {
        title,
        message,
        type: 'info',
        duration: 5000
      }
    });
    window.dispatchEvent(event);
  };
  
  // Play notification sound
  const playNotificationSound = () => {
    try {
      // Check if sound is enabled in user preferences
      const soundEnabled = localStorage.getItem('notificationSound') !== 'false';
      if (!soundEnabled) return;
      
      // Create and play audio
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Could not play notification sound:', e));
    } catch (e) {
      console.log('Notification sound error:', e);
    }
  };
  
  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  };
  
  // Mark notification as read
  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };
  
  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };
  
  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;
  
  return {
    socket,
    connected,
    notifications,
    unreadCount,
    appointments,
    markNotificationAsRead,
    clearNotifications,
    requestNotificationPermission
  };
};