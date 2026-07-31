import React from 'react';
import { Plus, X } from 'lucide-react';
import type { BillableLineItem } from '../types';

interface LineItemsEditorProps {
  value: BillableLineItem[];
  onChange: (items: BillableLineItem[]) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

// amount = qty × rate when both are present; otherwise the entered lump sum.
const lineAmount = (it: BillableLineItem): number =>
  it.quantity && it.rate ? round2(Number(it.quantity) * Number(it.rate)) : Number(it.amount) || 0;

const LineItemsEditor: React.FC<LineItemsEditorProps> = ({ value, onChange }) => {
  const items = value.length ? value : [{ description: '', amount: 0 }];
  const total = items.reduce((s, it) => s + lineAmount(it), 0);

  const update = (i: number, patch: Partial<BillableLineItem>) =>
    onChange(items.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      if (next.quantity && next.rate) next.amount = round2(Number(next.quantity) * Number(next.rate));
      return next;
    }));
  const add = () => onChange([...items, { description: '', amount: 0 }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const num = (v: string) => (v === '' ? null : parseFloat(v));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Line Items <span className="text-red-500">*</span>
      </label>

      {/* Column headers */}
      <div className="hidden sm:flex items-center gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
        <span className="flex-1">Description</span>
        <span className="w-16 text-right">Qty</span>
        <span className="w-28 text-right">Rate (₹)</span>
        <span className="w-20">Per</span>
        <span className="w-32 text-right">Amount</span>
        <span className="w-4" />
      </div>

      <div className="space-y-2">
        {items.map((it, i) => {
          const computed = !!(it.quantity && it.rate);
          return (
            <div key={i} className="flex items-start gap-2">
              <input
                type="text"
                value={it.description}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="Description"
                className="form-input flex-1"
                required
              />
              <input
                type="number"
                value={it.quantity ?? ''}
                onChange={(e) => update(i, { quantity: num(e.target.value) })}
                placeholder="Qty"
                min="0"
                step="any"
                className="form-input w-16 text-right"
              />
              <input
                type="number"
                value={it.rate ?? ''}
                onChange={(e) => update(i, { rate: num(e.target.value) })}
                placeholder="Rate"
                min="0"
                step="0.01"
                className="form-input w-28 text-right"
              />
              <input
                type="text"
                value={it.unit ?? ''}
                onChange={(e) => update(i, { unit: e.target.value })}
                placeholder="Unt"
                className="form-input w-20"
              />
              <div className="relative w-32">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₹</span>
                </div>
                <input
                  type="number"
                  value={computed ? lineAmount(it) : (it.amount || '')}
                  onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })}
                  readOnly={computed}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className={`form-input pl-6 w-full text-right ${computed ? 'bg-gray-50 text-gray-500' : ''}`}
                  title={computed ? 'Qty × Rate' : 'Lump-sum amount'}
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={items.length <= 1}
                className="mt-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remove line"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <Plus className="h-4 w-4" /> Add line item
        </button>
        <span className="text-sm text-gray-500">
          Total: <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Enter Qty + Rate to auto-calculate the amount (e.g. 3 months × ₹1,50,000), or leave them blank for a lump sum.
      </p>
    </div>
  );
};

export default LineItemsEditor;
