import React from 'react';

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: React.ReactNode;
}

export const CyberButton: React.FC<CyberButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon,
  className = '',
  ...props 
}) => {
  const baseStyle = "relative px-6 py-3 font-cyber font-bold text-sm tracking-wider uppercase transition-all duration-300 clip-path-slant group";
  
  const variants = {
    primary: "bg-cyan-900/20 text-cyan-400 border border-cyan-500 hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_20px_rgba(34,211,238,0.6)]",
    secondary: "bg-fuchsia-900/20 text-fuchsia-400 border border-fuchsia-500 hover:bg-fuchsia-500 hover:text-black hover:shadow-[0_0_20px_rgba(232,121,249,0.6)]",
    danger: "bg-red-900/20 text-red-400 border border-red-500 hover:bg-red-500 hover:text-black hover:shadow-[0_0_20px_rgba(248,113,113,0.6)]",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      <div className="absolute top-0 left-0 w-1 h-1 bg-current opacity-50"></div>
      <div className="absolute top-0 right-0 w-1 h-1 bg-current opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-1 h-1 bg-current opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-1 h-1 bg-current opacity-50"></div>
      
      <span className="flex items-center gap-2 relative z-10">
        {icon && <span className="text-lg">{icon}</span>}
        {children}
      </span>
    </button>
  );
};
