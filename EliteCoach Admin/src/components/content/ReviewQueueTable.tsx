import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Check, X, FileText, Book } from 'lucide-react';

export interface ContentItem {
  id: string;
  title: string;
  type: 'course' | 'lesson';
  tutor_id: string;
  tutor_name?: string;
  status: string;
  submitted_at: string;
}

export function ReviewQueueTable() {
  const queryClient = useQueryClient();

  const { data: queue, isLoading, error } = useQuery({
    queryKey: ['contentQueue'],
    queryFn: async () => {
      const response = await api.get<ContentItem[]>('/api/v1/admin/content/review-queue');
      return response.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/admin/content/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentQueue'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, feedback }: { id: string, feedback: string }) => api.post(`/api/v1/admin/content/${id}/reject`, { feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentQueue'] });
    },
  });

  if (isLoading) {
    return <div className="py-8 text-center text-slate-500">Loading review queue...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-red-500">Failed to load review queue.</div>;
  }

  const items = queue || [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
          <tr>
            <th className="px-4 py-3">Content Title</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Submitted By</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                The review queue is completely empty. Great job!
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    {item.type === 'course' ? <Book className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  {item.title}
                </td>
                <td className="px-4 py-3 capitalize">{item.type}</td>
                <td className="px-4 py-3">{item.tutor_name || item.tutor_id}</td>
                <td className="px-4 py-3">
                  {new Date(item.submitted_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to approve "${item.title}"?`)) {
                          approveMutation.mutate(item.id);
                        }
                      }}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="text-emerald-600 hover:text-emerald-700 p-2 rounded hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      title="Approve Content"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        const reason = window.prompt(`Please provide a reason for rejecting "${item.title}":`);
                        if (reason !== null && reason.trim() !== '') {
                          rejectMutation.mutate({ id: item.id, feedback: reason });
                        }
                      }}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Reject Content"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
