import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { OrdersStackParamList } from '../navigation/types';

type RouteProps = RouteProp<OrdersStackParamList, 'Payment'>;

const BuyerPaymentScreen = () => {
  const route = useRoute<RouteProps>();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Payment</Text>
        <Text style={styles.meta}>Order ID: {route.params.orderId}</Text>
        <Text style={styles.note}>
          Upload proof of payment or select your preferred method.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
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
  note: {
    color: colors.slate,
    lineHeight: 20,
  },
});

export default BuyerPaymentScreen;
