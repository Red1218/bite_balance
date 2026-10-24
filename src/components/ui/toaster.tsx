import { AlertCircle, Check, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';

const ICON = {
  default: { Icon: Info, tile: 'bg-white/15 text-white' },
  success: { Icon: Check, tile: 'bg-chart-fiber text-white' },
  destructive: { Icon: AlertCircle, tile: 'bg-destructive text-white' },
} as const;

export function Toaster() {
  const { toasts } = useToast();

  return (
    // Its countdown ring (ToastAction) is drawn for this same 5 s.
    <ToastProvider duration={5000} swipeDirection="up">
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const { Icon, tile } = ICON[variant ?? 'default'];
        return (
          <Toast key={id} variant={variant} {...props}>
            <span className={cn('motion-island-pop flex h-11 w-11 flex-none items-center justify-center rounded-full', tile)}>
              <Icon className="h-[22px] w-[22px]" strokeWidth={variant === 'success' ? 3 : 2.4} />
            </span>
            <div className="motion-island-content flex min-w-0 flex-1 flex-col gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose className="sr-only" />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
