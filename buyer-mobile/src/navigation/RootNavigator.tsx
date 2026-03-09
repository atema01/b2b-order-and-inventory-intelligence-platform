import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import BuyerDashboardScreen from '../screens/BuyerDashboardScreen';
import BuyerCatalogScreen from '../screens/BuyerCatalogScreen';
import BuyerProductDetailsScreen from '../screens/BuyerProductDetailsScreen';
import BuyerOrdersScreen from '../screens/BuyerOrdersScreen';
import BuyerOrderDetailsScreen from '../screens/BuyerOrderDetailsScreen';
import BuyerPaymentScreen from '../screens/BuyerPaymentScreen';
import BuyerCreditScreen from '../screens/BuyerCreditScreen';
import BuyerNotificationsScreen from '../screens/BuyerNotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoadingScreen from '../screens/LoadingScreen';
import { colors } from '../theme/colors';
import type {
  RootStackParamList,
  AuthStackParamList,
  BuyerTabParamList,
  CatalogStackParamList,
  OrdersStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<BuyerTabParamList>();
const CatalogStack = createNativeStackNavigator<CatalogStackParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();

const AuthNavigator = () => (
  <AuthStack.Navigator>
    <AuthStack.Screen
      name="Login"
      component={LoginScreen}
      options={{ headerShown: false }}
    />
  </AuthStack.Navigator>
);

const CatalogNavigator = () => (
  <CatalogStack.Navigator>
    <CatalogStack.Screen
      name="Catalog"
      component={BuyerCatalogScreen}
      options={{ title: 'Catalog' }}
    />
    <CatalogStack.Screen
      name="ProductDetails"
      component={BuyerProductDetailsScreen}
      options={{ title: 'Product Details' }}
    />
  </CatalogStack.Navigator>
);

const OrdersNavigator = () => (
  <OrdersStack.Navigator>
    <OrdersStack.Screen
      name="Orders"
      component={BuyerOrdersScreen}
      options={{ title: 'Orders' }}
    />
    <OrdersStack.Screen
      name="OrderDetails"
      component={BuyerOrderDetailsScreen}
      options={{ title: 'Order Details' }}
    />
    <OrdersStack.Screen
      name="Payment"
      component={BuyerPaymentScreen}
      options={{ title: 'Payment' }}
    />
  </OrdersStack.Navigator>
);

const BuyerTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { borderTopColor: colors.border },
    }}
  >
    <Tab.Screen name="Dashboard" component={BuyerDashboardScreen} />
    <Tab.Screen name="CatalogStack" component={CatalogNavigator} options={{ title: 'Catalog' }} />
    <Tab.Screen name="OrdersStack" component={OrdersNavigator} options={{ title: 'Orders' }} />
    <Tab.Screen name="Credit" component={BuyerCreditScreen} />
    <Tab.Screen name="Notifications" component={BuyerNotificationsScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

const RootNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="App" component={BuyerTabs} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
