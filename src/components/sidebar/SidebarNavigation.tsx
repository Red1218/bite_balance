import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NavItem } from '@/types/sidebar';
import {
  BarChart3,
  PlusCircle,
  BookmarkPlus,
  Calendar,
  Settings,
  User,
  Footprints,
} from 'lucide-react';

interface SidebarNavigationProps {
  isOpen: boolean;
  onToggle: () => void;
}

const SidebarNavigation = ({ isOpen, onToggle }: SidebarNavigationProps) => {
  const location = useLocation();

  const navItems: NavItem[] = [
    { path: '/', icon: BarChart3, label: 'Dashboard' },
    { path: '/add-meal', icon: PlusCircle, label: 'Add Meal' },
    { path: '/saved-meals', icon: BookmarkPlus, label: 'Saved Meals' },
    { path: '/history', icon: Calendar, label: 'History' },
    { path: '/steps', icon: Footprints, label: 'Steps' },
    { path: '/settings', icon: Settings, label: 'Settings' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      onToggle();
    }
  };

  return (
    <nav className="flex-1 px-4 py-6">
      <div className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={cn(
                'flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                isActive
                  ? 'bg-red-50 text-red-600 border-l-4 border-red-500 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                !isOpen && 'md:justify-center md:space-x-0'
              )}
              title={!isOpen ? item.label : undefined}
            >
              <Icon
                className={cn(
                  'w-5 h-5 flex-shrink-0',
                  isActive ? 'text-red-500' : 'text-gray-400'
                )}
              />
              {isOpen && <span>{item.label}</span>}

              {!isOpen && (
                <div className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default SidebarNavigation;
