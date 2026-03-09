import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiRequest } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Buyer, Order, OrderStatus, Product } from '../types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const BuyerDashboardScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const [buyerRes, ordersRes, productsRes] = await Promise.all([
        apiRequest<Buyer>(`/api/buyers/${user.id}`),
        apiRequest<Order[]>('/api/orders'),
        apiRequest<Product[]>('/api/products'),
      ]);

      if (buyerRes.ok && buyerRes.data) setBuyer(buyerRes.data);
      if (ordersRes.ok && ordersRes.data) {
        setOrders(ordersRes.data.filter((o) => o.buyerId === user.id));
      }
      if (productsRes.ok && productsRes.data) setProducts(productsRes.data);
      setLoading(false);
    };

    load();
  }, [user?.id]);

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== OrderStatus.DELIVERED &&
          o.status !== OrderStatus.CANCELLED
      ).length,
    [orders]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loading}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome back</Text>
        <Text style={styles.company}>{buyer?.companyName || 'Buyer'}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active Orders</Text>
          <Text style={styles.statValue}>{activeOrders}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Tier</Text>
          <Text style={styles.statValue}>{buyer?.tier || 'Bronze'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Spend</Text>
          <Text style={styles.statValue}>
            {((buyer?.totalSpend || 0) / 1000).toFixed(1)}k
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('OrdersStack' as never)}
        >
          <Text style={styles.link}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {orders.slice(0, 3).map((order) => (
          <TouchableOpacity
            key={order.id}
            style={styles.orderCard}
            onPress={() =>
              navigation.navigate('OrdersStack' as never, {
                screen: 'OrderDetails',
                params: { id: order.id },
              } as never)
            }
          >
            <Text style={styles.orderId}>#{order.id.replace('ORD-', '')}</Text>
            <Text style={styles.orderMeta}>{order.date}</Text>
            <Text style={styles.orderTotal}>
              {order.total.toLocaleString()} ETB
            </Text>
          </TouchableOpacity>
        ))}
        {orders.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No orders yet.</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recommended</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CatalogStack' as never)}
        >
          <Text style={styles.link}>See All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {products.slice(0, 5).map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.productCard}
              onPress={() =>
                navigation.navigate('CatalogStack' as never, {
                  screen: 'ProductDetails',
                  params: { id: product.id },
                } as never)
              }
            >
              <Image source={{ uri: product.image }} style={styles.productImage} />
              <Text style={styles.productBrand}>{product.brand}</Text>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>
                {product.price.toLocaleString()} ETB
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loading: {
    color: colors.muted,
    fontWeight: '700',
  },
  header: {
    gap: spacing.xs,
  },
  welcome: {
    fontSize: typography.h2,
    fontWeight: '800',
    color: colors.ink,
  },
  company: {
    color: colors.muted,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: typography.label,
    textTransform: 'uppercase',
    color: colors.muted,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statValue: {
    marginTop: spacing.xs,
    fontSize: typography.h2,
    fontWeight: '900',
    color: colors.ink,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: '800',
    color: colors.ink,
  },
  link: {
    color: colors.primary,
    fontWeight: '800',
  },
  grid: {
    gap: spacing.sm,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderId: {
    fontWeight: '900',
    color: colors.ink,
  },
  orderMeta: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  orderTotal: {
    marginTop: spacing.sm,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  empty: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 18,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  productCard: {
    width: 180,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productImage: {
    width: '100%',
    height: 110,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  productBrand: {
    marginTop: spacing.xs,
    fontSize: typography.label,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  productName: {
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.xs,
  },
  productPrice: {
    marginTop: spacing.xs,
    fontWeight: '800',
    color: colors.ink,
  },
});

export default BuyerDashboardScreen;
