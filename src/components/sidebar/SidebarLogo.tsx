import React from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarLogoProps {
  isOpen: boolean;
}

const SidebarLogo = ({ isOpen }: SidebarLogoProps) => {
  return (
    <div
      className={cn(
        'p-6 border-b border-gray-200 transition-all duration-300',
        !isOpen && 'md:p-4'
      )}
    >
      {isOpen ? (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">BiteBalance</h1>
            <p className="text-xs text-gray-500">Fuel Better, Live Better</p>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex justify-center">
          <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarLogo;
