import React from 'react';

interface DashboardCardProps {
  title: string;
  icon?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ 
  title, 
  icon, 
  subtitle,
  children, 
  className = '',
  fullWidth = false,
  disabled = false
}) => {
  return (
    <div className={`dashboard-card ${fullWidth ? 'full-width' : ''} ${disabled ? 'card-disabled' : ''} ${className}`}>
      <div className="card-header">
        {icon && <span className="card-icon" dangerouslySetInnerHTML={{ __html: icon }} />}
        <div className="card-title-group">
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};
