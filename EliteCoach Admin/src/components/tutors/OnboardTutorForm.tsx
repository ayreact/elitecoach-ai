import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const AVAILABLE_DOMAINS = ['Finance', 'Technology', 'Leadership & Management', 'Data & Analytics'];

export function OnboardTutorForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    roles: ['tutor_responder'],
    domains: [] as string[],
  });

  const onboardMutation = useMutation({
    mutationFn: (newTutor: typeof formData) => api.post('/api/v1/admin/tutors/onboard', newTutor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onboardMutation.mutate(formData);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'tutor') {
      setFormData({ ...formData, roles: ['tutor_author', 'tutor_responder'] });
    } else {
      setFormData({ ...formData, roles: [value] });
    }
  };

  const handleDomainChange = (domain: string) => {
    setFormData(prev => {
      if (prev.domains.includes(domain)) {
        return { ...prev, domains: prev.domains.filter(d => d !== domain) };
      }
      return { ...prev, domains: [...prev.domains, domain] };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
        <input 
          id="full_name"
          type="text" 
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
        <input 
          id="email"
          type="email" 
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
        <input 
          id="phone"
          type="tel" 
          required
          placeholder="+2348012345678"
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1">Tutor Role</label>
        <select
          id="role"
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={formData.roles.includes('tutor_author') && formData.roles.includes('tutor_responder') ? 'tutor' : formData.roles[0] || 'tutor_responder'}
          onChange={handleRoleChange}
        >
          <option value="tutor_responder">Escalation Handler (Tutor Responder)</option>
          <option value="tutor_author">Content Creator (Tutor Author)</option>
          <option value="tutor">Both (Tutor)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Domains</label>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_DOMAINS.map(domain => (
            <label key={domain} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={formData.domains.includes(domain)}
                onChange={() => handleDomainChange(domain)}
              />
              <span className="text-sm text-slate-600">{domain}</span>
            </label>
          ))}
        </div>
      </div>

      {onboardMutation.isError && (
        <div className="text-red-600 text-sm p-3 bg-red-50 rounded-md">
          Failed to onboard tutor. Please try again.
        </div>
      )}

      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
        <button 
          type="button" 
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={onboardMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]"
        >
          {onboardMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : 'Onboard'}
        </button>
      </div>
    </form>
  );
}
