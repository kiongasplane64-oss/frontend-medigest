// components/ui/Dialog.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a Dialog component');
  }
  return context;
};

interface DialogProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Dialog: React.FC<DialogProps> = ({ children, open: controlledOpen, onOpenChange }) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
    if (controlledOpen === undefined) {
      setUncontrolledOpen(newOpen);
    }
  };

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
};

Dialog.displayName = 'Dialog';

interface DialogTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

export const DialogTrigger: React.FC<DialogTriggerProps> = ({ children, asChild = false }) => {
  const { setOpen } = useDialog();
  
  if (asChild) {
    // Type-safe clone element with onClick handler
    const child = React.Children.only(children) as React.ReactElement<any>;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        if (child.props.onClick) {
          child.props.onClick(e);
        }
        setOpen(true);
      },
    });
  }
  
  return (
    <div onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
      {children}
    </div>
  );
};

DialogTrigger.displayName = 'DialogTrigger';

interface DialogPortalProps {
  children: ReactNode;
}

export const DialogPortal: React.FC<DialogPortalProps> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;
  
  return createPortal(children, document.body);
};

DialogPortal.displayName = 'DialogPortal';

interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

export const DialogContent: React.FC<DialogContentProps> = ({ children, className = '' }) => {
  const { open, setOpen } = useDialog();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <DialogPortal>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`relative bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[85vh] overflow-auto ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {children}
        </div>
      </div>
    </DialogPortal>
  );
};

DialogContent.displayName = 'DialogContent';

interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left p-6 pb-0 ${className}`}>
      {children}
    </div>
  );
};

DialogHeader.displayName = 'DialogHeader';

interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ children, className = '' }) => {
  return (
    <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h2>
  );
};

DialogTitle.displayName = 'DialogTitle';

interface DialogDescriptionProps {
  children: ReactNode;
  className?: string;
}

export const DialogDescription: React.FC<DialogDescriptionProps> = ({ children, className = '' }) => {
  return (
    <p className={`text-sm text-slate-500 ${className}`}>
      {children}
    </p>
  );
};

DialogDescription.displayName = 'DialogDescription';

interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ children, className = '' }) => {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0 ${className}`}>
      {children}
    </div>
  );
};

DialogFooter.displayName = 'DialogFooter';

export default { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
};