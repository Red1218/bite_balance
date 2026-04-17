export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}
