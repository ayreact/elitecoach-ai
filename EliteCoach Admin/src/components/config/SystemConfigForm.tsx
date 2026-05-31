import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Save } from 'lucide-react';

export function SystemConfigForm() {
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState({
    ai_model: 'gpt-4o',
    latency_target_ms: 1500,
    escalation_threshold: 3,
  });

  const { data: configData, isLoading } = useQuery({
    queryKey: ['systemConfig'],
    queryFn: async () => {
      // Assuming GET /api/v1/admin/config returns a dictionary of key/value pairs
      const response = await api.get('/api/v1/admin/config');
      return response.data || {};
    },
  });

  useEffect(() => {
    if (configData && Object.keys(configData).length > 0) {
      setLocalConfig((prev) => ({
        ...prev,
        ...configData,
      }));
    }
  }, [configData]);

  const updateConfigMutation = useMutation({
    mutationFn: async (updatedConfig: typeof localConfig) => {
      // Assuming PUT /api/v1/admin/config/{key} updates individual keys
      const promises = Object.entries(updatedConfig).map(([key, value]) =>
        api.put(`/api/v1/admin/config/${key}`, { value })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate(localConfig);
  };

  if (isLoading) {
    return <div className="py-8 text-center text-slate-500">Loading configuration...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="ai_model" className="block text-sm font-medium text-slate-700 mb-1">AI Model Choice</label>
        <select
          id="ai_model"
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={localConfig.ai_model}
          onChange={(e) => setLocalConfig({ ...localConfig, ai_model: e.target.value })}
        >
          <option value="gpt-4o">GPT-4o (Default, High Performance)</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fallback, Fast)</option>
          <option value="claude-3-opus">Claude 3 Opus</option>
          <option value="claude-3-sonnet">Claude 3 Sonnet</option>
        </select>
      </div>

      <div>
        <label htmlFor="latency_target" className="block text-sm font-medium text-slate-700 mb-1">Latency Target (ms)</label>
        <input
          id="latency_target"
          type="number"
          min="100"
          max="10000"
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={localConfig.latency_target_ms}
          onChange={(e) => setLocalConfig({ ...localConfig, latency_target_ms: parseInt(e.target.value) })}
        />
        <p className="text-xs text-slate-500 mt-1">If generation takes longer than this, the request may timeout or fallback.</p>
      </div>

      <div>
        <label htmlFor="escalation" className="block text-sm font-medium text-slate-700 mb-1">Escalation Threshold (Failures)</label>
        <input
          id="escalation"
          type="number"
          min="1"
          max="10"
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={localConfig.escalation_threshold}
          onChange={(e) => setLocalConfig({ ...localConfig, escalation_threshold: parseInt(e.target.value) })}
        />
        <p className="text-xs text-slate-500 mt-1">Number of confused AI responses before auto-escalating to a human tutor.</p>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={updateConfigMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {updateConfigMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>
      
      {updateConfigMutation.isSuccess && (
        <div className="mt-2 text-sm text-emerald-600 bg-emerald-50 p-2 rounded text-center">
          Settings saved successfully!
        </div>
      )}
    </form>
  );
}
