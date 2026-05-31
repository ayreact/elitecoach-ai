import { createFileRoute } from '@tanstack/react-router';
import { AuditLogsTable } from '../components/audit/AuditLogsTable';

export const Route = createFileRoute('/audit-logs')({
  component: AuditLogsPage,
});

function AuditLogsPage() {
  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Audit Logs</h1>
          <p className="text-slate-500 mt-1">Read-only event log showing every admin action taken on the platform.</p>
        </div>
      </div>

      <div className="card p-6">
        <AuditLogsTable />
      </div>
    </div>
  );
}
