import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext';

interface SupplierAuthGuardProps {
  children: React.ReactNode;
}

export const SupplierAuthGuard: React.FC<SupplierAuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useSupplierAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e5e5',
            borderTopColor: '#10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <style>
            {`@keyframes spin { to { transform: rotate(360deg); } }`}
          </style>
          <span style={{ color: '#666' }}>Loading...</span>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/supplier/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default SupplierAuthGuard;
