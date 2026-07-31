import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, FileText } from 'lucide-react';
import type { BillableItem, Client, Project, BillableStatus } from '../types';
import { getBillableItems, updateBillableItem } from '../lib/storage';
import { getClients } from '../lib/clients';
import { getProjects } from '../lib/storage';
import { handleDocumentClick } from '../utils/documentUtils';
import { BANK_ACCOUNTS, getBank } from '../lib/invoiceConfig';
import { pdf } from '@react-pdf/renderer';
import InvoiceDocument from './InvoiceDocument';
import { buildInvoiceData, generateInvoiceNumber } from '../lib/invoiceData';

interface BillableItemWithDetails extends Omit<BillableItem, 'project_id'> {
  project_id: number;
  project?: Project;
  client?: Client;
}

const ApproveInvoices: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BillableItemWithDetails[]>([]);
  const [approvingItemId, setApprovingItemId] = useState<number | null>(null);
  const [rejectingItemId, setRejectingItemId] = useState<number | null>(null);
  // Bank the approver picks per item — required before approval.
  const [bankByItem, setBankByItem] = useState<Record<number, string>>({});
  // Full billable list, kept for sequential invoice numbering.
  const [allItems, setAllItems] = useState<BillableItem[]>([]);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [billableItems, clients, projects] = await Promise.all([
        getBillableItems(),
        getClients(),
        getProjects()
      ]);

      setAllItems(billableItems);

      // Filter items that are pending approval or approved
      const relevantItems = billableItems.filter(item =>
        item.status === 'PENDING'  // Only show PENDING items
      );

      // Add project and client details to each item
      const itemsWithDetails: BillableItemWithDetails[] = relevantItems.map(item => {
        const project = projects.find(p => p.id === item.project_id);
        return {
          ...item,
          project,
          client: clients.find(c => c.id === project?.client_id)
        };
      });

      setItems(itemsWithDetails);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (itemId: number) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      const bankId = bankByItem[itemId];
      const bank = getBank(bankId);
      if (!bankId || !bank) {
        alert('Please select a bank account before approving this invoice.');
        return;
      }
      if (!item.project || !item.client) {
        alert('This item is missing its project/client and cannot be invoiced.');
        return;
      }

      setApproving(true);

      // Invoice date = approval date (today). Number = next in that month's series.
      const now = new Date();
      const approvalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const invoiceNo = item.invoice_number || generateInvoiceNumber(approvalDate, allItems);

      // updateBillableItem merges, so we only send the changed fields.
      const updatedItem = {
        id: item.id,
        project_id: item.project_id,
        name: item.name,
        type: item.type,
        po_number: item.po_number,
        po_end_date: item.po_end_date,
        po_document_url: item.po_document_url,
        proposal_document_url: item.proposal_document_url,
        start_date: item.start_date,
        end_date: item.end_date,
        amount: item.amount,
        invoice_number: invoiceNo,
        invoice_date: approvalDate,
        status: 'APPROVED' as const,
        bank_account: bankId,
      } as BillableItem;

      await updateBillableItem(itemId, updatedItem);

      // Generate and download the invoice PDF in the standard format.
      const data = buildInvoiceData(updatedItem, item.project, item.client, bank, invoiceNo);
      const blob = await pdf(<InvoiceDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Keep the new number in allItems so the next approval increments correctly.
      setAllItems(prev => prev.map(i => (i.id === itemId ? { ...i, invoice_number: invoiceNo } : i)));
      setItems(items.filter(i => i.id !== itemId));
      setApprovingItemId(null);
    } catch (error) {
      console.error('Failed to approve item:', error);
      alert('Failed to approve / generate the invoice. See console for details.');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (itemId: number) => {
    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      // Create a new object with only the BillableItem properties
      const updatedItem: BillableItem = {
        id: item.id,
        project_id: item.project_id,
        name: item.name,
        type: item.type,
        po_number: item.po_number,
        po_end_date: item.po_end_date,
        po_document_url: item.po_document_url,
        proposal_document_url: item.proposal_document_url,
        invoice_number: item.invoice_number,
        invoice_document_url: item.invoice_document_url,
        start_date: item.start_date,
        end_date: item.end_date,
        amount: item.amount,
        invoice_date: item.invoice_date,
        status: 'NOT_APPROVED'
      };

      await updateBillableItem(itemId, updatedItem);
      setItems(items.filter(i => i.id !== itemId));
      setRejectingItemId(null);
    } catch (error) {
      console.error('Failed to reject item:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/invoices')} 
            className="btn btn-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Approve Invoices
          </h1>
        </div>
      </div>

      <div className="mt-8">
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Client
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Project
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Item Name
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    PO Number
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Period
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                    Amount
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Documents
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Bank Account <span className="text-red-500">*</span>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4 text-sm text-gray-900">
                      {item.client?.legal_name}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900">
                      {item.project?.name}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {item.type.replace('_', ' ')}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {item.po_document_url ? (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDocumentClick(item.po_document_url!);
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          {item.po_number}
                        </a>
                      ) : (
                        item.po_number || '-'
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900 text-right">
                      ₹{item.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        {item.po_document_url && (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDocumentClick(item.po_document_url!);
                            }}
                            className="flex items-center gap-1 text-primary-600 hover:text-primary-900"
                            title="View PO Document"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-xs">PO</span>
                          </a>
                        )}
                        {item.proposal_document_url && (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDocumentClick(item.proposal_document_url!);
                            }}
                            className="flex items-center gap-1 text-primary-600 hover:text-primary-900"
                            title="View Proposal"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-xs">Proposal</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <select
                        value={bankByItem[item.id] || ''}
                        onChange={(e) =>
                          setBankByItem(prev => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="form-select w-full min-w-[180px] rounded-lg border-gray-300 py-1.5 text-sm"
                      >
                        <option value="">Select bank…</option>
                        {BANK_ACCOUNTS.map(b => (
                          <option key={b.id} value={b.id}>{b.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setApprovingItemId(item.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setRejectingItemId(item.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No pending invoices to approve.</p>
          </div>
        )}
      </div>

      {/* Approve Confirmation Modal */}
      {approvingItemId && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Approve &amp; Generate Invoice
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              The invoice will be dated today, numbered automatically, and the PDF
              will download using the selected bank account.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setApprovingItemId(null)}
                className="btn btn-secondary"
                disabled={approving}
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(approvingItemId)}
                className="btn btn-primary"
                disabled={approving}
              >
                {approving ? 'Generating…' : 'Approve & Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectingItemId && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Reject Invoice
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to reject this invoice? This will set the status back to NOT_APPROVED.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectingItemId(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectingItemId)}
                className="btn btn-danger"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApproveInvoices; 