import { createFileRoute } from '@tanstack/react-router';
import { NdprTool } from '../components/compliance/NdprTool';

export const Route = createFileRoute('/compliance')({
  component: CompliancePage,
});

function CompliancePage() {
  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">NDPR & Compliance</h1>
          <p className="text-slate-500 mt-1">Manage user data rights, exports, and cascading account deletions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-4xl">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">User Data Management</h2>
          <NdprTool />
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="text-amber-800 font-semibold mb-2">Compliance Notice</h3>
          <p className="text-amber-700 text-sm">
            Under the Nigeria Data Protection Regulation (NDPR), users have the right to request a complete export of their data and the right to be forgotten (account deletion). Data deletion actions taken here are permanent and cannot be undone. Always verify the identity of the requester before executing these actions.
          </p>
        </div>
      </div>
    </div>
  );
}
