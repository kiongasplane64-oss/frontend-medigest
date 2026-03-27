// components/ui/Table.tsx
import { forwardRef, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  className?: string;
}

interface TableSectionProps extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  className?: string;
}

interface TableHeadProps extends ThHTMLAttributes<HTMLTableHeaderCellElement> {
  className?: string;
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableDataCellElement> {
  className?: string;
}

interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {
  className?: string;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={`w-full caption-bottom text-sm ${className}`}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  }
);

Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <thead ref={ref} className={`[&_tr]:border-b ${className}`} {...props}>
        {children}
      </thead>
    );
  }
);

TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={`[&_tr:last-child]:border-0 ${className}`}
        {...props}
      >
        {children}
      </tbody>
    );
  }
);

TableBody.displayName = 'TableBody';

export const TableFooter = forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <tfoot
        ref={ref}
        className={`border-t bg-slate-100 font-medium [&>tr]:last:border-b-0 ${className}`}
        {...props}
      >
        {children}
      </tfoot>
    );
  }
);

TableFooter.displayName = 'TableFooter';

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={`border-b transition-colors hover:bg-slate-50 data-[state=selected]:bg-slate-100 ${className}`}
        {...props}
      >
        {children}
      </tr>
    );
  }
);

TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={`h-12 px-4 text-left align-middle font-medium text-slate-500 [&:has([role=checkbox])]:pr-0 ${className}`}
        {...props}
      >
        {children}
      </th>
    );
  }
);

TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}
        {...props}
      >
        {children}
      </td>
    );
  }
);

TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <caption
        ref={ref}
        className={`mt-4 text-sm text-slate-500 ${className}`}
        {...props}
      >
        {children}
      </caption>
    );
  }
);

TableCaption.displayName = 'TableCaption';

export default { 
  Table, 
  TableHeader, 
  TableBody, 
  TableFooter, 
  TableRow, 
  TableHead, 
  TableCell, 
  TableCaption 
};