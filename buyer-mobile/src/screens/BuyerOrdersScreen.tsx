import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiRequest } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Order } from '../types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const BuyerOrdersScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await apiRequest<Order[]>('/api/orders');
      if (res.ok && res.data && user?.id) {
        setOrders(res.data.filter((o) => o.buyerId === user.id));
      }
    };
    load();
  }, [user?.id]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={orders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            navigation.navigate('OrdersStack' as never, {
              screen: 'OrderDetails',
              params: { id: item.id },
            } as never)
          }
        >
          <View>
            <Text style={styles.title}>#{item.id.replace('ORD-', '')}</Text>
            <Text style={styles.meta}>{item.date}</Text>
          </View>
          <Text style={styles.amount}>{item.total.toLocaleString()} ETB</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No orders yet.</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '900',
    color: colors.ink,
  },
  meta: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  amount: {
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
});

export default BuyerOrdersScreen;
