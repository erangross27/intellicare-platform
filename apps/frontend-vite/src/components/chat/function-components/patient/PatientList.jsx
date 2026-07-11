import React, { useState } from 'react';

const PatientList = ({ data, config, language = 'he', onAction }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [filterText, setFilterText] = useState('');
  
  // Ensure patients is always an array
  let patients = [];
  if (Array.isArray(data)) {
    patients = data;
  } else if (Array.isArray(data?.patients)) {
    patients = data.patients;
  } else if (Array.isArray(data?.results)) {
    patients = data.results;
  } else if (Array.isArray(data?.data)) {
    patients = data.data;
  }
  
  const isRTL = language === 'he';
  
  const labels = {
    he: {
      title: 'תוצאות חיפוש מטופלים',
      found: 'נמצאו',
      patients: 'מטופלים',
      name: 'שם',
      id: 'ת.ז.',
      age: 'גיל',
      phone: 'טלפון',
      lastVisit: 'ביקור אחרון',
      actions: 'פעולות',
      select: 'בחר',
      view: 'צפייה',
      edit: 'עריכה',
      noResults: 'לא נמצאו מטופלים',
      filter: 'סנן תוצאות...',
      years: 'שנים'
    },
    en: {
      title: 'Patient Search Results',
      found: 'Found',
      patients: 'patients',
      name: 'Name',
      id: 'ID',
      age: 'Age',
      phone: 'Phone',
      lastVisit: 'Last Visit',
      actions: 'Actions',
      select: 'Select',
      view: 'View',
      edit: 'Edit',
      noResults: 'No patients found',
      filter: 'Filter results...',
      years: 'years'
    }
  };
  
  const t = labels[language] || labels.en;
  
  // Calculate age
  const calculateAge = (birthDate) => {
    if (!birthDate) return '-';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US');
  };
  
  // Filter patients
  const filteredPatients = patients.filter(patient => {
    if (!filterText) return true;
    const searchText = filterText.toLowerCase();
    return (
      (patient.firstName && patient.firstName.toLowerCase().includes(searchText)) ||
      (patient.lastName && patient.lastName.toLowerCase().includes(searchText)) ||
      (patient.nationalId && patient.nationalId.includes(searchText)) ||
      (patient.phone && patient.phone.includes(searchText))
    );
  });
  
  // Sort patients
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      case 'age':
        return (b.birthDate || '').localeCompare(a.birthDate || '');
      case 'lastVisit':
        return (b.lastVisit || '').localeCompare(a.lastVisit || '');
      default:
        return 0;
    }
  });
  
  if (patients.length === 0) {
    return (
      <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={styles.noResults}>
          <span style={styles.noResultsIcon}>🔍</span>
          <p>{t.noResults}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ ...styles.container, direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <span style={styles.count}>
            {t.found} <strong>{filteredPatients.length}</strong> {t.patients}
          </span>
        </div>
        <input
          type="text"
          placeholder={t.filter}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={styles.filterInput}
        />
      </div>
      
      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.th} onClick={() => setSortBy('name')}>
                {t.name} {sortBy === 'name' && '↓'}
              </th>
              <th style={styles.th}>{t.id}</th>
              <th style={styles.th} onClick={() => setSortBy('age')}>
                {t.age} {sortBy === 'age' && '↓'}
              </th>
              <th style={styles.th}>{t.phone}</th>
              <th style={styles.th} onClick={() => setSortBy('lastVisit')}>
                {t.lastVisit} {sortBy === 'lastVisit' && '↓'}
              </th>
              <th style={styles.th}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPatients.map((patient, index) => (
              <tr 
                key={patient._id || patient.id || index}
                style={{
                  ...styles.row,
                  ...(selectedPatient === patient._id && styles.selectedRow)
                }}
                onClick={() => setSelectedPatient(patient._id || patient.id)}
              >
                <td style={styles.td}>
                  <div style={styles.nameCell}>
                    <div style={styles.avatar}>
                      {patient.firstName?.[0]}{patient.lastName?.[0]}
                    </div>
                    <div>
                      <div style={styles.patientName}>
                        {patient.firstName} {patient.lastName}
                      </div>
                      {patient.email && (
                        <div style={styles.patientEmail}>{patient.email}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={styles.td}>{patient.nationalId || patient.id || '-'}</td>
                <td style={styles.td}>
                  {patient.birthDate ? `${calculateAge(patient.birthDate)} ${t.years}` : '-'}
                </td>
                <td style={styles.td}>{patient.phone || '-'}</td>
                <td style={styles.td}>{formatDate(patient.lastVisit)}</td>
                <td style={styles.td}>
                  <div style={styles.actions}>
                    <button
                      style={styles.actionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction('select', patient);
                      }}
                    >
                      {t.select}
                    </button>
                    <button
                      style={styles.actionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction('view', patient);
                      }}
                    >
                      {t.view}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    color: '#e3e3e8'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    gap: '16px'
  },
  
  headerInfo: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  
  count: {
    fontSize: '14px'
  },
  
  filterInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#e3e3e8',
    fontSize: '13px',
    minWidth: '200px',
    outline: 'none'
  },
  
  tableContainer: {
    overflowX: 'auto',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  
  headerRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  
  th: {
    padding: '12px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '600',
    color: '#10b981',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    userSelect: 'none'
  },
  
  row: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  
  selectedRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)'
  },
  
  td: {
    padding: '12px',
    fontSize: '13px',
    color: '#e3e3e8'
  },
  
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#10b981',
    flexShrink: 0
  },
  
  patientName: {
    fontWeight: '500',
    marginBottom: '2px'
  },
  
  patientEmail: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  actions: {
    display: 'flex',
    gap: '6px'
  },
  
  actionBtn: {
    padding: '4px 8px',
    fontSize: '11px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    color: '#e3e3e8',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  
  noResults: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  
  noResultsIcon: {
    fontSize: '48px',
    opacity: 0.3,
    display: 'block',
    marginBottom: '16px'
  }
};

export default PatientList;