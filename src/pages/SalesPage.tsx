import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Product, Customer } from '../types/database';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Plus, Search, Receipt, Loader2, AlertCircle, X, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';

interface SaleItem { product_id: string; product_name: string; quantity: number; unit_price: number; stock: number; }

interface SaleWithCustomer {
  id: string; created_at: string; total_amount: number; status: string; notes: string | null;
  customers: { name: string } | null;
  sale_items: Array<{ id: string; quantity: number; unit_price: number; products: { name: string; sku: string } | null }>;
}

export function SalesPage() {
  const [sales, setSales] = useState<SaleWithCustomer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSales();
    supabase.from('products').select('*').order('name').then(r => setProducts(r.data ?? []));
    supabase.from('customers').select('*').order('name').then(r => setCustomers(r.data ?? []));
  }, []);

  async function fetchSales() {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*, customers(name), sale_items(id, quantity, unit_price, products(name, sku))')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setSales(data as SaleWithCustomer[] ?? []);
    setLoading(false);
  }

  function addItem() {
    const product = products.find(p => p.id === selectedProduct);
    if (!product || !qty) return;
    const quantity = parseInt(qty);
    if (quantity > product.stock) {
      setError(`Insufficient stock. Available: ${product.stock}`);
      return;
    }
    const exists = items.findIndex(i => i.product_id === product.id);
    if (exists >= 0) {
      setItems(prev => prev.map((item, idx) =>
        idx === exists ? { ...item, quantity: item.quantity + quantity } : item
      ));
    } else {
      setItems(prev => [...prev, {
        product_id: product.id, product_name: product.name,
        quantity, unit_price: product.price, stock: product.stock,
      }]);
    }
    setSelectedProduct(''); setQty('1'); setError('');
  }

  function removeItem(index: number) { setItems(prev => prev.filter((_, i) => i !== index)); }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  /**
   * Creates sale using Supabase RPC for atomicity.
   * Falls back to manual transaction if RPC not set up.
   */
  async function handleSave() {
    if (!customerId || items.length === 0) return;
    setSaving(true);
    setError('');

    // Try using RPC (atomic transaction)
    const { data: saleId, error: rpcError } = await supabase.rpc('create_sale_with_items', {
      p_customer_id: customerId,
      p_total_amount: total,
      p_notes: notes || null,
      p_items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
    });

    if (rpcError) {
      // Fallback: manual multi-step (no rollback, but functional)
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({ customer_id: customerId, total_amount: total, notes: notes || null, status: 'completed' })
        .select().single();

      if (saleError || !saleData) {
        setError(saleError?.message ?? 'Failed to create sale');
        setSaving(false);
        return;
      }

      const { error: itemsError } = await supabase.from('sale_items').insert(
        items.map(item => ({ sale_id: saleData.id, product_id: item.product_id, quantity: item.quantity, unit_price: item.unit_price }))
      );

      if (itemsError) { setError(itemsError.message); setSaving(false); return; }

      for (const item of items) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await supabase.from('products')
            .update({ stock: product.stock - item.quantity, updated_at: new Date().toISOString() })
            .eq('id', item.product_id);
        }
      }
    }

    setDialogOpen(false);
    setCustomerId(''); setNotes(''); setItems([]);
    fetchSales();
    supabase.from('products').select('*').order('name').then(r => setProducts(r.data ?? []));
    setSaving(false);
  }

  const filtered = sales.filter(s =>
    (s.customers?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales</h1>
          <p className="text-muted-foreground mt-1">Manage sales transactions</p>
        </div>
        <Button onClick={() => { setItems([]); setCustomerId(''); setNotes(''); setError(''); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Sale
        </Button>
      </div>

      {error && !dialogOpen && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      <Card className="glass border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by customer..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <CardTitle className="text-sm text-muted-foreground ml-auto">{filtered.length} sales</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
              <Receipt className="h-12 w-12 opacity-30" /><p>No sales yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.customers?.name ?? '—'}</TableCell>
                    <TableCell><Badge variant="secondary">{s.sale_items?.length ?? 0} items</Badge></TableCell>
                    <TableCell className="font-semibold text-green-400">{formatCurrency(s.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'completed' ? 'success' : 'warning'}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(s.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Link to={`/sales/${s.id}/invoice`}>
                        <Button variant="ghost" size="icon" title="View Invoice">
                          <FileText className="h-4 w-4 text-primary" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Sale Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Sale</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" />{error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="border border-border rounded-lg p-4 space-y-3">
              <Label className="text-sm font-semibold">Add Products</Label>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-7">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id} disabled={p.stock === 0}>
                          {p.name} — {formatCurrency(p.price)} (Stock: {p.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input type="number" min="1" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Button onClick={addItem} className="w-full" disabled={!selectedProduct || !qty}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {items.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="font-semibold text-green-400">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-destructive h-8 w-8">
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold text-right">Total:</TableCell>
                      <TableCell className="font-bold text-green-400">{formatCurrency(total)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !customerId || items.length === 0}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : `Complete Sale (${formatCurrency(total)})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
