import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportRef?: React.Ref<HTMLDivElement>;
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, viewportRef, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('relative', className)} {...props}>
        <div ref={viewportRef} className="nice-scroll h-full overflow-auto">
          {children}
        </div>
      </div>
    );
  }
);
ScrollArea.displayName = 'ScrollArea';


