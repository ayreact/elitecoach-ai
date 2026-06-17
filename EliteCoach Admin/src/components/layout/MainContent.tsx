import { Outlet } from '@tanstack/react-router';

export function MainContent() {
  return (
    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/50 p-8">
      <div className="mx-auto max-w-7xl">
        <Outlet />
      </div>
    </main>
  );
}
