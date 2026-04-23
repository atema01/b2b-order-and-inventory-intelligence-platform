--
-- PostgreSQL database dump
--

\restrict FdQCrs6aEyLhrRUnw6VeFb8d0OOmS6TSlVmGYEWNhEKKGlCu486KNytRahdscw5

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: bulk_discount_rules; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.categories VALUES ('CAT-1', 'Lips');
INSERT INTO public.categories VALUES ('CAT-2', 'Face');
INSERT INTO public.categories VALUES ('CAT-3', 'Eyes');
INSERT INTO public.categories VALUES ('CAT-4', 'Skincare');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: credit_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: credit_repayments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.products VALUES ('P1', 'Velvet Matte Lipstick', 'LP-00124', 'Lips', 'GLOW COSMETICS', 'A rich, highly pigmented crimson red lipstick...', 1250.00, 900.00, 'https://images.unsplash.com/.../photo-1586776977607-310e9c725c37...', 100, 'In Stock', NULL, NULL, 320, 45, 12);
INSERT INTO public.products VALUES ('P2', 'HD Radiance Foundation', 'FD-88210', 'Face', 'DERMACARE', 'Breathable, medium-coverage foundation...', 2400.00, 1800.00, 'https://images.unsplash.com/.../photo-1631730486784-5456119f69ae...', 50, 'In Stock', NULL, NULL, 100, 8, 2);
INSERT INTO public.products VALUES ('P3', 'Midnight Recovery Serum', 'SR-99210', 'Skincare', 'LUMIERE', 'Nighttime repair serum...', 3100.00, 2200.00, 'https://images.unsplash.com/.../photo-1620916566398-39f1143ab7be...', 20, 'In Stock', NULL, NULL, 50, 10, 5);


--
-- Data for Name: demand_forecasts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permissions VALUES ('PERM-ORDERS', 'Orders');
INSERT INTO public.permissions VALUES ('PERM-PRODUCTS', 'Products');
INSERT INTO public.permissions VALUES ('PERM-RETURNS', 'Returns');
INSERT INTO public.permissions VALUES ('PERM-BUYERS', 'Buyers');
INSERT INTO public.permissions VALUES ('PERM-PAYMENTS', 'Payments');
INSERT INTO public.permissions VALUES ('PERM-CREDITS', 'Credits');
INSERT INTO public.permissions VALUES ('PERM-PRICING', 'Pricing');
INSERT INTO public.permissions VALUES ('PERM-STAFF', 'Staff');
INSERT INTO public.permissions VALUES ('PERM-ROLES', 'Roles');
INSERT INTO public.permissions VALUES ('PERM-REPORTS', 'Reports');
INSERT INTO public.permissions VALUES ('PERM-LOGS', 'Logs');
INSERT INTO public.permissions VALUES ('PERM-SETTINGS', 'Settings');


--
-- Data for Name: pricing_rules; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: return_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.roles VALUES ('R-ADMIN', 'Admin', 'System administrator with full access.', 'Owner', '2026-04-23 13:22:32.301289+00', '2026-04-23 13:22:32.301289+00');
INSERT INTO public.roles VALUES ('R-STAFF', 'Staff', 'Default operational staff role.', 'Staff', '2026-04-23 13:22:32.301289+00', '2026-04-23 13:22:32.301289+00');
INSERT INTO public.roles VALUES ('R-BUYER', 'Buyer', 'Wholesale buyer account role.', 'Staff', '2026-04-23 13:22:32.301289+00', '2026-04-23 13:22:32.301289+00');


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-ORDERS');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-PRODUCTS');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-RETURNS');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-BUYERS');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-PAYMENTS');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-CREDITS');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-PRICING');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-STAFF');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-ROLES');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-REPORTS');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-LOGS');
INSERT INTO public.role_permissions VALUES ('R-ADMIN', 'PERM-SETTINGS');
INSERT INTO public.role_permissions VALUES ('R-STAFF', 'PERM-ORDERS');
INSERT INTO public.role_permissions VALUES ('R-STAFF', 'PERM-PRODUCTS');
INSERT INTO public.role_permissions VALUES ('R-STAFF', 'PERM-RETURNS');
INSERT INTO public.role_permissions VALUES ('R-STAFF', 'PERM-BUYERS');
INSERT INTO public.role_permissions VALUES ('R-STAFF', 'PERM-PAYMENTS');
INSERT INTO public.role_permissions VALUES ('R-STAFF', 'PERM-CREDITS');
INSERT INTO public.role_permissions VALUES ('R-STAFF', 'PERM-REPORTS');


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.schema_migrations VALUES (1, '01-create-users-table.sql', '2026-04-23 13:13:55.304193+00');
INSERT INTO public.schema_migrations VALUES (2, '02-create-core-tables.sql', '2026-04-23 13:16:11.107791+00');
INSERT INTO public.schema_migrations VALUES (3, '03-create-notifications-logs.sql', '2026-04-23 13:16:11.935036+00');
INSERT INTO public.schema_migrations VALUES (4, '04-create-return-logs.sql', '2026-04-23 13:16:12.896606+00');
INSERT INTO public.schema_migrations VALUES (5, '05-add-return-log-stock-location.sql', '2026-04-23 13:16:13.635127+00');
INSERT INTO public.schema_migrations VALUES (6, '06-align-admin-role.sql', '2026-04-23 13:22:32.301289+00');
INSERT INTO public.schema_migrations VALUES (7, '07-create-credit-requests.sql', '2026-04-23 13:22:33.13675+00');
INSERT INTO public.schema_migrations VALUES (8, '08-create-payments.sql', '2026-04-23 13:22:34.040666+00');
INSERT INTO public.schema_migrations VALUES (9, '09-create-pricing-rules.sql', '2026-04-23 13:22:34.860582+00');
INSERT INTO public.schema_migrations VALUES (10, '10-drop-margin-discount-rules.sql', '2026-04-23 13:22:35.680376+00');
INSERT INTO public.schema_migrations VALUES (11, '11-add-credit-repayment-columns.sql', '2026-04-23 13:22:36.528578+00');
INSERT INTO public.schema_migrations VALUES (12, '12-add-credit-payment-terms.sql', '2026-04-23 13:22:37.320125+00');
INSERT INTO public.schema_migrations VALUES (13, '13-enforce-one-credit-request-per-order.sql', '2026-04-23 13:22:38.240095+00');
INSERT INTO public.schema_migrations VALUES (14, '14-create-credit-repayments.sql', '2026-04-23 13:22:39.180194+00');
INSERT INTO public.schema_migrations VALUES (15, '15-link-payments-to-credit-requests.sql', '2026-04-23 13:22:39.85085+00');
INSERT INTO public.schema_migrations VALUES (16, '16-create-demand-forecasts.sql', '2026-04-23 13:22:40.730603+00');


--
-- Data for Name: system_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_items_id_seq', 1, false);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.schema_migrations_id_seq', 16, true);


--
-- Name: system_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.system_logs_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict FdQCrs6aEyLhrRUnw6VeFb8d0OOmS6TSlVmGYEWNhEKKGlCu486KNytRahdscw5

