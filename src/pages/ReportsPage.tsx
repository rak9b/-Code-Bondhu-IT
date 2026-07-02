import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  BarChart3, Loader2, Package, Users, Truck, ShoppingCart, Receipt, Printer, RefreshCw,
} from 'lucide-react';

export function ReportsPage() {
  const [activeReport, setActiveReport] = useState<'product' | 'customer' | 'supplier' | 'purchase' | 'sales'>('product');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `${activeReport.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}`,
  });

  useEffect(() => {
    fetchReportData();
  }, [activeReport]);

  async function fetchReportData() {
    setLoading(true);
    setError('');
    try {
      if (activeReport === 'product') {
        const { data: res, error: err } = await supabase
          .from('products')
          .select('*')
          .order('name');
        if (err) throw err;
        setData(res ?? []);
      } else if (activeReport === 'customer') {
        const [custRes, salesRes] = await Promise.all([
          supabase.from('customers').select('*').order('name'),
          supabase.from('sales').select('customer_id, total_amount')
        ]);
        if (custRes.error) throw custRes.error;
        if (salesRes.error) throw salesRes.error;

        const mapped = (custRes.data ?? []).map((c: any) => {
          const cSales = (salesRes.data ?? []).filter((s: any) => s.customer_id === c.id);
          const totalSpent = cSales.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
          return {
            ...c,
            totalOrders: cSales.length,
            totalSpent
          };
        });
        setData(mapped);
      } else if (activeReport === 'supplier') {
        const [suppRes, purchRes] = await Promise.all([
          supabase.from('suppliers').select('*').order('name'),
          supabase.from('purchases').select('supplier_id, total_amount')
        ]);
        if (suppRes.error) throw suppRes.error;
        if (purchRes.error) throw purchRes.error;

        const mapped = (suppRes.data ?? []).map((s: any) => {
          const sPurchases = (purchRes.data ?? []).filter((p: any) => p.supplier_id === s.id);
          const totalCost = sPurchases.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0);
          return {
            ...s,
            totalPurchases: sPurchases.length,
            totalCost
          };
        });
        setData(mapped);
      } else if (activeReport === 'purchase') {
        const { data: res, error: err } = await supabase
          .from('purchases')
          .select('*, suppliers(name), purchase_items(quantity)')
          .order('created_at', { ascending: false });
        if (err) throw err;
        setData(res ?? []);
      } else if (activeReport === 'sales') {
        const { data: res, error: err } = await supabase
          .from('sales')
          .select('*, customers(name), sale_items(quantity)')
          .order('created_at', { ascending: false });
        if (err) throw err;
        setData(res ?? []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  }

  // Summary Calculations
  const getSummaries = () => {
    switch (activeReport) {
      case 'product':
        const totalStock = data.reduce((sum, p) => sum + (p.stock || 0), 0);
        const totalValuation = data.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
        const lowStockCount = data.filter(p => (p.stock || 0) < 10).length;
        return [
          { title: 'Total Unique Products', value: data.length, icon: Package, color: 'text-blue-400' },
          { title: 'Total Stock Quantity', value: totalStock, icon: Package, color: 'text-purple-400' },
          { title: 'Total Valuation', value: formatCurrency(totalValuation), icon: BarChart3, color: 'text-green-400' },
          { title: 'Low Stock Alerts', value: lowStockCount, icon: BarChart3, color: 'text-yellow-400' }
        ];
      case 'customer':
        const totalCustomers = data.length;
        const totalSpent = data.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
        const avgSpent = totalCustomers > 0 ? totalSpent / totalCustomers : 0;
        return [
          { title: 'Total Customers', value: totalCustomers, icon: Users, color: 'text-purple-400' },
          { title: 'Total Customer Lifetime Value', value: formatCurrency(totalSpent), icon: Receipt, color: 'text-green-400' },
          { title: 'Avg. Revenue per Customer', value: formatCurrency(avgSpent), icon: BarChart3, color: 'text-blue-400' }
        ];
      case 'supplier':
        const totalSuppliers = data.length;
        const totalCost = data.reduce((sum, s) => sum + (s.totalCost || 0), 0);
        const totalPurchasesCount = data.reduce((sum, s) => sum + (s.totalPurchases || 0), 0);
        return [
          { title: 'Total Suppliers', value: totalSuppliers, icon: Truck, color: 'text-orange-400' },
          { title: 'Total Procurement Cost', value: formatCurrency(totalCost), icon: ShoppingCart, color: 'text-red-400' },
          { title: 'Total Purchase Orders', value: totalPurchasesCount, icon: ShoppingCart, color: 'text-blue-400' }
        ];
      case 'purchase':
        const totalPurchases = data.length;
        const totalProcurement = data.reduce((sum, p) => sum + (p.total_amount || 0), 0);
        const avgPurchase = totalPurchases > 0 ? totalProcurement / totalPurchases : 0;
        return [
          { title: 'Total Purchase Orders', value: totalPurchases, icon: ShoppingCart, color: 'text-blue-400' },
          { title: 'Total Spend', value: formatCurrency(totalProcurement), icon: BarChart3, color: 'text-red-400' },
          { title: 'Avg. Purchase Cost', value: formatCurrency(avgPurchase), icon: ShoppingCart, color: 'text-purple-400' }
        ];
      case 'sales':
        const totalSales = data.length;
        const totalRevenue = data.reduce((sum, s) => sum + (s.total_amount || 0), 0);
        const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;
        return [
          { title: 'Total Sales Transactions', value: totalSales, icon: Receipt, color: 'text-pink-400' },
          { title: 'Total Revenue', value: formatCurrency(totalRevenue), icon: BarChart3, color: 'text-green-400' },
          { title: 'Avg. Sale Value', value: formatCurrency(avgSale), icon: Receipt, color: 'text-blue-400' }
        ];
      default:
        return [];
    }
  };

  const tabs: Array<{ id: typeof activeReport; label: string }> = [
    { id: 'product', label: 'Product Report' },
    { id: 'customer', label: 'Customer Report' },
    { id: 'supplier', label: 'Supplier Report' },
    { id: 'purchase', label: 'Purchase Report' },
    { id: 'sales', label: 'Sales Report' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Generate and print detailed business reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchReportData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => handlePrint()} className="gap-2" disabled={loading || data.length === 0}>
            <Printer className="h-4 w-4" /> Print / Export Report
          </Button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            variant={activeReport === tab.id ? 'default' : 'ghost'}
            className={`rounded-lg transition-all duration-200 ${activeReport === tab.id ? 'shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveReport(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-red-400">
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-red-400" />
          <span>Error loading report: {error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {getSummaries().map((summary, idx) => {
              const Icon = summary.icon;
              return (
                <Card key={idx} className="glass border-border/50">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{summary.title}</p>
                      <p className="text-2xl font-bold mt-1 text-foreground">{summary.value}</p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg bg-sidebar-accent flex items-center justify-center ${summary.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Table Container */}
          <Card className="glass border-border/50">
            <div ref={reportRef} className="p-6 space-y-4 print:p-8 print:bg-white print:text-black">
              {/* Print Only Header */}
              <div className="hidden print:flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Code Bondhu IT ERP</h1>
                  <p className="text-xs text-gray-500">Official Business Report</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-gray-700 capitalize">{activeReport} Report</h2>
                  <p className="text-xs text-gray-500">Generated on: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    {activeReport === 'product' && (
                      <TableRow className="print:border-b-2 print:border-gray-300">
                        <TableHead className="print:text-gray-700">Product Name</TableHead>
                        <TableHead className="print:text-gray-700">SKU</TableHead>
                        <TableHead className="print:text-gray-700">Category</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Price</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Stock</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Total Value</TableHead>
                        <TableHead className="print:text-gray-700">Status</TableHead>
                      </TableRow>
                    )}
                    {activeReport === 'customer' && (
                      <TableRow className="print:border-b-2 print:border-gray-300">
                        <TableHead className="print:text-gray-700">Customer Name</TableHead>
                        <TableHead className="print:text-gray-700">Email</TableHead>
                        <TableHead className="print:text-gray-700">Phone</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Orders</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Total Spent</TableHead>
                      </TableRow>
                    )}
                    {activeReport === 'supplier' && (
                      <TableRow className="print:border-b-2 print:border-gray-300">
                        <TableHead className="print:text-gray-700">Supplier Name</TableHead>
                        <TableHead className="print:text-gray-700">Contact Person</TableHead>
                        <TableHead className="print:text-gray-700">Phone</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Purchases</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Total Value</TableHead>
                      </TableRow>
                    )}
                    {activeReport === 'purchase' && (
                      <TableRow className="print:border-b-2 print:border-gray-300">
                        <TableHead className="print:text-gray-700">Date</TableHead>
                        <TableHead className="print:text-gray-700">Purchase ID</TableHead>
                        <TableHead className="print:text-gray-700">Supplier</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Items</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Total Amount</TableHead>
                        <TableHead className="print:text-gray-700">Notes</TableHead>
                      </TableRow>
                    )}
                    {activeReport === 'sales' && (
                      <TableRow className="print:border-b-2 print:border-gray-300">
                        <TableHead className="print:text-gray-700">Date</TableHead>
                        <TableHead className="print:text-gray-700">Sale ID</TableHead>
                        <TableHead className="print:text-gray-700">Customer</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Items</TableHead>
                        <TableHead className="print:text-gray-700 text-right">Total Amount</TableHead>
                        <TableHead className="print:text-gray-700">Status</TableHead>
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground print:text-gray-500">
                          No records found for this report.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {activeReport === 'product' && data.map((p: any) => (
                          <TableRow key={p.id} className="print:border-b print:border-gray-200">
                            <TableCell className="font-medium print:text-gray-800">{p.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground print:text-gray-600">{p.sku}</TableCell>
                            <TableCell className="print:text-gray-800">{p.category}</TableCell>
                            <TableCell className="text-right text-green-400 font-semibold print:text-gray-800">{formatCurrency(p.price)}</TableCell>
                            <TableCell className="text-right print:text-gray-800">{p.stock}</TableCell>
                            <TableCell className="text-right text-blue-400 font-semibold print:text-gray-800">{formatCurrency(p.stock * p.price)}</TableCell>
                            <TableCell>
                              <Badge variant={p.stock === 0 ? 'destructive' : p.stock < 10 ? 'warning' : 'success'} className="print:border print:border-gray-300 print:text-gray-700 print:bg-white">
                                {p.stock === 0 ? 'Out of stock' : p.stock < 10 ? 'Low Stock' : 'In Stock'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {activeReport === 'customer' && data.map((c: any) => (
                          <TableRow key={c.id} className="print:border-b print:border-gray-200">
                            <TableCell className="font-medium print:text-gray-800">{c.name}</TableCell>
                            <TableCell className="text-muted-foreground print:text-gray-600">{c.email ?? '—'}</TableCell>
                            <TableCell className="text-muted-foreground print:text-gray-600">{c.phone ?? '—'}</TableCell>
                            <TableCell className="text-right print:text-gray-800">{c.totalOrders}</TableCell>
                            <TableCell className="text-right text-green-400 font-semibold print:text-gray-800">{formatCurrency(c.totalSpent)}</TableCell>
                          </TableRow>
                        ))}
                        {activeReport === 'supplier' && data.map((s: any) => (
                          <TableRow key={s.id} className="print:border-b print:border-gray-200">
                            <TableCell className="font-medium print:text-gray-800">{s.name}</TableCell>
                            <TableCell className="text-muted-foreground print:text-gray-600">{s.contact_person ?? '—'}</TableCell>
                            <TableCell className="text-muted-foreground print:text-gray-600">{s.phone ?? '—'}</TableCell>
                            <TableCell className="text-right print:text-gray-800">{s.totalPurchases}</TableCell>
                            <TableCell className="text-right text-blue-400 font-semibold print:text-gray-800">{formatCurrency(s.totalCost)}</TableCell>
                          </TableRow>
                        ))}
                        {activeReport === 'purchase' && data.map((p: any) => (
                          <TableRow key={p.id} className="print:border-b print:border-gray-200">
                            <TableCell className="text-muted-foreground text-xs print:text-gray-600">{formatDate(p.created_at)}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground print:text-gray-600">{p.id.slice(0, 8).toUpperCase()}</TableCell>
                            <TableCell className="font-medium print:text-gray-800">{p.suppliers?.name ?? '—'}</TableCell>
                            <TableCell className="text-right print:text-gray-800">{p.purchase_items?.length ?? 0}</TableCell>
                            <TableCell className="text-right text-blue-400 font-semibold print:text-gray-800">{formatCurrency(p.total_amount)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate print:text-gray-700">{p.notes ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                        {activeReport === 'sales' && data.map((s: any) => (
                          <TableRow key={s.id} className="print:border-b print:border-gray-200">
                            <TableCell className="text-muted-foreground text-xs print:text-gray-600">{formatDate(s.created_at)}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground print:text-gray-600">{s.id.slice(0, 8).toUpperCase()}</TableCell>
                            <TableCell className="font-medium print:text-gray-800">{s.customers?.name ?? '—'}</TableCell>
                            <TableCell className="text-right print:text-gray-800">{s.sale_items?.length ?? 0}</TableCell>
                            <TableCell className="text-right text-green-400 font-semibold print:text-gray-800">{formatCurrency(s.total_amount)}</TableCell>
                            <TableCell>
                              <Badge variant={s.status === 'completed' ? 'success' : 'warning'} className="print:border print:border-gray-300 print:text-gray-700 print:bg-white">
                                {s.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Print Only Footer */}
              <div className="hidden print:block text-center text-xs text-gray-400 border-t pt-4 mt-8">
                <p>This business intelligence report is confidential and generated directly from the mini ERP core database.</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
