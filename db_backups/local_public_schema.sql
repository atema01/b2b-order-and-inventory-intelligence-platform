--
-- PostgreSQL database dump
--

\restrict 6gSZlTXRLKBWU56dl3Jk78gmRyRbnecNVINSz717GjHydpAnioJjRAOcMiJWh7i

-- Dumped from database version 18.1
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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bulk_discount_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulk_discount_rules (
    id character varying(50) NOT NULL,
    unit_threshold integer NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL
);


--
-- Name: credit_repayments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_repayments (
    id character varying(50) NOT NULL,
    credit_request_id character varying(50) NOT NULL,
    amount numeric(12,2) NOT NULL,
    note text,
    reference_id character varying(100),
    proof_image text,
    repaid_at date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_requests (
    id character varying(50) NOT NULL,
    buyer_id uuid NOT NULL,
    order_id character varying(50),
    amount numeric(12,2) NOT NULL,
    approved_amount numeric(12,2),
    reason character varying(100) NOT NULL,
    status character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    request_date date DEFAULT CURRENT_DATE NOT NULL,
    action_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    repaid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    repaid_at date,
    payment_terms character varying(100)
);


--
-- Name: demand_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demand_forecasts (
    id character varying(50) NOT NULL,
    model character varying(30) NOT NULL,
    model_used character varying(30) NOT NULL,
    forecast_scope character varying(20) NOT NULL,
    scope_key character varying(100) NOT NULL,
    product_id character varying(50),
    time_resolution character varying(10) NOT NULL,
    has_sufficient_data boolean DEFAULT false NOT NULL,
    message text NOT NULL,
    chart_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    generation_source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: margin_discount_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.margin_discount_rules (
    id character varying(50) NOT NULL,
    min_unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    min_margin_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    bonus_discount numeric(5,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    type character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    "time" timestamp with time zone DEFAULT now(),
    is_read boolean DEFAULT false,
    severity character varying(10) DEFAULT 'low'::character varying,
    recipient_id character varying(50) NOT NULL,
    related_id character varying(50)
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id character varying(50) NOT NULL,
    product_id character varying(50) NOT NULL,
    quantity integer NOT NULL,
    price_at_order numeric(12,2) NOT NULL,
    picked boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id character varying(50) NOT NULL,
    buyer_id uuid NOT NULL,
    date date NOT NULL,
    status character varying(20) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    tax numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0,
    payment_status character varying(20) DEFAULT 'Unpaid'::character varying,
    stock_deducted boolean DEFAULT false,
    created_by character varying(20) DEFAULT 'seller'::character varying,
    history jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    payment_terms character varying(50) DEFAULT 'Immediate'::character varying,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id character varying(50) NOT NULL,
    order_id character varying(50) NOT NULL,
    buyer_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    method character varying(100) NOT NULL,
    reference_id character varying(100),
    date_time timestamp with time zone DEFAULT now() NOT NULL,
    proof_image text,
    status character varying(30) DEFAULT 'Pending Review'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    credit_request_id character varying(50)
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rules (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text DEFAULT ''::text,
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    min_spend numeric(12,2) DEFAULT 0 NOT NULL,
    min_years integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    sku character varying(100) NOT NULL,
    category character varying(100) NOT NULL,
    brand character varying(100) NOT NULL,
    description text,
    price numeric(12,2) NOT NULL,
    cost_price numeric(12,2),
    image text,
    reorder_point integer DEFAULT 0,
    status character varying(20) DEFAULT 'In Stock'::character varying,
    supplier_name character varying(255),
    supplier_phone character varying(50),
    stock_main_warehouse integer DEFAULT 0,
    stock_back_room integer DEFAULT 0,
    stock_show_room integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT products_status_check CHECK (((status)::text = ANY ((ARRAY['In Stock'::character varying, 'Low'::character varying, 'Empty'::character varying, 'Discontinued'::character varying])::text[])))
);


--
-- Name: return_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.return_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id character varying(50) NOT NULL,
    order_id character varying(50),
    buyer_id uuid,
    type character varying(10) NOT NULL,
    quantity integer NOT NULL,
    reason character varying(50) NOT NULL,
    action character varying(30) NOT NULL,
    date date NOT NULL,
    note text,
    loss_value numeric(12,2) DEFAULT 0,
    brand character varying(100),
    product_name character varying(255),
    supplier_name character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    stock_location character varying(20),
    CONSTRAINT return_logs_action_check CHECK (((action)::text = ANY ((ARRAY['Restocked'::character varying, 'Disposed'::character varying, 'Returned to Supplier'::character varying])::text[]))),
    CONSTRAINT return_logs_check CHECK (((((type)::text = 'Return'::text) AND (order_id IS NOT NULL) AND (buyer_id IS NOT NULL)) OR ((type)::text = 'Damage'::text))),
    CONSTRAINT return_logs_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT return_logs_reason_check CHECK (((reason)::text = ANY ((ARRAY['Damaged in Transit'::character varying, 'Expired'::character varying, 'Faulty Packaging'::character varying, 'Customer Return'::character varying, 'Wrong Item'::character varying])::text[]))),
    CONSTRAINT return_logs_type_check CHECK (((type)::text = ANY ((ARRAY['Return'::character varying, 'Damage'::character varying])::text[])))
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id character varying(50) NOT NULL,
    permission_id integer NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    access_level character varying(50),
    member_count integer DEFAULT 0
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key character varying(100) NOT NULL,
    value text NOT NULL
);


--
-- Name: system_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_logs (
    id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    actor_name character varying(255) NOT NULL,
    actor_type character varying(50) NOT NULL,
    action character varying(255) NOT NULL,
    module character varying(50) NOT NULL,
    details text
);


--
-- Name: system_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50),
    company_name character varying(255),
    address text,
    credit_limit numeric(12,2) DEFAULT 0,
    available_credit numeric(12,2) DEFAULT 0,
    outstanding_balance numeric(12,2) DEFAULT 0,
    payment_terms character varying(100),
    tier character varying(50) DEFAULT 'Bronze'::character varying,
    discount_rate numeric(5,2) DEFAULT 0,
    join_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role_id character varying(50),
    contact_person character varying(255),
    total_spend numeric(12,2) DEFAULT 0,
    total_orders integer DEFAULT 0,
    avatar text,
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[])))
);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: system_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);


--
-- Name: bulk_discount_rules bulk_discount_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulk_discount_rules
    ADD CONSTRAINT bulk_discount_rules_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: credit_repayments credit_repayments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_repayments
    ADD CONSTRAINT credit_repayments_pkey PRIMARY KEY (id);


--
-- Name: credit_requests credit_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_requests
    ADD CONSTRAINT credit_requests_pkey PRIMARY KEY (id);


--
-- Name: demand_forecasts demand_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_forecasts
    ADD CONSTRAINT demand_forecasts_pkey PRIMARY KEY (id);


--
-- Name: margin_discount_rules margin_discount_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.margin_discount_rules
    ADD CONSTRAINT margin_discount_rules_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: return_logs return_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_logs
    ADD CONSTRAINT return_logs_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: system_logs system_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_credit_repayments_credit_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_repayments_credit_request ON public.credit_repayments USING btree (credit_request_id, repaid_at DESC, created_at DESC);


--
-- Name: idx_credit_requests_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_requests_buyer ON public.credit_requests USING btree (buyer_id);


--
-- Name: idx_demand_forecasts_generated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demand_forecasts_generated_at ON public.demand_forecasts USING btree (generated_at DESC);


--
-- Name: idx_demand_forecasts_product_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demand_forecasts_product_model ON public.demand_forecasts USING btree (product_id, model);


--
-- Name: idx_demand_forecasts_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_demand_forecasts_scope ON public.demand_forecasts USING btree (model, forecast_scope, scope_key);


--
-- Name: idx_payments_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_buyer ON public.payments USING btree (buyer_id);


--
-- Name: idx_payments_credit_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_credit_request ON public.payments USING btree (credit_request_id, date_time DESC);


--
-- Name: idx_payments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_order ON public.payments USING btree (order_id);


--
-- Name: idx_pricing_rules_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_rules_name ON public.pricing_rules USING btree (name);


--
-- Name: idx_return_logs_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_logs_buyer_id ON public.return_logs USING btree (buyer_id);


--
-- Name: idx_return_logs_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_logs_date ON public.return_logs USING btree (date);


--
-- Name: idx_return_logs_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_logs_order_id ON public.return_logs USING btree (order_id);


--
-- Name: idx_return_logs_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_logs_product_id ON public.return_logs USING btree (product_id);


--
-- Name: credit_repayments credit_repayments_credit_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_repayments
    ADD CONSTRAINT credit_repayments_credit_request_id_fkey FOREIGN KEY (credit_request_id) REFERENCES public.credit_requests(id) ON DELETE CASCADE;


--
-- Name: credit_requests credit_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_requests
    ADD CONSTRAINT credit_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- Name: credit_requests credit_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_requests
    ADD CONSTRAINT credit_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: demand_forecasts demand_forecasts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_forecasts
    ADD CONSTRAINT demand_forecasts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- Name: payments payments_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- Name: payments payments_credit_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_credit_request_id_fkey FOREIGN KEY (credit_request_id) REFERENCES public.credit_requests(id) ON DELETE SET NULL;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: return_logs return_logs_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_logs
    ADD CONSTRAINT return_logs_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- Name: return_logs return_logs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_logs
    ADD CONSTRAINT return_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: return_logs return_logs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_logs
    ADD CONSTRAINT return_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 6gSZlTXRLKBWU56dl3Jk78gmRyRbnecNVINSz717GjHydpAnioJjRAOcMiJWh7i

