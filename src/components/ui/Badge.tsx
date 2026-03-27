// components/ui/Badge.tsx
import { HTMLAttributes, forwardRef } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  className?: string;
}

const variantClasses = {
  default: 'bg-blue-500 text-white hover:bg-blue-600',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  destructive: 'bg-red-500 text-white hover:bg-red-600',
  outline: 'border border-slate-200 text-slate-900 hover:bg-slate-100',
  success: 'bg-green-500 text-white hover:bg-green-600',
  warning: 'bg-yellow-500 text-white hover:bg-yellow-600',
};

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;