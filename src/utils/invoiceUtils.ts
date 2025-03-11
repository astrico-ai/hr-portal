import { BillableItem, Client, Project } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerAddress: string;
  customerGST: string;
  description: string;
  amount: number;
  startDate: string;
  endDate: string;
  poNumber?: string;
  poEndDate?: string;
}

const COMPANY_DETAILS = {
  name: 'NV360',
  address: '123 Business Street, City, State, PIN',
  gst: '29XXXXXXXXX',
  hsn: '6201',
  bankDetails: {
    name: 'Bank Name',
    account: 'XXXXXXXXXXXX',
    ifsc: 'XXXX0000000',
    branch: 'Branch Name'
  }
};

export const generateInvoice = (data: InvoiceData): string => {
  const gstAmount = data.amount * 0.18;
  const totalAmount = data.amount + gstAmount;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-details { margin-bottom: 20px; }
        .invoice-details { margin-bottom: 20px; }
        .customer-details { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 8px; border: 1px solid #ddd; }
        th { background-color: #f5f5f5; }
        .amount-details { margin-top: 20px; }
        .bank-details { margin-top: 30px; }
        .footer { margin-top: 50px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>TAX INVOICE</h1>
        <h2>${COMPANY_DETAILS.name}</h2>
      </div>

      <div class="company-details">
        <p>${COMPANY_DETAILS.address}</p>
        <p>GST: ${COMPANY_DETAILS.gst}</p>
        <p>HSN: ${COMPANY_DETAILS.hsn}</p>
      </div>

      <div class="invoice-details">
        <p>Invoice No: ${data.invoiceNumber}</p>
        <p>Date: ${new Date(data.invoiceDate).toLocaleDateString()}</p>
        ${data.poNumber ? `<p>PO No: ${data.poNumber}</p>` : ''}
        ${data.poEndDate ? `<p>PO End Date: ${new Date(data.poEndDate).toLocaleDateString()}</p>` : ''}
      </div>

      <div class="customer-details">
        <h3>Bill To:</h3>
        <p>${data.customerName}</p>
        <p>${data.customerAddress}</p>
        ${data.customerGST ? `<p>GST: ${data.customerGST}</p>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Period</th>
            <th>Amount</th>
            <th>GST (18%)</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${data.description}</td>
            <td>${new Date(data.startDate).toLocaleDateString()} - ${new Date(data.endDate).toLocaleDateString()}</td>
            <td>₹${data.amount.toLocaleString()}</td>
            <td>₹${gstAmount.toLocaleString()}</td>
            <td>₹${totalAmount.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div class="amount-details">
        <p>Sub Total: ₹${data.amount.toLocaleString()}</p>
        <p>GST (18%): ₹${gstAmount.toLocaleString()}</p>
        <p><strong>Total Amount: ₹${totalAmount.toLocaleString()}</strong></p>
      </div>

      <div class="bank-details">
        <h3>Bank Details:</h3>
        <p>Bank Name: ${COMPANY_DETAILS.bankDetails.name}</p>
        <p>Account No: ${COMPANY_DETAILS.bankDetails.account}</p>
        <p>IFSC: ${COMPANY_DETAILS.bankDetails.ifsc}</p>
        <p>Branch: ${COMPANY_DETAILS.bankDetails.branch}</p>
      </div>

      <div class="footer">
        <p>This is a computer generated invoice</p>
        <p>Thank you for your business!</p>
      </div>
    </body>
    </html>
  `;
};

export const createInvoiceDocument = async (
  billableItem: BillableItem,
  client: Client,
  project: Project
): Promise<Blob> => {
  const invoiceData: InvoiceData = {
    invoiceNumber: billableItem.invoice_number || '',
    invoiceDate: billableItem.invoice_date || new Date().toISOString(),
    customerName: client.legal_name,
    customerAddress: client.legal_name,
    customerGST: client.gst_number || '',
    description: billableItem.name,
    amount: billableItem.amount,
    startDate: billableItem.start_date,
    endDate: billableItem.end_date,
    poNumber: billableItem.po_number || undefined,
    poEndDate: billableItem.po_end_date || undefined
  };

  // Generate invoice HTML
  const invoiceHtml = generateInvoice(invoiceData);
  
  // Create a temporary container for the HTML
  const container = document.createElement('div');
  container.innerHTML = invoiceHtml;
  document.body.appendChild(container);

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2, // Higher scale for better quality
      logging: false,
      useCORS: true
    });

    // Remove the temporary container
    document.body.removeChild(container);

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4'
    });

    // Calculate dimensions
    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Add the image to PDF
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 1.0),
      'JPEG',
      0,
      0,
      imgWidth,
      imgHeight
    );

    // Convert to blob
    const pdfBlob = pdf.output('blob');
    return new Blob([pdfBlob], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}; 