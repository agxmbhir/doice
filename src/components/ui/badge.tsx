import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants =
      variant === 'secondary'
        ? 'bg-secondary text-secondary-foreground'
        : variant === 'outline'
          ? 'border border-border'
          : 'bg-primary text-primary-foreground';
    return (
      <span ref={ref} className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', variants, className)} {...props} />
    );
  }
);
Badge.displayName = 'Badge';


