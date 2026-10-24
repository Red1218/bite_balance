import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

/** A "Logged" toast whose Undo deletes exactly the rows that were just inserted. */
export const showLoggedToast = (description: string, ids: string[], onChange: () => void) =>
  toast({
    title: 'Logged',
    description,
    variant: 'success',
    action: (
      <ToastAction
        altText="Undo"
        onClick={async () => {
          const { error } = await supabase.from('daily_meals').delete().in('id', ids);
          if (error) {
            toast({ title: 'Couldn’t undo', description: 'Delete the meal from Today instead.', variant: 'destructive' });
            return;
          }
          onChange();
          toast({ title: 'Removed', description: 'That’s off today’s log.' });
        }}
      >
        Undo
      </ToastAction>
    ),
  });
