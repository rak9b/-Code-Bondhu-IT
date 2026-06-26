import { useDashboardStats } from '../hooks/useDashboardStats';
import { formatCurrency } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { BarChart3, Loader2, TrendingUp, TrendingDown, Package, Users, Truck } from 'lucide-react';

function ReportRow({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {badge && <Badge variant="secondary">{badge}</Badge>}
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { stats, loading } = useDashboardStats();

  const profitMargin = stats.totalRevenue > 0
    ? ((stats.totalRevenue - stats.totalPurchaseAmount) / stats.totalRevenue * 100).toFixed(1)
    : '0';

  const profit = stats.totalRevenue - stats.totalPurchaseAmount;
  const isProfitable = profit >= 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground mt-1">Business analytics & summary</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Financial Summary */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReportRow label="Total Revenue" value={formatCurrency(stats.totalRevenue)} />
              <ReportRow label="Total Purchases (Cost)" value={formatCurrency(stats.totalPurchaseAmount)} />
              <ReportRow
                label="Gross Profit"
                value={formatCurrency(profit)}
              />
              <div className="flex items-center justify-between py-3 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Profit Margin</span>
                <div className="flex items-center gap-2">
                  {isProfitable
                    ? <TrendingUp className="h-4 w-4 text-green-400" />
                    : <TrendingDown className="h-4 w-4 text-red-400" />
                  }
                  <span className={`text-sm font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                    {profitMargin}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Summary */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-blue-400" />
                Inventory Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReportRow label="Total Products" value={String(stats.totalProducts)} />
              <ReportRow label="Low Stock Items" value={String(stats.lowStockProducts.length)} badge={stats.lowStockProducts.length > 0 ? 'Alert' : undefined} />
              <ReportRow label="Total Sales Transactions" value={String(stats.totalSales)} />
              <ReportRow label="Total Purchase Orders" value={String(stats.totalPurchases)} />
            </CardContent>
          </Card>

          {/* CRM Summary */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-purple-400" />
                CRM Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReportRow label="Total Customers" value={String(stats.totalCustomers)} />
              <ReportRow
                label="Average Sale Value"
                value={stats.totalSales > 0 ? formatCurrency(stats.totalRevenue / stats.totalSales) : '—'}
              />
            </CardContent>
          </Card>

          {/* Supply Chain */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-orange-400" />
                Supply Chain Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReportRow label="Total Suppliers" value={String(stats.totalSuppliers)} />
              <ReportRow label="Total Purchase Orders" value={String(stats.totalPurchases)} />
              <ReportRow label="Total Procurement Cost" value={formatCurrency(stats.totalPurchaseAmount)} />
              <ReportRow
                label="Avg. Purchase Order Value"
                value={stats.totalPurchases > 0 ? formatCurrency(stats.totalPurchaseAmount / stats.totalPurchases) : '—'}
              />
            </CardContent>
          </Card>

          {/* Low Stock Details */}
          {stats.lowStockProducts.length > 0 && (
            <Card className="glass border-border/50 col-span-full">
              <CardHeader>
                <CardTitle className="text-base text-yellow-400">⚠ Low Stock Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {stats.lowStockProducts.map(product => (
                    <div key={product.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                      <p className="text-lg font-bold text-yellow-400 mt-1">{product.stock}</p>
                      <p className="text-xs text-muted-foreground">units left</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
