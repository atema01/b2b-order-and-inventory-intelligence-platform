import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const SettingsScreen = () => {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{user?.name || 'Buyer'}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        {user?.companyName ? <Text style={styles.meta}>{user.companyName}</Text> : null}
        {user?.tier ? <Text style={styles.meta}>Tier: {user.tier}</Text> : null}
      </View>

      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Log Out</Text>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    fontWeight: '900',
    color: colors.ink,
    fontSize: 18,
  },
  meta: {
    color: colors.muted,
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

export default SettingsScreen;
