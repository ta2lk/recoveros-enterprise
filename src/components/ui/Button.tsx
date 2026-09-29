import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 cursor-pointer rounded-lg';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-xs font-semibold px-4 py-2 gap-2',
    lg: 'text-sm font-semibold px-5 py-2.5 gap-2.5',
  };

  const variantClasses = {
    primary:
      'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-sm',
    secondary:
      'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
    outline:
      'border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
    ghost:
      'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50',
  };

  return (
    <button
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
