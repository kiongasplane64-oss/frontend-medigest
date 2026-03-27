// components/ui/ScrollArea.tsx
import { forwardRef, HTMLAttributes } from 'react';

interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative overflow-auto ${className}`}
        style={{ scrollbarWidth: 'thin' }}
        {...props}
      >
        <style>{`
          .scroll-area::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .scroll-area::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
          }
          .scroll-area::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
          }
          .scroll-area::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }
        `}</style>
        <div className="scroll-area h-full w-full overflow-auto">
          {children}
        </div>
      </div>
    );
  }
);

ScrollArea.displayName = 'ScrollArea';

export const ScrollBar = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex touch-none select-none transition-colors ${className}`}
        {...props}
      />
    );
  }
);

ScrollBar.displayName = 'ScrollBar';

export default ScrollArea;