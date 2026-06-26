import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Product, Supplier } from '../types/database';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Plus, Trash2, Search, ShoppingCart, Loader2, AlertCircle, X } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';

interface PurchaseItem { product_id: string; product_name: string; quantity: number; unit_cost: number; }

interface PurchaseWithSupplier {
  id: string; created_at: string; total_amount: number; notes: string | null;
  suppliers: { name: string } | null;
  purchase_items: Array<{ id: string; quantity: number; unit_cost: number; products: { name: string; sku: string } | null }>;
}

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseWithSupplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('1');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPurchases();
    supabase.from('products').select('*').order('name').then(r => setProducts(r.data ?? []));
    supabase.from('suppliers').select('*').order('name').then(r => setSuppliers(r.data ?? []));
  }, []);

  async function fetchPurchases() {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchases')
      .select('*, suppliers(name), purchase_items(id, quantity, unit_cost, products(name, sku))')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setPurchases(data as PurchaseWithSupplier[] ?? []);
    setLoading(false);
  }

  function addItem() {
    const product = products.find(p => p.id === selectedProduct);
    if (!product || !qty || !cost) return;
    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      quantity: parseInt(qty),
      unit_cost: parseFloat(cost),
    }]);
    setSelectedProduct('');
    setQty('1');
    setCost('');
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

  async function handleSave() {
    if (!supplierId || items.length === 0) return;
    setSaving(true);
    setError('');

    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .insert({ supplier_id: supplierId, total_amount: total, notes: notes || null })
      .select()
      .single();

    if (purchaseError || !purchaseData) {
      setError(purchaseError?.message ?? 'Failed to create purchase');
      setSaving(false);
      return;
    }

    // Insert items and update stock
    const itemInserts = items.map(item => ({
      purchase_id: purchaseData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
    }));

    const { error: itemsError } = await supabase.from('purchase_items').insert(itemInserts);
    if (itemsError) {
      setError(itemsError.message);
      setSaving(false);
      return;
    }

    // Update stock for each product
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        await supabase.from('products')
          .update({ stock: product.stock + item.quantity, updated_at: new Date().toISOString() })
          .eq('id', item.product_id);
      }
    }

    setDialogOpen(false);
    setSupplierId('');
    setNotes('');
    setItems([]);
    fetchPurchases();
    // Re-fetch products to get updated stock
    supabase.from('products').select('*').order('name').then(r => setProducts(r.data ?? []));
    setSaving(false);
  }

  const filtered = purchases.filter(p =>
    (p.suppliers?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchases</h1>
          <p className="text-muted-foreground mt-1">Manage stock procurement</p>
        </div>
        <Button onClick={() => { setItems([]); setSupplierId(''); setNotes(''); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Purchase
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      <Card className="glass border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by supplier..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <CardTitle className="text-sm text-muted-foreground ml-auto">{filtered.length} purchases</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 opacity-30" /><p>No purchases yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.suppliers?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.purchase_items?.length ?? 0} items</Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-blue-400">{formatCurrency(p.total_amount)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{p.notes ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(p.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Purchase Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            {/* Add item row */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <Label className="text-sm font-semibold">Add Items</Label>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Select value={selectedProduct} onValueChange={(v) => {
                    setSelectedProduct(v);
                    const p = products.find(p => p.id === v);
                    if (p) setCost(String(p.price));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input type="number" min="1" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} />
                </div>
                <div className="col-span-3">
                  <Input type="number" min="0" step="0.01" placeholder="Cost/unit" value={cost} onChange={e => setCost(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Button onClick={addItem} className="w-full" disabled={!selectedProduct || !qty || !cost}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Items list */}
            {items.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(item.unit_cost)}</TableCell>
                        <TableCell className="font-semibold text-blue-400">{formatCurrency(item.quantity * item.unit_cost)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-destructive h-8 w-8">
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold text-right">Total:</TableCell>
                      <TableCell className="font-bold text-blue-400">{formatCurrency(total)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !supplierId || items.length === 0}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : `Save Purchase (${formatCurrency(total)})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
