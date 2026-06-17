import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AlertTriangle, Clock, User as UserIcon, CheckCircle2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export interface Escalation {
  id: string;
  learner_id: string;
  learner_name?: string;
  tutor_id?: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved';
  lesson_id?: string;
  created_at: string;
  updated_at: string;
}

interface EscalationsResponse {
  items: Escalation[];
  total: number;
}

export function EscalationsTable() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['escalations', statusFilter, page],
    queryFn: async () => {
      const params: any = { page };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.get<EscalationsResponse>('/api/v1/admin/escalations', { params });
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="py-8 text-center text-slate-500">Loading escalations...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-red-500">Failed to load escalations.</div>;
  }

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 20)); // Assuming 20 per page

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">Open</span>;
      case 'assigned':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">Assigned</span>;
      case 'in_progress':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">In Progress</span>;
      case 'resolved':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">Resolved</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-100">{status}</span>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'assigned': return <UserIcon className="w-4 h-4 text-amber-600" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'resolved': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            className="block w-48 pl-3 pr-8 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1); // Reset to page 1 on filter change
            }}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Escalation ID</th>
              <th className="px-4 py-3">Learner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No escalations found for the current filter. The AI is doing great!
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                      item.status === 'open' ? 'bg-red-50' : 
                      item.status === 'assigned' ? 'bg-amber-50' : 
                      item.status === 'in_progress' ? 'bg-blue-50' : 'bg-emerald-50'
                    }`}>
                      {getStatusIcon(item.status)}
                    </div>
                    {item.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">{item.learner_name || item.learner_id}</td>
                  <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                  <td className="px-4 py-3">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(item.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-between items-center text-sm text-slate-500 pt-4">
        <p>Showing {items.length} of {total} escalations</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((old) => Math.max(old - 1, 1))}
            disabled={page === 1}
            className="p-1 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-2">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((old) => Math.min(old + 1, totalPages))}
            disabled={page === totalPages || totalPages === 0}
            className="p-1 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
