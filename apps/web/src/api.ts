import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';

export type User = { id: string; name: string; email: string; role: 'CUSTOMER' | 'VENDOR' | 'ADMIN' };
export type Product = { _id: string; name: string; slug: string; description: string; category: string; pricePaise: number; stock: number; ratingAverage: number; ratingCount: number; imageUrl: string };
type AuthResponse = { accessToken: string; user: User };
type ProductPage = { items: Product[]; page: number; limit: number; total: number; searchEngine: string };
export type CartItem = { product: Product; quantity: number };
export type Address = { _id: string; label: string; recipient: string; phone: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string; isDefault: boolean };

let accessToken = sessionStorage.getItem('fs01_access');
const rawBaseQuery = fetchBaseQuery({ baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1', credentials: 'include', prepareHeaders: headers => { if (accessToken) headers.set('authorization', `Bearer ${accessToken}`); return headers; } });
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  const isRefreshRequest = typeof args !== 'string' && args.url === '/auth/refresh';
  const isCredentialSubmission = typeof args !== 'string' && ['/auth/login', '/auth/register'].includes(args.url);
  if (result.error?.status === 401 && !isRefreshRequest && !isCredentialSubmission) {
    const refreshed = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions);
    const token = (refreshed.data as AuthResponse | undefined)?.accessToken;
    if (token) { accessToken = token; sessionStorage.setItem('fs01_access', token); result = await rawBaseQuery(args, api, extraOptions); }
    else { accessToken = null; sessionStorage.removeItem('fs01_access'); }
  }
  return result;
};
export const api = createApi({
  reducerPath: 'api', baseQuery,
  tagTypes: ['Product', 'Identity', 'Cart', 'Address', 'Order'],
  endpoints: builder => ({
    products: builder.query<ProductPage, { q?: string; page?: number; category?: string }>({ query: params => ({ url: '/products', params }), providesTags: ['Product'] }),
    cart: builder.query<{ items: CartItem[]; source: string }, void>({ query: () => '/cart', providesTags: ['Cart'] }),
    updateCart: builder.mutation<{ items: Array<{ productId: string; quantity: number }>; cache: string }, { items: Array<{ productId: string; quantity: number }> }>({ query: body => ({ url: '/cart', method: 'PUT', body }), invalidatesTags: ['Cart'] }),
    addresses: builder.query<{ items: Address[] }, void>({ query: () => '/users/me/addresses', providesTags: ['Address'] }),
    addAddress: builder.mutation<{ address: Address }, Omit<Address, '_id'>>({ query: body => ({ url: '/users/me/addresses', method: 'POST', body }), invalidatesTags: ['Address'] }),
    checkout: builder.mutation<{ order: { _id: string; totalPaise: number; status: string }; payment: { reference: string; provider: string } }, { addressId: string; items: Array<{ productId: string; quantity: number }>; idempotencyKey: string }>({ query: ({ idempotencyKey, ...body }) => ({ url: '/checkout', method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } }), invalidatesTags: ['Cart', 'Order'] }),
    login: builder.mutation<AuthResponse, { email: string; password: string }>({ query: body => ({ url: '/auth/login', method: 'POST', body }), transformResponse: (response: AuthResponse) => { accessToken = response.accessToken; sessionStorage.setItem('fs01_access', accessToken); return response; }, invalidatesTags: ['Identity'] }),
    register: builder.mutation<AuthResponse, { name: string; email: string; password: string }>({ query: body => ({ url: '/auth/register', method: 'POST', body }), transformResponse: (response: AuthResponse) => { accessToken = response.accessToken; sessionStorage.setItem('fs01_access', accessToken); return response; }, invalidatesTags: ['Identity'] }),
    me: builder.query<{ user: User }, void>({ query: () => '/auth/me', providesTags: ['Identity'] }),
    logout: builder.mutation<void, void>({ query: () => ({ url: '/auth/logout', method: 'POST' }), transformResponse: () => { accessToken = null; sessionStorage.removeItem('fs01_access'); } }),
  }),
});
export const { useProductsQuery, useLoginMutation, useRegisterMutation, useMeQuery, useLogoutMutation, useCartQuery, useUpdateCartMutation, useAddressesQuery, useAddAddressMutation, useCheckoutMutation } = api;
