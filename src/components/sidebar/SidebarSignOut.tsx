import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarSignOutProps {
  isOpen: boolean;
}

const SidebarSignOut = ({ isOpen }: SidebarSignOutProps) => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="p-4 border-t border-gray-200">
      <Button
        onClick={handleSignOut}
        variant="ghost"
        className={cn(
          'w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50 group relative',
          !isOpen && 'md:justify-center'
        )}
        title={!isOpen ? 'Sign Out' : undefined}
      >
        <LogOut className="w-5 h-5 mr-3 flex-shrink-0" />
        {isOpen && 'Sign Out'}

        {!isOpen && (
          <div className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            Sign Out
          </div>
        )}
      </Button>
    </div>
  );
};

export default SidebarSignOut;
