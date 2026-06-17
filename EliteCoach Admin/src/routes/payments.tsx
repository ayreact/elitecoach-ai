import { createFileRoute } from '@tanstack/react-router';
import { PaymentsDashboard } from '../components/payments/PaymentsDashboard';

export const Route = createFileRoute('/payments')({
  component: PaymentsPage,
});

function PaymentsPage() {
  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Reconciliation</h1>
          <p className="text-slate-500 mt-1">Reconcile Paystack enterprise invoicing and solo learner subscriptions.</p>
        </div>
      </div>

      <PaymentsDashboard />
    </div>
  );
}
