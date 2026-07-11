import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    process.env.NODE_ENV !== 'production' && console.error('Function component error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      const { language = 'he' } = this.props;
      
      return (
        <div style={styles.container}>
          <div style={styles.icon}>⚠️</div>
          <div style={styles.title}>
            {language === 'he' ? 'אירעה שגיאה' : 'An error occurred'}
          </div>
          <div style={styles.message}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            style={styles.button}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            {language === 'he' ? 'נסה שוב' : 'Try Again'}
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

const styles = {
  container: {
    padding: '20px',
    textAlign: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    margin: '12px 0'
  },
  
  icon: {
    fontSize: '32px',
    marginBottom: '8px'
  },
  
  title: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#ef4444',
    marginBottom: '8px'
  },
  
  message: {
    fontSize: '13px',
    color: '#fca5a5',
    marginBottom: '16px',
    fontFamily: 'monospace'
  },
  
  button: {
    padding: '8px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '4px',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s'
  }
};

export default ErrorBoundary;