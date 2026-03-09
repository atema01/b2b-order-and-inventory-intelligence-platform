import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { apiRequest } from '../services/api';
import { Product } from '../types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { CatalogStackParamList } from '../navigation/types';

type RouteProps = RouteProp<CatalogStackParamList, 'ProductDetails'>;

const BuyerProductDetailsScreen = () => {
  const route = useRoute<RouteProps>();
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await apiRequest<Product>(`/api/products/${route.params.id}`);
      if (res.ok && res.data) setProduct(res.data);
    };
    load();
  }, [route.params.id]);

  if (!product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loading}>Loading product...</Text>
      </View>
    );
  }

  const totalStock =
    product.stock.mainWarehouse +
    product.stock.backRoom +
    product.stock.showRoom;

  return (
    <View style={styles.container}>
      <Image source={{ uri: product.image }} style={styles.image} />
      <View style={styles.content}>
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>{product.price.toLocaleString()} ETB</Text>
        <Text style={styles.description}>{product.description}</Text>
        <View style={styles.stockRow}>
          <Text style={styles.stockLabel}>Total Stock</Text>
          <Text style={styles.stockValue}>{totalStock}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  image: {
    width: '100%',
    height: 260,
    backgroundColor: '#F1F5F9',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  brand: {
    fontSize: typography.label,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: {
    fontSize: typography.h2,
    fontWeight: '900',
    color: colors.ink,
  },
  price: {
    fontSize: typography.h3,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  description: {
    color: colors.muted,
    lineHeight: 20,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stockLabel: {
    color: colors.muted,
    fontWeight: '700',
  },
  stockValue: {
    fontWeight: '800',
    color: colors.ink,
  },
});

export default BuyerProductDetailsScreen;
