'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Megaphone, 
  FileText, 
  Video, 
  Share2, 
  Calendar,
  BarChart3,
  Settings
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Content Review', href: '/review', icon: FileText },
  { name: 'Videos', href: '/videos', icon: Video },
  { name: 'Distribution', href: '/distribution', icon: Share2 },
  { name: 'Publishing', href: '/publishing', icon: Calendar },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col bg-gray-900 text-white">
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        <h1 className="text-xl font-bold">Brand Infinity</h1>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                transition-colors hover:bg-gray-800
                ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}
              `}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-800 p-4">
        <p className="text-xs text-gray-500">v1.0.0</p>
      </div>
    </div>
  );
}
