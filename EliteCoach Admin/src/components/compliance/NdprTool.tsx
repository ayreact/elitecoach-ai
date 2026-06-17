import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Search, Download, Trash2, User, AlertTriangle } from 'lucide-react';
import type { UserData } from '../tutors/TutorsTable';

export function NdprTool() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const exportMutation = useMutation({
    mutationFn: (userId: string) => api.get(`/api/v1/admin/ndpr/export/${userId}`, { responseType: 'blob' }),
    onSuccess: (response, userId) => {
      const url = window.URL.createObjectURL(new Blob([response.data as any]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `user_data_export_${userId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/v1/admin/ndpr/delete/${userId}`),
    onSuccess: () => {
      setSelectedUser(null);
      setSearchQuery('');
      setDeleteConfirmation('');
      alert('User account and all associated data have been permanently deleted.');
    },
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    setIsLoading(true);
    try {
      const response = await api.get<{ items: UserData[] }>('/api/v1/admin/users', { 
        params: { search: searchQuery, page: 1, page_size: 5 } 
      });
      
      const found = response.data.items[0];
      setSelectedUser(found || null);
      if (!found) alert('User not found. Try searching by exact email or ID.');
    } catch (err) {
      console.error('Failed to search user', err);
      alert('Failed to search user.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (selectedUser && deleteConfirmation === selectedUser.email) {
      deleteMutation.mutate(selectedUser.id);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search by User Email, ID, or Name..."
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !searchQuery}
          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          Lookup User
        </button>
      </form>

      {selectedUser && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedUser.name || 'Unnamed User'}</h3>
                <p className="text-sm text-slate-500">{selectedUser.email}</p>
                <div className="mt-1 flex gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700 capitalize">
                    {((selectedUser.roles?.[0]) || selectedUser.role || 'Unknown').replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-400 font-mono self-center">ID: {selectedUser.id}</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => exportMutation.mutate(selectedUser.id)}
              disabled={exportMutation.isPending}
              className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              {exportMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export All Data
            </button>
          </div>

          <div className="mt-8 border-t border-red-200 pt-6">
            <h4 className="text-red-700 font-semibold flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone: Account Deletion
            </h4>
            <p className="text-sm text-slate-600 mb-4">
              This will permanently delete the user's account and all associated data in compliance with NDPR. 
              This action cannot be undone. To proceed, type the user's email <strong>{selectedUser.email}</strong> below.
            </p>
            
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={selectedUser.email}
                className="block w-full max-w-sm px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
              />
              <button
                onClick={handleDelete}
                disabled={deleteConfirmation !== selectedUser.email || deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
