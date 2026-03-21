import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldOff } from 'lucide-react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';

interface AdminAuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export const AdminAuthGuard: React.FC<AdminAuthGuardProps> = ({
  children,
  requiredPermission
}) => {
  const { isAuthenticated, isLoading, hasPermission } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
      }}>
        <div style={{
          textAlign: 'center',
          color: '#666',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e0e0e0',
            borderTopColor: '#1890ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1rem',
        padding: '2rem',
      }}>
        <ShieldOff size={48} style={{ color: '#ff4d4f' }} />
        <h2 style={{ color: '#262626', margin: 0 }}>
          {t('admin.noPermission', '403 - Access Denied')}
        </h2>
        <p style={{ color: '#8c8c8c', margin: 0, textAlign: 'center' }}>
          {t('admin.noPermissionDesc', 'You do not have permission to access this page. Please contact your administrator.')}
        </p>
        <button
          onClick={() => navigate('/admin')}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1.5rem',
            backgroundColor: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {t('admin.backToDashboard', 'Back to Dashboard')}
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminAuthGuard;
