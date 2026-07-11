import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import secureStorage from '../utils/secureStorage';
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Consider presence of a token as authenticated during hydration/refresh
  const hasToken = Boolean(secureStorage.getItem('token') || secureStorage.getItem('token'));

  process.env.NODE_ENV !== 'production' && console.log('🛡️ PROTECTED ROUTE: Auth state check', {
    loading,
    hasUser: !!user,
    hasToken,
    userEmail: user?.email
  });

  // CRITICAL: Always wait for loading to complete before making auth decisions
  if (loading) {
    process.env.NODE_ENV !== 'production' && console.log('🔄 PROTECTED ROUTE: Still loading, showing spinner...');
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // After loading is complete, check authentication
  if (!user && hasToken) {
    // This should rarely happen now that we wait for loading to complete
    process.env.NODE_ENV !== 'production' && console.log('🔄 PROTECTED ROUTE: No user but has token after loading complete - this is unusual');
    process.env.NODE_ENV !== 'production' && console.log('🔄 PROTECTED ROUTE: Allowing render but this might indicate an auth issue');
    return children;
  }

  if (!user) {
    process.env.NODE_ENV !== 'production' && console.log('❌ PROTECTED ROUTE: No user and no token after loading complete, redirecting to login...');
    return <Navigate to="/login" replace />;
  }

  process.env.NODE_ENV !== 'production' && console.log('✅ PROTECTED ROUTE: User authenticated, rendering protected content...');
  return children;
};

export default ProtectedRoute;