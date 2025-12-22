import React, { useState, useMemo } from 'react';
import { X, Trash2, Plus, Wallet } from 'lucide-react';
import { Order, Transaction, PaymentMethod } from '../types';
import { formatCurrency, formatShortDate } from '../utils/validation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onAddTransaction: (orderId: string, transaction: Omit<Transaction, 'id' | 'addedBy'>) => void;
  onDeleteTransaction: (orderId: string, transactionId: string) => void;
}

export const TransactionHistoryDrawer: React.FC<Props> = ({ 
  isOpen, onClose, order, onAddTransaction, onDeleteTransaction 
}) => {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CHECK);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Calculations
  const totalPaid = useMemo(() => {
    return order.transactions.reduce((sum, t) => sum + t.amount, 0);
  }, [order.transactions]);

  const remainingBalance = order.totalAmount - totalPaid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    onAddTransaction(order.id, {
      amount: numAmount,
      method,
      date: new Date(date).toISOString(),
    });

    // Reset form
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wallet size={20} className="text-emerald-400" />
              Historique des Paiements
            </h2>
            <p className="text-slate-400 text-sm mt-1">{order.firstName} {order.lastName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* Financial Summary */}
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded border border-slate-200">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Commande</span>
              <div className="text-lg font-bold text-slate-900">{formatCurrency(order.totalAmount)}</div>
            </div>
            <div className={`bg-white p-3 rounded border ${remainingBalance <= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <span className="text-xs text-slate-500 uppercase font-bold">Reste à payer</span>
              <div className={`text-lg font-bold ${remainingBalance <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {remainingBalance <= 0 ? 'Réglé' : formatCurrency(remainingBalance)}
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-between items-center text-sm">
             <span className="text-slate-600">Total versé:</span>
             <span className="font-semibold text-slate-900">{formatCurrency(totalPaid)}</span>
          </div>
           {/* Progress Bar */}
          <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2">
            <div 
              className={`h-2.5 rounded-full ${remainingBalance <= 0 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
              style={{ width: `${Math.min((totalPaid / order.totalAmount) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase mb-4">Transactions</h3>
          
          {order.transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 italic border-2 border-dashed border-slate-200 rounded-lg">
              Aucun versement enregistré
            </div>
          ) : (
            <div className="space-y-3">
              {order.transactions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((t) => (
                <div key={t.id} className="group flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md transition">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{formatCurrency(t.amount)}</span>
                    <span className="text-xs text-slate-500">{formatShortDate(t.date)} • {t.method}</span>
                  </div>
                  <button 
                    onClick={() => {
                        if(window.confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
                            onDeleteTransaction(order.id, t.id);
                        }
                    }}
                    className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Supprimer la transaction"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Transaction Form */}
        <div className="p-6 bg-white border-t border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 uppercase mb-4">Nouveau versement</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
            <div>
               <label className="block text-xs font-medium text-slate-700 mb-1">Mode de règlement</label>
               <select 
                  value={method} 
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
               >
                 {Object.values(PaymentMethod).map((m) => (
                   <option key={m} value={m}>{m}</option>
                 ))}
               </select>
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded font-semibold transition"
            >
              <Plus size={18} />
              Ajouter le versement
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};