import { Request, Response } from 'express';
import pool from '../config/db';

type StorageLocationId = 'mainWarehouse' | 'backRoom' | 'showRoom';

const DEFAULT_STORAGE_LOCATIONS = [
  { id: 'mainWarehouse' as const, name: 'Main Warehouse', capacityUnits: 1000 },
  { id: 'backRoom' as const, name: 'Back Room', capacityUnits: 1000 },
  { id: 'showRoom' as const, name: 'Show Room', capacityUnits: 1000 }
];

const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const parseInteger = (value: any): number => {
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const normalizeStatus = (value: any): string => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toUpperCase();
  if (normalized === 'ON_REVIEW' || normalized === 'ON REVIEW') return 'On Review';
  if (normalized === 'PENDING') return 'Pending';
  if (normalized === 'PROCESSING') return 'Processing';
  if (normalized === 'SHIPPED') return 'Shipped';
  if (normalized === 'DELIVERED') return 'Delivered';
  if (normalized === 'UNDELIVERED') return 'Undelivered';
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'Cancelled';
  if (normalized === 'DELETED') return 'Deleted';
  if (normalized === 'DRAFT') return 'Draft';
  return value;
};

const formatTrend = (current: number, previous: number) => {
  if (previous === 0) {
    if (current === 0) return { text: '0.0%', up: true };
    return { text: '+100.0%', up: true };
  }

  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? '+' : '';
  return { text: `${sign}${change.toFixed(1)}%`, up: change >= 0 };
};

const normalizeStorageLocations = (input: unknown) => {
  const defaults = new Map(DEFAULT_STORAGE_LOCATIONS.map((loc) => [loc.id, loc]));
  const incoming = Array.isArray(input) ? input : [];
  const merged = new Map<StorageLocationId, { id: StorageLocationId; name: string; capacityUnits: number }>();

  incoming.forEach((loc: any) => {
    if (!loc || typeof loc !== 'object') return;
    const id = loc.id as StorageLocationId;
    if (!defaults.has(id)) return;
    const fallback = defaults.get(id)!;
    const name = typeof loc.name === 'string' && loc.name.trim() ? loc.name.trim() : fallback.name;
    const rawUnits = typeof loc.capacityUnits === 'number' ? loc.capacityUnits : loc.capacity;
    const capacityUnits = typeof rawUnits === 'number' && !Number.isNaN(rawUnits)
      ? Math.max(0, Math.round(rawUnits))
      : fallback.capacityUnits;
    merged.set(id, { id, name, capacityUnits });
  });

  DEFAULT_STORAGE_LOCATIONS.forEach((loc) => {
    if (!merged.has(loc.id)) {
      merged.set(loc.id, loc);
    }
  });

  return DEFAULT_STORAGE_LOCATIONS.map((loc) => merged.get(loc.id)!);
};

const getRolePermissions = async (roleId: string) => {
  const result = await pool.query(
    `SELECT p.name
     FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = $1`,
    [roleId]
  );

  return new Set<string>(result.rows.map((row: { name: string }) => row.name));
};

export const getDashboardSummary = async (req: Request, res: Response) => {
  const roleId = (req as any).user?.role;

  if (!roleId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const permissions = await getRolePermissions(roleId);
    const canViewReports = permissions.has('Reports');
    const canViewProducts = permissions.has('Products');
    const canViewOrders = permissions.has('Orders');

    const needsOrders = canViewOrders || canViewReports;
    const needsProducts = canViewProducts || canViewReports;
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [productMetricsResult, orderMetricsResult, recentOrdersResult, storageLocationsResult] = await Promise.all([
      needsProducts
        ? pool.query(
            `SELECT
               COALESCE(SUM(((COALESCE(stock_main_warehouse, 0) + COALESCE(stock_back_room, 0) + COALESCE(stock_show_room, 0)) * COALESCE(price, 0))), 0) AS inventory_value,
               COUNT(*)::int AS total_skus,
               COALESCE(SUM(CASE WHEN status IN ('Low', 'Empty') THEN 1 ELSE 0 END), 0)::int AS low_stock_count,
               COALESCE(SUM(COALESCE(stock_main_warehouse, 0) + COALESCE(stock_back_room, 0) + COALESCE(stock_show_room, 0)), 0)::int AS on_hand_units,
               COALESCE(SUM(((COALESCE(stock_main_warehouse, 0) + COALESCE(stock_back_room, 0) + COALESCE(stock_show_room, 0)) * COALESCE(price, 0))), 0) AS previous_inventory_value,
               COUNT(*)::int AS previous_total_skus,
               COALESCE(SUM(COALESCE(stock_main_warehouse, 0)), 0)::int AS main_items,
               COALESCE(SUM(COALESCE(stock_main_warehouse, 0) * COALESCE(price, 0)), 0) AS main_value,
               COALESCE(SUM(COALESCE(stock_back_room, 0)), 0)::int AS back_items,
               COALESCE(SUM(COALESCE(stock_back_room, 0) * COALESCE(price, 0)), 0) AS back_value,
               COALESCE(SUM(COALESCE(stock_show_room, 0)), 0)::int AS show_items,
               COALESCE(SUM(COALESCE(stock_show_room, 0) * COALESCE(price, 0)), 0) AS show_value
             FROM products`
          )
        : Promise.resolve({ rows: [] }),
      needsOrders
        ? pool.query(
            `WITH order_totals AS (
               SELECT
                 o.id,
                 o.date,
                 o.status,
                 COALESCE(SUM(oi.quantity), 0)::int AS unit_count
               FROM orders o
               LEFT JOIN order_items oi ON oi.order_id = o.id
               GROUP BY o.id
             )
             SELECT
               COALESCE(SUM(CASE WHEN status IN ('Pending', 'PENDING', 'Processing', 'PROCESSING') THEN unit_count ELSE 0 END), 0)::int AS items_on_order,
               COALESCE(SUM(CASE WHEN status IN ('Delivered', 'DELIVERED') THEN unit_count ELSE 0 END), 0)::int AS delivered_units,
               COALESCE(SUM(CASE WHEN date >= $1 AND date < $2 AND status IN ('Pending', 'PENDING', 'Processing', 'PROCESSING') THEN unit_count ELSE 0 END), 0)::int AS previous_month_on_order,
               COALESCE(SUM(CASE WHEN date >= $1 AND date < $2 AND status IN ('Delivered', 'DELIVERED') THEN unit_count ELSE 0 END), 0)::int AS previous_month_delivered_units
             FROM order_totals`,
            [startOfLastMonth, startOfCurrentMonth]
          )
        : Promise.resolve({ rows: [] }),
      canViewOrders
        ? pool.query(
            `SELECT
               o.id,
               o.date,
               o.status,
               o.total,
               u.company_name AS buyer_company_name,
               u.name AS buyer_name,
               COALESCE(SUM(oi.quantity), 0)::int AS unit_count
             FROM orders o
             LEFT JOIN users u ON u.id = o.buyer_id
             LEFT JOIN order_items oi ON oi.order_id = o.id
             WHERE o.status IN ('Pending', 'PENDING', 'Processing', 'PROCESSING')
             GROUP BY o.id, u.company_name, u.name
             ORDER BY o.date DESC
             LIMIT 5`
          )
        : Promise.resolve({ rows: [] }),
      canViewProducts
        ? pool.query(
            `SELECT value
             FROM settings
             WHERE key = 'storage_locations'`
          )
        : Promise.resolve({ rows: [] })
    ]);

    const productMetrics = productMetricsResult.rows[0] || {};
    const orderMetrics = orderMetricsResult.rows[0] || {};
    const recentOrders = recentOrdersResult.rows.map((row: any) => ({
      id: String(row.id),
      date: String(row.date),
      status: normalizeStatus(row.status),
      total: parseNumber(row.total),
      buyerLabel: row.buyer_company_name || row.buyer_name || 'Unknown Buyer',
      unitCount: parseInteger(row.unit_count)
    }));

    let storageLocations = DEFAULT_STORAGE_LOCATIONS;
    if (storageLocationsResult.rows[0]?.value) {
      try {
        storageLocations = normalizeStorageLocations(JSON.parse(storageLocationsResult.rows[0].value));
      } catch (err) {
        storageLocations = DEFAULT_STORAGE_LOCATIONS;
      }
    }

    const totalInventoryValue = parseNumber(productMetrics.inventory_value);
    const totalSKUs = parseInteger(productMetrics.total_skus);
    const itemsOnOrder = parseInteger(orderMetrics.items_on_order);
    const deliveredUnits = parseInteger(orderMetrics.delivered_units);
    const onHandUnits = parseInteger(productMetrics.on_hand_units);
    const sellThroughRateVal = deliveredUnits + onHandUnits > 0
      ? Number(((deliveredUnits / (deliveredUnits + onHandUnits)) * 100).toFixed(1))
      : 0;

    const previousMonthOnOrder = parseInteger(orderMetrics.previous_month_on_order);
    const previousMonthDeliveredUnits = parseInteger(orderMetrics.previous_month_delivered_units);
    const previousMonthSellThrough = previousMonthDeliveredUnits + onHandUnits > 0
      ? (previousMonthDeliveredUnits / (previousMonthDeliveredUnits + onHandUnits)) * 100
      : 0;
    const previousInventoryValue = parseNumber(productMetrics.previous_inventory_value);
    const previousTotalSKUs = parseInteger(productMetrics.previous_total_skus);

    const stats = {
      inventoryValue: {
        value: totalInventoryValue,
        trend: formatTrend(totalInventoryValue, previousInventoryValue)
      },
      totalSkus: {
        value: totalSKUs,
        trend: formatTrend(totalSKUs, previousTotalSKUs)
      },
      onOrder: {
        value: itemsOnOrder,
        trend: formatTrend(itemsOnOrder, previousMonthOnOrder)
      },
      sellThrough: {
        value: sellThroughRateVal,
        trend: formatTrend(sellThroughRateVal, previousMonthSellThrough)
      }
    };

    const lowStockCount = parseInteger(productMetrics.low_stock_count);
    const locations = storageLocations.map((loc) => {
      const itemsKey = loc.id === 'mainWarehouse' ? 'main_items' : loc.id === 'backRoom' ? 'back_items' : 'show_items';
      const valueKey = loc.id === 'mainWarehouse' ? 'main_value' : loc.id === 'backRoom' ? 'back_value' : 'show_value';
      const items = parseInteger(productMetrics[itemsKey]);
      const value = parseNumber(productMetrics[valueKey]);
      const capPercent = loc.capacityUnits > 0 ? Math.min(100, Math.round((items / loc.capacityUnits) * 100)) : 0;
      return {
        id: loc.id,
        name: loc.name,
        items,
        value,
        capUnits: loc.capacityUnits,
        capPercent
      };
    });

    res.json({
      stats,
      lowStockCount,
      locations,
      recentOrders
    });
  } catch (err) {
    console.error('Get dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
};
