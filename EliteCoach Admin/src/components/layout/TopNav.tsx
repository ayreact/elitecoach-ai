import { Bell, UserCircle } from 'lucide-react';

export function TopNav() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center">
        {/* Placeholder for breadcrumbs or page title */}
        <h2 className="text-lg font-semibold text-slate-800">Admin Dashboard</h2>
      </div>
      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
          <UserCircle className="w-8 h-8 text-slate-400" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-700">Admin User</span>
            <span className="text-xs text-slate-500">Platform Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
