import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Printer, Loader2, AlertCircle, BarChart3 } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';

interface InvoiceData {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  notes: string | null;
  customers: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  sale_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    products: { name: string; sku: string } | null;
  }>;
}

export function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice-${id?.slice(0, 8).toUpperCase()}`,
  });

  useEffect(() => {
    if (!id) return;
    supabase
      .from('sales')
      .select('*, customers(name, email, phone, address), sale_items(id, quantity, unit_price, products(name, sku))')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setInvoice(data as InvoiceData);
        setLoading(false);
      });
  }, [id]);

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error || !invoice) return (
    <div className="flex h-full items-center justify-center flex-col gap-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <p className="text-destructive">{error || 'Invoice not found'}</p>
      <Link to="/sales"><Button variant="outline">Back to Sales</Button></Link>
    </div>
  );

  const invoiceNumber = `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
  const subtotal = invoice.sale_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <Link to="/sales">
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to Sales</Button>
        </Link>
        <Button onClick={() => handlePrint()} className="gap-2">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      {/* Printable Invoice */}
      <div ref={printRef} className="max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl print:shadow-none print:border-gray-200 print:rounded-none">

          {/* Header */}
          <div className="bg-gradient-to-r from-primary/20 to-violet-500/20 p-8 print:bg-blue-50">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center print:bg-blue-100 print:border-blue-200">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gradient print:text-blue-600">NexusERP</h1>
                  <p className="text-xs text-muted-foreground print:text-gray-500">Enterprise Resource Planning</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-bold text-foreground print:text-gray-800">INVOICE</h2>
                <p className="text-primary font-mono font-semibold mt-1 print:text-blue-600">{invoiceNumber}</p>
                <Badge variant={invoice.status === 'completed' ? 'success' : 'warning'} className="mt-2 print:border print:border-green-500 print:text-green-600">
                  {invoice.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          {/* Bill To / Invoice Info */}
          <div className="p-8 grid grid-cols-2 gap-8 border-b border-border print:border-gray-200">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-gray-500">Bill To</p>
              <p className="font-bold text-lg text-foreground print:text-gray-800">{invoice.customers?.name ?? 'N/A'}</p>
              {invoice.customers?.email && <p className="text-sm text-muted-foreground mt-1 print:text-gray-600">{invoice.customers.email}</p>}
              {invoice.customers?.phone && <p className="text-sm text-muted-foreground print:text-gray-600">{invoice.customers.phone}</p>}
              {invoice.customers?.address && <p className="text-sm text-muted-foreground mt-1 print:text-gray-600">{invoice.customers.address}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-gray-500">Invoice Details</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-gray-500">Invoice #:</span>
                  <span className="font-mono font-semibold print:text-gray-800">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-gray-500">Date:</span>
                  <span className="print:text-gray-800">{formatDate(invoice.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground print:text-gray-500">Status:</span>
                  <span className="font-semibold text-green-400 print:text-green-600">{invoice.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border print:border-gray-200">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3 print:text-gray-500">Product</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3 print:text-gray-500">SKU</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3 print:text-gray-500">Qty</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3 print:text-gray-500">Unit Price</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3 print:text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.sale_items.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 print:border-gray-100">
                    <td className="py-3 text-sm font-medium text-foreground print:text-gray-800">{item.products?.name ?? 'Unknown'}</td>
                    <td className="py-3 text-sm font-mono text-muted-foreground print:text-gray-500">{item.products?.sku ?? '—'}</td>
                    <td className="py-3 text-sm text-right text-foreground print:text-gray-800">{item.quantity}</td>
                    <td className="py-3 text-sm text-right text-foreground print:text-gray-800">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 text-sm text-right font-semibold text-foreground print:text-gray-800">{formatCurrency(item.quantity * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-6 ml-auto max-w-xs space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground print:text-gray-500">Subtotal</span>
                <span className="print:text-gray-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground print:text-gray-500">Tax (0%)</span>
                <span className="print:text-gray-800">{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 print:border-gray-300 print:text-gray-800">
                <span>Total</span>
                <span className="text-primary print:text-blue-600">{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-8 p-4 bg-accent/50 rounded-lg border border-border print:bg-gray-50 print:border-gray-200">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 print:text-gray-500">Notes</p>
                <p className="text-sm text-foreground print:text-gray-700">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 pb-8 text-center">
            <p className="text-xs text-muted-foreground print:text-gray-400">
              Thank you for your business. This invoice was generated by NexusERP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
