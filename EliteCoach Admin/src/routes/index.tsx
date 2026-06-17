import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Users, BookOpen, MessageSquare, Activity, AlertCircle } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: PlatformAnalytics,
});

// Based on the prompt and PRD, since openapi.json schema is empty '{}'
interface AnalyticsData {
  total_users?: number;
  active_courses?: number;
  active_ai_sessions?: number;
  platform_health?: {
    escalation_rate?: number;
    completion_rate?: number;
    system_uptime?: number;
  };
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendLabel 
}: { 
  title: string; 
  value: string | number; 
  icon: any;
  trend?: string;
  trendLabel?: string;
}) {
  return (
    <div className="card p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-2">{value}</h3>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className="font-medium text-emerald-600">{trend}</span>
          <span className="text-slate-500 ml-2">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

function PlatformAnalytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['platformAnalytics'],
    queryFn: async () => {
      const response = await api.get<AnalyticsData>('/api/v1/admin/analytics/platform');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start">
        <AlertCircle className="w-6 h-6 text-red-600 mr-3 shrink-0" />
        <div>
          <h3 className="text-red-800 font-medium">Failed to load analytics</h3>
          <p className="text-red-600 text-sm mt-1">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  const analytics = data || {};

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Analytics</h1>
          <p className="text-slate-500 mt-1">Real-time overview of EliteCoach AI's performance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={analytics.total_users ?? '-'}
          icon={Users}
        />
        <StatCard
          title="Active Courses"
          value={analytics.active_courses ?? '-'}
          icon={BookOpen}
        />
        <StatCard
          title="Active AI Sessions"
          value={analytics.active_ai_sessions ?? '-'}
          icon={MessageSquare}
        />
        <StatCard
          title="AI Escalation Rate"
          value={analytics.platform_health?.escalation_rate !== undefined ? `${analytics.platform_health.escalation_rate}%` : '-'}
          icon={Activity}
          trend={analytics.platform_health?.escalation_rate !== undefined && analytics.platform_health.escalation_rate < 20 ? 'Target met' : ''}
          trendLabel="Target: < 20%"
        />
      </div>

      {/* Placeholder for future Recharts integration */}
      <div className="card p-6 mt-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Platform Activity Trends</h3>
        <div className="h-72 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-100 border-dashed">
          <p className="text-slate-400">Activity chart will be rendered here once time-series data is available.</p>
        </div>
      </div>
    </div>
  );
}
