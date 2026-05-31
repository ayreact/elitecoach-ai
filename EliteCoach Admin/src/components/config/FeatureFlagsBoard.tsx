import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const DEFAULT_FLAGS = [
  { key: 'enable_voice_interview', label: 'Voice Mock Interviews', description: 'Enable v2 voice capability for mock interviews.' },
  { key: 'enable_sms_notifications', label: 'SMS Notifications', description: 'Enable SMS fallback via Termii/Africa\'s Talking.' },
  { key: 'enable_ai_assist_drafts', label: 'AI Content Assist', description: 'Enable AI assist for content drafts in the CMS.' },
  { key: 'enable_practical_assignments', label: 'Practical Assignments', description: 'Enable human-graded practical assignments.' },
];

export function FeatureFlagsBoard() {
  const queryClient = useQueryClient();
  const [flags, setFlags] = useState<Record<string, boolean>>({
    enable_voice_interview: false,
    enable_sms_notifications: false,
    enable_ai_assist_drafts: false,
    enable_practical_assignments: false,
  });

  const { data: serverFlags, isLoading } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: async () => {
      // Assuming GET /api/v1/admin/config includes flags or there's a dedicated endpoint. 
      // The PRD mentions POST /api/v1/admin/feature-flags/{key} for toggling.
      const response = await api.get('/api/v1/admin/config');
      return response.data?.feature_flags || {};
    },
  });

  useEffect(() => {
    if (serverFlags) {
      setFlags((prev) => ({ ...prev, ...serverFlags }));
    }
  }, [serverFlags]);

  const toggleMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      await api.post(`/api/v1/admin/feature-flags/${key}`, { enabled: value });
      return { key, value };
    },
    onSuccess: ({ key, value }) => {
      setFlags((prev) => ({ ...prev, [key]: value }));
      queryClient.invalidateQueries({ queryKey: ['featureFlags'] });
    },
  });

  const handleToggle = (key: string) => {
    const newValue = !flags[key];
    toggleMutation.mutate({ key, value: newValue });
  };

  if (isLoading) {
    return <div className="py-8 text-center text-slate-500">Loading feature flags...</div>;
  }

  return (
    <div className="space-y-4">
      {DEFAULT_FLAGS.map((flag) => (
        <div key={flag.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{flag.label}</h3>
            <p className="text-xs text-slate-500 mt-1">{flag.description}</p>
          </div>
          <button
            role="switch"
            aria-checked={flags[flag.key]}
            onClick={() => handleToggle(flag.key)}
            disabled={toggleMutation.isPending && toggleMutation.variables?.key === flag.key}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              flags[flag.key] ? 'bg-emerald-500' : 'bg-slate-300'
            } disabled:opacity-50`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                flags[flag.key] ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
