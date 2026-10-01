import React from 'react';

interface CyberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const CyberInput: React.FC<CyberInputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-xs font-cyber text-cyan-500/80 uppercase tracking-widest">{label}</label>}
      <div className="relative group">
        <input
          className={`w-full bg-black/50 border border-cyan-900/50 text-cyan-100 px-4 py-3 font-mono focus:border-cyan-500 focus:outline-none focus:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all duration-300 ${className}`}
          {...props}
        />
        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-cyan-500 group-focus-within:w-full transition-all duration-500"></div>
        <div className="absolute top-0 right-0 h-2 w-[1px] bg-cyan-500 opacity-50"></div>
        <div className="absolute bottom-0 left-0 h-2 w-[1px] bg-cyan-500 opacity-50"></div>
      </div>
    </div>
  );
};
