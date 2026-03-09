import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiRequest } from '../services/api';
import { Product } from '../types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const BuyerCatalogScreen = () => {
  const navigation = useNavigation();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await apiRequest<Product[]>('/api/products');
      if (res.ok && res.data) setProducts(res.data);
    };
    load();
  }, []);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={products}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            navigation.navigate('CatalogStack' as never, {
              screen: 'ProductDetails',
              params: { id: item.id },
            } as never)
          }
        >
          <Image source={{ uri: item.image }} style={styles.image} />
          <View style={styles.meta}>
            <Text style={styles.brand}>{item.brand}</Text>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>{item.price.toLocaleString()} ETB</Text>
          </View>
        </TouchableOpacity>
      )}
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
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  meta: {
    flex: 1,
    justifyContent: 'center',
  },
  brand: {
    fontSize: typography.label,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.primary,
  },
  name: {
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.xs,
  },
  price: {
    marginTop: spacing.xs,
    fontWeight: '800',
    color: colors.ink,
  },
});

export default BuyerCatalogScreen;
