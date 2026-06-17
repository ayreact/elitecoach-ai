import { createFileRoute } from '@tanstack/react-router';
import { EscalationsTable } from '../components/escalations/EscalationsTable';

export const Route = createFileRoute('/escalations')({
  component: EscalationsDashboard,
});

function EscalationsDashboard() {
  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Escalations Dashboard</h1>
          <p className="text-slate-500 mt-1">Monitor all active AI-to-tutor escalations across the platform.</p>
        </div>
      </div>

      <div className="card p-6">
        <EscalationsTable />
      </div>
    </div>
  );
}
