import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { requestReminderPermission, type ReminderSettings } from '@/lib/habitReminders';

interface HabitReminderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReminderSettings;
  onChange: (next: ReminderSettings) => void;
}

const HabitReminderSheet = ({ open, onOpenChange, settings, onChange }: HabitReminderSheetProps) => {
  const { toast } = useToast();

  const setEnabled = async (enabled: boolean) => {
    if (enabled && !(await requestReminderPermission())) {
      toast({
        title: 'Notifications are blocked',
        description: 'Allow notifications for Bite Balance in Android settings, then try again.',
        variant: 'destructive',
      });
      return;
    }
    onChange({ ...settings, enabled });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">Daily reminder</DrawerTitle>
        <div className="space-y-4 px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3">
          <div className="font-display text-lg font-semibold tracking-tight text-foreground">Daily reminder</div>
          <p className="text-sm text-muted-foreground">
            One notification listing the habits still open. Skipped on days you've finished everything. Habits can also have their own reminder times.
          </p>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">Remind me</span>
            <Switch checked={settings.enabled} onCheckedChange={setEnabled} aria-label="Daily reminder" />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">Time</span>
            <input
              type="time"
              value={settings.time}
              onChange={(e) => e.target.value && onChange({ ...settings, time: e.target.value })}
              className="h-11 rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground"
            />
          </label>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default HabitReminderSheet;
