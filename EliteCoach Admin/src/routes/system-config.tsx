import { createFileRoute } from '@tanstack/react-router';
import { SystemConfigForm } from '../components/config/SystemConfigForm';
import { FeatureFlagsBoard } from '../components/config/FeatureFlagsBoard';

export const Route = createFileRoute('/system-config')({
  component: SystemConfigPage,
});

function SystemConfigPage() {
  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Configuration</h1>
          <p className="text-slate-500 mt-1">Manage global AI settings and toggle feature flags.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Global Settings</h2>
          <SystemConfigForm />
        </div>
        
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Feature Flags</h2>
          <FeatureFlagsBoard />
        </div>
      </div>
    </div>
  );
}
