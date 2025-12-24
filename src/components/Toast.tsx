import React from 'react';
import { useToastStore } from '../stores/useToastStore';

export const Toast: React.FC = () => {
  const { message, isVisible } = useToastStore();
  
  if (!isVisible) return null;
  
  return (
    <div className="toast-container">
      <div className="toast">{message}</div>
    </div>
  );
};
