import { createRootRouteWithContext, Outlet, redirect, useRouterState } from '@tanstack/react-router';
import { Sidebar } from '../components/layout/Sidebar';
import { TopNav } from '../components/layout/TopNav';
import { MainContent } from '../components/layout/MainContent';
import type { AuthContextType } from '../lib/auth';

import type { QueryClient } from '@tanstack/react-query';

interface MyRouterContext {
  auth: AuthContextType;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated && location.pathname !== '/login') {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }
    
    // If authenticated and trying to access login, redirect to home
    if (context.auth.isAuthenticated && location.pathname === '/login') {
      throw redirect({
        to: '/',
      });
    }
  },
  component: RootComponent,
});

function RootComponent() {
  const routerState = useRouterState();
  const isLoginPage = routerState.location.pathname === '/login';

  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopNav />
        <MainContent />
      </div>
    </div>
  );
}
