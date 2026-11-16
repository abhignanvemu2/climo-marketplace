# API endpoint inventory

All business routes are prefixed `/api/v1`; health checks are outside that prefix. Session cookies and CSRF headers protect authenticated mutations. See source schemas for exact input validation.

| Method | Path                                        | Access                       |
| ------ | ------------------------------------------- | ---------------------------- |
| GET    | `/health`                                   | Public or route-level checks |
| GET    | `/ready`                                    | Public or route-level checks |
| POST   | `/api/v1/webhooks/razorpay`                 | Public or route-level checks |
| GET    | `/api/v1/auth/me`                           | Public or route-level checks |
| POST   | `/api/v1/auth/register`                     | Public or route-level checks |
| POST   | `/api/v1/auth/login`                        | Public or route-level checks |
| POST   | `/api/v1/auth/logout`                       | Public or route-level checks |
| POST   | `/api/v1/auth/revoke-sessions`              | Public or route-level checks |
| GET    | `/api/v1/me/addresses`                      | Public or route-level checks |
| POST   | `/api/v1/me/addresses`                      | Public or route-level checks |
| GET    | `/api/v1/me/wishlist`                       | Public or route-level checks |
| POST   | `/api/v1/me/wishlist/:id`                   | Public or route-level checks |
| DELETE | `/api/v1/me/wishlist/:id`                   | Public or route-level checks |
| GET    | `/api/v1/me/cart`                           | Public or route-level checks |
| PUT    | `/api/v1/me/cart`                           | Public or route-level checks |
| GET    | `/api/v1/catalog/meta`                      | Public or route-level checks |
| GET    | `/api/v1/products`                          | Public or route-level checks |
| GET    | `/api/v1/products/:id`                      | Public or route-level checks |
| GET    | `/api/v1/banners`                           | Public or route-level checks |
| GET    | `/api/v1/pages/:slug`                       | Public or route-level checks |
| GET    | `/api/v1/seller/products`                   | 'SELLER'                     |
| POST   | `/api/v1/seller/products`                   | 'SELLER'                     |
| POST   | `/api/v1/seller/products/:id/revisions`     | 'SELLER'                     |
| POST   | `/api/v1/seller/products/:id/stock`         | 'SELLER'                     |
| POST   | `/api/v1/seller/products/:id/price`         | 'SELLER'                     |
| GET    | `/api/v1/admin/products`                    | 'ADMIN'                      |
| POST   | `/api/v1/admin/products/:id/decision`       | 'ADMIN'                      |
| POST   | `/api/v1/admin/revisions/:id/decision`      | 'ADMIN'                      |
| POST   | `/api/v1/admin/prices/:id/decision`         | 'ADMIN'                      |
| POST   | `/api/v1/cart/quote`                        | Public or route-level checks |
| POST   | `/api/v1/checkout`                          | 'CUSTOMER'                   |
| POST   | `/api/v1/orders/:id/payment`                | 'CUSTOMER'                   |
| POST   | `/api/v1/payments/verify`                   | 'CUSTOMER'                   |
| GET    | `/api/v1/me/orders`                         | 'CUSTOMER'                   |
| GET    | `/api/v1/seller/orders`                     | 'SELLER'                     |
| GET    | `/api/v1/admin/orders`                      | 'ADMIN','FINANCE'            |
| POST   | `/api/v1/seller/orders/:id/status`          | 'SELLER'                     |
| POST   | `/api/v1/me/suborders/:id/cancel`           | 'CUSTOMER'                   |
| GET    | `/api/v1/orders/:id/invoice/:suborderId`    | Public or route-level checks |
| GET    | `/api/v1/seller/profile`                    | 'SELLER'                     |
| PATCH  | `/api/v1/seller/profile`                    | 'SELLER'                     |
| GET    | `/api/v1/admin/sellers`                     | 'ADMIN'                      |
| POST   | `/api/v1/admin/sellers/:id/status`          | 'ADMIN'                      |
| GET    | `/api/v1/admin/customers`                   | 'ADMIN'                      |
| POST   | `/api/v1/admin/customers/:id/status`        | 'ADMIN'                      |
| GET    | `/api/v1/admin/`                            | Public or route-level checks |
| POST   | `/api/v1/admin/`                            | Public or route-level checks |
| PATCH  | `/api/v1/admin/`                            | Public or route-level checks |
| GET    | `/api/v1/admin/pages`                       | 'ADMIN'                      |
| PUT    | `/api/v1/admin/pages/:slug`                 | 'ADMIN'                      |
| GET    | `/api/v1/admin/settings`                    | 'ADMIN'                      |
| PUT    | `/api/v1/admin/settings`                    | 'ADMIN'                      |
| POST   | `/api/v1/admin/products/:id/promotion`      | 'ADMIN'                      |
| GET    | `/api/v1/admin/audit`                       | 'ADMIN','FINANCE'            |
| GET    | `/api/v1/admin/overview`                    | 'ADMIN','FINANCE'            |
| POST   | `/api/v1/me/after-sales`                    | 'CUSTOMER'                   |
| GET    | `/api/v1/admin/after-sales`                 | 'ADMIN'                      |
| POST   | `/api/v1/admin/after-sales/:id/decision`    | 'ADMIN'                      |
| GET    | `/api/v1/finance/refunds`                   | 'ADMIN','FINANCE'            |
| POST   | `/api/v1/finance/refunds/:id/authorize`     | 'FINANCE'                    |
| POST   | `/api/v1/finance/refunds/:id/execute`       | 'FINANCE'                    |
| POST   | `/api/v1/finance/refunds/:id/reconcile`     | 'FINANCE'                    |
| GET    | `/api/v1/finance/settlements`               | 'ADMIN','FINANCE'            |
| POST   | `/api/v1/finance/settlements/build`         | 'FINANCE'                    |
| POST   | `/api/v1/finance/settlements/:id/authorize` | 'FINANCE'                    |
| POST   | `/api/v1/finance/settlements/:id/execute`   | 'FINANCE'                    |
| GET    | `/api/v1/seller/earnings`                   | 'SELLER'                     |
| POST   | `/api/v1/me/stock-requests`                 | 'CUSTOMER'                   |
| GET    | `/api/v1/stock-requests`                    | Public or route-level checks |
| POST   | `/api/v1/stock-requests/:id/transition`     | 'ADMIN','SELLER'             |
| GET    | `/api/v1/tickets`                           | Public or route-level checks |
| POST   | `/api/v1/tickets`                           | Public or route-level checks |
| POST   | `/api/v1/tickets/:id/messages`              | Public or route-level checks |
| POST   | `/api/v1/products/:id/reviews`              | 'CUSTOMER'                   |
| GET    | `/api/v1/admin/reviews`                     | 'ADMIN'                      |
| POST   | `/api/v1/admin/reviews/:id/decision`        | 'ADMIN'                      |
| POST   | `/api/v1/products/:id/questions`            | Public or route-level checks |
| POST   | `/api/v1/questions/:id/answer`              | 'SELLER','ADMIN'             |
| GET    | `/api/v1/me/notifications`                  | Public or route-level checks |
| POST   | `/api/v1/me/privacy-requests`               | Public or route-level checks |
| POST   | `/api/v1/assistant/search`                  | Public or route-level checks |

Configuration resource routes generated in operations.ts: GET/POST/PATCH `/api/v1/admin/{taxons,banners,coupons,commissions}` (ADMIN only).

This is a source-derived route inventory, not a complete OpenAPI contract. Full OpenAPI schemas remain pending.
