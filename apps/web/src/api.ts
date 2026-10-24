import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';

export type User = { id: string; name: string; email: string; role: 'CUSTOMER' | 'VENDOR' | 'ADMIN' };
export type Product = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  vendorId?: string;
  pricePaise: number;
  stock: number;
  ratingAverage: number;
  ratingCount: number;
  imageUrl: string;
  status: 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
  createdAt?: string;
};

export type Review = {
  _id: string;
  productId: string;
  customerId: string;
  customerName: string;
  rating: number;
  headline?: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
};

export type Coupon = {
  _id: string;
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  minOrderPaise: number;
  maxDiscountPaise?: number;
  isActive: boolean;
};

export type CartItem = { product: Product; quantity: number };
export type Address = {
  _id: string;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

export type OrderItem = {
  _id: string;
  productId: string;
  vendorId: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
  commissionPaise: number;
  vendorPayablePaise: number;
  fulfillmentStatus: 'UNFULFILLED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  trackingNumber?: string;
  courier?: string;
};

export type Order = {
  _id: string;
  customerId: string;
  items: OrderItem[];
  addressSnapshot: Address;
  subtotalPaise: number;
  couponCode?: string;
  discountPaise: number;
  totalPaise: number;
  commissionPaise: number;
  status: 'PAYMENT_PENDING' | 'PLACED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paymentReference: string;
  invoiceNumber?: string;
  createdAt: string;
};

export type VendorProfile = {
  _id: string;
  userId: string;
  shopName: string;
  slug: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  rejectionReason?: string;
  razorpayLinkedAccountId?: string;
};

export type LedgerEntry = {
  _id: string;
  orderId: string;
  orderItemId: string;
  amountPaise: number;
  type: 'SALE_CREDIT' | 'COMMISSION_DEBIT' | 'REFUND_REVERSAL';
  status: 'PAYABLE' | 'SETTLED' | 'REVERSED';
  createdAt: string;
};

export type AnalyticsSummary = {
  definitions: Record<string, string>;
  summary: {
    orderCount: number;
    gmvPaise: number;
    commissionPaise: number;
    revenueSubtotalPaise: number;
    averageOrderValuePaise: number;
  };
  statusDistribution: Array<{ _id: string; count: number }>;
  bestSellers: Array<{ _id: string; name: string; units: number; grossPaise: number }>;
  vendorSales: Array<{ _id: string; itemSalesPaise: number; payablePaise: number; commissionPaise: number }>;
};

type AuthResponse = { accessToken: string; user: User };
type ProductPage = { items: Product[]; page: number; limit: number; total: number; searchEngine: string };

let accessToken = sessionStorage.getItem('fs01_access');
export const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  credentials: 'include',
  prepareHeaders: headers => {
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
    return headers;
  },
});

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  const isRefreshRequest = typeof args !== 'string' && args.url === '/auth/refresh';
  const isCredentialSubmission = typeof args !== 'string' && ['/auth/login', '/auth/register'].includes(args.url);
  if (result.error?.status === 401 && !isRefreshRequest && !isCredentialSubmission) {
    const refreshed = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions);
    const token = (refreshed.data as AuthResponse | undefined)?.accessToken;
    if (token) {
      accessToken = token;
      sessionStorage.setItem('fs01_access', token);
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      accessToken = null;
      sessionStorage.removeItem('fs01_access');
    }
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Product', 'Identity', 'Cart', 'Address', 'Order', 'Vendor', 'Admin', 'Review', 'Coupon'],
  endpoints: builder => ({
    // Catalog & Discovery
    products: builder.query<ProductPage, { q?: string; page?: number; category?: string; minPrice?: number; maxPrice?: number; sort?: string }>({
      query: params => ({ url: '/products', params }),
      providesTags: ['Product'],
    }),
    product: builder.query<{ item: Product }, string>({
      query: id => `/products/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Product', id }],
    }),
    reviews: builder.query<{ items: Review[]; total: number }, string>({
      query: productId => `/products/${productId}/reviews`,
      providesTags: (_res, _err, id) => [{ type: 'Review', id }],
    }),
    addReview: builder.mutation<{ review: Review }, { productId: string; rating: number; headline?: string; comment: string }>({
      query: ({ productId, ...body }) => ({ url: `/products/${productId}/reviews`, method: 'POST', body }),
      invalidatesTags: (_res, _err, { productId }) => [{ type: 'Review', id: productId }, 'Product'],
    }),
    coupons: builder.query<{ items: Coupon[] }, void>({
      query: () => '/coupons',
      providesTags: ['Coupon'],
    }),
    applyCoupon: builder.mutation<{ valid: boolean; coupon: Coupon; discountPaise: number; newTotalPaise: number }, { code: string; subtotalPaise: number }>({
      query: body => ({ url: '/coupons/apply', method: 'POST', body }),
    }),
    uploadImage: builder.mutation<{ url: string; provider: string; filename: string }, { dataUrl: string; filename?: string }>({
      query: body => ({ url: '/upload', method: 'POST', body }),
    }),

    // Cart & Checkout
    cart: builder.query<{ items: CartItem[]; source: string }, void>({
      query: () => '/cart',
      providesTags: ['Cart'],
    }),
    updateCart: builder.mutation<{ items: Array<{ productId: string; quantity: number }>; cache: string }, { items: Array<{ productId: string; quantity: number }> }>({
      query: body => ({ url: '/cart', method: 'PUT', body }),
      invalidatesTags: ['Cart'],
    }),
    addresses: builder.query<{ items: Address[] }, void>({
      query: () => '/users/me/addresses',
      providesTags: ['Address'],
    }),
    addAddress: builder.mutation<{ address: Address }, Omit<Address, '_id'>>({
      query: body => ({ url: '/users/me/addresses', method: 'POST', body }),
      invalidatesTags: ['Address'],
    }),
    checkout: builder.mutation<
      { order: Order; payment?: { reference: string; provider: 'mock' | 'razorpay'; keyId?: string; status: string; amountPaise: number; currency: string } },
      { addressId: string; items: Array<{ productId: string; quantity: number }>; idempotencyKey: string; couponCode?: string }
    >({
      query: ({ idempotencyKey, ...body }) => ({ url: '/checkout', method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } }),
      invalidatesTags: ['Cart', 'Order', 'Product'],
    }),
    orders: builder.query<{ items: Order[] }, void>({
      query: () => '/orders',
      providesTags: ['Order'],
    }),
    order: builder.query<{ order: Order }, string>({
      query: id => `/orders/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Order', id }],
    }),

    // Auth
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: body => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (response: AuthResponse) => {
        accessToken = response.accessToken;
        sessionStorage.setItem('fs01_access', accessToken);
        return response;
      },
      invalidatesTags: ['Identity', 'Cart', 'Order'],
    }),
    register: builder.mutation<AuthResponse, { name: string; email: string; password: string }>({
      query: body => ({ url: '/auth/register', method: 'POST', body }),
      transformResponse: (response: AuthResponse) => {
        accessToken = response.accessToken;
        sessionStorage.setItem('fs01_access', accessToken);
        return response;
      },
      invalidatesTags: ['Identity', 'Cart', 'Order'],
    }),
    me: builder.query<{ user: User }, void>({
      query: () => '/auth/me',
      providesTags: ['Identity'],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      transformResponse: () => {
        accessToken = null;
        sessionStorage.removeItem('fs01_access');
      },
      invalidatesTags: ['Identity', 'Cart', 'Order'],
    }),

    // Vendor Studio
    vendorProfile: builder.query<{ profile: VendorProfile }, void>({
      query: () => '/vendors/me',
      providesTags: ['Vendor'],
    }),
    applyVendor: builder.mutation<{ profile: VendorProfile }, { shopName: string; description: string }>({
      query: body => ({ url: '/vendors/application', method: 'POST', body }),
      invalidatesTags: ['Vendor', 'Identity'],
    }),
    vendorProducts: builder.query<{ items: Product[] }, void>({
      query: () => '/vendor/products',
      providesTags: ['Product'],
    }),
    createVendorProduct: builder.mutation<{ item: Product }, { name: string; description: string; category: string; pricePaise: number; stock: number; imageUrl: string }>({
      query: body => ({ url: '/vendor/products', method: 'POST', body }),
      invalidatesTags: ['Product'],
    }),
    updateVendorProduct: builder.mutation<{ item: Product }, { id: string; name?: string; description?: string; category?: string; pricePaise?: number; stock?: number; imageUrl?: string }>({
      query: ({ id, ...body }) => ({ url: `/vendor/products/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Product'],
    }),
    deleteVendorProduct: builder.mutation<void, string>({
      query: id => ({ url: `/vendor/products/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Product'],
    }),
    vendorOrders: builder.query<{ items: Array<{ _id: string; status: string; paymentStatus: string; createdAt: string; totalPaise: number; items: OrderItem[] }> }, void>({
      query: () => '/vendor/orders',
      providesTags: ['Order'],
    }),
    updateFulfillment: builder.mutation<{ item: OrderItem; orderStatus: string }, { orderId: string; itemId: string; status: 'PACKED' | 'SHIPPED' | 'DELIVERED'; trackingNumber?: string; courier?: string }>({
      query: ({ orderId, itemId, ...body }) => ({ url: `/vendor/orders/${orderId}/items/${itemId}/fulfillment`, method: 'PATCH', body }),
      invalidatesTags: ['Order'],
    }),
    vendorLedger: builder.query<{ entries: LedgerEntry[]; payablePaise: number; settlementStatus: string }, void>({
      query: () => '/vendor/ledger',
      providesTags: ['Order'],
    }),

    // Admin Command Center
    adminVendors: builder.query<{ items: VendorProfile[] }, void>({
      query: () => '/admin/vendors',
      providesTags: ['Admin', 'Vendor'],
    }),
    updateVendorStatus: builder.mutation<{ profile: VendorProfile }, { id: string; status: 'APPROVED' | 'REJECTED' | 'SUSPENDED'; reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/vendors/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: ['Admin', 'Vendor'],
    }),
    moderateProduct: builder.mutation<{ item: Product }, { id: string; status: 'PUBLISHED' | 'ARCHIVED' }>({
      query: ({ id, ...body }) => ({ url: `/admin/products/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: ['Product', 'Admin'],
    }),
    adminAnalytics: builder.query<AnalyticsSummary, void>({
      query: () => '/admin/analytics/summary',
      providesTags: ['Admin', 'Order'],
    }),
    auditLogs: builder.query<{ items: Array<{ actorId: string; action: string; resourceType: string; resourceId: string; summary: string; createdAt: string }> }, void>({
      query: () => '/admin/audit-logs',
      providesTags: ['Admin'],
    }),
  }),
});

export const {
  useProductsQuery,
  useProductQuery,
  useReviewsQuery,
  useAddReviewMutation,
  useCouponsQuery,
  useApplyCouponMutation,
  useUploadImageMutation,
  useLoginMutation,
  useRegisterMutation,
  useMeQuery,
  useLogoutMutation,
  useCartQuery,
  useUpdateCartMutation,
  useAddressesQuery,
  useAddAddressMutation,
  useCheckoutMutation,
  useOrdersQuery,
  useOrderQuery,
  useVendorProfileQuery,
  useApplyVendorMutation,
  useVendorProductsQuery,
  useCreateVendorProductMutation,
  useUpdateVendorProductMutation,
  useDeleteVendorProductMutation,
  useVendorOrdersQuery,
  useUpdateFulfillmentMutation,
  useVendorLedgerQuery,
  useAdminVendorsQuery,
  useUpdateVendorStatusMutation,
  useModerateProductMutation,
  useAdminAnalyticsQuery,
  useAuditLogsQuery,
} = api;
