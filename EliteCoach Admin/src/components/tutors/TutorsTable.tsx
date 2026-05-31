import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Trash2, Shield, User as UserIcon, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export interface UserData {
  id: string;
  name: string;
  email: string;
  roles?: string[]; // The PRD API doc says user has 'roles' array, not single 'role'
  role?: string;    // Fallback if backend hasn't updated
  status?: string;
  created_at?: string;
}

interface UsersResponse {
  items: UserData[];
  total: number;
  page: number;
  page_size: number;
}

export function TutorsTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState(''); // Empty means all users, but we'll label it "All Tutors" if we assume backend returns everything

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', page, roleFilter],
    queryFn: async () => {
      const params: any = { page, page_size: 20 };
      if (roleFilter) {
        params.role = roleFilter;
      }
      const response = await api.get<UsersResponse>('/api/v1/admin/users', { params });
      return response.data;
    },
  });

  const deleteTutorMutation = useMutation({
    mutationFn: (tutorId: string) => api.delete(`/api/v1/admin/tutors/${tutorId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  if (isLoading) {
    return <div className="py-8 text-center text-slate-500">Loading users...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-red-500">Failed to load users.</div>;
  }

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  // The endpoint returns all users, so we provide a filter
  // If the user selects a role, it goes to the backend.

  const getPrimaryRole = (user: UserData) => {
    if (user.roles && user.roles.length > 0) return user.roles[0];
    return user.role || 'Unknown';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            className="block w-48 pl-3 pr-8 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            <option value="tutor_author">Tutor (Author)</option>
            <option value="tutor_responder">Tutor (Responder)</option>
            <option value="solo_learner">Solo Learner</option>
            <option value="org_learner">Org Learner</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No users found for the current filter.
                </td>
              </tr>
            ) : (
              items.map((tutor) => (
                <tr key={tutor.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    {tutor.name || tutor.email.split('@')[0]}
                  </td>
                  <td className="px-4 py-3">{tutor.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                      <Shield className="w-3 h-3" />
                      {getPrimaryRole(tutor)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      tutor.status === 'inactive' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {tutor.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to offboard ${tutor.name || tutor.email}?`)) {
                          deleteTutorMutation.mutate(tutor.id);
                        }
                      }}
                      disabled={deleteTutorMutation.isPending}
                      className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Offboard Tutor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-sm text-slate-500 pt-4">
        <p>Showing {items.length} of {total} users</p>
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
