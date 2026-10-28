import { useSyncExternalStore } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { offlineStatus, onOfflineStatus } from '@/lib/offline';

const changes = (n: number) => `${n} change${n === 1 ? '' : 's'}`;

/** Shown while offline or while changes made offline are still on their way to the server. */
const OfflinePill = () => {
  const { online, pending } = useSyncExternalStore(onOfflineStatus, offlineStatus);
  if (online && !pending) return null;
  return (
    <div role="status" className="motion-drop mb-3 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        {online ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
        {online
          ? `Syncing ${changes(pending)}…`
          : pending
            ? `Offline · ${changes(pending)} will sync`
            : 'Offline · showing saved data'}
      </span>
    </div>
  );
};

export default OfflinePill;
