import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { apiRequest } from '../services/api';
import { Order } from '../types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { OrdersStackParamList } from '../navigation/types';

type RouteProps = RouteProp<OrdersStackParamList, 'OrderDetails'>;

const BuyerOrderDetailsScreen = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await apiRequest<Order>(`/api/orders/${route.params.id}`);
      if (res.ok && res.data) setOrder(res.data);
    };
    load();
  }, [route.params.id]);

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loading}>Loading order...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Order #{order.id.replace('ORD-', '')}</Text>
        <Text style={styles.meta}>Placed: {order.date}</Text>
        <Text style={styles.meta}>Status: {order.status}</Text>
        <Text style={styles.total}>Total: {order.total.toLocaleString()} ETB</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          navigation.navigate('OrdersStack' as never, {
            screen: 'Payment',
            params: { orderId: order.id },
          } as never)
        }
      >
        <Text style={styles.buttonText}>Make Payment</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    color: colors.muted,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontWeight: '900',
    color: colors.ink,
    fontSize: 18,
  },
  meta: {
    color: colors.muted,
  },
  total: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default BuyerOrderDetailsScreen;
