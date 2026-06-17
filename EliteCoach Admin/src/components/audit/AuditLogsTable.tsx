import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Activity, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export interface AuditEvent {
  id: string;
  admin_id: string;
  admin_name?: string;
  action_type: string; // Updated from 'action' to 'action_type' to match backend
  target_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

interface AuditLogsResponse {
  items: AuditEvent[];
  total: number;
}

export function AuditLogsTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // We map searchTerm to action_type for API call if it matches typical actions,
  // but if the backend only supports specific filters (admin_id, action_type),
  // we can just send action_type or admin_id based on what it looks like.
  // For simplicity, let's assume we pass it as action_type if it doesn't look like a UUID,
  // or just pass it as 'search' if the backend added general search. 
  // api_doc.md states: `GET /api/v1/admin/audit/events` Query params: `admin_id`, `action_type`, `from_date`, `page`
  // Let's use `action_type` for the search field.

  const { data, isLoading, error } = useQuery({
    queryKey: ['auditLogs', searchTerm, page],
    queryFn: async () => {
      const params: any = { page };
      if (searchTerm) {
        // Simple heuristic: if it has a hyphen, it might be an admin_id, otherwise action_type
        if (searchTerm.includes('-') && searchTerm.length > 20) {
          params.admin_id = searchTerm;
        } else {
          params.action_type = searchTerm;
        }
      }
      
      const response = await api.get<AuditLogsResponse>('/api/v1/admin/audit/events', { params });
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="py-8 text-center text-slate-500">Loading audit logs...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-red-500">Failed to load audit logs.</div>;
  }

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 20)); // Assuming 20 per page default

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-4">
        <div className="relative w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Filter by action or admin ID..."
            className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm bg-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-700 bg-white hover:bg-slate-50 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Admin User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target ID</th>
              <th className="px-4 py-3">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No audit logs found matching your criteria.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.admin_name || 'Unknown Admin'}</div>
                    <div className="text-xs text-slate-500 font-mono">{item.admin_id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      <Activity className="w-3 h-3 text-slate-500" />
                      {item.action_type || (item as any).action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.target_id ? `${item.target_id.slice(0, 8)}...` : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {item.ip_address || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
        <p>Showing {items.length} of {total} events</p>
        <div className="flex items-center gap-4">
          <p className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            Audit logging active
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((old) => Math.max(old - 1, 1))}
              disabled={page === 1}
              className="p-1 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((old) => Math.min(old + 1, totalPages))}
              disabled={page === totalPages || totalPages === 0}
              className="p-1 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
