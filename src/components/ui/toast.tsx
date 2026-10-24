import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed inset-x-0 top-0 z-[100] mx-auto flex max-h-screen w-full max-w-[560px] flex-col px-3.5 outline-none',
      className
    )}
    style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

// The island pill: a black capsule that drops from the top and widens out (motion-island in
// index.css); swiping it up dismisses it. The variant only changes the icon and its colour.
const toastVariants = cva(
  'group motion-island pointer-events-auto relative flex min-h-16 w-full items-center gap-3 overflow-hidden rounded-[32px] bg-black py-2 pl-2.5 pr-2 text-white shadow-[0_14px_34px_rgba(0,0,0,.6)] data-[swipe=cancel]:translate-y-0 data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=move]:transition-none data-[swipe=end]:translate-y-[var(--radix-toast-swipe-end-y)]',
  {
    variants: {
      variant: {
        default: '',
        success: 'success',
        destructive: 'destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, children, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'motion-island-content relative flex h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-white/10 px-3 text-xs font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  >
    {/* Runs down over the toast's 5 s life, so you can see how long Undo lasts */}
    <svg viewBox="0 0 48 48" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2">
      <circle className="motion-countdown" cx="24" cy="24" r="21" fill="none" stroke="hsl(var(--chart-carbs))" strokeWidth="3" strokeLinecap="round" strokeDasharray="132" transform="rotate(-90 24 24)" />
    </svg>
    {children}
  </ToastPrimitives.Action>
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('truncate text-[15px] font-bold', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('line-clamp-2 text-[13px] leading-snug text-white/65', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
