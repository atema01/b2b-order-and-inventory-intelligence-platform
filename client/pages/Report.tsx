import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Buyer, CreditRequest, Order, OrderStatus, Payment, PaymentStatus, Product, ReturnLog } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
interface PredictionItem {
  name: string;
  growth: string;
  badge: string;
  isPositive: boolean;
}

interface ExecutiveSummaryMetric {
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning' | 'danger';
  helper: string;
}

interface ExecutiveSummaryState {
  revenueValue: number;
  inventoryValue: number;
  lowStockCount: number;
  deliveredOrders: number;
  activeOrders: number;
  pendingPaymentsCount: number;
  pendingPaymentsValue: number;
  outstandingCreditValue: number;
  returnLossValue: number;
  summaryNote: string;
}

interface OrderReportMetric {
  label: string;
  value: string;
  delta: number;
  helper: string;
}

interface OrderVolumePoint {
  label: string;
  current: number;
  previous: number;
}

interface OrderStatusBreakdown {
  label: string;
  count: number;
  share: number;
  colorClass: string;
  trackClass: string;
}

interface TopOrderProduct {
  id: string;
  rank: number;
  name: string;
  category: string;
  orderCount: number;
  grossRevenue: number;
}

type TopOrderProductSortKey = 'units-desc' | 'units-asc' | 'revenue-desc' | 'revenue-asc' | 'name-asc' | 'name-desc';

interface InventoryMetric {
  label: string;
  value: string;
  helper: string;
  tone?: 'default' | 'danger';
}

interface FinancialMetric {
  label: string;
  value: string;
  helper: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

interface FinancialTrendPoint {
  label: string;
  invoiced: number;
  collected: number;
  atRisk: number;
}

interface CategoryMarginPoint {
  category: string;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
}

interface ReceivablesAgingPoint {
  bucket: 'Current (0-7d)' | 'Late (8-15d)' | 'Critical (16-30d)' | 'Bad Debt (>30d)';
  amount: number;
  orderCount: number;
  fill: string;
}

interface FinancialInsightItem {
  title: string;
  value: string;
  helper: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
}

interface InventoryTrendPoint {
  label: string;
  value: number;
}

interface ProductPerformanceItem {
  id: string;
  name: string;
  revenue: number;
  profit: number;
  marginPct: number;
  status: string;
}

type TopSellingProductSortKey = 'revenue-desc' | 'revenue-asc' | 'profit-desc' | 'profit-asc' | 'margin-desc' | 'margin-asc' | 'name-asc' | 'name-desc';

interface MovementVelocityItem {
  id: string;
  name: string;
  delta: number;
  tone: 'fast' | 'slow';
}

interface StockCoverageItem {
  id: string;
  name: string;
  category: string;
  daysRemaining: number;
  dailyVelocity: number;
  unitsOnHand: number;
  tone: 'tight' | 'healthy' | 'excess';
}

interface DeadStockItem {
  id: string;
  name: string;
  category: string;
  unitsOnHand: number;
  capitalValue: number;
}
interface StockDistributionItem {
  label: string;
  share: number;
  quantity: number;
  colorClass: string;
  trackClass: string;
}

interface BuyerRevenueItem {
  buyerId: string;
  buyerLabel: string;
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  revenueShare: number;
}

interface BuyerChurnRiskItem {
  buyerId: string;
  buyerLabel: string;
  lifetimeOrders: number;
  daysSinceLastOrder: number;
  lastOrderDate: string;
  avgOrderGapDays: number;
  riskLevel: 'Watch' | 'Medium' | 'High';
}

interface BuyerPaymentReliabilityItem {
  buyerId: string;
  buyerLabel: string;
  score: number;
  averageLagHours: number;
  paymentProofCount: number;
}

interface BuyerAovItem {
  buyerId: string;
  buyerLabel: string;
  aov: number;
  orderCount: number;
  totalRevenue: number;
  behavior: 'Bulk-led' | 'Balanced' | 'Retail-like';
}

type ReportDurationKey = '7d' | '30d' | '90d' |'180d' | '365d';

interface ReportDurationOption {
  key: ReportDurationKey;
  label: string;
  days: number;
}
const formatCurrency = (value: number) => `ETB ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
interface ExpiryMetric {
  label: string;
  value: string;
  helper: string;
  tone?: 'default' | 'warning' | 'danger';
}

interface ExpiryProductItem {
  id: string;
  name: string;
  category: string;
  expiryDate: string;
  daysRemaining: number;
  quantity: number;
  status: 'Expired' | 'Critical' | 'Watch';
}

type ExpiryProductSortKey = 'expiry-asc' | 'expiry-desc' | 'quantity-desc' | 'quantity-asc' | 'name-asc' | 'name-desc';
const extractArray = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};
type ReportTypeKey = 'all' | 'executive' | 'buyer' | 'financial' | 'product' | 'order';

interface ReportTypeOption {
  key: ReportTypeKey;
  label: string;
}
const getStartOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};
const formatInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const getStartOfMonth = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const emptyPredictions = (): PredictionItem[] => ([
  { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
  { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true },
  { name: 'Data Pending', growth: '--', badge: 'Waiting...', isPositive: true }
]);


const formatCompactCurrency = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const getStatusToneClasses = (tone: ExecutiveSummaryMetric['tone']) => {
  if (tone === 'success') return 'text-emerald-500';
  if (tone === 'warning') return 'text-amber-500';
  if (tone === 'danger') return 'text-red-500';
  return 'text-slate-800';
};

const parsePaymentTermsDays = (paymentTerms?: string) => {
  if (!paymentTerms) return 0;
  const normalized = paymentTerms.trim().toLowerCase();
  if (!normalized || normalized.includes('immediate') || normalized.includes('cash') || normalized.includes('cod')) return 0;
  const match = normalized.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

const getFinancialToneClasses = (tone: FinancialMetric['tone']) => {
  if (tone === 'success') return 'text-emerald-600';
  if (tone === 'warning') return 'text-amber-600';
  if (tone === 'danger') return 'text-red-600';
  return 'text-slate-800';
};

const formatDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const formatLag = (hours: number) => {
  if (hours >= 48) return `${(hours / 24).toFixed(1)} days`;
  return `${hours.toFixed(1)} hrs`;
};

const getBuyerScoreTone = (score: number) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 55) return 'text-amber-600';
  return 'text-red-600';
};

const formatBucketLabel = (start: Date, selectedDays: number) => (
  selectedDays <= 30
    ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
    : start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase()
);

const getBucketRanges = (rangeStart: Date, totalDays: number, bucketCount: number) => {
  const safeBuckets = Math.max(1, Math.min(bucketCount, totalDays));
  const baseSize = Math.floor(totalDays / safeBuckets);
  const remainder = totalDays % safeBuckets;
  let offset = 0;

  return Array.from({ length: safeBuckets }, (_, index) => {
    const size = baseSize + (index < remainder ? 1 : 0);
    const start = new Date(rangeStart);
    start.setDate(start.getDate() + offset);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + size - 1);
    end.setHours(23, 59, 59, 999);

    offset += size;
    return { start, end };
  });
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

const reportDurationOptions: ReportDurationOption[] = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '1 Month', days: 30 },
  { key: '90d', label: '3 Month', days: 90 },
  { key: '180d', label: '6 Month', days: 180 },
  { key: '365d', label: '12 Month', days: 365 }
];
const reportTypeOptions: ReportTypeOption[] = [
  { key: 'all', label: 'All' },
  { key: 'executive', label: 'Executive' },
  { key: 'buyer', label: 'Buyer' },
  { key: 'financial', label: 'Financial' },
  { key: 'product', label: 'Product' },
  { key: 'order', label: 'Order' }
];
const getRangeFromDuration = (days: number) => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return {
    start: formatInputDate(start),
    end: formatInputDate(end)
  };
};
const Report: React.FC = () => {
  const { t } = useLanguage();
  const reportPrintRef = useRef<HTMLDivElement>(null);
  const defaultRange = getRangeFromDuration(30);
  const [reportDuration, setReportDuration] = useState<ReportDurationKey>('30d');
  const [draftDuration, setDraftDuration] = useState<ReportDurationKey>('30d');
  const [reportType, setReportType] = useState<ReportTypeKey>('all');
  const [draftReportType, setDraftReportType] = useState<ReportTypeKey>('all');
  const [activeStartDate, setActiveStartDate] = useState(defaultRange.start);
  const [activeEndDate, setActiveEndDate] = useState(defaultRange.end);
  const [draftStartDate, setDraftStartDate] = useState(defaultRange.start);
  const [draftEndDate, setDraftEndDate] = useState(defaultRange.end);
  const [growthTrend, setGrowthTrend] = useState<{ name: string; val: number }[]>([]);
  const [growthPercentage, setGrowthPercentage] = useState(0);
  const [isGrowthPositive, setIsGrowthPositive] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [inventoryTurnover, setInventoryTurnover] = useState(0);
  const [inventoryTurnoverTrend, setInventoryTurnoverTrend] = useState<{ name: string; val: number }[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>(emptyPredictions);
  const [timeResolution, setTimeResolution] = useState<'Day' | 'Week' | 'Month'>('Month');
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummaryState>({
    revenueValue: 0,
    inventoryValue: 0,
    lowStockCount: 0,
    deliveredOrders: 0,
    activeOrders: 0,
    pendingPaymentsCount: 0,
    pendingPaymentsValue: 0,
    outstandingCreditValue: 0,
    returnLossValue: 0,
    summaryNote: 'Summary is waiting for report data.'
  });
  const [orderReportMetrics, setOrderReportMetrics] = useState<OrderReportMetric[]>([
    { label: 'Total Orders', value: '0', delta: 0, helper: 'Compared with previous period' },
    { label: 'Total Order Value', value: formatCurrency(0), delta: 0, helper: 'Compared with previous period' },
    { label: 'Average Order Value', value: formatCurrency(0), delta: 0, helper: 'Compared with previous period' },
    { label: 'Stuck Orders Count', value: '0', delta: 0, helper: 'Orders still in review or pending for more than 48 hours' },
    { label: 'Avg Verification Hours', value: '0.0 hrs', delta: 0, helper: 'Average time to move from submission into the next workflow stage' }
  ]);
  const [orderVolumeTrend, setOrderVolumeTrend] = useState<OrderVolumePoint[]>([]);
  const [orderStatusBreakdown, setOrderStatusBreakdown] = useState<OrderStatusBreakdown[]>([]);
  const [topOrderProducts, setTopOrderProducts] = useState<TopOrderProduct[]>([]);
  const [topOrderProductLimit, setTopOrderProductLimit] = useState(5);
  const [topOrderProductSort, setTopOrderProductSort] = useState<TopOrderProductSortKey>('units-desc');
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetric[]>([
    { label: 'Recognized Revenue', value: formatCurrency(0), helper: 'Delivered orders in the selected range' },
    { label: 'Cash Collected', value: formatCurrency(0), helper: 'Approved payments captured in the selected range' },
    { label: 'Gross Profit', value: formatCurrency(0), helper: 'Recognized revenue less cost of goods sold' },
    { label: 'Gross Margin %', value: '0.0%', helper: 'Gross profit as a share of recognized revenue' },
    { label: 'Collection Rate', value: '0.0%', helper: 'Collected cash as a share of billed order value' },
    { label: 'Open Receivables', value: formatCurrency(0), helper: 'Outstanding unpaid balance tied to in-range orders', tone: 'warning' },
    { label: 'Avg Days Past Due', value: '0.0 days', helper: 'Average overdue days across open receivables', tone: 'warning' }
  ]);
  const [financialTrend, setFinancialTrend] = useState<FinancialTrendPoint[]>([]);
  const [categoryMarginTrend, setCategoryMarginTrend] = useState<CategoryMarginPoint[]>([]);
  const [receivablesAging, setReceivablesAging] = useState<ReceivablesAgingPoint[]>([]);
  const [financialInsights, setFinancialInsights] = useState<FinancialInsightItem[]>([
    { title: 'Cash Conversion', value: '0.0%', helper: 'No billed activity in the selected window yet.', tone: 'default' },
    { title: 'Credit Pressure', value: formatCurrency(0), helper: 'No active credit exposure is open right now.', tone: 'success' },
    { title: 'Revenue At Risk', value: formatCurrency(0), helper: 'No pending approvals or return losses detected.', tone: 'success' }
  ]);
  const [inventoryMetrics, setInventoryMetrics] = useState<InventoryMetric[]>([
    { label: 'Total Inventory Value', value: formatCurrency(0), helper: 'Current stock position' },
    { label: 'Total Units On Hand', value: '0 units', helper: 'Across all storage locations' },
    { label: 'Inventory Turnover Rate', value: '0.0x', helper: 'Performance across selected range' },
    { label: 'Reorder Risk', value: '0 items', helper: 'Critical low or empty products', tone: 'danger' }
  ]);
  const [stockDistribution, setStockDistribution] = useState<StockDistributionItem[]>([]);
  const [inventoryTrend, setInventoryTrend] = useState<InventoryTrendPoint[]>([]);
  const [topSellingProducts, setTopSellingProducts] = useState<ProductPerformanceItem[]>([]);
  const [topSellingProductLimit, setTopSellingProductLimit] = useState(5);
  const [topSellingProductSort, setTopSellingProductSort] = useState<TopSellingProductSortKey>('revenue-desc');
  const [movementVelocity, setMovementVelocity] = useState<MovementVelocityItem[]>([]);
  const [stockCoverage, setStockCoverage] = useState<StockCoverageItem[]>([]);
  const [deadStockItems, setDeadStockItems] = useState<DeadStockItem[]>([]);
  const [expiryMetrics, setExpiryMetrics] = useState<ExpiryMetric[]>([
    { label: 'Expired Items', value: '0', helper: 'Products past expiry date', tone: 'danger' },
    { label: 'Critical Window', value: '0', helper: 'Products expiring soon', tone: 'warning' },
    { label: 'Tracked Expiry', value: '0', helper: 'Products with expiry dates on record' }
  ]);
  const [expiryProducts, setExpiryProducts] = useState<ExpiryProductItem[]>([]);
  const [expiryProductLimit, setExpiryProductLimit] = useState(5);
  const [expiryProductSort, setExpiryProductSort] = useState<ExpiryProductSortKey>('expiry-asc');
  const [topBuyerRevenue, setTopBuyerRevenue] = useState<BuyerRevenueItem[]>([]);
  const [buyerChurnRisk, setBuyerChurnRisk] = useState<BuyerChurnRiskItem[]>([]);
  const [buyerPaymentReliability, setBuyerPaymentReliability] = useState<BuyerPaymentReliabilityItem[]>([]);
  const [buyerAov, setBuyerAov] = useState<BuyerAovItem[]>([]);
  const selectedDuration = useMemo(
    () => reportDurationOptions.find((option) => option.key === reportDuration) || reportDurationOptions[1],
    [reportDuration]
  );

  const selectedRange = useMemo(() => {
    const start = new Date(activeStartDate);
    const end = new Date(activeEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { start: new Date(), end: new Date(), days: selectedDuration.days };
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const diff = end.getTime() - start.getTime();
    const days = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
    return { start, end, days };
  }, [activeStartDate, activeEndDate, selectedDuration.days]);

  const activeDateRangeLabel = useMemo(() => {
    return `${selectedRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${selectedRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [selectedRange]);

  const displayedTopOrderProducts = useMemo(() => {
    const sorted = [...topOrderProducts].sort((a, b) => {
      if (topOrderProductSort === 'units-desc') {
        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
        return b.grossRevenue - a.grossRevenue;
      }
      if (topOrderProductSort === 'units-asc') {
        if (a.orderCount !== b.orderCount) return a.orderCount - b.orderCount;
        return a.grossRevenue - b.grossRevenue;
      }
      if (topOrderProductSort === 'revenue-desc') {
        if (b.grossRevenue !== a.grossRevenue) return b.grossRevenue - a.grossRevenue;
        return b.orderCount - a.orderCount;
      }
      if (topOrderProductSort === 'revenue-asc') {
        if (a.grossRevenue !== b.grossRevenue) return a.grossRevenue - b.grossRevenue;
        return a.orderCount - b.orderCount;
      }
      if (topOrderProductSort === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      return a.name.localeCompare(b.name);
    });

    return sorted
      .slice(0, Math.max(1, topOrderProductLimit))
      .map((product, index) => ({ ...product, rank: index + 1 }));
  }, [topOrderProductLimit, topOrderProductSort, topOrderProducts]);

  const displayedTopSellingProducts = useMemo(() => {
    const sorted = [...topSellingProducts].sort((a, b) => {
      if (topSellingProductSort === 'revenue-desc') return b.revenue - a.revenue;
      if (topSellingProductSort === 'revenue-asc') return a.revenue - b.revenue;
      if (topSellingProductSort === 'profit-desc') return b.profit - a.profit;
      if (topSellingProductSort === 'profit-asc') return a.profit - b.profit;
      if (topSellingProductSort === 'margin-desc') return b.marginPct - a.marginPct;
      if (topSellingProductSort === 'margin-asc') return a.marginPct - b.marginPct;
      if (topSellingProductSort === 'name-desc') return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name);
    });

    return sorted.slice(0, Math.max(1, topSellingProductLimit));
  }, [topSellingProductLimit, topSellingProductSort, topSellingProducts]);

  const displayedExpiryProducts = useMemo(() => {
    const sorted = [...expiryProducts].sort((a, b) => {
      if (expiryProductSort === 'expiry-asc') return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      if (expiryProductSort === 'expiry-desc') return new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime();
      if (expiryProductSort === 'quantity-desc') return b.quantity - a.quantity;
      if (expiryProductSort === 'quantity-asc') return a.quantity - b.quantity;
      if (expiryProductSort === 'name-desc') return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name);
    });

    return sorted.slice(0, Math.max(1, expiryProductLimit));
  }, [expiryProductLimit, expiryProductSort, expiryProducts]);

  const applyFilters = () => {
    const start = new Date(draftStartDate);
    const end = new Date(draftEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;
    setReportType(draftReportType);
    setReportDuration(draftDuration);
    setActiveStartDate(draftStartDate);
    setActiveEndDate(draftEndDate);
  };

  const resetFilters = () => {
    const range = getRangeFromDuration(30);
    setDraftReportType('all');
    setReportType('all');
    setDraftDuration('30d');
    setReportDuration('30d');
    setDraftStartDate(range.start);
    setDraftEndDate(range.end);
    setActiveStartDate(range.start);
    setActiveEndDate(range.end);
  };

  const downloadTopOrderedProductsCsv = () => {
    if (displayedTopOrderProducts.length === 0) return;

    const rows = [
      ['Rank', 'Product', 'Category', 'Units', 'Revenue (ETB)'],
      ...displayedTopOrderProducts.map((product) => [
        String(product.rank),
        product.name,
        product.category,
        String(product.orderCount),
        product.grossRevenue.toFixed(2)
      ])
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `top-ordered-products-${activeStartDate}-to-${activeEndDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const downloadTopSellingProductsCsv = () => {
    if (displayedTopSellingProducts.length === 0) return;

    const rows = [
      ['Product', 'Status', 'Revenue (ETB)', 'Profit (ETB)', 'Margin %'],
      ...displayedTopSellingProducts.map((product) => [
        product.name,
        product.status,
        product.revenue.toFixed(2),
        product.profit.toFixed(2),
        product.marginPct.toFixed(1)
      ])
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `top-selling-products-${activeStartDate}-to-${activeEndDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const downloadExpiryTrackingCsv = () => {
    if (displayedExpiryProducts.length === 0) return;

    const rows = [
      ['Product', 'Category', 'Units', 'Expiry Date', 'Status'],
      ...displayedExpiryProducts.map((product) => [
        product.name,
        product.category,
        String(product.quantity),
        new Date(product.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        product.status
      ])
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expiry-tracking-${activeStartDate}-to-${activeEndDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const showExecutiveSummary = reportType === 'all' || reportType === 'executive';
  const showBuyerSections = reportType === 'all' || reportType === 'buyer';
  const showFinancialSections = reportType === 'all' || reportType === 'financial';
  const showProductSections = reportType === 'all' || reportType === 'product';
  const showOrderSections = reportType === 'all' || reportType === 'order';

  const normalizeStatus = (value: any): OrderStatus => {
    if (typeof value !== 'string') return OrderStatus.PENDING;
    const map: Record<string, OrderStatus> = {
      DRAFT: OrderStatus.DRAFT,
      ON_REVIEW: OrderStatus.ON_REVIEW,
      'ON REVIEW': OrderStatus.ON_REVIEW,
      PENDING: OrderStatus.PENDING,
      PROCESSING: OrderStatus.PROCESSING,
      SHIPPED: OrderStatus.SHIPPED,
      DELIVERED: OrderStatus.DELIVERED,
      UNDELIVERED: OrderStatus.UNDELIVERED,
      CANCELLED: OrderStatus.CANCELLED,
      CANCELED: OrderStatus.CANCELLED,
      DELETED: OrderStatus.DELETED,
      Draft: OrderStatus.DRAFT,
      'On Review': OrderStatus.ON_REVIEW,
      Pending: OrderStatus.PENDING,
      Processing: OrderStatus.PROCESSING,
      Shipped: OrderStatus.SHIPPED,
      Delivered: OrderStatus.DELIVERED,
      Undelivered: OrderStatus.UNDELIVERED,
      Cancelled: OrderStatus.CANCELLED,
      Canceled: OrderStatus.CANCELLED,
      Deleted: OrderStatus.DELETED
    };
    return map[value] || OrderStatus.PENDING;
  };

  const executiveMetrics = useMemo<ExecutiveSummaryMetric[]>(() => {
    const activePaymentsHelper =
      executiveSummary.pendingPaymentsCount > 0
        ? `${executiveSummary.pendingPaymentsCount} submissions waiting for review`
        : 'No payment proofs waiting for review';

    const creditHelper =
      executiveSummary.outstandingCreditValue > 0
        ? 'Open credit exposure still to be repaid'
        : 'No open approved credit exposure';

    const returnHelper =
      executiveSummary.returnLossValue > 0
        ? 'Loss captured from disposed or damaged inventory'
        : 'No recorded loss from returns and damages';

    return [
      {
        label: 'Revenue',
        value: formatCurrency(executiveSummary.revenueValue),
        tone: 'primary',
        helper: `${executiveSummary.deliveredOrders} delivered orders contributing to revenue`
      },
      {
        label: 'Inventory Value',
        value: formatCurrency(executiveSummary.inventoryValue),
        tone: executiveSummary.lowStockCount > 0 ? 'warning' : 'success',
        helper: `${executiveSummary.lowStockCount} low or empty SKUs need attention`
      },
      {
        label: 'Operational Load',
        value: `${executiveSummary.activeOrders.toLocaleString()} active orders`,
        tone: 'primary',
        helper: 'Orders currently under review, pending, processing, or shipped'
      },
      {
        label: 'Payment Review Queue',
        value: formatCurrency(executiveSummary.pendingPaymentsValue),
        tone: executiveSummary.pendingPaymentsCount > 0 ? 'warning' : 'success',
        helper: activePaymentsHelper
      },
      {
        label: 'Outstanding Credit',
        value: formatCurrency(executiveSummary.outstandingCreditValue),
        tone: executiveSummary.outstandingCreditValue > 0 ? 'warning' : 'success',
        helper: creditHelper
      },
      {
        label: 'Return Loss',
        value: formatCurrency(executiveSummary.returnLossValue),
        tone: executiveSummary.returnLossValue > 0 ? 'danger' : 'success',
        helper: returnHelper
      }
    ];
  }, [executiveSummary]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersResult, productsResult, turnoverResult, paymentsResult, creditsResult, returnsResult, buyersResult] = await Promise.allSettled([
          fetch('/api/orders', { credentials: 'include' }),
          fetch('/api/products', { credentials: 'include' }),
          fetch('/api/orders/metrics/inventory-turnover', { credentials: 'include' }),
          fetch('/api/payments', { credentials: 'include' }),
          fetch('/api/credits', { credentials: 'include' }),
          fetch('/api/returns', { credentials: 'include' }),
          fetch('/api/buyers', { credentials: 'include' })
        ]);

        if (ordersResult.status !== 'fulfilled' || !ordersResult.value.ok) throw new Error('Failed to fetch orders');
        if (productsResult.status !== 'fulfilled' || !productsResult.value.ok) throw new Error('Failed to fetch products');

      const ordersPayload = await ordersResult.value.json();
      const productsPayload = await productsResult.value.json();
      const allProducts = extractArray<Product>(productsPayload);

      const allOrders = extractArray<Order>(ordersPayload)
        .map((order) => ({ ...order, status: normalizeStatus(order.status) }))
          .filter((order) => ![OrderStatus.DRAFT, OrderStatus.CANCELLED, OrderStatus.DELETED].includes(order.status));
        const allPayments =
          paymentsResult.status === 'fulfilled' && paymentsResult.value.ok
            ? extractArray<Payment>(await paymentsResult.value.json())
            : [];
        const allCredits =
          creditsResult.status === 'fulfilled' && creditsResult.value.ok
            ? extractArray<CreditRequest>(await creditsResult.value.json())
            : [];
        const allReturns =
          returnsResult.status === 'fulfilled' && returnsResult.value.ok
            ? extractArray<ReturnLog>(await returnsResult.value.json())
            : [];
        const allBuyers =
          buyersResult.status === 'fulfilled' && buyersResult.value.ok
            ? extractArray<Buyer>(await buyersResult.value.json())
            : [];

        if (turnoverResult.status === 'fulfilled' && turnoverResult.value.ok) {
          const turnoverData = await turnoverResult.value.json();
          setInventoryTurnover(Number(turnoverData.turnover || 0));
          setInventoryTurnoverTrend(
            Array.isArray(turnoverData.trend) && turnoverData.trend.length > 0
              ? turnoverData.trend
              : [{ name: 'No Data', val: 0 }]
          );
        } else {
          setInventoryTurnover(0);
          setInventoryTurnoverTrend([{ name: 'No Data', val: 0 }]);
        }

   const inventoryValue = allProducts.reduce((sum, product) => {
          const productStock =
            (Number(product.stock?.mainWarehouse || 0)) +
            (Number(product.stock?.backRoom || 0)) +
            (Number(product.stock?.showRoom || 0));
          return sum + productStock * Number(product.price || 0);
        }, 0);
        const totalUnitsOnHand = allProducts.reduce((sum, product) => {
          return (
            sum +
            Number(product.stock?.mainWarehouse || 0) +
            Number(product.stock?.backRoom || 0) +
            Number(product.stock?.showRoom || 0)
          );
        }, 0);
       

           const lowStockCount = allProducts.filter((product) => ['Low', 'Empty'].includes(product.status)).length;
        const deliveredOrders = allOrders.filter((order) => order.status === OrderStatus.DELIVERED).length;
        const activeOrders = allOrders.filter((order) =>
          [OrderStatus.ON_REVIEW, OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.SHIPPED].includes(order.status)
        ).length;
        const pendingPayments = allPayments.filter((payment) => payment.status === PaymentStatus.PENDING);
        const pendingPaymentsValue = pendingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const outstandingCreditValue = allCredits.reduce((sum, credit) => {
          const outstanding = typeof credit.outstandingAmount === 'number'
            ? credit.outstandingAmount
            : Math.max(Number(credit.approvedAmount || 0) - Number(credit.repaidAmount || 0), 0);
          return sum + outstanding;
        }, 0);
        const returnLossValue = allReturns.reduce((sum, item) => sum + Number(item.lossValue || 0), 0);

        const now = new Date(selectedRange.end);
        const selectedDays = selectedRange.days;
        const currentWindowStart = new Date(selectedRange.start);
        currentWindowStart.setHours(0, 0, 0, 0);
        const previousWindowStart = new Date(currentWindowStart);
  previousWindowStart.setDate(previousWindowStart.getDate() - selectedDays);
        const ordersWithDates = allOrders
          .map((order) => ({ ...order, parsedDate: new Date(order.date) }))
          .filter((order) => !isNaN(order.parsedDate.getTime()));

        const currentWindowOrders = ordersWithDates.filter(
          (order) => order.parsedDate >= currentWindowStart && order.parsedDate <= now
        );
        const previousWindowOrders = ordersWithDates.filter(
          (order) => order.parsedDate >= previousWindowStart && order.parsedDate < currentWindowStart
        );
        const paymentsWithDates = allPayments
          .map((payment) => ({ ...payment, parsedDate: new Date(payment.dateTime) }))
          .filter((payment) => !isNaN(payment.parsedDate.getTime()));
        const currentWindowPayments = paymentsWithDates.filter(
          (payment) => payment.parsedDate >= currentWindowStart && payment.parsedDate <= now
        );
        const creditsWithDates = allCredits
          .map((credit) => ({ ...credit, parsedDate: new Date(credit.requestDate) }))
          .filter((credit) => !isNaN(credit.parsedDate.getTime()));
        const currentWindowCredits = creditsWithDates.filter(
          (credit) => credit.parsedDate >= currentWindowStart && credit.parsedDate <= now
        );
        const returnsWithDates = allReturns
          .map((entry) => ({ ...entry, parsedDate: new Date(entry.date) }))
          .filter((entry) => !isNaN(entry.parsedDate.getTime()));
        const currentWindowReturns = returnsWithDates.filter(
          (entry) => entry.parsedDate >= currentWindowStart && entry.parsedDate <= now
        );

        const buyerDirectory = new Map(
          allBuyers.map((buyer) => [
            buyer.id,
            buyer.companyName || buyer.contactPerson || buyer.email || buyer.id
          ])
        );
        const resolveBuyerLabel = (buyerId: string, fallback?: { buyerCompanyName?: string | null; buyerName?: string | null }) =>
          fallback?.buyerCompanyName ||
          fallback?.buyerName ||
          buyerDirectory.get(buyerId) ||
          'Unknown Buyer';

        const buyerRevenueMap = new Map<string, BuyerRevenueItem>();
        currentWindowOrders.forEach((order) => {
          const buyerLabel = resolveBuyerLabel(order.buyerId, order);
          const existing = buyerRevenueMap.get(order.buyerId) || {
            buyerId: order.buyerId,
            buyerLabel,
            revenue: 0,
            orderCount: 0,
            avgOrderValue: 0,
            revenueShare: 0
          };
          existing.revenue += Number(order.total || 0);
          existing.orderCount += 1;
          buyerRevenueMap.set(order.buyerId, existing);
        });

        const totalBuyerRevenue = Array.from(buyerRevenueMap.values()).reduce((sum, buyer) => sum + buyer.revenue, 0);
        const topBuyerRevenueItems = Array.from(buyerRevenueMap.values())
          .map((buyer) => ({
            ...buyer,
            avgOrderValue: buyer.orderCount > 0 ? buyer.revenue / buyer.orderCount : 0,
            revenueShare: totalBuyerRevenue > 0 ? (buyer.revenue / totalBuyerRevenue) * 100 : 0
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);
        setTopBuyerRevenue(topBuyerRevenueItems);

        const buyerHistoryMap = new Map<string, Date[]>();
        ordersWithDates
          .filter((order) => order.parsedDate <= now)
          .forEach((order) => {
            const entries = buyerHistoryMap.get(order.buyerId) || [];
            entries.push(order.parsedDate);
            buyerHistoryMap.set(order.buyerId, entries);
          });

        const churnRiskItems = Array.from(buyerHistoryMap.entries())
          .map(([buyerId, orderDates]) => {
            const sortedDates = [...orderDates].sort((a, b) => a.getTime() - b.getTime());
            const lastOrderDate = sortedDates[sortedDates.length - 1];
            const daysSinceLastOrder = Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
            const gaps = sortedDates.slice(1).map((date, index) => (
              (date.getTime() - sortedDates[index].getTime()) / (1000 * 60 * 60 * 24)
            ));
            const avgOrderGapDays = gaps.length > 0
              ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length
              : daysSinceLastOrder;
            const frequentBuyer = sortedDates.length >= 3 && avgOrderGapDays <= 30;
            if (!frequentBuyer || daysSinceLastOrder < 30) return null;

            return {
              buyerId,
              buyerLabel: resolveBuyerLabel(buyerId),
              lifetimeOrders: sortedDates.length,
              daysSinceLastOrder,
              lastOrderDate: lastOrderDate.toISOString(),
              avgOrderGapDays,
              riskLevel: daysSinceLastOrder >= 60 ? 'High' : daysSinceLastOrder >= 45 ? 'Medium' : 'Watch'
            };
          })
          .filter((item): item is BuyerChurnRiskItem => Boolean(item))
          .sort((a, b) => {
            if (b.daysSinceLastOrder !== a.daysSinceLastOrder) return b.daysSinceLastOrder - a.daysSinceLastOrder;
            return b.lifetimeOrders - a.lifetimeOrders;
          })
          .slice(0, 5);
        setBuyerChurnRisk(churnRiskItems);

        const paymentLagMap = new Map<string, { buyerLabel: string; totalLagHours: number; paymentProofCount: number }>();
        currentWindowOrders.forEach((order) => {
          const earliestProof = paymentsWithDates
            .filter((payment) => payment.orderId === order.id && payment.parsedDate >= order.parsedDate)
            .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())[0];

          if (!earliestProof) return;

          const lagHours = (earliestProof.parsedDate.getTime() - order.parsedDate.getTime()) / (1000 * 60 * 60);
          if (!Number.isFinite(lagHours) || lagHours < 0) return;

          const entry = paymentLagMap.get(order.buyerId) || {
            buyerLabel: resolveBuyerLabel(order.buyerId, order),
            totalLagHours: 0,
            paymentProofCount: 0
          };
          entry.totalLagHours += lagHours;
          entry.paymentProofCount += 1;
          paymentLagMap.set(order.buyerId, entry);
        });

        const paymentReliabilityItems = Array.from(paymentLagMap.entries())
          .map(([buyerId, metrics]) => {
            const averageLagHours = metrics.paymentProofCount > 0 ? metrics.totalLagHours / metrics.paymentProofCount : 0;
            const score = Math.max(0, Math.min(100, 100 - (Math.min(averageLagHours, 24 * 14) / (24 * 14)) * 100));
            return {
              buyerId,
              buyerLabel: metrics.buyerLabel,
              score,
              averageLagHours,
              paymentProofCount: metrics.paymentProofCount
            };
          })
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.paymentProofCount - a.paymentProofCount;
          });
        setBuyerPaymentReliability(paymentReliabilityItems);

        const overallAov = currentWindowOrders.length > 0
          ? currentWindowOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) / currentWindowOrders.length
          : 0;
        const buyerAovItems = Array.from(buyerRevenueMap.values())
          .map((buyer) => {
            const aov = buyer.orderCount > 0 ? buyer.revenue / buyer.orderCount : 0;
            const behavior: BuyerAovItem['behavior'] =
              overallAov > 0 && aov >= overallAov * 1.35
                ? 'Bulk-led'
                : overallAov > 0 && aov <= overallAov * 0.75
                  ? 'Retail-like'
                  : 'Balanced';

            return {
              buyerId: buyer.buyerId,
              buyerLabel: buyer.buyerLabel,
              aov,
              orderCount: buyer.orderCount,
              totalRevenue: buyer.revenue,
              behavior
            };
          })
          .sort((a, b) => b.aov - a.aov)
          .slice(0, 5);
        setBuyerAov(buyerAovItems);
        
        const currentTotalOrders = currentWindowOrders.length;
        const previousTotalOrders = previousWindowOrders.length;
        const currentOrderValue = currentWindowOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
        const previousOrderValue = previousWindowOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
        const currentAverageOrderValue = currentTotalOrders > 0 ? currentOrderValue / currentTotalOrders : 0;
        const previousAverageOrderValue = previousTotalOrders > 0 ? previousOrderValue / previousTotalOrders : 0;
        const verificationCompletionStatuses = new Set([
          OrderStatus.PENDING,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
          OrderStatus.UNDELIVERED,
          OrderStatus.CANCELLED
        ]);
        const getAverageVerificationHours = (orders: typeof currentWindowOrders) => {
          const verificationHours = orders
            .map((order) => {
              const createdAt = order.parsedDate;
              const verificationEntry = (order.history || [])
                .map((entry) => ({ ...entry, parsedDate: new Date(entry.date), normalizedStatus: normalizeStatus(entry.status) }))
                .filter((entry) => !isNaN(entry.parsedDate.getTime()) && verificationCompletionStatuses.has(entry.normalizedStatus))
                .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())[0];

              if (!verificationEntry) return null;
              const hours = (verificationEntry.parsedDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
              return hours >= 0 ? hours : null;
            })
            .filter((value): value is number => value !== null);

          if (verificationHours.length === 0) return 0;
          return verificationHours.reduce((sum, value) => sum + value, 0) / verificationHours.length;
        };
        const stuckThresholdMs = 48 * 60 * 60 * 1000;
        const getStuckOrdersCount = (orders: typeof currentWindowOrders, rangeEnd: Date) =>
          orders.filter((order) => {
            if (![OrderStatus.ON_REVIEW, OrderStatus.PENDING].includes(order.status)) return false;
            const lastTouch = (order.history || [])
              .map((entry) => new Date(entry.date))
              .filter((date) => !isNaN(date.getTime()))
              .sort((a, b) => b.getTime() - a.getTime())[0] || order.parsedDate;
            return rangeEnd.getTime() - lastTouch.getTime() > stuckThresholdMs;
          }).length;
        const currentStuckOrdersCount = getStuckOrdersCount(currentWindowOrders, now);
        const previousStuckOrdersCount = getStuckOrdersCount(previousWindowOrders, currentWindowStart);
        const currentAvgVerificationHours = getAverageVerificationHours(currentWindowOrders);
        const previousAvgVerificationHours = getAverageVerificationHours(previousWindowOrders);
        const deliveredOrdersInRange = currentWindowOrders.filter((order) => order.status === OrderStatus.DELIVERED).length;
        const deliveredOrdersWindow = currentWindowOrders.filter((order) => order.status === OrderStatus.DELIVERED);
        const deliveredRevenueInRange = deliveredOrdersWindow
          .reduce((sum, order) => sum + Number(order.total || 0), 0);
        const deliveredFinancials = deliveredOrdersWindow.reduce(
          (summary, order) => {
            order.items.forEach((item) => {
              const product = allProducts.find((entry) => entry.id === item.productId);
              const quantity = Number(item.quantity || 0);
              const revenue = quantity * Number(item.priceAtOrder || 0);
              const unitCost = Number(product?.costPrice || 0);
              const cogs = quantity * unitCost;
              const category = product?.category || 'Uncategorized';

              summary.cogs += cogs;
              const categoryEntry = summary.byCategory.get(category) || { revenue: 0, cogs: 0 };
              categoryEntry.revenue += revenue;
              categoryEntry.cogs += cogs;
              summary.byCategory.set(category, categoryEntry);
            });

            return summary;
          },
          {
            cogs: 0,
            byCategory: new Map<string, { revenue: number; cogs: number }>()
          }
        );
        const deliveredCogsInRange = deliveredFinancials.cogs;
        const grossProfitInRange = deliveredRevenueInRange - deliveredCogsInRange;
        const grossMarginPct = deliveredRevenueInRange > 0 ? (grossProfitInRange / deliveredRevenueInRange) * 100 : 0;
        const categoryMarginData = Array.from(deliveredFinancials.byCategory.entries())
          .map(([category, values]) => {
            const profit = values.revenue - values.cogs;
            const marginPct = values.revenue > 0 ? (profit / values.revenue) * 100 : 0;
            return {
              category,
              revenue: values.revenue,
              cogs: values.cogs,
              profit,
              marginPct
            };
          })
          .sort((a, b) => b.profit - a.profit);
        const highestMarginCategory = categoryMarginData
          .filter((item) => item.revenue > 0)
          .sort((a, b) => b.marginPct - a.marginPct)[0];
        const weakestMarginCategory = categoryMarginData
          .filter((item) => item.revenue > 0)
          .sort((a, b) => a.marginPct - b.marginPct)[0];
        const approvedPaymentsInRange = currentWindowPayments.filter((payment) => payment.status === PaymentStatus.APPROVED);
        const approvedPaymentsValueInRange = approvedPaymentsInRange.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const pendingPaymentsInRange = currentWindowPayments.filter((payment) => payment.status === PaymentStatus.PENDING);
        const pendingPaymentsValueInRange = pendingPaymentsInRange.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const openReceivablesValue = currentWindowOrders.reduce(
          (sum, order) => sum + Math.max(Number(order.total || 0) - Number(order.amountPaid || 0), 0),
          0
        );
        const openReceivableOrders = currentWindowOrders
          .map((order) => {
            const outstanding = Math.max(Number(order.total || 0) - Number(order.amountPaid || 0), 0);
            if (outstanding <= 0) return null;
            const dueDays = parsePaymentTermsDays(order.paymentTerms);
            const dueDate = new Date(order.parsedDate);
            dueDate.setDate(dueDate.getDate() + dueDays);
            dueDate.setHours(23, 59, 59, 999);
            const msPastDue = now.getTime() - dueDate.getTime();
            const daysPastDue = msPastDue > 0 ? Math.floor(msPastDue / (1000 * 60 * 60 * 24)) : 0;

            return {
              id: order.id,
              outstanding,
              daysPastDue
            };
          })
          .filter((item): item is { id: string; outstanding: number; daysPastDue: number } => Boolean(item));
        const receivablesAgingBuckets: ReceivablesAgingPoint[] = [
          { bucket: 'Current (0-7d)', amount: 0, orderCount: 0, fill: '#10B981' },
          { bucket: 'Late (8-15d)', amount: 0, orderCount: 0, fill: '#F59E0B' },
          { bucket: 'Critical (16-30d)', amount: 0, orderCount: 0, fill: '#F97316' },
          { bucket: 'Bad Debt (>30d)', amount: 0, orderCount: 0, fill: '#EF4444' }
        ];
        openReceivableOrders.forEach((item) => {
          const bucket =
            item.daysPastDue <= 7
              ? receivablesAgingBuckets[0]
              : item.daysPastDue <= 15
                ? receivablesAgingBuckets[1]
                : item.daysPastDue <= 30
                  ? receivablesAgingBuckets[2]
                  : receivablesAgingBuckets[3];
          bucket.amount += item.outstanding;
          bucket.orderCount += 1;
        });
        const avgDaysPastDue =
          openReceivableOrders.length > 0
            ? openReceivableOrders.reduce((sum, item) => sum + item.daysPastDue, 0) / openReceivableOrders.length
            : 0;
        const currentWindowReturnLossValue = currentWindowReturns.reduce((sum, entry) => sum + Number(entry.lossValue || 0), 0);
        const currentWindowCreditExposure = currentWindowCredits.reduce((sum, credit) => {
          const outstanding = typeof credit.outstandingAmount === 'number'
            ? credit.outstandingAmount
            : Math.max(Number(credit.approvedAmount || 0) - Number(credit.repaidAmount || 0), 0);
          return sum + outstanding;
        }, 0);
        const collectionRate = currentOrderValue > 0 ? (approvedPaymentsValueInRange / currentOrderValue) * 100 : 0;
        const revenueAtRiskValue = pendingPaymentsValueInRange + currentWindowReturnLossValue + currentWindowCreditExposure;
        const openReceivableOrdersCount = currentWindowOrders.filter(
          (order) => Math.max(Number(order.total || 0) - Number(order.amountPaid || 0), 0) > 0
        ).length;
        const activeCreditCasesInRange = currentWindowCredits.filter((credit) => {
          const outstanding = typeof credit.outstandingAmount === 'number'
            ? credit.outstandingAmount
            : Math.max(Number(credit.approvedAmount || 0) - Number(credit.repaidAmount || 0), 0);
          return outstanding > 0;
        }).length;
        const percentChange = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return ((current - previous) / previous) * 100;
        };
        const inventoryTurnoverRateValue =
          inventoryValue > 0 ? (currentOrderValue / inventoryValue) * (365 / Math.max(selectedDays, 1)) : 0;

        setFinancialMetrics([
          {
            label: 'Recognized Revenue',
            value: formatCurrency(deliveredRevenueInRange),
            helper: `${deliveredOrdersInRange.toLocaleString()} delivered orders landed as recognized revenue`,
            tone: deliveredRevenueInRange > 0 ? 'success' : 'default'
          },
          {
            label: 'Cash Collected',
            value: formatCurrency(approvedPaymentsValueInRange),
            helper: `${approvedPaymentsInRange.length.toLocaleString()} approved payments were cleared in this window`,
            tone: approvedPaymentsValueInRange >= deliveredRevenueInRange && approvedPaymentsValueInRange > 0 ? 'success' : 'default'
          },
          {
            label: 'Gross Profit',
            value: formatCurrency(grossProfitInRange),
            helper: `${formatCurrency(deliveredCogsInRange)} in COGS was absorbed by delivered revenue`,
            tone: grossProfitInRange >= 0 ? 'success' : 'danger'
          },
          {
            label: 'Gross Margin %',
            value: `${grossMarginPct.toFixed(1)}%`,
            helper: 'Profitability of delivered revenue after direct product cost',
            tone: grossMarginPct >= 20 ? 'success' : grossMarginPct >= 0 ? 'warning' : 'danger'
          },
          {
            label: 'Collection Rate',
            value: `${collectionRate.toFixed(1)}%`,
            helper: 'Approved collections compared with billed order value',
            tone: collectionRate >= 85 ? 'success' : collectionRate >= 60 ? 'warning' : 'danger'
          },
          {
            label: 'Open Receivables',
            value: formatCurrency(openReceivablesValue),
            helper: `${openReceivableOrdersCount.toLocaleString()} orders still carry an unpaid balance`,
            tone: openReceivablesValue === 0 ? 'success' : openReceivablesValue <= currentOrderValue * 0.2 ? 'warning' : 'danger'
          },
          {
            label: 'Avg Days Past Due',
            value: `${avgDaysPastDue.toFixed(1)} days`,
            helper: 'Average overdue days across open receivables',
            tone: avgDaysPastDue <= 7 ? 'success' : avgDaysPastDue <= 15 ? 'warning' : 'danger'
          }
        ]);
        setCategoryMarginTrend(categoryMarginData);
        setReceivablesAging(receivablesAgingBuckets);

        setOrderReportMetrics([
          {
            label: 'Total Orders',
            value: currentTotalOrders.toLocaleString(),
            delta: percentChange(currentTotalOrders, previousTotalOrders),
            helper: 'Compared with previous period'
          },
          {
            label: 'Total Order Value',
            value: formatCurrency(currentOrderValue),
            delta: percentChange(currentOrderValue, previousOrderValue),
            helper: 'Compared with previous period'
          },
          {
            label: 'Average Order Value',
            value: formatCurrency(currentAverageOrderValue),
            delta: percentChange(currentAverageOrderValue, previousAverageOrderValue),
            helper: 'Compared with previous period'
          },
          {
            label: 'Stuck Orders Count',
            value: currentStuckOrdersCount.toLocaleString(),
            delta: percentChange(currentStuckOrdersCount, previousStuckOrdersCount),
            helper: 'Orders still in review or pending for more than 48 hours'
          },
          {
            label: 'Avg Verification Hours',
            value: `${currentAvgVerificationHours.toFixed(1)} hrs`,
            delta: percentChange(currentAvgVerificationHours, previousAvgVerificationHours),
            helper: 'Average time to move from submission into the next workflow stage'
          }
        ]);

        const volumeBucketCount = selectedDays <= 7 ? selectedDays : selectedDays <= 30 ? 8 : selectedDays <= 90 ? 9 : 12;
        const previousWindowEnd = new Date(currentWindowStart);
        previousWindowEnd.setDate(previousWindowEnd.getDate() - 1);
        previousWindowEnd.setHours(23, 59, 59, 999);

        const currentVolumeBuckets = getBucketRanges(currentWindowStart, selectedDays, volumeBucketCount);
        const previousVolumeBuckets = getBucketRanges(previousWindowStart, selectedDays, volumeBucketCount).map((bucket) => ({
          start: bucket.start,
          end: bucket.end > previousWindowEnd ? previousWindowEnd : bucket.end
        }));

        const weeklyVolume: OrderVolumePoint[] = currentVolumeBuckets.map((bucket, index) => {
          const previousBucket = previousVolumeBuckets[index];
          const currentCount = currentWindowOrders.filter(
            (order) => order.parsedDate >= bucket.start && order.parsedDate <= bucket.end
          ).length;
          const previousCount = previousWindowOrders.filter(
            (order) => order.parsedDate >= previousBucket.start && order.parsedDate <= previousBucket.end
          ).length;

          return {
            label: formatBucketLabel(bucket.start, selectedDays),
            current: currentCount,
            previous: previousCount
          };
        });

        setOrderVolumeTrend(weeklyVolume);

        const trackedStatuses = [
          { label: 'Delivered', status: OrderStatus.DELIVERED, colorClass: 'bg-emerald-600', trackClass: 'bg-emerald-50' },
          { label: 'Shipped', status: OrderStatus.SHIPPED, colorClass: 'bg-blue-600', trackClass: 'bg-blue-50' },
          { label: 'Processing', status: OrderStatus.PROCESSING, colorClass: 'bg-sky-500', trackClass: 'bg-sky-50' },
          { label: 'Pending', status: OrderStatus.PENDING, colorClass: 'bg-amber-500', trackClass: 'bg-amber-50' }
        ];

        const totalTrackedStatuses = trackedStatuses.reduce(
          (sum, item) => sum + currentWindowOrders.filter((order) => order.status === item.status).length,
          0
        );

        setOrderStatusBreakdown(
          trackedStatuses.map((item) => {
            const count = currentWindowOrders.filter((order) => order.status === item.status).length;
            const share = totalTrackedStatuses > 0 ? (count / totalTrackedStatuses) * 100 : 0;
            return { label: item.label, count, share, colorClass: item.colorClass, trackClass: item.trackClass };
          })
        );

        const currentProductPerformance = new Map<string, { quantity: number; revenue: number; cogs: number }>();

        currentWindowOrders.forEach((order) => {
          order.items.forEach((item) => {
            const product = allProducts.find((entry) => entry.id === item.productId);
            const quantity = Number(item.quantity || 0);
            const revenue = quantity * Number(item.priceAtOrder || 0);
            const cogs = quantity * Number(product?.costPrice || 0);
            const existing = currentProductPerformance.get(item.productId) || { quantity: 0, revenue: 0, cogs: 0 };
            existing.quantity += Number(item.quantity || 0);
            existing.revenue += revenue;
            existing.cogs += cogs;
            currentProductPerformance.set(item.productId, existing);
          });
        });

        const rankedProducts = Array.from(currentProductPerformance.entries())
          .map(([productId, metrics]) => {
            const product = allProducts.find((entry) => entry.id === productId);
            return {
              id: productId,
              name: product?.name || 'Unknown Product',
              category: product?.category || 'Uncategorized',
              orderCount: metrics.quantity,
              grossRevenue: metrics.revenue
            };
          })
          .sort((a, b) => {
            if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
            return b.grossRevenue - a.grossRevenue;
          })
          .map((item, index) => ({ ...item, rank: index + 1 }));

        setTopOrderProducts(rankedProducts);
 setInventoryMetrics([
          {
            label: 'Total Inventory Value',
            value: formatCurrency(inventoryValue),
            helper: 'Current stock position'
          },
          {
            label: 'Total Units On Hand',
            value: `${totalUnitsOnHand.toLocaleString()} units`,
            helper: 'Across all storage locations'
          },
          {
            label: 'Inventory Turnover Rate',
               value: `${inventoryTurnoverRateValue.toFixed(1)}x`,
            helper: 'Performance across selected range'
          },
          {
            label: 'Reorder Risk',
            value: `${lowStockCount.toLocaleString()} items`,
            helper: 'Critical low or empty products',
            tone: 'danger'
          }
        ]);

        const stockByLocation = [
          {
            label: 'Main Warehouse',
            quantity: allProducts.reduce((sum, product) => sum + Number(product.stock?.mainWarehouse || 0), 0),
            colorClass: 'bg-primary',
            trackClass: 'bg-primary/10'
          },
          {
            label: 'Back Room',
            quantity: allProducts.reduce((sum, product) => sum + Number(product.stock?.backRoom || 0), 0),
            colorClass: 'bg-blue-500',
            trackClass: 'bg-blue-50'
          },
          {
            label: 'Show Room',
            quantity: allProducts.reduce((sum, product) => sum + Number(product.stock?.showRoom || 0), 0),
            colorClass: 'bg-sky-400',
            trackClass: 'bg-sky-50'
          }
        ];

        setStockDistribution(
          stockByLocation.map((item) => ({
            ...item,
            share: totalUnitsOnHand > 0 ? (item.quantity / totalUnitsOnHand) * 100 : 0
          }))
        );

        const trendBucketCount = selectedDays <= 7 ? 7 : selectedDays <= 30 ? 6 : selectedDays <= 90 ? 6 : 12;
        const trendBucketSize = Math.ceil(selectedDays / trendBucketCount);
        const financialBuckets = Array.from({ length: trendBucketCount }, (_, index) => {
          const bucketStart = new Date(currentWindowStart);
          bucketStart.setDate(bucketStart.getDate() + index * trendBucketSize);
          const bucketEnd = new Date(bucketStart);
          bucketEnd.setDate(bucketEnd.getDate() + trendBucketSize - 1);
          if (bucketEnd > now) bucketEnd.setTime(now.getTime());

          const label = formatBucketLabel(bucketStart, selectedDays);

          const invoiced = currentWindowOrders
            .filter((order) => order.parsedDate >= bucketStart && order.parsedDate <= bucketEnd)
            .reduce((sum, order) => sum + Number(order.total || 0), 0);
          const collected = currentWindowPayments
            .filter((payment) => payment.parsedDate >= bucketStart && payment.parsedDate <= bucketEnd && payment.status === PaymentStatus.APPROVED)
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
          const atRisk =
            currentWindowPayments
              .filter((payment) => payment.parsedDate >= bucketStart && payment.parsedDate <= bucketEnd && payment.status === PaymentStatus.PENDING)
              .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) +
            currentWindowReturns
              .filter((entry) => entry.parsedDate >= bucketStart && entry.parsedDate <= bucketEnd)
              .reduce((sum, entry) => sum + Number(entry.lossValue || 0), 0);

          return {
            label,
            invoiced,
            collected,
            atRisk
          };
        });

        setFinancialTrend(financialBuckets);
        setFinancialInsights([
          {
            title: 'Cash Conversion',
            value: `${collectionRate.toFixed(1)}%`,
            helper: `${formatCurrency(approvedPaymentsValueInRange)} collected from ${formatCurrency(currentOrderValue)} billed in the active range`,
            tone: collectionRate >= 85 ? 'success' : collectionRate >= 60 ? 'warning' : 'danger'
          },
          {
            title: 'Credit Pressure',
            value: formatCurrency(outstandingCreditValue),
            helper:
              activeCreditCasesInRange > 0
                ? `${activeCreditCasesInRange.toLocaleString()} new credit cases were opened in-range, adding ${formatCurrency(currentWindowCreditExposure)} in fresh exposure`
                : 'No new credit exposure was opened in the selected window',
            tone: outstandingCreditValue === 0 ? 'success' : outstandingCreditValue <= currentOrderValue * 0.15 ? 'warning' : 'danger'
          },
          {
            title: 'Revenue At Risk',
            value: formatCurrency(revenueAtRiskValue),
            helper: `${formatCurrency(pendingPaymentsValueInRange)} awaiting payment approval and ${formatCurrency(currentWindowReturnLossValue)} lost through returns or damage`,
            tone: revenueAtRiskValue === 0 ? 'success' : revenueAtRiskValue <= currentOrderValue * 0.12 ? 'warning' : 'danger'
          },
          {
            title: 'Best Margin Category',
            value: highestMarginCategory ? `${highestMarginCategory.marginPct.toFixed(1)}%` : '--',
            helper: highestMarginCategory
              ? `${highestMarginCategory.category} leads with ${formatCurrency(highestMarginCategory.profit)} gross profit`
              : 'No category margin data is available in the selected window',
            tone: highestMarginCategory ? 'success' : 'default'
          },
          {
            title: 'Loss-Leader Watch',
            value: weakestMarginCategory ? `${weakestMarginCategory.marginPct.toFixed(1)}%` : '--',
            helper: weakestMarginCategory
              ? `${weakestMarginCategory.category} is the weakest category margin in the current range`
              : 'No loss-leader categories are visible in the selected window',
            tone: weakestMarginCategory ? (weakestMarginCategory.marginPct < 0 ? 'danger' : 'warning') : 'default'
          }
        ]);

        const trendPoints = Array.from({ length: trendBucketCount }, (_, index) => {
          const bucketStart = new Date(currentWindowStart);
          bucketStart.setDate(bucketStart.getDate() + index * trendBucketSize);
          const bucketEnd = new Date(bucketStart);
          bucketEnd.setDate(bucketEnd.getDate() + trendBucketSize - 1);
          if (bucketEnd > now) bucketEnd.setTime(now.getTime());
          const bucketRevenue = ordersWithDates
            .filter((order) => order.parsedDate >= bucketStart && order.parsedDate <= bucketEnd)
            .reduce((sum, order) => sum + Number(order.total || 0), 0);
 const normalizedValue = inventoryValue > 0 ? bucketRevenue / Math.max(inventoryValue / trendBucketCount, 1) : 0;          return {
             label: formatBucketLabel(bucketStart, selectedDays),
            value: Number(normalizedValue.toFixed(2))
          };
        });

        setInventoryTrend(trendPoints);

        const sellingProducts = Array.from(currentProductPerformance.entries())
          .map(([productId, metrics]) => {
            const product = allProducts.find((entry) => entry.id === productId);
            const status =
                metrics.quantity >= Math.max(10, Math.round(selectedDays / 2)) ? 'High Demand' :
              metrics.quantity >= Math.max(3, Math.round(selectedDays / 8)) ? 'Stable' :
              'Low Demand';

            return {
              id: productId,
              name: product?.name || 'Unknown Product',
              revenue: metrics.revenue,
              profit: metrics.revenue - metrics.cogs,
              marginPct: metrics.revenue > 0 ? ((metrics.revenue - metrics.cogs) / metrics.revenue) * 100 : 0,
              status
            };
          })
          .sort((a, b) => b.revenue - a.revenue);

        setTopSellingProducts(sellingProducts);
        const stockCoverageCandidates = allProducts
          .map((product) => {
            const unitsOnHand =
              Number(product.stock?.mainWarehouse || 0) +
              Number(product.stock?.backRoom || 0) +
              Number(product.stock?.showRoom || 0);
            const soldUnits = currentProductPerformance.get(product.id)?.quantity || 0;
            const dailyVelocity = soldUnits / Math.max(selectedDays, 1);

            if (unitsOnHand <= 0 || dailyVelocity <= 0) return null;

            const daysRemaining = unitsOnHand / dailyVelocity;
            const tone: StockCoverageItem['tone'] =
              daysRemaining <= 14 ? 'tight' : daysRemaining <= 45 ? 'healthy' : 'excess';

            return {
              id: product.id,
              name: product.name,
              category: product.category || 'Uncategorized',
              daysRemaining,
              dailyVelocity,
              unitsOnHand,
              tone
            };
          })
          .filter((item): item is StockCoverageItem => Boolean(item))
          .sort((a, b) => a.daysRemaining - b.daysRemaining)
          .slice(0, 5);

        setStockCoverage(stockCoverageCandidates);

        const zeroDemandCapital = allProducts
          .map((product) => {
            const unitsOnHand =
              Number(product.stock?.mainWarehouse || 0) +
              Number(product.stock?.backRoom || 0) +
              Number(product.stock?.showRoom || 0);
            const soldUnits = currentProductPerformance.get(product.id)?.quantity || 0;
            if (unitsOnHand <= 0 || soldUnits > 0) return null;
            const capitalValue = unitsOnHand * Number(product.costPrice || product.price || 0);
            if (capitalValue <= 0) return null;
            return {
              id: product.id,
              name: product.name,
              category: product.category || 'Uncategorized',
              unitsOnHand,
              capitalValue
            };
          })
          .filter((item): item is DeadStockItem => Boolean(item))
          .sort((a, b) => b.capitalValue - a.capitalValue)
          .slice(0, 5);

        setDeadStockItems(zeroDemandCapital);
  setInventoryTurnover(inventoryTurnoverRateValue);
        setInventoryTurnoverTrend(trendPoints.map((point) => ({ name: point.label, val: point.value })));
        const previousProductPerformance = new Map<string, number>();
        previousWindowOrders.forEach((order) => {
          order.items.forEach((item) => {
            previousProductPerformance.set(
              item.productId,
              (previousProductPerformance.get(item.productId) || 0) + Number(item.quantity || 0)
            );
          });
        });

        const velocityList = Array.from(
          new Set([...currentProductPerformance.keys(), ...previousProductPerformance.keys()])
        )
          .map((productId) => {
            const currentQty = currentProductPerformance.get(productId)?.quantity || 0;
            const previousQty = previousProductPerformance.get(productId) || 0;
            const delta = percentChange(currentQty, previousQty);
            const product = allProducts.find((entry) => entry.id === productId);
            return {
              id: productId,
              name: product?.name || 'Unknown Product',
              delta,
              tone: delta >= 0 ? 'fast' as const : 'slow' as const
            };
          })
          .filter((item) => Number.isFinite(item.delta) && item.name !== 'Unknown Product')
          .sort((a, b) => b.delta - a.delta);

        setMovementVelocity([
          ...velocityList.filter((item) => item.tone === 'fast').slice(0, 2),
          ...velocityList.filter((item) => item.tone === 'slow').slice(0, 2)
        ]);
    const today = new Date();
        today.setHours(0, 0, 0, 0);
        const criticalWindowDays = Math.max(7, Math.min(selectedDays, 30));

        const expiryList = allProducts
          .map((product) => {
            const batchExpiryDates = (product.batches || [])
              .map((batch) => batch.expiryDate)
              .filter((value): value is string => Boolean(value))
              .map((value) => new Date(value))
              .filter((date) => !isNaN(date.getTime()));

            const directExpiry = product.nextExpiryDate ? new Date(product.nextExpiryDate) : null;
            const validDirectExpiry = directExpiry && !isNaN(directExpiry.getTime()) ? directExpiry : null;

            const earliestExpiry = [...batchExpiryDates, ...(validDirectExpiry ? [validDirectExpiry] : [])]
              .sort((a, b) => a.getTime() - b.getTime())[0];

            if (!earliestExpiry) return null;

            const unitsOnHand =
              Number(product.stock?.mainWarehouse || 0) +
              Number(product.stock?.backRoom || 0) +
              Number(product.stock?.showRoom || 0);

            const daysRemaining = Math.ceil((earliestExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const status: ExpiryProductItem['status'] =
              daysRemaining < 0 ? 'Expired' : daysRemaining <= criticalWindowDays ? 'Critical' : 'Watch';

            return {
              id: product.id,
              name: product.name,
              category: product.category || 'Uncategorized',
              expiryDate: earliestExpiry.toISOString(),
              daysRemaining,
              quantity: unitsOnHand,
              status
            };
          })
          .filter((item): item is ExpiryProductItem => Boolean(item))
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        setExpiryProducts(expiryList);
        setExpiryMetrics([
          {
            label: 'Expired Items',
            value: expiryList.filter((item) => item.status === 'Expired').length.toLocaleString(),
            helper: 'Products past expiry date',
            tone: 'danger'
          },
          {
            label: 'Critical Window',
            value: expiryList.filter((item) => item.status === 'Critical').length.toLocaleString(),
            helper: 'Products expiring soon',
            tone: 'warning'
          },
          {
            label: 'Tracked Expiry',
            value: expiryList.length.toLocaleString(),
            helper: 'Products with expiry dates on record'
          }
        ]);

        if (allOrders.length === 0) {
          setGrowthTrend([{ name: 'No Data', val: 0 }]);
          setPredictions(emptyPredictions());
          setTotalRevenue(0);
          setExecutiveSummary({
            revenueValue: 0,
       inventoryValue,
            lowStockCount,
            deliveredOrders: deliveredOrdersInRange,
            activeOrders,
            pendingPaymentsCount: pendingPayments.length,
            pendingPaymentsValue,
            outstandingCreditValue,
            returnLossValue,
            summaryNote: 'No completed order history yet. Inventory and finance indicators are shown from the current records.'
          });
          setFinancialInsights([
            { title: 'Cash Conversion', value: `${collectionRate.toFixed(1)}%`, helper: 'No completed order history yet, so this is based on current finance records only.', tone: 'default' },
            {
              title: 'Credit Pressure',
              value: formatCurrency(outstandingCreditValue),
              helper: activeCreditCasesInRange > 0 ? `${activeCreditCasesInRange.toLocaleString()} credit cases remain open.` : 'No credit exposure is currently open.',
              tone: outstandingCreditValue > 0 ? 'warning' : 'success'
            },
            {
              title: 'Revenue At Risk',
              value: formatCurrency(revenueAtRiskValue),
              helper: 'Pending approvals, returns, and credit exposure are still being tracked.',
              tone: revenueAtRiskValue > 0 ? 'warning' : 'success'
            },
            {
              title: 'Best Margin Category',
              value: '--',
              helper: 'No delivered category margin data is available yet.',
              tone: 'default'
            },
            {
              title: 'Loss-Leader Watch',
              value: '--',
              helper: 'No delivered category margin data is available yet.',
              tone: 'default'
            }
          ]);
          return;
        }

        const timestamps = currentWindowOrders.map((order) => order.parsedDate.getTime()).filter((time) => !isNaN(time));
        if (timestamps.length === 0) return;

        let mode: 'daily' | 'weekly' | 'monthly' = 'monthly';
        if (selectedDays <= 31) mode = 'daily';
        else if (selectedDays <= 120) mode = 'weekly';
        setTimeResolution(mode === 'daily' ? 'Day' : mode === 'weekly' ? 'Week' : 'Month');

       

        const aggregatedRevenue: Record<string, number> = {};
        const productSalesCurrent: Record<string, number> = {};
        const productSalesPrevious: Record<string, number> = {};
        let totalRev = 0;

        const getKey = (d: Date) => {
          if (mode === 'daily') return d.toISOString().split('T')[0];
          if (mode === 'weekly') return getStartOfWeek(d).toISOString().split('T')[0];
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        };

     

          currentWindowOrders.forEach((order) => {
          const dateObj = order.parsedDate;

          const key = getKey(dateObj);
          aggregatedRevenue[key] = (aggregatedRevenue[key] || 0) + order.total;
          totalRev += order.total;

          order.items.forEach((item) => {
            productSalesCurrent[item.productId] = (productSalesCurrent[item.productId] || 0) + item.quantity;
          });
        });

        previousWindowOrders.forEach((order) => {
          order.items.forEach((item) => {
            productSalesPrevious[item.productId] = (productSalesPrevious[item.productId] || 0) + item.quantity;
          });
        });

        setTotalRevenue(totalRev);
        setExecutiveSummary({
           revenueValue: totalRev,
          inventoryValue,
          lowStockCount,
          deliveredOrders: deliveredOrdersInRange,
          activeOrders,
          pendingPaymentsCount: pendingPayments.length,
          pendingPaymentsValue,
          outstandingCreditValue,
          returnLossValue,
         summaryNote: `Revenue for the selected range totals ${formatCurrency(totalRev)}, with ${activeOrders} active orders still in motion.`
        });

        const timelineData: { date: Date; key: string; revenue: number }[] = [];
        const startDate = new Date(currentWindowStart);
        const endDate = new Date(now);
        let current = mode === 'daily' ? getStartOfDay(startDate) : mode === 'weekly' ? getStartOfWeek(startDate) : getStartOfMonth(startDate);
        let loopGuard = 0;

        while (current <= endDate && loopGuard < 1000) {
          const key = getKey(current);
          timelineData.push({ date: new Date(current), key, revenue: aggregatedRevenue[key] || 0 });
          if (mode === 'daily') current.setDate(current.getDate() + 1);
          else if (mode === 'weekly') current.setDate(current.getDate() + 7);
          else current.setMonth(current.getMonth() + 1);
          loopGuard++;
        }

        setGrowthTrend(timelineData.map((entry) => ({ name: entry.key, val: entry.revenue })));

        if (timelineData.length >= 2) {
          const lastVal = timelineData[timelineData.length - 1].revenue;
          const prevVal = timelineData[timelineData.length - 2].revenue;
          let nextGrowthPercentage = 0;
          let nextGrowthPositive = true;
          if (prevVal === 0) {
            nextGrowthPercentage = lastVal > 0 ? 100 : 0;
            nextGrowthPositive = true;
          } else {
            const pct = ((lastVal - prevVal) / prevVal) * 100;
            nextGrowthPercentage = Math.abs(pct);
            nextGrowthPositive = pct >= 0;
          }
          setGrowthPercentage(nextGrowthPercentage);
          setIsGrowthPositive(nextGrowthPositive);
          setExecutiveSummary((current) => ({
           ...current,
            summaryNote: `Revenue is trending ${nextGrowthPositive ? 'up' : 'down'} by ${nextGrowthPercentage.toFixed(1)}% compared with the prior range, with ${activeOrders} active orders still in motion.`
          }));
        }

        const topProdIds = Object.keys(productSalesCurrent)
          .sort((a, b) => productSalesCurrent[b] - productSalesCurrent[a])
          .slice(0, 4);

        const predictionCards = topProdIds.map((productId) => {
          const product = allProducts.find((entry) => entry.id === productId);
          const currentQty = productSalesCurrent[productId];
          const previousQty = productSalesPrevious[productId] || 0;

          let trend = 0;
          if (previousQty > 0) trend = ((currentQty - previousQty) / previousQty) * 100;
          else if (currentQty > 0) trend = 100;

          let badge = 'Stable';
          if (trend > 20) badge = 'Trending Up';
          if (trend > 50) badge = 'High Demand';
          if (trend < -10) badge = 'Slowing';

          return {
            name: product ? product.name : 'Unknown',
            growth: `${trend >= 0 ? '+' : ''}${trend.toFixed(0)}%`,
            badge,
            isPositive: trend >= 0
          };
        });

        setPredictions(predictionCards.length > 0 ? predictionCards : emptyPredictions());
      } catch (err) {
        console.error('Report fetch error:', err);
        setGrowthTrend([{ name: 'No Data', val: 0 }]);
        setInventoryTurnover(0);
        setInventoryTurnoverTrend([{ name: 'No Data', val: 0 }]);
        setPredictions(emptyPredictions());
        setStockCoverage([]);
        setDeadStockItems([]);
        setTopBuyerRevenue([]);
        setBuyerChurnRisk([]);
        setBuyerPaymentReliability([]);
        setBuyerAov([]);
        setFinancialMetrics([
          { label: 'Recognized Revenue', value: formatCurrency(0), helper: 'Financial data is unavailable right now.' },
          { label: 'Cash Collected', value: formatCurrency(0), helper: 'Financial data is unavailable right now.' },
          { label: 'Gross Profit', value: formatCurrency(0), helper: 'Financial data is unavailable right now.' },
          { label: 'Gross Margin %', value: '0.0%', helper: 'Financial data is unavailable right now.' },
          { label: 'Collection Rate', value: '0.0%', helper: 'Financial data is unavailable right now.' },
          { label: 'Open Receivables', value: formatCurrency(0), helper: 'Financial data is unavailable right now.', tone: 'warning' },
          { label: 'Avg Days Past Due', value: '0.0 days', helper: 'Financial data is unavailable right now.', tone: 'warning' }
        ]);
        setFinancialTrend([]);
        setCategoryMarginTrend([]);
        setReceivablesAging([]);
        setFinancialInsights([
          { title: 'Cash Conversion', value: '0.0%', helper: 'Financial data is unavailable right now.', tone: 'default' },
          { title: 'Credit Pressure', value: formatCurrency(0), helper: 'Financial data is unavailable right now.', tone: 'default' },
          { title: 'Revenue At Risk', value: formatCurrency(0), helper: 'Financial data is unavailable right now.', tone: 'default' },
          { title: 'Best Margin Category', value: '--', helper: 'Financial data is unavailable right now.', tone: 'default' },
          { title: 'Loss-Leader Watch', value: '--', helper: 'Financial data is unavailable right now.', tone: 'default' }
        ]);
        setExecutiveSummary({
          revenueValue: 0,
          inventoryValue: 0,
          lowStockCount: 0,
          deliveredOrders: 0,
          activeOrders: 0,
          pendingPaymentsCount: 0,
          pendingPaymentsValue: 0,
          outstandingCreditValue: 0,
          returnLossValue: 0,
          summaryNote: 'Executive summary data is unavailable right now.'
        });
      }
    };

    fetchData();
   
  }, [selectedRange]);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const handleExecutivePdfExport = () => {
    const reportNode = reportPrintRef.current;
    if (reportNode) {
      const reportWindow = window.open('', '_blank');
      if (!reportWindow) return;

      const clonedReportNode = reportNode.cloneNode(true) as HTMLDivElement;
      clonedReportNode.querySelectorAll('[data-print-exclude="true"]').forEach((element) => {
        element.remove();
      });

      const styleMarkup = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((node) => node.outerHTML)
        .join('\n');

      const liveReportHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>B2B Intel Report</title>
            ${styleMarkup}
            <style>
              body {
                margin: 0;
                background: #f8fafc;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              #report-print-root {
                max-width: 1280px;
                margin: 0 auto;
                padding: 24px;
              }
              [data-print-expand="true"] {
                max-height: none !important;
                overflow: visible !important;
              }
              [data-print-expand="true"] thead,
              .sticky {
                position: static !important;
              }
              .recharts-responsive-container,
              .recharts-wrapper {
                overflow: visible !important;
              }
              @media print {
                body {
                  background: white;
                }
                #report-print-root {
                  max-width: none;
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div id="report-print-root">${clonedReportNode.outerHTML}</div>
            <script>
              window.addEventListener('load', function () {
                setTimeout(function () {
                  window.print();
                }, 300);
              });
            </script>
          </body>
        </html>
      `;

      reportWindow.document.write(liveReportHtml);
      reportWindow.document.close();
      return;
    }

    const reportWindow = window.open('', '_blank');
    if (!reportWindow) return;

    const generatedAt = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    const selectedReportTypeLabel =
      reportTypeOptions.find((option) => option.key === reportType)?.label || 'All';

    const executiveCards = executiveMetrics
      .map(
        (metric) => `
      <article class="metric-card ${metric.tone}">
        <p class="eyebrow muted">${escapeHtml(metric.label)}</p>
        <h3 class="metric-value">${escapeHtml(metric.value)}</h3>
        <p class="metric-helper">${escapeHtml(metric.helper)}</p>
      </article>
    `
      )
      .join('');

    const orderCards = orderReportMetrics
      .map((metric) => {
        const isPositive = metric.delta >= 0;
        return `
          <article class="metric-card">
            <div class="metric-row">
              <p class="eyebrow muted">${escapeHtml(metric.label)}</p>
              <span class="delta ${isPositive ? 'positive' : 'negative'}">${escapeHtml(formatDelta(metric.delta))}</span>
            </div>
            <h3 class="metric-value">${escapeHtml(metric.value)}</h3>
            <p class="metric-helper">${escapeHtml(metric.helper)}</p>
          </article>
        `;
      })
      .join('');

    const inventoryCards = inventoryMetrics
      .map(
        (metric) => `
      <article class="metric-card">
        <p class="eyebrow muted">${escapeHtml(metric.label)}</p>
        <h3 class="metric-value ${metric.tone === 'danger' ? 'danger-text' : ''}">${escapeHtml(metric.value)}</h3>
        <p class="metric-helper">${escapeHtml(metric.helper)}</p>
      </article>
    `
      )
      .join('');

    const financialCards = financialMetrics
      .map(
        (metric) => `
      <article class="metric-card">
        <p class="eyebrow muted">${escapeHtml(metric.label)}</p>
        <h3 class="metric-value ${metric.tone === 'success' ? 'positive-text' : metric.tone === 'warning' ? 'warning-text' : metric.tone === 'danger' ? 'negative-text' : ''}">${escapeHtml(metric.value)}</h3>
        <p class="metric-helper">${escapeHtml(metric.helper)}</p>
      </article>
    `
      )
      .join('');

    const financialInsightCards = financialInsights
      .map(
        (item) => `
      <article class="surface-card">
        <p class="eyebrow muted">${escapeHtml(item.title)}</p>
        <h3 class="${item.tone === 'success' ? 'positive-text' : item.tone === 'warning' ? 'warning-text' : item.tone === 'danger' ? 'negative-text' : ''}">${escapeHtml(item.value)}</h3>
        <p class="metric-helper">${escapeHtml(item.helper)}</p>
      </article>
    `
      )
      .join('');

    const financialTrendRows =
      financialTrend.length > 0
        ? financialTrend
            .map(
              (point) => `
          <tr>
            <td>${escapeHtml(point.label)}</td>
            <td class="align-right">${escapeHtml(formatCurrency(point.invoiced))}</td>
            <td class="align-right">${escapeHtml(formatCurrency(point.collected))}</td>
            <td class="align-right">${escapeHtml(formatCurrency(point.atRisk))}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="4" class="empty-cell">No financial trend data is available for the selected range yet.</td>
          </tr>
        `;

    const categoryMarginRows =
      categoryMarginTrend.length > 0
        ? categoryMarginTrend
            .map(
              (item) => `
          <tr>
            <td>${escapeHtml(item.category)}</td>
            <td class="align-right">${escapeHtml(formatCurrency(item.revenue))}</td>
            <td class="align-right">${escapeHtml(formatCurrency(item.profit))}</td>
            <td class="align-right">${escapeHtml(`${item.marginPct.toFixed(1)}%`)}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="4" class="empty-cell">No category margin data is available for the selected range yet.</td>
          </tr>
        `;

    const receivablesAgingRows =
      receivablesAging.length > 0
        ? receivablesAging
            .map(
              (item) => `
          <tr>
            <td>${escapeHtml(item.bucket)}</td>
            <td class="align-right">${item.orderCount.toLocaleString()}</td>
            <td class="align-right">${escapeHtml(formatCurrency(item.amount))}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="3" class="empty-cell">No A/R aging data is available for the selected range yet.</td>
          </tr>
        `;

    const topOrderProductsRows =
      displayedTopOrderProducts.length > 0
        ? displayedTopOrderProducts
            .map(
              (product) => `
          <tr>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category)}</td>
            <td class="align-right">${product.orderCount.toLocaleString()}</td>
            <td class="align-right">${escapeHtml(formatCurrency(product.grossRevenue))}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="4" class="empty-cell">No product order data is available for the selected range yet.</td>
          </tr>
        `;

    const topBuyerRevenueRows =
      topBuyerRevenue.length > 0
        ? topBuyerRevenue
            .map(
              (buyer) => `
          <tr>
            <td>${escapeHtml(buyer.buyerLabel)}</td>
            <td class="align-right">${buyer.orderCount.toLocaleString()}</td>
            <td class="align-right">${escapeHtml(formatCurrency(buyer.revenue))}</td>
            <td class="align-right">${escapeHtml(`${buyer.revenueShare.toFixed(1)}%`)}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="4" class="empty-cell">No buyer revenue data is available for the selected range yet.</td>
          </tr>
        `;

    const churnRiskRows =
      buyerChurnRisk.length > 0
        ? buyerChurnRisk
            .map(
              (buyer) => `
          <tr>
            <td>${escapeHtml(buyer.buyerLabel)}</td>
            <td class="align-right">${buyer.lifetimeOrders.toLocaleString()}</td>
            <td class="align-right">${escapeHtml(`${buyer.daysSinceLastOrder} days`)}</td>
            <td class="align-right">${escapeHtml(buyer.riskLevel)}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="4" class="empty-cell">No churn-risk buyers are currently flagged.</td>
          </tr>
        `;

    const paymentReliabilityRows =
      buyerPaymentReliability.length > 0
        ? buyerPaymentReliability
            .map(
              (buyer) => `
          <tr>
            <td>${escapeHtml(buyer.buyerLabel)}</td>
            <td class="align-right">${escapeHtml(`${buyer.score.toFixed(0)}/100`)}</td>
            <td class="align-right">${escapeHtml(formatLag(buyer.averageLagHours))}</td>
            <td class="align-right">${buyer.paymentProofCount.toLocaleString()}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="4" class="empty-cell">No payment-proof timing data is available for the selected range yet.</td>
          </tr>
        `;

    const buyerAovRows =
      buyerAov.length > 0
        ? buyerAov
            .map(
              (buyer) => `
          <tr>
            <td>${escapeHtml(buyer.buyerLabel)}</td>
            <td class="align-right">${escapeHtml(formatCurrency(buyer.aov))}</td>
            <td class="align-right">${buyer.orderCount.toLocaleString()}</td>
            <td class="align-right">${escapeHtml(buyer.behavior)}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="4" class="empty-cell">No buyer AOV data is available for the selected range yet.</td>
          </tr>
        `;

    const topSellingRows =
      displayedTopSellingProducts.length > 0
        ? displayedTopSellingProducts
            .map(
              (product) => `
          <tr>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.status)}</td>
            <td class="align-right">${escapeHtml(formatCurrency(product.revenue))}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="3" class="empty-cell">No sales data available for the current window yet.</td>
          </tr>
        `;

    const expiryRows =
      displayedExpiryProducts.length > 0
        ? displayedExpiryProducts
            .map(
              (product) => `
          <tr>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category)}</td>
            <td class="align-right">${product.quantity.toLocaleString()}</td>
            <td class="align-right">${escapeHtml(new Date(product.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="4" class="empty-cell">No expiry dates are recorded for products in inventory yet.</td>
          </tr>
        `;

    const stockCoverageRows =
      stockCoverage.length > 0
        ? stockCoverage
            .map(
              (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.category)}</td>
            <td class="align-right">${item.unitsOnHand.toLocaleString()}</td>
            <td class="align-right">${escapeHtml(item.dailyVelocity.toFixed(1))}/day</td>
            <td class="align-right">${escapeHtml(`${Math.round(item.daysRemaining)} days`)}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="5" class="empty-cell">No active stock coverage items are available for the selected range yet.</td>
          </tr>
        `;

    const deadStockRows =
      deadStockItems.length > 0
        ? deadStockItems
            .map(
              (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.category)}</td>
            <td class="align-right">${item.unitsOnHand.toLocaleString()}</td>
            <td class="align-right">${escapeHtml(formatCurrency(item.capitalValue))}</td>
          </tr>
        `
            )
            .join('')
        : `
          <tr>
            <td colspan="4" class="empty-cell">No zero-demand inventory is trapping capital in the selected range.</td>
          </tr>
        `;

    const trendRows = growthTrend
      .filter((point) => point.name !== 'No Data')
      .map(
        (point) => `
      <tr>
        <td>${escapeHtml(point.name)}</td>
        <td class="align-right">${escapeHtml(formatCurrency(point.val))}</td>
      </tr>
    `
      )
      .join('');

    const predictionCards = predictions
      .map(
        (item) => `
      <article class="trend-card">
        <p class="trend-name">${escapeHtml(item.name)}</p>
        <div class="trend-row">
          <span class="trend-value ${item.isPositive ? 'positive-text' : 'negative-text'}">${escapeHtml(item.growth)}</span>
          <span class="trend-badge ${item.isPositive ? 'positive-badge' : 'neutral-badge'}">${escapeHtml(item.badge)}</span>
        </div>
      </article>
    `
      )
      .join('');

    const orderSection = showOrderSections
      ? `
        <section class="section">
          <div class="section-head">
            <div>
              <h2>Order Reports</h2>
              <p>Order volume, value, fulfillment mix, and top-performing products for the selected range.</p>
            </div>
            <span class="chip">${escapeHtml(selectedDuration.label)}</span>
          </div>
          <div class="card-grid three-up">
            ${orderCards}
          </div>
          <div class="card-grid two-up">
            <article class="surface-card">
              <h3>Order Status Mix</h3>
              <div class="stack-list">
                ${orderStatusBreakdown
                  .map(
                    (status) => `
                  <div class="progress-row">
                    <div class="progress-copy">
                      <strong>${escapeHtml(status.label)}</strong>
                      <span>${status.count.toLocaleString()} orders</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill" style="width:${Math.max(status.share, status.share > 0 ? 8 : 0)}%; background:${status.label === 'Delivered' ? '#059669' : status.label === 'Shipped' ? '#2563eb' : status.label === 'Processing' ? '#0ea5e9' : '#f59e0b'};"></div>
                    </div>
                    <span class="progress-value">${Math.round(status.share)}%</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </article>
            <article class="surface-card">
              <h3>Top Ordered Products</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th class="align-right">Units</th>
                    <th class="align-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${topOrderProductsRows}
                </tbody>
              </table>
            </article>
          </div>
        </section>
      `
      : '';

    const financialSection = showFinancialSections
      ? `
        <section class="section">
          <div class="section-head">
            <div>
              <h2>Financial Report</h2>
              <p>Cash collection, receivables, credit exposure, and revenue risk across the selected reporting window.</p>
            </div>
            <span class="chip">${escapeHtml(selectedDuration.label)}</span>
          </div>
          <div class="card-grid four-up">
            ${financialCards}
          </div>
          <div class="card-grid two-up">
            <article class="surface-card">
              <h3>Financial Flow</h3>
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th class="align-right">Invoiced</th>
                    <th class="align-right">Collected</th>
                    <th class="align-right">At Risk</th>
                  </tr>
                </thead>
                <tbody>
                  ${financialTrendRows}
                </tbody>
              </table>
            </article>
            <div class="card-grid three-up">
              ${financialInsightCards}
            </div>
          </div>
          <article class="surface-card">
            <h3>A/R Aging Buckets</h3>
            <table>
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th class="align-right">Orders</th>
                  <th class="align-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                ${receivablesAgingRows}
              </tbody>
            </table>
          </article>
          <article class="surface-card">
            <h3>Margin Trend by Category</h3>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th class="align-right">Revenue</th>
                  <th class="align-right">Gross Profit</th>
                  <th class="align-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                ${categoryMarginRows}
              </tbody>
            </table>
          </article>
        </section>
      `
      : '';

    const productSection = showProductSections
      ? `
        <section class="section">
          <div class="section-head">
            <div>
              <h2>Products &amp; Inventory Report</h2>
              <p>Inventory exposure, stock placement, product momentum, and expiry monitoring.</p>
            </div>
            <span class="chip">${escapeHtml(selectedDuration.label)}</span>
          </div>
          <div class="card-grid four-up">
            ${inventoryCards}
          </div>
          <div class="card-grid two-up">
            <article class="surface-card">
              <h3>Stock Distribution</h3>
              <div class="stack-list">
                ${stockDistribution
                  .map(
                    (item) => `
                  <div class="progress-row">
                    <div class="progress-copy">
                      <strong>${escapeHtml(item.label)}</strong>
                      <span>${item.quantity.toLocaleString()} units</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill" style="width:${Math.max(item.share, item.share > 0 ? 8 : 0)}%; background:${item.label === 'Main Warehouse' ? '#005A9C' : item.label === 'Back Room' ? '#3b82f6' : '#38bdf8'};"></div>
                    </div>
                    <span class="progress-value">${Math.round(item.share)}%</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </article>
            <article class="surface-card">
              <h3>Top-Selling Products</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Status</th>
                    <th class="align-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${topSellingRows}
                </tbody>
              </table>
            </article>
          </div>
          <div class="card-grid two-up">
            <article class="surface-card">
              <h3>Product Momentum</h3>
              <div class="stack-list">
                ${
                  movementVelocity.length > 0
                    ? movementVelocity
                        .map(
                          (item) => `
                      <div class="simple-row">
                        <div>
                          <strong>${escapeHtml(item.name)}</strong>
                          <span class="${item.tone === 'fast' ? 'positive-text' : 'warning-text'}">${item.tone === 'fast' ? 'Fast Moving' : 'Slow Moving'}</span>
                        </div>
                        <span class="${item.tone === 'fast' ? 'positive-text' : 'warning-text'}">${escapeHtml(formatDelta(item.delta))}</span>
                      </div>
                    `
                        )
                        .join('')
                    : '<p class="empty-note">No movement data is available for the selected range.</p>'
                }
              </div>
            </article>
            <article class="surface-card">
              <h3>Expiry Tracking</h3>
              <div class="mini-grid">
                ${expiryMetrics
                  .map(
                    (metric) => `
                  <div class="mini-card">
                    <p class="eyebrow muted">${escapeHtml(metric.label)}</p>
                    <h4>${escapeHtml(metric.value)}</h4>
                    <p>${escapeHtml(metric.helper)}</p>
                  </div>
                `
                  )
                  .join('')}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th class="align-right">Units</th>
                    <th class="align-right">Expiry Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${expiryRows}
                </tbody>
              </table>
            </article>
          </div>
          <div class="card-grid two-up">
            <article class="surface-card">
              <h3>Stock Coverage Outlook</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th class="align-right">Units</th>
                    <th class="align-right">Velocity</th>
                    <th class="align-right">Cover</th>
                  </tr>
                </thead>
                <tbody>
                  ${stockCoverageRows}
                </tbody>
              </table>
            </article>
            <article class="surface-card">
              <h3>Capital Trapped in Zero Demand</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th class="align-right">Units</th>
                    <th class="align-right">Capital Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${deadStockRows}
                </tbody>
              </table>
            </article>
          </div>
          <article class="surface-card">
            <h3>Buyer Intelligence &amp; Risk</h3>
            <div class="card-grid two-up">
              <article class="surface-card">
                <h3>Top Buyers by Revenue</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Buyer</th>
                      <th class="align-right">Orders</th>
                      <th class="align-right">Revenue</th>
                      <th class="align-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${topBuyerRevenueRows}
                  </tbody>
                </table>
              </article>
              <article class="surface-card">
                <h3>Buyer Churn Risk</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Buyer</th>
                      <th class="align-right">Lifetime Orders</th>
                      <th class="align-right">Inactive</th>
                      <th class="align-right">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${churnRiskRows}
                  </tbody>
                </table>
              </article>
              <article class="surface-card">
                <h3>Payment Reliability</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Buyer</th>
                      <th class="align-right">Score</th>
                      <th class="align-right">Avg Proof Lag</th>
                      <th class="align-right">Proofs</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${paymentReliabilityRows}
                  </tbody>
                </table>
              </article>
              <article class="surface-card">
                <h3>Average Order Value</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Buyer</th>
                      <th class="align-right">AOV</th>
                      <th class="align-right">Orders</th>
                      <th class="align-right">Behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${buyerAovRows}
                  </tbody>
                </table>
              </article>
            </div>
          </article>
        </section>
      `
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>B2B Intel Report</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 28px;
              font-family: Arial, sans-serif;
              color: #0f172a;
              background: #f8fafc;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .sheet {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 28px;
              padding: 28px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
              margin-bottom: 28px;
            }
            .eyebrow {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1.6px;
              text-transform: uppercase;
              color: #005A9C;
              margin-bottom: 8px;
            }
            .eyebrow.muted {
              color: #94a3b8;
              margin-bottom: 10px;
            }
            h1 {
              margin: 0;
              font-size: 30px;
              line-height: 1.1;
            }
            h2 {
              margin: 0;
              font-size: 24px;
              line-height: 1.2;
            }
            h3 {
              margin: 0 0 10px;
              font-size: 18px;
              line-height: 1.3;
            }
            .subtitle, .meta, .section-head p {
              margin: 8px 0 0;
              color: #475569;
              font-size: 14px;
              line-height: 1.5;
            }
            .meta {
              text-align: right;
            }
            .toolbar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 16px;
              margin-bottom: 28px;
              padding: 14px 18px;
              border-radius: 20px;
              background: #f8fafc;
            }
            .toolbar-copy {
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }
            .chip {
              display: inline-flex;
              align-items: center;
              border-radius: 999px;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              padding: 8px 12px;
              font-size: 12px;
              font-weight: 700;
              color: #334155;
            }
            .section {
              margin-bottom: 28px;
            }
            .section-head {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              gap: 16px;
              margin-bottom: 18px;
            }
            .card-grid {
              display: grid;
              gap: 14px;
              margin-bottom: 24px;
            }
            .two-up { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .three-up { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .four-up { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            .metric-card {
              border: 1px solid #dbeafe;
              border-radius: 18px;
              padding: 18px;
              background: #ffffff;
            }
            .metric-card.primary { background: #eff6ff; border-color: #bfdbfe; }
            .metric-card.success { background: #ecfdf5; border-color: #a7f3d0; }
            .metric-card.warning { background: #fffbeb; border-color: #fde68a; }
            .metric-card.danger { background: #fef2f2; border-color: #fecaca; }
            .metric-row {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              align-items: flex-start;
            }
            .metric-label {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1.4px;
              text-transform: uppercase;
              color: #64748b;
              margin-bottom: 8px;
            }
            .metric-value {
              font-size: 24px;
              font-weight: 800;
              color: #0f172a;
              margin-bottom: 8px;
            }
            .metric-helper {
              font-size: 12px;
              color: #475569;
              line-height: 1.5;
            }
            .delta {
              border-radius: 999px;
              padding: 4px 8px;
              font-size: 10px;
              font-weight: 800;
            }
            .delta.positive, .positive-badge { background: #ecfdf5; color: #047857; }
            .delta.negative { background: #fef2f2; color: #dc2626; }
            .surface-card {
              border: 1px solid #e5e7eb;
              border-radius: 24px;
              background: #ffffff;
              padding: 22px;
              box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
            }
            .stack-list {
              display: flex;
              flex-direction: column;
              gap: 14px;
            }
            .progress-row {
              display: grid;
              grid-template-columns: minmax(160px, 1fr) 1.5fr auto;
              gap: 12px;
              align-items: center;
            }
            .progress-copy strong, .simple-row strong {
              display: block;
              font-size: 14px;
              color: #0f172a;
            }
            .progress-copy span, .simple-row span, .mini-card p, .empty-note {
              font-size: 12px;
              color: #64748b;
            }
            .progress-bar {
              height: 10px;
              overflow: hidden;
              border-radius: 999px;
              background: #e2e8f0;
            }
            .progress-fill {
              height: 100%;
              border-radius: 999px;
            }
            .progress-value {
              font-size: 12px;
              font-weight: 700;
              color: #0f172a;
            }
            .simple-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              border: 1px solid #e5e7eb;
              border-radius: 16px;
              padding: 14px 16px;
            }
            .mini-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 12px;
              margin-bottom: 18px;
            }
            .mini-card {
              border: 1px solid #e5e7eb;
              border-radius: 16px;
              background: #f8fafc;
              padding: 14px;
            }
            .mini-card h4 {
              margin: 0 0 6px;
              font-size: 20px;
              color: #0f172a;
            }
            .trend-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            .trend-card {
              border: 1px solid #e5e7eb;
              border-radius: 18px;
              background: #ffffff;
              padding: 18px;
            }
            .trend-name {
              min-height: 34px;
              margin: 0 0 12px;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #94a3b8;
            }
            .trend-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
            }
            .trend-value {
              font-size: 26px;
              font-weight: 800;
            }
            .positive-text { color: #10b981; }
            .negative-text, .danger-text { color: #dc2626; }
            .warning-text { color: #d97706; }
            .neutral-badge {
              background: #f1f5f9;
              color: #475569;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
            }
            th {
              background: #f8fafc;
              color: #94a3b8;
              font-size: 10px;
              font-weight: 800;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              padding: 12px 14px;
              text-align: left;
            }
            td {
              padding: 14px;
              border-top: 1px solid #f1f5f9;
              font-size: 13px;
              color: #0f172a;
            }
            .align-right { text-align: right; }
            .empty-cell {
              text-align: center;
              color: #64748b;
              font-weight: 600;
            }
            .summary-block {
              border-radius: 20px;
              background: linear-gradient(135deg, #0f172a, #1e293b);
              color: white;
              padding: 22px;
            }
            .summary-title {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              color: #93c5fd;
              margin-bottom: 10px;
            }
            .summary-text {
              margin: 0;
              font-size: 15px;
              line-height: 1.7;
            }
            .footer {
              margin-top: 20px;
              font-size: 11px;
              color: #64748b;
            }
            @media print {
              body { background: white; padding: 0; }
              .sheet { border: 0; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div>
                <div class="eyebrow">B2B Intel</div>
                <h1>Filtered Report Export</h1>
                <p class="subtitle">Printable report aligned to the current report filters, sections, and dashboard styling.</p>
              </div>
              <div class="meta">
                <div><strong>Generated</strong></div>
                <div>${generatedAt}</div>
              </div>
            </div>

            <div class="toolbar">
              <div class="toolbar-copy">
                <span class="chip">Type: ${escapeHtml(selectedReportTypeLabel)}</span>
                <span class="chip">Timeline: ${escapeHtml(selectedDuration.label)}</span>
                <span class="chip">Range: ${escapeHtml(activeDateRangeLabel)}</span>
              </div>
              <span class="chip">Summary Note</span>
            </div>

            <section class="section">
              <div class="section-head">
                <div>
                  <h2>Executive Summary</h2>
                  <p>${escapeHtml(executiveSummary.summaryNote)}</p>
                </div>
              </div>
              <div class="card-grid two-up">
                <article class="surface-card">
                  <p class="eyebrow muted">${escapeHtml(t('analytics.salesGrowth'))}</p>
                  <h3 class="${isGrowthPositive ? 'positive-text' : 'negative-text'}">${isGrowthPositive ? '+' : '-'}${growthPercentage.toFixed(1)}%</h3>
                  <p class="metric-helper">${escapeHtml(t('analytics.vsPrevious'))} ${escapeHtml(timeResolution.toLowerCase())}</p>
                </article>
                <article class="surface-card">
                  <p class="eyebrow muted">${escapeHtml(t('analytics.inventoryTurnover'))}</p>
                  <h3>${inventoryTurnover.toFixed(2)}x</h3>
                  <p class="metric-helper">${escapeHtml(t('analytics.efficiencyScore'))}</p>
                </article>
              </div>
              <div class="card-grid three-up">
                ${executiveCards}
              </div>
            </section>

            ${orderSection}
            ${financialSection}
            ${productSection}

            <section class="section">
              <div class="section-head">
                <div>
                  <h2>${escapeHtml(t('reports.revenueTrend'))}</h2>
                  <p>${escapeHtml(t('reports.revenueTrendDesc'))}</p>
                </div>
              </div>
              <article class="surface-card">
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th class="align-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${trendRows || '<tr><td colspan="2" class="empty-cell">No revenue trend data is available yet.</td></tr>'}
                  </tbody>
                </table>
              </article>
            </section>

            <section class="section">
              <div class="section-head">
                <div>
                  <h2>${escapeHtml(t('analytics.topTrends'))}</h2>
                  <p>${escapeHtml(t('reports.topTrendsDesc'))}</p>
                </div>
              </div>
              <div class="trend-grid">
                ${predictionCards}
              </div>
            </section>

            <div class="summary-block">
              <div class="summary-title">Management Note</div>
              <p class="summary-text">${escapeHtml(executiveSummary.summaryNote)}</p>
            </div>
            <div class="footer">
              Use the browser print dialog and choose "Save as PDF" to download this filtered report.
            </div>
          </div>
          <script>
            window.print();
          </script>
        </body>
      </html>
    `;

    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  return (
    <div ref={reportPrintRef} className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto pb-32">
     <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">{t('reports.title')}</h1>
          <p className="text-gray-500 font-medium mt-1">{t('reports.subtitle')}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-50/70 px-4 py-3 lg:px-6">
          <div className="flex flex-col gap-3">
            <div data-print-exclude="true" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[180px_180px_minmax(170px,1fr)_minmax(170px,1fr)]">
              <label className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-slate-500">filter_alt</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Type</p>
                  <select
                    value={draftReportType}
                    onChange={(event) => setDraftReportType(event.target.value as ReportTypeKey)}
                    className="w-full appearance-none border-0 bg-transparent text-sm font-bold text-slate-800 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                  >
                    {reportTypeOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-slate-500">schedule</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Timeline</p>
                  <select
                    value={draftDuration}
                    onChange={(event) => {
                      const nextDuration = event.target.value as ReportDurationKey;
                      setDraftDuration(nextDuration);
                      const nextOption = reportDurationOptions.find((option) => option.key === nextDuration);
                      if (!nextOption) return;
                      const range = getRangeFromDuration(nextOption.days);
                      setDraftStartDate(range.start);
                      setDraftEndDate(range.end);
                    }}
                    className="w-full appearance-none border-0 bg-transparent text-sm font-bold text-slate-800 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                  >
                    {reportDurationOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-slate-500">calendar_month</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Start</p>
                  <input
                    type="date"
                    value={draftStartDate}
                    onChange={(event) => setDraftStartDate(event.target.value)}
                    className="w-full appearance-none border-0 bg-transparent text-sm font-bold text-slate-800 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                  />
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-slate-500">calendar_month</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">End</p>
                  <input
                    type="date"
                    value={draftEndDate}
                    onChange={(event) => setDraftEndDate(event.target.value)}
                    className="w-full appearance-none border-0 bg-transparent text-sm font-bold text-slate-800 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                  />
                </div>
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-1 lg:flex-row lg:items-center lg:justify-between">
              <div className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm">
                {activeDateRangeLabel}
              </div>

              <div data-print-exclude="true" className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:text-slate-800"
                >
                  <span className="material-symbols-outlined text-base">close_small</span>
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-primary/10 transition-all hover:bg-primary-hover"
                >
                  Apply
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
                <button
                  type="button"
                  onClick={handleExecutivePdfExport}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-white shadow-lg shadow-slate-900/10 transition-all hover:bg-slate-800 active:scale-95"
                  title="Export Executive Summary PDF"
                >
                  <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                    PDF
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showExecutiveSummary && (
      <section className="space-y-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl lg:text-2xl font-black tracking-tight text-slate-800">Executive Summary</h2>
            <p className="text-sm font-medium text-gray-500">{executiveSummary.summaryNote}</p>
          </div>
          <div className="shrink-0 text-left lg:text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Selected Range</p>
            <p className="mt-1 text-xs font-bold text-slate-800">{activeDateRangeLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-500">{t('analytics.salesGrowth')}</p>
                <h3 className={`mt-3 text-3xl font-black ${isGrowthPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isGrowthPositive ? '+' : '-'}{growthPercentage.toFixed(1)}%
                </h3>
                <p className="mt-2 flex items-center gap-1 text-xs font-bold text-gray-400">
                  <span className="material-symbols-outlined text-xs">{isGrowthPositive ? 'trending_up' : 'trending_down'}</span>
                  {t('analytics.vsPrevious')} {timeResolution.toLowerCase()}
                </p>
              </div>
              <div className="h-12 w-28">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthTrend}>
                    <Line type="monotone" dataKey="val" stroke={isGrowthPositive ? '#10B981' : '#EF4444'} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-500">{t('analytics.inventoryTurnover')}</p>
                <h3 className="mt-3 text-3xl font-black text-slate-800">{inventoryTurnover.toFixed(2)}x</h3>
                <p className="mt-2 flex items-center gap-1 text-xs font-bold text-gray-400">
                  <span className="material-symbols-outlined text-xs">sync</span>
                  {t('analytics.efficiencyScore')}
                </p>
              </div>
              <div className="h-12 w-28">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={inventoryTurnoverTrend}>
                    <Line type="monotone" dataKey="val" stroke="#F59E0B" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {executiveMetrics.map((metric) => (
            <article key={metric.label} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{metric.label}</p>
              <h3 className={`text-3xl font-black tracking-tight ${getStatusToneClasses(metric.tone)}`}>{metric.value}</h3>
              <p className="text-xs font-bold text-gray-400">{metric.helper}</p>
            </article>
          ))}
        </div>
      </section>
      )}

      {showOrderSections && (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl lg:text-2xl font-black tracking-tight text-slate-800">Order Reports</h2>
              <p className="text-sm font-medium text-gray-500">Order volume, value, fulfillment mix, and top-performing products for the selected range.</p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">{selectedDuration.label}</p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {orderReportMetrics.map((metric) => {
              const isPositive = metric.delta >= 0;
              return (
                <article key={metric.label} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{metric.label}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      <span className="material-symbols-outlined text-sm">{isPositive ? 'north_east' : 'south_east'}</span>
                      {formatDelta(metric.delta)}
                    </span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tight text-slate-800">{metric.value}</h3>
                  <p className="text-xs font-bold text-gray-400">{metric.helper}</p>
                </article>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6">
              <h3 className="text-lg font-black text-slate-800">Order Volume Trends</h3>
              <p className="text-sm font-medium text-gray-400">Current range compared with the previous matching range, using evenly partitioned buckets across the full selected window.</p>
            </div>
            <div className="bg-gray-50/30 p-6">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderVolumeTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis allowDecimals={false} stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [Number(value || 0).toLocaleString(), name === 'current' ? 'Current Range' : 'Previous Range']}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="previous" name="Previous Range" fill="#CBD5E1" radius={[10, 10, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="current" name="Current Range" fill="#005A9C" radius={[10, 10, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6">
              <h3 className="text-lg font-black text-slate-800">Order Status Mix</h3>
              <p className="text-sm font-medium text-gray-400">Fulfillment composition in the active reporting window.</p>
            </div>
            <div className="space-y-4 p-6">
              {orderStatusBreakdown.map((status) => (
                <div key={status.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-slate-800">{status.label}</p>
                      <p className="text-[11px] font-bold text-gray-400">{status.count.toLocaleString()} orders</p>
                    </div>
                    <p className="text-sm font-black text-slate-800">{Math.round(status.share)}%</p>
                  </div>
                  <div className={`h-2.5 w-full overflow-hidden rounded-full ${status.trackClass}`}>
                    <div className={`h-full rounded-full ${status.colorClass}`} style={{ width: `${Math.max(status.share, status.share > 0 ? 8 : 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6 space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">Top Ordered Products</h3>
                <p className="text-sm font-medium text-gray-400">Products ranked by ordered quantity during the current range.</p>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Rows to show</span>
                    <select
                      value={topOrderProductLimit}
                      onChange={(e) => setTopOrderProductLimit(Math.max(1, parseInt(e.target.value, 10) || 5))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                    >
                      {[5, 10, 15, 20, 25, 50].map((count) => (
                        <option key={count} value={count}>
                          {count} products
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Sort by</span>
                    <select
                      value={topOrderProductSort}
                      onChange={(e) => setTopOrderProductSort(e.target.value as TopOrderProductSortKey)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                    >
                      <option value="units-desc">Units: high to low</option>
                      <option value="units-asc">Units: low to high</option>
                      <option value="revenue-desc">Revenue: high to low</option>
                      <option value="revenue-asc">Revenue: low to high</option>
                      <option value="name-asc">Name: A to Z</option>
                      <option value="name-desc">Name: Z to A</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={downloadTopOrderedProductsCsv}
                  disabled={displayedTopOrderProducts.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download CSV
                </button>
              </div>
            </div>
            {displayedTopOrderProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Rank</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Product</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Units</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTopOrderProducts.map((product) => (
                      <tr key={product.id} className="border-t border-gray-50">
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-500">{product.rank}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-xs font-black text-slate-700">
                              {getInitials(product.name)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800">{product.name}</p>
                              <p className="text-[11px] font-bold text-gray-400">{product.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-800">{product.orderCount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-primary">{formatCurrency(product.grossRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-sm font-medium text-gray-500">No product order data is available for the selected range yet.</div>
            )}
          </div>

        </section>
      )}

      {showBuyerSections && (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl lg:text-2xl font-black tracking-tight text-slate-800">Buyer Intelligence &amp; Risk</h2>
              <p className="text-sm font-medium text-gray-500">Who drives revenue, which accounts are going quiet, how fast buyers submit proof, and how order values differ by account.</p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">30+ day churn watch</p>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-50 p-6">
                  <h4 className="text-lg font-black text-slate-800">Top Buyers by Revenue</h4>
                  <p className="text-sm font-medium text-gray-400">Revenue concentration across buyers in the selected reporting range.</p>
                </div>
                {topBuyerRevenue.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Buyer</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Orders</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Revenue</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topBuyerRevenue.map((buyer) => (
                          <tr key={buyer.buyerId} className="border-t border-gray-50">
                            <td className="px-6 py-4 text-sm font-black text-slate-800">{buyer.buyerLabel}</td>
                            <td className="px-6 py-4 text-right text-sm font-black text-slate-800">{buyer.orderCount.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right text-sm font-black text-primary">{formatCurrency(buyer.revenue)}</td>
                            <td className="px-6 py-4 text-right text-sm font-black text-slate-800">{buyer.revenueShare.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-sm font-medium text-gray-500">No buyer revenue data is available for the selected range yet.</div>
                )}
              </div>

              <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-50 p-6">
                  <h4 className="text-lg font-black text-slate-800">Buyer Churn Risk</h4>
                  <p className="text-sm font-medium text-gray-400">Buyers with at least 3 historical orders whose cadence has gone quiet for 30+ days.</p>
                </div>
                {buyerChurnRisk.length > 0 ? (
                  <div className="space-y-3 p-6">
                    {buyerChurnRisk.map((buyer) => (
                      <div key={buyer.buyerId} className="rounded-2xl border border-gray-100 px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-black text-slate-800">{buyer.buyerLabel}</p>
                            <p className="mt-1 text-[11px] font-bold text-gray-400">
                              Last order {new Date(buyer.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            buyer.riskLevel === 'High'
                              ? 'bg-red-50 text-red-600'
                              : buyer.riskLevel === 'Medium'
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            {buyer.riskLevel}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                          <div className="rounded-2xl bg-slate-50 px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Inactive</p>
                            <p className="mt-1 text-lg font-black text-slate-800">{buyer.daysSinceLastOrder}d</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Orders</p>
                            <p className="mt-1 text-lg font-black text-slate-800">{buyer.lifetimeOrders}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Cadence</p>
                            <p className="mt-1 text-lg font-black text-slate-800">{Math.round(buyer.avgOrderGapDays)}d</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-sm font-medium text-gray-500">No churn-risk buyers are currently flagged.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-50 p-6">
                  <h4 className="text-lg font-black text-slate-800">Payment Reliability Score</h4>
                  <p className="text-sm font-medium text-gray-400">Score based on how quickly payment proofs are submitted after ordering.</p>
                </div>
                {buyerPaymentReliability.length > 0 ? (
                  <div className="space-y-3 p-6">
                    {buyerPaymentReliability.map((buyer) => (
                      <div key={buyer.buyerId} className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-4">
                        <div>
                          <p className="text-sm font-black text-slate-800">{buyer.buyerLabel}</p>
                          <p className="mt-1 text-[11px] font-bold text-gray-400">
                            Avg proof lag {formatLag(buyer.averageLagHours)} across {buyer.paymentProofCount} proof{buyer.paymentProofCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        <p className={`text-2xl font-black ${getBuyerScoreTone(buyer.score)}`}>{buyer.score.toFixed(0)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-sm font-medium text-gray-500">No payment-proof timing data is available for the selected range yet.</div>
                )}
              </div>

              <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-50 p-6">
                  <h4 className="text-lg font-black text-slate-800">Average Order Value per Buyer</h4>
                  <p className="text-sm font-medium text-gray-400">Higher AOV often signals bulk-led buying patterns; lower AOV can look more retail-like.</p>
                </div>
                {buyerAov.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Buyer</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">AOV</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Orders</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Behavior</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buyerAov.map((buyer) => (
                          <tr key={buyer.buyerId} className="border-t border-gray-50">
                            <td className="px-6 py-4 text-sm font-black text-slate-800">{buyer.buyerLabel}</td>
                            <td className="px-6 py-4 text-right text-sm font-black text-primary">{formatCurrency(buyer.aov)}</td>
                            <td className="px-6 py-4 text-right text-sm font-black text-slate-800">{buyer.orderCount.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right text-sm font-black text-slate-800">{buyer.behavior}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-sm font-medium text-gray-500">No buyer AOV data is available for the selected range yet.</div>
                )}
              </div>
            </div>
        </section>
      )}

      {showFinancialSections && (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl lg:text-2xl font-black tracking-tight text-slate-800">Financial Report</h2>
              <p className="text-sm font-medium text-gray-500">Cash collection, receivables, credit exposure, and revenue risk across the selected reporting window.</p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">{selectedDuration.label}</p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {financialMetrics.map((metric) => (
              <article key={metric.label} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{metric.label}</p>
                <h3 className={`text-3xl font-black tracking-tight ${getFinancialToneClasses(metric.tone)}`}>{metric.value}</h3>
                <p className="text-xs font-bold text-gray-400">{metric.helper}</p>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-gray-50 p-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Financial Flow</h3>
                  <p className="text-sm font-medium text-gray-400">Compares invoiced revenue, approved collections, and at-risk value over time.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Invoiced</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Collected</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />At Risk</span>
                </div>
              </div>
              <div className="bg-gray-50/30 p-6">
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={financialTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={20} />
                      <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(Number(value || 0))}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="invoiced" stroke="#005A9C" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="collected" stroke="#10B981" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="atRisk" stroke="#F59E0B" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-50 p-6">
                <h3 className="text-lg font-black text-slate-800">Financial Watchlist</h3>
                <p className="text-sm font-medium text-gray-400">Signals worth reviewing before they turn into margin or cashflow pressure.</p>
              </div>
              <div className="space-y-3 p-6">
                {financialInsights.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-gray-100 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">{item.title}</p>
                        <p className={`mt-2 text-2xl font-black ${getFinancialToneClasses(item.tone)}`}>{item.value}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-bold leading-5 text-gray-500">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6">
              <h3 className="text-lg font-black text-slate-800">A/R Aging Buckets</h3>
              <p className="text-sm font-medium text-gray-400">Open receivables grouped by how overdue they are, from current exposure to bad-debt risk.</p>
            </div>
            <div className="bg-gray-50/30 p-6">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={receivablesAging} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="bucket" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string, payload: any) => {
                        if (name === 'amount') return [formatCurrency(Number(value || 0)), 'Outstanding'];
                        return [value, payload?.payload?.bucket || name];
                      }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="amount" radius={[10, 10, 0, 0]}>
                      {receivablesAging.map((entry) => (
                        <Cell key={entry.bucket} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="overflow-x-auto border-t border-gray-50">
              <table className="min-w-full">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Bucket</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Orders</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {receivablesAging.length > 0 ? (
                    receivablesAging.map((item) => (
                      <tr key={item.bucket} className="border-t border-gray-50">
                        <td className="px-6 py-4 text-sm font-black text-slate-800">{item.bucket}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-800">{item.orderCount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-800">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-sm font-medium text-gray-500">No A/R aging data is available for the selected range yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6">
              <h3 className="text-lg font-black text-slate-800">Margin Trend by Category</h3>
              <p className="text-sm font-medium text-gray-400">Gross margin by product category to separate profitable lines from loss leaders.</p>
            </div>
            <div className="bg-gray-50/30 p-6">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryMarginTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="category" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'marginPct') return [`${Number(value || 0).toFixed(1)}%`, 'Gross Margin'];
                        if (name === 'profit') return [formatCurrency(Number(value || 0)), 'Gross Profit'];
                        return [formatCurrency(Number(value || 0)), name];
                      }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="marginPct" radius={[10, 10, 0, 0]}>
                      {categoryMarginTrend.map((entry) => (
                        <Cell key={entry.category} fill={entry.marginPct >= 20 ? '#10B981' : entry.marginPct >= 0 ? '#F59E0B' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="overflow-x-auto border-t border-gray-50">
              <table className="min-w-full">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Category</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Revenue</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Gross Profit</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryMarginTrend.length > 0 ? (
                    categoryMarginTrend.map((item) => (
                      <tr key={item.category} className="border-t border-gray-50">
                        <td className="px-6 py-4 text-sm font-black text-slate-800">{item.category}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-800">{formatCurrency(item.revenue)}</td>
                        <td className={`px-6 py-4 text-right text-sm font-black ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(item.profit)}</td>
                        <td className={`px-6 py-4 text-right text-sm font-black ${item.marginPct >= 20 ? 'text-emerald-600' : item.marginPct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                          {item.marginPct.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-sm font-medium text-gray-500">No category margin data is available for the selected range yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {showProductSections && (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl lg:text-2xl font-black tracking-tight text-slate-800">Products &amp; Inventory Report</h2>
              <p className="text-sm font-medium text-gray-500">Inventory exposure, stock placement, product momentum, and expiry monitoring.</p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">{selectedDuration.label}</p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {inventoryMetrics.map((metric) => (
              <article key={metric.label} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{metric.label}</p>
                <h3 className={`text-3xl font-black tracking-tight ${metric.tone === 'danger' ? 'text-red-600' : 'text-slate-800'}`}>{metric.value}</h3>
                <p className="text-xs font-bold text-gray-400">{metric.helper}</p>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-50 p-6">
                <h3 className="text-lg font-black text-slate-800">Stock Distribution</h3>
                <p className="text-sm font-medium text-gray-400">Share of available units across storage areas.</p>
              </div>
              <div className="space-y-4 p-6">
                {stockDistribution.map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-slate-800">{item.label}</p>
                        <p className="text-[11px] font-bold text-gray-400">{item.quantity.toLocaleString()} units</p>
                      </div>
                      <p className="text-sm font-black text-slate-800">{Math.round(item.share)}%</p>
                    </div>
                    <div className={`h-2.5 w-full overflow-hidden rounded-full ${item.trackClass}`}>
                      <div className={`h-full rounded-full ${item.colorClass}`} style={{ width: `${Math.max(item.share, item.share > 0 ? 8 : 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-50 p-6">
                <h3 className="text-lg font-black text-slate-800">Turnover Trend</h3>
                <p className="text-sm font-medium text-gray-400">Normalized revenue-to-inventory pace across the selected range.</p>
              </div>
              <div className="bg-gray-50/30 p-6">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={inventoryTrend}>
                      <defs>
                        <linearGradient id="inventoryTurnoverFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0F766E" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#0F766E" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={20} />
                      <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: number) => [`${Number(value || 0).toFixed(2)}x`, 'Turnover Pace']}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#0F766E" strokeWidth={3} fill="url(#inventoryTurnoverFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6 space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">Top-Selling Products</h3>
                <p className="text-sm font-medium text-gray-400">Revenue leaders in the selected range.</p>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Rows to show</span>
                    <select
                      value={topSellingProductLimit}
                      onChange={(e) => setTopSellingProductLimit(Math.max(1, parseInt(e.target.value, 10) || 5))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                    >
                      {[5, 10, 15, 20, 25, 50].map((count) => (
                        <option key={count} value={count}>
                          {count} products
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Sort by</span>
                    <select
                      value={topSellingProductSort}
                      onChange={(e) => setTopSellingProductSort(e.target.value as TopSellingProductSortKey)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                    >
                      <option value="revenue-desc">Revenue: high to low</option>
                      <option value="revenue-asc">Revenue: low to high</option>
                      <option value="profit-desc">Profit: high to low</option>
                      <option value="profit-asc">Profit: low to high</option>
                      <option value="margin-desc">Margin: high to low</option>
                      <option value="margin-asc">Margin: low to high</option>
                      <option value="name-asc">Name: A to Z</option>
                      <option value="name-desc">Name: Z to A</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={downloadTopSellingProductsCsv}
                  disabled={displayedTopSellingProducts.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download CSV
                </button>
              </div>
            </div>
            {displayedTopSellingProducts.length > 0 ? (
              <div className="max-h-[430px] overflow-y-auto p-6">
                <div className="space-y-3">
                {displayedTopSellingProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-xs font-black text-slate-700">
                        {getInitials(product.name)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{product.name}</p>
                        <p className="text-xs font-bold text-gray-400">{product.status}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-800">{formatCurrency(product.revenue)}</p>
                        <p className={`mt-1 text-[11px] font-black ${product.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          Profit {formatCurrency(product.profit)}
                        </p>
                        <p className={`text-[11px] font-bold ${product.marginPct >= 20 ? 'text-emerald-600' : product.marginPct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                          Margin {product.marginPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              ) : (
              <div className="p-8 text-sm font-medium text-gray-500">No sales data available for the current window yet.</div>
            )}
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6 space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">Expiry Tracking</h3>
                <p className="text-sm font-medium text-gray-400">Products with the nearest expiry dates across the current inventory set.</p>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Rows to show</span>
                    <select
                      value={expiryProductLimit}
                      onChange={(e) => setExpiryProductLimit(Math.max(1, parseInt(e.target.value, 10) || 5))}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                    >
                      {[5, 10, 15, 20, 25, 50].map((count) => (
                        <option key={count} value={count}>
                          {count} products
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Sort by</span>
                    <select
                      value={expiryProductSort}
                      onChange={(e) => setExpiryProductSort(e.target.value as ExpiryProductSortKey)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                    >
                      <option value="expiry-asc">Expiry: soonest first</option>
                      <option value="expiry-desc">Expiry: latest first</option>
                      <option value="quantity-desc">Units: high to low</option>
                      <option value="quantity-asc">Units: low to high</option>
                      <option value="name-asc">Name: A to Z</option>
                      <option value="name-desc">Name: Z to A</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={downloadExpiryTrackingCsv}
                  disabled={displayedExpiryProducts.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download CSV
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 border-b border-gray-50 p-6 sm:grid-cols-3">
              {expiryMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">{metric.label}</p>
                  <p className="mt-1 text-xl font-black text-slate-800">{metric.value}</p>
                  <p className="mt-1 text-[11px] font-bold text-gray-500">{metric.helper}</p>
                </div>
              ))}
            </div>
            {displayedExpiryProducts.length > 0 ? (
              <div className="max-h-[430px] overflow-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Product</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Category</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Units</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedExpiryProducts.map((product) => (
                      <tr key={product.id} className="border-t border-gray-50">
                        <td className="px-6 py-4 text-sm font-black text-slate-800">{product.name}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-600">{product.category}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-800">{product.quantity.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-800">
                          {new Date(product.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-sm font-medium text-gray-500">No expiry dates are recorded for products in inventory yet.</div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-50 p-6">
                <h3 className="text-lg font-black text-slate-800">Fast-Moving Products</h3>
                <p className="text-sm font-medium text-gray-400">Products gaining demand fastest in the current comparison window.</p>
              </div>
              {movementVelocity.filter((item) => item.tone === 'fast').length > 0 ? (
                <div className="space-y-3 p-6">
                  {movementVelocity.filter((item) => item.tone === 'fast').map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-4">
                      <div>
                        <p className="text-sm font-black text-slate-800">{item.name}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600">Fast Moving</p>
                      </div>
                      <p className="text-sm font-black text-emerald-600">{formatDelta(item.delta)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-sm font-medium text-gray-500">No fast-moving products are available for the selected range.</div>
              )}
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-50 p-6">
                <h3 className="text-lg font-black text-slate-800">Slow-Moving Products</h3>
                <p className="text-sm font-medium text-gray-400">Products losing momentum and at higher risk of overstock.</p>
              </div>
              {movementVelocity.filter((item) => item.tone === 'slow').length > 0 ? (
                <div className="space-y-3 p-6">
                  {movementVelocity.filter((item) => item.tone === 'slow').map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-4">
                      <div>
                        <p className="text-sm font-black text-slate-800">{item.name}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-amber-600">Slow Moving</p>
                      </div>
                      <p className="text-sm font-black text-amber-600">{formatDelta(item.delta)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-sm font-medium text-gray-500">No slow-moving products are available for the selected range.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-50 p-6">
                <h3 className="text-lg font-black text-slate-800">Stock Coverage Outlook</h3>
                <p className="text-sm font-medium text-gray-400">How long current stock is expected to last at the current sell velocity.</p>
              </div>
              {stockCoverage.length > 0 ? (
                <div className="space-y-3 p-6">
                  {stockCoverage.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-100 px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-slate-800">{item.name}</p>
                          <p className="text-[11px] font-bold text-gray-400">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-black ${item.tone === 'tight' ? 'text-red-600' : item.tone === 'healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {Math.round(item.daysRemaining)} days
                          </p>
                          <p className="text-[11px] font-bold text-gray-400">{item.dailyVelocity.toFixed(1)} units/day</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs font-bold text-gray-500">
                        <span>{item.unitsOnHand.toLocaleString()} units on hand</span>
                        <span className={item.tone === 'tight' ? 'text-red-600' : item.tone === 'healthy' ? 'text-emerald-600' : 'text-amber-600'}>
                          {item.tone === 'tight' ? 'Restock soon' : item.tone === 'healthy' ? 'Healthy cover' : 'Overstock risk'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-sm font-medium text-gray-500">No active sell-velocity coverage data is available for the selected range yet.</div>
              )}
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-50 p-6">
                <h3 className="text-lg font-black text-slate-800">Capital Trapped in Zero Demand</h3>
                <p className="text-sm font-medium text-gray-400">Products with stock on hand but no demand in the selected period.</p>
              </div>
              {deadStockItems.length > 0 ? (
                <div className="space-y-3 p-6">
                  {deadStockItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-4">
                      <div>
                        <p className="text-sm font-black text-slate-800">{item.name}</p>
                        <p className="text-[11px] font-bold text-gray-400">{item.category} • {item.unitsOnHand.toLocaleString()} units idle</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-amber-600">{formatCurrency(item.capitalValue)}</p>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">No demand</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-sm font-medium text-gray-500">No zero-demand inventory is currently trapping capital in the selected range.</div>
              )}
            </div>
          </div>
        </section>
      )}
      
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <span className="material-symbols-outlined">bar_chart</span>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">{t('reports.revenueTrend')}</h2>
            <p className="text-sm text-gray-400 font-medium">{t('reports.revenueTrendDesc')}</p>
          </div>
        </div>
        <div className="p-6 bg-gray-50/30">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#005A9C" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#005A9C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis stroke="#94A3B8" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="val" name={t('analytics.totalRevenue')} stroke="#005A9C" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
      </section>

      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center gap-3">
          <span className="material-symbols-outlined text-emerald-600">trending_up</span>
          <div>
            <h2 className="text-lg font-black text-slate-800">{t('analytics.topTrends')}</h2>
            <p className="text-sm text-gray-400 font-medium">{t('reports.topTrendsDesc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-50">
          {predictions.map((item, index) => (
            <div key={index} className="p-6 space-y-4 hover:bg-gray-50 transition-colors">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-relaxed h-8 line-clamp-2">{item.name}</p>
              <div className="flex items-end justify-between">
                <span className={`text-2xl font-black ${item.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>{item.growth}</span>
                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${item.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {item.badge}
                </span>
              </div>
            </div>
          ))}
        </div> 
        
      </section>
    </div>
  );
};

export default Report;
