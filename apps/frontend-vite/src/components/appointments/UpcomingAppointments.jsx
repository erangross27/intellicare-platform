import React, { useState, useEffect } from 'react';
import secureApi from '../../services/secureApiClient';

const UpcomingAppointments = ({ 
  providerId, 
  language = 'en',
  socket = null,
  maxItems = 10
}) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isRTL = language === 'he';
  
  const labels = {
    en: {
      title: 'Upcoming Appointments',
      noAppointments: 'No upcoming appointments',
      patient: 'Patient',
      time: 'Time',
      type: 'Type',
      duration: 'Duration',
      minutes: 'min',
      room: 'Room',
      department: 'Dept',
      loading: 'Loading appointments...',
      error: 'Failed to load appointments',
      today: 'Today',
      tomorrow: 'Tomorrow',
      inMinutes: 'in {minutes} minutes',
      inHours: 'in {hours} hours'
    },
    he: {
      title: 'תורים קרובים',
      noAppointments: 'אין תורים קרובים',
      patient: 'מטופל',
      time: 'שעה',
      type: 'סוג',
      duration: 'משך',
      minutes: 'דק׳',
      room: 'חדר',
      department: 'מחלקה',
      loading: 'טוען תורים...',
      error: 'נכשל בטעינת תורים',
      today: 'היום',
      tomorrow: 'מחר',
      inMinutes: 'בעוד {minutes} דקות',
      inHours: 'בעוד {hours} שעות'
    }
  };
  
  const t = labels[language] || labels.en;
  
  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      setLoading(true);
      console.log('📅 Fetching appointments for provider:', providerId);
      const response = await secureApi.get('/api/appointments/provider/' + providerId, {
        params: {
          status: 'scheduled',
          fromDate: new Date().toISOString(),
          limit: maxItems
        }
      });
      console.log('📅 Appointments response:', response);

      // Handle different response formats
      let appointmentsData = [];

      if (Array.isArray(response)) {
        // Direct array response
        console.log('📅 Response is direct array of appointments');
        appointmentsData = response;
      } else if (response?.success && response?.data) {
        // Standard success response with data field
        console.log('📅 Setting appointments from data field:', response.data);
        appointmentsData = response.data;
      } else if (response?.success && response?.appointments) {
        // Alternative success response with appointments field
        console.log('📅 Setting appointments from appointments field:', response.appointments);
        appointmentsData = response.appointments;
      } else if (response?.data) {
        // Data field without success flag
        console.log('📅 Setting appointments from data field (no success flag)');
        appointmentsData = response.data;
      } else {
        console.log('⚠️ No appointments found in response');
      }

      console.log('📅 Setting', appointmentsData.length, 'appointments');
      setAppointments(appointmentsData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    if (providerId) {
      fetchAppointments();
    }
  }, [providerId]);
  
  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;
    
    const handleNewAppointment = (data) => {
      console.log('New appointment notification received:', data);
      // Refresh appointments list
      fetchAppointments();
    };
    
    const handleAppointmentUpdate = (data) => {
      console.log('Appointment update received:', data);
      // Refresh appointments list
      fetchAppointments();
    };
    
    socket.on('new_appointment', handleNewAppointment);
    socket.on('appointment_updated', handleAppointmentUpdate);
    socket.on('appointment_cancelled', handleAppointmentUpdate);
    
    return () => {
      socket.off('new_appointment', handleNewAppointment);
      socket.off('appointment_updated', handleAppointmentUpdate);
      socket.off('appointment_cancelled', handleAppointmentUpdate);
    };
  }, [socket]);
  
  // Format time until appointment
  const getTimeUntil = (appointmentDate, appointmentTime) => {
    const now = new Date();
    const aptDateTime = new Date(appointmentDate);
    const [hours, minutes] = appointmentTime.split(':');
    aptDateTime.setHours(parseInt(hours), parseInt(minutes));
    
    const diffMs = aptDateTime - now;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 0) return null; // Past appointment
    if (diffMinutes < 60) return t.inMinutes.replace('{minutes}', diffMinutes);
    if (diffHours < 24) return t.inHours.replace('{hours}', diffHours);
    if (diffDays === 0) return t.today;
    if (diffDays === 1) return t.tomorrow;
    return aptDateTime.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US');
  };
  
  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'routine': 
      default: return '#28a745';
    }
  };
  
  const styles = {
    container: {
      padding: '0',
      direction: isRTL ? 'rtl' : 'ltr',
      backgroundColor: 'transparent'
    },
    
    header: {
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '12px',
      color: '#ffffff',
      display: 'none'  // Hide header since we use accordion title
    },
    
    appointmentCard: {
      backgroundColor: '#2d3142',
      border: '1px solid #3a3f51',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    
    appointmentHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px'
    },
    
    patientName: {
      fontSize: '15px',
      fontWeight: '600',
      color: '#ffffff'
    },
    
    timeUntil: {
      fontSize: '12px',
      padding: '2px 8px',
      borderRadius: '12px',
      backgroundColor: '#007bff',
      color: 'white'
    },
    
    appointmentDetails: {
      display: 'flex',
      gap: '12px',
      fontSize: '13px',
      color: '#9ca3af'
    },
    
    detailItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    
    priorityIndicator: {
      width: '4px',
      position: 'absolute',
      left: isRTL ? 'auto' : 0,
      right: isRTL ? 0 : 'auto',
      top: 0,
      bottom: 0,
      borderRadius: isRTL ? '0 8px 8px 0' : '8px 0 0 8px'
    },
    
    noAppointments: {
      textAlign: 'center',
      padding: '32px',
      color: '#6c757d',
      fontSize: '14px'
    },
    
    loading: {
      textAlign: 'center',
      padding: '32px',
      color: '#6c757d'
    },
    
    error: {
      textAlign: 'center',
      padding: '16px',
      color: '#dc3545',
      backgroundColor: '#f8d7da',
      borderRadius: '4px',
      border: '1px solid #f5c6cb'
    }
  };
  
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>{t.title}</div>
        <div style={styles.loading}>{t.loading}</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>{t.title}</div>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }
  
  if (!appointments || appointments.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>{t.title}</div>
        <div style={styles.noAppointments}>{t.noAppointments}</div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>{t.title}</div>
      
      {appointments.map((appointment) => {
        const timeUntil = getTimeUntil(appointment.scheduledDate, appointment.scheduledTime);
        if (!timeUntil) return null; // Skip past appointments
        
        return (
          <div 
            key={appointment._id}
            style={{
              ...styles.appointmentCard,
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#363a46';
              e.currentTarget.style.borderColor = '#4a5264';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2d3142';
              e.currentTarget.style.borderColor = '#3a3f51';
            }}
          >
            <div 
              style={{
                ...styles.priorityIndicator,
                backgroundColor: getPriorityColor(appointment.priority)
              }}
            />
            
            <div style={styles.appointmentHeader}>
              <div style={styles.patientName}>{appointment.patientName}</div>
              <div style={styles.timeUntil}>{timeUntil}</div>
            </div>
            
            <div style={styles.appointmentDetails}>
              <div style={styles.detailItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span style={{marginLeft: '4px'}}>{appointment.scheduledTime}</span>
              </div>
              <div style={styles.detailItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <span style={{marginLeft: '4px'}}>{appointment.duration} {t.minutes}</span>
              </div>
              {appointment.room && (
                <div style={styles.detailItem}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span style={{marginLeft: '4px'}}>{t.room} {appointment.room}</span>
                </div>
              )}
              {appointment.department && (
                <div style={styles.detailItem}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  <span style={{marginLeft: '4px'}}>{appointment.department}</span>
                </div>
              )}
            </div>
            
            <div style={{
              fontSize: '12px',
              color: '#9ca3af',
              marginTop: '4px'
            }}>
              {appointment.appointmentType || 'Consultation'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UpcomingAppointments;