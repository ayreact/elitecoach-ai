import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { TutorsTable } from '../components/tutors/TutorsTable';
import { OnboardTutorForm } from '../components/tutors/OnboardTutorForm';
import { Plus } from 'lucide-react';

export const Route = createFileRoute('/tutors')({
  component: TutorsManagement,
});

function TutorsManagement() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tutor Management</h1>
          <p className="text-slate-500 mt-1">Manage human tutors and content authors.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Onboard Tutor
        </button>
      </div>

      <div className="card p-6">
        <TutorsTable />
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Onboard New Tutor</h2>
            <OnboardTutorForm onClose={() => setIsFormOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
