export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type BuyerTabParamList = {
  Dashboard: undefined;
  CatalogStack: undefined;
  OrdersStack: undefined;
  Credit: undefined;
  Notifications: undefined;
  Settings: undefined;
};

export type CatalogStackParamList = {
  Catalog: undefined;
  ProductDetails: { id: string };
};

export type OrdersStackParamList = {
  Orders: undefined;
  OrderDetails: { id: string };
  Payment: { orderId: string };
};
