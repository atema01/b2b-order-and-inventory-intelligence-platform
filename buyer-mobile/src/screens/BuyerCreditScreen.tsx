import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Buyer } from '../types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const BuyerCreditScreen = () => {
  const { user } = useAuth();
  const [buyer, setBuyer] = useState<Buyer | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      const res = await apiRequest<Buyer>(`/api/buyers/${user.id}`);
      if (res.ok && res.data) setBuyer(res.data);
    };
    load();
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Credit Limit</Text>
        <Text style={styles.value}>{buyer?.creditLimit?.toLocaleString() || 0} ETB</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Available Credit</Text>
        <Text style={styles.value}>{buyer?.availableCredit?.toLocaleString() || 0} ETB</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Outstanding Balance</Text>
        <Text style={styles.value}>{buyer?.outstandingBalance?.toLocaleString() || 0} ETB</Text>
      </View>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontWeight: '900',
    color: colors.ink,
    fontSize: 20,
  },
});

export default BuyerCreditScreen;
