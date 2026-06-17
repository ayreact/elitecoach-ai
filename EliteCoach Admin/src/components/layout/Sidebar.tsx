import { Link } from '@tanstack/react-router';
import { 
  LayoutDashboard, 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  Settings, 
  CreditCard, 
  FileText, 
  Activity 
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Platform Analytics', icon: LayoutDashboard },
  { path: '/tutors', label: 'Tutor Management', icon: Users },
  { path: '/content-moderation', label: 'Content Moderation', icon: ShieldCheck },
  { path: '/escalations', label: 'Escalations', icon: AlertTriangle },
  { path: '/system-config', label: 'System Config', icon: Settings },
  { path: '/payments', label: 'Payments', icon: CreditCard },
  { path: '/compliance', label: 'NDPR Compliance', icon: FileText },
  { path: '/audit-logs', label: 'Audit Logs', icon: Activity },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-200">
        <img src="/android-chrome-192x192.png" alt="Logo" className="h-8 w-8 mr-3 rounded-md" />
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">EliteCoach AI</h1>
      </div>
      <div className="px-4 py-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Admin Modules</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              activeProps={{
                className: 'bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700',
              }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
