import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface PaymentReconciliation {
  id: string;
  transaction_ref: string;
  type: 'solo_subscription' | 'enterprise_invoice' | 'tutor_payout';
  amount: number;
  currency: string;
  status: 'pending' | 'successful' | 'failed' | 'reconciled';
  user_id: string;
  created_at: string;
}

export function PaymentsDashboard() {
  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['paymentsReconciliation'],
    queryFn: async () => {
      const response = await api.get<PaymentReconciliation[]>('/api/v1/admin/payments/reconcile');
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="py-8 text-center text-slate-500">Loading financial data...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-red-500">Failed to load payment data.</div>;
  }

  const items = payments || [];

  // Calculate simple stats
  const totalRevenue = items.filter(i => i.type !== 'tutor_payout' && i.status !== 'failed').reduce((sum, item) => sum + item.amount, 0);
  const pendingReconciliation = items.filter(i => i.status === 'successful').length; // successful but not yet reconciled

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Revenue Found</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">₦{totalRevenue.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>
        
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Tutor Payouts</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">₦0</h3>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>

        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Pending Reconciliation</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">{pendingReconciliation} items</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <RefreshCw className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Transaction Ref</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No transactions found for reconciliation.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{item.transaction_ref}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                        {item.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${item.type === 'tutor_payout' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {item.type === 'tutor_payout' ? '-' : '+'} {item.currency} {item.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === 'reconciled' ? 'bg-indigo-50 text-indigo-700' : 
                        item.status === 'successful' ? 'bg-emerald-50 text-emerald-700' :
                        item.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status !== 'reconciled' && (
                        <button className="text-blue-600 hover:text-blue-700 text-xs font-medium hover:underline flex items-center justify-end gap-1 w-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Mark Reconciled
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
