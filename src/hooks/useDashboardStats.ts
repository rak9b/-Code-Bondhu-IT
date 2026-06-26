import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DashboardStats {
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalPurchases: number;
  totalSales: number;
  totalRevenue: number;
  totalPurchaseAmount: number;
  recentSales: Array<{
    id: string;
    created_at: string;
    total_amount: number;
    customers: { name: string } | null;
    status: string;
  }>;
  lowStockProducts: Array<{
    id: string;
    name: string;
    sku: string;
    stock: number;
  }>;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    totalPurchases: 0,
    totalSales: 0,
    totalRevenue: 0,
    totalPurchaseAmount: 0,
    recentSales: [],
    lowStockProducts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        const [
          productsRes,
          customersRes,
          suppliersRes,
          purchasesRes,
          salesRes,
          recentSalesRes,
          lowStockRes,
        ] = await Promise.all([
          supabase.from('products').select('id', { count: 'exact', head: true }),
          supabase.from('customers').select('id', { count: 'exact', head: true }),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }),
          supabase.from('purchases').select('total_amount'),
          supabase.from('sales').select('total_amount'),
          supabase
            .from('sales')
            .select('id, created_at, total_amount, status, customers(name)')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('products')
            .select('id, name, sku, stock')
            .lt('stock', 10)
            .order('stock', { ascending: true })
            .limit(5),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalRevenue = ((salesRes.data ?? []) as any[]).reduce((sum: number, s: any) => sum + (s.total_amount ?? 0), 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalPurchaseAmount = ((purchasesRes.data ?? []) as any[]).reduce((sum: number, p: any) => sum + (p.total_amount ?? 0), 0);

        setStats({
          totalProducts: productsRes.count ?? 0,
          totalCustomers: customersRes.count ?? 0,
          totalSuppliers: suppliersRes.count ?? 0,
          totalPurchases: purchasesRes.data?.length ?? 0,
          totalSales: salesRes.data?.length ?? 0,
          totalRevenue,
          totalPurchaseAmount,
          recentSales: (recentSalesRes.data ?? []) as DashboardStats['recentSales'],
          lowStockProducts: lowStockRes.data ?? [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return { stats, loading, error };
}
