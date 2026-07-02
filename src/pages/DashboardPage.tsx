import { useDashboardStats } from '../hooks/useDashboardStats';
import { formatCurrency, formatDate } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Package, Users, Truck, ShoppingCart, Receipt,
  TrendingUp, AlertTriangle, Loader2, DollarSign,
} from 'lucide-react';

function StatCard({ title, value, icon: Icon, color, sub }: {
  title: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string;
}) {
  return (
    <Card className="glass border-border/50 hover:glow-primary transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { stats, loading, error } = useDashboardStats();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  const statCards = [
    { title: 'Total Products', value: stats.totalProducts, icon: Package, color: 'bg-blue-500/20 text-blue-400', sub: 'In inventory' },
    { title: 'Customers', value: stats.totalCustomers, icon: Users, color: 'bg-purple-500/20 text-purple-400', sub: 'Registered clients' },
    { title: 'Suppliers', value: stats.totalSuppliers, icon: Truck, color: 'bg-orange-500/20 text-orange-400', sub: 'Active partners' },
    { title: 'Purchases', value: stats.totalPurchases, icon: ShoppingCart, color: 'bg-cyan-500/20 text-cyan-400', sub: `Total: ${formatCurrency(stats.totalPurchaseAmount)}` },
    { title: 'Sales', value: stats.totalSales, icon: Receipt, color: 'bg-pink-500/20 text-pink-400', sub: 'Transactions' },
    { title: 'Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'bg-green-500/20 text-green-400', sub: 'All-time earnings' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your business performance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Recent Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No sales yet.</p>
            ) : (
              <div className="space-y-3">
                {stats.recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{sale.customers?.name ?? 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(sale.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={sale.status === 'completed' ? 'success' : 'warning'}>
                        {sale.status}
                      </Badge>
                      <span className="text-sm font-semibold text-green-400">
                        {formatCurrency(sale.total_amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">All products well stocked.</p>
            ) : (
              <div className="space-y-3">
                {stats.lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                    <Badge variant={product.stock === 0 ? 'destructive' : 'warning'}>
                      {product.stock === 0 ? 'Out of stock' : `${product.stock} left`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
