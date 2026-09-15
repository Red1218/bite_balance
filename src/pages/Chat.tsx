import { Sparkles } from 'lucide-react';
import ChatMealLog from '@/components/ChatMealLog';

const Chat = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/12 border border-primary/28">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">Chat</h1>
          <p className="text-xs text-muted-foreground">Tell me what you ate, I'll log it.</p>
        </div>
      </div>

      <ChatMealLog />
    </div>
  );
};

export default Chat;
