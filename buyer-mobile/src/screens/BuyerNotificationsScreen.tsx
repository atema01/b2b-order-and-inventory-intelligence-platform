import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../services/api';
import { Notification } from '../types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const BuyerNotificationsScreen = () => {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await apiRequest<Notification[]>('/api/notifications');
      if (res.ok && res.data) setItems(res.data);
    };
    load();
  }, []);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No notifications yet.</Text>
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
    gap: spacing.xs,
  },
  title: {
    fontWeight: '800',
    color: colors.ink,
  },
  message: {
    color: colors.slate,
  },
  time: {
    color: colors.muted,
    fontSize: 12,
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

export default BuyerNotificationsScreen;
