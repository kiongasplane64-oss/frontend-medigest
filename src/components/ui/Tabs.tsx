// components/ui/Tabs.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within a Tabs component');
  }
  return context;
};

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className = '',
}) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const setValue = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue);
    }
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue);
    }
  };

  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

Tabs.displayName = 'Tabs';

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500 ${className}`}
    >
      {children}
    </div>
  );
};

TabsList.displayName = 'TabsList';

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  className = '',
  disabled = false,
}) => {
  const { value: selectedValue, onValueChange } = useTabs();
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={() => !disabled && onValueChange(value)}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium
        ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
        ${isSelected 
          ? 'bg-white text-slate-950 shadow-sm' 
          : 'text-slate-500 hover:text-slate-900'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
};

TabsTrigger.displayName = 'TabsTrigger';

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className = '',
}) => {
  const { value: selectedValue } = useTabs();
  
  if (selectedValue !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      data-state={selectedValue === value ? 'active' : 'inactive'}
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </div>
  );
};

TabsContent.displayName = 'TabsContent';

export default { Tabs, TabsList, TabsTrigger, TabsContent };