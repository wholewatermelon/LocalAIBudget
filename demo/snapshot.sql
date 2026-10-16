--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

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

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    account_name character varying(100) NOT NULL,
    account_type character varying(50) NOT NULL
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: ai_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_insights (
    id integer NOT NULL,
    month character(7) NOT NULL,
    summary text NOT NULL,
    suggestions jsonb DEFAULT '[]'::jsonb NOT NULL,
    model character varying(64),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_insights_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_insights_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_insights_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_insights_id_seq OWNED BY public.ai_insights.id;


--
-- Name: budget_main_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_main_items (
    id integer NOT NULL,
    category_id integer NOT NULL,
    effective_from character(7) NOT NULL,
    amount numeric(12,2),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: budget_main_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_main_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_main_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_main_items_id_seq OWNED BY public.budget_main_items.id;


--
-- Name: budget_month_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_month_items (
    id integer NOT NULL,
    month character(7) NOT NULL,
    category_id integer NOT NULL,
    amount numeric(12,2),
    hidden boolean DEFAULT false NOT NULL,
    note text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT budget_month_items_amount_or_hidden CHECK ((hidden OR (amount IS NOT NULL)))
);


--
-- Name: budget_month_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_month_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_month_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_month_items_id_seq OWNED BY public.budget_month_items.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    is_ai_suggested boolean DEFAULT false,
    is_income boolean DEFAULT false,
    is_transfer boolean DEFAULT false
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: category_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_rules (
    id integer NOT NULL,
    pattern text NOT NULL,
    match_type character varying(16) DEFAULT 'contains'::character varying NOT NULL,
    category_id integer NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    hits integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: category_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: category_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_rules_id_seq OWNED BY public.category_rules.id;


--
-- Name: processing_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processing_jobs (
    id integer NOT NULL,
    type character varying(32) NOT NULL,
    month character(7) NOT NULL,
    mode character varying(16) NOT NULL,
    status character varying(16) NOT NULL,
    total integer DEFAULT 0,
    processed integer DEFAULT 0,
    inserted integer DEFAULT 0,
    skipped_duplicates integer DEFAULT 0,
    categorized integer DEFAULT 0,
    message text,
    errors jsonb DEFAULT '[]'::jsonb,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    rules_applied integer DEFAULT 0,
    transfers_matched integer DEFAULT 0
);


--
-- Name: processing_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.processing_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: processing_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.processing_jobs_id_seq OWNED BY public.processing_jobs.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: statement_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statement_files (
    id integer NOT NULL,
    month character(7) NOT NULL,
    file_name text NOT NULL,
    file_type character varying(8) NOT NULL,
    account_id integer,
    size_bytes integer,
    uploaded_at timestamp with time zone DEFAULT now(),
    last_processed_at timestamp with time zone,
    last_parse_method character varying(16),
    period_start date,
    period_end date,
    opening_balance numeric(12,2),
    closing_balance numeric(12,2),
    parsed_total numeric(12,2),
    reconciliation_status character varying(16) DEFAULT 'unknown'::character varying,
    reconciliation_diff numeric(12,2)
);


--
-- Name: statement_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.statement_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: statement_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.statement_files_id_seq OWNED BY public.statement_files.id;


--
-- Name: transaction_splits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_splits (
    id integer NOT NULL,
    transaction_id integer,
    category_id integer,
    amount numeric(12,2) NOT NULL
);


--
-- Name: transaction_splits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transaction_splits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transaction_splits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transaction_splits_id_seq OWNED BY public.transaction_splits.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    account_id integer,
    category_id integer,
    transaction_date date NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    is_manual_correction boolean DEFAULT false,
    raw_text text,
    statement_month character(7),
    statement_file_id integer,
    categorized_by character varying(16),
    dedupe_key text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    transfer_pair_id integer,
    ai_confidence numeric(3,2),
    needs_review boolean DEFAULT false NOT NULL
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: ai_insights id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights ALTER COLUMN id SET DEFAULT nextval('public.ai_insights_id_seq'::regclass);


--
-- Name: budget_main_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_main_items ALTER COLUMN id SET DEFAULT nextval('public.budget_main_items_id_seq'::regclass);


--
-- Name: budget_month_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_month_items ALTER COLUMN id SET DEFAULT nextval('public.budget_month_items_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: category_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_rules ALTER COLUMN id SET DEFAULT nextval('public.category_rules_id_seq'::regclass);


--
-- Name: processing_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs ALTER COLUMN id SET DEFAULT nextval('public.processing_jobs_id_seq'::regclass);


--
-- Name: statement_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statement_files ALTER COLUMN id SET DEFAULT nextval('public.statement_files_id_seq'::regclass);


--
-- Name: transaction_splits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_splits ALTER COLUMN id SET DEFAULT nextval('public.transaction_splits_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.accounts (id, account_name, account_type) FROM stdin;
1	Harbor Cash Back Card	Credit Card
2	Maple Federal Checking	Bank
3	Maple Federal Savings	Bank
4	Summit Rewards Visa	Credit Card
\.


--
-- Data for Name: ai_insights; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_insights (id, month, summary, suggestions, model, created_at) FROM stdin;
2	2025-01	In January 2025, your total spending was $12,239.09, which was higher than your spending in October ($10,988.14) and November ($10,346.56). While Food spending was relatively consistent compared to previous months, Shopping and Restaurants saw increases in January. Overall, spending was higher than in the preceding months.	[{"reason": "To bring spending closer to the average of recent months.", "categoryId": 2, "categoryName": "Food", "suggestedLimit": 3800}, {"reason": "This aligns with the consistent historical spending amount.", "categoryId": 1, "categoryName": "Housing", "suggestedLimit": 2575}, {"reason": "To moderate transport costs, similar to November's spending.", "categoryId": 4, "categoryName": "Transport", "suggestedLimit": 1000}, {"reason": "To reduce the higher spending seen in January and December.", "categoryId": 8, "categoryName": "Shopping", "suggestedLimit": 1200}, {"reason": "To keep dining out costs in a reasonable range.", "categoryId": 3, "categoryName": "Restaurants", "suggestedLimit": 1300}, {"reason": "This is close to the average utility spending across the last few months.", "categoryId": 6, "categoryName": "Utilities", "suggestedLimit": 475}, {"reason": "To help control miscellaneous spending.", "categoryId": 10, "categoryName": "Other", "suggestedLimit": 550}, {"reason": "To maintain a moderate level of entertainment spending.", "categoryId": 5, "categoryName": "Entertainment", "suggestedLimit": 250}, {"reason": "This category is likely only needed during holiday seasons.", "categoryId": 11, "categoryName": "Holiday Gifts", "suggestedLimit": 0}]	gemma4	2026-10-16 14:51:41.047467-06
\.


--
-- Data for Name: budget_main_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budget_main_items (id, category_id, effective_from, amount, created_at) FROM stdin;
11	1	2024-08	2600.00	2026-10-16 14:51:56.181253-06
12	2	2024-08	3500.00	2026-10-16 14:51:56.216788-06
13	3	2024-08	1000.00	2026-10-16 14:51:56.22253-06
14	4	2024-08	900.00	2026-10-16 14:51:56.225239-06
15	5	2024-08	250.00	2026-10-16 14:51:56.227879-06
16	6	2024-08	550.00	2026-10-16 14:51:56.230924-06
17	8	2024-08	1000.00	2026-10-16 14:51:56.235766-06
18	10	2024-08	450.00	2026-10-16 14:51:56.238271-06
19	2	2024-11	3800.00	2026-10-16 14:51:56.240498-06
20	3	2024-11	900.00	2026-10-16 14:51:56.242573-06
\.


--
-- Data for Name: budget_month_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budget_month_items (id, month, category_id, amount, hidden, note, updated_at) FROM stdin;
3	2024-12	11	500.00	f	Gifts for family and teachers	2026-10-16 14:51:56.2468-06
4	2024-12	2	4200.00	f	Hosting the family for the holidays	2026-10-16 14:51:56.292348-06
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, is_ai_suggested, is_income, is_transfer) FROM stdin;
1	Housing	f	f	f
2	Food	f	f	f
3	Restaurants	f	f	f
4	Transport	f	f	f
5	Entertainment	f	f	f
6	Utilities	f	f	f
7	Income	f	t	f
8	Shopping	f	f	f
9	Transfer	f	f	t
10	Other	f	f	f
11	Holiday Gifts	f	f	f
\.


--
-- Data for Name: category_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.category_rules (id, pattern, match_type, category_id, priority, hits, created_at) FROM stdin;
1	AMZN MKTP	contains	8	0	49	2026-10-16 14:32:16.505815-06
8	COSTCO WHSE	contains	2	0	23	2026-10-16 14:32:16.536023-06
7	NETFLIX	contains	5	0	6	2026-10-16 14:32:16.532427-06
5	PINECREST HOME LOANS	contains	1	0	7	2026-10-16 14:32:16.524737-06
3	PAYROLL	contains	7	0	15	2026-10-16 14:32:16.516578-06
6	CASCADE POWER & LIGHT	contains	6	0	7	2026-10-16 14:32:16.52835-06
2	SHELL OIL	contains	4	0	31	2026-10-16 14:32:16.512733-06
4	DIR DEP	contains	7	0	14	2026-10-16 14:32:16.521085-06
\.


--
-- Data for Name: processing_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.processing_jobs (id, type, month, mode, status, total, processed, inserted, skipped_duplicates, categorized, message, errors, started_at, finished_at, created_at, rules_applied, transfers_matched) FROM stdin;
3	process_month	2024-10	incremental	completed	125	125	146	0	146	Processed 4 file(s): 146 inserted, 0 duplicates skipped, 146 categorized (19 by rules, 3 transfer pairs)	[{"file": "Maple_Federal_Checking_2024-10.pdf", "message": "Reconciliation mismatch: off by $42.17 — rows may be missing"}]	2026-10-16 14:37:30.455324-06	2026-10-16 14:40:13.664188-06	2026-10-16 14:37:30.448749-06	19	3
1	process_month	2024-08	incremental	completed	125	125	151	0	151	Processed 4 file(s): 151 inserted, 0 duplicates skipped, 151 categorized (24 by rules, 3 transfer pairs)	[]	2026-10-16 14:32:16.542815-06	2026-10-16 14:34:51.311087-06	2026-10-16 14:32:16.540057-06	24	3
6	process_month	2025-01	incremental	completed	128	128	155	0	155	Processed 4 file(s): 155 inserted, 0 duplicates skipped, 155 categorized (25 by rules, 3 transfer pairs)	[]	2026-10-16 14:45:50.62047-06	2026-10-16 14:48:32.573854-06	2026-10-16 14:45:50.619683-06	25	3
4	process_month	2024-11	incremental	completed	121	121	145	0	145	Processed 4 file(s): 145 inserted, 0 duplicates skipped, 145 categorized (22 by rules, 3 transfer pairs)	[]	2026-10-16 14:40:14.277471-06	2026-10-16 14:42:56.039534-06	2026-10-16 14:40:14.268961-06	22	3
2	process_month	2024-09	incremental	completed	124	124	151	0	151	Processed 4 file(s): 151 inserted, 0 duplicates skipped, 151 categorized (25 by rules, 3 transfer pairs)	[]	2026-10-16 14:34:51.801979-06	2026-10-16 14:37:30.139599-06	2026-10-16 14:34:51.791227-06	25	3
7	process_month	2025-02	incremental	completed	37	37	45	0	45	Processed 1 file(s): 45 inserted, 0 duplicates skipped, 45 categorized (9 by rules, 0 transfer pairs)	[]	2026-10-16 14:48:32.995506-06	2026-10-16 14:49:30.251278-06	2026-10-16 14:48:32.994777-06	9	0
5	process_month	2024-12	incremental	completed	139	139	171	0	171	Processed 4 file(s): 171 inserted, 0 duplicates skipped, 171 categorized (28 by rules, 4 transfer pairs)	[]	2026-10-16 14:42:56.095869-06	2026-10-16 14:45:50.488118-06	2026-10-16 14:42:56.094973-06	28	4
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (name, applied_at) FROM stdin;
001_initial_schema.sql	2026-10-16 14:32:15.824338-06
002_rules_reconciliation_transfers_review.sql	2026-10-16 14:32:15.878149-06
003_main_budget_and_month_adjustments.sql	2026-10-16 14:32:15.888645-06
\.


--
-- Data for Name: statement_files; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.statement_files (id, month, file_name, file_type, account_id, size_bytes, uploaded_at, last_processed_at, last_parse_method, period_start, period_end, opening_balance, closing_balance, parsed_total, reconciliation_status, reconciliation_diff) FROM stdin;
1	2024-08	Harbor_Cash_Back_Card_2024-08.csv	csv	1	3620	2026-10-16 14:32:16.547668-06	2026-10-16 14:32:16.576991-06	csv	\N	\N	\N	\N	-1322.99	unknown	\N
2	2024-08	Maple_Federal_Checking_2024-08.pdf	pdf	2	8033	2026-10-16 14:32:16.550088-06	2026-10-16 14:32:16.718861-06	regex	2024-08-01	2024-08-31	8312.37	9513.59	1201.22	ok	0.00
3	2024-08	Maple_Federal_Savings_2024-08.txt	txt	3	106	2026-10-16 14:32:16.551455-06	2026-10-16 14:32:16.722485-06	regex	\N	\N	\N	\N	505.20	unknown	\N
4	2024-08	Summit_Rewards_Visa_2024-08.pdf	pdf	4	6530	2026-10-16 14:32:16.552693-06	2026-10-16 14:32:16.771439-06	regex	2024-08-05	2024-09-04	3214.56	3885.86	-671.30	ok	0.00
5	2024-09	Harbor_Cash_Back_Card_2024-09.csv	csv	1	3593	2026-10-16 14:34:51.816844-06	2026-10-16 14:34:51.875146-06	csv	\N	\N	\N	\N	-423.30	unknown	\N
6	2024-09	Maple_Federal_Checking_2024-09.pdf	pdf	2	8546	2026-10-16 14:34:51.82374-06	2026-10-16 14:34:51.92726-06	regex	2024-09-01	2024-09-30	9513.59	7880.22	-1633.37	ok	0.00
7	2024-09	Maple_Federal_Savings_2024-09.txt	txt	3	106	2026-10-16 14:34:51.828154-06	2026-10-16 14:34:51.929574-06	regex	\N	\N	\N	\N	505.43	unknown	\N
8	2024-09	Summit_Rewards_Visa_2024-09.pdf	pdf	4	6161	2026-10-16 14:34:51.832289-06	2026-10-16 14:34:51.962526-06	regex	2024-09-05	2024-10-04	3885.86	3997.66	-111.80	ok	0.00
27	2025-02	Maple_Federal_Checking_2025-02.pdf	pdf	2	7105	2026-10-16 14:48:32.996555-06	2026-10-16 14:48:33.028707-06	regex	2025-02-01	2025-02-28	6203.39	4672.79	-1530.60	ok	0.00
13	2024-11	Harbor_Cash_Back_Card_2024-11.qfx	qfx	1	7393	2026-10-16 14:40:14.279021-06	2026-10-16 14:40:14.294882-06	ofx	2024-11-01	2024-11-30	\N	2291.92	538.51	unknown	\N
14	2024-11	Maple_Federal_Checking_2024-11.pdf	pdf	2	8336	2026-10-16 14:40:14.280161-06	2026-10-16 14:40:14.328785-06	regex	2024-11-01	2024-11-30	6500.65	8710.03	2209.38	ok	0.00
15	2024-11	Maple_Federal_Savings_2024-11.txt	txt	3	106	2026-10-16 14:40:14.280879-06	2026-10-16 14:40:14.330982-06	regex	\N	\N	\N	\N	505.89	unknown	\N
16	2024-11	Summit_Rewards_Visa_2024-11.pdf	pdf	4	6328	2026-10-16 14:40:14.281488-06	2026-10-16 14:40:14.359124-06	regex	2024-11-05	2024-12-04	3246.91	3241.79	5.12	ok	0.00
17	2024-12	Harbor_Cash_Back_Card_2024-12.csv	csv	1	4240	2026-10-16 14:42:56.09724-06	2026-10-16 14:42:56.119451-06	csv	\N	\N	\N	\N	-642.23	unknown	\N
18	2024-12	Maple_Federal_Checking_2024-12.pdf	pdf	2	8679	2026-10-16 14:42:56.098091-06	2026-10-16 14:42:56.158484-06	regex	2024-12-01	2024-12-31	8710.03	8459.67	-250.36	ok	0.00
19	2024-12	Maple_Federal_Savings_2024-12.txt	txt	3	186	2026-10-16 14:42:56.098743-06	2026-10-16 14:42:56.161594-06	regex	\N	\N	\N	\N	206.12	unknown	\N
20	2024-12	Summit_Rewards_Visa_2024-12.pdf	pdf	4	6900	2026-10-16 14:42:56.099328-06	2026-10-16 14:42:56.200358-06	regex	2024-12-05	2025-01-04	3241.79	4839.07	-1597.28	ok	0.00
22	2025-01	Maple_Federal_Checking_2025-01.csv	csv	2	4035	2026-10-16 14:45:50.623008-06	\N	\N	\N	\N	\N	\N	\N	unknown	\N
24	2025-01	Maple_Federal_Checking_2025-01.pdf	pdf	2	7407	2026-10-16 14:45:50.624398-06	\N	\N	\N	\N	\N	\N	\N	unknown	\N
21	2025-01	Harbor_Cash_Back_Card_2025-01.csv	csv	1	3758	2026-10-16 14:45:50.622019-06	2026-10-16 14:45:50.644105-06	csv	\N	\N	\N	\N	-213.34	unknown	\N
23	2025-01	Maple_Federal_Checking_2025-01.ofx	ofx	2	18856	2026-10-16 14:45:50.623704-06	2026-10-16 14:45:50.658671-06	ofx	2025-01-01	2025-01-31	\N	6203.39	-2256.28	unknown	\N
25	2025-01	Maple_Federal_Savings_2025-01.txt	txt	3	106	2026-10-16 14:45:50.625085-06	2026-10-16 14:45:50.661358-06	regex	\N	\N	\N	\N	506.35	unknown	\N
26	2025-01	Summit_Rewards_Visa_2025-01.pdf	pdf	4	6587	2026-10-16 14:45:50.625773-06	2026-10-16 14:45:50.697183-06	regex	2025-01-05	2025-02-04	4839.07	4044.72	794.35	ok	0.00
9	2024-10	Harbor_Cash_Back_Card_2024-10.csv	csv	1	3843	2026-10-16 14:37:30.456774-06	2026-10-16 14:37:30.474705-06	csv	\N	\N	\N	\N	200.03	unknown	\N
10	2024-10	Maple_Federal_Checking_2024-10.pdf	pdf	2	8228	2026-10-16 14:37:30.457609-06	2026-10-16 14:37:30.517573-06	regex	2024-10-01	2024-10-31	7880.22	6542.82	-1379.57	mismatch	-42.17
11	2024-10	Maple_Federal_Savings_2024-10.txt	txt	3	106	2026-10-16 14:37:30.458345-06	2026-10-16 14:37:30.519986-06	regex	\N	\N	\N	\N	505.66	unknown	\N
12	2024-10	Summit_Rewards_Visa_2024-10.pdf	pdf	4	6132	2026-10-16 14:37:30.458999-06	2026-10-16 14:37:30.553565-06	regex	2024-10-05	2024-11-04	3997.66	3246.91	750.75	ok	0.00
\.


--
-- Data for Name: transaction_splits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transaction_splits (id, transaction_id, category_id, amount) FROM stdin;
1	908	2	-137.23
2	908	8	-73.89
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, account_id, category_id, transaction_date, description, amount, is_manual_correction, raw_text, statement_month, statement_file_id, categorized_by, dedupe_key, created_at, updated_at, transfer_pair_id, ai_confidence, needs_review) FROM stdin;
29	1	3	2024-08-13	DOORDASH*BURGERVILLE #12	-21.04	f	08/13/2024,08/14/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-21.04	2024-08	1	ai	3d306253bd1c830b1c43783880ed574781aedda578c02bcf58a3ce14cffa95a1	2026-10-16 14:32:16.563626-06	2026-10-16 14:49:31.994986-06	\N	0.90	f
196	1	5	2024-09-02	APPLE.COM/BILL 866-712-7753 CA	-9.99	f	09/02/2024,09/04/2024,APPLE.COM/BILL 866-712-7753 CA,Entertainment,Sale,-9.99	2024-09	5	ai	275f875f0ecc60f0d210ec2340a96a69ca3b6598c4e367c1189a9c8200d80ddf	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:33.446938-06	\N	0.85	f
28	1	4	2024-08-13	FRED-MEYER FUEL #0651 GRESHAM OR	-52.46	f	08/13/2024,08/15/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-52.46	2024-08	1	ai	983935b29062b02ab8bc438eb299d8558acc50edd629572663d2972a30811a47	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:28.909068-06	\N	0.90	f
30	1	10	2024-08-13	CVS/PHARMACY #10422 GRESHAM OR	-39.85	f	08/13/2024,08/13/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-39.85	2024-08	1	ai	5d7f1cebc830943942db668ce61fcddf9dfd3c4aebbd23a448b77069d10895ac	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:28.910211-06	\N	0.80	f
25	1	4	2024-08-16	FRED-MEYER FUEL #0651 GRESHAM OR	-35.18	f	08/16/2024,08/16/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-35.18	2024-08	1	ai	b6249f140c816247679bde19485346676967f1e93837e72d2e6ea095a533ae12	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:28.917397-06	\N	0.90	f
26	1	2	2024-08-16	WINCO FOODS #112 GRESHAM OR	-91.72	f	08/16/2024,08/16/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-91.72	2024-08	1	ai	fa3a196bee0cd186511d1b296c61001e397967432fac88fd7194aee04130d651	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.331614-06	\N	0.95	f
24	1	3	2024-08-17	DOORDASH*THAI BASIL, FAIRVIEW OR	-58.51	f	08/17/2024,08/19/2024,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-58.51	2024-08	1	ai	8a0d8fc0c9cf8cceb300c659d2bf482585b49bff9c1a5cc4093b4ff58f3c474f	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.34034-06	\N	0.90	f
21	1	3	2024-08-18	DOORDASH*BURGERVILLE #12	-23.37	f	08/18/2024,08/18/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-23.37	2024-08	1	ai	3870ed67075fe8a14e0bd81cb31587d60edcd2b3f82f740c79355cbf907c2756	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.34214-06	\N	0.90	f
22	1	2	2024-08-18	TRADER JOE S #145 PORTLAND OR	-145.00	f	08/18/2024,08/19/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-145.00	2024-08	1	ai	12a4f7eff3ffc0342003b397e8d30a637a6a8f2a130c84ed196c81090d8ffcad	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.342606-06	\N	0.95	f
23	1	5	2024-08-18	HULU 877-8244858 CA	-18.99	f	08/18/2024,08/18/2024,HULU 877-8244858 CA,Entertainment,Sale,-18.99	2024-08	1	ai	280ad39172dcdde688bc69bb20eca696c55cad5725d4781ac785625d4b7df6da	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.343071-06	\N	0.90	f
18	1	4	2024-08-19	CHEVRON 0098812 FAIRVIEW OR	-46.44	f	08/19/2024,08/19/2024,CHEVRON 0098812 FAIRVIEW OR,Gas,Sale,-46.44	2024-08	1	ai	1de391503271414724a204f10acca6c37aa7324f3d3b688172958654a7644b85	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.343937-06	\N	0.90	f
20	1	8	2024-08-19	CHEWY.COM 800-672-4399 FL	-14.50	f	08/19/2024,08/21/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-14.50	2024-08	1	ai	829444f017ac12bee6f5fee59147d2b32aad895d0954629d77a8c35ada857f94	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.34483-06	\N	0.80	f
16	1	2	2024-08-20	WINCO FOODS #112 GRESHAM OR	-55.61	f	08/20/2024,08/22/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-55.61	2024-08	1	ai	a972e03ccd1c47cf7272b0b0d53aadde6a58ae8ef67610ffc00964a1ce4f5db7	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.347853-06	\N	0.95	f
17	1	10	2024-08-20	WALGREENS #06124 FAIRVIEW OR	-43.05	f	08/20/2024,08/20/2024,WALGREENS #06124 FAIRVIEW OR,Health & Wellness,Sale,-43.05	2024-08	1	ai	b6f3b679e4261def797d9fd50646d1c1b1e6423a0a127358c12d73219f908f00	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.348378-06	\N	0.80	f
15	1	4	2024-08-21	LYFT *RIDE FRI 8PM, SAN FRANCISCO CA	-26.99	f	08/21/2024,08/23/2024,LYFT *RIDE FRI 8PM, SAN FRANCISCO CA,Travel,Sale,-26.99	2024-08	1	ai	89b7fbc230b2be272987735acb78d61087fd83849baa6bf563e6a164a2676595	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:21.787604-06	\N	0.95	f
13	1	4	2024-08-22	LYFT *RIDE SUN 11PM, SAN FRANCISCO CA	-19.06	f	08/22/2024,08/22/2024,LYFT *RIDE SUN 11PM, SAN FRANCISCO CA,Travel,Sale,-19.06	2024-08	1	ai	94dede9de22499bc8d40221f93830836dfc329a8641d9782ea3f4174a6e68973	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:21.798079-06	\N	0.95	f
14	1	2	2024-08-22	TRADER JOE S #145 PORTLAND OR	-135.05	f	08/22/2024,08/24/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-135.05	2024-08	1	ai	f193c6a14e9609aed88059a4204ba3dcb452eecfe8612b358d306c594a4a2254	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:21.798877-06	\N	0.95	f
12	1	4	2024-08-23	FRED-MEYER FUEL #0651 GRESHAM OR	-30.24	f	08/23/2024,08/25/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-30.24	2024-08	1	ai	4f34683e28e35ee95dd5ead4c2dfb9de5f43c093bc2981fde29c7fb0de58c2c6	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:21.817321-06	\N	0.90	f
9	1	2	2024-08-24	TRADER JOE S #145 PORTLAND OR	-188.32	f	08/24/2024,08/24/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-188.32	2024-08	1	ai	60c1b6d1edc9ed53068c9e6b8ff7b7728156f8c8e01b33e30899d17572af7d26	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:21.818555-06	\N	0.95	f
10	1	3	2024-08-24	PANDA EXPRESS #1912 GRESHAM OR	-38.79	f	08/24/2024,08/26/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-38.79	2024-08	1	ai	3fad1d7afe437c93dba641f607871afb02d829e8b6af3bec74f10daf85dce6c9	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:21.819171-06	\N	0.95	f
8	1	2	2024-08-25	TRADER JOE S #145 PORTLAND OR	-124.64	f	08/25/2024,08/27/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-124.64	2024-08	1	ai	d926760d1cff892b59fae624d9ffeaef87ec17bec60f410f8ad1b7a1bb6908f4	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:21.820282-06	\N	0.95	f
6	1	2	2024-08-26	WINCO FOODS #112 GRESHAM OR	-169.70	f	08/26/2024,08/28/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-169.70	2024-08	1	ai	6b9d52a1bad49395d27fa3a320abff53f5f1d22608dc332428d120790b00ea32	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:21.821701-06	\N	0.95	f
7	1	2	2024-08-26	WINCO FOODS #112 GRESHAM OR	-50.33	f	08/26/2024,08/27/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-50.33	2024-08	1	ai	1ecff09a0b39e2e0d99d26b71acf6ad01270c0882b93d6d7437766b59ee2f5f8	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:21.822188-06	\N	0.95	f
5	1	3	2024-08-27	PANDA EXPRESS #1912 GRESHAM OR	-52.21	f	08/27/2024,08/27/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-52.21	2024-08	1	ai	6691bb9752123bc83151816cc00c6307fa96ad8e229873a056de95e18192b07b	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:48.533156-06	\N	0.95	f
3	1	4	2024-08-28	LYFT *RIDE FRI 11PM, SAN FRANCISCO CA	-19.22	f	08/28/2024,08/29/2024,LYFT *RIDE FRI 11PM, SAN FRANCISCO CA,Travel,Sale,-19.22	2024-08	1	ai	c17ef5636e8654e14b872f4eda153f01038c2e292f5bdbeff835a3be0354ea35	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:48.534572-06	\N	0.95	f
2	1	4	2024-08-29	FRED-MEYER FUEL #0651 GRESHAM OR	-50.08	f	08/29/2024,08/31/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-50.08	2024-08	1	ai	0f87b69815a8070f3d13c608ab9c7a544f36b5011ec2ee3330aa135d6e55cd2d	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:48.535855-06	\N	0.90	f
1	1	10	2024-08-31	CVS/PHARMACY #10422 GRESHAM OR	-8.61	f	08/31/2024,09/02/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-8.61	2024-08	1	ai	eb9f58a785a90e9e91fabf20a716cf015ecf13f3fc2dc3485cd6a5cc03d7790d	2026-10-16 14:32:16.563626-06	2026-10-16 14:34:48.538348-06	\N	0.85	f
35	1	2	2024-08-10	FRED-MEYER #0651 GRESHAM OR	-116.05	f	08/10/2024,08/11/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-116.05	2024-08	1	ai	bdccec3bf6667bd2ff2f41c36507329fd8bcaa1b66a7cd9715d213e834e39b7f	2026-10-16 14:32:16.563626-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
46	1	5	2024-08-02	APPLE.COM/BILL 866-712-7753 CA	-9.99	f	08/02/2024,08/04/2024,APPLE.COM/BILL 866-712-7753 CA,Entertainment,Sale,-9.99	2024-08	1	ai	bddb5231378a089b17a1db925aa2107f2a025b8ed4c68892ff5f1f4e739d5f1b	2026-10-16 14:32:16.563626-06	2026-10-16 14:49:33.446938-06	\N	0.85	f
52	2	1	2024-08-05	ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 6610023385	-188.42	f	08/05 ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 188.42 5,545.53\n6610023385	2024-08	2	ai	48ce0b5b52daa8a3081702f60d5fff5096478817d212ea52a2d9c7b02bc27aa1	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:34.35337-06	\N	0.90	f
51	2	10	2024-08-02	DEBIT CARD PURCHASE 08/02 WALGREENS #06124 FAIRVIEW OR	-46.20	f	08/02 DEBIT CARD PURCHASE 08/02 WALGREENS #06124 FAIRVIEW 46.20 5,733.95\nOR	2024-08	2	ai	acd752eae60be6b9772b18c1f1662a6d1677515717eb519c5c54c83b633e979e	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:35.549706-06	\N	0.90	f
58	2	10	2024-08-07	CHECK #1041	-160.00	f	08/07 CHECK #1041 160.00 4,645.37	2024-08	2	ai	41df7ab89443ece3f354c86aecfd86ba3eaa068b377aaa02d98513f1a8c9767f	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:06.088381-06	\N	0.80	f
37	1	4	2024-08-08	ARCO #82211 AMPM GRESHAM OR	-42.05	f	08/08/2024,08/10/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-42.05	2024-08	1	ai	1ce8dba21e9ede42986e8d1fb74ebba298ef956af14528246f877cb6439dad6a	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:06.094827-06	\N	0.95	f
36	1	4	2024-08-09	CHEVRON 0098812 FAIRVIEW OR	-37.51	f	08/09/2024,08/09/2024,CHEVRON 0098812 FAIRVIEW OR,Gas,Sale,-37.51	2024-08	1	ai	bceb2658d8c381815c9d3f69019182a5a9ae7be6d8de1d2636a32ffd70bdcde6	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:06.096936-06	\N	0.95	f
33	1	4	2024-08-11	LYFT *RIDE SAT 11PM, SAN FRANCISCO CA	-20.84	f	08/11/2024,08/13/2024,LYFT *RIDE SAT 11PM, SAN FRANCISCO CA,Travel,Sale,-20.84	2024-08	1	ai	abd16090f3f215b5d821392e36f116f97fd1f5530d22a0d567cb56a462343842	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:06.101176-06	\N	0.95	f
34	1	10	2024-08-11	WALGREENS #06124 FAIRVIEW OR	-41.89	f	08/11/2024,08/12/2024,WALGREENS #06124 FAIRVIEW OR,Health & Wellness,Sale,-41.89	2024-08	1	ai	28d0bf95fa93ad17c786a5ab54abf60a61a6dd50cb04c2b871930117b7a2d949	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:06.10179-06	\N	0.85	f
31	1	4	2024-08-12	FRED-MEYER FUEL #0651 GRESHAM OR	-30.74	f	08/12/2024,08/14/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-30.74	2024-08	1	ai	c5cc3e9d9f126a2e9ef0036de5c2adb1fc04894267b1396ccc0b481990d225ae	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:06.103608-06	\N	0.95	f
32	1	3	2024-08-12	PANDA EXPRESS #1912 GRESHAM OR	-29.53	f	08/12/2024,08/12/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-29.53	2024-08	1	ai	b6a5727ed81011755399bb5557671589202e5fca1ad935368fa39c5b5f84c5d3	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:06.10422-06	\N	0.95	f
27	1	10	2024-08-15	CVS/PHARMACY #10422 GRESHAM OR	-42.22	f	08/15/2024,08/16/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-42.22	2024-08	1	ai	bf544e5b8a0399bd400e92f360748d27dc3f92abbee9babae6cda67fb7f65e4f	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:28.915397-06	\N	0.80	f
54	2	4	2024-08-05	POS DEBIT 08/03 SHELL OIL 57442	-35.00	f	08/05 POS DEBIT 08/03 SHELL OIL 57442 35.00 5,010.53	2024-08	2	rule	78caecb2bdbaab1cd27add398b1ba4cf07f86c742bbd42c6c1c7a2d97ab9be1b	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.776282-06	\N	\N	f
59	2	6	2024-08-08	ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 9300012231	-127.43	f	08/08 ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 127.43 4,517.94\n9300012231	2024-08	2	rule	7a7d793a4b4e23397b184dcb535fb0312c7cd24203228fa61947f1d9e0c6fc2a	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.776754-06	\N	\N	f
53	2	9	2024-08-05	ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS XXXXXX4471 REF #IBFK8XWKD	-500.00	f	08/05 ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS 500.00 5,045.53\nXXXXXX4471 REF #IBFK8XWKD	2024-08	2	transfer	01551fd1682755b81feef9dc762af665c29e7ede29b71db452da9bd332e747a5	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.792027-06	95	\N	f
47	1	4	2024-08-01	FRED-MEYER FUEL #0651 GRESHAM OR	-37.71	f	08/01/2024,08/03/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-37.71	2024-08	1	ai	5150976e9fb7223e421e091c5b82ab7c0f9822548f64f48894634c999c38ab71	2026-10-16 14:32:16.563626-06	2026-10-16 14:32:42.206726-06	\N	0.95	f
49	2	4	2024-08-01	POS DEBIT 08/01 CHEVRON 0098812 FAIRVIEW OR	-47.22	f	08/01 POS DEBIT 08/01 CHEVRON 0098812 FAIRVIEW OR 47.22 5,880.15	2024-08	2	ai	e01a6df45269a28c28593aeb1f16fcdb003afb173b9d75b58ea19e8192996774	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:42.207606-06	\N	0.95	f
45	1	4	2024-08-02	ARCO #82211 AMPM GRESHAM OR	-58.69	f	08/02/2024,08/03/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-58.69	2024-08	1	ai	373e520187ec075db2db8b5d967846053fae9559915ef4e6f3e2ab5244c545ef	2026-10-16 14:32:16.563626-06	2026-10-16 14:32:42.208258-06	\N	0.95	f
50	2	10	2024-08-02	ATM WITHDRAWAL 08/02 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-100.00	f	08/02 ATM WITHDRAWAL 08/02 MAPLE FEDERAL ATM #2210 2210 100.00 5,780.15\nMAIN ST FAIRVIEW OR	2024-08	2	ai	f7b629df57e917c39c721e6133988e119215b530b862526b3bdadc8833996da2	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:42.209565-06	\N	0.70	f
43	1	3	2024-08-04	DOORDASH*THAI BASIL, FAIRVIEW OR	-52.19	f	08/04/2024,08/06/2024,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-52.19	2024-08	1	ai	fd24c3fa3c3d25785637a67a8cb5f05579df4855fe2eb61a418360e353136869	2026-10-16 14:32:16.563626-06	2026-10-16 14:32:42.21066-06	\N	0.95	f
44	1	2	2024-08-04	TRADER JOE S #145 PORTLAND OR	-147.71	f	08/04/2024,08/05/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-147.71	2024-08	1	ai	0be61691f8cefefd939df6daa6b00fd2a509ad5ddd08f4efb1c94a8dacafc141	2026-10-16 14:32:16.563626-06	2026-10-16 14:32:42.211429-06	\N	0.95	f
55	2	4	2024-08-05	POS DEBIT 08/04 ARCO #82211 AMPM	-56.29	f	08/05 POS DEBIT 08/04 ARCO #82211 AMPM 56.29 4,954.24	2024-08	2	ai	4aa3fc89a13d438570c5692f8a9b38209bef3525c87b4c45a73aca169d6c1864	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:42.214401-06	\N	0.95	f
39	1	2	2024-08-06	TRADER JOE S #145 PORTLAND OR	-58.66	f	08/06/2024,08/07/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-58.66	2024-08	1	ai	6a077c71771e2e214842b81034dfd3e8e12ba3ef706fbfc99f4bd6651c849353	2026-10-16 14:32:16.563626-06	2026-10-16 14:32:42.215533-06	\N	0.95	f
40	1	3	2024-08-06	UBER *EATS PENDING HELP.UBER.COM CA	-62.63	f	08/06/2024,08/07/2024,UBER *EATS PENDING HELP.UBER.COM CA,Food & Drink,Sale,-62.63	2024-08	1	ai	f4c0f449e3c12c1c4395fd124c269adfcd1ef1825d2179164d856aeeb06ba714	2026-10-16 14:32:16.563626-06	2026-10-16 14:32:42.216085-06	\N	0.95	f
57	2	3	2024-08-06	DEBIT CARD PURCHASE 08/05 TST* LUIGIS TRATTORIA FAIRVIEW OR	-17.28	f	08/06 DEBIT CARD PURCHASE 08/05 TST* LUIGIS TRATTORIA 17.28 4,805.37\nFAIRVIEW OR	2024-08	2	ai	926490f4e276a3902bf89fcdd778dc5f7d731c4c3d6e6a1c90bf271431483851	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:42.216654-06	\N	0.95	f
38	1	4	2024-08-07	ARCO #82211 AMPM GRESHAM OR	-66.03	f	08/07/2024,08/07/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-66.03	2024-08	1	ai	5966daa939cc5394b61ae06cd6a0706ac5d233726ec71f6f8c541a60d13b069d	2026-10-16 14:32:16.563626-06	2026-10-16 14:32:42.218304-06	\N	0.95	f
60	2	2	2024-08-08	POS DEBIT 08/08 GROCERY OUTLET #388 GRESHAM OR	-70.97	f	08/08 POS DEBIT 08/08 GROCERY OUTLET #388 GRESHAM OR 70.97 4,446.97	2024-08	2	ai	3aafaf7855f24f030dce794a927aa64658cca02f7cc06f0db018ebd6d5795472	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:06.095368-06	\N	0.95	f
597	1	4	2024-12-30	LYFT *RIDE FRI 5PM, SAN FRANCISCO CA	-16.91	f	12/30/2024,12/30/2024,LYFT *RIDE FRI 5PM, SAN FRANCISCO CA,Travel,Sale,-16.91	2024-12	17	ai	a24e5232cf4dcef0c5ec0ff0b98de714cae7fd9133cea881d7d23eef88e1ce2a	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:50.480938-06	\N	0.95	f
67	2	3	2024-08-12	DEBIT CARD PURCHASE 08/10 DUTCH BROS #OR0212 FAIRVIEW OR	-7.19	f	08/12 DEBIT CARD PURCHASE 08/10 DUTCH BROS #OR0212 7.19 8,367.55\nFAIRVIEW OR	2024-08	2	ai	7173819a965a5e402260b9ad6142597688222a843dc733099ca0f57ff6803ea7	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
76	2	3	2024-08-19	POS DEBIT 08/16 SQ *CASCADE ROASTERS FAIRVIEW OR	-8.56	f	08/19 POS DEBIT 08/16 SQ *CASCADE ROASTERS FAIRVIEW OR 8.56 9,804.24	2024-08	2	ai	af37ea0b9ecb2221defea3b9725da7fc91db5053d10819ef043c384c740f1141	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
77	2	3	2024-08-19	POS DEBIT 08/18 SQ *CASCADE ROASTERS FAIRVIEW OR	-10.98	f	08/19 POS DEBIT 08/18 SQ *CASCADE ROASTERS FAIRVIEW OR 10.98 9,793.26	2024-08	2	ai	1b8d288985762c0fb08b0f60d29600fa93a33c059ed44cba6df45c9f822a8dbf	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
62	2	3	2024-08-09	DEBIT CARD PURCHASE 08/09 SUBWAY 00412290 GRESHAM OR	-37.24	f	08/09 DEBIT CARD PURCHASE 08/09 SUBWAY 00412290 GRESHAM 37.24 7,255.88\nOR	2024-08	2	ai	e0f61f216557ad3f40df3750a604f55def1746a118257a5a65d9d9b7517d7893	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:31.934296-06	\N	0.95	f
63	2	2	2024-08-11	DEBIT CARD PURCHASE 08/11 WINCO FOODS #112 GRESHAM OR	-86.08	f	08/11 DEBIT CARD PURCHASE 08/11 WINCO FOODS #112 GRESHAM 86.08 7,169.80\nOR	2024-08	2	ai	c0488e35bee77432c1620a1f149d8d1fa3e253a5de86b8d925d21de6c8eeeea9	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:06.102399-06	\N	0.95	f
64	2	8	2024-08-11	POS DEBIT 08/11 GOODWILL #22 GRESHAM OR	-68.50	f	08/11 POS DEBIT 08/11 GOODWILL #22 GRESHAM OR 68.50 7,101.30	2024-08	2	ai	567b8ed2c640386d73f983e7cc5259ed1fbd8d2e43cf11673661485d2a6d38c5	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:06.10295-06	\N	0.90	f
65	2	6	2024-08-12	ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 3300298811	-76.56	f	08/12 ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 76.56 7,024.74\n3300298811	2024-08	2	ai	5490a45174b5d654585019fc031d45704fc817911d84f184815bd53e2ad617b0	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:28.905446-06	\N	1.00	f
66	2	7	2024-08-12	ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 8830021147	1350.00	f	08/12 ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 1,350.00 8,374.74\n8830021147	2024-08	2	ai	3a8be368d929a7f649b8ef8ab17f201f08b7a66884eb78a73c1c7983f3144ddc	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:28.906348-06	\N	1.00	f
72	2	7	2024-08-15	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	08/15 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 10,047.35\n5520017784	2024-08	2	rule	b4e2f2823d49dc05b2dea72a07cc435aee3bcb079f297d316ca96741efdcf2e1	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.778797-06	\N	\N	f
73	2	4	2024-08-16	POS DEBIT 08/15 SHELL OIL 57442	-54.56	f	08/16 POS DEBIT 08/15 SHELL OIL 57442 54.56 9,992.79	2024-08	2	rule	e5d0a8483a8d67369f40759a5edad6786bb45e27d1f1837918065377fbc3e6ec	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.780463-06	\N	\N	f
81	2	4	2024-08-21	POS DEBIT 08/21 SHELL OIL 57442	-36.50	f	08/21 POS DEBIT 08/21 SHELL OIL 57442 36.50 6,476.05	2024-08	2	rule	feb3b1e3255c32dc26fee3df75ccdd1f1d3af7faa98466ad15098b2d2bd9bc10	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.78228-06	\N	\N	f
84	2	7	2024-08-23	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	08/23 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 9,167.66\n9100234517	2024-08	2	rule	af0e738460091f48058520e35aa0a8bc9c0c84af92bd6791537414451ec76787	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.782702-06	\N	\N	f
78	2	9	2024-08-20	ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# Q4B7K034	-3214.56	f	08/20 ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# 3,214.56 6,578.70\nQ4B7K034	2024-08	2	transfer	ac4d694da368a44a443545a1821e3cffb1836b0daa75edb17c2fb72626baa960	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.793634-06	97	\N	f
68	2	4	2024-08-13	POS DEBIT 08/12 ARCO #82211 AMPM	-67.95	f	08/13 POS DEBIT 08/12 ARCO #82211 AMPM 67.95 8,299.60	2024-08	2	ai	83c449a10d7a2e9e2412206754f343322ddbfb43d408015151bb3095fa8de402	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:28.910781-06	\N	0.90	f
69	2	2	2024-08-13	DEBIT CARD PURCHASE 08/12 WINCO FOODS #112 GRESHAM OR	-124.36	f	08/13 DEBIT CARD PURCHASE 08/12 WINCO FOODS #112 GRESHAM 124.36 8,175.24\nOR	2024-08	2	ai	63d998acb33aecdbbd2c535ab34beb35a34d5fc37b9656a45ffa2a8056af309b	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:28.911342-06	\N	0.90	f
70	2	10	2024-08-14	DEBIT CARD PURCHASE 08/13 WALGREENS #06124 FAIRVIEW OR	-30.64	f	08/14 DEBIT CARD PURCHASE 08/13 WALGREENS #06124 FAIRVIEW 30.64 8,144.60\nOR	2024-08	2	ai	55ec0950ee929349ad0c82f4b514c5c95cf19858d7c6491b3f16d24a112b99b8	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:28.91247-06	\N	0.80	f
74	2	10	2024-08-16	ATM WITHDRAWAL 08/16 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-100.00	f	08/16 ATM WITHDRAWAL 08/16 MAPLE FEDERAL ATM #2210 2210 100.00 9,892.79\nMAIN ST FAIRVIEW OR	2024-08	2	ai	f16e382e5e7631e43e14214d333c237d4562b17c424642ffd4d752af41c93d33	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:55.33946-06	\N	0.85	f
19	1	3	2024-08-19	PANDA EXPRESS #1912 GRESHAM OR	-64.36	f	08/19/2024,08/21/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-64.36	2024-08	1	ai	455bb235f9768d662a7b37bdc7d4b89dc52cd87d9b6b3b753abe01f95c4b0e0c	2026-10-16 14:32:16.563626-06	2026-10-16 14:33:55.344394-06	\N	0.90	f
79	2	4	2024-08-20	POS DEBIT 08/19 ARCO #82211 AMPM	-59.10	f	08/20 POS DEBIT 08/19 ARCO #82211 AMPM 59.10 6,519.60	2024-08	2	ai	c0b478791f78842a24b7561447d32b5a24fe20a88a11ec0c899c6542a5268baa	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:55.348892-06	\N	0.90	f
82	2	6	2024-08-22	ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190	-142.67	f	08/22 ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190 142.67 6,333.38	2024-08	2	ai	b873657767d7f809db9d744b0601f2af3d1bcab2a0f008c9dc651863d2ca872d	2026-10-16 14:32:16.700533-06	2026-10-16 14:34:21.79946-06	\N	0.90	f
85	2	4	2024-08-23	POS DEBIT 08/22 CHEVRON 0098812 FAIRVIEW OR	-34.45	f	08/23 POS DEBIT 08/22 CHEVRON 0098812 FAIRVIEW OR 34.45 9,133.21	2024-08	2	ai	5372eb52915f870112ff5713b5e9373ec43b5c53ad330c86bcf15bd72f99f9e6	2026-10-16 14:32:16.700533-06	2026-10-16 14:34:21.818014-06	\N	0.90	f
334	1	10	2024-10-10	CVS/PHARMACY #10422 GRESHAM OR	-19.79	f	10/10/2024,10/11/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-19.79	2024-10	9	ai	fd731b9864dc71e6f663930ead66fb2fdaf4f49a6fbf2a56551a3bd370813b52	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:24.676339-06	\N	0.85	f
92	2	3	2024-08-29	DEBIT CARD PURCHASE 08/28 DUTCH BROS #OR0212 FAIRVIEW OR	-10.93	f	08/29 DEBIT CARD PURCHASE 08/28 DUTCH BROS #OR0212 10.93 7,600.96\nFAIRVIEW OR	2024-08	2	ai	eb2b4e86ac89e5ba10279b1a48cf1d0ee4b73e39e4a4f525f13b86a3f1de0207	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:30.878729-06	\N	0.95	f
103	4	3	2024-08-07	TST* PINE STATE BISCUITS PORTLAND OR	-48.34	f	08/07 08/08 TST* PINE STATE BISCUITS PORTLAND OR 48.34	2024-08	4	ai	977f98c1fcfd985806dcd266e6be00f1b9884f18ebdec3d148101885214a5c13	2026-10-16 14:32:16.754628-06	2026-10-16 14:49:31.123945-06	\N	0.90	f
114	4	3	2024-08-14	SQ *TACO PEDRO GRESHAM OR	-39.40	f	08/14 08/14 SQ *TACO PEDRO GRESHAM OR 39.40	2024-08	4	ai	3aacf93c0e0dc4ae69887e17e272761c07b823f7e29ea976f90e66dda0de14f2	2026-10-16 14:32:16.754628-06	2026-10-16 14:49:31.186084-06	\N	0.90	f
104	4	8	2024-08-07	KOHL'S #1129 GRESHAM OR	-107.38	f	08/07 08/09 KOHL'S #1129 GRESHAM OR 107.38	2024-08	4	ai	1c08de1d7496577eb27c60e4d5abe78d5219a986170dec8e913e69fb0bcebdd5	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:06.094348-06	\N	0.90	f
105	4	5	2024-08-09	SPOTIFY USA 877-778-1161 NY	-16.99	f	08/09 08/09 SPOTIFY USA 877-778-1161 NY 16.99	2024-08	4	ai	9e86546d5c93d8faee6d7e28d506384a08b8274b17125a7d93fe74b4d401b3a1	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:06.098086-06	\N	0.90	f
107	4	8	2024-08-09	TARGET 00012345 GRESHAM OR	-49.80	f	08/09 08/09 TARGET 00012345 GRESHAM OR 49.80	2024-08	4	ai	77e01b95b220f6414b33150a75a1bfd3ac074e8a0d34f680c3140234933d6aef	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:06.098868-06	\N	0.90	f
109	4	2	2024-08-09	NEW SEASONS MARKET FAIRVIEW OR	-92.07	f	08/09 08/11 NEW SEASONS MARKET FAIRVIEW OR 92.07	2024-08	4	ai	2047189a3131d17bdcae390e3867870457796e82c19c2bd34f37bbbe3e5ff8aa	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:06.099425-06	\N	0.95	f
110	4	2	2024-08-10	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-4.94	f	08/10 08/12 SQ *BLUE BOTTLE COFFEE OAKLAND CA 4.94	2024-08	4	ai	708b39729a3af49c9108bc9755b7f30032842877a6af780d43a3508433affaf1	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:06.100535-06	\N	0.95	f
111	4	8	2024-08-12	REI #57 PORTLAND OR	-124.68	f	08/12 08/12 REI #57 PORTLAND OR 124.68	2024-08	4	ai	520789bb51472ba9a315134d4ccd979447febcd3f9edf59475a0627c015106d7	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:28.907464-06	\N	0.90	f
106	4	8	2024-08-09	AMZN Mktp US*CWJCDL Amzn.com/bill WA	-64.55	f	08/09 08/09 AMZN Mktp US*CWJCDL Amzn.com/bill WA 64.55	2024-08	4	rule	7e4cc8045db8a2440d8f29303cdec18d892f4de04fe189bfc5365291b22a2481	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.77796-06	\N	\N	f
115	4	5	2024-08-15	NETFLIX.COM 866-579-7172 CA	-22.99	f	08/15 08/15 NETFLIX.COM 866-579-7172 CA 22.99	2024-08	4	rule	1350c2a1425896d195e6f36325c276318e0a20a62cf432d93318ed3e39cda9aa	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.779295-06	\N	\N	f
93	2	7	2024-08-30	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	08/30 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 9,513.36\n5520017784	2024-08	2	rule	2f442cad5fec40371139a37c01cf2579e68d7ae76468af48f29e7c6298e7126b	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.785479-06	\N	\N	f
113	4	2	2024-08-13	NEW SEASONS MARKET FAIRVIEW OR	-47.31	f	08/13 08/14 NEW SEASONS MARKET FAIRVIEW OR 47.31	2024-08	4	ai	3a463ecc8256dafda74aad4efa1d92c57aa523db3fb6da065f03e984fe0d7c12	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:28.911903-06	\N	0.90	f
95	3	9	2024-08-06	ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290	500.00	f	2024-08-06 ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290 500.00	2024-08	3	transfer	69f81bcb23e8ade23a00db9f6387b73ec32a17c68c63986bd994e851c47cea15	2026-10-16 14:32:16.721115-06	2026-10-16 14:32:16.792027-06	53	\N	f
97	4	9	2024-08-21	PAYMENT THANK YOU - WEB	3214.56	f	08/21 08/21 PAYMENT THANK YOU - WEB -3,214.56	2024-08	4	transfer	6e62af140bdbd7ed5179daa40e351a4540195b047b452623f0b7a44111496014	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.793634-06	78	\N	f
118	4	2	2024-08-14	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-11.43	f	08/14 08/16 SQ *BLUE BOTTLE COFFEE OAKLAND CA 11.43	2024-08	4	ai	8d6e0da9c1af5a97a45e3c0727d62e0ab64b93febab4e295b7c73dfcef860111	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:28.914261-06	\N	0.90	f
88	2	9	2024-08-26	HARBOR CARD AUTOPAY PPD ID: 7781000231	-1284.17	f	08/26 HARBOR CARD AUTOPAY PPD ID: 7781000231 1,284.17 7,830.74	2024-08	2	transfer	5a3cdf0dd5a0dfabc27bbb01608c1eb8d7c234bb686fff409ce707bdf4110f66	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.795941-06	11	\N	f
98	4	2	2024-08-04	SAFEWAY #1544 FAIRVIEW OR	-58.40	f	08/04 08/05 SAFEWAY #1544 FAIRVIEW OR 58.40	2024-08	4	ai	5229809ca8e1d336085dc751ab3f74a6c9c7cfb41d24585d21953fee7bd3c19d	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:42.212037-06	\N	0.95	f
100	4	2	2024-08-06	NEW SEASONS MARKET FAIRVIEW OR	-214.39	f	08/06 08/07 NEW SEASONS MARKET FAIRVIEW OR 214.39	2024-08	4	ai	8e134589d528e7b7ce8cd8aa588350c448b53b137b0261829981f895a2029377	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:42.217222-06	\N	0.95	f
102	4	2	2024-08-06	NEW SEASONS MARKET FAIRVIEW OR	-79.30	f	08/06 08/08 NEW SEASONS MARKET FAIRVIEW OR 79.30	2024-08	4	ai	69d38f7240764158fa5fec9d3dc6f579c5da0a6b6b1768a92cf451e7d2694673	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:42.217806-06	\N	0.95	f
119	4	8	2024-08-14	REI #57 PORTLAND OR	-153.36	f	08/14 08/16 REI #57 PORTLAND OR 153.36	2024-08	4	ai	9e9fa971a6328c7af76727f325215962609c5d8fc218f3a8e511a1383824d2b7	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:28.914828-06	\N	0.90	f
117	4	2	2024-08-15	NEW SEASONS MARKET FAIRVIEW OR	-144.67	f	08/15 08/15 NEW SEASONS MARKET FAIRVIEW OR 144.67	2024-08	4	ai	031b9d9f7e34e630e622415288b5037f312d9a722510713a6eddecc6a7175625	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:28.916774-06	\N	0.90	f
75	2	6	2024-08-19	RIVERNET BROADBAND AUTOPAY 800-555-0142	-79.99	f	08/19 RIVERNET BROADBAND AUTOPAY 800-555-0142 79.99 9,812.80	2024-08	2	ai	41c5f3443324b423c9d0a363c5d3aeede95ca8b2ad17c42da0682084c3ac6fef	2026-10-16 14:32:16.700533-06	2026-10-16 14:33:55.345402-06	\N	0.95	f
90	2	2	2024-08-26	POS DEBIT 08/26 WINCO FOODS #112 GRESHAM OR	-149.13	f	08/26 POS DEBIT 08/26 WINCO FOODS #112 GRESHAM OR 149.13 7,624.45	2024-08	2	ai	c575bcdd73d57e67adcd8d5de59403d79922591e1cb7211d5b11d11c6564b038	2026-10-16 14:32:16.700533-06	2026-10-16 14:34:48.531321-06	\N	0.95	f
91	2	3	2024-08-27	DEBIT CARD PURCHASE 08/26 SQ *CASCADE ROASTERS FAIRVIEW OR	-12.56	f	08/27 DEBIT CARD PURCHASE 08/26 SQ *CASCADE ROASTERS 12.56 7,611.89\nFAIRVIEW OR	2024-08	2	ai	c38e7b22bfdcf9b2130b70dfd075f6224bfaa91b7099195a1af2f6ccc47e366b	2026-10-16 14:32:16.700533-06	2026-10-16 14:34:48.533863-06	\N	0.90	f
94	2	7	2024-08-31	INTEREST PAYMENT	0.23	f	08/31 INTEREST PAYMENT 0.23 9,513.59	2024-08	2	ai	ad1fdb5640d1368c9d478b5dda4a179c8007b734f7b22b2c80cc63ad53aa6128	2026-10-16 14:32:16.700533-06	2026-10-16 14:34:48.5391-06	\N	0.90	f
96	3	7	2024-08-31	INTEREST PAYMENT	5.20	f	2024-08-31 INTEREST PAYMENT 5.20	2024-08	3	ai	3e89d4c5c20d87fae5a0a754abed7a59264e22fda37babb92918762f2967c066	2026-10-16 14:32:16.721115-06	2026-10-16 14:34:48.539785-06	\N	0.90	f
121	4	2	2024-08-17	SAFEWAY #1544 FAIRVIEW OR	-172.44	f	08/17 08/18 SAFEWAY #1544 FAIRVIEW OR 172.44	2024-08	4	ai	66c02b5068b55071eaaed1382cc6e994904228c64c89cfeabff07e409b6a290f	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:55.340856-06	\N	0.95	f
228	2	10	2024-09-16	ATM WITHDRAWAL 09/16 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-200.00	f	09/16 ATM WITHDRAWAL 09/16 MAPLE FEDERAL ATM #2210 2210 200.00 10,756.66\nMAIN ST FAIRVIEW OR	2024-09	6	ai	636c5f01f4eb147e086e61674c9b90f015346ee87cf86cadb9ed46231027fd71	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:12.20122-06	\N	0.80	f
123	4	2	2024-08-17	NEW SEASONS MARKET FAIRVIEW OR	-264.07	f	08/17 08/18 NEW SEASONS MARKET FAIRVIEW OR 264.07	2024-08	4	ai	ceb4d8201bef3ef56ef037435aec50bdaa4a06ced7382beea84bdc2fce11c15d	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:55.341672-06	\N	0.95	f
128	4	3	2024-08-20	TST* PINE STATE BISCUITS PORTLAND OR	-37.70	f	08/20 08/21 TST* PINE STATE BISCUITS PORTLAND OR 37.70	2024-08	4	ai	de7871bf4e93275f1cd120a003e2f9369ae2ab6f2e5d2fb13c2506ff95d687f8	2026-10-16 14:32:16.754628-06	2026-10-16 14:49:31.123945-06	\N	0.90	f
124	4	2	2024-08-18	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-7.33	f	08/18 08/19 SQ *BLUE BOTTLE COFFEE OAKLAND CA 7.33	2024-08	4	ai	721103f2201c97884057370cdd99b444736f9bba5bdd3f0b38a610b9bc8a40f5	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:55.343511-06	\N	0.90	f
125	4	3	2024-08-19	TST* LUIGIS TRATTORIA FAIRVIEW OR	-86.03	f	08/19 08/19 TST* LUIGIS TRATTORIA FAIRVIEW OR 86.03	2024-08	4	ai	f47b153041c891a73c9a11cd78141c7c068829acdaa15e00a9a00175ab9223d9	2026-10-16 14:32:16.754628-06	2026-10-16 14:33:55.347338-06	\N	0.90	f
129	4	3	2024-08-21	TST* LUIGIS TRATTORIA FAIRVIEW OR	-65.99	f	08/21 08/21 TST* LUIGIS TRATTORIA FAIRVIEW OR 65.99	2024-08	4	ai	0c9cf74a18210aef15f6e5104177df551dc43456306dc37520dca3d671d880c7	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:21.796187-06	\N	0.95	f
130	4	5	2024-08-21	DISNEY PLUS 888-905-7888 CA	-13.99	f	08/21 08/22 DISNEY PLUS 888-905-7888 CA 13.99	2024-08	4	ai	f6eafe09d2f5d6bda0d29a3378fac41af80c962436b688f93a36f99dcb4a08c8	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:21.796796-06	\N	0.95	f
132	4	4	2024-08-21	COSTCO GAS #0681 WOOD VILLAGE OR	-63.57	f	08/21 08/23 COSTCO GAS #0681 WOOD VILLAGE OR 63.57	2024-08	4	ai	450328438e0b9b075b17fd0e4a6e0fe461f7c68c569c9d6d9de4698693ed6baa	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:21.797515-06	\N	0.90	f
138	4	8	2024-08-26	REI #57 PORTLAND OR	-23.69	f	08/26 08/28 REI #57 PORTLAND OR 23.69	2024-08	4	ai	a25e468cca027e31514c12b95b5f17e5e4bf995ab6112822231697a84318f4c3	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:48.532413-06	\N	0.90	f
140	4	2	2024-08-29	SAFEWAY #1544 FAIRVIEW OR	-145.09	f	08/29 08/30 SAFEWAY #1544 FAIRVIEW OR 145.09	2024-08	4	ai	7feba5013a95d73ed577619009c81b6a6d985e3895d2a41835e90249b7bd9d8d	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:48.537011-06	\N	0.95	f
141	4	2	2024-08-29	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-11.85	f	08/29 08/30 SQ *BLUE BOTTLE COFFEE OAKLAND CA 11.85	2024-08	4	ai	7a4f03fedd6937979702c86ae20e33eb56b2f3febe2e02c351a0e0b688ab120d	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:48.537659-06	\N	0.95	f
122	4	8	2024-08-17	AMZN Mktp US*G9N5VR Amzn.com/bill WA	-19.33	f	08/17 08/18 AMZN Mktp US*G9N5VR Amzn.com/bill WA 19.33	2024-08	4	rule	9a82d74dfc5446aaec2f4a2defa505854480a4c28fbef3ffe61cfe4ffa76e72a	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.781003-06	\N	\N	f
126	4	2	2024-08-19	COSTCO WHSE #0681 WOOD VILLAGE OR	-121.79	f	08/19 08/19 COSTCO WHSE #0681 WOOD VILLAGE OR 121.79	2024-08	4	rule	68103625886b5f1e379a929411686575527dc17e8da0f47cbabb1c15fe645a5e	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.781518-06	\N	\N	f
127	4	8	2024-08-19	AMZN Mktp US*UFYH7L Amzn.com/bill WA	-112.65	f	08/19 08/20 AMZN Mktp US*UFYH7L Amzn.com/bill WA 112.65	2024-08	4	rule	25f3604afe4f0f47db0a2e988499f54eec81793838b6d1a811a9fd917cb4b007	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.781883-06	\N	\N	f
133	4	2	2024-08-23	COSTCO WHSE #0681 WOOD VILLAGE OR	-205.41	f	08/23 08/23 COSTCO WHSE #0681 WOOD VILLAGE OR 205.41	2024-08	4	rule	53620fcf8babc771aaf1d6ea95099b69bf56be635969a9f5e57ce830b09faebf	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.783038-06	\N	\N	f
134	4	2	2024-08-24	COSTCO WHSE #0681 WOOD VILLAGE OR	-231.72	f	08/24 08/25 COSTCO WHSE #0681 WOOD VILLAGE OR 231.72	2024-08	4	rule	c46c9ff8cdc8de98d15081eae2cadaa2b45a2fd1814d14ceb002e5b2bd5019c2	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.783395-06	\N	\N	f
135	4	4	2024-08-25	SHELL OIL 57442110021 FAIRVIEW OR	-66.58	f	08/25 08/27 SHELL OIL 57442110021 FAIRVIEW OR 66.58	2024-08	4	rule	e338e3e5b807aed7ad585b3d20f1f79ce82f5e5c1f747206cd820849f8a4fd7f	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.783848-06	\N	\N	f
136	4	8	2024-08-26	AMZN Mktp US*6ELYFK Amzn.com/bill WA	-32.94	f	08/26 08/27 AMZN Mktp US*6ELYFK Amzn.com/bill WA 32.94	2024-08	4	rule	7d19fafb301dd82179bd2ff0d8781d0662652ac17256fe7a60e805653bc2bad5	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.784226-06	\N	\N	f
137	4	8	2024-08-26	AMZN Mktp US*V969SJ Amzn.com/bill WA	-82.04	f	08/26 08/28 AMZN Mktp US*V969SJ Amzn.com/bill WA 82.04	2024-08	4	rule	0a9d6d7d73fe53556a306c45f3d792d5f0caecff0bdf4a4431b71613a45cea2d	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.784562-06	\N	\N	f
139	4	8	2024-08-28	AMZN Mktp US*UUU9FN Amzn.com/bill WA	-59.14	f	08/28 08/29 AMZN Mktp US*UUU9FN Amzn.com/bill WA 59.14	2024-08	4	rule	29daa9da006ad7e7ac75739aa8ffd277716b0428ababd203688e458d648fad9c	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.785041-06	\N	\N	f
143	4	8	2024-08-31	AMZN Mktp US*816B9E Amzn.com/bill WA	-45.64	f	08/31 09/02 AMZN Mktp US*816B9E Amzn.com/bill WA 45.64	2024-08	4	rule	b376a7500717487638456eb56dd4c65f5391c4c810d3e5a52d8a363a281b7530	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.785819-06	\N	\N	f
147	4	4	2024-09-02	SHELL OIL 57442110021 FAIRVIEW OR	-47.29	f	09/02 09/03 SHELL OIL 57442110021 FAIRVIEW OR 47.29	2024-08	4	rule	5c1e8db868ffb58871f5e3c1da7732c317d104c363eccb8ca33b2341f252980e	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.786158-06	\N	\N	f
144	4	2	2024-08-31	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-4.58	f	08/31 09/02 SQ *BLUE BOTTLE COFFEE OAKLAND CA 4.58	2024-08	4	ai	04c1e0f8ba08b8fdbdaf5f390b860a8eaa9b90ae2712236133a38ceaeaeccda1	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:48.540852-06	\N	0.95	f
145	4	3	2024-08-31	OLIVE GARDEN 0012345 GRESHAM OR	-45.11	f	08/31 09/02 OLIVE GARDEN 0012345 GRESHAM OR 45.11	2024-08	4	ai	9c18516f4f0a67835e360b24322986d812189505affa77b7c4da8ad49e1a0a29	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:48.541612-06	\N	0.95	f
146	4	3	2024-09-02	SQ *TACO PEDRO GRESHAM OR	-90.24	f	09/02 09/03 SQ *TACO PEDRO GRESHAM OR 90.24	2024-08	4	ai	c7faaf3a86baa63d1afb2dcee138d94885255568116301d5cc739e9c45255036	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:48.542986-06	\N	0.95	f
148	4	5	2024-09-03	SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR	-95.00	f	09/03 09/04 SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR 95.00	2024-08	4	ai	a512340c2fb652b262226331c77ca5a9f22c84d4c5b0273e0ca6258fe47ae277	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:48.543613-06	\N	0.90	f
149	4	8	2024-09-04	REI #57 PORTLAND OR	-123.72	f	09/04 09/04 REI #57 PORTLAND OR 123.72	2024-08	4	ai	c97714c04f5196eab97e98cee6e8ccce8f79f8836026b0b1d2447159b059d543	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:48.544283-06	\N	0.90	f
150	4	3	2024-09-04	SQ *CASCADE ROASTERS FAIRVIEW OR	-4.99	f	09/04 09/04 SQ *CASCADE ROASTERS FAIRVIEW OR 4.99	2024-08	4	ai	383bb06ccaa8ceef67a7b88134253be298e6a8b0b13cb887f28959c807d47b1c	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:48.544939-06	\N	0.95	f
151	4	2	2024-09-04	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-4.78	f	09/04 09/04 SQ *BLUE BOTTLE COFFEE OAKLAND CA 4.78	2024-08	4	ai	bdefc9cce2735f8d61469a3d20e972120a551c7375ce79d3b1c25175023907e1	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:51.303697-06	\N	0.95	f
48	2	1	2024-08-01	ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 4417730021	-2385.00	f	08/01 ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 2,385.00 5,927.37\n4417730021	2024-08	2	rule	88e2d1ef5bc7ab92f140ba250642b605c1ab8035ac070b6da9f8d40e5fafbae4	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.775276-06	\N	\N	f
99	4	8	2024-08-04	AMZN Mktp US*2UX7YH Amzn.com/bill WA	-63.30	f	08/04 08/05 AMZN Mktp US*2UX7YH Amzn.com/bill WA 63.30	2024-08	4	rule	28c08be5e944a40a92886538b6ee8df0cab8e86bdd3d33d6ac707dfa3508682c	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.775879-06	\N	\N	f
61	2	7	2024-08-09	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	08/09 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 7,293.12\n9100234517	2024-08	2	rule	d01f21f4af4eafc0eecd9046a71206bc7c27e0fc89d747984b07200dae7f376f	2026-10-16 14:32:16.700533-06	2026-10-16 14:32:16.777142-06	\N	\N	f
120	4	2	2024-08-15	COSTCO WHSE #0681 WOOD VILLAGE OR	-64.62	f	08/15 08/16 COSTCO WHSE #0681 WOOD VILLAGE OR 64.62	2024-08	4	rule	703ff195b0e6839ee8c22574565691662cb4ea40d48538d075acef3c4f9636b2	2026-10-16 14:32:16.754628-06	2026-10-16 14:32:16.779738-06	\N	\N	f
131	4	2	2024-08-22	NEW SEASONS MARKET FAIRVIEW OR	-129.87	f	08/22 08/22 NEW SEASONS MARKET FAIRVIEW OR 129.87	2024-08	4	ai	718697f40d6d5a44a708c8bfee384ee643dd180145eb02837dec67012d9c8f01	2026-10-16 14:32:16.754628-06	2026-10-16 14:34:21.80917-06	\N	0.95	f
11	1	9	2024-08-23	AUTOMATIC PAYMENT - THANK YOU	1284.17	f	08/23/2024,08/23/2024,AUTOMATIC PAYMENT - THANK YOU,,Payment,1284.17	2024-08	1	transfer	b3e2b0a339f4d5a25a546479ea424ae6750044d71a95bb0cd420e815b78f683b	2026-10-16 14:32:16.563626-06	2026-10-16 14:32:16.795941-06	88	\N	f
159	1	1	2024-09-23	THE HOME DEPOT #4012 GRESHAM OR	-68.49	t	09/23/2024,09/25/2024,THE HOME DEPOT #4012 GRESHAM OR,Shopping,Sale,-68.49	2024-09	5	manual	236288510bbf05a830fc439ad574e2b3070c5d29c12dd881855fd925622c6dde	2026-10-16 14:34:51.858709-06	2026-10-16 14:50:01.271878-06	\N	0.90	f
312	1	10	2024-10-26	CVS/PHARMACY #10422 GRESHAM OR	-23.34	f	10/26/2024,10/28/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-23.34	2024-10	9	ai	3fecce2cca4d658c60065cf3d4b08eec0feffacb3d8fc2a5ed26bbb20936db40	2026-10-16 14:37:30.463707-06	2026-10-16 14:39:44.759841-06	\N	0.85	f
89	2	3	2024-08-26	DEBIT CARD PURCHASE 08/25 SUBWAY 00412290 GRESHAM OR	-57.16	f	08/26 DEBIT CARD PURCHASE 08/25 SUBWAY 00412290 GRESHAM 57.16 7,773.58\nOR	2024-08	2	ai	cbfc732bc8f57cf9a849eea71c3d5cffaa5a3796b01ecbf913b204a68dda7f95	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:31.934296-06	\N	0.95	f
167	1	3	2024-09-20	PANDA EXPRESS #1912 GRESHAM OR	-14.73	f	09/20/2024,09/20/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-14.73	2024-09	5	ai	f57f9776e6f6c345aca3cbb5945c6e678f34061854db92310ef3780703f805e4	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
168	1	2	2024-09-20	FRED-MEYER #0651 GRESHAM OR	-142.90	f	09/20/2024,09/22/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-142.90	2024-09	5	ai	3d7b115c5399a55f81ca600d8760076c02166ae06d3ecde4dc375c0d6d28c9e0	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
173	1	8	2024-09-17	PAYPAL *ETSY, INC 4029357733 CA	-70.97	f	09/17/2024,09/18/2024,PAYPAL *ETSY, INC 4029357733 CA,Shopping,Sale,-70.97	2024-09	5	ai	db26e41567e6f7031248c0d863765f3b2359ce7604204a1542277a4dc63eedee	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:38.112783-06	\N	0.90	f
171	1	2	2024-09-18	TRADER JOE S #145 PORTLAND OR	-69.70	f	09/18/2024,09/20/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-69.70	2024-09	5	ai	b951467d1ae8817a891f204043083bbd10526c7f9aef24daeefa9be759c5f8bd	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:38.122888-06	\N	0.95	f
172	1	5	2024-09-18	HULU 877-8244858 CA	-18.99	f	09/18/2024,09/18/2024,HULU 877-8244858 CA,Entertainment,Sale,-18.99	2024-09	5	ai	b5276954ba7f836ee8439359911504ab3dff1c783d811b50d029fd0dfc6bfa06	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:38.123344-06	\N	0.95	f
170	1	8	2024-09-19	CHEWY.COM 800-672-4399 FL	-77.22	f	09/19/2024,09/21/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-77.22	2024-09	5	ai	af368dbaa12098b21a62996242a3cfcd9d18552acd8f5cfa6e0f7aa1891cf8ef	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:38.12568-06	\N	0.90	f
169	1	2	2024-09-20	TRADER JOE S #145 PORTLAND OR	-119.19	f	09/20/2024,09/20/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-119.19	2024-09	5	ai	4298a1ae9f87e34f8d5b3263c5bfa507d8d863c152c7fa9db190cf0a2c14175f	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:04.101023-06	\N	0.95	f
164	1	10	2024-09-21	CVS/PHARMACY #10422 GRESHAM OR	-34.58	f	09/21/2024,09/23/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-34.58	2024-09	5	ai	024c274bfa3d529f1bfc7089360ade9e8485022205ff97484e4f24498540a267	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:04.108335-06	\N	0.85	f
161	1	2	2024-09-22	TRADER JOE S #145 PORTLAND OR	-44.36	f	09/22/2024,09/22/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-44.36	2024-09	5	ai	d420a355c599115039a7b24a5b368b20d27c862ea7a13c5c6841feba0c819196	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:04.111207-06	\N	0.95	f
162	1	8	2024-09-22	PAYPAL *ETSY, INC 4029357733 CA	-62.46	f	09/22/2024,09/22/2024,PAYPAL *ETSY, INC 4029357733 CA,Shopping,Sale,-62.46	2024-09	5	ai	79e6a721ae3d58ceb8dd9699753d92c60befdc5c01a890ca41f008f8951f0aee	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:04.111714-06	\N	0.90	f
163	1	3	2024-09-22	PANDA EXPRESS #1912 GRESHAM OR	-54.30	f	09/22/2024,09/22/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-54.30	2024-09	5	ai	cdaeff304d8f55ac19ae1a52cd4a5ce8dc19dd26bc906859c143adf09eb76d30	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:04.112213-06	\N	0.98	f
160	1	8	2024-09-23	CHEWY.COM 800-672-4399 FL	-26.68	f	09/23/2024,09/24/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-26.68	2024-09	5	ai	1002ab856d2542d2241874d0a1251f211969e4709f747416b15c4e36143366d5	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:04.113822-06	\N	0.90	f
157	1	2	2024-09-24	TRADER JOE S #145 PORTLAND OR	-170.37	f	09/24/2024,09/24/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-170.37	2024-09	5	ai	ebc15b2d0fb4ca1657fe7fa53192387bbb78153c4e0e8e7703e3c7d949496738	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:04.116472-06	\N	0.95	f
155	1	3	2024-09-27	DOORDASH*BURGERVILLE #12	-34.74	f	09/27/2024,09/28/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-34.74	2024-09	5	ai	4b6fbbb79df0992e1d280cdb0253d3f83a59e6dbeef8abd2b8e05596fb122ed5	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:30.129502-06	\N	0.95	f
156	1	3	2024-09-27	DOORDASH*BURGERVILLE #12	-54.03	f	09/27/2024,09/29/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-54.03	2024-09	5	ai	20a1d3d32e4f71e8f0a98f9be28a68566ae79d4a35f866c2a2d35d08b20a98da	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:30.130341-06	\N	0.95	f
153	1	10	2024-09-28	CVS/PHARMACY #10422 GRESHAM OR	-31.92	f	09/28/2024,09/28/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-31.92	2024-09	5	ai	089b4954401aab8c8a620998133d2fba10aa1056687d6733e4a7fefd0c14f02e	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:30.131742-06	\N	0.80	f
154	1	8	2024-09-28	PAYPAL *ETSY, INC 4029357733 CA	-116.12	f	09/28/2024,09/28/2024,PAYPAL *ETSY, INC 4029357733 CA,Shopping,Sale,-116.12	2024-09	5	ai	b92fb8a278701b8ea18c303cd6f37248e9be23c6fef53e22365a91dfd4b05dd2	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:30.132149-06	\N	0.85	f
152	1	4	2024-09-29	ARCO #82211 AMPM GRESHAM OR	-50.16	f	09/29/2024,09/29/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-50.16	2024-09	5	ai	6ec18161eeeebe85a9d329415f8615a162b59c42f088b59f243a676c953fde78	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:30.133512-06	\N	0.90	f
459	1	10	2024-11-09	CVS/PHARMACY #10422 GRESHAM OR	-24.95	f	<TRNTYPE>DEBIT <DTPOSTED>20241109050000.000[-5:EST] <TRNAMT>-24.95 <FITID>2024110924492233491011 <NAME>CVS/PHARMACY #10422 GRESHAM OR	2024-11	13	ai	ad032c0d7a3ebebff38ba72e42f8828f4bb1cb9d804aabeafa4141507fa10ae0	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:14.419016-06	\N	0.90	f
185	1	3	2024-09-09	PANDA EXPRESS #1912 GRESHAM OR	-51.76	f	09/09/2024,09/10/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-51.76	2024-09	5	ai	c57c9160ce0b8933d9272591577f94f76647b84bde45083efc06045ce4718dd8	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
194	1	2	2024-09-03	FRED-MEYER #0651 GRESHAM OR	-144.38	f	09/03/2024,09/03/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-144.38	2024-09	5	ai	d006d8c49b1ff5686b47a11df9fafef98073d56236d7f8617273d0792557e779	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
186	1	2	2024-09-07	FRED-MEYER #0651 GRESHAM OR	-81.02	f	09/07/2024,09/08/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-81.02	2024-09	5	ai	eaa1407bc22bc0e342088861addf058aa64c1c71300d159de9026aef78172b33	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
200	2	1	2024-09-03	ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 6610023385	-188.42	f	09/03 ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 188.42 6,940.17\n6610023385	2024-09	6	ai	081e13d72a163cdeb0853c49306d287345e08f141b65904f7eb17863d0cfbc15	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:34.35337-06	\N	0.90	f
180	1	8	2024-09-12	THE HOME DEPOT #4012 GRESHAM OR	-40.48	f	09/12/2024,09/12/2024,THE HOME DEPOT #4012 GRESHAM OR,Shopping,Sale,-40.48	2024-09	5	ai	1391ae0000455fc4aad162ce9e8b402d13da1b7dd30e190854e0f687956a657d	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:34.890656-06	\N	0.80	f
197	1	4	2024-09-01	FRED-MEYER FUEL #0651 GRESHAM OR	-61.40	f	09/01/2024,09/01/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-61.40	2024-09	5	ai	db38ee1060287d1f87ff1b253bcf374f4bf69aaf16f631759d382e53cc07a5ad	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:21.798882-06	\N	0.90	f
198	1	2	2024-09-01	TRADER JOE S #145 PORTLAND OR	-183.38	f	09/01/2024,09/03/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-183.38	2024-09	5	ai	da07e27b7646481b7c29660783c35e40ccbb67d5e1a5c9a65b92d2d6e13a3d0a	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:21.810378-06	\N	0.95	f
204	2	4	2024-09-03	POS DEBIT 09/03 SHELL OIL 57442	-47.21	f	09/03 POS DEBIT 09/03 SHELL OIL 57442 47.21 6,624.89	2024-09	6	rule	7f571f07595a31bd6864c4ab09e1b6af87093848ece1e198b6ae2385d065d49d	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.967412-06	\N	\N	f
195	1	2	2024-09-02	WINCO FOODS #112 GRESHAM OR	-70.71	f	09/02/2024,09/04/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-70.71	2024-09	5	ai	bd0ed0e73f7e8f671ebd2d9909690b18044fe80a1e2387df5eb2653f96411274	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:21.810987-06	\N	0.95	f
193	1	3	2024-09-03	DOORDASH*BURGERVILLE #12	-43.21	f	09/03/2024,09/04/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-43.21	2024-09	5	ai	dee87f0f67eb47642242188db80598256a83a24ccd28c2ec9cd2538518f1f608	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:21.812123-06	\N	0.95	f
201	2	10	2024-09-03	ATM WITHDRAWAL 09/02 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-200.00	f	09/03 ATM WITHDRAWAL 09/02 MAPLE FEDERAL ATM #2210 2210 200.00 6,740.17\nMAIN ST FAIRVIEW OR	2024-09	6	ai	2b0f5c40cd1988b8e30b896be1fa2a4f4be022d72baab0f34dde244b67da1158	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:21.813737-06	\N	0.70	f
203	2	2	2024-09-03	DEBIT CARD PURCHASE 09/02 SAFEWAY #1544 FAIRVIEW OR	-33.73	f	09/03 DEBIT CARD PURCHASE 09/02 SAFEWAY #1544 FAIRVIEW OR 33.73 6,672.10	2024-09	6	ai	01ea31a10f25510b7a1cdc4c32216d9b70e91e0509ddd15a8a7ec5561538bd5d	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:21.814674-06	\N	0.95	f
192	1	8	2024-09-04	CHEWY.COM 800-672-4399 FL	-45.03	f	09/04/2024,09/04/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-45.03	2024-09	5	ai	ec2c80cd4d7e5e042886f52e82e55fb5ce7824e07e192b30b00f61eb93d5c969	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:21.816235-06	\N	0.90	f
190	1	8	2024-09-05	CHEWY.COM 800-672-4399 FL	-30.17	f	09/05/2024,09/05/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-30.17	2024-09	5	ai	0ef28d79d55fae110949ee1716777c03e6d4e584155e760e8b5960e851b7f8e4	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:21.817142-06	\N	0.90	f
191	1	3	2024-09-05	DOORDASH*THAI BASIL, FAIRVIEW OR	-25.93	f	09/05/2024,09/05/2024,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-25.93	2024-09	5	ai	936b12dea26abe616c6ac8b87a41acfbe3992e480c491d39b5f78a1d35f39327	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:21.81768-06	\N	0.95	f
189	1	8	2024-09-06	SQ *SMITH & SONS, LLC PORTLAND OR	-47.18	f	09/06/2024,09/08/2024,SQ *SMITH & SONS, LLC PORTLAND OR,Shopping,Sale,-47.18	2024-09	5	ai	cf29d83dfa4c0579ddb1ff60c5d14bdfdfaecc17d1d507a24903be2a37234a0a	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:21.819402-06	\N	0.80	f
187	1	10	2024-09-07	CVS/PHARMACY #10422 GRESHAM OR	-16.73	f	09/07/2024,09/08/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-16.73	2024-09	5	ai	c7451d9130a56fdfc46e568cf06b937b4f37a898a4ac8b2d3c409869b00bf046	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:48.018861-06	\N	0.85	f
188	1	4	2024-09-07	FRED-MEYER FUEL #0651 GRESHAM OR	-57.45	f	09/07/2024,09/07/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-57.45	2024-09	5	ai	ad2a508d5d596f07d0db34aebfa9b8b89fb678d04edabe0854dc7262f8a21e5d	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:48.019304-06	\N	0.95	f
183	1	4	2024-09-10	ARCO #82211 AMPM GRESHAM OR	-62.70	f	09/10/2024,09/12/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-62.70	2024-09	5	ai	700b435706fbd1bd78488d39968eda838717d0852d610aaf5336903cafe9f3b2	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:48.025197-06	\N	0.95	f
184	1	2	2024-09-10	WINCO FOODS #112 GRESHAM OR	-189.93	f	09/10/2024,09/11/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-189.93	2024-09	5	ai	7c3286e0c00d839de93912a627e79b88dbbf911d71d179abc67beb0cddc33a40	2026-10-16 14:34:51.858709-06	2026-10-16 14:35:48.025638-06	\N	0.95	f
182	1	4	2024-09-11	ARCO #82211 AMPM GRESHAM OR	-61.17	f	09/11/2024,09/13/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-61.17	2024-09	5	ai	dde582e35e35cc684a3b14a3b8a8c21b30a35134286f01f06cd07bee8ff0ce5f	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:12.192831-06	\N	0.90	f
179	1	8	2024-09-13	PAYPAL *ETSY, INC 4029357733 CA	-31.75	f	09/13/2024,09/13/2024,PAYPAL *ETSY, INC 4029357733 CA,Shopping,Sale,-31.75	2024-09	5	ai	a0d64338acec10837c7c437262f1444bd31f9bba899fe3aff8cc889170336c04	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:12.197262-06	\N	0.85	f
177	1	4	2024-09-14	ARCO #82211 AMPM GRESHAM OR	-50.44	f	09/14/2024,09/14/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-50.44	2024-09	5	ai	7a26fee4c332834f06258628635b31203640c6bf61880f7a85f9b684f774dc67	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:12.197929-06	\N	0.90	f
176	1	8	2024-09-15	CHEWY.COM 800-672-4399 FL	-131.55	f	09/15/2024,09/16/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-131.55	2024-09	5	ai	71df38f67e42f40f13313b65b601d86611ca94eb503d107408593945ca99f8e7	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:12.199535-06	\N	0.90	f
175	1	4	2024-09-16	LYFT *RIDE FRI 6PM, SAN FRANCISCO CA	-9.71	f	09/16/2024,09/18/2024,LYFT *RIDE FRI 6PM, SAN FRANCISCO CA,Travel,Sale,-9.71	2024-09	5	ai	3c72a2c4699d594f80c36a20781355c77e4efbb1509e8b402b44bb889bcb41a3	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:12.199988-06	\N	0.95	f
594	1	2	2024-12-31	WINCO FOODS #112 GRESHAM OR	-115.52	f	12/31/2024,12/31/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-115.52	2024-12	17	ai	9bc104e3ab0dfae13521a6bbee1bd96420b44d7b5e4e2cd5d90dab7710e7b50a	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:50.48388-06	\N	0.95	f
209	2	3	2024-09-06	POS DEBIT 09/05 SQ *CASCADE ROASTERS FAIRVIEW OR	-10.88	f	09/06 POS DEBIT 09/05 SQ *CASCADE ROASTERS FAIRVIEW OR 10.88 8,738.22	2024-09	6	ai	09953943014d748c6eb371c467b6289de56130d995fdb7be0527f27fe5e0b816	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
207	2	2	2024-09-05	DEBIT CARD PURCHASE 09/05 SAFEWAY #1544 FAIRVIEW OR	-63.33	f	09/05 DEBIT CARD PURCHASE 09/05 SAFEWAY #1544 FAIRVIEW OR 63.33 5,902.95	2024-09	6	ai	814c2afb679f09c020eaf072ace49a7178312d5a2d4e2fe728fd508a5ba8cbc4	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:21.818196-06	\N	0.95	f
205	2	2	2024-09-04	DEBIT CARD PURCHASE 09/04 FRED-MEYER #0651 GRESHAM OR	-158.61	f	09/04 DEBIT CARD PURCHASE 09/04 FRED-MEYER #0651 GRESHAM 158.61 6,466.28\nOR	2024-09	6	ai	337440bda4d85641c58437681c354f3e1c2bfb058cf51c3612c4085a5b90ffbe	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
220	2	10	2024-09-11	POS DEBIT 09/11 WALGREENS #06124 FAIRVIEW OR	-11.41	f	09/11 POS DEBIT 09/11 WALGREENS #06124 FAIRVIEW OR 11.41 9,428.68	2024-09	6	ai	8eb3367054893683bd02eff42ea3a71359a6b9c61c8c912ddbb9d273e0740101	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:35.549706-06	\N	0.85	f
210	2	4	2024-09-08	POS DEBIT 09/08 CHEVRON 0098812 FAIRVIEW OR	-40.15	f	09/08 POS DEBIT 09/08 CHEVRON 0098812 FAIRVIEW OR 40.15 8,698.07	2024-09	6	ai	c4b8e3dd7fb77b2d16cc60ad26e451435d8df24f09e96d93fca08741d1d62b5e	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:48.019703-06	\N	0.95	f
212	2	10	2024-09-09	CHECK #1042	-160.00	f	09/09 CHECK #1042 160.00 8,360.64	2024-09	6	ai	0240eea1bd73333c233405715ac0b7a8a662c50435e9c8a5ccd130dbb1ae6abf	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:48.021083-06	\N	0.70	f
213	2	3	2024-09-09	POS DEBIT 09/06 TST* LUIGIS TRATTORIA FAIRVIEW OR	-12.63	f	09/09 POS DEBIT 09/06 TST* LUIGIS TRATTORIA FAIRVIEW OR 12.63 8,348.01	2024-09	6	ai	92018c14c12286cc599a7a2eae6125f39ae6f540c4c5831ae171d0a0d74ee1c2	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:48.021509-06	\N	0.95	f
211	2	6	2024-09-09	ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 9300012231	-177.43	f	09/09 ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 177.43 8,520.64\n9300012231	2024-09	6	rule	3b159227c9196a13c52ec56635c9ee1df617263c0e09c1b5b5db7197032a002c	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.96968-06	\N	\N	f
224	2	7	2024-09-16	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	09/16 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 11,077.15\n5520017784	2024-09	6	rule	b7080a4a2fa24b216114e8379957b78f64a407af88b14350d8207d6739d5c8c4	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.971204-06	\N	\N	f
227	2	4	2024-09-16	POS DEBIT 09/15 SHELL OIL 57442	-63.16	f	09/16 POS DEBIT 09/15 SHELL OIL 57442 63.16 10,956.66	2024-09	6	rule	e216ab37942fbd56c985859cbce8883b95e1a376e7e5fe8d1ea1d86e5b384ea1	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.971519-06	\N	\N	f
230	2	4	2024-09-17	POS DEBIT 09/16 SHELL OIL 57442	-65.85	f	09/17 POS DEBIT 09/16 SHELL OIL 57442 65.85 10,610.82	2024-09	6	rule	f7ef6f0f0317b8bbb689b2a204ce5cf0a5ea539d73fb13d5d64c7a60eb73acfa	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.971848-06	\N	\N	f
214	2	4	2024-09-09	POS DEBIT 09/07 ARCO #82211 AMPM	-47.04	f	09/09 POS DEBIT 09/07 ARCO #82211 AMPM 47.04 8,300.97	2024-09	6	ai	518a35d7e94c7465fffd46219be64abdc7b1869ba8341e34b580f7a7361b1f0a	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:48.021925-06	\N	0.95	f
206	2	9	2024-09-05	ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS XXXXXX4471 REF #IB0RTV5F1	-500.00	f	09/05 ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS 500.00 5,966.28\nXXXXXX4471 REF #IB0RTV5F1	2024-09	6	transfer	1af87acff92df969040d7999513d0d88d3ac061c8414ea54686e8bbb24522c61	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.980222-06	256	\N	f
215	2	3	2024-09-09	DEBIT CARD PURCHASE 09/07 TST* LUIGIS TRATTORIA FAIRVIEW OR	-47.01	f	09/09 DEBIT CARD PURCHASE 09/07 TST* LUIGIS TRATTORIA 47.01 8,253.96\nFAIRVIEW OR	2024-09	6	ai	019e5042f852481e9a1b2881e06fa9e501779319283571fd076303d6f7a7e6d6	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:48.022468-06	\N	0.95	f
216	2	2	2024-09-09	DEBIT CARD PURCHASE 09/08 WINCO FOODS #112 GRESHAM OR	-114.75	f	09/09 DEBIT CARD PURCHASE 09/08 WINCO FOODS #112 GRESHAM 114.75 8,139.21\nOR	2024-09	6	ai	af479dd28bcc7f00879d9f2b6b1b44786561ff63aa2b5a335935cf848fdb0a15	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:48.02301-06	\N	0.95	f
218	2	7	2024-09-10	ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 8830021147	1350.00	f	09/10 ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 1,350.00 9,479.23\n8830021147	2024-09	6	ai	dbbd291ab1df7f32ce39937bf5a33744535bfc59764586cc8e32f9dc8184666e	2026-10-16 14:34:51.912883-06	2026-10-16 14:35:48.026069-06	\N	0.95	f
219	2	3	2024-09-11	POS DEBIT 09/10 TST* LUIGIS TRATTORIA FAIRVIEW OR	-39.14	f	09/11 POS DEBIT 09/10 TST* LUIGIS TRATTORIA FAIRVIEW OR 39.14 9,440.09	2024-09	6	ai	6eb62435886cbf6caa09f21578899044135636f89219256fca55b15ce3dab8ff	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:12.193762-06	\N	0.95	f
221	2	6	2024-09-12	ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 3300298811	-81.04	f	09/12 ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 81.04 9,347.64\n3300298811	2024-09	6	ai	17c29528172ed09747ba5ae264d15812efc32b2735abb426f67827efc75c04fc	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:12.196455-06	\N	0.95	f
222	2	2	2024-09-12	DEBIT CARD PURCHASE 09/12 GROCERY OUTLET #388 GRESHAM OR	-39.30	f	09/12 DEBIT CARD PURCHASE 09/12 GROCERY OUTLET #388 39.30 9,308.34\nGRESHAM OR	2024-09	6	ai	e2ce81662bbd15dc9cac928bdeb2de8e7ba7a2e44268afab8cf5037bdeccd9ed	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:12.196858-06	\N	0.95	f
223	2	2	2024-09-14	POS DEBIT 09/14 SAFEWAY #1544 FAIRVIEW OR	-143.59	f	09/14 POS DEBIT 09/14 SAFEWAY #1544 FAIRVIEW OR 143.59 9,164.75	2024-09	6	ai	fbfae6f1e44f34988c430544fd5e87793ea09f7453a2f212d8028bbfc906080a	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:12.198737-06	\N	0.95	f
225	2	3	2024-09-16	DEBIT CARD PURCHASE 09/13 CHIPOTLE 2291 GRESHAM OR	-10.54	f	09/16 DEBIT CARD PURCHASE 09/13 CHIPOTLE 2291 GRESHAM OR 10.54 11,066.61	2024-09	6	ai	96c351113b980bdcbe4071a2d651657f895cccb56702e5d722684102fe8f3fd1	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:12.20041-06	\N	0.95	f
226	2	3	2024-09-16	POS DEBIT 09/14 SUBWAY 00412290 GRESHAM OR	-46.79	f	09/16 POS DEBIT 09/14 SUBWAY 00412290 GRESHAM OR 46.79 11,019.82	2024-09	6	ai	c8370527f724081c562b437a5075fa4dfd20b6a3721b163a7746ee259524f360	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:12.200818-06	\N	0.95	f
174	1	8	2024-09-17	PAYPAL *ETSY, INC 4029357733 CA	-103.62	f	09/17/2024,09/19/2024,PAYPAL *ETSY, INC 4029357733 CA,Shopping,Sale,-103.62	2024-09	5	ai	7bcd643e20cbad76ec3cf87f871a347e24ff87c8be7df6f73ada5376a7c26e8d	2026-10-16 14:34:51.858709-06	2026-10-16 14:36:38.119355-06	\N	0.90	f
229	2	6	2024-09-17	RIVERNET BROADBAND AUTOPAY 800-555-0142	-79.99	f	09/17 RIVERNET BROADBAND AUTOPAY 800-555-0142 79.99 10,676.67	2024-09	6	ai	4a171f86542986616a6ed5ccbe7247e27cb876f7033869a5f14b66a617af9c44	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:38.119931-06	\N	0.95	f
231	2	10	2024-09-17	DEBIT CARD PURCHASE 09/16 RITE AID STORE 5411 GRESHAM OR	-33.09	f	09/17 DEBIT CARD PURCHASE 09/16 RITE AID STORE 5411 33.09 10,577.73\nGRESHAM OR	2024-09	6	ai	b2a92c69d12a1c770352a21248e612484a9daee81c4dcedfeb9b65bae0c0a158	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:38.12038-06	\N	0.85	f
313	1	8	2024-10-25	CHEWY.COM 800-672-4399 FL	-112.16	f	10/25/2024,10/25/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-112.16	2024-10	9	ai	1bc579646c1e018ccd3ef2648cd6572ea5c080012ab68604ee19f6d2ef89063f	2026-10-16 14:37:30.463707-06	2026-10-16 14:39:44.757632-06	\N	0.90	f
557	4	2	2024-11-10	NEW SEASONS MARKET FAIRVIEW OR	-202.90	f	11/10 11/12 NEW SEASONS MARKET FAIRVIEW OR 202.90	2024-11	16	ai	50bdba43e1032e6727e174f01be0389f023643faeaf7cb1588003d14a5c377af	2026-10-16 14:40:14.348274-06	2026-10-16 14:41:14.420862-06	\N	0.95	f
260	4	3	2024-09-03	TST* PINE STATE BISCUITS PORTLAND OR	-89.66	f	09/03 09/05 TST* PINE STATE BISCUITS PORTLAND OR 89.66	2024-09	8	ai	3837f10cf271c6bf30bc8a77b5486ddf34b46fc033c548243fd716238ac5e4b2	2026-10-16 14:34:51.952053-06	2026-10-16 14:49:31.123945-06	\N	0.95	f
235	2	3	2024-09-18	POS DEBIT 09/18 MCDONALD'S F21877 FAIRVIEW OR	-18.91	f	09/18 POS DEBIT 09/18 MCDONALD'S F21877 FAIRVIEW OR 18.91 10,496.64	2024-09	6	ai	57019725b28f66deacd6e100c1e4102375c3d1443d8f4a5717079641e03981a2	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:31.771845-06	\N	0.95	f
259	4	2	2024-09-03	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-10.52	f	09/03 09/05 SQ *BLUE BOTTLE COFFEE OAKLAND CA 10.52	2024-09	8	ai	5eaeb4e252d636d52a826ff30453352088a0027b91c0438938b87939943f8ef5	2026-10-16 14:34:51.952053-06	2026-10-16 14:35:21.815066-06	\N	0.90	f
241	2	3	2024-09-23	DEBIT CARD PURCHASE 09/22 SUBWAY 00412290 GRESHAM OR	-47.84	f	09/23 DEBIT CARD PURCHASE 09/22 SUBWAY 00412290 GRESHAM 47.84 9,156.58\nOR	2024-09	6	ai	873da8aff0a6ea40c50335e8679d5daaa2f56a502150f6b8367541f01873a9ba	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:31.934296-06	\N	0.98	f
247	2	3	2024-09-27	DEBIT CARD PURCHASE 09/26 SUBWAY 00412290 GRESHAM OR	-37.77	f	09/27 DEBIT CARD PURCHASE 09/26 SUBWAY 00412290 GRESHAM 37.77 6,216.21\nOR	2024-09	6	ai	232186876ece94fdae727501d5d88f0c345bde303eed4ace1a5a3423ab9b05cd	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:31.934296-06	\N	0.90	f
261	4	3	2024-09-05	SQ *TACO PEDRO GRESHAM OR	-48.12	f	09/05 09/05 SQ *TACO PEDRO GRESHAM OR 48.12	2024-09	8	ai	366d0c51bddbf47297e63bc634ee3d3075eb34ee6f17b9a12ed9d970566a082f	2026-10-16 14:34:51.952053-06	2026-10-16 14:35:21.818695-06	\N	0.95	f
233	2	8	2024-09-18	DEBIT CARD PURCHASE 09/17 TARGET T-1544 GRESHAM OR	-47.03	f	09/18 DEBIT CARD PURCHASE 09/17 TARGET T-1544 GRESHAM OR 47.03 10,523.51	2024-09	6	ai	bd75c8e7e63b7507d4dee5ee9cfa71da63c011ec10d8f86176a4aa78bf57ba5e	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:38.123836-06	\N	0.90	f
236	2	3	2024-09-19	POS DEBIT 09/19 CHIPOTLE 2291 GRESHAM OR	-12.33	f	09/19 POS DEBIT 09/19 CHIPOTLE 2291 GRESHAM OR 12.33 10,484.31	2024-09	6	ai	718f09f44470f07296664b8dfbc0834231cd8a577d109681e78dbf7a3fc5ce33	2026-10-16 14:34:51.912883-06	2026-10-16 14:36:38.126202-06	\N	0.95	f
166	1	10	2024-09-21	WALGREENS #06124 FAIRVIEW OR	-24.32	f	09/21/2024,09/23/2024,WALGREENS #06124 FAIRVIEW OR,Health & Wellness,Sale,-24.32	2024-09	5	ai	0e383cabb1a2defab53cf794422ffc4496ad7a2855da4ba63fe6b736994db69f	2026-10-16 14:34:51.858709-06	2026-10-16 14:37:04.109693-06	\N	0.80	f
239	2	2	2024-09-21	DEBIT CARD PURCHASE 09/21 GROCERY OUTLET #388 GRESHAM OR	-97.51	f	09/21 DEBIT CARD PURCHASE 09/21 GROCERY OUTLET #388 97.51 9,347.09\nGRESHAM OR	2024-09	6	ai	ef89e36747022f0ee48a264b4e1559b61a63e9cee0a81f26c6d52a6117bbbb4e	2026-10-16 14:34:51.912883-06	2026-10-16 14:37:04.110203-06	\N	0.95	f
242	2	4	2024-09-23	POS DEBIT 09/22 SHELL OIL 57442	-62.31	f	09/23 POS DEBIT 09/22 SHELL OIL 57442 62.31 9,094.27	2024-09	6	rule	98a95f1fa48c4281e6f2bfa833dacdf74129327b5f8512e86343693a07b6b58f	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.972658-06	\N	\N	f
246	2	4	2024-09-26	POS DEBIT 09/25 SHELL OIL 57442	-37.45	f	09/26 POS DEBIT 09/25 SHELL OIL 57442 37.45 6,253.98	2024-09	6	rule	e30fde339c2c4cc905abeaa5680e74332bb9e09d95c6b0afc4573fbcd3bb66c9	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.973588-06	\N	\N	f
249	2	4	2024-09-27	POS DEBIT 09/27 SHELL OIL 57442	-43.38	f	09/27 POS DEBIT 09/27 SHELL OIL 57442 43.38 6,132.56	2024-09	6	rule	2ab8dc7347bfeca4de34294940041a849aa5185732d5e6bdc9fce26cd7355a12	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.974208-06	\N	\N	f
251	2	7	2024-09-30	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	09/30 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 7,947.74\n5520017784	2024-09	6	rule	c4da63023b66fa4f8eacaf1a3bd53f858672fb86e14ca219fefeff807d60b5f2	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.97512-06	\N	\N	f
240	2	6	2024-09-23	ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190	-142.67	f	09/23 ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190 142.67 9,204.42	2024-09	6	ai	f4196378be44dff9782597173c80b0cd48254bf5cf9b4e9bea98f8caa972f2e5	2026-10-16 14:34:51.912883-06	2026-10-16 14:37:04.114381-06	\N	0.95	f
256	3	9	2024-09-06	ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290	500.00	f	2024-09-06 ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290 500.00	2024-09	7	transfer	5ecd9bcedecd3429e202a5699b4f6406ecb62370c2dbcccc03986b53d5a33e6d	2026-10-16 14:34:51.928905-06	2026-10-16 14:34:51.980222-06	206	\N	f
244	2	9	2024-09-24	HARBOR CARD AUTOPAY PPD ID: 7781000231	-2607.16	f	09/24 HARBOR CARD AUTOPAY PPD ID: 7781000231 2,607.16 6,453.62	2024-09	6	transfer	a7719adf7b977c847a2c13045bb8de52206e90af0281f6c7f32df6c7cdf65acb	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.981328-06	158	\N	f
243	2	2	2024-09-23	DEBIT CARD PURCHASE 09/23 SAFEWAY #1544 FAIRVIEW OR	-33.49	f	09/23 DEBIT CARD PURCHASE 09/23 SAFEWAY #1544 FAIRVIEW OR 33.49 9,060.78	2024-09	6	ai	48b0eaa132e0a0cdebbbd86e04d95ea57d0315ac1c7eaecc9b4809d7bc6018bd	2026-10-16 14:34:51.912883-06	2026-10-16 14:37:04.115455-06	\N	0.95	f
245	2	2	2024-09-25	DEBIT CARD PURCHASE 09/24 SAFEWAY #1544 FAIRVIEW OR	-162.19	f	09/25 DEBIT CARD PURCHASE 09/24 SAFEWAY #1544 FAIRVIEW OR 162.19 6,291.43	2024-09	6	ai	8ea797c3266325250fb7b80c01136497bb5fbc70525b119e12b3da69e9b6893b	2026-10-16 14:34:51.912883-06	2026-10-16 14:37:04.117586-06	\N	0.95	f
238	2	9	2024-09-20	ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# J5G8CNSM	-3885.86	f	09/20 ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# 3,885.86 9,444.60\nJ5G8CNSM	2024-09	6	transfer	19cf26af75841327d50d62873437ff152b020d32a83496c342c7057a92f9d675	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.982763-06	258	\N	f
248	2	10	2024-09-27	DEBIT CARD PURCHASE 09/26 WALGREENS #06124 FAIRVIEW OR	-40.27	f	09/27 DEBIT CARD PURCHASE 09/26 WALGREENS #06124 FAIRVIEW 40.27 6,175.94\nOR	2024-09	6	ai	2983afa5da7311baa4ab13d7c86b9d7c7e2b01df9af44acb3889e02e3a678494	2026-10-16 14:34:51.912883-06	2026-10-16 14:37:30.131317-06	\N	0.85	f
250	2	2	2024-09-28	DEBIT CARD PURCHASE 09/28 GROCERY OUTLET #388 GRESHAM OR	-97.22	f	09/28 DEBIT CARD PURCHASE 09/28 GROCERY OUTLET #388 97.22 6,035.34\nGRESHAM OR	2024-09	6	ai	5b2cb6a72905323f3e429f06d34b9a2459d803e7a50c6dddbf6c1f409a40f17e	2026-10-16 14:34:51.912883-06	2026-10-16 14:37:30.13269-06	\N	0.90	f
252	2	7	2024-09-30	INTEREST PAYMENT	0.56	f	09/30 INTEREST PAYMENT 0.56 7,948.30	2024-09	6	ai	282dfc55c9faa8ad5bb0b4cb19a57871de40bd124d5abd72bc81f284dcd290ff	2026-10-16 14:34:51.912883-06	2026-10-16 14:37:30.134288-06	\N	0.95	f
255	2	10	2024-09-30	POS DEBIT 09/29 WALGREENS #06124 FAIRVIEW OR	-47.86	f	09/30 POS DEBIT 09/29 WALGREENS #06124 FAIRVIEW OR 47.86 7,880.22	2024-09	6	ai	b88f9c2c092e24a76b2eb2e7918281ec228a67adda74cda0c2b75fa471dabcf2	2026-10-16 14:34:51.912883-06	2026-10-16 14:37:30.135636-06	\N	0.85	f
257	3	7	2024-09-30	INTEREST PAYMENT	5.43	f	2024-09-30 INTEREST PAYMENT 5.43	2024-09	7	ai	87ddb9ddf4086cb5eff96730e7bbcbb6c089fc50a47d83ff54eb79a6c9997a9c	2026-10-16 14:34:51.928905-06	2026-10-16 14:37:30.136116-06	\N	0.95	f
263	4	8	2024-09-06	REI #57 PORTLAND OR	-90.54	f	09/06 09/06 REI #57 PORTLAND OR 90.54	2024-09	8	ai	6a88567412f2761fe8c37a3851d3dba074d532acf00045735f4dad69aac53191	2026-10-16 14:34:51.952053-06	2026-10-16 14:35:48.01163-06	\N	0.90	f
570	4	4	2024-11-20	COSTCO GAS #0681 WOOD VILLAGE OR	-62.20	f	11/20 11/21 COSTCO GAS #0681 WOOD VILLAGE OR 62.20	2024-11	16	ai	e72150f3ade50b2c384ab13e4bc0817721e341d734d05f03dcaf5db7541aa9fb	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:06.332861-06	\N	0.90	f
270	4	3	2024-09-10	SQ *CASCADE ROASTERS FAIRVIEW OR	-9.36	f	09/10 09/10 SQ *CASCADE ROASTERS FAIRVIEW OR 9.36	2024-09	8	ai	6b865a90d36dcf3a44f560d5ffde2dcfe44be4dbc19277d07cbe3cf454ad9de6	2026-10-16 14:34:51.952053-06	2026-10-16 14:49:31.054101-06	\N	0.95	f
264	4	3	2024-09-08	PIZZICATO #14 PORTLAND OR	-50.27	f	09/08 09/08 PIZZICATO #14 PORTLAND OR 50.27	2024-09	8	ai	54b438d38f76bed47c93a074c9f78040c4fa4ccde2674a7929ea1957121f90d8	2026-10-16 14:34:51.952053-06	2026-10-16 14:35:48.020124-06	\N	0.95	f
267	4	5	2024-09-09	SPOTIFY USA 877-778-1161 NY	-16.99	f	09/09 09/09 SPOTIFY USA 877-778-1161 NY 16.99	2024-09	8	ai	9db8b434700a89060221c402a28c7f92f1376da43e2fd775209059e3160d2f3f	2026-10-16 14:34:51.952053-06	2026-10-16 14:35:48.023942-06	\N	0.95	f
271	4	3	2024-09-10	SQ *CASCADE ROASTERS FAIRVIEW OR	-13.23	f	09/10 09/11 SQ *CASCADE ROASTERS FAIRVIEW OR 13.23	2024-09	8	ai	8a8de770ac62a0c047b806a2df460107bbddb0fcb815972c0102c244d4b9e5ac	2026-10-16 14:34:51.952053-06	2026-10-16 14:49:31.054101-06	\N	0.95	f
272	4	2	2024-09-11	SAFEWAY #1544 FAIRVIEW OR	-47.36	f	09/11 09/11 SAFEWAY #1544 FAIRVIEW OR 47.36	2024-09	8	ai	a85d25880415f1d624c8ddf5c7c605542a49790b21de936d2438a8c9a8884658	2026-10-16 14:34:51.952053-06	2026-10-16 14:36:12.194802-06	\N	0.90	f
276	4	2	2024-09-14	NEW SEASONS MARKET FAIRVIEW OR	-248.32	f	09/14 09/16 NEW SEASONS MARKET FAIRVIEW OR 248.32	2024-09	8	ai	837f0547bb940061ebc85cfbb19bc530eebbcd3ccfa73f1b527e6a74b3cc0b00	2026-10-16 14:34:51.952053-06	2026-10-16 14:36:12.199134-06	\N	0.95	f
278	4	2	2024-09-16	SAFEWAY #1544 FAIRVIEW OR	-123.26	f	09/16 09/18 SAFEWAY #1544 FAIRVIEW OR 123.26	2024-09	8	ai	053147bcdd5642fddae5b3454f7e81ea0fcb3fa624d67f41fc3d184c33a6fd76	2026-10-16 14:34:51.952053-06	2026-10-16 14:36:12.201657-06	\N	0.90	f
277	4	3	2024-09-17	TST* LUIGIS TRATTORIA FAIRVIEW OR	-23.42	f	09/17 09/17 TST* LUIGIS TRATTORIA FAIRVIEW OR 23.42	2024-09	8	ai	c00cdc7b6579b4ccb75a8f895c659c9f4c59c0db5478ecf7d408eb65eaa06249	2026-10-16 14:34:51.952053-06	2026-10-16 14:36:38.121223-06	\N	0.95	f
279	4	2	2024-09-17	NEW SEASONS MARKET FAIRVIEW OR	-221.56	f	09/17 09/18 NEW SEASONS MARKET FAIRVIEW OR 221.56	2024-09	8	ai	1e6e0c99e90ee23334dd07ed143a346b5cc9c8ebc6b9f7a5ef3082a6f233a964	2026-10-16 14:34:51.952053-06	2026-10-16 14:36:38.121687-06	\N	0.95	f
266	4	2	2024-09-07	COSTCO WHSE #0681 WOOD VILLAGE OR	-163.31	f	09/07 09/09 COSTCO WHSE #0681 WOOD VILLAGE OR 163.31	2024-09	8	rule	6038fa60d3661cd414d2c1390b854fd15408db45cd6d0966cf209f742ec1c4e4	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.968609-06	\N	\N	f
265	4	2	2024-09-08	COSTCO WHSE #0681 WOOD VILLAGE OR	-201.78	f	09/08 09/08 COSTCO WHSE #0681 WOOD VILLAGE OR 201.78	2024-09	8	rule	a457df085fd71c71c253e087e289d61d04b0a2d35a5f8093dd394ce9001466e7	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.969065-06	\N	\N	f
269	4	8	2024-09-08	AMZN Mktp US*G4BKDT Amzn.com/bill WA	-61.46	f	09/08 09/10 AMZN Mktp US*G4BKDT Amzn.com/bill WA 61.46	2024-09	8	rule	5fc097d1674ef25b3936a659f681ae481e43a828455c059810da09c92342a649	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.969371-06	\N	\N	f
274	4	2	2024-09-13	COSTCO WHSE #0681 WOOD VILLAGE OR	-175.27	f	09/13 09/14 COSTCO WHSE #0681 WOOD VILLAGE OR 175.27	2024-09	8	rule	504bb2685ee994d054aba9a1240cf45cd1faa3861382579d51ef52cdd1b171c4	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.970147-06	\N	\N	f
275	4	5	2024-09-15	NETFLIX.COM 866-579-7172 CA	-22.99	f	09/15 09/15 NETFLIX.COM 866-579-7172 CA 22.99	2024-09	8	rule	76ca06c12394ff992640dbbd70cbb2e0d3560ef175509bf0b8a649cd558cfa63	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.970474-06	\N	\N	f
287	4	2	2024-09-23	COSTCO WHSE #0681 WOOD VILLAGE OR	-259.89	f	09/23 09/24 COSTCO WHSE #0681 WOOD VILLAGE OR 259.89	2024-09	8	rule	a8ae1eabfb4eb4fd8ed5467316a096118ddd025bdd4432f79d1cb079b8eeac36	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.972967-06	\N	\N	f
290	4	4	2024-09-24	SHELL OIL 57442110021 FAIRVIEW OR	-54.23	f	09/24 09/26 SHELL OIL 57442110021 FAIRVIEW OR 54.23	2024-09	8	rule	da3c4f2b0372ed2d9f13b54c080c49b472a1536aa318b66586cd0ab39d460539	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.973286-06	\N	\N	f
291	4	8	2024-09-26	AMZN Mktp US*HNHUYN Amzn.com/bill WA	-49.42	f	09/26 09/26 AMZN Mktp US*HNHUYN Amzn.com/bill WA 49.42	2024-09	8	rule	a474ac565996d694d11be006e4a322526fa3191f76f598debbf9e9ac870a46a5	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.973893-06	\N	\N	f
293	4	8	2024-09-27	AMZN Mktp US*66KYZD Amzn.com/bill WA	-22.45	f	09/27 09/29 AMZN Mktp US*66KYZD Amzn.com/bill WA 22.45	2024-09	8	rule	c009ae3a8340c483a3de0b63d7bce0d0448e97ab94395b2ab29a5d3e7a367a2a	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.974498-06	\N	\N	f
294	4	8	2024-09-28	AMZN Mktp US*RYW4M6 Amzn.com/bill WA	-56.72	f	09/28 09/29 AMZN Mktp US*RYW4M6 Amzn.com/bill WA 56.72	2024-09	8	rule	75fcb52260eb1ac34dd5657d851cdd8aaaf432b2387d05e533ba4c35d003174b	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.974813-06	\N	\N	f
280	4	3	2024-09-17	SQ *TACO PEDRO GRESHAM OR	-63.91	f	09/17 09/18 SQ *TACO PEDRO GRESHAM OR 63.91	2024-09	8	ai	6e33cf6c98a08cc4129a0b5eab5cd910c3050e315a6694041a04650a7f30f341	2026-10-16 14:34:51.952053-06	2026-10-16 14:36:38.122428-06	\N	0.95	f
281	4	2	2024-09-18	NEW SEASONS MARKET FAIRVIEW OR	-97.90	f	09/18 09/18 NEW SEASONS MARKET FAIRVIEW OR 97.90	2024-09	8	ai	39d1e866fbcb311c33b81bfb5810b6e92978f48a08966ff0f6e14430ad642fbf	2026-10-16 14:34:51.952053-06	2026-10-16 14:36:38.125206-06	\N	0.95	f
282	4	2	2024-09-19	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-7.22	f	09/19 09/20 SQ *BLUE BOTTLE COFFEE OAKLAND CA 7.22	2024-09	8	ai	ebe054a0d6a58137c0413dbd0228d2be4adf3efd52bffe71436966b9a7ca1403	2026-10-16 14:34:51.952053-06	2026-10-16 14:36:38.126763-06	\N	0.95	f
283	4	2	2024-09-19	SAFEWAY #1544 FAIRVIEW OR	-158.11	f	09/19 09/20 SAFEWAY #1544 FAIRVIEW OR 158.11	2024-09	8	ai	4441f71763db2667f0b7bf1da4a4ab0864198384714833f24b955da224aac92a	2026-10-16 14:34:51.952053-06	2026-10-16 14:36:38.127305-06	\N	0.95	f
284	4	3	2024-09-20	SQ *TACO PEDRO GRESHAM OR	-67.85	f	09/20 09/21 SQ *TACO PEDRO GRESHAM OR 67.85	2024-09	8	ai	b79181cbcff34f2b438803fd980a0cf336f32c0292f0a2fc2b6de0f76b872a70	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:04.107674-06	\N	0.98	f
285	4	5	2024-09-21	DISNEY PLUS 888-905-7888 CA	-13.99	f	09/21 09/22 DISNEY PLUS 888-905-7888 CA 13.99	2024-09	8	ai	3c862f3facf85f023e5462479ef910b9df7eec4036380a6fd4093152fa298d9c	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:04.110704-06	\N	0.98	f
286	4	2	2024-09-22	NEW SEASONS MARKET FAIRVIEW OR	-189.62	f	09/22 09/22 NEW SEASONS MARKET FAIRVIEW OR 189.62	2024-09	8	ai	65d09bc6131eca0bd3fa8966132f05912b36152a3e05251dca44b200bbccca56	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:04.112735-06	\N	0.95	f
289	4	2	2024-09-23	NEW SEASONS MARKET FAIRVIEW OR	-243.70	f	09/23 09/25 NEW SEASONS MARKET FAIRVIEW OR 243.70	2024-09	8	ai	d6ec80cb1d82bfec43f18c9aa79805a80d573ea7d245710f439317339a543d83	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:04.115965-06	\N	0.95	f
292	4	3	2024-09-28	PIZZICATO #14 PORTLAND OR	-30.25	f	09/28 09/28 PIZZICATO #14 PORTLAND OR 30.25	2024-09	8	ai	1a07975d24f2fc1b8b10bfd86bea80d90a16cadac92ba375d08c658d0a4bd136	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:30.133115-06	\N	0.95	f
295	4	2	2024-09-29	SAFEWAY #1544 FAIRVIEW OR	-226.33	f	09/29 09/29 SAFEWAY #1544 FAIRVIEW OR 226.33	2024-09	8	ai	3885b0faa3dd0d0c68e82158e3ac38c37e544585b875b297cf6020446373abb3	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:30.133902-06	\N	0.90	f
308	1	2	2024-10-27	WINCO FOODS #112 GRESHAM OR	-174.62	f	10/27/2024,10/29/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-174.62	2024-10	9	ai	6f4a658bde25e6eb096d84a8d4fbd441163954017136cd81be23a982c042544d	2026-10-16 14:37:30.463707-06	2026-10-16 14:39:44.761046-06	\N	0.95	f
309	1	8	2024-10-27	SQ *SMITH & SONS, LLC PORTLAND OR	-130.34	f	10/27/2024,10/28/2024,SQ *SMITH & SONS, LLC PORTLAND OR,Shopping,Sale,-130.34	2024-10	9	ai	5364ccabb3c6997ec30af8d0a38416570c865d0cbe063a881ff344ccb137612b	2026-10-16 14:37:30.463707-06	2026-10-16 14:40:10.893791-06	\N	0.85	f
307	1	4	2024-10-29	LYFT *RIDE FRI 7PM, SAN FRANCISCO CA	-12.08	f	10/29/2024,10/31/2024,LYFT *RIDE FRI 7PM, SAN FRANCISCO CA,Travel,Sale,-12.08	2024-10	9	ai	e80bfa38a36fd7c399ae4e78050c175280c1ad991ebc60c2005eed97c8de064b	2026-10-16 14:37:30.463707-06	2026-10-16 14:40:10.897953-06	\N	0.95	f
305	1	2	2024-10-30	FRED-MEYER #0651 GRESHAM OR	-122.95	f	10/30/2024,11/01/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-122.95	2024-10	9	ai	63ea51a8fc952318e1fe983f9df20d3c0dcc938d6dfc903db6d19ce279748ccb	2026-10-16 14:37:30.463707-06	2026-10-16 14:40:10.899209-06	\N	0.90	f
199	2	1	2024-09-03	ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 4417730021	-2385.00	f	09/03 ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 2,385.00 7,128.59\n4417730021	2024-09	6	rule	ebb448fbfaad273513b9e8adf805dbfc93cae6f279b96b75a04e032a7b206117	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.966863-06	\N	\N	f
262	4	2	2024-09-05	COSTCO WHSE #0681 WOOD VILLAGE OR	-219.90	f	09/05 09/05 COSTCO WHSE #0681 WOOD VILLAGE OR 219.90	2024-09	8	rule	0a105b608ee378932ebbb5097bff735e433c930e0ab7b47d0d8cea08a9c3b6f8	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.967892-06	\N	\N	f
208	2	7	2024-09-06	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	09/06 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 8,749.10\n9100234517	2024-09	6	rule	080b92a8e13928d8df51da9a9978229db527e59daaccb88d75a4938121e55a4c	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.968241-06	\N	\N	f
237	2	7	2024-09-20	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	09/20 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 13,330.46\n9100234517	2024-09	6	rule	21c307c685ff2f1269b33f79d613f507262c85441e35aebabf5520ea0a8dde01	2026-10-16 14:34:51.912883-06	2026-10-16 14:34:51.97226-06	\N	\N	f
296	4	8	2024-09-30	AMZN Mktp US*GSH4K6 Amzn.com/bill WA	-89.40	f	09/30 10/01 AMZN Mktp US*GSH4K6 Amzn.com/bill WA 89.40	2024-09	8	rule	5ab41b5e6aa84549a5d4b5613bc6e59ed75f0ab49bf8ede13626b72dab1729cc	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.975445-06	\N	\N	f
302	4	8	2024-10-04	AMZN Mktp US*T54LZA Amzn.com/bill WA	-35.00	f	10/04 10/04 AMZN Mktp US*T54LZA Amzn.com/bill WA 35.00	2024-09	8	rule	6293d1e9701eda338c3a003844e037444dafdbbbeb1b8bcb6ddd252998801469	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.975765-06	\N	\N	f
158	1	9	2024-09-23	AUTOMATIC PAYMENT - THANK YOU	2607.16	f	09/23/2024,09/23/2024,AUTOMATIC PAYMENT - THANK YOU,,Payment,2607.16	2024-09	5	transfer	2852a78bd5ca3c11c733e4c6336f626104454d5f505c7e131b9c40b1ec16c52a	2026-10-16 14:34:51.858709-06	2026-10-16 14:34:51.981328-06	244	\N	f
258	4	9	2024-09-23	PAYMENT THANK YOU - WEB	3885.86	f	09/23 09/23 PAYMENT THANK YOU - WEB -3,885.86	2024-09	8	transfer	820f78bc10b88f18e594e7a53e6320cf459a1a23e542261547408f6120018e70	2026-10-16 14:34:51.952053-06	2026-10-16 14:34:51.982763-06	238	\N	f
298	4	3	2024-10-01	PIZZICATO #14 PORTLAND OR	-56.75	f	10/01 10/03 PIZZICATO #14 PORTLAND OR 56.75	2024-09	8	ai	1670a9f45a9ba9c9db56e04c0f401698c36e22c54013520f8ac073011458cb0b	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:30.137233-06	\N	0.95	f
301	4	3	2024-10-02	OLIVE GARDEN 0012345 GRESHAM OR	-86.02	f	10/02 10/04 OLIVE GARDEN 0012345 GRESHAM OR 86.02	2024-09	8	ai	c8916a6e78cc116dbc040f364126badf25b11509b665cd102af27da10233455d	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:30.137702-06	\N	0.95	f
299	4	5	2024-10-03	SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR	-95.00	f	10/03 10/03 SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR 95.00	2024-09	8	ai	69291abb3f335ae6d9541d1c877dc1d383f0fd118ff8c84d135913760e2da0b8	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:30.138197-06	\N	0.90	f
300	4	2	2024-10-03	NEW SEASONS MARKET FAIRVIEW OR	-223.05	f	10/03 10/03 NEW SEASONS MARKET FAIRVIEW OR 223.05	2024-09	8	ai	8bbb16136baa0c11cf6e20da5b79aa82e65afa8ea4303915f414e1cf5a4be30d	2026-10-16 14:34:51.952053-06	2026-10-16 14:37:30.138757-06	\N	0.90	f
571	4	2	2024-11-20	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-6.38	f	11/20 11/22 SQ *BLUE BOTTLE COFFEE OAKLAND CA 6.38	2024-11	16	ai	1da3455984940306c334cf921468eee66909321eb8ba4212292a3be31e60fb0c	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:06.333256-06	\N	0.90	f
297	4	3	2024-09-30	STARBUCKS STORE 05521 GRESHAM OR	-4.99	f	09/30 10/02 STARBUCKS STORE 05521 GRESHAM OR 4.99	2024-09	8	ai	1c1772d47a3adb5f153b199641842db4e1fe816a194e9294c021376efa46f51c	2026-10-16 14:34:51.952053-06	2026-10-16 14:49:30.815292-06	\N	0.90	f
253	2	3	2024-09-30	DEBIT CARD PURCHASE 09/27 SUBWAY 00412290 GRESHAM OR	-10.54	f	09/30 DEBIT CARD PURCHASE 09/27 SUBWAY 00412290 GRESHAM 10.54 7,937.76\nOR	2024-09	6	ai	fa8821088cf247dfe8f3c67d8da25cf98e45e2640afa61043bf8345a9082b1d7	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:31.934296-06	\N	0.90	f
310	1	3	2024-10-27	DOORDASH*THAI BASIL, FAIRVIEW OR	-31.13	f	10/27/2024,10/29/2024,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-31.13	2024-10	9	ai	a74062dcd8272535445bbcefe1dc37cd9c0efcf76d65a86930bafe4d12ef0929	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
311	1	3	2024-10-26	PANDA EXPRESS #1912 GRESHAM OR	-33.71	f	10/26/2024,10/28/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-33.71	2024-10	9	ai	79b61e6954e9bf754ffc4dc8a839491b1da3ea6c9aea0f3613bfd4e9f7cd62d8	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
306	1	4	2024-10-30	LYFT *RIDE SAT 6PM, SAN FRANCISCO CA	-15.54	f	10/30/2024,10/31/2024,LYFT *RIDE SAT 6PM, SAN FRANCISCO CA,Travel,Sale,-15.54	2024-10	9	ai	38c4a7d195565858fa86347649db4dc612befc98f9f634a383f129ae38c31315	2026-10-16 14:37:30.463707-06	2026-10-16 14:40:10.899684-06	\N	0.95	f
303	1	2	2024-10-31	WINCO FOODS #112 GRESHAM OR	-37.66	f	10/31/2024,10/31/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-37.66	2024-10	9	ai	4711361d003f78c14990c2edc4749a6470a8ca530439d0825c4ba9559aa8769b	2026-10-16 14:37:30.463707-06	2026-10-16 14:40:10.901082-06	\N	0.98	f
452	1	10	2024-11-04	WALGREENS #06124 FAIRVIEW OR	-28.88	f	<TRNTYPE>DEBIT <DTPOSTED>20241104050000.000[-5:EST] <TRNAMT>-28.88 <FITID>2024110424492178058004 <NAME>WALGREENS #06124 FAIRVIEW OR	2024-11	13	ai	5bb9d0a26002aadc1674f0a32f545198a1b3eca696c0870ae11c1be63f5c3d37	2026-10-16 14:40:14.285268-06	2026-10-16 14:40:46.603759-06	\N	0.80	f
453	1	10	2024-11-04	WALGREENS #06124 FAIRVIEW OR	-10.58	f	<TRNTYPE>DEBIT <DTPOSTED>20241104050000.000[-5:EST] <TRNAMT>-10.58 <FITID>2024110424492185977005 <NAME>WALGREENS #06124 FAIRVIEW OR	2024-11	13	ai	9954d1f03c1a427916d06dc24ebc8420f8ac32eded0636e7a368a073394dd701	2026-10-16 14:40:14.285268-06	2026-10-16 14:40:46.604189-06	\N	0.80	f
454	1	2	2024-11-05	WINCO FOODS #112 GRESHAM OR	-57.57	f	<TRNTYPE>DEBIT <DTPOSTED>20241105050000.000[-5:EST] <TRNAMT>-57.57 <FITID>2024110524492193896006 <NAME>WINCO FOODS #112 GRESHAM OR	2024-11	13	ai	31c31ab3603a08fa5b8f36a16ee63ccb7c513cb01e8a241fa5ed4c5967807069	2026-10-16 14:40:14.285268-06	2026-10-16 14:40:46.606786-06	\N	0.95	f
338	1	4	2024-10-07	FRED-MEYER FUEL #0651 GRESHAM OR	-35.32	f	10/07/2024,10/09/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-35.32	2024-10	9	ai	877a16ececca811817ec09b5f1f0b4a81527b97e623298a38ced7cff5895c36f	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:24.665561-06	\N	0.90	f
318	1	3	2024-10-22	DOORDASH*THAI BASIL, FAIRVIEW OR	-40.65	f	10/22/2024,10/24/2024,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-40.65	2024-10	9	ai	5b172f18a86e697fad9fc5079096b58e3b43a6dd138a5bf38aa1b6075226e43d	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
330	1	3	2024-10-14	UBER *EATS PENDING HELP.UBER.COM CA	-63.97	f	10/14/2024,10/15/2024,UBER *EATS PENDING HELP.UBER.COM CA,Food & Drink,Sale,-63.97	2024-10	9	ai	eb47f84897fc6cce7dcb958278f58da2269b3db3b34723f800891a793175b50d	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.058457-06	\N	0.90	f
324	1	3	2024-10-18	PANDA EXPRESS #1912 GRESHAM OR	-25.35	f	10/18/2024,10/20/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-25.35	2024-10	9	ai	f8324a80bb662d4de5d0668f175102710381be7dfedb3bdee587e3e1a7f7866e	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
322	1	3	2024-10-19	PANDA EXPRESS #1912 GRESHAM OR	-53.23	f	10/19/2024,10/19/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-53.23	2024-10	9	ai	6b24fababff66f8c8868fc886057c9fae670807635c0ed705779d691ff86df54	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
317	1	3	2024-10-22	PANDA EXPRESS #1912 GRESHAM OR	-20.72	f	10/22/2024,10/22/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-20.72	2024-10	9	ai	95b3cb836028c5842100954f01bd8eceddcd49fa8667c53ef9bc27aea3b2d40d	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
332	1	2	2024-10-12	TRADER JOE S #145 PORTLAND OR	-43.27	f	10/12/2024,10/12/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-43.27	2024-10	9	ai	00c901442273712e92bd1fb0e28a22ebbba96eaf521882fa9779fece350d3df0	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.456761-06	\N	0.90	f
327	1	2	2024-10-16	FRED-MEYER #0651 GRESHAM OR	-174.08	f	10/16/2024,10/17/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-174.08	2024-10	9	ai	3f2c114ffaaac95939d21b01535f5168da5a8852156edfb4916be49bcb99c780	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
314	1	2	2024-10-25	FRED-MEYER #0651 GRESHAM OR	-75.96	f	10/25/2024,10/25/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-75.96	2024-10	9	ai	bb0d36b88619fd0f1411acc6e3dee6af9bf58a5d365e8c0e1357521ca5774647	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
339	1	2	2024-10-07	WINCO FOODS #112 GRESHAM OR	-28.79	f	10/07/2024,10/08/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-28.79	2024-10	9	ai	9ea3a806f450b9dab81dd31dd0abccfba437779a5d3d4a8771624109f14949a4	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:24.67073-06	\N	0.95	f
336	1	2	2024-10-08	WINCO FOODS #112 GRESHAM OR	-94.50	f	10/08/2024,10/10/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-94.50	2024-10	9	ai	4a57b07f650b918704e2f9506329ebd250b2370f5c427141d8542f9abe0ae4d8	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:24.671669-06	\N	0.95	f
337	1	2	2024-10-08	WINCO FOODS #112 GRESHAM OR	-167.07	f	10/08/2024,10/08/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-167.07	2024-10	9	ai	cbdd4befca8f71ff21e73f3918f0dab764ac323182961de258e68618f5ba555a	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:24.672091-06	\N	0.95	f
335	1	10	2024-10-10	WALGREENS #06124 FAIRVIEW OR	-51.87	f	10/10/2024,10/10/2024,WALGREENS #06124 FAIRVIEW OR,Health & Wellness,Sale,-51.87	2024-10	9	ai	552155a4978be7eeb56c36164b16442de2ae9099163e060b52fa6d957dadf7cb	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:24.676863-06	\N	0.85	f
343	1	2	2024-10-05	TRADER JOE S #145 PORTLAND OR	-48.10	f	10/05/2024,10/05/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-48.10	2024-10	9	ai	e1731575a5bfc683805fbe8eba66569444a8bbc61c93056798fd64ce5120c22b	2026-10-16 14:37:30.463707-06	2026-10-16 14:37:57.11605-06	\N	0.95	f
340	1	4	2024-10-06	FRED-MEYER FUEL #0651 GRESHAM OR	-66.84	f	10/06/2024,10/08/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-66.84	2024-10	9	ai	4c95743400cf43326074764a263fcd930dd63a07018127d5cd197a6781dab724	2026-10-16 14:37:30.463707-06	2026-10-16 14:37:57.117338-06	\N	0.90	f
341	1	4	2024-10-06	FRED-MEYER FUEL #0651 GRESHAM OR	-47.22	f	10/06/2024,10/07/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-47.22	2024-10	9	ai	11b3f356d566bcf34ee7d9ace09eface7a0387f901d18d1ace0683d380a217af	2026-10-16 14:37:30.463707-06	2026-10-16 14:37:57.11776-06	\N	0.90	f
342	1	4	2024-10-06	LYFT *RIDE SAT 8PM, SAN FRANCISCO CA	-27.10	f	10/06/2024,10/06/2024,LYFT *RIDE SAT 8PM, SAN FRANCISCO CA,Travel,Sale,-27.10	2024-10	9	ai	e1249d81e22e6ee7357ebca521784481571aae3f67a0668b9ed34e68b029fb3b	2026-10-16 14:37:30.463707-06	2026-10-16 14:37:57.118189-06	\N	0.98	f
333	1	4	2024-10-11	LYFT *RIDE FRI 8PM, SAN FRANCISCO CA	-23.75	f	10/11/2024,10/12/2024,LYFT *RIDE FRI 8PM, SAN FRANCISCO CA,Travel,Sale,-23.75	2024-10	9	ai	ed1aeabd49aa5ebb7a2621d43f6f44d307c37cdd089f6679544f639909f35b11	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:24.678069-06	\N	0.95	f
331	1	2	2024-10-14	WINCO FOODS #112 GRESHAM OR	-63.28	f	10/14/2024,10/14/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-63.28	2024-10	9	ai	7d70c113e52924ae06c798f33ca4dd95db0c58a0b3bc03347026a488d94636c3	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:50.741843-06	\N	0.95	f
329	1	8	2024-10-15	PAYPAL *ETSY, INC 4029357733 CA	-49.01	f	10/15/2024,10/16/2024,PAYPAL *ETSY, INC 4029357733 CA,Shopping,Sale,-49.01	2024-10	9	ai	269c1c7660dd90bf9e2a3cfc850c66af81cbbf72eccaa4e2f20db3c865dc0ebb	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:50.74309-06	\N	0.85	f
328	1	4	2024-10-16	LYFT *RIDE FRI 11PM, SAN FRANCISCO CA	-23.13	f	10/16/2024,10/16/2024,LYFT *RIDE FRI 11PM, SAN FRANCISCO CA,Travel,Sale,-23.13	2024-10	9	ai	87fc7b7aa555d8d3f1769fd19b2cfc20f2a5c73733b7f8d086acc385a1d756e1	2026-10-16 14:37:30.463707-06	2026-10-16 14:38:50.745642-06	\N	0.95	f
326	1	4	2024-10-17	ARCO #82211 AMPM GRESHAM OR	-65.34	f	10/17/2024,10/18/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-65.34	2024-10	9	ai	e13e975cdf602983e1444189f134717d50c0bcb39e1f70aa79955032549bf3a8	2026-10-16 14:37:30.463707-06	2026-10-16 14:39:16.974699-06	\N	0.85	f
323	1	2	2024-10-18	TRADER JOE S #145 PORTLAND OR	-47.03	f	10/18/2024,10/19/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-47.03	2024-10	9	ai	9113b565f9841925e7e7f39c6da0c6b417c390b19c9562a6e4bbf8c15ee48853	2026-10-16 14:37:30.463707-06	2026-10-16 14:39:16.976805-06	\N	0.95	f
325	1	5	2024-10-18	HULU 877-8244858 CA	-18.99	f	10/18/2024,10/20/2024,HULU 877-8244858 CA,Entertainment,Sale,-18.99	2024-10	9	ai	a2d7b3855cd695ba15df10c09a76b8392c88064b6789f8cfac47d0a3ee406ac6	2026-10-16 14:37:30.463707-06	2026-10-16 14:39:16.977662-06	\N	0.90	f
321	1	10	2024-10-20	CVS/PHARMACY #10422 GRESHAM OR	-18.86	f	10/20/2024,10/20/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-18.86	2024-10	9	ai	663589a57442c1ae07976ee7ea89c73079a68c1e9dd606105a837721a4c3efe6	2026-10-16 14:37:30.463707-06	2026-10-16 14:39:16.981817-06	\N	0.80	f
319	1	4	2024-10-22	FRED-MEYER FUEL #0651 GRESHAM OR	-56.57	f	10/22/2024,10/24/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-56.57	2024-10	9	ai	248ab31d18d3ce183ffcfd5d04e84c62d12ebd8813a274a6b08240d6cb8eb9af	2026-10-16 14:37:30.463707-06	2026-10-16 14:39:44.754137-06	\N	0.90	f
360	2	3	2024-10-07	DEBIT CARD PURCHASE 10/04 CHIPOTLE 2291 GRESHAM OR	-42.73	f	10/07 DEBIT CARD PURCHASE 10/04 CHIPOTLE 2291 GRESHAM OR 42.73 7,445.20	2024-10	10	ai	81477c7c9f6dd49cf455161bba43ef20af3a39e8de4639c384e01fccc0de1431	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:24.671238-06	\N	0.95	f
364	2	10	2024-10-09	CHECK #1043	-160.00	f	10/09 CHECK #1043 160.00 7,023.00	2024-10	10	ai	3f86828172a238c0fba31f1ab47f31a1da681b5927addedff8803f9d99396da7	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:24.674064-06	\N	0.70	f
366	2	4	2024-10-09	POS DEBIT 10/09 ARCO #82211 AMPM	-47.39	f	10/09 POS DEBIT 10/09 ARCO #82211 AMPM 47.39 6,965.90	2024-10	10	ai	7c2fe112627a674656cfda7561e473299c68489f00e44785f4930dd4c8e21c91	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:24.674997-06	\N	0.90	f
367	2	7	2024-10-10	ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 8830021147	1350.00	f	10/10 ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 1,350.00 8,315.90\n8830021147	2024-10	10	ai	c64253cdd98c49b9e20cf1cf96eb75565a604aa6764765eb0a30398228c4397e	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:24.67727-06	\N	0.95	f
368	2	10	2024-10-10	DEBIT CARD PURCHASE 10/09 RITE AID STORE 5411 GRESHAM OR	-24.12	f	10/10 DEBIT CARD PURCHASE 10/09 RITE AID STORE 5411 24.12 8,291.78\nGRESHAM OR	2024-10	10	ai	49c95ced0178c5620d49b6b72b70cdcaa7b61331967bdc504cea8319cab23340	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:24.677671-06	\N	0.85	f
370	2	3	2024-10-13	DEBIT CARD PURCHASE 10/13 SUBWAY 00412290 GRESHAM OR	-34.60	f	10/13 DEBIT CARD PURCHASE 10/13 SUBWAY 00412290 GRESHAM 34.60 8,245.79\nOR	2024-10	10	ai	5aacc1b9f6a5f40a6141f7633e2fc091ef496c4d1f26edffb66b07fcd611010c	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:50.740302-06	\N	0.95	f
371	2	3	2024-10-13	DEBIT CARD PURCHASE 10/13 MCDONALD'S F21877 FAIRVIEW OR	-44.34	f	10/13 DEBIT CARD PURCHASE 10/13 MCDONALD'S F21877 FAIRVIEW 44.34 8,201.45\nOR	2024-10	10	ai	8be11f021e7f3d34100793d187f6bb33c98b9f07bc632a3f4f0244d096c6b3e8	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:50.740749-06	\N	0.95	f
372	2	4	2024-10-14	POS DEBIT 10/14 ARCO #82211 AMPM	-45.61	f	10/14 POS DEBIT 10/14 ARCO #82211 AMPM 45.61 8,155.84	2024-10	10	ai	0add8559052dac819fc3800504fd5ce134770e0eb738fd7b083564b249ed2781	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:50.742279-06	\N	0.90	f
365	2	3	2024-10-09	POS DEBIT 10/08 DUTCH BROS #OR0212 FAIRVIEW OR	-9.71	f	10/09 POS DEBIT 10/08 DUTCH BROS #OR0212 FAIRVIEW OR 9.71 7,013.29	2024-10	10	ai	b0b1666912b949750c3ae80d8d10b4fac5fa9b2656185763716feaeb295f8447	2026-10-16 14:37:30.500003-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
363	2	3	2024-10-08	POS DEBIT 10/07 SQ *CASCADE ROASTERS FAIRVIEW OR	-4.94	f	10/08 POS DEBIT 10/07 SQ *CASCADE ROASTERS FAIRVIEW OR 4.94 7,183.00	2024-10	10	ai	5788fff569def8708a5e4c8d549397496909ca83fd6baa8dcbc92df031f2cab6	2026-10-16 14:37:30.500003-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
357	2	3	2024-10-03	DEBIT CARD PURCHASE 10/02 SQ *CASCADE ROASTERS FAIRVIEW OR	-10.16	f	10/03 DEBIT CARD PURCHASE 10/02 SQ *CASCADE ROASTERS 10.16 5,141.78\nFAIRVIEW OR	2024-10	10	ai	116a5a3032bbf8c61ae953960b675c57a82c69eddc6860b624c6303cf5e5b220	2026-10-16 14:37:30.500003-06	2026-10-16 14:49:31.054101-06	\N	0.95	f
346	1	3	2024-10-03	DOORDASH*BURGERVILLE #12	-50.14	f	10/03/2024,10/03/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-50.14	2024-10	9	ai	8f78894ef7443a3bea9b4956bbc70e8feb4ae40562b9dbc891083cef38053c60	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
347	1	3	2024-10-03	UBER *EATS PENDING HELP.UBER.COM CA	-48.80	f	10/03/2024,10/04/2024,UBER *EATS PENDING HELP.UBER.COM CA,Food & Drink,Sale,-48.80	2024-10	9	ai	691d0403741f4ebdf68b0b16d53da6cd650d87e0f35415c7010cd870e6ce7c11	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.058457-06	\N	0.95	f
350	1	3	2024-10-01	PANDA EXPRESS #1912 GRESHAM OR	-26.29	f	10/01/2024,10/03/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-26.29	2024-10	9	ai	efbf9d5a85fb9fb8bc13df4f023160cd15a8620b3eac460fa7b663595f5c6bbd	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
348	1	2	2024-10-02	FRED-MEYER #0651 GRESHAM OR	-147.43	f	10/02/2024,10/03/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-147.43	2024-10	9	ai	f8027cf3cc068b024494f24b9034271220cc45f28b3f9afe6144d9ae7607344d	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.57709-06	\N	0.92	f
349	1	5	2024-10-02	APPLE.COM/BILL 866-712-7753 CA	-9.99	f	10/02/2024,10/03/2024,APPLE.COM/BILL 866-712-7753 CA,Entertainment,Sale,-9.99	2024-10	9	ai	d210ef1571e0856674a19be2438266aab58dc93e1a5bf8fbd1f0e3a6d3a2252f	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:33.446938-06	\N	0.85	f
355	2	1	2024-10-03	ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 6610023385	-188.42	f	10/03 ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 188.42 5,184.28\n6610023385	2024-10	10	ai	1b5d06954f5a46ff227e7cceb83416af217621848fdb2f8ace39ab08cfc33bb4	2026-10-16 14:37:30.500003-06	2026-10-16 14:49:34.35337-06	\N	0.90	f
361	2	4	2024-10-07	POS DEBIT 10/07 SHELL OIL 57442	-43.95	f	10/07 POS DEBIT 10/07 SHELL OIL 57442 43.95 7,401.25	2024-10	10	rule	7950aba63f987dcc5a8f31b3266b5a50dfd9b22e4a64fbcb4b52290b6fd4160d	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.557165-06	\N	\N	f
362	2	6	2024-10-08	ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 9300012231	-213.31	f	10/08 ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 213.31 7,187.94\n9300012231	2024-10	10	rule	34c653d8819797602b00952f257f85cd2dba4cc08aa93d23b146aa4f7096c01a	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.557814-06	\N	\N	f
359	2	9	2024-10-07	ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS XXXXXX4471 REF #IBR0LWH9W	-500.00	f	10/07 ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS 500.00 7,487.93\nXXXXXX4471 REF #IBR0LWH9W	2024-10	10	transfer	655f8d3ebca99bb104cd42e8e5b6f71ee59577d1cf11008d897313da14a115b5	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.566408-06	403	\N	f
351	1	4	2024-10-01	LYFT *RIDE SAT 10PM, SAN FRANCISCO CA	-34.28	f	10/01/2024,10/01/2024,LYFT *RIDE SAT 10PM, SAN FRANCISCO CA,Travel,Sale,-34.28	2024-10	9	ai	7a5d1b30910fa63fd6b9615460b47a86c1e1e59b51cb1918c26ef3f33b683d89	2026-10-16 14:37:30.463707-06	2026-10-16 14:37:57.109851-06	\N	0.98	f
353	2	4	2024-10-01	POS DEBIT 09/30 CHEVRON 0098812 FAIRVIEW OR	-62.52	f	10/01 POS DEBIT 09/30 CHEVRON 0098812 FAIRVIEW OR 62.52 5,432.70	2024-10	10	ai	e00acae207c64dbb5a22cdacbbddf3585b0981f0e857817176c10b2793296ecc	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:57.11046-06	\N	0.90	f
354	2	10	2024-10-02	ATM WITHDRAWAL 10/02 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-60.00	f	10/02 ATM WITHDRAWAL 10/02 MAPLE FEDERAL ATM #2210 2210 60.00 5,372.70\nMAIN ST FAIRVIEW OR	2024-10	10	ai	d643b69ce57f1b04518b42cac0d238a80b5efefea9a05498f69d619d005b0d69	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:57.1118-06	\N	0.80	f
356	2	4	2024-10-03	POS DEBIT 10/02 ARCO #82211 AMPM	-32.34	f	10/03 POS DEBIT 10/02 ARCO #82211 AMPM 32.34 5,151.94	2024-10	10	ai	623dde53ddc5e11fd8e9684e7228f1d252aa8dc1b4e3e4cf09c95e0432a28f1f	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:57.11362-06	\N	0.90	f
345	1	2	2024-10-04	WINCO FOODS #112 GRESHAM OR	-129.01	f	10/04/2024,10/06/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-129.01	2024-10	9	ai	189f90cfcbe9e0456119429bc8cab5eb6230aa741c7499836ac09f60fffe04ac	2026-10-16 14:37:30.463707-06	2026-10-16 14:37:57.115183-06	\N	0.95	f
344	1	8	2024-10-05	THE HOME DEPOT #4012 GRESHAM OR	-105.79	f	10/05/2024,10/07/2024,THE HOME DEPOT #4012 GRESHAM OR,Shopping,Sale,-105.79	2024-10	9	ai	cc61464078125da55485b6ea9d6c1d315e03bd723582c9968a1a21911c0d0978	2026-10-16 14:37:30.463707-06	2026-10-16 14:37:57.116489-06	\N	0.90	f
374	2	6	2024-10-15	ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 3300298811	-65.57	f	10/15 ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 65.57 10,002.67\n3300298811	2024-10	10	ai	efa5843c5f82f44e806088c53f1524a84d2f9fecba201982a6d85f7d64802283	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:50.743494-06	\N	0.95	f
395	2	3	2024-10-24	POS DEBIT 10/24 DUTCH BROS #OR0212 FAIRVIEW OR	-8.33	f	10/24 POS DEBIT 10/24 DUTCH BROS #OR0212 FAIRVIEW OR 8.33 4,897.81	2024-10	10	ai	57a5c93693360a94167b141c44a8970f3d7c29e76fca51e97a98dc12841000b0	2026-10-16 14:37:30.500003-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
387	2	3	2024-10-21	DEBIT CARD PURCHASE 10/18 SQ *CASCADE ROASTERS FAIRVIEW OR	-10.98	f	10/21 DEBIT CARD PURCHASE 10/18 SQ *CASCADE ROASTERS 10.98 8,276.51\nFAIRVIEW OR	2024-10	10	ai	54eaef10c858a6643e026f19e1f70fdfaf8ed6681fd468536d7feb2bbf039a1b	2026-10-16 14:37:30.500003-06	2026-10-16 14:49:31.054101-06	\N	0.95	f
381	2	3	2024-10-17	DEBIT CARD PURCHASE 10/16 SUBWAY 00412290 GRESHAM OR	-53.57	f	10/17 DEBIT CARD PURCHASE 10/16 SUBWAY 00412290 GRESHAM 53.57 9,572.15\nOR	2024-10	10	ai	0abc2dcfbc1d62f3e4c10b1974b9349b77ba8973db072a6dbf860bada9987602	2026-10-16 14:37:30.500003-06	2026-10-16 14:49:31.934296-06	\N	0.95	f
375	2	2	2024-10-15	DEBIT CARD PURCHASE 10/11 GROCERY OUTLET #388 GRESHAM OR	-29.09	f	10/15 DEBIT CARD PURCHASE 10/11 GROCERY OUTLET #388 29.09 9,973.58\nGRESHAM OR	2024-10	10	ai	1028efe924edd26830fdf79b48f8f71eddd80719eaf0c77627058a003e20d7b5	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:50.744141-06	\N	0.95	f
376	2	4	2024-10-15	POS DEBIT 10/11 ARCO #82211 AMPM	-52.92	f	10/15 POS DEBIT 10/11 ARCO #82211 AMPM 52.92 9,920.66	2024-10	10	ai	ab8a0de6d08f086384ceaf0010600249d7b1289f667b1feb3774cd9cd92875c7	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:50.744527-06	\N	0.90	f
377	2	2	2024-10-16	DEBIT CARD PURCHASE 10/15 WINCO FOODS #112 GRESHAM OR	-75.63	f	10/16 DEBIT CARD PURCHASE 10/15 WINCO FOODS #112 GRESHAM 75.63 9,845.03\nOR	2024-10	10	ai	e088a3b3f50231ae0c9c041e7f9c87ffea13ac867cf2a42112e0566f40fc46c3	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:50.746028-06	\N	0.95	f
378	2	10	2024-10-16	ATM WITHDRAWAL 10/16 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-100.00	f	10/16 ATM WITHDRAWAL 10/16 MAPLE FEDERAL ATM #2210 2210 100.00 9,745.03\nMAIN ST FAIRVIEW OR	2024-10	10	ai	d11f58640041b06d2bfd5764f9d75542cb2aa156c7f061afd5fc11365cd5f51d	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:50.746423-06	\N	0.80	f
383	2	7	2024-10-18	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	10/18 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 12,371.67\n9100234517	2024-10	10	rule	464d74b5138fb16916175354f8e9d3b760d8eead9f7b25d2b370cce282e7dbd9	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.560525-06	\N	\N	f
392	2	4	2024-10-23	POS DEBIT 10/22 SHELL OIL 57442	-47.19	f	10/23 POS DEBIT 10/22 SHELL OIL 57442 47.19 7,944.29	2024-10	10	rule	ffae4886caba80b3722fb7647fedf56d6c04507ed1a9e37ac7c12ef245358a43	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.561571-06	\N	\N	f
379	2	2	2024-10-16	POS DEBIT 10/16 SAFEWAY #1544 FAIRVIEW OR	-39.32	f	10/16 POS DEBIT 10/16 SAFEWAY #1544 FAIRVIEW OR 39.32 9,705.71	2024-10	10	ai	4736221ba32d3d8b32af3dbf00eb8cb35a2620e02dd999f8fb03c8592e608f55	2026-10-16 14:37:30.500003-06	2026-10-16 14:38:50.7468-06	\N	0.95	f
386	2	9	2024-10-21	ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# F1QEWB6A	-3997.66	f	10/21 ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# 3,997.66 8,287.49\nF1QEWB6A	2024-10	10	transfer	f315d64f7736b4eb2286f29503d40e5df21ff59ac3a3f3c7ab8a9ff22cdc137c	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.567464-06	405	\N	f
380	2	6	2024-10-17	RIVERNET BROADBAND AUTOPAY 800-555-0142	-79.99	f	10/17 RIVERNET BROADBAND AUTOPAY 800-555-0142 79.99 9,625.72	2024-10	10	ai	76b88ffe54d87ab1cae8a620c5a9d52d7e95a575eaf42a808539a28bc00ad59c	2026-10-16 14:37:30.500003-06	2026-10-16 14:39:16.975412-06	\N	0.95	f
393	2	9	2024-10-24	HARBOR CARD AUTOPAY PPD ID: 7781000231	-3030.46	f	10/24 HARBOR CARD AUTOPAY PPD ID: 7781000231 3,030.46 4,913.83	2024-10	10	transfer	ad6460f489093d7e8b1b4ca4c2e0f3850d85e766b9567b6b7b4dcdea0101da50	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.568463-06	315	\N	f
382	2	4	2024-10-17	POS DEBIT 10/17 CHEVRON 0098812 FAIRVIEW OR	-46.63	f	10/17 POS DEBIT 10/17 CHEVRON 0098812 FAIRVIEW OR 46.63 9,525.52	2024-10	10	ai	a6bc08f442f0385e433b1482330242c360c385993a451cc405ace2d638a60e20	2026-10-16 14:37:30.500003-06	2026-10-16 14:39:16.976369-06	\N	0.90	f
384	2	4	2024-10-18	POS DEBIT 10/17 CHEVRON 0098812 FAIRVIEW OR	-52.53	f	10/18 POS DEBIT 10/17 CHEVRON 0098812 FAIRVIEW OR 52.53 12,319.14	2024-10	10	ai	d940573b5bd28022af7c0d1b4bc6e099552d659673db5d753e7c37b0e6bf3bbb	2026-10-16 14:37:30.500003-06	2026-10-16 14:39:16.978102-06	\N	0.90	f
385	2	2	2024-10-19	DEBIT CARD PURCHASE 10/19 WINCO FOODS #112 GRESHAM OR	-33.99	f	10/19 DEBIT CARD PURCHASE 10/19 WINCO FOODS #112 GRESHAM 33.99 12,285.15\nOR	2024-10	10	ai	0e94e1da54526b3ed38177acd85145870ff2106397944ec5a7dc744b8231c962	2026-10-16 14:37:30.500003-06	2026-10-16 14:39:16.980123-06	\N	0.95	f
388	2	2	2024-10-21	POS DEBIT 10/19 WINCO FOODS #112 GRESHAM OR	-72.05	f	10/21 POS DEBIT 10/19 WINCO FOODS #112 GRESHAM OR 72.05 8,204.46	2024-10	10	ai	4ba8622e18431c2c793508475809f095bd91dd9fe7b488218d68960486322353	2026-10-16 14:37:30.500003-06	2026-10-16 14:39:16.983158-06	\N	0.95	f
389	2	2	2024-10-21	DEBIT CARD PURCHASE 10/20 GROCERY OUTLET #388 GRESHAM OR	-64.97	f	10/21 DEBIT CARD PURCHASE 10/20 GROCERY OUTLET #388 64.97 8,139.49\nGRESHAM OR	2024-10	10	ai	ca5fb1f0807b700cd729092b9c09a3a789816af3a2a5b315b95f8791024874e8	2026-10-16 14:37:30.500003-06	2026-10-16 14:39:16.98361-06	\N	0.95	f
390	2	6	2024-10-22	ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190	-142.67	f	10/22 ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190 142.67 7,996.82	2024-10	10	ai	73351e05a17e5d0cf38389093b04199941e7dbc4feafcae145f54b3f15011ddb	2026-10-16 14:37:30.500003-06	2026-10-16 14:39:44.754555-06	\N	0.90	f
391	2	10	2024-10-23	POS DEBIT 10/22 WALGREENS #06124 FAIRVIEW OR	-5.34	f	10/23 POS DEBIT 10/22 WALGREENS #06124 FAIRVIEW OR 5.34 7,991.48	2024-10	10	ai	ca1e6b39bbeb3593093ab5771d2e1465aea56ba3031c44fc53be3879960db41b	2026-10-16 14:37:30.500003-06	2026-10-16 14:39:44.755741-06	\N	0.85	f
394	2	10	2024-10-24	DEBIT CARD PURCHASE 10/23 RITE AID STORE 5411 GRESHAM OR	-7.69	f	10/24 DEBIT CARD PURCHASE 10/23 RITE AID STORE 5411 7.69 4,906.14\nGRESHAM OR	2024-10	10	ai	ad9c38e06c2e1f7a812cdfb8b8662e373a6fbfe571dafb1771409f80ad944cbc	2026-10-16 14:37:30.500003-06	2026-10-16 14:39:44.75653-06	\N	0.85	f
396	2	4	2024-10-28	POS DEBIT 10/25 ARCO #82211 AMPM	-49.71	f	10/28 POS DEBIT 10/25 ARCO #82211 AMPM 49.71 4,848.10	2024-10	10	ai	34e9c8170143677aa21baa8c170ab103a3c9182a8e50eea26e2a92026d2226ad	2026-10-16 14:37:30.500003-06	2026-10-16 14:40:10.895106-06	\N	0.90	f
397	2	2	2024-10-28	POS DEBIT 10/26 WINCO FOODS #112 GRESHAM OR	-157.97	f	10/28 POS DEBIT 10/26 WINCO FOODS #112 GRESHAM OR 157.97 4,690.13	2024-10	10	ai	fd5b94973a9bbd833e5ea1235ceee48b3dd568e24706d84905f593810dbce1c6	2026-10-16 14:37:30.500003-06	2026-10-16 14:40:10.895597-06	\N	0.98	f
398	2	8	2024-10-28	DEBIT CARD PURCHASE 10/27 TARGET T-1544 GRESHAM OR	-71.35	f	10/28 DEBIT CARD PURCHASE 10/27 TARGET T-1544 GRESHAM OR 71.35 4,618.78	2024-10	10	ai	0afa43abe0e74f935fffa93ec05d71611d4642e8d0426a50af19bda8e757dce8	2026-10-16 14:37:30.500003-06	2026-10-16 14:40:10.896071-06	\N	0.95	f
399	2	8	2024-10-28	DEBIT CARD PURCHASE 10/27 DOLLAR TREE #6612 FAIRVIEW OR	-25.39	f	10/28 DEBIT CARD PURCHASE 10/27 DOLLAR TREE #6612 FAIRVIEW 25.39 4,593.39\nOR	2024-10	10	ai	c72a2d825e541a93cc2d417086dd3731bbb4a8870f681615ef5c51f5468219e0	2026-10-16 14:37:30.500003-06	2026-10-16 14:40:10.896543-06	\N	0.90	f
410	4	2	2024-10-08	SAFEWAY #1544 FAIRVIEW OR	-240.13	f	10/08 10/08 SAFEWAY #1544 FAIRVIEW OR 240.13	2024-10	12	ai	ce0ae0750b69efc23f93b2d4f7546bb9fe0bc42009a528aa3147d13880c377b1	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:24.673183-06	\N	0.95	f
412	4	2	2024-10-08	NEW SEASONS MARKET FAIRVIEW OR	-127.16	f	10/08 10/10 NEW SEASONS MARKET FAIRVIEW OR 127.16	2024-10	12	ai	62327b0ed1ede44bcbd4d7384e628e8ef3af34bef838a964d53a5dde2d491fb4	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:24.673581-06	\N	0.95	f
427	4	3	2024-10-18	STARBUCKS STORE 05521 GRESHAM OR	-6.58	f	10/18 10/19 STARBUCKS STORE 05521 GRESHAM OR 6.58	2024-10	12	ai	a4c97427955d12dc130b2560443548159b3d9c2e9745898f3342e044419ef8b2	2026-10-16 14:37:30.542559-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
411	4	5	2024-10-09	SPOTIFY USA 877-778-1161 NY	-16.99	f	10/09 10/09 SPOTIFY USA 877-778-1161 NY 16.99	2024-10	12	ai	5b534413a6b4a10f98702fa637dcf4c72ebff31fd1a938cfece8d783dea4fb66	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:24.675464-06	\N	0.95	f
413	4	4	2024-10-09	COSTCO GAS #0681 WOOD VILLAGE OR	-51.54	f	10/09 10/11 COSTCO GAS #0681 WOOD VILLAGE OR 51.54	2024-10	12	ai	a81b77737a0230dbd8b004bdd1ae23b65678d179c8343b0bc408750b4e1c54f2	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:24.675918-06	\N	0.90	f
414	4	3	2024-10-11	TST* LUIGIS TRATTORIA FAIRVIEW OR	-53.00	f	10/11 10/11 TST* LUIGIS TRATTORIA FAIRVIEW OR 53.00	2024-10	12	ai	397424cd7cec411ffc2c9ff4d76586dab096d7df1f87ab835fa9ac4447b6a842	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:24.678464-06	\N	0.95	f
415	4	3	2024-10-11	PIZZICATO #14 PORTLAND OR	-53.11	f	10/11 10/11 PIZZICATO #14 PORTLAND OR 53.11	2024-10	12	ai	40949bfa52b53e81b211f78b64f1a296ff976c2e81a43999375f0992053af458	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:24.678861-06	\N	0.95	f
418	4	8	2024-10-12	REI #57 PORTLAND OR	-101.08	f	10/12 10/13 REI #57 PORTLAND OR 101.08	2024-10	12	ai	b59614f4676812bfd424684783e1277572cfbfc6f81765f5135fb17c32cd8b66	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:50.739119-06	\N	0.90	f
429	4	4	2024-10-18	COSTCO GAS #0681 WOOD VILLAGE OR	-45.93	f	10/18 10/20 COSTCO GAS #0681 WOOD VILLAGE OR 45.93	2024-10	12	ai	59414a1e364f969bba36aa7e7ba745746d8a890e06b13c7a75d0b3027640dbe4	2026-10-16 14:37:30.542559-06	2026-10-16 14:49:32.941782-06	\N	0.80	f
419	4	2	2024-10-12	NEW SEASONS MARKET FAIRVIEW OR	-227.19	f	10/12 10/13 NEW SEASONS MARKET FAIRVIEW OR 227.19	2024-10	12	ai	010222cd4bd5aa4591af7eb6b5836de0218c9e6e6bcbabc0b618159e11c9d9ae	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:50.739851-06	\N	0.95	f
421	4	2	2024-10-14	NEW SEASONS MARKET FAIRVIEW OR	-150.86	f	10/14 10/15 NEW SEASONS MARKET FAIRVIEW OR 150.86	2024-10	12	ai	e72014b6328d1b83395f1409ff0282a78488e59f3bd90dd742ed3cdf1c23e34b	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:50.742691-06	\N	0.95	f
425	4	3	2024-10-16	PIZZICATO #14 PORTLAND OR	-74.08	f	10/16 10/17 PIZZICATO #14 PORTLAND OR 74.08	2024-10	12	ai	01335e8fa370e1d5f86a6515892f3a2b6b97dbb392ce876e36f40fb127471a0a	2026-10-16 14:37:30.542559-06	2026-10-16 14:38:50.747175-06	\N	0.95	f
426	4	2	2024-10-16	SAFEWAY #1544 FAIRVIEW OR	-146.74	f	10/16 10/18 SAFEWAY #1544 FAIRVIEW OR 146.74	2024-10	12	ai	55da87c6247c856c70cbd178b78244e20c9d7a93673bfe79d732bd57d589aaec	2026-10-16 14:37:30.542559-06	2026-10-16 14:39:16.967974-06	\N	0.95	f
428	4	2	2024-10-19	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-11.58	f	10/19 10/19 SQ *BLUE BOTTLE COFFEE OAKLAND CA 11.58	2024-10	12	ai	cd562176546960282c227a9d1c5983d49ad08f6f7786a1eee425d7fa0ae06e86	2026-10-16 14:37:30.542559-06	2026-10-16 14:39:16.980644-06	\N	0.95	f
416	4	8	2024-10-10	AMZN Mktp US*5F1UFG Amzn.com/bill WA	-15.53	f	10/10 10/12 AMZN Mktp US*5F1UFG Amzn.com/bill WA 15.53	2024-10	12	rule	84c54f1cca8fc4a617547fb8bf31916fd2333eedd188731889841cd7e0a14272	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.558243-06	\N	\N	f
417	4	8	2024-10-11	AMZN Mktp US*4BFNE2 Amzn.com/bill WA	-39.16	f	10/11 10/13 AMZN Mktp US*4BFNE2 Amzn.com/bill WA 39.16	2024-10	12	rule	f2601d265dea79d9e068f6b7337c1d86dcc04bbf9404207b1635cf8c3641fa85	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.558559-06	\N	\N	f
420	4	8	2024-10-13	AMZN Mktp US*258HZ2 Amzn.com/bill WA	-44.22	f	10/13 10/15 AMZN Mktp US*258HZ2 Amzn.com/bill WA 44.22	2024-10	12	rule	6105d0f797aa9ee8a6468f34e78b7c58ce6a718cfe3dc3121174c1b5fd6d877e	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.558895-06	\N	\N	f
422	4	5	2024-10-15	NETFLIX.COM 866-579-7172 CA	-22.99	f	10/15 10/15 NETFLIX.COM 866-579-7172 CA 22.99	2024-10	12	rule	3f0f94e6b68222d153b3d1f24ec358376dde2aa3de3c6603a801884397571d3b	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.559536-06	\N	\N	f
423	4	2	2024-10-15	COSTCO WHSE #0681 WOOD VILLAGE OR	-122.24	f	10/15 10/15 COSTCO WHSE #0681 WOOD VILLAGE OR 122.24	2024-10	12	rule	94100355cbca413dfa003ba8bd76a09762d3f71200824797013ec98f7b86a868	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.559824-06	\N	\N	f
424	4	8	2024-10-15	AMZN Mktp US*JAZHAR Amzn.com/bill WA	-32.69	f	10/15 10/16 AMZN Mktp US*JAZHAR Amzn.com/bill WA 32.69	2024-10	12	rule	548319a71948ef8ba209a9bcc4636fd2d3ff7aeb358a36d19451f3a4feabb1f6	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.560141-06	\N	\N	f
432	4	8	2024-10-21	AMZN Mktp US*L3ZJ2P Amzn.com/bill WA	-41.37	f	10/21 10/21 AMZN Mktp US*L3ZJ2P Amzn.com/bill WA 41.37	2024-10	12	rule	7d1eb4dac145e87c624af84c45bd577f4d238431db76ec8587c273b1fd145317	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.560919-06	\N	\N	f
430	4	8	2024-10-19	POWELL'S BOOKS PORTLAND OR	-116.86	f	10/19 10/21 POWELL'S BOOKS PORTLAND OR 116.86	2024-10	12	ai	56ad414a1262653cc4e5f81672e06b39c485f989639a7bab9aa5df2883aaef74	2026-10-16 14:37:30.542559-06	2026-10-16 14:39:16.981241-06	\N	0.85	f
403	3	9	2024-10-08	ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290	500.00	f	2024-10-08 ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290 500.00	2024-10	11	transfer	a7b80d114cd05f9973c3a61c6a371c06933e09bf5546c54ff67434e725cff358	2026-10-16 14:37:30.519277-06	2026-10-16 14:37:30.566408-06	359	\N	f
431	4	3	2024-10-21	TST* LUIGIS TRATTORIA FAIRVIEW OR	-31.13	f	10/21 10/21 TST* LUIGIS TRATTORIA FAIRVIEW OR 31.13	2024-10	12	ai	80d1cb9b6112cc270aff278d39a4349005ac728881ba8d0e37b7a2153306ec1c	2026-10-16 14:37:30.542559-06	2026-10-16 14:39:44.744751-06	\N	0.95	f
405	4	9	2024-10-22	PAYMENT THANK YOU - WEB	3997.66	f	10/22 10/22 PAYMENT THANK YOU - WEB -3,997.66	2024-10	12	transfer	4fda2b9c1799ea7570d72631a5d3d5afc9dd7b262a3c07af8fae99f141a8367e	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.567464-06	386	\N	f
407	4	3	2024-10-03	PIZZICATO #14 PORTLAND OR	-47.71	f	10/03 10/05 PIZZICATO #14 PORTLAND OR 47.71	2024-10	12	ai	e3f8a599ed7d1e298db6369eedcaadc568a9e971d98e0b490f656abe4b82471b	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:57.114734-06	\N	0.95	f
408	4	2	2024-10-04	SAFEWAY #1544 FAIRVIEW OR	-166.34	f	10/04 10/06 SAFEWAY #1544 FAIRVIEW OR 166.34	2024-10	12	ai	8a5f0ce9bd6141297e2e0a213488710498b242ebbcb58baaae4ca55fb7cefc59	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:57.115616-06	\N	0.95	f
409	4	2	2024-10-05	SAFEWAY #1544 FAIRVIEW OR	-131.68	f	10/05 10/07 SAFEWAY #1544 FAIRVIEW OR 131.68	2024-10	12	ai	21d1fb101c81fc504a915f8d5cd2ebc16352c14fa1f4fd3770748b700b1a5c9a	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:57.116915-06	\N	0.95	f
433	4	5	2024-10-21	DISNEY PLUS 888-905-7888 CA	-13.99	f	10/21 10/22 DISNEY PLUS 888-905-7888 CA 13.99	2024-10	12	ai	37917a8a00a53e7a4d6be70b76c144b8fe9868218f5a4200a2d9976a260c00b1	2026-10-16 14:37:30.542559-06	2026-10-16 14:39:44.751499-06	\N	0.98	f
402	2	7	2024-10-31	INTEREST PAYMENT	0.49	f	10/31 INTEREST PAYMENT 0.49 6,500.65	2024-10	10	ai	6dc4ac1bb8d71ee2646cb6c498458f83b9f9a73ede5e90f8292bb1b3d02f75b5	2026-10-16 14:37:30.500003-06	2026-10-16 14:40:10.902115-06	\N	0.90	f
404	3	7	2024-10-31	INTEREST PAYMENT	5.66	f	2024-10-31 INTEREST PAYMENT 5.66	2024-10	11	ai	05a90b1b50b084c628a31c1061f06a9b1d43a5ecf183a041c63b09de2321a3ca	2026-10-16 14:37:30.519277-06	2026-10-16 14:40:10.902704-06	\N	0.90	f
455	1	2	2024-11-08	TRADER JOE S #145 PORTLAND OR	-95.76	f	<TRNTYPE>DEBIT <DTPOSTED>20241108050000.000[-5:EST] <TRNAMT>-95.76 <FITID>2024110824492201815007 <NAME>TRADER JOE S #145 PORTLAND OR	2024-11	13	ai	4447aad31d773453fc1439de481183c5140eab1b65438504716b797f1c5d1ed0	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:14.416981-06	\N	0.95	f
456	1	4	2024-11-08	LYFT *RIDE FRI 7PM, SAN FRANCISC	-14.25	f	<TRNTYPE>DEBIT <DTPOSTED>20241108050000.000[-5:EST] <TRNAMT>-14.25 <FITID>2024110824492209734008 <NAME>LYFT *RIDE FRI 7PM, SAN FRANCISC	2024-11	13	ai	575e126882941c0521e71ffd2e6294f07f2b6057b4f7cf485e25af947801d61e	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:14.417693-06	\N	0.98	f
600	1	4	2024-12-28	FRED-MEYER FUEL #0651 GRESHAM OR	-43.77	f	12/28/2024,12/29/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-43.77	2024-12	17	ai	ffa1d925c520cbb527fb08db6e33279c92d61d5c3bc2e0844abe9152efa70597	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:30.484497-06	\N	0.90	f
598	1	4	2024-12-29	LYFT *RIDE SAT 7PM, SAN FRANCISCO CA	-18.15	f	12/29/2024,12/30/2024,LYFT *RIDE SAT 7PM, SAN FRANCISCO CA,Travel,Sale,-18.15	2024-12	17	ai	8e2da6be60dcca38ba28dd3e4aa70df1348c1127b6f78ef48bf2d737e5fa2c00	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:30.486287-06	\N	0.95	f
436	4	3	2024-10-22	STARBUCKS STORE 05521 GRESHAM OR	-5.47	f	10/22 10/24 STARBUCKS STORE 05521 GRESHAM OR 5.47	2024-10	12	ai	ced6facd9c7ce676661cb935ba821ac367045bca923ea3e7f8a3bbdb062d41e3	2026-10-16 14:37:30.542559-06	2026-10-16 14:49:30.815292-06	\N	0.90	f
434	4	3	2024-10-21	SQ *CASCADE ROASTERS FAIRVIEW OR	-7.60	f	10/21 10/22 SQ *CASCADE ROASTERS FAIRVIEW OR 7.60	2024-10	12	ai	511334ef3e0b02d9d6cc68ea2aa632da6aef297dd8205b415fac50576556aa79	2026-10-16 14:37:30.542559-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
437	4	3	2024-10-23	SQ *TACO PEDRO GRESHAM OR	-70.61	f	10/23 10/24 SQ *TACO PEDRO GRESHAM OR 70.61	2024-10	12	ai	af842e22af4fa1f3a2f603effcaca5144f61af3f0a0c69dc7f19fc2e511d8b5d	2026-10-16 14:37:30.542559-06	2026-10-16 14:49:31.186084-06	\N	0.95	f
352	2	1	2024-10-01	ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 4417730021	-2385.00	f	10/01 ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 2,385.00 5,495.22\n4417730021	2024-10	10	rule	b6ac10b88b12d3934c448bb03aadbcc2fd6dbdfe997deae88c3b4de8221f469f	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.556091-06	\N	\N	f
406	4	2	2024-10-03	COSTCO WHSE #0681 WOOD VILLAGE OR	-72.65	f	10/03 10/05 COSTCO WHSE #0681 WOOD VILLAGE OR 72.65	2024-10	12	rule	9c2a446128ae07456ddd8cb3b8bb919b3701f3f2ed41a457066952981a345537	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.556482-06	\N	\N	f
358	2	7	2024-10-04	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	10/04 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 7,987.93\n9100234517	2024-10	10	rule	182b75c825e45408e87beb6c5433617e546141708ecd02b616a6360cd2402cac	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.556794-06	\N	\N	f
373	2	7	2024-10-15	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	10/15 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 10,068.24\n5520017784	2024-10	10	rule	e20491769517d987fa96d4f4bd17842a8b58ef5e90ab14eb24f6de210741e92c	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.559216-06	\N	\N	f
435	4	8	2024-10-22	AMZN Mktp US*6P4QAP Amzn.com/bill WA	-28.11	f	10/22 10/23 AMZN Mktp US*6P4QAP Amzn.com/bill WA 28.11	2024-10	12	rule	81ddd61dcd91af75f2b508e249232d9b0b38ef92335b6f97b8dd3f238c8024af	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.561253-06	\N	\N	f
401	2	7	2024-10-31	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	10/31 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 6,500.16\n5520017784	2024-10	10	rule	8013f6f7e3035a21dce81857abc99e5d6c77198848e338658d6abd1b0f5873f8	2026-10-16 14:37:30.500003-06	2026-10-16 14:37:30.562037-06	\N	\N	f
445	4	8	2024-11-02	AMZN Mktp US*4ZYRAR Amzn.com/bill WA	-89.04	f	11/02 11/02 AMZN Mktp US*4ZYRAR Amzn.com/bill WA 89.04	2024-10	12	rule	5ffdc6f8a9510926360c54b9b4ac1af49d12d1152d17b820f4ef1707a8ecf260	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.562337-06	\N	\N	f
447	4	4	2024-11-03	SHELL OIL 57442110021 FAIRVIEW OR	-51.77	f	11/03 11/03 SHELL OIL 57442110021 FAIRVIEW OR 51.77	2024-10	12	rule	3dffa7e8a5759fc0c318832afe8e1f096f908185f309166def6b4552445a936e	2026-10-16 14:37:30.542559-06	2026-10-16 14:37:30.562618-06	\N	\N	f
438	4	2	2024-10-25	SAFEWAY #1544 FAIRVIEW OR	-115.99	f	10/25 10/26 SAFEWAY #1544 FAIRVIEW OR 115.99	2024-10	12	ai	85169ac2e0e7c77a616422cd5821d7c93859a482be0e5577725536e9d64a0ada	2026-10-16 14:37:30.542559-06	2026-10-16 14:39:44.758927-06	\N	0.95	f
315	1	9	2024-10-23	AUTOMATIC PAYMENT - THANK YOU	3030.46	f	10/23/2024,10/23/2024,AUTOMATIC PAYMENT - THANK YOU,,Payment,3030.46	2024-10	9	transfer	3f2771e9cf27b089fa07d9f5fb098dc0fe410d67c324cdef69a445f40c8535af	2026-10-16 14:37:30.463707-06	2026-10-16 14:37:30.568463-06	393	\N	f
439	4	4	2024-10-26	COSTCO GAS #0681 WOOD VILLAGE OR	-54.71	f	10/26 10/28 COSTCO GAS #0681 WOOD VILLAGE OR 54.71	2024-10	12	ai	83c47240c05746241a555d7cdd0aceb6d038933fe9d3652d6e0272e861d1deba	2026-10-16 14:37:30.542559-06	2026-10-16 14:39:44.760637-06	\N	0.90	f
441	4	2	2024-10-29	SAFEWAY #1544 FAIRVIEW OR	-197.59	f	10/29 10/29 SAFEWAY #1544 FAIRVIEW OR 197.59	2024-10	12	ai	fbf2cf4bcbc1bb4807bf5ace46181f6df9a07584a7a6305cac7182de9f73dd6d	2026-10-16 14:37:30.542559-06	2026-10-16 14:40:10.898737-06	\N	0.98	f
443	4	2	2024-10-30	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-12.93	f	10/30 10/31 SQ *BLUE BOTTLE COFFEE OAKLAND CA 12.93	2024-10	12	ai	792283dbd5699e0ca749f800224eaefdd93ed8c6cc0eb4f37a50c11e78a2b3e3	2026-10-16 14:37:30.542559-06	2026-10-16 14:40:10.90063-06	\N	0.98	f
444	4	2	2024-10-31	NEW SEASONS MARKET FAIRVIEW OR	-218.59	f	10/31 11/01 NEW SEASONS MARKET FAIRVIEW OR 218.59	2024-10	12	ai	bc77da01da0f0c0f0b0de636db12b2034314b639056d7d476b46433029523a56	2026-10-16 14:37:30.542559-06	2026-10-16 14:40:10.903337-06	\N	0.98	f
446	4	5	2024-11-03	SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR	-95.00	f	11/03 11/03 SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR 95.00	2024-10	12	ai	a1741149510f8e35ece0f3ae4be72f439f2212215f632c1bfbd0e9fb082c94cd	2026-10-16 14:37:30.542559-06	2026-10-16 14:40:10.903912-06	\N	0.90	f
448	4	3	2024-11-04	OLIVE GARDEN 0012345 GRESHAM OR	-68.25	f	11/04 11/04 OLIVE GARDEN 0012345 GRESHAM OR 68.25	2024-10	12	ai	4dee204c9a0574ac96d03e1ae80ea55967cc1251bcd3612a7c3f6a1893ad3f96	2026-10-16 14:37:30.542559-06	2026-10-16 14:40:13.662979-06	\N	0.90	f
458	1	3	2024-11-10	UBER *EATS PENDING HELP.UBER.COM	-62.58	f	<TRNTYPE>DEBIT <DTPOSTED>20241110050000.000[-5:EST] <TRNAMT>-62.58 <FITID>2024111024492225572010 <NAME>UBER *EATS PENDING HELP.UBER.COM	2024-11	13	ai	f43a04a0fc89ee473b92f849bd34090e4b3a4938fe7e7299371ebaaa76a64db0	2026-10-16 14:40:14.285268-06	2026-10-16 14:49:32.058457-06	\N	0.95	f
599	1	3	2024-12-29	PANDA EXPRESS #1912 GRESHAM OR	-22.77	f	12/29/2024,12/30/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-22.77	2024-12	17	ai	fed1f0d1227d942def0e1a37daddd32e70c1802ed3f063650d0315a46c0fd6cb	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
457	1	4	2024-11-07	ARCO #82211 AMPM GRESHAM OR	-44.38	f	<TRNTYPE>DEBIT <DTPOSTED>20241107050000.000[-5:EST] <TRNAMT>-44.38 <FITID>2024110724492217653009 <NAME>ARCO #82211 AMPM GRESHAM OR	2024-11	13	ai	c7884e8c795c57466db3035d8896e95be5646deb2ed7b040ab413b85536e5ad1	2026-10-16 14:40:14.285268-06	2026-10-16 14:40:46.609825-06	\N	0.90	f
595	1	2	2024-12-31	TRADER JOE S #145 PORTLAND OR	-86.20	f	12/31/2024,01/01/2025,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-86.20	2024-12	17	ai	c0c1f45223ed93bcff1876eca55425a88b6b8aa99e66ed70d1c816d4f0ab0390	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:50.484433-06	\N	0.95	f
471	1	3	2024-11-14	UBER *EATS PENDING HELP.UBER.COM	-60.29	f	<TRNTYPE>DEBIT <DTPOSTED>20241114050000.000[-5:EST] <TRNAMT>-60.29 <FITID>2024111424492328519023 <NAME>UBER *EATS PENDING HELP.UBER.COM	2024-11	13	ai	e05395ad8bd7d27d0c309af55964c3cfa2f5a8188934ea73e776f6565b8c791e	2026-10-16 14:40:14.285268-06	2026-10-16 14:49:32.058457-06	\N	0.95	f
469	1	2	2024-11-15	FRED-MEYER #0651 GRESHAM OR	-32.25	f	<TRNTYPE>DEBIT <DTPOSTED>20241115050000.000[-5:EST] <TRNAMT>-32.25 <FITID>2024111524492312681021 <NAME>FRED-MEYER #0651 GRESHAM OR	2024-11	13	ai	12e41826733dccdc3aecc796186c5fb795fc6221e5be2d3abb77058a9c677a97	2026-10-16 14:40:14.285268-06	2026-10-16 14:49:32.57709-06	\N	0.95	f
478	1	8	2024-11-20	SQ *SMITH & SONS, LLC PORTLAND O	-56.68	f	<TRNTYPE>DEBIT <DTPOSTED>20241120050000.000[-5:EST] <TRNAMT>-56.68 <FITID>2024112024492383952030 <NAME>SQ *SMITH &amp; SONS, LLC PORTLAND O	2024-11	13	ai	930871d91fa8644e8085e7b5f6a5b201047f255265c4a40b4d1cc92ccaf8bf07	2026-10-16 14:40:14.285268-06	2026-10-16 14:49:35.135541-06	\N	0.90	f
462	1	10	2024-11-10	CVS/PHARMACY #10422 GRESHAM OR	-11.92	f	<TRNTYPE>DEBIT <DTPOSTED>20241110050000.000[-5:EST] <TRNAMT>-11.92 <FITID>2024111024492257248014 <NAME>CVS/PHARMACY #10422 GRESHAM OR	2024-11	13	ai	d7b3626df8696d707515ce5b5b895a2b45dccbb95cba82248743b5d4f339b38f	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:14.420419-06	\N	0.90	f
460	1	2	2024-11-11	WINCO FOODS #112 GRESHAM OR	-97.44	f	<TRNTYPE>DEBIT <DTPOSTED>20241111050000.000[-5:EST] <TRNAMT>-97.44 <FITID>2024111124492241410012 <NAME>WINCO FOODS #112 GRESHAM OR	2024-11	13	ai	08ee8f898973fb148e7ca0632c0435b65df61b972644a669cad179dcaa792a05	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:14.421321-06	\N	0.95	f
461	1	8	2024-11-11	SQ *SMITH & SONS, LLC PORTLAND O	-64.00	f	<TRNTYPE>DEBIT <DTPOSTED>20241111050000.000[-5:EST] <TRNAMT>-64.00 <FITID>2024111124492249329013 <NAME>SQ *SMITH &amp; SONS, LLC PORTLAND O	2024-11	13	ai	b634ec922a1dab72d9893e67e707c974f1d21cb8a68227a253093561de84bfd3	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:14.421763-06	\N	0.90	f
463	1	8	2024-11-11	CHEWY.COM 800-672-4399 FL	-46.33	f	<TRNTYPE>DEBIT <DTPOSTED>20241111050000.000[-5:EST] <TRNAMT>-46.33 <FITID>2024111124492265167015 <NAME>CHEWY.COM 800-672-4399 FL	2024-11	13	ai	2fee3bbb59387324dd7946115e58cc8a9ee117ee8f8e849e2063004fd721532b	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:14.422202-06	\N	0.90	f
465	1	4	2024-11-11	CHEVRON 0098812 FAIRVIEW OR	-57.66	f	<TRNTYPE>DEBIT <DTPOSTED>20241111050000.000[-5:EST] <TRNAMT>-57.66 <FITID>2024111124492281005017 <NAME>CHEVRON 0098812 FAIRVIEW OR	2024-11	13	ai	441a8a871a9b308af4a55bce65fb57433165bd1dcee52913f9323f1a4ed04496	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:14.422641-06	\N	0.95	f
464	1	10	2024-11-12	CVS/PHARMACY #10422 GRESHAM OR	-8.99	f	<TRNTYPE>DEBIT <DTPOSTED>20241112050000.000[-5:EST] <TRNAMT>-8.99 <FITID>2024111224492273086016 <NAME>CVS/PHARMACY #10422 GRESHAM OR	2024-11	13	ai	1a2dbf266d646c3cfb005e310e826228122727d0e4b4d55ea0d29e5a25127c50	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:41.174769-06	\N	0.80	f
466	1	3	2024-11-12	PANDA EXPRESS #1912 GRESHAM OR	-42.26	f	<TRNTYPE>DEBIT <DTPOSTED>20241112050000.000[-5:EST] <TRNAMT>-42.26 <FITID>2024111224492288924018 <NAME>PANDA EXPRESS #1912 GRESHAM OR	2024-11	13	ai	59b216589f58ed79e3f00949c44639e9bc170175f3c9914e04cf3ceb06c9ca18	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:41.181467-06	\N	0.95	f
467	1	4	2024-11-12	CHEVRON 0098812 FAIRVIEW OR	-67.39	f	<TRNTYPE>DEBIT <DTPOSTED>20241112050000.000[-5:EST] <TRNAMT>-67.39 <FITID>2024111224492296843019 <NAME>CHEVRON 0098812 FAIRVIEW OR	2024-11	13	ai	65ef657532a1bd83eaf8e393380cf6f5f83ec1341c3aa6d09b6857969825a826	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:41.18235-06	\N	0.90	f
468	1	10	2024-11-13	CVS/PHARMACY #10422 GRESHAM OR	-46.81	f	<TRNTYPE>DEBIT <DTPOSTED>20241113050000.000[-5:EST] <TRNAMT>-46.81 <FITID>2024111324492304762020 <NAME>CVS/PHARMACY #10422 GRESHAM OR	2024-11	13	ai	e042c3b83645aefbb3c4d723da90f56765be9fd51858fb47d7bef738e98c4c1f	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:41.185272-06	\N	0.85	f
470	1	4	2024-11-15	LYFT *RIDE SAT 11PM, SAN FRANCIS	-36.43	f	<TRNTYPE>DEBIT <DTPOSTED>20241115050000.000[-5:EST] <TRNAMT>-36.43 <FITID>2024111524492320600022 <NAME>LYFT *RIDE SAT 11PM, SAN FRANCIS	2024-11	13	ai	6c02fdd3325e96657d8a115f498354d6e6e9514702f70ecb04413131313787f5	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:41.188358-06	\N	0.98	f
472	1	4	2024-11-15	ARCO #82211 AMPM GRESHAM OR	-62.04	f	<TRNTYPE>DEBIT <DTPOSTED>20241115050000.000[-5:EST] <TRNAMT>-62.04 <FITID>2024111524492336438024 <NAME>ARCO #82211 AMPM GRESHAM OR	2024-11	13	ai	eb89ff570b749aa954d972661c43e1f3e32022f32c90cec3d94a47b4d37539a5	2026-10-16 14:40:14.285268-06	2026-10-16 14:41:41.188742-06	\N	0.95	f
473	1	4	2024-11-18	LYFT *RIDE SAT 11PM, SAN FRANCIS	-34.55	f	<TRNTYPE>DEBIT <DTPOSTED>20241118050000.000[-5:EST] <TRNAMT>-34.55 <FITID>2024111824492344357025 <NAME>LYFT *RIDE SAT 11PM, SAN FRANCIS	2024-11	13	ai	386a6c9e29525d618ff2952427d04f3c5cc11ccd82dc1475c799cee952bd744f	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:06.324957-06	\N	0.98	f
477	1	5	2024-11-18	HULU 877-8244858 CA	-18.99	f	<TRNTYPE>DEBIT <DTPOSTED>20241118050000.000[-5:EST] <TRNAMT>-18.99 <FITID>2024111824492376033029 <NAME>HULU 877-8244858 CA	2024-11	13	ai	6992943b739594cd09f3271f0b8b49d89f899e08075b1873336e6230e932e57f	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:06.325537-06	\N	0.95	f
474	1	2	2024-11-19	TRADER JOE S #145 PORTLAND OR	-104.55	f	<TRNTYPE>DEBIT <DTPOSTED>20241119050000.000[-5:EST] <TRNAMT>-104.55 <FITID>2024111924492352276026 <NAME>TRADER JOE S #145 PORTLAND OR	2024-11	13	ai	c44732eb72a4d22003aa32974fa6d57d38882992719a33280d71167ac44b36e8	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:06.329397-06	\N	0.98	f
475	1	8	2024-11-19	CHEWY.COM 800-672-4399 FL	-41.82	f	<TRNTYPE>DEBIT <DTPOSTED>20241119050000.000[-5:EST] <TRNAMT>-41.82 <FITID>2024111924492360195027 <NAME>CHEWY.COM 800-672-4399 FL	2024-11	13	ai	7aeab08311fb37ab9b38fbd2d33cc041f4f5349f28bd5b08871f7193a843c37a	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:06.329851-06	\N	0.90	f
479	1	3	2024-11-21	PANDA EXPRESS #1912 GRESHAM OR	-67.16	f	<TRNTYPE>DEBIT <DTPOSTED>20241121050000.000[-5:EST] <TRNAMT>-67.16 <FITID>2024112124492391871031 <NAME>PANDA EXPRESS #1912 GRESHAM OR	2024-11	13	ai	8aa720d16c1285f2d6795e21628e1a9a2b5ca362a8b5dedbaeb1d8c575e17856	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:06.333643-06	\N	0.95	f
482	1	8	2024-11-22	PAYPAL *ETSY, INC 4029357733 CA	-91.67	f	<TRNTYPE>DEBIT <DTPOSTED>20241122050000.000[-5:EST] <TRNAMT>-91.67 <FITID>2024112224492415628034 <NAME>PAYPAL *ETSY, INC 4029357733 CA	2024-11	13	ai	097016af0103360e642b44eefe93e96aa1b1f9d902ca549b0ad1b16fa3abbc01	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:33.046302-06	\N	0.85	f
480	1	4	2024-11-23	LYFT *RIDE SAT 10PM, SAN FRANCIS	-37.47	f	<TRNTYPE>DEBIT <DTPOSTED>20241123050000.000[-5:EST] <TRNAMT>-37.47 <FITID>2024112324492399790032 <NAME>LYFT *RIDE SAT 10PM, SAN FRANCIS	2024-11	13	ai	9e0f75082c845913209aa4b035e3b029a1e7f18d3597310317bb31173ca9b9b6	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:33.048476-06	\N	0.95	f
596	1	4	2024-12-31	CHEVRON 0098812 FAIRVIEW OR	-67.25	f	12/31/2024,01/02/2025,CHEVRON 0098812 FAIRVIEW OR,Gas,Sale,-67.25	2024-12	17	ai	208dcfbae50705dfe316f8fef1a47e40311a8611c09f20ccc7b3a4d2a9b99e6e	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:50.484958-06	\N	0.90	f
502	2	2	2024-11-07	POS DEBIT 11/06 SAFEWAY #1544 FAIRVIEW OR	-40.85	f	11/07 POS DEBIT 11/06 SAFEWAY #1544 FAIRVIEW OR 40.85 5,713.15	2024-11	14	ai	a8f586919b97e66046232a8f452c4df580bed4e317ae4d57035996834c684965	2026-10-16 14:40:14.316313-06	2026-10-16 14:41:14.410102-06	\N	0.95	f
493	2	3	2024-11-01	POS DEBIT 11/01 DUTCH BROS #OR0212 FAIRVIEW OR	-12.18	f	11/01 POS DEBIT 11/01 DUTCH BROS #OR0212 FAIRVIEW OR 12.18 6,938.03	2024-11	14	ai	f1c4c520f9b7bade20f08724c03a5d3aa1261c31c14b216827bdfa05dbadb8ee	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:30.878729-06	\N	0.95	f
499	2	3	2024-11-04	DEBIT CARD PURCHASE 11/04 CHIPOTLE 2291 GRESHAM OR	-27.64	f	11/04 DEBIT CARD PURCHASE 11/04 CHIPOTLE 2291 GRESHAM OR 27.64 6,405.07	2024-11	14	ai	d27444a23d9c912f618f9f975d0b4e5363c2f94e1e269689904b810a4c90abb4	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:31.609573-06	\N	0.95	f
507	2	3	2024-11-08	DEBIT CARD PURCHASE 11/08 SUBWAY 00412290 GRESHAM OR	-58.82	f	11/08 DEBIT CARD PURCHASE 11/08 SUBWAY 00412290 GRESHAM 58.82 5,215.82\nOR	2024-11	14	ai	724a57894112c3cb53d71c789c13ab8cc011f77b6e2159ea2a2d352e81b8806c	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:31.934296-06	\N	0.98	f
496	2	1	2024-11-04	ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 6610023385	-188.42	f	11/04 ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 188.42 6,640.86\n6610023385	2024-11	14	ai	a25d06baa60cf00af34670dfdd92297c28da29e720a17237dc848914def571c7	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:34.35337-06	\N	0.95	f
503	2	3	2024-11-07	DEBIT CARD PURCHASE 11/06 TST* LUIGIS TRATTORIA FAIRVIEW OR	-62.69	f	11/07 DEBIT CARD PURCHASE 11/06 TST* LUIGIS TRATTORIA 62.69 5,650.46\nFAIRVIEW OR	2024-11	14	ai	0a5924ba8d1d3be59ea601f83ed738feaa649fcb7b83a7cd14a4c2c29f9fdf66	2026-10-16 14:40:14.316313-06	2026-10-16 14:41:14.415118-06	\N	0.98	f
505	2	10	2024-11-08	CHECK #1044	-160.00	f	11/08 CHECK #1044 160.00 5,338.30	2024-11	14	ai	44ec6d9f1c480cbe000efceb1870e78b586638f3e82409e0b64d0b911140c0b7	2026-10-16 14:40:14.316313-06	2026-10-16 14:41:14.418135-06	\N	0.85	f
508	2	2	2024-11-11	DEBIT CARD PURCHASE 11/11 SAFEWAY #1544 FAIRVIEW OR	-39.21	f	11/11 DEBIT CARD PURCHASE 11/11 SAFEWAY #1544 FAIRVIEW OR 39.21 5,176.61	2024-11	14	ai	0bd4b73e2be94352318c525f2e15b0790b907463c97f42c80b51bfb12f8bbeae	2026-10-16 14:40:14.316313-06	2026-10-16 14:41:14.423082-06	\N	0.95	f
509	2	6	2024-11-12	ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 3300298811	-94.91	f	11/12 ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 94.91 5,081.70\n3300298811	2024-11	14	ai	bdefc8dd591d507aca5bea16792bdc3ec5ba54523964605639aa9c981efbe693	2026-10-16 14:40:14.316313-06	2026-10-16 14:41:41.182825-06	\N	0.98	f
483	1	3	2024-11-23	UBER *EATS PENDING HELP.UBER.COM	-43.56	f	<TRNTYPE>DEBIT <DTPOSTED>20241123050000.000[-5:EST] <TRNAMT>-43.56 <FITID>2024112324492423547035 <NAME>UBER *EATS PENDING HELP.UBER.COM	2024-11	13	ai	e7d81543562a6cbb48edc70d9502a1a75dd58b374f5398a076a25a85d945be6a	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:33.048909-06	\N	0.90	f
484	1	3	2024-11-25	DOORDASH*BURGERVILLE #12	-51.75	f	<TRNTYPE>DEBIT <DTPOSTED>20241125050000.000[-5:EST] <TRNAMT>-51.75 <FITID>2024112524492431466036 <NAME>DOORDASH*BURGERVILLE #12	2024-11	13	ai	6470a04f3f709e367c527d65cb7a40583acfc865ea9cff38f346114909a3dec1	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:33.05126-06	\N	0.95	f
486	1	2	2024-11-26	TRADER JOE S #145 PORTLAND OR	-56.27	f	<TRNTYPE>DEBIT <DTPOSTED>20241126050000.000[-5:EST] <TRNAMT>-56.27 <FITID>2024112624492447304038 <NAME>TRADER JOE S #145 PORTLAND OR	2024-11	13	ai	6e2b93b8a5fd616901531a064f5f83dc2fadf2d3297b9411f7b9f96699d555ae	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:33.053418-06	\N	0.95	f
487	1	8	2024-11-28	CHEWY.COM 800-672-4399 FL	-133.12	f	<TRNTYPE>DEBIT <DTPOSTED>20241128050000.000[-5:EST] <TRNAMT>-133.12 <FITID>2024112824492455223039 <NAME>CHEWY.COM 800-672-4399 FL	2024-11	13	ai	d585f3535e704121ee494f9fe72cdc1267eb9198677c9e6891202943a733f982	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:56.033039-06	\N	0.90	f
488	1	2	2024-11-28	TRADER JOE S #145 PORTLAND OR	-184.77	f	<TRNTYPE>DEBIT <DTPOSTED>20241128050000.000[-5:EST] <TRNAMT>-184.77 <FITID>2024112824492463142040 <NAME>TRADER JOE S #145 PORTLAND OR	2024-11	13	ai	a5bf91bce669fcfe2d43fd92a198f147fff224b0fefd2aa2883b755613f71e55	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:56.033521-06	\N	0.90	f
489	1	2	2024-12-01	TRADER JOE S #145 PORTLAND OR	-28.22	f	<TRNTYPE>DEBIT <DTPOSTED>20241201050000.000[-5:EST] <TRNAMT>-28.22 <FITID>2024120124492471061041 <NAME>TRADER JOE S #145 PORTLAND OR	2024-11	13	ai	4200fa42fd2961995873ca44593fe2b0339121aaabf69e15b1e79b772a498e81	2026-10-16 14:40:14.285268-06	2026-10-16 14:42:56.037155-06	\N	0.90	f
491	2	1	2024-11-01	ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 4417730021	-2385.00	f	11/01 ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 2,385.00 6,961.80\n4417730021	2024-11	14	rule	358fad95043aecdf9ff30f5cc116143dc7ffc9251528813658738d7d2ecaecd8	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.361923-06	\N	\N	f
494	2	4	2024-11-02	POS DEBIT 11/02 SHELL OIL 57442	-61.95	f	11/02 POS DEBIT 11/02 SHELL OIL 57442 61.95 6,876.08	2024-11	14	rule	09cd940c954f6bf86eb51a73755ba004777fb50ceb9f3b1e82cd43d950c1555f	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.362233-06	\N	\N	f
504	2	6	2024-11-08	ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 9300012231	-152.16	f	11/08 ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 152.16 5,498.30\n9300012231	2024-11	14	rule	1f91584ba11d2c43604b2c0263a4621cb4e5d68299789aaca9a46be2af136cd4	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.363158-06	\N	\N	f
506	2	4	2024-11-08	POS DEBIT 11/07 SHELL OIL 57442	-63.66	f	11/08 POS DEBIT 11/07 SHELL OIL 57442 63.66 5,274.64	2024-11	14	rule	f580003b598e1abacc66df60732871b1ae4af8daab4e4ce953d4efdec00f51aa	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.363468-06	\N	\N	f
500	2	9	2024-11-05	ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS XXXXXX4471 REF #IBZSZZ5HW	-500.00	f	11/05 ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS 500.00 5,905.07\nXXXXXX4471 REF #IBZSZZ5HW	2024-11	14	transfer	3704b7a1a1ff1e050ea24d7aa9fb76218d9f8d97b4e7269fe7c003e6c467c34d	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.374099-06	543	\N	f
485	1	9	2024-11-25	AUTOMATIC PAYMENT - THANK YOU	2830.43	f	<TRNTYPE>CREDIT <DTPOSTED>20241125050000.000[-5:EST] <TRNAMT>2830.43 <FITID>2024112524492439385037 <NAME>AUTOMATIC PAYMENT - THANK YOU	2024-11	13	transfer	88351dda24eb8e47f9cb159475180cbc02d3e608327246b459dc259a89d7dc17	2026-10-16 14:40:14.285268-06	2026-10-16 14:40:14.376149-06	534	\N	f
492	2	3	2024-11-01	POS DEBIT 11/01 SQ *CASCADE ROASTERS FAIRVIEW OR	-11.59	f	11/01 POS DEBIT 11/01 SQ *CASCADE ROASTERS FAIRVIEW OR 11.59 6,950.21	2024-11	14	ai	9f213774f240686adba99dc2417e0b262bc7c8aaf7b68a1dfdc881e1a3a4fb29	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:46.600819-06	\N	0.95	f
495	2	4	2024-11-03	POS DEBIT 11/03 ARCO #82211 AMPM	-46.80	f	11/03 POS DEBIT 11/03 ARCO #82211 AMPM 46.80 6,829.28	2024-11	14	ai	b893801d2fa1e3328fcd1a8e939013452ae40257548a356d90e9794e802f3bf9	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:46.601892-06	\N	0.90	f
501	2	2	2024-11-06	DEBIT CARD PURCHASE 11/05 SAFEWAY #1544 FAIRVIEW OR	-151.07	f	11/06 DEBIT CARD PURCHASE 11/05 SAFEWAY #1544 FAIRVIEW OR 151.07 5,754.00	2024-11	14	ai	5bdfe902bdfe53a082e24eb0af2d18fe0724e5c3b0712c273efbdb6aab9ffd0f	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:46.608374-06	\N	0.95	f
514	2	3	2024-11-13	DEBIT CARD PURCHASE 11/12 DUTCH BROS #OR0212 FAIRVIEW OR	-11.11	f	11/13 DEBIT CARD PURCHASE 11/12 DUTCH BROS #OR0212 11.11 6,240.98\nFAIRVIEW OR	2024-11	14	ai	ebd177cda6a65bb25deb6635c9c8480efcaa1df6004e5a9a1ed2549f719395fc	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:30.878729-06	\N	0.95	f
518	2	3	2024-11-15	DEBIT CARD PURCHASE 11/15 SQ *CASCADE ROASTERS FAIRVIEW OR	-5.41	f	11/15 DEBIT CARD PURCHASE 11/15 SQ *CASCADE ROASTERS 5.41 10,986.14\nFAIRVIEW OR	2024-11	14	ai	b619d7ae643193b7c70cfdd35e45a116284e4d8cb2c4d6deab9f5e0ba7664665	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
523	2	3	2024-11-18	POS DEBIT 11/17 SQ *CASCADE ROASTERS FAIRVIEW OR	-9.65	f	11/18 POS DEBIT 11/17 SQ *CASCADE ROASTERS FAIRVIEW OR 9.65 10,778.86	2024-11	14	ai	3b786711fdcf105239bd3beb1706a2888f956332befdc239afa38b20b27e0eab	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:31.054101-06	\N	0.92	f
528	2	3	2024-11-20	DEBIT CARD PURCHASE 11/19 SQ *CASCADE ROASTERS FAIRVIEW OR	-4.60	f	11/20 DEBIT CARD PURCHASE 11/19 SQ *CASCADE ROASTERS 4.60 7,341.89\nFAIRVIEW OR	2024-11	14	ai	04ab2c2aa118a40473606b7dcf2a82394ae766e9a5d268132c335e6ac358040d	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:31.054101-06	\N	0.92	f
512	2	2	2024-11-12	DEBIT CARD PURCHASE 11/09 FRED-MEYER #0651 GRESHAM OR	-145.98	f	11/12 DEBIT CARD PURCHASE 11/09 FRED-MEYER #0651 GRESHAM 145.98 6,330.72\nOR	2024-11	14	ai	ce2a357122789da4481978638eb25ffaf5bcdd0581ad312736ce0e840de28eaa	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:32.57709-06	\N	0.95	f
510	2	7	2024-11-12	ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 8830021147	1350.00	f	11/12 ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 1,350.00 6,431.70\n8830021147	2024-11	14	ai	2b501de09cdfa79cb821a487928bd879be601153ea437713e850a0748b2c0b03	2026-10-16 14:40:14.316313-06	2026-10-16 14:41:41.183251-06	\N	0.98	f
511	2	7	2024-11-12	VENMO CASHOUT PPD ID: 5264681992	45.00	f	11/12 VENMO CASHOUT PPD ID: 5264681992 45.00 6,476.70	2024-11	14	ai	79e9f7b34a6be8a422c1788ee8368158cf58f0ac84f20e3737a7a897aff2720a	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:35.897606-06	\N	0.95	f
513	2	2	2024-11-12	DEBIT CARD PURCHASE 11/12 WINCO FOODS #112 GRESHAM OR	-78.63	f	11/12 DEBIT CARD PURCHASE 11/12 WINCO FOODS #112 GRESHAM 78.63 6,252.09\nOR	2024-11	14	ai	e3574d9fca2f7fcd49751f58dd5161d1cc236e392f3631e731cf918faba05e6a	2026-10-16 14:40:14.316313-06	2026-10-16 14:41:41.184801-06	\N	0.95	f
532	2	4	2024-11-23	POS DEBIT 11/23 SHELL OIL 57442	-44.29	f	11/23 POS DEBIT 11/23 SHELL OIL 57442 44.29 7,048.88	2024-11	14	rule	5660f592151e5b34fc0e7e809cc9c79ea546d98c7f5f8627ec2450e9af432671	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.367377-06	\N	\N	f
527	2	9	2024-11-20	ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# RF8HLJNX	-3246.91	f	11/20 ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# 3,246.91 7,346.49\nRF8HLJNX	2024-11	14	transfer	f92d8bbbac8a73b59cb0bda2fdba6e2d345b56a270922989fe9bf2ac434a161b	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.375136-06	545	\N	f
534	2	9	2024-11-26	HARBOR CARD AUTOPAY PPD ID: 7781000231	-2830.43	f	11/26 HARBOR CARD AUTOPAY PPD ID: 7781000231 2,830.43 4,123.17	2024-11	14	transfer	64861e259112044ab20b5af0240e107b7e343cfd9ca61979ac2dd875d15c2edb	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.376149-06	485	\N	f
520	2	6	2024-11-18	RIVERNET BROADBAND AUTOPAY 800-555-0142	-79.99	f	11/18 RIVERNET BROADBAND AUTOPAY 800-555-0142 79.99 10,896.03	2024-11	14	ai	138e0c6ecea0f799657e91907d6d4048bccb7418270f2229005c7d8493324876	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:06.32603-06	\N	0.98	f
521	2	10	2024-11-18	ATM WITHDRAWAL 11/16 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-100.00	f	11/18 ATM WITHDRAWAL 11/16 MAPLE FEDERAL ATM #2210 2210 100.00 10,796.03\nMAIN ST FAIRVIEW OR	2024-11	14	ai	b2cc583eafd1c4d7e6830f46f0403ea347a87a5da64102a337b94fe8ce1e7639	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:06.326525-06	\N	0.85	f
524	2	2	2024-11-18	DEBIT CARD PURCHASE 11/17 SAFEWAY #1544 FAIRVIEW OR	-26.87	f	11/18 DEBIT CARD PURCHASE 11/17 SAFEWAY #1544 FAIRVIEW OR 26.87 10,751.99	2024-11	14	ai	9f08c216748ed4819d5be2a5e681198d0401bfbd37ad0ab5f1b51c20e133cb43	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:06.327982-06	\N	0.95	f
525	2	2	2024-11-19	DEBIT CARD PURCHASE 11/18 GROCERY OUTLET #388 GRESHAM OR	-101.89	f	11/19 DEBIT CARD PURCHASE 11/18 GROCERY OUTLET #388 101.89 10,650.10\nGRESHAM OR	2024-11	14	ai	5a757e8a17c458d42c8b0bf394151543c491e33caf3f3dd5f4910450b3cc565c	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:06.330286-06	\N	0.98	f
526	2	2	2024-11-19	DEBIT CARD PURCHASE 11/19 WINCO FOODS #112 GRESHAM OR	-56.70	f	11/19 DEBIT CARD PURCHASE 11/19 WINCO FOODS #112 GRESHAM 56.70 10,593.40\nOR	2024-11	14	ai	0ab6938c445c1ed5f2c7eec30b0e062403818c2ba05d3e8b1946e3c42630ccd4	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:06.330743-06	\N	0.98	f
529	2	6	2024-11-22	ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190	-142.67	f	11/22 ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190 142.67 7,199.22	2024-11	14	ai	2c20088625a3d38000e6eabb9c8c57871fc665e4546b1f9baa5ee677a7300ae2	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:33.046953-06	\N	0.90	f
530	2	2	2024-11-22	DEBIT CARD PURCHASE 11/21 WINCO FOODS #112 GRESHAM OR	-64.93	f	11/22 DEBIT CARD PURCHASE 11/21 WINCO FOODS #112 GRESHAM 64.93 7,134.29\nOR	2024-11	14	ai	0be9aa8f6404a59567eff1a83ae462b5e66bdcc4c01a4a91a1a821103854b7b1	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:33.047461-06	\N	0.95	f
531	2	4	2024-11-23	POS DEBIT 11/23 CHEVRON 0098812 FAIRVIEW OR	-41.12	f	11/23 POS DEBIT 11/23 CHEVRON 0098812 FAIRVIEW OR 41.12 7,093.17	2024-11	14	ai	ad8d4ca70200b959b66fb3ad285aa115eb949a2d42fcb7bbcfbdf42b2d101645	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:33.04932-06	\N	0.95	f
533	2	2	2024-11-25	DEBIT CARD PURCHASE 11/24 WINCO FOODS #112 GRESHAM OR	-95.28	f	11/25 DEBIT CARD PURCHASE 11/24 WINCO FOODS #112 GRESHAM 95.28 6,953.60\nOR	2024-11	14	ai	e9a296999789555340acfedfa9b97072d17c3b9bb1730d5cbd15152d20a06a16	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:33.051673-06	\N	0.95	f
536	2	3	2024-11-28	DEBIT CARD PURCHASE 11/28 SQ *CASCADE ROASTERS FAIRVIEW OR	-11.90	f	11/28 DEBIT CARD PURCHASE 11/28 SQ *CASCADE ROASTERS 11.90 4,104.09\nFAIRVIEW OR	2024-11	14	ai	c73826f40c9f8a2eb4af3d0f078ba1e530488dba88a8322cf939220305843136	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:56.033969-06	\N	0.95	f
537	2	2	2024-11-28	DEBIT CARD PURCHASE 11/28 WINCO FOODS #112 GRESHAM OR	-53.90	f	11/28 DEBIT CARD PURCHASE 11/28 WINCO FOODS #112 GRESHAM 53.90 4,050.19\nOR	2024-11	14	ai	87b8e8d2f6c72c26638877b2a93d93d0b60f2effcdef21432dcdf1646c6a58a1	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:56.034735-06	\N	0.95	f
551	4	2	2024-11-07	NEW SEASONS MARKET FAIRVIEW OR	-57.80	f	11/07 11/07 NEW SEASONS MARKET FAIRVIEW OR 57.80	2024-11	16	ai	43b662bb85770ea71b03835915df7cab51722129e437c201a47c1cd749813c81	2026-10-16 14:40:14.348274-06	2026-10-16 14:41:14.415636-06	\N	0.95	f
553	4	2	2024-11-07	NEW SEASONS MARKET FAIRVIEW OR	-145.44	f	11/07 11/08 NEW SEASONS MARKET FAIRVIEW OR 145.44	2024-11	16	ai	73378bd2e7ac7adce6a4afa0de5e348be49789c1b0736ccb8db3eb0f8d2bffb8	2026-10-16 14:40:14.348274-06	2026-10-16 14:41:14.416093-06	\N	0.95	f
554	4	2	2024-11-07	SAFEWAY #1544 FAIRVIEW OR	-253.22	f	11/07 11/09 SAFEWAY #1544 FAIRVIEW OR 253.22	2024-11	16	ai	9b334830cde219bdccf60e03c533b286ce28cc449c6b0b403919b4013791036c	2026-10-16 14:40:14.348274-06	2026-10-16 14:41:14.416539-06	\N	0.95	f
565	4	3	2024-11-18	STARBUCKS STORE 05521 GRESHAM OR	-7.82	f	11/18 11/18 STARBUCKS STORE 05521 GRESHAM OR 7.82	2024-11	16	ai	c0ac582168350c0b547076a2a036ae5dd43b73fc6e79a10d186c2a22c5175728	2026-10-16 14:40:14.348274-06	2026-10-16 14:49:30.815292-06	\N	0.90	f
555	4	5	2024-11-09	SPOTIFY USA 877-778-1161 NY	-16.99	f	11/09 11/09 SPOTIFY USA 877-778-1161 NY 16.99	2024-11	16	ai	643e31d2d91624f6b03824f0da8198fe591439661bccfd30c7738164d57f0743	2026-10-16 14:40:14.348274-06	2026-10-16 14:41:14.419531-06	\N	0.95	f
559	4	3	2024-11-13	SQ *CASCADE ROASTERS FAIRVIEW OR	-12.15	f	11/13 11/14 SQ *CASCADE ROASTERS FAIRVIEW OR 12.15	2024-11	16	ai	30ecb70ba3f3273b249183b4749bdea88f5a6bb55ae514270cc080599d4023b8	2026-10-16 14:40:14.348274-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
556	4	2	2024-11-11	NEW SEASONS MARKET FAIRVIEW OR	-237.73	f	11/11 11/11 NEW SEASONS MARKET FAIRVIEW OR 237.73	2024-11	16	ai	f423f27fb2a70011cb018abc1cf7a0595b4a52e918b23195e9bf44e462efe403	2026-10-16 14:40:14.348274-06	2026-10-16 14:41:14.423522-06	\N	0.95	f
560	4	4	2024-11-14	COSTCO GAS #0681 WOOD VILLAGE OR	-50.66	f	11/14 11/14 COSTCO GAS #0681 WOOD VILLAGE OR 50.66	2024-11	16	ai	525ffd99f16370d5a5aaa16eb0482609a54707eb57769a7f9b7f4c8898a6bccf	2026-10-16 14:40:14.348274-06	2026-10-16 14:41:41.187568-06	\N	0.90	f
566	4	3	2024-11-18	OLIVE GARDEN 0012345 GRESHAM OR	-47.20	f	11/18 11/18 OLIVE GARDEN 0012345 GRESHAM OR 47.20	2024-11	16	ai	02354d82e6c7dcd864373bc5d84185f603972785c1e278631cc6b5d85eb200f3	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:06.328937-06	\N	0.95	f
564	4	3	2024-11-17	TST* PINE STATE BISCUITS PORTLAND OR	-81.80	f	11/17 11/17 TST* PINE STATE BISCUITS PORTLAND OR 81.80	2024-11	16	ai	7121465fb215717fa5b9e937a2ce60c04ea72299d7480ff4fdfa6fa8b1d187c9	2026-10-16 14:40:14.348274-06	2026-10-16 14:49:31.123945-06	\N	0.95	f
569	4	3	2024-11-19	OLIVE GARDEN 0012345 GRESHAM OR	-28.51	f	11/19 11/20 OLIVE GARDEN 0012345 GRESHAM OR 28.51	2024-11	16	ai	29a551d05f259c274af3cc7b1c6c104e4fffe2d3421deeb7898e81186e573f59	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:06.331613-06	\N	0.95	f
546	4	3	2024-11-03	OLIVE GARDEN 0012345 GRESHAM OR	-37.45	f	11/03 11/05 OLIVE GARDEN 0012345 GRESHAM OR 37.45	2024-11	16	ai	32a04ca45eeaf863d9aa18dad7078de97e51a5166d523eaf15fad79c7de58f18	2026-10-16 14:40:14.348274-06	2026-10-16 14:49:31.374329-06	\N	0.90	f
541	2	3	2024-11-29	DEBIT CARD PURCHASE 11/29 CHIPOTLE 2291 GRESHAM OR	-59.81	f	11/29 DEBIT CARD PURCHASE 11/29 CHIPOTLE 2291 GRESHAM OR 59.81 8,709.73	2024-11	14	ai	6e1475b27baf25480d4dbee74ff29f8c191b24f6f16674c7ca2c345210aca18f	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:56.035622-06	\N	0.95	f
542	2	7	2024-11-30	INTEREST PAYMENT	0.30	f	11/30 INTEREST PAYMENT 0.30 8,710.03	2024-11	14	ai	f857a2c24138d133a567294aab8708175c3d6c25f87e0e17d04790e74672cf1e	2026-10-16 14:40:14.316313-06	2026-10-16 14:42:56.036392-06	\N	0.90	f
544	3	7	2024-11-30	INTEREST PAYMENT	5.89	f	2024-11-30 INTEREST PAYMENT 5.89	2024-11	15	ai	e5df25209e72def858be788f7ca45b24a847ae65d7b771fcf220194231541d7d	2026-10-16 14:40:14.330278-06	2026-10-16 14:42:56.036777-06	\N	0.90	f
558	4	2	2024-11-12	COSTCO WHSE #0681 WOOD VILLAGE OR	-146.34	f	11/12 11/13 COSTCO WHSE #0681 WOOD VILLAGE OR 146.34	2024-11	16	rule	860f093e8c7c413cedabdcfc31cbed9c2eca8832083a475fa438962ad9961a5e	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.363911-06	\N	\N	f
561	4	5	2024-11-15	NETFLIX.COM 866-579-7172 CA	-22.99	f	11/15 11/15 NETFLIX.COM 866-579-7172 CA 22.99	2024-11	16	rule	335570b635057aefdc41c4e6ea17b7a5c49c8a0dc6f1b29b1413ce3be8bc84de	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.364935-06	\N	\N	f
562	4	8	2024-11-15	AMZN Mktp US*01HGLC Amzn.com/bill WA	-79.76	f	11/15 11/15 AMZN Mktp US*01HGLC Amzn.com/bill WA 79.76	2024-11	16	rule	5c2d50a9991b7aaae12c4e6011d7566bb77b63d733b565ac9534d285d632df53	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.365246-06	\N	\N	f
563	4	8	2024-11-15	AMZN Mktp US*14B1PV Amzn.com/bill WA	-27.94	f	11/15 11/16 AMZN Mktp US*14B1PV Amzn.com/bill WA 27.94	2024-11	16	rule	2679a5579e6d7793a62271adf25d70314d3b6770d4c903de507bb99f0a0cd827	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.365591-06	\N	\N	f
567	4	4	2024-11-17	SHELL OIL 57442110021 FAIRVIEW OR	-48.14	f	11/17 11/19 SHELL OIL 57442110021 FAIRVIEW OR 48.14	2024-11	16	rule	afd2e42235f9a70d7c1e045e836e8e5c4b31f73f4744980c93b9647527844afb	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.365913-06	\N	\N	f
568	4	4	2024-11-19	SHELL OIL 57442110021 FAIRVIEW OR	-71.97	f	11/19 11/19 SHELL OIL 57442110021 FAIRVIEW OR 71.97	2024-11	16	rule	c6a79619fcb2071efa861a2cba4caa6a554e70631c8fa1810f846bbcc95478d3	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.366385-06	\N	\N	f
538	2	7	2024-11-29	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	11/29 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 6,896.34\n9100234517	2024-11	14	rule	b963dfe952e42e36e2ec0b5b2eed0d601d48797f3e79bcb740110321c5e269a0	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.368568-06	\N	\N	f
539	2	7	2024-11-29	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	11/29 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 8,808.74\n5520017784	2024-11	14	rule	240f45107128a2f284f68bbebb09824a6cfd620af9c76e56b9dc60cab00d9c24	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.369151-06	\N	\N	f
540	2	4	2024-11-29	POS DEBIT 11/27 SHELL OIL 57442	-39.20	f	11/29 POS DEBIT 11/27 SHELL OIL 57442 39.20 8,769.54	2024-11	14	rule	4d804d22f37daa1245919696afaf60c5260a2d6a6476b7f0bc172f8dc610835d	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.369519-06	\N	\N	f
543	3	9	2024-11-06	ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290	500.00	f	2024-11-06 ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290 500.00	2024-11	15	transfer	84a0b32bf051afe194c1621ac688d12827ac56ea8e49b2accb6ffa8ff6abd157	2026-10-16 14:40:14.330278-06	2026-10-16 14:40:14.374099-06	500	\N	f
545	4	9	2024-11-21	PAYMENT THANK YOU - WEB	3246.91	f	11/21 11/21 PAYMENT THANK YOU - WEB -3,246.91	2024-11	16	transfer	f2b42f013d3ccac9c9df105e903ae8b21ce76db96b603fc541dfd7775770ceb4	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.375136-06	527	\N	f
547	4	2	2024-11-05	SAFEWAY #1544 FAIRVIEW OR	-39.26	f	11/05 11/05 SAFEWAY #1544 FAIRVIEW OR 39.26	2024-11	16	ai	607c7febbbd1017b820fe71de33b47a77fe9d33770795ecc233e184fd9864b23	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:46.607351-06	\N	0.95	f
550	4	2	2024-11-06	NEW SEASONS MARKET FAIRVIEW OR	-92.60	f	11/06 11/07 NEW SEASONS MARKET FAIRVIEW OR 92.60	2024-11	16	ai	fb38d744f8c2597a4829a05536c7a8b95f02a85fc6753a82e346b189dd268d7d	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:46.608891-06	\N	0.95	f
552	4	2	2024-11-06	SAFEWAY #1544 FAIRVIEW OR	-93.89	f	11/06 11/08 SAFEWAY #1544 FAIRVIEW OR 93.89	2024-11	16	ai	27e3090e6475588ea712d1ab2e6a1756883996aac679149a88f43e98709c298b	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:46.609341-06	\N	0.95	f
587	4	3	2024-11-29	STARBUCKS STORE 05521 GRESHAM OR	-13.83	f	11/29 11/30 STARBUCKS STORE 05521 GRESHAM OR 13.83	2024-11	16	ai	c7a1aa4a168bec02b3f49e00c2d8be966a728316bc4994e4a012c6227d70169e	2026-10-16 14:40:14.348274-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
579	4	3	2024-11-24	SQ *CASCADE ROASTERS FAIRVIEW OR	-12.82	f	11/24 11/26 SQ *CASCADE ROASTERS FAIRVIEW OR 12.82	2024-11	16	ai	f97f9f993ec0b7d3e632fe725ee122608fc109144f898d1d5820928554b47272	2026-10-16 14:40:14.348274-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
574	4	3	2024-11-23	TST* PINE STATE BISCUITS PORTLAND OR	-36.92	f	11/23 11/24 TST* PINE STATE BISCUITS PORTLAND OR 36.92	2024-11	16	ai	4d49921738737fd44c6afed499800b38ca1cd29a3039d30b074f3bf36ca079bf	2026-10-16 14:40:14.348274-06	2026-10-16 14:49:31.123945-06	\N	0.90	f
450	1	5	2024-11-04	APPLE.COM/BILL 866-712-7753 CA	-9.99	f	<TRNTYPE>DEBIT <DTPOSTED>20241104050000.000[-5:EST] <TRNAMT>-9.99 <FITID>2024110424492162220002 <NAME>APPLE.COM/BILL 866-712-7753 CA	2024-11	13	ai	c273c037edb06b755344a91b91b063ca52a1b3c749f6585f541f583cc9ddfc6c	2026-10-16 14:40:14.285268-06	2026-10-16 14:49:33.446938-06	\N	0.85	f
572	4	5	2024-11-21	DISNEY PLUS 888-905-7888 CA	-13.99	f	11/21 11/22 DISNEY PLUS 888-905-7888 CA 13.99	2024-11	16	ai	62395a2e10a10bafff6dfda6803c9a33185708600f87812c0a621a7e3aca69ab	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:33.039571-06	\N	0.95	f
585	4	5	2024-11-27	FAIRVIEW PARKS & REC ONLINE REGISTRATION 503-555-0199 OR	-145.00	f	11/27 11/29 FAIRVIEW PARKS & REC ONLINE REGISTRATION 503-555-0199 145.00\nOR	2024-11	16	ai	145ab5d824506d21478781b16e46f452750a7571fd9783780002805b2d71ee73	2026-10-16 14:40:14.348274-06	2026-10-16 14:49:33.735704-06	\N	0.85	f
573	4	2	2024-11-22	NEW SEASONS MARKET FAIRVIEW OR	-52.71	f	11/22 11/24 NEW SEASONS MARKET FAIRVIEW OR 52.71	2024-11	16	ai	e52bf00839593aa85cae3bb221f616d9128dc9bd7ae1aa2f452e064f2ebc88a4	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:33.047981-06	\N	0.90	f
575	4	3	2024-11-23	PIZZICATO #14 PORTLAND OR	-54.28	f	11/23 11/24 PIZZICATO #14 PORTLAND OR 54.28	2024-11	16	ai	f989d6bcac96b9b0a5d5e58f1e4f48460d01fee734ee35078ef25529946319a7	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:33.050434-06	\N	0.95	f
490	2	7	2024-11-01	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	11/01 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 9,346.80\n9100234517	2024-11	14	rule	2cb0977e55400c6d881b38b0da9ba4491793a68ead1115323c73c88a28a31c99	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.36128-06	\N	\N	f
549	4	8	2024-11-06	AMZN Mktp US*FA3DEC Amzn.com/bill WA	-90.68	f	11/06 11/06 AMZN Mktp US*FA3DEC Amzn.com/bill WA 90.68	2024-11	16	rule	b4fe63370bc3a120d1813e4f0b73c152ec448b6f3b8f21fbea81498165856ff6	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.362748-06	\N	\N	f
516	2	7	2024-11-15	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	11/15 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 9,079.15\n9100234517	2024-11	14	rule	e4a6475c7c6b7230518321bedffb6457a7beb56b8833dccd37c314044638ce34	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.364288-06	\N	\N	f
517	2	7	2024-11-15	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	11/15 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 10,991.55\n5520017784	2024-11	14	rule	6376e1b84b0aee5e548bdc1a4326ed87ca6b1c852df50e48ab5736e812e13776	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:14.364607-06	\N	\N	f
576	4	8	2024-11-24	AMZN Mktp US*K3KHXF Amzn.com/bill WA	-89.36	f	11/24 11/25 AMZN Mktp US*K3KHXF Amzn.com/bill WA 89.36	2024-11	16	rule	c09c4120c218eec7bf5d239dbf8ca1b5cac9d26431f535425a0310631845942b	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.367734-06	\N	\N	f
584	4	8	2024-11-27	AMZN Mktp US*BTYAVR Amzn.com/bill WA	-112.60	f	11/27 11/28 AMZN Mktp US*BTYAVR Amzn.com/bill WA 112.60	2024-11	16	rule	076671d97af3c98d851b176bb2290c010166c943500c6b27269f6b750049d31c	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.368107-06	\N	\N	f
589	4	2	2024-12-01	COSTCO WHSE #0681 WOOD VILLAGE OR	-96.30	f	12/01 12/03 COSTCO WHSE #0681 WOOD VILLAGE OR 96.30	2024-11	16	rule	edc965cdd55e48728d0cb10073453d356ebffa90d8c95f8c3c889d378455daf0	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.369853-06	\N	\N	f
592	4	2	2024-12-02	COSTCO WHSE #0681 WOOD VILLAGE OR	-49.68	f	12/02 12/04 COSTCO WHSE #0681 WOOD VILLAGE OR 49.68	2024-11	16	rule	4ff73409724fddfc4c3a424a0065ce07f95964a98dc1b21a8e9d420d59effed5	2026-10-16 14:40:14.348274-06	2026-10-16 14:40:14.370154-06	\N	\N	f
449	1	2	2024-11-01	TRADER JOE S #145 PORTLAND OR	-157.71	f	<TRNTYPE>DEBIT <DTPOSTED>20241101050000.000[-5:EST] <TRNAMT>-157.71 <FITID>2024110124492154301001 <NAME>TRADER JOE S #145 PORTLAND OR	2024-11	13	ai	2b77c1d2c9f9e73c1f09aac8fa0898aacec57c232f3ea7050635232a57e38e38	2026-10-16 14:40:14.285268-06	2026-10-16 14:40:46.599859-06	\N	0.95	f
577	4	3	2024-11-25	PIZZICATO #14 PORTLAND OR	-75.09	f	11/25 11/25 PIZZICATO #14 PORTLAND OR 75.09	2024-11	16	ai	c1ab39907b708a125c603dcce2d0c0be6906732e86640fab6aba3c5ad1cc91d4	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:33.052091-06	\N	0.95	f
578	4	8	2024-11-25	KOHL'S #1129 GRESHAM OR	-106.93	f	11/25 11/25 KOHL'S #1129 GRESHAM OR 106.93	2024-11	16	ai	7a16cf921e4bda5a15cea0b0296dceac334094fff1c87813c3605cf0d499de01	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:33.052525-06	\N	0.90	f
580	4	2	2024-11-25	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-8.79	f	11/25 11/26 SQ *BLUE BOTTLE COFFEE OAKLAND CA 8.79	2024-11	16	ai	e67a9c7c4a73e67431ff1b712bbb92223e90273acb5206e89a9f7debc3aa98b7	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:33.052978-06	\N	0.90	f
583	4	4	2024-11-26	COSTCO GAS #0681 WOOD VILLAGE OR	-67.46	f	11/26 11/28 COSTCO GAS #0681 WOOD VILLAGE OR 67.46	2024-11	16	ai	0cf83fef1d6ff5429b1ede33c3717f0d5f520c6e7f99e62e9ed17858410e21fa	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:33.054322-06	\N	0.90	f
581	4	3	2024-11-27	SQ *TACO PEDRO GRESHAM OR	-28.49	f	11/27 11/27 SQ *TACO PEDRO GRESHAM OR 28.49	2024-11	16	ai	5eb06d254f2984542a4ed28b13e0370fe7812a04057367c2640d5779dae38a05	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:56.031113-06	\N	0.95	f
582	4	3	2024-11-27	SQ *CASCADE ROASTERS FAIRVIEW OR	-4.83	f	11/27 11/27 SQ *CASCADE ROASTERS FAIRVIEW OR 4.83	2024-11	16	ai	7e98e1147d4533afa25c74b0e2fca890e764b87960dd0a836a613dfa3a0ae863	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:56.031962-06	\N	0.95	f
586	4	2	2024-11-28	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-8.57	f	11/28 11/30 SQ *BLUE BOTTLE COFFEE OAKLAND CA 8.57	2024-11	16	ai	3e6271ed8bb49f18de069b2ce8bec347762c9f4d5d2eee059ae514e188ac6ebe	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:56.035162-06	\N	0.95	f
588	4	4	2024-12-01	COSTCO GAS #0681 WOOD VILLAGE OR	-61.94	f	12/01 12/01 COSTCO GAS #0681 WOOD VILLAGE OR 61.94	2024-11	16	ai	b6e8164e466551fef0d8270b242c8ee594c57e8f433ac6a7cd3e792d4efc9fde	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:56.037529-06	\N	0.90	f
590	4	3	2024-12-02	SQ *TACO PEDRO GRESHAM OR	-62.79	f	12/02 12/03 SQ *TACO PEDRO GRESHAM OR 62.79	2024-11	16	ai	2df261870e94243fd4331756e91bcc55bcf06d17fce4b74b12e961a99f164a2e	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:56.037902-06	\N	0.95	f
593	4	3	2024-12-02	SQ *CASCADE ROASTERS FAIRVIEW OR	-14.80	f	12/02 12/04 SQ *CASCADE ROASTERS FAIRVIEW OR 14.80	2024-11	16	ai	af0c6123d587d24f5e6afe93c320044cf80afe1a9c5188a5dc1633d4f1ad0040	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:56.038298-06	\N	0.95	f
591	4	8	2024-12-03	POWELL'S BOOKS PORTLAND OR	-149.31	f	12/03 12/03 POWELL'S BOOKS PORTLAND OR 149.31	2024-11	16	ai	da8e403a08995f77b12b7d9c39572316b7a92e01c9161b2aa6ba0b00d26a9e8f	2026-10-16 14:40:14.348274-06	2026-10-16 14:42:56.038724-06	\N	0.90	f
497	2	10	2024-11-04	ATM WITHDRAWAL 11/02 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-200.00	f	11/04 ATM WITHDRAWAL 11/02 MAPLE FEDERAL ATM #2210 2210 200.00 6,440.86\nMAIN ST FAIRVIEW OR	2024-11	14	ai	dd1550b814a5fa50e0958069ee528590b6b48582f54693a1f792ed28d614d8f6	2026-10-16 14:40:14.316313-06	2026-10-16 14:40:46.605049-06	\N	0.90	f
610	1	4	2024-12-21	LYFT *RIDE SUN 11PM, SAN FRANCISCO CA	-25.24	f	12/21/2024,12/22/2024,LYFT *RIDE SUN 11PM, SAN FRANCISCO CA,Travel,Sale,-25.24	2024-12	17	ai	faddf21c1a1653d9a94d49fcaeaebedf40cc63a147b9bb9343837a746a829f22	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:04.477491-06	\N	0.98	f
608	1	8	2024-12-22	CHEWY.COM 800-672-4399 FL	-67.02	f	12/22/2024,12/22/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-67.02	2024-12	17	ai	4bd24bee18a709bda43e1fa33511a1a51501f12dadd9cee3a58bc669c882958f	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:04.481232-06	\N	0.90	f
604	1	8	2024-12-24	PAYPAL *ETSY, INC 4029357733 CA	-83.76	f	12/24/2024,12/26/2024,PAYPAL *ETSY, INC 4029357733 CA,Shopping,Sale,-83.76	2024-12	17	ai	319d420bc79c39bbdff2c6d2bb6705960de3fb25c182d72b3713451a3ef78658	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:04.486521-06	\N	0.90	f
605	1	8	2024-12-24	PAYPAL *ETSY, INC 4029357733 CA	-103.97	f	12/24/2024,12/24/2024,PAYPAL *ETSY, INC 4029357733 CA,Shopping,Sale,-103.97	2024-12	17	ai	94c161e6a2948e680de84d8b3ec950b48db69ea5dd3b41aee6c19b6ef919a7a4	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:30.471532-06	\N	0.90	f
603	1	4	2024-12-25	FRED-MEYER FUEL #0651 GRESHAM OR	-63.20	f	12/25/2024,12/25/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-63.20	2024-12	17	ai	08df99f9f74ec05be628d6c74055072bbaa5b7f968f86c8125dc020bdd50fccd	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:30.479124-06	\N	0.90	f
601	1	3	2024-12-27	DOORDASH*THAI BASIL, FAIRVIEW OR	-34.71	f	12/27/2024,12/29/2024,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-34.71	2024-12	17	ai	6fad9124e0fdbb6487f4af665107074414c29b3ea44a9d43d3eca364176adfea	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:30.482278-06	\N	0.95	f
602	1	4	2024-12-27	CHEVRON 0098812 FAIRVIEW OR	-63.30	f	12/27/2024,12/29/2024,CHEVRON 0098812 FAIRVIEW OR,Gas,Sale,-63.30	2024-12	17	ai	900edb9f617f939df17704e31754a730ec5789c53dcf90c5bf069199032c7720	2026-10-16 14:42:56.104719-06	2026-10-16 14:45:30.482873-06	\N	0.90	f
609	1	3	2024-12-21	DOORDASH*THAI BASIL, FAIRVIEW OR	-52.76	f	12/21/2024,12/23/2024,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-52.76	2024-12	17	ai	b0611575544e12507f45d9e287377b0ee5573fb61269ecca2088477e04c4d00f	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
626	1	3	2024-12-13	UBER *EATS PENDING HELP.UBER.COM CA	-15.77	f	12/13/2024,12/14/2024,UBER *EATS PENDING HELP.UBER.COM CA,Food & Drink,Sale,-15.77	2024-12	17	ai	d2e113345f452472d4edb95812cd5aaa85af144cc2f285964388f16828299023	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:32.058457-06	\N	0.90	f
611	1	3	2024-12-21	PANDA EXPRESS #1912 GRESHAM OR	-65.10	f	12/21/2024,12/22/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-65.10	2024-12	17	ai	2694468c531928bee91d7a0868239993eac2c6d3deb50cc020f961761ab6785b	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
629	1	2	2024-12-11	WINCO FOODS #112 GRESHAM OR	-45.59	f	12/11/2024,12/11/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-45.59	2024-12	17	ai	7d22d66f24625e452090c79a575271b01bfc475d8bff83b83ef19a9f7fdfe11f	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:13.464804-06	\N	0.95	f
627	1	8	2024-12-12	CHEWY.COM 800-672-4399 FL	-105.30	f	12/12/2024,12/14/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-105.30	2024-12	17	ai	daa119ed829e93b7b3b81b8c14ae14674410b6ff38635c85e35e9dc3fdc2953e	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:13.466011-06	\N	0.90	f
625	1	3	2024-12-13	PANDA EXPRESS #1912 GRESHAM OR	-38.01	f	12/13/2024,12/13/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-38.01	2024-12	17	ai	0ab5c84fcf9c087fcdf4cc26f381edcf48b6a56ef0c1eb32c9670d6dd2ad0d30	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:13.467451-06	\N	0.95	f
622	1	4	2024-12-14	CHEVRON 0098812 FAIRVIEW OR	-69.49	f	12/14/2024,12/14/2024,CHEVRON 0098812 FAIRVIEW OR,Gas,Sale,-69.49	2024-12	17	ai	c27feb840bf02578c72d02ed983e2c65bbd9f012c5f2713cc60cbc00885b6267	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:13.469242-06	\N	0.90	f
624	1	8	2024-12-14	SQ *SMITH & SONS, LLC PORTLAND OR	-110.86	f	12/14/2024,12/14/2024,SQ *SMITH & SONS, LLC PORTLAND OR,Shopping,Sale,-110.86	2024-12	17	ai	3f2a9c793ddd172e5e01b64c48c4d857d65e02f345f85ab0287078fdd6d36154	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:13.470153-06	\N	0.90	f
621	1	4	2024-12-15	FRED-MEYER FUEL #0651 GRESHAM OR	-31.58	f	12/15/2024,12/17/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-31.58	2024-12	17	ai	202d6aa24d3c49a232871c9b91fbea74a5d51df996365778867fcc74f5da5831	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:13.471756-06	\N	0.90	f
619	1	3	2024-12-16	PANDA EXPRESS #1912 GRESHAM OR	-62.74	f	12/16/2024,12/16/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-62.74	2024-12	17	ai	ada68fabe4db53f44d69e5d752c85e9f80adbb54326e6e98f5c645a034c0825b	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:13.473581-06	\N	0.95	f
620	1	4	2024-12-16	CHEVRON 0098812 FAIRVIEW OR	-55.12	f	12/16/2024,12/17/2024,CHEVRON 0098812 FAIRVIEW OR,Gas,Sale,-55.12	2024-12	17	ai	c491fb76605eec43f3ed3a608f9fee187d86f40d3f91737d58c1e164f95709a2	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:37.622031-06	\N	0.95	f
618	1	4	2024-12-17	LYFT *RIDE FRI 5PM, SAN FRANCISCO CA	-22.48	f	12/17/2024,12/18/2024,LYFT *RIDE FRI 5PM, SAN FRANCISCO CA,Travel,Sale,-22.48	2024-12	17	ai	b6d90b60ce66766df83d283d05c53a7ac4c4b261a5d6b0d389af548b37e50708	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:37.631859-06	\N	0.98	f
616	1	2	2024-12-18	WINCO FOODS #112 GRESHAM OR	-158.95	f	12/18/2024,12/19/2024,WINCO FOODS #112 GRESHAM OR,Groceries,Sale,-158.95	2024-12	17	ai	6085f73fed1bd1d072f1a591cc1de263ffa307bc2d7ef74bf7d62afce18cedac	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:37.633409-06	\N	0.98	f
617	1	5	2024-12-18	HULU 877-8244858 CA	-18.99	f	12/18/2024,12/18/2024,HULU 877-8244858 CA,Entertainment,Sale,-18.99	2024-12	17	ai	8eb7c8df9da7b6d07fca592a635fc52cfcc775c10db44e0e9fa0a0886bbddf7f	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:37.634352-06	\N	0.95	f
612	1	4	2024-12-20	LYFT *RIDE FRI 11PM, SAN FRANCISCO CA	-19.05	f	12/20/2024,12/21/2024,LYFT *RIDE FRI 11PM, SAN FRANCISCO CA,Travel,Sale,-19.05	2024-12	17	ai	13e63ee96af7e20f888517951cb73b34551e6423aeaf4432353658d2f522bb94	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:37.637493-06	\N	0.98	f
613	1	8	2024-12-20	SQ *SMITH & SONS, LLC PORTLAND OR	-92.86	f	12/20/2024,12/21/2024,SQ *SMITH & SONS, LLC PORTLAND OR,Shopping,Sale,-92.86	2024-12	17	ai	64bc0c5f0298a362bad4169b6da797cba58f53ca9da1f310f430b2e433712968	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:37.638088-06	\N	0.90	f
614	1	4	2024-12-20	FRED-MEYER FUEL #0651 GRESHAM OR	-51.11	f	12/20/2024,12/22/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-51.11	2024-12	17	ai	bc86a13fae987015f2b320ea8c069963d571a255ac9860deee051f9e3b1331fc	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:37.638573-06	\N	0.95	f
650	2	3	2024-12-02	POS DEBIT 11/30 MCDONALD'S F21877 FAIRVIEW OR	-51.49	f	12/02 POS DEBIT 11/30 MCDONALD'S F21877 FAIRVIEW OR 51.49 6,273.54	2024-12	18	ai	8252df9cf5185f6c42d2a4e4d4a7f096a50e11533718b70e28c0805755edacc8	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:31.771845-06	\N	0.98	f
648	1	3	2024-12-01	PANDA EXPRESS #1912 GRESHAM OR	-44.62	f	12/01/2024,12/01/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-44.62	2024-12	17	ai	c674584a47af3617e64082663a39f8ddd62fa5028ec5f5f637e66df8c22eca1e	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
639	1	3	2024-12-05	PANDA EXPRESS #1912 GRESHAM OR	-61.94	f	12/05/2024,12/05/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-61.94	2024-12	17	ai	40fae93cc1bcc738423b3e21a357e95a0882db5b28beb356138236cc6bfab1ea	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
644	1	2	2024-12-02	FRED-MEYER #0651 GRESHAM OR	-129.43	f	12/02/2024,12/02/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-129.43	2024-12	17	ai	cce12ccd782211dead3049a1a1807b46ac2a42ce0b10e586c56e7c13e8c06ab3	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:32.57709-06	\N	0.95	f
641	1	2	2024-12-04	FRED-MEYER #0651 GRESHAM OR	-111.16	f	12/04/2024,12/04/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-111.16	2024-12	17	ai	4f0c5e508b0c271cfbf1b4dd85ace08507c89bce480d9742462c17c427da86cb	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:32.57709-06	\N	0.95	f
638	1	2	2024-12-05	FRED-MEYER #0651 GRESHAM OR	-45.85	f	12/05/2024,12/05/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-45.85	2024-12	17	ai	297dc1f74801759949bed8245cd9c50395bf30e2cdb83cbb3751926f6befa4f1	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:32.57709-06	\N	0.95	f
645	1	5	2024-12-02	APPLE.COM/BILL 866-712-7753 CA	-9.99	f	12/02/2024,12/04/2024,APPLE.COM/BILL 866-712-7753 CA,Entertainment,Sale,-9.99	2024-12	17	ai	a17366b8b1c0c07508ce30a37c07767b577b5526277fc0c039615c428c046fb6	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:33.446938-06	\N	0.90	f
653	2	1	2024-12-03	ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 6610023385	-188.42	f	12/03 ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 188.42 5,964.18\n6610023385	2024-12	18	ai	b5a6b09eca32b141608647ca3b7eac07aa761e3da24ab50e27707206682cf2be	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:34.35337-06	\N	0.95	f
656	2	8	2024-12-04	POS RETURN 12/03 TARGET T-1544 GRESHAM OR	36.18	f	12/04 POS RETURN 12/03 TARGET T-1544 GRESHAM OR 36.18 5,939.85	2024-12	18	ai	94cd0f291c6206fa8bb8da1184613e1ff79a95ed8220e7df79a8f944f8f63bc6	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:34.413679-06	\N	0.80	f
631	1	8	2024-12-09	THE HOME DEPOT #4012 GRESHAM OR	42.18	f	12/09/2024,12/11/2024,THE HOME DEPOT #4012 GRESHAM OR,Shopping,Return,42.18	2024-12	17	ai	398f612479339b88100807e5b2316f05a84defb0d2fc03628d7df51560b8e9c8	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:34.890656-06	\N	0.85	f
659	2	10	2024-12-06	CHECK #1045	-160.00	f	12/06 CHECK #1045 160.00 5,272.46	2024-12	18	ai	fc09acb96d1731e5239e629793fa8669d84dbae87092538414d0e9f26fea1a27	2026-10-16 14:42:56.14614-06	2026-10-16 14:43:48.529417-06	\N	0.10	f
655	2	4	2024-12-03	POS DEBIT 12/03 SHELL OIL 57442	-55.13	f	12/03 POS DEBIT 12/03 SHELL OIL 57442 55.13 5,903.67	2024-12	18	rule	66650bf05738f0d8b80b1731afbe2bf78ab6c2c2fd4c2081c037314f8b39d33f	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.203796-06	\N	\N	f
657	2	9	2024-12-05	ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS XXXXXX4471 REF #IBCP984XV	-500.00	f	12/05 ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS 500.00 5,439.85\nXXXXXX4471 REF #IBCP984XV	2024-12	18	transfer	3e7a6e2900b8d7b3b26fc52c3cd16743245d317d9b83c1fe0e9b255cdc974ff7	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.218429-06	704	\N	f
646	1	8	2024-12-01	THE HOME DEPOT #4012 GRESHAM OR	-88.16	f	12/01/2024,12/01/2024,THE HOME DEPOT #4012 GRESHAM OR,Shopping,Sale,-88.16	2024-12	17	ai	07c71f417fadeea23e2027a1cf4c554e943561e57385592622f0d8bf87b18b91	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:23.78806-06	\N	0.95	f
647	1	4	2024-12-01	LYFT *RIDE SAT 10PM, SAN FRANCISCO CA	-24.52	f	12/01/2024,12/02/2024,LYFT *RIDE SAT 10PM, SAN FRANCISCO CA,Travel,Sale,-24.52	2024-12	17	ai	a35a575e80a9afb8e68d5ebc1ae1d729e2dd6a081476a52760dd965114b79a28	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:23.797555-06	\N	0.98	f
651	2	2	2024-12-02	DEBIT CARD PURCHASE 12/01 SAFEWAY #1544 FAIRVIEW OR	-60.94	f	12/02 DEBIT CARD PURCHASE 12/01 SAFEWAY #1544 FAIRVIEW OR 60.94 6,212.60	2024-12	18	ai	873e1face9e501a8d2797e4b0a0ecd4d1298f0edef94bf60f0b13c64b9f3c252	2026-10-16 14:42:56.14614-06	2026-10-16 14:43:23.800173-06	\N	0.95	f
652	2	10	2024-12-02	ATM WITHDRAWAL 12/02 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-60.00	f	12/02 ATM WITHDRAWAL 12/02 MAPLE FEDERAL ATM #2210 2210 60.00 6,152.60\nMAIN ST FAIRVIEW OR	2024-12	18	ai	63f6a998485f628979448993ff002de9635250464e6980b4058eb2be22956fe6	2026-10-16 14:42:56.14614-06	2026-10-16 14:43:23.800609-06	\N	0.85	f
642	1	4	2024-12-03	LYFT *RIDE SAT 8PM, SAN FRANCISCO CA	-24.48	f	12/03/2024,12/03/2024,LYFT *RIDE SAT 8PM, SAN FRANCISCO CA,Travel,Sale,-24.48	2024-12	17	ai	2874bc32ad0e3e2449fbdeaf7e25bc52fe3651564a7f3103a96755912b994983	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:23.801287-06	\N	0.98	f
643	1	10	2024-12-03	CVS/PHARMACY #10422 GRESHAM OR	-9.44	f	12/03/2024,12/03/2024,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-9.44	2024-12	17	ai	e173d3e8e60452133627a9336dc02462eb0a8204a352c84517b0c1e12307b91e	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:23.801692-06	\N	0.90	f
640	1	4	2024-12-04	ARCO #82211 AMPM GRESHAM OR	-48.34	f	12/04/2024,12/04/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-48.34	2024-12	17	ai	5ba2a4ff265276e05850eecc0bff08096df22006487e50dfd895dfe1f359c850	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:23.803985-06	\N	0.95	f
637	1	4	2024-12-05	ARCO #82211 AMPM GRESHAM OR	-53.12	f	12/05/2024,12/07/2024,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-53.12	2024-12	17	ai	3474a5e1badd25f0850f3375bac0c5e883f394f9f85ab55cc0d3633691cb7a57	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:23.805185-06	\N	0.95	f
634	1	4	2024-12-07	LYFT *RIDE FRI 8PM, SAN FRANCISCO CA	-32.94	f	12/07/2024,12/07/2024,LYFT *RIDE FRI 8PM, SAN FRANCISCO CA,Travel,Sale,-32.94	2024-12	17	ai	ba8d279da715feb4c57f6f6829e2e7030a3ee666813ca81eda114612380d314a	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:48.531161-06	\N	0.95	f
635	1	4	2024-12-07	FRED-MEYER FUEL #0651 GRESHAM OR	-33.82	f	12/07/2024,12/08/2024,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-33.82	2024-12	17	ai	10f2126d71811cb5db84ef4ca4248171b9ea65bd5eab87ae2d08d54697ec4dbb	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:48.531757-06	\N	0.95	f
636	1	2	2024-12-07	TRADER JOE S #145 PORTLAND OR	-69.64	f	12/07/2024,12/08/2024,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-69.64	2024-12	17	ai	83b0b73f7f7a604ebefaedab0d783b659efc5ef5749efab80f99afa1dd39a7cd	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:48.532564-06	\N	0.90	f
633	1	3	2024-12-08	DOORDASH*BURGERVILLE #12	-36.32	f	12/08/2024,12/09/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-36.32	2024-12	17	ai	b542fa2897187e3e721f9007d041c75f4f7a949caaa8eaf49421330570ce732a	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:48.53461-06	\N	0.95	f
632	1	3	2024-12-09	DOORDASH*BURGERVILLE #12	-59.03	f	12/09/2024,12/11/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-59.03	2024-12	17	ai	a03030d0e4b9a1564048cd3c4d258c7f9ea5b0c40b767b5cb808a24b97efbb4a	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:48.536503-06	\N	0.95	f
685	2	4	2024-12-22	POS DEBIT 12/22 CHEVRON 0098812 FAIRVIEW OR	-65.66	f	12/22 POS DEBIT 12/22 CHEVRON 0098812 FAIRVIEW OR 65.66 7,210.14	2024-12	18	ai	238c081948c493df095da14003eb8d0687da7a3c0e813e2caeffd1b6b1059a3f	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:04.481676-06	\N	0.95	f
686	2	6	2024-12-23	ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190	-142.67	f	12/23 ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190 142.67 7,067.47	2024-12	18	ai	921c6073b76c3f970a02b75e1ce7b34ee65128d18c2ed7adb2f2e01de049fcea	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:04.48416-06	\N	0.90	f
661	2	3	2024-12-08	POS DEBIT 12/08 DUTCH BROS #OR0212 FAIRVIEW OR	-9.87	f	12/08 POS DEBIT 12/08 DUTCH BROS #OR0212 FAIRVIEW OR 9.87 5,196.47	2024-12	18	ai	009137d56bec5eeddcb0d19a1eaf2cf00d1c338efe8c59ab2f632b067608f81e	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
683	2	3	2024-12-21	DEBIT CARD PURCHASE 12/21 SQ *CASCADE ROASTERS FAIRVIEW OR	-4.79	f	12/21 DEBIT CARD PURCHASE 12/21 SQ *CASCADE ROASTERS 4.79 7,308.81\nFAIRVIEW OR	2024-12	18	ai	fc423bf79b0f93f4bd431cc720ed3a897704e9e80e68352d97b9b0bf88659556	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
684	2	3	2024-12-21	DEBIT CARD PURCHASE 12/21 CHIPOTLE 2291 GRESHAM OR	-33.01	f	12/21 DEBIT CARD PURCHASE 12/21 CHIPOTLE 2291 GRESHAM OR 33.01 7,275.80	2024-12	18	ai	f63118b3d0ed2fe88daea71eecde7a7fc88a2912c4a9da7607cf22f86126edfe	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:31.609573-06	\N	0.95	f
687	2	3	2024-12-23	DEBIT CARD PURCHASE 12/20 MCDONALD'S F21877 FAIRVIEW OR	-36.20	f	12/23 DEBIT CARD PURCHASE 12/20 MCDONALD'S F21877 FAIRVIEW 36.20 7,031.27\nOR	2024-12	18	ai	8e0d3dfb5dd31cc6f8556a109bf2bdb917a559dc20215826a406caa7e5f848a3	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:31.771845-06	\N	0.95	f
674	2	10	2024-12-16	DEBIT CARD PURCHASE 12/15 RITE AID STORE 5411 GRESHAM OR	-26.21	f	12/16 DEBIT CARD PURCHASE 12/15 RITE AID STORE 5411 26.21 10,607.50\nGRESHAM OR	2024-12	18	ai	bbfdc74f999caddac715f415590d5d0c3a945932f3c94b43487c99a5fef8d79a	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:35.775673-06	\N	0.90	f
671	2	7	2024-12-16	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	12/16 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 10,736.71\n5520017784	2024-12	18	rule	b0c16e3145822a6b14200798ccb31ab3e194424f36e7fde748033f35910ac998	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.206998-06	\N	\N	f
678	2	9	2024-12-18	ONLINE TRANSFER FROM MAPLE FEDERAL SAVINGS XXXXXX4471 REF #IBTNELBFF	300.00	f	12/18 ONLINE TRANSFER FROM MAPLE FEDERAL SAVINGS 300.00 10,689.32\nXXXXXX4471 REF #IBTNELBFF	2024-12	18	transfer	45fe5432cb423a9b92fc90374e4ff7a8d1b900a59807313acb757c7a13ddf120	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.216909-06	705	\N	f
681	2	9	2024-12-20	ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# YRUWHYH7	-3241.79	f	12/20 ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# 3,241.79 7,376.85\nYRUWHYH7	2024-12	18	transfer	ff8dbba6362ad6b9154b28c97101bf3cde122f06de8885cfa3c378809cc0702c	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.220495-06	707	\N	f
663	2	2	2024-12-09	POS DEBIT 12/07 SAFEWAY #1544 FAIRVIEW OR	-142.97	f	12/09 POS DEBIT 12/07 SAFEWAY #1544 FAIRVIEW OR 142.97 4,923.45	2024-12	18	ai	a48695f2e8a21d11527dac3582fe9e357075766a87f1676fc8b4bfef3367df44	2026-10-16 14:42:56.14614-06	2026-10-16 14:43:48.537325-06	\N	0.95	f
664	2	2	2024-12-09	DEBIT CARD PURCHASE 12/09 SAFEWAY #1544 FAIRVIEW OR	-135.19	f	12/09 DEBIT CARD PURCHASE 12/09 SAFEWAY #1544 FAIRVIEW OR 135.19 4,788.26	2024-12	18	ai	1da6f72794ea7761339f6434b6d944db13d3dad9b439e5456400cd53642e2025	2026-10-16 14:42:56.14614-06	2026-10-16 14:43:48.537885-06	\N	0.95	f
665	2	7	2024-12-10	ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 8830021147	1350.00	f	12/10 ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 1,350.00 6,138.26\n8830021147	2024-12	18	ai	88e1f46b7abf13f83658ea74cf2c1e76f12e08acd2db31070e0409c071c6de61	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:13.457514-06	\N	1.00	f
666	2	3	2024-12-11	POS DEBIT 12/10 SQ *CASCADE ROASTERS FAIRVIEW OR	-9.39	f	12/11 POS DEBIT 12/10 SQ *CASCADE ROASTERS FAIRVIEW OR 9.39 6,128.87	2024-12	18	ai	11be0fd6a7cae8014b5bfabcc7da9af3070156193e18781b3c35f4a78a4318a4	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:13.465258-06	\N	0.95	f
667	2	6	2024-12-12	ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 3300298811	-93.65	f	12/12 ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 93.65 6,035.22\n3300298811	2024-12	18	ai	c590b5361c54c266b3d00e555f34a2b583f9c6d10a26eca9ac4524bc437ad859	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:13.466997-06	\N	0.95	f
669	2	3	2024-12-13	POS DEBIT 12/12 SQ *CASCADE ROASTERS FAIRVIEW OR	-10.88	f	12/13 POS DEBIT 12/12 SQ *CASCADE ROASTERS FAIRVIEW OR 10.88 8,870.49	2024-12	18	ai	145a47553fdfb2331c1c21f164e7238bcfd74e4d0bc41ea990d35316fc39f8a0	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:13.468346-06	\N	0.95	f
670	2	3	2024-12-15	POS DEBIT 12/15 CHIPOTLE 2291 GRESHAM OR	-46.18	f	12/15 POS DEBIT 12/15 CHIPOTLE 2291 GRESHAM OR 46.18 8,824.31	2024-12	18	ai	284007027fc5b1b405735913b36f52f83057e4921b075b6ff0542572247b8594	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:13.472307-06	\N	0.95	f
672	2	10	2024-12-16	NON-MAPLE FEDERAL ATM FEE	-3.00	f	12/16 NON-MAPLE FEDERAL ATM FEE 3.00 10,733.71	2024-12	18	ai	e29064fc35f5668ae6b2a9316aecbf635e2e99f426977d5b72cfec056f246cbd	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:37.628867-06	\N	0.85	f
673	2	10	2024-12-16	ATM WITHDRAWAL 12/14 FIRSTLINE CU ATM 800 NE 181ST AVE GRESHAM OR	-100.00	f	12/16 ATM WITHDRAWAL 12/14 FIRSTLINE CU ATM 800 NE 181ST AVE 100.00 10,633.71\nGRESHAM OR	2024-12	18	ai	c1a89f5182b30f5d41d3e344193b9ebcbe428fc08f35a1424aed260c771cd60f	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:37.629682-06	\N	0.90	f
675	2	10	2024-12-16	ATM WITHDRAWAL 12/16 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-100.00	f	12/16 ATM WITHDRAWAL 12/16 MAPLE FEDERAL ATM #2210 2210 100.00 10,507.50\nMAIN ST FAIRVIEW OR	2024-12	18	ai	f829aab3a741b93a2aa599dff3ee35b2e1635302933910c0516d013fc5a55a79	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:37.63082-06	\N	0.90	f
676	2	6	2024-12-17	RIVERNET BROADBAND AUTOPAY 800-555-0142	-79.99	f	12/17 RIVERNET BROADBAND AUTOPAY 800-555-0142 79.99 10,427.51	2024-12	18	ai	6bbc141bd4d8f3e139aeca71510212413edd7614f54d9cb48bfa0a262fff6519	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:37.632383-06	\N	0.95	f
677	2	4	2024-12-17	POS DEBIT 12/16 CHEVRON 0098812 FAIRVIEW OR	-38.19	f	12/17 POS DEBIT 12/16 CHEVRON 0098812 FAIRVIEW OR 38.19 10,389.32	2024-12	18	ai	4d0ab98adcfb51018f96b7e7e170baab39152648c43c1000ed96c51ec60d9b3a	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:37.632894-06	\N	0.95	f
679	2	2	2024-12-18	DEBIT CARD PURCHASE 12/17 GROCERY OUTLET #388 GRESHAM OR	-36.40	f	12/18 DEBIT CARD PURCHASE 12/17 GROCERY OUTLET #388 36.40 10,652.92\nGRESHAM OR	2024-12	18	ai	af05b06687d854a07ceed010ac1fc5263e4c778724e111322065f1c465c490e3	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:37.63487-06	\N	0.98	f
680	2	3	2024-12-18	POS DEBIT 12/18 CHIPOTLE 2291 GRESHAM OR	-34.28	f	12/18 POS DEBIT 12/18 CHIPOTLE 2291 GRESHAM OR 34.28 10,618.64	2024-12	18	ai	5899039bd80c23d46ca485a6f2737097d74cd0750699d1c6c64607352bbbf933	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:37.635384-06	\N	0.98	f
682	2	3	2024-12-20	POS DEBIT 12/20 MCDONALD'S F21877 FAIRVIEW OR	-63.25	f	12/20 POS DEBIT 12/20 MCDONALD'S F21877 FAIRVIEW OR 63.25 7,313.60	2024-12	18	ai	8641e5b2ddc52546de42aef3bf88220aab80e6129de87784d0efeceb4db281bb	2026-10-16 14:42:56.14614-06	2026-10-16 14:44:37.639056-06	\N	0.98	f
691	2	3	2024-12-25	DEBIT CARD PURCHASE 12/25 MCDONALD'S F21877 FAIRVIEW OR	-60.84	f	12/25 DEBIT CARD PURCHASE 12/25 MCDONALD'S F21877 FAIRVIEW 60.84 4,637.59\nOR	2024-12	18	ai	e802a99318c040704ff18d8c2f854a4340e345c11b0531185b2254e309d06816	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:30.479533-06	\N	0.95	f
692	2	2	2024-12-26	DEBIT CARD PURCHASE 12/24 WINCO FOODS #112 GRESHAM OR	-106.87	f	12/26 DEBIT CARD PURCHASE 12/24 WINCO FOODS #112 GRESHAM 106.87 4,530.72\nOR	2024-12	18	ai	fa26071adcd2a8f4bfce579d72ac088c71139732cec3a249bb2f9a983bbcf5ea	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:30.480703-06	\N	0.95	f
693	2	2	2024-12-26	DEBIT CARD PURCHASE 12/24 GROCERY OUTLET #388 GRESHAM OR	-59.95	f	12/26 DEBIT CARD PURCHASE 12/24 GROCERY OUTLET #388 59.95 4,470.77\nGRESHAM OR	2024-12	18	ai	ef96774b878a2a121f0147d072751c90e5836d1fb45410a4b080a13f13616639	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:30.481086-06	\N	0.95	f
696	2	2	2024-12-28	POS DEBIT 12/28 GROCERY OUTLET #388 GRESHAM OR	-102.52	f	12/28 POS DEBIT 12/28 GROCERY OUTLET #388 GRESHAM OR 102.52 6,964.40	2024-12	18	ai	ebbad42fa296dac4c3162569d77008b6400850dee54d9410c9101c906e8328d1	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:30.485025-06	\N	0.95	f
697	2	2	2024-12-29	DEBIT CARD PURCHASE 12/29 GROCERY OUTLET #388 GRESHAM OR	-169.00	f	12/29 DEBIT CARD PURCHASE 12/29 GROCERY OUTLET #388 169.00 6,795.40\nGRESHAM OR	2024-12	18	ai	aa5bb7409d182162cf78aa6f3636ee10f636c4ba383ad73f02503d16b204b3a5	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:30.487135-06	\N	0.95	f
700	2	3	2024-12-30	DEBIT CARD PURCHASE 12/30 TST* LUIGIS TRATTORIA FAIRVIEW OR	-22.00	f	12/30 DEBIT CARD PURCHASE 12/30 TST* LUIGIS TRATTORIA 22.00 6,600.57\nFAIRVIEW OR	2024-12	18	ai	8f33c55ed948399283dc0ef0df87b1014e890e01e142c068ff247d03a4275d4a	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:50.482421-06	\N	0.95	f
702	2	7	2024-12-31	INTEREST PAYMENT	0.42	f	12/31 INTEREST PAYMENT 0.42 8,513.39	2024-12	18	ai	7774d6fa0a32e482bdf569d7627630e2c70fde07c0c61732c46280d843356ddc	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:50.485504-06	\N	0.80	f
706	3	7	2024-12-31	INTEREST PAYMENT	6.12	f	2024-12-31 INTEREST PAYMENT 6.12	2024-12	19	ai	1dc9db3b859264639f4c71a2d2b6bedf1c8bc8888c6f64ca2526ed9dd56f4e36	2026-10-16 14:42:56.160315-06	2026-10-16 14:45:50.486053-06	\N	0.80	f
698	2	3	2024-12-30	DEBIT CARD PURCHASE 12/27 SQ *CASCADE ROASTERS FAIRVIEW OR	-12.21	f	12/30 DEBIT CARD PURCHASE 12/27 SQ *CASCADE ROASTERS 12.21 6,783.19\nFAIRVIEW OR	2024-12	18	ai	1809681b178b4c9b95fb034ba7d2fd3b3bb27b1c10a63ea116ef7b2d47b8e9d8	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
710	4	3	2024-12-03	TST* PINE STATE BISCUITS PORTLAND OR	-47.33	f	12/03 12/05 TST* PINE STATE BISCUITS PORTLAND OR 47.33	2024-12	20	ai	d9de253e169f637fbb60816350486afc8532084c24dded6ca8e2370cb2aea159	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:31.123945-06	\N	0.95	f
699	2	2	2024-12-30	DEBIT CARD PURCHASE 12/29 FRED-MEYER #0651 GRESHAM OR	-160.62	f	12/30 DEBIT CARD PURCHASE 12/29 FRED-MEYER #0651 GRESHAM 160.62 6,622.57\nOR	2024-12	18	ai	b36c7d5da1a18408a50a1bcdb3cfe868572f04f897ef48a5164ca2857586f0f1	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
695	2	9	2024-12-27	ONLINE TRANSFER TO TIDEWATER ONLINE SAVINGS XXXXX7730 WEB ID: 1774400920	-250.00	f	12/27 ONLINE TRANSFER TO TIDEWATER ONLINE SAVINGS 250.00 7,066.92\nXXXXX7730 WEB ID: 1774400920	2024-12	18	ai	e656bd9aa3758ee229c9e6a4d9baf59976f1f7aa9d575f3c9a92338eeddeb91d	2026-10-16 14:42:56.14614-06	2026-10-16 14:45:30.483403-06	\N	0.95	f
713	4	8	2024-12-06	AMZN Mktp US*LQF6GE Amzn.com/bill WA	-74.01	f	12/06 12/07 AMZN Mktp US*LQF6GE Amzn.com/bill WA 74.01	2024-12	20	rule	d1a29e04577ababb203fb12747119b0ccf4292e61add13e93c45d10e438292ae	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.204756-06	\N	\N	f
718	4	8	2024-12-09	AMZN Mktp US*SBJHDW Amzn.com/bill WA	-119.25	f	12/09 12/09 AMZN Mktp US*SBJHDW Amzn.com/bill WA 119.25	2024-12	20	rule	554881ec79f74026437789fe8c973c63a9ce01227b5b59808c48e7f51f118ba9	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.205398-06	\N	\N	f
690	2	4	2024-12-24	POS DEBIT 12/23 SHELL OIL 57442	-32.08	f	12/24 POS DEBIT 12/23 SHELL OIL 57442 32.08 4,698.43	2024-12	18	rule	1d2fc0e54a4a14f525232873221c354c1a5febb29596411f836c9bdbf48b5840	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.210271-06	\N	\N	f
708	4	8	2024-12-30	AMZN Mktp US*RT4QL2 RETURN Amzn.com/bill WA	34.99	f	12/30 01/01 AMZN Mktp US*RT4QL2 RETURN Amzn.com/bill WA -34.99	2024-12	20	rule	bee896cf30e8c96f957c72210911599c8ec43fa487dd586305468a15b54db702	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.211751-06	\N	\N	f
701	2	7	2024-12-31	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	12/31 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 8,512.97\n5520017784	2024-12	18	rule	0750450f539aca200fdda1720696cb3127913d58597657671a16a1cdd255cc5e	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.212151-06	\N	\N	f
703	2	4	2024-12-31	POS DEBIT 12/31 SHELL OIL 57442	-53.72	f	12/31 POS DEBIT 12/31 SHELL OIL 57442 53.72 8,459.67	2024-12	18	rule	db31d872832c5c9fdf74917e6ccf8b224d30803262ff389408023beb9cf57d91	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.212466-06	\N	\N	f
705	3	9	2024-12-18	ONLINE TRANSFER TO MAPLE FEDERAL CHECKING XXXXXX2290 HOLIDAY	-300.00	f	2024-12-18 ONLINE TRANSFER TO MAPLE FEDERAL CHECKING XXXXXX2290 HOLIDAY -300.00	2024-12	19	transfer	f98ad7c2136aaa4dcb3be9721d1be7655702dc0c4e9b243c5378bf7128a9306a	2026-10-16 14:42:56.160315-06	2026-10-16 14:42:56.216909-06	678	\N	f
704	3	9	2024-12-06	ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290	500.00	f	2024-12-06 ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290 500.00	2024-12	19	transfer	1f8a24c8da8b3036778df7b0f9e27203bc197dd973bc64f6edfdf62d7513365f	2026-10-16 14:42:56.160315-06	2026-10-16 14:42:56.218429-06	657	\N	f
689	2	9	2024-12-24	HARBOR CARD AUTOPAY PPD ID: 7781000231	-2291.92	f	12/24 HARBOR CARD AUTOPAY PPD ID: 7781000231 2,291.92 4,730.51	2024-12	18	transfer	64c40ba445121b00c72d7dd104223abecf600bc0d5c857b6302999b1264bd5f6	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.219506-06	606	\N	f
707	4	9	2024-12-23	PAYMENT THANK YOU - WEB	3241.79	f	12/23 12/23 PAYMENT THANK YOU - WEB -3,241.79	2024-12	20	transfer	3cea1615b64538f8bd46cffbd6f214122f6474cd37094d70b5d1b58d5ffb92a8	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.220495-06	681	\N	f
709	4	5	2024-12-03	SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR	-95.00	f	12/03 12/05 SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR 95.00	2024-12	20	ai	be5d5eb6e1a2f0e4c1d3b120bbdbfd667fa1c6e07f134bc08a664032169705ba	2026-10-16 14:42:56.181941-06	2026-10-16 14:43:23.803105-06	\N	0.95	f
712	4	2	2024-12-05	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-8.64	f	12/05 12/06 SQ *BLUE BOTTLE COFFEE OAKLAND CA 8.64	2024-12	20	ai	37ee0ef62a52bc30e64c9b70cb8d20b191e1876d803b4a3218819cde10bb3e8d	2026-10-16 14:42:56.181941-06	2026-10-16 14:43:48.52866-06	\N	0.95	f
714	4	4	2024-12-06	COSTCO GAS #0681 WOOD VILLAGE OR	-68.26	f	12/06 12/07 COSTCO GAS #0681 WOOD VILLAGE OR 68.26	2024-12	20	ai	07aa7f940f8c48923f19c2bc7781f6fd193befeb9ba70e4fa811c9bbd456ccc8	2026-10-16 14:42:56.181941-06	2026-10-16 14:43:48.530492-06	\N	0.90	f
716	4	3	2024-12-08	TST* LUIGIS TRATTORIA FAIRVIEW OR	-43.84	f	12/08 12/09 TST* LUIGIS TRATTORIA FAIRVIEW OR 43.84	2024-12	20	ai	0380560df7fe0096e86698723ca81fe6aedbe5d4b0f79fadc64ccfa66cfe93a2	2026-10-16 14:42:56.181941-06	2026-10-16 14:43:48.535546-06	\N	0.95	f
717	4	5	2024-12-09	SPOTIFY USA 877-778-1161 NY	-16.99	f	12/09 12/09 SPOTIFY USA 877-778-1161 NY 16.99	2024-12	20	ai	12cbb7d875f20549016ed96e6cf402ad1355d9a0f6735b30f75028ddf9ab528b	2026-10-16 14:42:56.181941-06	2026-10-16 14:43:48.538419-06	\N	0.95	f
739	4	5	2024-12-21	DISNEY PLUS 888-905-7888 CA	-13.99	f	12/21 12/22 DISNEY PLUS 888-905-7888 CA 13.99	2024-12	20	ai	790256e73c6dfc5e85a51454820d650a6b20445fd057a86c210c3bdcda5d6d49	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:04.479451-06	\N	0.98	f
743	4	2	2024-12-21	SAFEWAY #1544 FAIRVIEW OR	-97.82	f	12/21 12/23 SAFEWAY #1544 FAIRVIEW OR 97.82	2024-12	20	ai	467fe2a3b6be1ffb4bf90ba4d3a2cfe6ea4536a467fb6625a589670606097111	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:04.479893-06	\N	0.95	f
744	4	2	2024-12-21	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-10.64	f	12/21 12/23 SQ *BLUE BOTTLE COFFEE OAKLAND CA 10.64	2024-12	20	ai	56217b0ab613022f503c6cdfb81cdc6a3ae9be2e7a59dcc1488f32c23b49d7c2	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:04.480343-06	\N	0.90	f
745	4	2	2024-12-21	SAFEWAY #1544 FAIRVIEW OR	-137.32	f	12/21 12/23 SAFEWAY #1544 FAIRVIEW OR 137.32	2024-12	20	ai	a061492fc7eac92cb6b3f550f9113d34f73d63a107108f85c650ca7aa2b4aa41	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:04.480788-06	\N	0.95	f
740	4	3	2024-12-22	OLIVE GARDEN 0012345 GRESHAM OR	-41.14	f	12/22 12/22 OLIVE GARDEN 0012345 GRESHAM OR 41.14	2024-12	20	ai	58a0468ac2318c22d4415b160fa96a7587ad0bbbd6c5b91388a8f5cc3bfa2b1a	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:04.482118-06	\N	0.95	f
741	4	3	2024-12-22	PIZZICATO #14 PORTLAND OR	-41.16	f	12/22 12/22 PIZZICATO #14 PORTLAND OR 41.16	2024-12	20	ai	bbc77cf275305f272f440c9d31bf7ac2fd4e0a4fb54c66d21df4d2b10cecc057	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:04.482559-06	\N	0.95	f
742	4	3	2024-12-22	OLIVE GARDEN 0012345 GRESHAM OR	-42.76	f	12/22 12/22 OLIVE GARDEN 0012345 GRESHAM OR 42.76	2024-12	20	ai	c668b9c89cfac5a5bf8522dd6baf4efdb89d75d904ff11087cb74f10d0ae463d	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:04.483271-06	\N	0.95	f
721	4	11	2024-12-07	BEST BUY 00004512 GRESHAM OR	-349.99	t	12/07 12/09 BEST BUY 00004512 GRESHAM OR 349.99	2024-12	20	manual	44e68a5639b14823a92af9bac0010aed16cb02e8b0219108eca58fda04156d6a	2026-10-16 14:42:56.181941-06	2026-10-16 14:50:01.244788-06	\N	0.90	f
746	4	8	2024-12-24	KOHL'S #1129 GRESHAM OR	-59.72	f	12/24 12/24 KOHL'S #1129 GRESHAM OR 59.72	2024-12	20	ai	a46d79fef23d292c4c4d8e669b05aeba097af7b7883ea356743261377ef8fc69	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:30.478651-06	\N	0.90	f
729	4	11	2024-12-14	ETSY.COM - CRAFTEDBYJUNE BROOKLYN NY	-48.50	t	12/14 12/16 ETSY.COM - CRAFTEDBYJUNE BROOKLYN NY 48.50	2024-12	20	manual	82348dc9fc8b91c75e8c6be795f1bfa8ec0f1b851424a8d7eb2d44052c70635d	2026-10-16 14:42:56.181941-06	2026-10-16 14:50:01.251308-06	\N	0.90	f
749	4	2	2024-12-25	NEW SEASONS MARKET FAIRVIEW OR	-256.29	f	12/25 12/25 NEW SEASONS MARKET FAIRVIEW OR 256.29	2024-12	20	ai	750ff610b259271a639d8845b6bef1923ce94a369e397694fcfc9913f8c984d6	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:30.480314-06	\N	0.95	f
750	4	8	2024-12-26	TARGET 00012345 GRESHAM OR	-135.43	f	12/26 12/26 TARGET 00012345 GRESHAM OR 135.43	2024-12	20	ai	34264493d4c02e68d57f5bf7afda32ef5b346d3759664c80468a92608fc0b50e	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:30.481469-06	\N	0.90	f
748	4	3	2024-12-25	STARBUCKS STORE 05521 GRESHAM OR	-10.12	f	12/25 12/25 STARBUCKS STORE 05521 GRESHAM OR 10.12	2024-12	20	ai	c7b3e35b538e5e81037e59299000c338cfef59dda3383c39e5015e4c0394af49	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
747	4	3	2024-12-23	TST* PINE STATE BISCUITS PORTLAND OR	-59.93	f	12/23 12/25 TST* PINE STATE BISCUITS PORTLAND OR 59.93	2024-12	20	ai	255a68ae9944d97ca41bf9929cb14e202b29d6b6c6da0fa38730d88dc3cdccfd	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:31.123945-06	\N	0.90	f
725	4	3	2024-12-13	SQ *TACO PEDRO GRESHAM OR	-87.61	f	12/13 12/14 SQ *TACO PEDRO GRESHAM OR 87.61	2024-12	20	ai	b091cb23587d4b122dfb76fd9d10323353e7efdc0f6824020ce3ce75b357794a	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:31.186084-06	\N	0.95	f
727	4	3	2024-12-14	OLIVE GARDEN 0012345 GRESHAM OR	-95.50	f	12/14 12/16 OLIVE GARDEN 0012345 GRESHAM OR 95.50	2024-12	20	ai	4d626010a178cf334b924123b0457aafd8b1eefeff62196a6f234d7460307df1	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:31.374329-06	\N	0.95	f
731	4	4	2024-12-16	ALASKA AIR 0277142903318 SEATTLE WA PASSENGER: RIVERA/JORDAN M	-412.60	t	12/16 12/17 ALASKA AIR 0277142903318 SEATTLE WA PASSENGER: 412.60\nRIVERA/JORDAN M	2024-12	20	manual	fba68a285d0810bc1c61c858dd1673d251c3eca1ab41d6211817bb47e655fe44	2026-10-16 14:42:56.181941-06	2026-10-16 14:50:01.259854-06	\N	0.98	f
724	4	8	2024-12-12	AMZN Mktp US*GCGQC0 Amzn.com/bill WA	-38.16	f	12/12 12/13 AMZN Mktp US*GCGQC0 Amzn.com/bill WA 38.16	2024-12	20	rule	f1b487fce867a76a15ff63a892929aad3774a832a1abed9c13041083fb6f7a23	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.206011-06	\N	\N	f
726	4	5	2024-12-15	NETFLIX.COM 866-579-7172 CA	-22.99	f	12/15 12/15 NETFLIX.COM 866-579-7172 CA 22.99	2024-12	20	rule	6301c07ad06a2e3dcbb556f5781fe31b94bb5c4633bf3f95eceb9a591ca50e59	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.206642-06	\N	\N	f
732	4	8	2024-12-18	AMZN Mktp US*622X7P Amzn.com/bill WA	-97.41	f	12/18 12/19 AMZN Mktp US*622X7P Amzn.com/bill WA 97.41	2024-12	20	rule	19bb89ce93aed5dd258a0dc3f7bbe7f299336bda3da8514c97ac02af345fc727	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.207887-06	\N	\N	f
733	4	8	2024-12-18	AMZN Mktp US*QU5JGN Amzn.com/bill WA	-97.27	f	12/18 12/19 AMZN Mktp US*QU5JGN Amzn.com/bill WA 97.27	2024-12	20	rule	e3a9b6b5376d7bc253b9bb0339557a7414b64b29e1894313d2b498e492356e49	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.208242-06	\N	\N	f
735	4	8	2024-12-19	AMZN Mktp US*QXBAP0 Amzn.com/bill WA	-21.19	f	12/19 12/19 AMZN Mktp US*QXBAP0 Amzn.com/bill WA 21.19	2024-12	20	rule	2f6239413cd93b8f32b0693e49976a6cb894761af53287913636fee53d6f6cf1	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.208606-06	\N	\N	f
736	4	8	2024-12-19	AMZN Mktp US*D3NR9U Amzn.com/bill WA	-32.28	f	12/19 12/20 AMZN Mktp US*D3NR9U Amzn.com/bill WA 32.28	2024-12	20	rule	a9bc5b4941bd8430cf809e66b08f08a8c8e5078fc07779ab520abf5583e8e8d8	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.209002-06	\N	\N	f
737	4	8	2024-12-20	AMZN Mktp US*AQTVHX Amzn.com/bill WA	-127.78	f	12/20 12/20 AMZN Mktp US*AQTVHX Amzn.com/bill WA 127.78	2024-12	20	rule	a6aa3a448cb1bbf73d14f804d1a0be20229665fbd8ef57e58a44c1cd52f2c95b	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.209744-06	\N	\N	f
751	4	2	2024-12-26	COSTCO WHSE #0681 WOOD VILLAGE OR	-175.07	f	12/26 12/27 COSTCO WHSE #0681 WOOD VILLAGE OR 175.07	2024-12	20	rule	3ced9e6b71eb09aa45b94b45d3ede152271d8aa984747c43fcc5023e783a4e07	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.210648-06	\N	\N	f
719	4	2	2024-12-09	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-12.59	f	12/09 12/09 SQ *BLUE BOTTLE COFFEE OAKLAND CA 12.59	2024-12	20	ai	f11597361b351c7a5d67e6dac13bc4367341f54db876628a41bdbce10955bc30	2026-10-16 14:42:56.181941-06	2026-10-16 14:43:48.538982-06	\N	0.95	f
720	4	2	2024-12-09	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-12.80	f	12/09 12/09 SQ *BLUE BOTTLE COFFEE OAKLAND CA 12.80	2024-12	20	ai	1c42fa5c60037b82bb0d20e1a8d86b1760b36ea0a2d55bbd6664a27d687c7cf1	2026-10-16 14:42:56.181941-06	2026-10-16 14:43:48.539794-06	\N	0.95	f
722	4	8	2024-12-10	KOHL'S #1129 GRESHAM OR	-69.14	f	12/10 12/11 KOHL'S #1129 GRESHAM OR 69.14	2024-12	20	ai	ea53fd1106e51573b8964447fa61a29cbbacf359d60fb504de24a08577c8e177	2026-10-16 14:42:56.181941-06	2026-10-16 14:44:13.464252-06	\N	0.95	f
730	4	2	2024-12-15	SAFEWAY #1544 FAIRVIEW OR	-138.53	f	12/15 12/17 SAFEWAY #1544 FAIRVIEW OR 138.53	2024-12	20	ai	707ced4baa128dfa715917b5d94e3ecbbd27dafbf3ead3b397875ac2dca2bfbf	2026-10-16 14:42:56.181941-06	2026-10-16 14:44:13.473103-06	\N	0.95	f
734	4	2	2024-12-18	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-5.10	f	12/18 12/19 SQ *BLUE BOTTLE COFFEE OAKLAND CA 5.10	2024-12	20	ai	16aadf6aac74a15148deaaeec4ff6090070f4b11ae2a88a1f12d12522dc70c20	2026-10-16 14:42:56.181941-06	2026-10-16 14:44:37.63629-06	\N	0.95	f
756	4	5	2024-12-28	WHISTLER BLACKCOMB GUEST SVCS WHISTLER BC	-186.40	t	12/28 12/30 WHISTLER BLACKCOMB GUEST SVCS WHISTLER BC 186.40	2024-12	20	manual	2f193df904f9e89d5c2f720c8e8bde608d620740916fcba934db61e283c4d869	2026-10-16 14:42:56.181941-06	2026-10-16 14:50:01.265386-06	\N	0.90	f
764	4	10	2024-12-28	FOREIGN TRANSACTION FEE	-5.59	f	12/28 12/30 FOREIGN TRANSACTION FEE 5.59	2024-12	20	ai	7a006f7172603ec969cd3a156a4b3adf40c1e419e2f2d3feac9ad041dae0b398	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:30.485881-06	\N	0.80	f
649	2	1	2024-12-02	ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 4417730021	-2385.00	f	12/02 ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 2,385.00 6,325.03\n4417730021	2024-12	18	rule	1d8cd9ab7207ba612f8df970bad5ce18ca925c2e82d69c100185c8868e5d6510	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.203046-06	\N	\N	f
711	4	2	2024-12-05	COSTCO WHSE #0681 WOOD VILLAGE OR	-188.14	f	12/05 12/05 COSTCO WHSE #0681 WOOD VILLAGE OR 188.14	2024-12	20	rule	63c213a660b2aa998f9202703fe1af20206b2cb47afb91473bfa69fa4aeee400	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.204159-06	\N	\N	f
660	2	4	2024-12-06	POS DEBIT 12/05 SHELL OIL 57442	-66.12	f	12/06 POS DEBIT 12/05 SHELL OIL 57442 66.12 5,206.34	2024-12	18	rule	1bfb87d51d908ef2c6d9d3eefb1813271f7eff80840008949681f8429aa8e94f	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.20447-06	\N	\N	f
662	2	6	2024-12-09	ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 9300012231	-130.05	f	12/09 ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 130.05 5,066.42\n9300012231	2024-12	18	rule	94dfd09125befd90f00456e5b57d80050f03473d1d2e66537751b214cc1ea50d	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.205102-06	\N	\N	f
723	4	8	2024-12-11	AMZN Mktp US*LPWNEB Amzn.com/bill WA	-58.87	f	12/11 12/12 AMZN Mktp US*LPWNEB Amzn.com/bill WA 58.87	2024-12	20	rule	7e96ed6a46b08037cb647aa8c59cfe74dca667ccb47dbba0216897343ded45cf	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.205716-06	\N	\N	f
668	2	7	2024-12-13	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	12/13 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 8,881.37\n9100234517	2024-12	18	rule	43d5e9978a4bc6dacf91b96cb5566a9dfc5e7f04c3cebc6b69407faefab9934a	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.206315-06	\N	\N	f
728	4	2	2024-12-16	COSTCO WHSE #0681 WOOD VILLAGE OR	-186.92	f	12/16 12/16 COSTCO WHSE #0681 WOOD VILLAGE OR 186.92	2024-12	20	rule	030e99d85388475517d46792b1f8dbd24d4466cd0c1715a530997b241178fa06	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.2074-06	\N	\N	f
694	2	7	2024-12-27	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	12/27 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 7,316.92\n9100234517	2024-12	18	rule	3aa34dff27512b2939cf14d28afea16146a931a65ad372242f176c4ce820fe47	2026-10-16 14:42:56.14614-06	2026-10-16 14:42:56.210984-06	\N	\N	f
753	4	2	2024-12-28	COSTCO WHSE #0681 WOOD VILLAGE OR	-131.27	f	12/28 12/28 COSTCO WHSE #0681 WOOD VILLAGE OR 131.27	2024-12	20	rule	42545d93a450a28547a81090d93c89365552cc71a95cf0ce0b47656f5b08ca44	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.211378-06	\N	\N	f
757	4	4	2024-12-31	SHELL OIL 57442110021 FAIRVIEW OR	-58.44	f	12/31 12/31 SHELL OIL 57442110021 FAIRVIEW OR 58.44	2024-12	20	rule	b5a13a207dbfc3748f49cc41f631f8e7340d79c02e84338af8290bbd92529f35	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.212769-06	\N	\N	f
760	4	8	2025-01-01	AMZN Mktp US*ZVL4VG Amzn.com/bill WA	-103.13	f	01/01 01/02 AMZN Mktp US*ZVL4VG Amzn.com/bill WA 103.13	2024-12	20	rule	6cee24d13bea30b8958563bc1fc98a0c368db89c3ba0ce5b0c400be7a18e16be	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.213079-06	\N	\N	f
761	4	2	2025-01-02	COSTCO WHSE #0681 WOOD VILLAGE OR	-191.03	f	01/02 01/02 COSTCO WHSE #0681 WOOD VILLAGE OR 191.03	2024-12	20	rule	07e82d9c7a594049a635934b9f1adb7e0696a8be4c52e11b25cfb80c197d6fa7	2026-10-16 14:42:56.181941-06	2026-10-16 14:42:56.213365-06	\N	\N	f
755	4	2	2024-12-29	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-6.67	f	12/29 12/30 SQ *BLUE BOTTLE COFFEE OAKLAND CA 6.67	2024-12	20	ai	964056d70a4f880e5668cb88a592fddc434acf43d17e5802dc60e74e59917a38	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:50.480405-06	\N	0.95	f
606	1	9	2024-12-23	AUTOMATIC PAYMENT - THANK YOU	2291.92	f	12/23/2024,12/23/2024,AUTOMATIC PAYMENT - THANK YOU,,Payment,2291.92	2024-12	17	transfer	74c5ad877880549d7a592f420d62e271ca07363e62fd850c0ec7405b12457a09	2026-10-16 14:42:56.104719-06	2026-10-16 14:42:56.219506-06	689	\N	f
630	1	8	2024-12-10	CHEWY.COM 800-672-4399 FL	-85.86	f	12/10/2024,12/10/2024,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-85.86	2024-12	17	ai	6e5eb6ad86a3bad178d7c7f2bf311e0e71fde0c2c095bb22bfdb6820deb9005d	2026-10-16 14:42:56.104719-06	2026-10-16 14:43:48.540295-06	\N	0.90	f
628	1	3	2024-12-12	PANDA EXPRESS #1912 GRESHAM OR	-57.10	f	12/12/2024,12/13/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-57.10	2024-12	17	ai	61e1567f9c34bf25441edb76b1b48ee569a3959d13d89309aadf4d720d3f6f1d	2026-10-16 14:42:56.104719-06	2026-10-16 14:44:13.466536-06	\N	0.95	f
758	4	3	2024-12-31	TST* LUIGIS TRATTORIA FAIRVIEW OR	-86.09	f	12/31 12/31 TST* LUIGIS TRATTORIA FAIRVIEW OR 86.09	2024-12	20	ai	50d0d7158af9c2c6b84bc103c52d45a1558a39a5efdad66acc32c46d32996b36	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:50.4865-06	\N	0.95	f
762	4	3	2025-01-03	OLIVE GARDEN 0012345 GRESHAM OR	-55.89	f	01/03 01/03 OLIVE GARDEN 0012345 GRESHAM OR 55.89	2024-12	20	ai	696bfc4f4609468620dbcef1cf5b6add42c7a48f9dedb7c7256350649dfac0c1	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:50.48692-06	\N	0.95	f
763	4	5	2025-01-03	SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR	-95.00	f	01/03 01/04 SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR 95.00	2024-12	20	ai	83270a73dbfe0140e4a30dea542d4d427433a09ad91a0f82bb990ccdd16364bb	2026-10-16 14:42:56.181941-06	2026-10-16 14:45:50.487357-06	\N	0.90	f
771	1	2	2025-01-26	FRED-MEYER #0651 GRESHAM OR	-170.96	f	01/26/2025,01/28/2025,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-170.96	2025-01	21	ai	9d64eb0679dfc1f3e3c23dded0e170fef7bb6dbe7cddf588d58ecde200e5218b	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:59.96198-06	\N	0.90	f
772	1	2	2025-01-26	TRADER JOE S #145 PORTLAND OR	-166.50	f	01/26/2025,01/28/2025,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-166.50	2025-01	21	ai	600a2f602796d4f7217e364f30ff1792e851ea550fbf43236649c7f27c7b3bdb	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:59.962414-06	\N	0.90	f
773	1	10	2025-01-26	WALGREENS #06124 FAIRVIEW OR	-21.37	f	01/26/2025,01/27/2025,WALGREENS #06124 FAIRVIEW OR,Health & Wellness,Sale,-21.37	2025-01	21	ai	1e48e3c55e819c7c9b616c484e9a4a1d3c3e589057b129d818df340b2348136b	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:59.962841-06	\N	0.75	f
769	1	2	2025-01-27	FRED-MEYER #0651 GRESHAM OR	-184.24	f	01/27/2025,01/29/2025,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-184.24	2025-01	21	ai	7b13a50e4ae84df5315387862d9e731213a9f271d541cca9128fc4496e3f4231	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:59.963265-06	\N	0.90	f
759	4	3	2024-12-30	STARBUCKS STORE 05521 GRESHAM OR	-4.44	f	12/30 01/01 STARBUCKS STORE 05521 GRESHAM OR 4.44	2024-12	20	ai	528746daa5d399f88ab192097cfb3aa9a33283d059b7a0673a380e5f1c23bdd0	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
752	4	3	2024-12-27	SQ *CASCADE ROASTERS FAIRVIEW OR	-10.57	f	12/27 12/27 SQ *CASCADE ROASTERS FAIRVIEW OR 10.57	2024-12	20	ai	054435639a65d977adf6ddec41b029245748ef606a2b434b42a7828512773fbb	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:31.054101-06	\N	0.95	f
754	4	2	2024-12-29	NEW SEASONS MARKET FAIRVIEW OR	-211.04	f	12/29 12/30 NEW SEASONS MARKET FAIRVIEW OR 211.04	2024-12	20	ai	63b080136b77fc8a9e852727e55023232b1fc36b96359a9b3533c282da1abb59	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:32.340918-06	\N	0.90	f
770	1	8	2025-01-27	THE HOME DEPOT #4012 GRESHAM OR	-52.51	f	01/27/2025,01/29/2025,THE HOME DEPOT #4012 GRESHAM OR,Shopping,Sale,-52.51	2025-01	21	ai	897f00013ad54a8a8214d95358dcd1fd63aab8cab3898c63189ea7d3a9441455	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:34.890656-06	\N	0.85	f
801	1	4	2025-01-07	FRED-MEYER FUEL #0651 GRESHAM OR	-36.77	f	01/07/2025,01/08/2025,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-36.77	2025-01	21	ai	643d03ba4c268cee439b5ab0d7816a4e65b0881aebf1d0e419874f6ffd7b92a4	2026-10-16 14:45:50.631631-06	2026-10-16 14:46:40.55891-06	\N	0.90	f
797	1	4	2025-01-08	LYFT *RIDE FRI 7PM, SAN FRANCISCO CA	-34.00	f	01/08/2025,01/08/2025,LYFT *RIDE FRI 7PM, SAN FRANCISCO CA,Travel,Sale,-34.00	2025-01	21	ai	943b1157d716d4f9417260c9d4b815e764e683957b2d929e023406b22f56f248	2026-10-16 14:45:50.631631-06	2026-10-16 14:46:40.560534-06	\N	0.95	f
798	1	4	2025-01-08	CHEVRON 0098812 FAIRVIEW OR	-68.90	f	01/08/2025,01/10/2025,CHEVRON 0098812 FAIRVIEW OR,Gas,Sale,-68.90	2025-01	21	ai	c20c61c01ea9734cfb11d2c892584c8ef69dd1f9829b2d6e394f244ad28cc337	2026-10-16 14:45:50.631631-06	2026-10-16 14:46:40.560929-06	\N	0.95	f
799	1	4	2025-01-08	ARCO #82211 AMPM GRESHAM OR	-34.45	f	01/08/2025,01/08/2025,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-34.45	2025-01	21	ai	0d6d026a70b8809a9e09888a2df930628b5391cd62d85833af3330ef0e5edea3	2026-10-16 14:45:50.631631-06	2026-10-16 14:46:40.561318-06	\N	0.95	f
795	1	10	2025-01-09	CVS/PHARMACY #10422 GRESHAM OR	-42.43	f	01/09/2025,01/09/2025,CVS/PHARMACY #10422 GRESHAM OR,Health & Wellness,Sale,-42.43	2025-01	21	ai	650ca9215fd554e3440b95857d6f5f99500b6ef846738539caac898833a0afa8	2026-10-16 14:45:50.631631-06	2026-10-16 14:46:40.562225-06	\N	0.85	f
793	1	8	2025-01-11	THE HOME DEPOT #4012 GRESHAM OR	-53.01	f	01/11/2025,01/12/2025,THE HOME DEPOT #4012 GRESHAM OR,Shopping,Sale,-53.01	2025-01	21	ai	598600e5749f04a97c0859758e2c317f923dd072c82116ef947feef9dd9771f0	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:08.127148-06	\N	0.90	f
790	1	4	2025-01-12	FRED-MEYER FUEL #0651 GRESHAM OR	-54.54	f	01/12/2025,01/14/2025,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-54.54	2025-01	21	ai	11a68f86a4ef58a663cb64c9bcd78d9c42a43c05239a278f6fda1a70816fb07f	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:08.128687-06	\N	0.95	f
792	1	2	2025-01-12	TRADER JOE S #145 PORTLAND OR	-57.84	f	01/12/2025,01/13/2025,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-57.84	2025-01	21	ai	2a93e3f5269b2ed95c3904ac0f4138b210f4b1e997e3cf7e36940004b20237cc	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:08.129827-06	\N	0.90	f
787	1	8	2025-01-15	CHEWY.COM 800-672-4399 FL	-119.58	f	01/15/2025,01/15/2025,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-119.58	2025-01	21	ai	ccf3cb6588d1102c7c72c1aca56f4058b00a604c6239bfef006a82ad1630a25c	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:08.134426-06	\N	0.80	f
786	1	4	2025-01-16	ARCO #82211 AMPM GRESHAM OR	-43.34	f	01/16/2025,01/18/2025,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-43.34	2025-01	21	ai	a34a6366acdae2df542209f964b0f5d400b82d83da30e13a5903509cc06c872e	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:08.135646-06	\N	0.95	f
785	1	5	2025-01-18	HULU 877-8244858 CA	-18.99	f	01/18/2025,01/18/2025,HULU 877-8244858 CA,Entertainment,Sale,-18.99	2025-01	21	ai	2c54d32b609b14715edff92fa38c1ca56bca93b864a65f12129549ccee306e32	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:33.056843-06	\N	0.95	f
782	1	4	2025-01-19	ARCO #82211 AMPM GRESHAM OR	-66.45	f	01/19/2025,01/21/2025,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-66.45	2025-01	21	ai	69cc9ff3359c7e2aa9c8ae352ef740891622d109e44b2514d05de99efcccedb5	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:33.05823-06	\N	0.90	f
783	1	2	2025-01-19	TRADER JOE S #145 PORTLAND OR	-141.59	f	01/19/2025,01/19/2025,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-141.59	2025-01	21	ai	314df9d637d7fdbe417e3daec8c646dc8e2a9e6c32a53c794b8d74f436099a90	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:33.058614-06	\N	0.95	f
776	1	8	2025-01-23	SQ *SMITH & SONS, LLC PORTLAND OR	-63.37	f	01/23/2025,01/23/2025,SQ *SMITH & SONS, LLC PORTLAND OR,Shopping,Sale,-63.37	2025-01	21	ai	b63b16843b5e39838826765be989fd63f11f2466a56d56ec26bde3e400e57d4e	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:59.957317-06	\N	0.80	f
777	1	3	2025-01-23	DOORDASH*BURGERVILLE #12	-28.16	f	01/23/2025,01/23/2025,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-28.16	2025-01	21	ai	93e2a9938c7ab302455aab3e1f7f7f4cdea886d2611923bb71d1cb3d771350e6	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:59.957743-06	\N	0.95	f
778	1	4	2025-01-23	FRED-MEYER FUEL #0651 GRESHAM OR	-41.91	f	01/23/2025,01/25/2025,FRED-MEYER FUEL #0651 GRESHAM OR,Gas,Sale,-41.91	2025-01	21	ai	e16f296c9d2c0de1aba41338008de2404e2d877220227836e6b31a5dd814a357	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:59.958169-06	\N	0.90	f
803	1	3	2025-01-05	DOORDASH*BURGERVILLE #12	-17.40	f	01/05/2025,01/07/2025,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-17.40	2025-01	21	ai	c020edc13f185c8c62b01f287a8d416e8b2a8b37b59d8f707731690cd223fbd7	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
802	1	3	2025-01-06	UBER *EATS PENDING HELP.UBER.COM CA	-53.28	f	01/06/2025,01/06/2025,UBER *EATS PENDING HELP.UBER.COM CA,Food & Drink,Sale,-53.28	2025-01	21	ai	3fd5dc575e3c523874d1d845b7b81e784c5f9c2109669ae341e4a7ed39f8a042	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.058457-06	\N	0.95	f
780	1	3	2025-01-21	UBER *EATS PENDING HELP.UBER.COM CA	-27.29	f	01/21/2025,01/22/2025,UBER *EATS PENDING HELP.UBER.COM CA,Food & Drink,Sale,-27.29	2025-01	21	ai	0d992aba42f8f6a4f39f90bc72a398861bcd39307acee47c98f0d9c1bc5679d3	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.058457-06	\N	0.95	f
791	1	3	2025-01-12	PANDA EXPRESS #1912 GRESHAM OR	-32.08	f	01/12/2025,01/14/2025,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-32.08	2025-01	21	ai	ed43e600c0a2f594b32ed13b9626fff61c2f901b2fd5128b40dd371e4db5b8f2	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
779	1	3	2025-01-21	PANDA EXPRESS #1912 GRESHAM OR	-19.56	f	01/21/2025,01/22/2025,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-19.56	2025-01	21	ai	3da54f4b6d3ff75ddea9caeebdd8be5d36dd2054c3e7a93aba2192ce817c3156	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
800	1	2	2025-01-07	TRADER JOE S #145 PORTLAND OR	-116.97	f	01/07/2025,01/08/2025,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-116.97	2025-01	21	ai	77b74ba2bb0c0d1ee0acd9da2677dca9057b632c89f67d17613190be61c2a93e	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.456761-06	\N	0.90	f
804	1	2	2025-01-04	FRED-MEYER #0651 GRESHAM OR	-187.34	f	01/04/2025,01/05/2025,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-187.34	2025-01	21	ai	37ffdc25c1ee89354a3aaf9a45bf806437d7529a860236bd4d0dd10e17126ad5	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
796	1	2	2025-01-09	FRED-MEYER #0651 GRESHAM OR	-156.98	f	01/09/2025,01/10/2025,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-156.98	2025-01	21	ai	22acc20766c88d4a19b351db69d96f8abe61c44ac490df4d2fd6fd2cb3d05369	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
789	1	8	2025-01-14	PAYPAL *ETSY, INC 4029357733 CA	23.50	f	01/14/2025,01/16/2025,PAYPAL *ETSY, INC 4029357733 CA,Shopping,Return,23.50	2025-01	21	ai	49806849dec46151dd86165b5d92873bb8366c040faa0d9e836af876b620cd4f	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:34.83032-06	\N	0.90	f
825	2	7	2025-01-08	VENMO CASHOUT PPD ID: 5264681992	72.50	f	<TRNTYPE>CREDIT</TRNTYPE> <DTPOSTED>20250108120000.000[-8:PST]</DTPOSTED> <TRNAMT>72.50</TRNAMT> <FITID>MFB2025010800127250</FITID> <NAME>VENMO CASHOUT PPD ID: 5264681992</NAME>	2025-01	23	ai	24c692a844027ccb95dc674b8528a6306549d6541cc65920f2b3ee875b056e1c	2026-10-16 14:45:50.646579-06	2026-10-16 14:46:40.561708-06	\N	0.55	t
822	2	4	2025-01-06	POS DEBIT 01/05 SHELL OIL 57442	-57.21	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250106120000.000[-8:PST]</DTPOSTED> <TRNAMT>-57.21</TRNAMT> <FITID>MFB2025010600095721</FITID> <NAME>POS DEBIT 01/05 SHELL OIL 57442</NAME>	2025-01	23	rule	538e0632416a1c46d767449cf412036165fc24df7159269376ff1885e40491e1	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.701107-06	\N	\N	f
824	2	6	2025-01-08	ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 9300012231	-176.97	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250108120000.000[-8:PST]</DTPOSTED> <TRNAMT>-176.97</TRNAMT> <FITID>MFB2025010800117724</FITID> <NAME>ACH DEBIT CASCADE POWER &amp; LIGHT</NAME> <MEMO>ACH DEBIT CASCADE POWER &amp; LIGHT ONLINE PMT WEB ID: 9300012231</MEMO>	2025-01	23	rule	46d5a00179070263588f932c7baafd456d79ac2c3e6877ccf6763710a6f6f158	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.701665-06	\N	\N	f
819	2	9	2025-01-06	ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS XXXXXX4471 REF #IBX9M20E2	-500.00	f	<TRNTYPE>XFER</TRNTYPE> <DTPOSTED>20250106120000.000[-8:PST]</DTPOSTED> <TRNAMT>-500.00</TRNAMT> <FITID>MFB2025010600060135</FITID> <NAME>ONLINE TRANSFER TO MAPLE FEDERAL</NAME> <MEMO>ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS XXXXXX4471 REF #IBX9M20E2</MEMO>	2025-01	23	transfer	e4347fb82a9270ff0ca08bd52af341d9222c2f9c5fd12018c234ef49ed57edc6	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.712791-06	864	\N	f
812	1	2	2025-01-01	TRADER JOE S #145 PORTLAND OR	-78.32	f	01/01/2025,01/03/2025,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-78.32	2025-01	21	ai	1dbf7df84b548ad5fbca2c87974d237507a8a1bae7024b671be6c81eb46b0fb5	2026-10-16 14:45:50.631631-06	2026-10-16 14:46:16.617121-06	\N	0.95	f
815	2	2	2025-01-02	POS DEBIT 01/01 GROCERY OUTLET #388 GRESHAM OR	-163.73	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250102120000.000[-8:PST]</DTPOSTED> <TRNAMT>-163.73</TRNAMT> <FITID>MFB2025010200026400</FITID> <NAME>POS DEBIT 01/01 GROCERY OUTLET #</NAME> <MEMO>POS DEBIT 01/01 GROCERY OUTLET #388 GRESHAM OR</MEMO>	2025-01	23	ai	349516a221467cfc3ff7244438fa4da1b9cb7f651d1987f14c92840bfd7a603e	2026-10-16 14:45:50.646579-06	2026-10-16 14:46:16.624628-06	\N	0.95	f
817	2	10	2025-01-02	ATM WITHDRAWAL 01/02 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-200.00	f	<TRNTYPE>ATM</TRNTYPE> <DTPOSTED>20250102120000.000[-8:PST]</DTPOSTED> <TRNAMT>-200.00</TRNAMT> <FITID>MFB2025010200040054</FITID> <NAME>ATM WITHDRAWAL 01/02 MAPLE FEDER</NAME> <MEMO>ATM WITHDRAWAL 01/02 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR</MEMO>	2025-01	23	ai	c64ad9b0827f6723284e6db53ea786bccf5c9d34cbd8a99d6966a81c99ff3bf8	2026-10-16 14:45:50.646579-06	2026-10-16 14:46:16.625911-06	\N	0.70	f
807	1	4	2025-01-03	LYFT *RIDE FRI 5PM, SAN FRANCISCO CA	-18.74	f	01/03/2025,01/04/2025,LYFT *RIDE FRI 5PM, SAN FRANCISCO CA,Travel,Sale,-18.74	2025-01	21	ai	fa5e05935ffa062e3ef662f29414aa43ff78e83f0c30bf73cdefe6d7068c0342	2026-10-16 14:45:50.631631-06	2026-10-16 14:46:16.626367-06	\N	0.95	f
808	1	2	2025-01-03	TRADER JOE S #145 PORTLAND OR	-104.96	f	01/03/2025,01/04/2025,TRADER JOE S #145 PORTLAND OR,Groceries,Sale,-104.96	2025-01	21	ai	5284445202fd70846315d69379872078362a6ce7547c924c9a65b934fa15f12f	2026-10-16 14:45:50.631631-06	2026-10-16 14:46:16.626843-06	\N	0.95	f
805	1	4	2025-01-04	CHEVRON 0098812 FAIRVIEW OR	-38.03	f	01/04/2025,01/04/2025,CHEVRON 0098812 FAIRVIEW OR,Gas,Sale,-38.03	2025-01	21	ai	1a26fc6837e8ce6921aa03685f0adbfb506106453347b0c7f0de2c2f77eac95b	2026-10-16 14:45:50.631631-06	2026-10-16 14:46:16.628602-06	\N	0.90	f
821	2	2	2025-01-06	DEBIT CARD PURCHASE 01/05 SAFEWAY #1544 FAIRVIEW OR	-105.58	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250106120000.000[-8:PST]</DTPOSTED> <TRNAMT>-105.58</TRNAMT> <FITID>MFB2025010600080585</FITID> <NAME>DEBIT CARD PURCHASE 01/05 SAFEWA</NAME> <MEMO>DEBIT CARD PURCHASE 01/05 SAFEWAY #1544 FAIRVIEW OR</MEMO>	2025-01	23	ai	7a35469a7d8047a7429f9c0e1a1bfd3ada6ebfdb4b53a7bc00ea5b5df9a13cf4	2026-10-16 14:45:50.646579-06	2026-10-16 14:46:16.632586-06	\N	0.95	f
820	2	3	2025-01-06	DEBIT CARD PURCHASE 01/04 DUTCH BROS #OR0212 FAIRVIEW OR	-10.12	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250106120000.000[-8:PST]</DTPOSTED> <TRNAMT>-10.12</TRNAMT> <FITID>MFB2025010600071012</FITID> <NAME>DEBIT CARD PURCHASE 01/04 DUTCH</NAME> <MEMO>DEBIT CARD PURCHASE 01/04 DUTCH BROS #OR0212 FAIRVIEW OR</MEMO>	2025-01	23	ai	13f58eff4b64ecefd6b23b7e9aec560b6f87733a373a4dd7b921382d7e8abf1f	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
816	2	3	2025-01-02	DEBIT CARD PURCHASE 01/01 SQ *CASCADE ROASTERS FAIRVIEW OR	-10.34	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250102120000.000[-8:PST]</DTPOSTED> <TRNAMT>-10.34</TRNAMT> <FITID>MFB2025010200031034</FITID> <NAME>DEBIT CARD PURCHASE 01/01 SQ *CA</NAME> <MEMO>DEBIT CARD PURCHASE 01/01 SQ *CASCADE ROASTERS FAIRVIEW OR</MEMO>	2025-01	23	ai	f6073bc04f2b6bec35ee6a59a98e146352686d1760a818dab359bf0ab3a9a792	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
823	2	3	2025-01-07	POS DEBIT 01/06 MCDONALD'S F21877 FAIRVIEW OR	-61.41	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250107120000.000[-8:PST]</DTPOSTED> <TRNAMT>-61.41</TRNAMT> <FITID>MFB2025010700106141</FITID> <NAME>POS DEBIT 01/06 MCDONALD'S F2187</NAME> <MEMO>POS DEBIT 01/06 MCDONALD'S F21877 FAIRVIEW OR</MEMO>	2025-01	23	ai	d61d808a2df47445a7686b0075fe050e6d665d5399a668fb9b880da0adb06091	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:31.771845-06	\N	0.95	f
810	1	3	2025-01-02	DOORDASH*BURGERVILLE #12	-53.91	f	01/02/2025,01/04/2025,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-53.91	2025-01	21	ai	bd5cf00279dc4810af24a72cfb4e36a156b6ee4e947dd1ca63ec82e4dcb71093	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
813	1	3	2025-01-01	PANDA EXPRESS #1912 GRESHAM OR	-46.75	f	01/01/2025,01/03/2025,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-46.75	2025-01	21	ai	8dd40f081e474880230923ef248c00259334c4e7eda1257bc06725e95b0b50ec	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
809	1	3	2025-01-03	PANDA EXPRESS #1912 GRESHAM OR	-49.84	f	01/03/2025,01/05/2025,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-49.84	2025-01	21	ai	46fc5453739fd175778f40cc768d3f15ee3751a712c81ed723473473d1f9ee71	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
811	1	5	2025-01-02	APPLE.COM/BILL 866-712-7753 CA	-9.99	f	01/02/2025,01/04/2025,APPLE.COM/BILL 866-712-7753 CA,Entertainment,Sale,-9.99	2025-01	21	ai	ed6b1754907ed526d6cab075a28666723f6f2f012b382950fcc633dbf131c9ab	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:33.446938-06	\N	0.85	f
818	2	1	2025-01-03	ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 6610023385	-188.42	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250103120000.000[-8:PST]</DTPOSTED> <TRNAMT>-188.42</TRNAMT> <FITID>MFB2025010300058869</FITID> <NAME>ACH DEBIT EVERGREEN MUTUAL INS P</NAME> <MEMO>ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 6610023385</MEMO>	2025-01	23	ai	9e7f8d805328f92d8926e0a4b7a53213051cf447424435d4ab51485c6f982b68	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:34.35337-06	\N	0.90	f
826	2	10	2025-01-09	CHECK #1046	-160.00	f	<TRNTYPE>CHECK</TRNTYPE> <DTPOSTED>20250109120000.000[-8:PST]</DTPOSTED> <TRNAMT>-160.00</TRNAMT> <FITID>MFB2025010900136027</FITID> <CHECKNUM>1046</CHECKNUM> <NAME>CHECK #1046</NAME>	2025-01	23	ai	e1847b968713136719cd7e689d41b9e13cfb07bd7cf8222575cff08d20b95b52	2026-10-16 14:45:50.646579-06	2026-10-16 14:46:40.563413-06	\N	0.48	t
891	4	8	2025-01-18	AMZN Mktp US*Z5MWNU Amzn.com/bill WA	-54.69	f	01/18 01/20 AMZN Mktp US*Z5MWNU Amzn.com/bill WA 54.69	2025-01	26	rule	9660992cad8155309c9624d5b3d51312170562242b194cd5f9499bf90acfff13	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.705505-06	\N	\N	f
827	2	10	2025-01-09	DEBIT CARD PURCHASE 01/08 RITE AID STORE 5411 GRESHAM OR	-17.54	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250109120000.000[-8:PST]</DTPOSTED> <TRNAMT>-17.54</TRNAMT> <FITID>MFB2025010900141754</FITID> <NAME>DEBIT CARD PURCHASE 01/08 RITE A</NAME> <MEMO>DEBIT CARD PURCHASE 01/08 RITE AID STORE 5411 GRESHAM OR</MEMO>	2025-01	23	ai	ab529bebc6158803b9692561aa89be45273258628c3f5646ab12d32d6958fa91	2026-10-16 14:45:50.646579-06	2026-10-16 14:46:40.564055-06	\N	0.80	f
828	2	8	2025-01-09	POS DEBIT 01/08 DOLLAR TREE #6612 FAIRVIEW OR	-29.29	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250109120000.000[-8:PST]</DTPOSTED> <TRNAMT>-29.29</TRNAMT> <FITID>MFB2025010900152929</FITID> <NAME>POS DEBIT 01/08 DOLLAR TREE #661</NAME> <MEMO>POS DEBIT 01/08 DOLLAR TREE #6612 FAIRVIEW OR</MEMO>	2025-01	23	ai	badda0e6a106fc81c803b3267bedfd723ce4ec85b672a6822aeda4616fc8f9ad	2026-10-16 14:45:50.646579-06	2026-10-16 14:46:40.564594-06	\N	0.90	f
831	2	7	2025-01-10	ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 8830021147	1350.00	f	<TRNTYPE>CREDIT</TRNTYPE> <DTPOSTED>20250110120000.000[-8:PST]</DTPOSTED> <TRNAMT>1350.00</TRNAMT> <FITID>MFB2025011000185351</FITID> <NAME>ACH DEPOSIT HARBORVIEW CONSULTIN</NAME> <MEMO>ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 8830021147</MEMO>	2025-01	23	ai	d77d8bb51ba64c8290b4b86a74424538171797d9bfd35e64f758e4418d70c971	2026-10-16 14:45:50.646579-06	2026-10-16 14:46:40.567273-06	\N	0.95	f
832	2	6	2025-01-13	ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 3300298811	-74.69	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250113120000.000[-8:PST]</DTPOSTED> <TRNAMT>-74.69</TRNAMT> <FITID>MFB2025011300197469</FITID> <NAME>ACH DEBIT FAIRVIEW CITY UTILITIE</NAME> <MEMO>ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 3300298811</MEMO>	2025-01	23	ai	ffb35e8a95e87c26c59516938ac447587ef46208cd02e72f281681721ceb474f	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:08.130331-06	\N	0.95	f
834	2	2	2025-01-13	DEBIT CARD PURCHASE 01/11 GROCERY OUTLET #388 GRESHAM OR	-90.50	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250113120000.000[-8:PST]</DTPOSTED> <TRNAMT>-90.50</TRNAMT> <FITID>MFB2025011300219050</FITID> <NAME>DEBIT CARD PURCHASE 01/11 GROCER</NAME> <MEMO>DEBIT CARD PURCHASE 01/11 GROCERY OUTLET #388 GRESHAM OR</MEMO>	2025-01	23	ai	dfeb6153b43df8e038fb77b0091a4cad94dd5778d12da8d48eba04b150dadec9	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:08.131243-06	\N	0.95	f
836	2	3	2025-01-13	DEBIT CARD PURCHASE 01/13 CHIPOTLE 2291 GRESHAM OR	-9.55	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250113120000.000[-8:PST]</DTPOSTED> <TRNAMT>-9.55</TRNAMT> <FITID>MFB2025011300230955</FITID> <NAME>DEBIT CARD PURCHASE 01/13 CHIPOT</NAME> <MEMO>DEBIT CARD PURCHASE 01/13 CHIPOTLE 2291 GRESHAM OR</MEMO>	2025-01	23	ai	387d181d5bacd2cd443e4555cb05b6cc6bd115328d3eab843c395b47deb4f155	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:08.132056-06	\N	0.95	f
837	2	3	2025-01-14	DEBIT CARD PURCHASE 01/14 MCDONALD'S F21877 FAIRVIEW OR	-45.78	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250114120000.000[-8:PST]</DTPOSTED> <TRNAMT>-45.78</TRNAMT> <FITID>MFB2025011400244578</FITID> <NAME>DEBIT CARD PURCHASE 01/14 MCDONA</NAME> <MEMO>DEBIT CARD PURCHASE 01/14 MCDONALD'S F21877 FAIRVIEW OR</MEMO>	2025-01	23	ai	289acd7a172e8988ba07fc7aad3c091e368cccef642411a1d00962f18d4305f4	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:08.132916-06	\N	0.95	f
839	2	4	2025-01-15	POS DEBIT 01/15 CHEVRON 0098812 FAIRVIEW OR	-47.22	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250115120000.000[-8:PST]</DTPOSTED> <TRNAMT>-47.22</TRNAMT> <FITID>MFB2025011500264722</FITID> <NAME>POS DEBIT 01/15 CHEVRON 0098812</NAME> <MEMO>POS DEBIT 01/15 CHEVRON 0098812 FAIRVIEW OR</MEMO>	2025-01	23	ai	36404ecec89cd720e7e87e34d6f63eb5b3df09987e73a9e8b44b7b7e6b5599f8	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:08.13524-06	\N	0.95	f
840	2	2	2025-01-16	DEBIT CARD PURCHASE 01/15 SAFEWAY #1544 FAIRVIEW OR	-28.88	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250116120000.000[-8:PST]</DTPOSTED> <TRNAMT>-28.88</TRNAMT> <FITID>MFB2025011600272888</FITID> <NAME>DEBIT CARD PURCHASE 01/15 SAFEWA</NAME> <MEMO>DEBIT CARD PURCHASE 01/15 SAFEWAY #1544 FAIRVIEW OR</MEMO>	2025-01	23	ai	6bc0d6bbf8f1d315c6c38b78c15c544edba80b000167595b34fcaf0c6c2501ae	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:08.136065-06	\N	0.95	f
841	2	10	2025-01-16	ATM WITHDRAWAL 01/16 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-60.00	f	<TRNTYPE>ATM</TRNTYPE> <DTPOSTED>20250116120000.000[-8:PST]</DTPOSTED> <TRNAMT>-60.00</TRNAMT> <FITID>MFB2025011600286000</FITID> <NAME>ATM WITHDRAWAL 01/16 MAPLE FEDER</NAME> <MEMO>ATM WITHDRAWAL 01/16 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR</MEMO>	2025-01	23	ai	9629c66bd5278c17e12f22e40283103c6c7b063f50d74b0eb49f17763c53b42d	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:08.136813-06	\N	0.80	f
842	2	3	2025-01-16	DEBIT CARD PURCHASE 01/16 TST* LUIGIS TRATTORIA FAIRVIEW OR	-27.31	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250116120000.000[-8:PST]</DTPOSTED> <TRNAMT>-27.31</TRNAMT> <FITID>MFB2025011600292731</FITID> <NAME>DEBIT CARD PURCHASE 01/16 TST* L</NAME> <MEMO>DEBIT CARD PURCHASE 01/16 TST* LUIGIS TRATTORIA FAIRVIEW OR</MEMO>	2025-01	23	ai	c010b741508d5a4e5a9922bf969ca72608b16b5ed8b36a216e6786f69ed1a05a	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:33.0476-06	\N	0.95	f
829	2	3	2025-01-09	POS DEBIT 01/09 SQ *CASCADE ROASTERS FAIRVIEW OR	-8.72	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250109120000.000[-8:PST]</DTPOSTED> <TRNAMT>-8.72</TRNAMT> <FITID>MFB2025010900160872</FITID> <NAME>POS DEBIT 01/09 SQ *CASCADE ROAS</NAME> <MEMO>POS DEBIT 01/09 SQ *CASCADE ROASTERS FAIRVIEW OR</MEMO>	2025-01	23	ai	78a5ee920bddc1e180fa0cf3ebedc464acd9af27740d9c942f41555ab74eb36a	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
833	2	10	2025-01-13	DEBIT CARD PURCHASE 01/11 WALGREENS #06124 FAIRVIEW OR	-10.28	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250113120000.000[-8:PST]</DTPOSTED> <TRNAMT>-10.28</TRNAMT> <FITID>MFB2025011300201028</FITID> <NAME>DEBIT CARD PURCHASE 01/11 WALGRE</NAME> <MEMO>DEBIT CARD PURCHASE 01/11 WALGREENS #06124 FAIRVIEW OR</MEMO>	2025-01	23	ai	c5f382a4f0dd24c37397004b9187510dc1421d4047422e97f1786e65c76a3edc	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:35.549706-06	\N	0.85	f
857	2	7	2025-01-29	MOBILE DEPOSIT REF NUMBER :418820557731	125.00	f	<TRNTYPE>CREDIT</TRNTYPE> <DTPOSTED>20250129120000.000[-8:PST]</DTPOSTED> <TRNAMT>125.00</TRNAMT> <FITID>MFB2025012900442527</FITID> <NAME>MOBILE DEPOSIT REF NUMBER :41882</NAME> <MEMO>MOBILE DEPOSIT REF NUMBER :418820557731</MEMO>	2025-01	23	ai	6b2a551fdcde81764539d9455311d9363394625a8bd2e4401a34ae54054d5de6	2026-10-16 14:45:50.646579-06	2026-10-16 14:48:26.953497-06	\N	0.60	t
853	2	4	2025-01-27	POS DEBIT 01/24 SHELL OIL 57442	-39.60	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250127120000.000[-8:PST]</DTPOSTED> <TRNAMT>-39.60</TRNAMT> <FITID>MFB2025012700403960</FITID> <NAME>POS DEBIT 01/24 SHELL OIL 57442</NAME>	2025-01	23	rule	37d03fae2a93c5ca28cbf8d587c4a86b9556d5df1dec40cc80c4ef7da5b71bd5	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.708384-06	\N	\N	f
846	2	9	2025-01-21	ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# TFW4SUPB	-4839.07	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250121120000.000[-8:PST]</DTPOSTED> <TRNAMT>-4839.07</TRNAMT> <FITID>MFB2025012100335203</FITID> <NAME>ONLINE PMT SUMMIT VISA ACCT ENDI</NAME> <MEMO>ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# TFW4SUPB</MEMO>	2025-01	23	transfer	9ba76717add1eb13e33187dc2a5f7dd1e8da3360c6e4efc54af31978a8804dba	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.714155-06	866	\N	f
852	2	9	2025-01-24	HARBOR CARD AUTOPAY PPD ID: 7781000231	-2934.15	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250124120000.000[-8:PST]</DTPOSTED> <TRNAMT>-2934.15</TRNAMT> <FITID>MFB2025012400394198</FITID> <NAME>HARBOR CARD AUTOPAY PPD ID: 7781</NAME> <MEMO>HARBOR CARD AUTOPAY PPD ID: 7781000231</MEMO>	2025-01	23	transfer	1d59b449616d99ef31bf85b59b32b1279ca23e812a5bf777890c357a39211af9	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.715142-06	775	\N	f
843	2	6	2025-01-17	RIVERNET BROADBAND AUTOPAY 800-555-0142	-79.99	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250117120000.000[-8:PST]</DTPOSTED> <TRNAMT>-79.99</TRNAMT> <FITID>MFB2025011700307999</FITID> <NAME>RIVERNET BROADBAND AUTOPAY 800-5</NAME> <MEMO>RIVERNET BROADBAND AUTOPAY 800-555-0142</MEMO>	2025-01	23	ai	2cd32fd250961211cbe5d640f043542d5c8a235cf18b8abc14f238cb4f14d52d	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:33.055135-06	\N	0.95	f
844	2	4	2025-01-20	POS DEBIT 01/20 CHEVRON 0098812 FAIRVIEW OR	-32.07	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250120120000.000[-8:PST]</DTPOSTED> <TRNAMT>-32.07</TRNAMT> <FITID>MFB2025012000313207</FITID> <NAME>POS DEBIT 01/20 CHEVRON 0098812</NAME> <MEMO>POS DEBIT 01/20 CHEVRON 0098812 FAIRVIEW OR</MEMO>	2025-01	23	ai	5de22ca83ec4cf79c5bb92ceb8d4d37a724393346987632978bdc6e68a2f2867	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:33.059354-06	\N	0.90	f
847	2	2	2025-01-21	POS DEBIT 01/21 GROCERY OUTLET #388 GRESHAM OR	-173.90	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250121120000.000[-8:PST]</DTPOSTED> <TRNAMT>-173.90</TRNAMT> <FITID>MFB2025012100347417</FITID> <NAME>POS DEBIT 01/21 GROCERY OUTLET #</NAME> <MEMO>POS DEBIT 01/21 GROCERY OUTLET #388 GRESHAM OR</MEMO>	2025-01	23	ai	c80f956819806e908f6eb0eb9ad7e0f4fcd1d2b9b158e5bd5bb115420bb8acc6	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:33.063148-06	\N	0.95	f
849	2	2	2025-01-22	POS DEBIT 01/21 GROCERY OUTLET #388 GRESHAM OR	-87.45	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250122120000.000[-8:PST]</DTPOSTED> <TRNAMT>-87.45</TRNAMT> <FITID>MFB2025012200368745</FITID> <NAME>POS DEBIT 01/21 GROCERY OUTLET #</NAME> <MEMO>POS DEBIT 01/21 GROCERY OUTLET #388 GRESHAM OR</MEMO>	2025-01	23	ai	be937eb9d9388b3082a425ff2e36c2cf4504ebcfe4fab1b19b0f6dbb976d51be	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:59.956452-06	\N	0.90	f
850	2	2	2025-01-22	DEBIT CARD PURCHASE 01/22 SAFEWAY #1544 FAIRVIEW OR	-61.90	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250122120000.000[-8:PST]</DTPOSTED> <TRNAMT>-61.90</TRNAMT> <FITID>MFB2025012200376190</FITID> <NAME>DEBIT CARD PURCHASE 01/22 SAFEWA</NAME> <MEMO>DEBIT CARD PURCHASE 01/22 SAFEWAY #1544 FAIRVIEW OR</MEMO>	2025-01	23	ai	c0a65c1552ec53337962f311a39f9accd3acdcc0bc5c486213185a461f287f7a	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:59.956888-06	\N	0.90	f
855	2	3	2025-01-27	DEBIT CARD PURCHASE 01/26 CHIPOTLE 2291 GRESHAM OR	-55.19	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250127120000.000[-8:PST]</DTPOSTED> <TRNAMT>-55.19</TRNAMT> <FITID>MFB2025012700425519</FITID> <NAME>DEBIT CARD PURCHASE 01/26 CHIPOT</NAME> <MEMO>DEBIT CARD PURCHASE 01/26 CHIPOTLE 2291 GRESHAM OR</MEMO>	2025-01	23	ai	5463c1e9991fd6ad7cee4a2bf38db468714354e5f148ff999676506cb19162fb	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:59.964453-06	\N	0.95	f
856	2	4	2025-01-28	POS DEBIT 01/27 CHEVRON 0098812 FAIRVIEW OR	-64.02	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250128120000.000[-8:PST]</DTPOSTED> <TRNAMT>-64.02</TRNAMT> <FITID>MFB2025012800436402</FITID> <NAME>POS DEBIT 01/27 CHEVRON 0098812</NAME> <MEMO>POS DEBIT 01/27 CHEVRON 0098812 FAIRVIEW OR</MEMO>	2025-01	23	ai	6c8dfd9503b164a80f969c42e3be8f6a8b3b609842310d910c551dac676855e4	2026-10-16 14:45:50.646579-06	2026-10-16 14:48:26.951413-06	\N	0.90	f
858	2	4	2025-01-29	POS DEBIT 01/28 CHEVRON 0098812 FAIRVIEW OR	-48.11	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250129120000.000[-8:PST]</DTPOSTED> <TRNAMT>-48.11</TRNAMT> <FITID>MFB2025012900454811</FITID> <NAME>POS DEBIT 01/28 CHEVRON 0098812</NAME> <MEMO>POS DEBIT 01/28 CHEVRON 0098812 FAIRVIEW OR</MEMO>	2025-01	23	ai	521925eeabb052435ad46a5295a3e34b0f28494425493d4fc60a820503f7d261	2026-10-16 14:45:50.646579-06	2026-10-16 14:48:26.953945-06	\N	0.90	f
859	2	3	2025-01-29	DEBIT CARD PURCHASE 01/29 DUTCH BROS #OR0212 FAIRVIEW OR	-7.33	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250129120000.000[-8:PST]</DTPOSTED> <TRNAMT>-7.33</TRNAMT> <FITID>MFB2025012900460733</FITID> <NAME>DEBIT CARD PURCHASE 01/29 DUTCH</NAME> <MEMO>DEBIT CARD PURCHASE 01/29 DUTCH BROS #OR0212 FAIRVIEW OR</MEMO>	2025-01	23	ai	28405c5784bff15711d55962015b4c10237df06731681d5b0e7c6b19136622be	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:30.878729-06	\N	0.95	f
854	2	3	2025-01-27	POS DEBIT 01/25 SQ *CASCADE ROASTERS FAIRVIEW OR	-5.29	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250127120000.000[-8:PST]</DTPOSTED> <TRNAMT>-5.29</TRNAMT> <FITID>MFB2025012700410529</FITID> <NAME>POS DEBIT 01/25 SQ *CASCADE ROAS</NAME> <MEMO>POS DEBIT 01/25 SQ *CASCADE ROASTERS FAIRVIEW OR</MEMO>	2025-01	23	ai	5074683095fdbb785e8254400cbf61bb03997c76af2caced29076ca93a0923f4	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
860	2	3	2025-01-29	DEBIT CARD PURCHASE 01/29 CHIPOTLE 2291 GRESHAM OR	-45.46	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250129120000.000[-8:PST]</DTPOSTED> <TRNAMT>-45.46</TRNAMT> <FITID>MFB2025012900474546</FITID> <NAME>DEBIT CARD PURCHASE 01/29 CHIPOT</NAME> <MEMO>DEBIT CARD PURCHASE 01/29 CHIPOTLE 2291 GRESHAM OR</MEMO>	2025-01	23	ai	65d0d4bd76f0f2e78b2688f0f6b1183e34f4794424adfc51e8b3c36a282f0936	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:31.609573-06	\N	0.95	f
848	2	6	2025-01-22	ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190	-142.67	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250122120000.000[-8:PST]</DTPOSTED> <TRNAMT>-142.67</TRNAMT> <FITID>MFB2025012200354294</FITID> <NAME>ACH DEBIT VELOCITY WIRELESS AUTO</NAME> <MEMO>ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190</MEMO>	2025-01	23	ai	35e96143318b3e5f4879869b7b935b446ce4268fb18f97988baef5f67d64542a	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:34.183267-06	\N	0.85	f
874	4	2	2025-01-10	SQ *BLUE BOTTLE COFFEE OAKLAND CA	-10.75	f	01/10 01/10 SQ *BLUE BOTTLE COFFEE OAKLAND CA 10.75	2025-01	26	ai	49188d73e3ca55dd2f9ec91d8fa7b677c07b5b1869e702f4a3f09992c0c1da8c	2026-10-16 14:45:50.686309-06	2026-10-16 14:46:40.567729-06	\N	0.62	t
875	4	8	2025-01-10	AMZN Mktp US*B1QJ5Z Amzn.com/bill WA	-77.48	f	01/10 01/11 AMZN Mktp US*B1QJ5Z Amzn.com/bill WA 77.48	2025-01	26	rule	2dc22d419049f9d3448f9492aa00a68eba8920ff8c2c880044712c55bb637929	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.702764-06	\N	\N	f
876	4	8	2025-01-12	AMZN Mktp US*8AHXD6 Amzn.com/bill WA	-99.50	f	01/12 01/12 AMZN Mktp US*8AHXD6 Amzn.com/bill WA 99.50	2025-01	26	rule	2f807e8f20b4636fbbbc3b805ea841e58486ebd055996f86b1b2b7f46a7c1bf4	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.703084-06	\N	\N	f
878	4	2	2025-01-13	COSTCO WHSE #0681 WOOD VILLAGE OR	-67.08	f	01/13 01/14 COSTCO WHSE #0681 WOOD VILLAGE OR 67.08	2025-01	26	rule	15f85c7919013efe1e6d94ed797008c74819984db309d6a427be0fac4f0f7c70	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.703444-06	\N	\N	f
882	4	2	2025-01-14	COSTCO WHSE #0681 WOOD VILLAGE OR	-91.96	f	01/14 01/16 COSTCO WHSE #0681 WOOD VILLAGE OR 91.96	2025-01	26	rule	b0751f0dd24bd6f8274ebfea59876d701ce035320771053fc3c2a2a1436fbcda	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.703883-06	\N	\N	f
881	4	5	2025-01-15	NETFLIX.COM 866-579-7172 CA	-22.99	f	01/15 01/15 NETFLIX.COM 866-579-7172 CA 22.99	2025-01	26	rule	0286ea7429eb3af974e493bd67bb2e30edff318a7965c5b2b2f2baa1cfea55eb	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.704561-06	\N	\N	f
883	4	8	2025-01-15	AMZN Mktp US*K94JKJ Amzn.com/bill WA	-124.87	f	01/15 01/17 AMZN Mktp US*K94JKJ Amzn.com/bill WA 124.87	2025-01	26	rule	9d731e5b0c0bc4bfc10a904d52b3f2a4d5aaceeef53fa05e10408064ac377b27	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.704848-06	\N	\N	f
888	4	8	2025-01-18	AMZN Mktp US*QYCC7N Amzn.com/bill WA	-109.88	f	01/18 01/19 AMZN Mktp US*QYCC7N Amzn.com/bill WA 109.88	2025-01	26	rule	c401f0d35161c8c13fb3992cfcb2f084c2a89f4f2347e95b09e697e5d850326c	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.70523-06	\N	\N	f
890	4	8	2025-01-19	AMZN Mktp US*PPF4LE Amzn.com/bill WA	-121.44	f	01/19 01/19 AMZN Mktp US*PPF4LE Amzn.com/bill WA 121.44	2025-01	26	rule	44c8b4b8d4bf0642069fbc4eeed1dd16691f6f1bc8e347132669a6d979d86080	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.7058-06	\N	\N	f
864	3	9	2025-01-07	ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290	500.00	f	2025-01-07 ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290 500.00	2025-01	25	transfer	6f16dc97396b5ad506f7115e19a79b0fb2eb7b953f540ae6ca48e5314d27d5bd	2026-10-16 14:45:50.660226-06	2026-10-16 14:45:50.712791-06	819	\N	f
866	4	9	2025-01-22	PAYMENT THANK YOU - WEB	4839.07	f	01/22 01/22 PAYMENT THANK YOU - WEB -4,839.07	2025-01	26	transfer	a3c879e85a85d97b99a37468d3ccc4ac96f98719efd3e1b53974365c13b03427	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.714155-06	846	\N	f
867	4	8	2025-01-04	TARGET 00012345 GRESHAM OR	-142.74	f	01/04 01/06 TARGET 00012345 GRESHAM OR 142.74	2025-01	26	ai	a0a9e78ee03936050d9a4f5d07ccbc27607bdc661218beddfa1fa9ede375079b	2026-10-16 14:45:50.686309-06	2026-10-16 14:46:16.629706-06	\N	0.90	f
868	4	3	2025-01-05	TST* LUIGIS TRATTORIA FAIRVIEW OR	-86.92	f	01/05 01/06 TST* LUIGIS TRATTORIA FAIRVIEW OR 86.92	2025-01	26	ai	6b06789935564e66deaf084f62b76d04a97b1d0a534c000e1420e963bea48d58	2026-10-16 14:45:50.686309-06	2026-10-16 14:46:16.630863-06	\N	0.95	f
869	4	3	2025-01-06	TST* LUIGIS TRATTORIA FAIRVIEW OR	-80.52	f	01/06 01/07 TST* LUIGIS TRATTORIA FAIRVIEW OR 80.52	2025-01	26	ai	66d4af2ad265459c2ac99bb887cc69354f269715d1b29871d47168fec3988d7f	2026-10-16 14:45:50.686309-06	2026-10-16 14:46:40.557265-06	\N	0.95	f
870	4	8	2025-01-07	REI #57 PORTLAND OR	-134.30	f	01/07 01/08 REI #57 PORTLAND OR 134.30	2025-01	26	ai	646d0a783a7a2ddf0250d1ec2e8d036a3dac06a709f690bf62a1920562c80eab	2026-10-16 14:45:50.686309-06	2026-10-16 14:46:40.559747-06	\N	0.90	f
872	4	2	2025-01-07	SAFEWAY #1544 FAIRVIEW OR	-52.55	f	01/07 01/09 SAFEWAY #1544 FAIRVIEW OR 52.55	2025-01	26	ai	d1b44fd94b7a0c10b49a0c1823ffbb1c8479bea74a44a81382596ad1c7d24746	2026-10-16 14:45:50.686309-06	2026-10-16 14:46:40.560144-06	\N	0.90	f
873	4	5	2025-01-09	SPOTIFY USA 877-778-1161 NY	-16.99	f	01/09 01/09 SPOTIFY USA 877-778-1161 NY 16.99	2025-01	26	ai	051497df943e764454c595887f9d5051efc7b4624d44a7839a6363ee6aa83e6b	2026-10-16 14:45:50.686309-06	2026-10-16 14:46:40.56567-06	\N	0.95	f
877	4	5	2025-01-11	YMCA OF COLUMBIA-WILLAMETTE 503-555-0177 OR	-68.00	f	01/11 01/13 YMCA OF COLUMBIA-WILLAMETTE 503-555-0177 OR 68.00	2025-01	26	ai	77f8f5639b263338e727a4b1b616db57f2fde6f2ceaa18e8a474363afe706ddc	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:08.12812-06	\N	0.85	f
880	4	3	2025-01-14	PIZZICATO #14 PORTLAND OR	-38.47	f	01/14 01/15 PIZZICATO #14 PORTLAND OR 38.47	2025-01	26	ai	bc5708f115c11ed2e38b370366194fe25b6a67548234c85819f49431e4e7df74	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:08.134023-06	\N	0.95	f
884	4	3	2025-01-16	TST* LUIGIS TRATTORIA FAIRVIEW OR	-73.67	f	01/16 01/17 TST* LUIGIS TRATTORIA FAIRVIEW OR 73.67	2025-01	26	ai	386f5ef93e9bc16709b48b937097798d7ad15e5e63ac8b75370262605cd31b92	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:33.05463-06	\N	0.95	f
885	4	2	2025-01-17	NEW SEASONS MARKET FAIRVIEW OR	-189.76	f	01/17 01/17 NEW SEASONS MARKET FAIRVIEW OR 189.76	2025-01	26	ai	31cd02e215509cc1595b80c00e52489f833d43120d1636de54b75ee922b4d7ff	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:33.055624-06	\N	0.95	f
886	4	8	2025-01-17	POWELL'S BOOKS PORTLAND OR	-41.06	f	01/17 01/18 POWELL'S BOOKS PORTLAND OR 41.06	2025-01	26	ai	452a9b57f5752dc1d37548997761c146f0b3726c310148c2cb1af9175a2b3c7a	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:33.056037-06	\N	0.90	f
887	4	8	2025-01-18	KOHL'S #1129 GRESHAM OR	-107.87	f	01/18 01/19 KOHL'S #1129 GRESHAM OR 107.87	2025-01	26	ai	fbb11b0eaaf2e5f342a7ff71262b0ae6bf6d181ce12ab4919b8a6d173e66f4bb	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:33.057278-06	\N	0.95	f
863	2	2	2025-01-31	DEBIT CARD PURCHASE 01/31 WINCO FOODS #112 GRESHAM OR	-162.67	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250131120000.000[-8:PST]</DTPOSTED> <TRNAMT>-162.67</TRNAMT> <FITID>MFB2025013100506294</FITID> <NAME>DEBIT CARD PURCHASE 01/31 WINCO</NAME> <MEMO>DEBIT CARD PURCHASE 01/31 WINCO FOODS #112 GRESHAM OR</MEMO>	2025-01	23	ai	f02e051c72ff6bd688f16c552090807692b0c4d28264b8ccaeeb2a380042094a	2026-10-16 14:45:50.646579-06	2026-10-16 14:48:26.95735-06	\N	0.95	f
879	4	3	2025-01-14	STARBUCKS STORE 05521 GRESHAM OR	-12.56	f	01/14 01/15 STARBUCKS STORE 05521 GRESHAM OR 12.56	2025-01	26	ai	704b1ce9c6f4a55c9960511dc4e6a80e91a8bdddaabe81f0972792bda92ad882	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
889	4	3	2025-01-19	SQ *CASCADE ROASTERS FAIRVIEW OR	-8.95	f	01/19 01/19 SQ *CASCADE ROASTERS FAIRVIEW OR 8.95	2025-01	26	ai	068016c76b17afdb8e8fcfc5b4a2d7c983b710b8e78075f630c5e2774c96bac1	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:31.054101-06	\N	0.95	f
862	2	7	2025-01-31	INTEREST PAYMENT	0.52	f	<TRNTYPE>INT</TRNTYPE> <DTPOSTED>20250131120000.000[-8:PST]</DTPOSTED> <TRNAMT>0.52</TRNAMT> <FITID>MFB2025013100490052</FITID> <NAME>INTEREST PAYMENT</NAME>	2025-01	23	ai	2606c2364b0edc4f306d420ce341fee8d0925edf4b238cfe7243d9c781e27627	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:36.015295-06	\N	0.85	f
865	3	7	2025-01-31	INTEREST PAYMENT	6.35	f	2025-01-31 INTEREST PAYMENT 6.35	2025-01	25	ai	9a3402fc91ec24b6e259576495709d96cf30c84ea78a48b701caf74d4ef83298	2026-10-16 14:45:50.660226-06	2026-10-16 14:49:36.015295-06	\N	0.85	f
908	4	2	2025-01-27	COSTCO WHSE #0681 WOOD VILLAGE OR	-211.12	t	01/27 01/28 COSTCO WHSE #0681 WOOD VILLAGE OR 211.12	2025-01	26	manual	89e649e4cd3b8d815b5e6f70908f7d61dc21f74cfcc61eee1149349d84c91187	2026-10-16 14:45:50.686309-06	2026-10-16 14:50:01.278676-06	\N	\N	f
814	2	1	2025-01-02	ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 4417730021	-2385.00	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250102120000.000[-8:PST]</DTPOSTED> <TRNAMT>-2385.00</TRNAMT> <FITID>MFB2025010200019121</FITID> <NAME>ACH DEBIT PINECREST HOME LOANS M</NAME> <MEMO>ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 4417730021</MEMO>	2025-01	23	rule	653f96ffb5e06cfe983ee8e1d0f19002a07b3f7235525e23258f81b6229c639f	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.699552-06	\N	\N	f
871	4	8	2025-01-08	AMZN Mktp US*JZUCK9 Amzn.com/bill WA	-91.40	f	01/08 01/08 AMZN Mktp US*JZUCK9 Amzn.com/bill WA 91.40	2025-01	26	rule	0c0d37f74b3f6787a54f5e3db0df10dcc3bb936278c412b3c3a319845a5d6ade	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.702066-06	\N	\N	f
830	2	7	2025-01-10	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	<TRNTYPE>CREDIT</TRNTYPE> <DTPOSTED>20250110120000.000[-8:PST]</DTPOSTED> <TRNAMT>2846.15</TRNAMT> <FITID>MFB2025011000175371</FITID> <NAME>ACH DEPOSIT BRIGHTLINE LOGISTICS</NAME> <MEMO>ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517</MEMO>	2025-01	23	rule	5781a283ed84ecf6129eb5ea6dfc3482fa397b80bef936254daff51a799919cc	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.702453-06	\N	\N	f
897	4	8	2025-01-22	AMZN Mktp US*YBJ162 Amzn.com/bill WA	-33.66	f	01/22 01/23 AMZN Mktp US*YBJ162 Amzn.com/bill WA 33.66	2025-01	26	rule	66b487717d9feafcdf0b211dd4669e4d06958ce3eb3410049e80bc00dad3cfb5	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.706782-06	\N	\N	f
904	4	8	2025-01-25	AMZN Mktp US*5QPTL4 Amzn.com/bill WA	-51.36	f	01/25 01/27 AMZN Mktp US*5QPTL4 Amzn.com/bill WA 51.36	2025-01	26	rule	38528fb87c03aec61ac1fd70d5cc80d9ff82e3b3bb77ff99bf2b947856c1e103	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.707504-06	\N	\N	f
905	4	2	2025-01-25	COSTCO WHSE #0681 WOOD VILLAGE OR	-178.99	f	01/25 01/27 COSTCO WHSE #0681 WOOD VILLAGE OR 178.99	2025-01	26	rule	848c3d8911e80fc60a80d067646b2c7625b4658862f30ed84385e0c9dc140c70	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.707794-06	\N	\N	f
903	4	8	2025-01-26	AMZN Mktp US*PHJ0QH Amzn.com/bill WA	-107.14	f	01/26 01/26 AMZN Mktp US*PHJ0QH Amzn.com/bill WA 107.14	2025-01	26	rule	521cdb00e9038b3c0b428432e13b579b3f0b61c66557a66f6cbc22a73d03fb84	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.708093-06	\N	\N	f
916	4	8	2025-02-02	AMZN Mktp US*US74LQ Amzn.com/bill WA	-108.01	f	02/02 02/03 AMZN Mktp US*US74LQ Amzn.com/bill WA 108.01	2025-01	26	rule	56c252ba2a2e05ce9270ba6b556d3011cd355cf2c6fe5294ac7023d818090e1f	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.709361-06	\N	\N	f
892	4	2	2025-01-20	NEW SEASONS MARKET FAIRVIEW OR	-62.56	f	01/20 01/20 NEW SEASONS MARKET FAIRVIEW OR 62.56	2025-01	26	ai	d719c3393abc44fc1ea65c43d75f2db4208058659172d963d5cc73bbd8168e79	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:33.060142-06	\N	0.95	f
893	4	2	2025-01-20	NEW SEASONS MARKET FAIRVIEW OR	-192.03	f	01/20 01/20 NEW SEASONS MARKET FAIRVIEW OR 192.03	2025-01	26	ai	05a9997a7eb5b9a8b18bf28458ef6bfacd2825b14ce2c1e9c5a5943fac9d71e3	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:33.060888-06	\N	0.95	f
894	4	4	2025-01-20	COSTCO GAS #0681 WOOD VILLAGE OR	-58.15	f	01/20 01/21 COSTCO GAS #0681 WOOD VILLAGE OR 58.15	2025-01	26	ai	76352104e0721b0345b1c840db7a2fb17f14dc2d7ddc1565a99d1524b8e28249	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:33.061371-06	\N	0.90	f
895	4	5	2025-01-21	DISNEY PLUS 888-905-7888 CA	-13.99	f	01/21 01/22 DISNEY PLUS 888-905-7888 CA 13.99	2025-01	26	ai	c2f97ef9c9f56b89c73db6f8db413c3b0f7023f18a76b4e844f369737b4ff132	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:59.955034-06	\N	0.95	f
900	4	4	2025-01-23	COSTCO GAS #0681 WOOD VILLAGE OR	-39.74	f	01/23 01/25 COSTCO GAS #0681 WOOD VILLAGE OR 39.74	2025-01	26	ai	a0c0a3a09b79e0323933da09225856270b3a8d9eaa6beb6b8276c76172931cbe	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:59.959539-06	\N	0.90	f
901	4	3	2025-01-24	SQ *TACO PEDRO GRESHAM OR	-33.67	f	01/24 01/26 SQ *TACO PEDRO GRESHAM OR 33.67	2025-01	26	ai	40855aac702a8abfd3a72b8746ba9b9266fa3ec621a95a53c6d2ecf1018a9b2e	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:59.960525-06	\N	0.95	f
902	4	2	2025-01-25	SAFEWAY #1544 FAIRVIEW OR	-233.21	f	01/25 01/26 SAFEWAY #1544 FAIRVIEW OR 233.21	2025-01	26	ai	415652943efc5c59e0dd7168cb26312db480cf79a7c7a60d8efa36ca9b13f9e8	2026-10-16 14:45:50.686309-06	2026-10-16 14:47:59.9615-06	\N	0.90	f
909	4	3	2025-01-28	PIZZICATO #14 PORTLAND OR	-93.76	f	01/28 01/28 PIZZICATO #14 PORTLAND OR 93.76	2025-01	26	ai	d5db7b0fe885984a70f89f87e5758a8ef4c63c75f6772795ba30c17e5437e39b	2026-10-16 14:45:50.686309-06	2026-10-16 14:48:26.95183-06	\N	0.95	f
911	4	2	2025-01-30	SAFEWAY #1544 FAIRVIEW OR	-66.80	f	01/30 01/31 SAFEWAY #1544 FAIRVIEW OR 66.80	2025-01	26	ai	5797bd59ee2745b01744bedb6f414e421ebd1cadbac55b13b6b5bce34621ebc4	2026-10-16 14:45:50.686309-06	2026-10-16 14:48:26.956217-06	\N	0.90	f
912	4	8	2025-01-31	KOHL'S #1129 GRESHAM OR	-90.67	f	01/31 01/31 KOHL'S #1129 GRESHAM OR 90.67	2025-01	26	ai	034bfc77603fdd1bcfddb5feae7db80b2fd7c40d4132d023e96fc8c546c51f8e	2026-10-16 14:45:50.686309-06	2026-10-16 14:48:26.958748-06	\N	0.90	f
914	4	8	2025-02-01	KOHL'S #1129 GRESHAM OR	-134.97	f	02/01 02/02 KOHL'S #1129 GRESHAM OR 134.97	2025-01	26	ai	c91eeaf028948dcacaf45272a98bd1a142a18197681f72c4d2b5f329b913c3de	2026-10-16 14:45:50.686309-06	2026-10-16 14:48:26.959289-06	\N	0.90	f
918	4	2	2025-02-03	NEW SEASONS MARKET FAIRVIEW OR	-92.19	f	02/03 02/04 NEW SEASONS MARKET FAIRVIEW OR 92.19	2025-01	26	ai	7378514b0396023dd002a5358bb27d41af447e897579bf24b38bf4903f1b916f	2026-10-16 14:45:50.686309-06	2026-10-16 14:48:32.571834-06	\N	0.95	f
907	4	3	2025-01-27	STARBUCKS STORE 05521 GRESHAM OR	-5.13	f	01/27 01/27 STARBUCKS STORE 05521 GRESHAM OR 5.13	2025-01	26	ai	d2bc5b455a5de3a1d57b5d8fb10357a8e5b18e911f986f1af927f1a1ffe4b973	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
906	4	3	2025-01-27	SQ *CASCADE ROASTERS FAIRVIEW OR	-5.38	f	01/27 01/27 SQ *CASCADE ROASTERS FAIRVIEW OR 5.38	2025-01	26	ai	ee9354f671378ceecc260e046ed0206b6bf6a83150117e3de7d28bf17fcee39e	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:31.054101-06	\N	0.95	f
899	4	3	2025-01-23	TST* PINE STATE BISCUITS PORTLAND OR	-82.85	f	01/23 01/23 TST* PINE STATE BISCUITS PORTLAND OR 82.85	2025-01	26	ai	56ecb16c7a5299105f9a7ab8ce8fc576bcb846735bd424c5bc7963b73552a2ef	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:31.123945-06	\N	0.90	f
919	4	3	2025-02-04	TST* PINE STATE BISCUITS PORTLAND OR	-70.48	f	02/04 02/04 TST* PINE STATE BISCUITS PORTLAND OR 70.48	2025-01	26	ai	db7bef5fc395bed7e9ea230bbb95b8c06c96f11e231ee3b2be719525a77a9c72	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:31.123945-06	\N	0.90	f
913	4	3	2025-01-30	SQ *TACO PEDRO GRESHAM OR	-53.41	f	01/30 02/01 SQ *TACO PEDRO GRESHAM OR 53.41	2025-01	26	ai	4de38fa1cf9d8662a89431f96ef46cf9a5664fad60cd286eb4304568b3095b33	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:31.186084-06	\N	0.95	f
917	4	4	2025-02-03	COSTCO GAS #0681 WOOD VILLAGE OR	-57.77	f	02/03 02/03 COSTCO GAS #0681 WOOD VILLAGE OR 57.77	2025-01	26	ai	ade6e8d1f9af9b6648fc492245d21058264a7f4df4c42e13b45c0cc6cfa97ea0	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:32.941782-06	\N	0.85	f
838	2	7	2025-01-15	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	<TRNTYPE>CREDIT</TRNTYPE> <DTPOSTED>20250115120000.000[-8:PST]</DTPOSTED> <TRNAMT>1912.40</TRNAMT> <FITID>MFB2025011500251753</FITID> <NAME>ACH DEPOSIT CEDARVALE SCHOOL DIS</NAME> <MEMO>ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784</MEMO>	2025-01	23	rule	ee05e38493cf4ce638e8e458190334b5dc2cc4306ed43d01e82c9d9e17a591d0	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.7042-06	\N	\N	f
896	4	8	2025-01-22	AMZN Mktp US*9ANTLE Amzn.com/bill WA	-13.90	f	01/22 01/22 AMZN Mktp US*9ANTLE Amzn.com/bill WA 13.90	2025-01	26	rule	05f4cda77d6070fa45991ee659e09200ba66a66b2ecc126dae15625b04eaed4c	2026-10-16 14:45:50.686309-06	2026-10-16 14:45:50.706161-06	\N	\N	f
851	2	7	2025-01-24	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	<TRNTYPE>CREDIT</TRNTYPE> <DTPOSTED>20250124120000.000[-8:PST]</DTPOSTED> <TRNAMT>2846.15</TRNAMT> <FITID>MFB2025012400385371</FITID> <NAME>ACH DEPOSIT BRIGHTLINE LOGISTICS</NAME> <MEMO>ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517</MEMO>	2025-01	23	rule	df86e1bd433874003db6526133121019a12454c6d8145941251bbf342a803706	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.707121-06	\N	\N	f
861	2	7	2025-01-31	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	<TRNTYPE>CREDIT</TRNTYPE> <DTPOSTED>20250131120000.000[-8:PST]</DTPOSTED> <TRNAMT>1912.40</TRNAMT> <FITID>MFB2025013100481753</FITID> <NAME>ACH DEPOSIT CEDARVALE SCHOOL DIS</NAME> <MEMO>ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784</MEMO>	2025-01	23	rule	da33f46ce0eb230b5be4c74c31dcc73a12787302594e0f5dde88cb717af28388	2026-10-16 14:45:50.646579-06	2026-10-16 14:45:50.709037-06	\N	\N	f
775	1	9	2025-01-23	AUTOMATIC PAYMENT - THANK YOU	2934.15	f	01/23/2025,01/23/2025,AUTOMATIC PAYMENT - THANK YOU,,Payment,2934.15	2025-01	21	transfer	c3341e487c71f8008dda0b76b1b035e798709f08398cebd99eb35314d2a5d810	2026-10-16 14:45:50.631631-06	2026-10-16 14:45:50.715142-06	852	\N	f
845	2	8	2025-01-20	DEBIT CARD PURCHASE 01/20 GOODWILL #22 GRESHAM OR	-64.21	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250120120000.000[-8:PST]</DTPOSTED> <TRNAMT>-64.21</TRNAMT> <FITID>MFB2025012000326421</FITID> <NAME>DEBIT CARD PURCHASE 01/20 GOODWI</NAME> <MEMO>DEBIT CARD PURCHASE 01/20 GOODWILL #22 GRESHAM OR</MEMO>	2025-01	23	ai	3d17cef2938c0cf75528d9aa1dccd099d7c6530a7b3bc077d3897119dfad0399	2026-10-16 14:45:50.646579-06	2026-10-16 14:47:33.059777-06	\N	0.95	f
774	1	8	2025-01-25	CHEWY.COM 800-672-4399 FL	-44.34	f	01/25/2025,01/27/2025,CHEWY.COM 800-672-4399 FL,Shopping,Sale,-44.34	2025-01	21	ai	875b639155da3dbfe402bb50b0972dc256610b1d3d2d6055efd485b3d2ac446b	2026-10-16 14:45:50.631631-06	2026-10-16 14:47:59.961004-06	\N	0.85	f
768	1	4	2025-01-28	ARCO #82211 AMPM GRESHAM OR	-37.83	f	01/28/2025,01/29/2025,ARCO #82211 AMPM GRESHAM OR,Gas,Sale,-37.83	2025-01	21	ai	023cdf032ec9db20aaf43728ba32596538a6c92b8537b2a5471307ee4800e666	2026-10-16 14:45:50.631631-06	2026-10-16 14:48:26.950958-06	\N	0.90	f
765	1	8	2025-01-30	SQ *SMITH & SONS, LLC PORTLAND OR	-103.38	f	01/30/2025,01/30/2025,SQ *SMITH & SONS, LLC PORTLAND OR,Shopping,Sale,-103.38	2025-01	21	ai	03c796b8a32362d9992f81854377138388e9fb597bdb54aeb41896fd1bb1b7b9	2026-10-16 14:45:50.631631-06	2026-10-16 14:48:26.955832-06	\N	0.90	f
929	2	7	2025-02-07	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	02/07 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 5,638.14\n9100234517	2025-02	27	rule	25ff87ba565adec345ccf6c2510ad41652572929aae5326ee18489b13deb8ebe	2026-10-16 14:48:33.017818-06	2026-10-16 14:48:33.032253-06	\N	\N	f
930	2	6	2025-02-10	ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 9300012231	-187.99	f	02/10 ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 187.99 5,450.15\n9300012231	2025-02	27	rule	2c62398521e08f6a2be09793cbc1c66efae955faa3973f73fd36f36a05437308	2026-10-16 14:48:33.017818-06	2026-10-16 14:48:33.032573-06	\N	\N	f
920	2	4	2025-02-01	POS DEBIT 02/01 CHEVRON 0098812 FAIRVIEW OR	-61.04	f	02/01 POS DEBIT 02/01 CHEVRON 0098812 FAIRVIEW OR 61.04 6,142.35	2025-02	27	ai	05412cb4f815326f1b30d6881d98f7cdf07a26fa1cbb2b6b8f71f940f808c27d	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.628069-06	\N	0.90	f
923	2	10	2025-02-03	ATM WITHDRAWAL 02/02 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-100.00	f	02/03 ATM WITHDRAWAL 02/02 MAPLE FEDERAL ATM #2210 2210 100.00 3,468.93\nMAIN ST FAIRVIEW OR	2025-02	27	ai	4041c239048b5fa5012a90afe1fb59b16255dbde64d5bacba5ac03d04ab643e2	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.640943-06	\N	0.70	f
925	2	3	2025-02-03	DEBIT CARD PURCHASE 02/03 TST* LUIGIS TRATTORIA FAIRVIEW OR	-43.07	f	02/03 DEBIT CARD PURCHASE 02/03 TST* LUIGIS TRATTORIA 43.07 3,380.27\nFAIRVIEW OR	2025-02	27	ai	0f256648801e3370fbdf43668350ec29a61107a489e48b7989010a4c4ce506fd	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.642649-06	\N	0.95	f
928	2	2	2025-02-05	DEBIT CARD PURCHASE 02/04 GROCERY OUTLET #388 GRESHAM OR	-80.12	f	02/05 DEBIT CARD PURCHASE 02/04 GROCERY OUTLET #388 80.12 2,791.99\nGRESHAM OR	2025-02	27	ai	d18b24a42ecf65e2aeda167d9f554889cc62b7ccac1e20d00d9bdb930ae2328b	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.644466-06	\N	0.95	f
898	4	3	2025-01-23	STARBUCKS STORE 05521 GRESHAM OR	-14.00	f	01/23 01/23 STARBUCKS STORE 05521 GRESHAM OR 14.00	2025-01	26	ai	3813f68cb38f8b2ba06a648f80137fcc555ce5d259dac5d7b24ffeeddcf93aa3	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
926	2	3	2025-02-04	DEBIT CARD PURCHASE 02/04 DUTCH BROS #OR0212 FAIRVIEW OR	-8.16	f	02/04 DEBIT CARD PURCHASE 02/04 DUTCH BROS #OR0212 8.16 3,372.11\nFAIRVIEW OR	2025-02	27	ai	67c839db96c05c01ddc3abe51744b2937212c9acd643da01ce1dca9a24b0f76b	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
766	1	3	2025-01-29	DOORDASH*THAI BASIL, FAIRVIEW OR	-64.52	f	01/29/2025,01/30/2025,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-64.52	2025-01	21	ai	e3fd06831bb3dfea673a5af7e977b62e48f0194d1fddc4a3ec7dd5a4b10734cf	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
781	1	3	2025-01-19	PANDA EXPRESS #1912 GRESHAM OR	-45.72	f	01/19/2025,01/21/2025,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-45.72	2025-01	21	ai	001ea1b1a7cbec82d658d94d233c11732acfa8228688ff28217538990c2a6b05	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
922	2	1	2025-02-03	ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 6610023385	-188.42	f	02/03 ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 188.42 3,568.93\n6610023385	2025-02	27	ai	fdd67dbb260dbedc2b4b5ecfa7d7a50e09c9778325911a6ad0b119db9ba03cc8	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:34.35337-06	\N	0.80	f
924	2	10	2025-02-03	POS DEBIT 02/02 WALGREENS #06124 FAIRVIEW OR	-45.59	f	02/03 POS DEBIT 02/02 WALGREENS #06124 FAIRVIEW OR 45.59 3,423.34	2025-02	27	ai	bf3cf080eefbb71cd404d0b29058f2b2067bba979b693dc627b692fdf14e6488	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:35.549706-06	\N	0.85	f
927	2	9	2025-02-05	ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS XXXXXX4471 REF #IBM8E0CTR	-500.00	f	02/05 ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS 500.00 2,872.11\nXXXXXX4471 REF #IBM8E0CTR	2025-02	27	ai	9bd7e5e593a7ed5df9dac9bf4909bd1071c877677be232d834df0aa1cc19a57f	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.643951-06	\N	1.00	f
931	2	10	2025-02-10	CHECK #1047	-160.00	f	02/10 CHECK #1047 160.00 5,290.15	2025-02	27	ai	dbceacd6103c35ed1b6a22a96b17d61af664033cbc03d4255f64d83b4fa327e2	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.645267-06	\N	0.60	f
943	2	7	2025-02-18	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	02/18 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 7,899.24\n5520017784	2025-02	27	rule	08b466aa6338560c784bf859c872e839185435c87c999c1c9898e3f6180d2613	2026-10-16 14:48:33.017818-06	2026-10-16 14:48:33.033208-06	\N	\N	f
951	2	7	2025-02-21	ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517	2846.15	f	02/21 ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 2,846.15 6,332.12\n9100234517	2025-02	27	rule	38e74f5c06d5c6027318ca7d92feb55c9cd781dfd6ac497bbd07ca2788440c42	2026-10-16 14:48:33.017818-06	2026-10-16 14:48:33.033759-06	\N	\N	f
957	2	4	2025-02-25	POS DEBIT 02/25 SHELL OIL 57442	-51.59	f	02/25 POS DEBIT 02/25 SHELL OIL 57442 51.59 2,841.99	2025-02	27	rule	7781d4cfb2c889930e0ebcfda011b98f0a25e6396527bbfc9b06bf8cc092cc61	2026-10-16 14:48:33.017818-06	2026-10-16 14:48:33.034072-06	\N	\N	f
959	2	4	2025-02-27	POS DEBIT 02/26 SHELL OIL 57442	-46.83	f	02/27 POS DEBIT 02/26 SHELL OIL 57442 46.83 2,787.30	2025-02	27	rule	14a5df07201e8484007c0b5ed6e64b4321e099a896be44f121ac1582f800a093	2026-10-16 14:48:33.017818-06	2026-10-16 14:48:33.034352-06	\N	\N	f
934	2	2	2025-02-10	DEBIT CARD PURCHASE 02/09 GROCERY OUTLET #388 GRESHAM OR	-169.93	f	02/10 DEBIT CARD PURCHASE 02/09 GROCERY OUTLET #388 169.93 6,414.21\nGRESHAM OR	2025-02	27	ai	1dc3fc8d1618b7c6bb51901e361992cdabdd0ecabef63142d0163e072c101a20	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.654911-06	\N	0.95	f
936	2	6	2025-02-12	ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 3300298811	-83.94	f	02/12 ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 83.94 6,319.43\n3300298811	2025-02	27	ai	cae57ad6c8b97567c1a7db0d3b7d5b415aec60c939013b1fca0481aa0e4478bb	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.656039-06	\N	1.00	f
937	2	4	2025-02-12	POS DEBIT 02/11 ARCO #82211 AMPM	-67.71	f	02/12 POS DEBIT 02/11 ARCO #82211 AMPM 67.71 6,251.72	2025-02	27	ai	1ebe74387957dcb8b319a579cf8a6d98e5e9a3974aa602c2962689eed642915d	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.656612-06	\N	0.90	f
938	2	2	2025-02-13	DEBIT CARD PURCHASE 02/13 GROCERY OUTLET #388 GRESHAM OR	-55.21	f	02/13 DEBIT CARD PURCHASE 02/13 GROCERY OUTLET #388 55.21 6,196.51\nGRESHAM OR	2025-02	27	ai	452c06de80e876d09eb91faf3c269fc067940b1d87c52f0f702de99cda223872	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.657157-06	\N	0.95	f
942	2	2	2025-02-17	POS DEBIT 02/17 GROCERY OUTLET #388 GRESHAM OR	-161.57	f	02/17 POS DEBIT 02/17 GROCERY OUTLET #388 GRESHAM OR 161.57 5,986.84	2025-02	27	ai	f16fc2393aeef9ed4b609069735b512aa8a09e00152f9c103244b656c3a41bf9	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.659004-06	\N	0.95	f
944	2	6	2025-02-18	RIVERNET BROADBAND AUTOPAY 800-555-0142	-79.99	f	02/18 RIVERNET BROADBAND AUTOPAY 800-555-0142 79.99 7,819.25	2025-02	27	ai	51cdf8e7b6100881e1d1f24686bea7aff1e433c94f5097656302afb5d09d5e12	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.659424-06	\N	1.00	f
945	2	4	2025-02-18	POS DEBIT 02/14 CHEVRON 0098812 FAIRVIEW OR	-34.96	f	02/18 POS DEBIT 02/14 CHEVRON 0098812 FAIRVIEW OR 34.96 7,784.29	2025-02	27	ai	4a2094522c4a28a24f4888f9249ac371aa5d40585df9d0496c6dac00c88bad62	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.235963-06	\N	0.85	f
946	2	10	2025-02-18	ATM WITHDRAWAL 02/16 MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR	-100.00	f	02/18 ATM WITHDRAWAL 02/16 MAPLE FEDERAL ATM #2210 2210 100.00 7,684.29\nMAIN ST FAIRVIEW OR	2025-02	27	ai	4630dc9afeda5f2737a279da757e7188d2b1f7c607683be5feb034cd38ffafb5	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.244127-06	\N	0.70	f
947	2	2	2025-02-18	DEBIT CARD PURCHASE 02/18 GROCERY OUTLET #388 GRESHAM OR	-100.49	f	02/18 DEBIT CARD PURCHASE 02/18 GROCERY OUTLET #388 100.49 7,583.80\nGRESHAM OR	2025-02	27	ai	17a05b5eeed7aaa61103c6f107824259869e83ed48e91177e9a73bc8f723be0f	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.244978-06	\N	0.95	f
948	2	3	2025-02-19	POS DEBIT 02/18 DUTCH BROS #OR0212 FAIRVIEW OR	-11.00	f	02/19 POS DEBIT 02/18 DUTCH BROS #OR0212 FAIRVIEW OR 11.00 7,572.80	2025-02	27	ai	67c9850cb99f2f562e033c833c76e3102163bd2baf3203bba86a2105f07f024d	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.245538-06	\N	0.90	f
950	2	8	2025-02-20	POS DEBIT 02/19 GOODWILL #22 GRESHAM OR	-42.11	f	02/20 POS DEBIT 02/19 GOODWILL #22 GRESHAM OR 42.11 3,485.97	2025-02	27	ai	9f713d0851930bf82222fd95360b4b41e088d3a7f1c670d63a0b50549f87d8a9	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.246548-06	\N	0.90	f
952	2	3	2025-02-21	DEBIT CARD PURCHASE 02/20 SUBWAY 00412290 GRESHAM OR	-25.20	f	02/21 DEBIT CARD PURCHASE 02/20 SUBWAY 00412290 GRESHAM 25.20 6,306.92\nOR	2025-02	27	ai	e3d9001f75eb1f840caa237bc6088b1532f9994b940e18d5b96271a79ea53d13	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.246989-06	\N	0.95	f
954	2	6	2025-02-24	ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190	-142.67	f	02/24 ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190 142.67 6,159.63	2025-02	27	ai	f38c57e506e0ebcd7ab0d61f760593f46285ca7261fb1fc83c85eedb3680d0b1	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.247876-06	\N	0.90	f
955	2	2	2025-02-24	DEBIT CARD PURCHASE 02/21 WINCO FOODS #112 GRESHAM OR	-118.56	f	02/24 DEBIT CARD PURCHASE 02/21 WINCO FOODS #112 GRESHAM 118.56 6,041.07\nOR	2025-02	27	ai	17f51df910d7cae3735b3b5d56cb29103400008faaee7e22a556185d055a522a	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.248263-06	\N	0.95	f
935	2	3	2025-02-10	DEBIT CARD PURCHASE 02/09 DUTCH BROS #OR0212 FAIRVIEW OR	-10.84	f	02/10 DEBIT CARD PURCHASE 02/09 DUTCH BROS #OR0212 10.84 6,403.37\nFAIRVIEW OR	2025-02	27	ai	bef644430a7a4f6c118b08a01c5f243abf7f7751c870c713781fb3a97f590d3f	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
939	2	3	2025-02-13	DEBIT CARD PURCHASE 02/13 SQ *CASCADE ROASTERS FAIRVIEW OR	-9.14	f	02/13 DEBIT CARD PURCHASE 02/13 SQ *CASCADE ROASTERS 9.14 6,187.37\nFAIRVIEW OR	2025-02	27	ai	c6da92f1ddefd3cd8db3cd756ad9d5c7fcc8580b7c8f7c45e5bbc437102eda39	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
953	2	3	2025-02-22	POS DEBIT 02/22 SQ *CASCADE ROASTERS FAIRVIEW OR	-4.62	f	02/22 POS DEBIT 02/22 SQ *CASCADE ROASTERS FAIRVIEW OR 4.62 6,302.30	2025-02	27	ai	2bc5d659764074e02a38ce640131741eedc58adc0f1c998a52c1d57ae20b8de3	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
940	2	10	2025-02-14	DEBIT CARD PURCHASE 02/14 RITE AID STORE 5411 GRESHAM OR	-31.59	f	02/14 DEBIT CARD PURCHASE 02/14 RITE AID STORE 5411 31.59 6,155.78\nGRESHAM OR	2025-02	27	ai	150edd2b627777a6027a57fab1d24614315971f6b7d39a1e45e90702ce00ef46	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:35.775673-06	\N	0.85	f
949	2	9	2025-02-20	ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# E0SK04FJ	-4044.72	f	02/20 ONLINE PMT SUMMIT VISA ACCT ENDING 4417 CONF# 4,044.72 3,528.08\nE0SK04FJ	2025-02	27	ai	aab63cb96b28b5533b3fc546ca834e13feca172537fa6ebcfd1f2a22ed502624	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.246021-06	\N	0.98	f
956	2	9	2025-02-25	HARBOR CARD AUTOPAY PPD ID: 7781000231	-3147.49	f	02/25 HARBOR CARD AUTOPAY PPD ID: 7781000231 3,147.49 2,893.58	2025-02	27	ai	6b5fd6ded1024ca4df3512e8b82b75c9b2af189b4caf27129936a73e38a4d5cc	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.248643-06	\N	0.98	f
921	2	1	2025-02-03	ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 4417730021	-2385.00	f	02/03 ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 2,385.00 3,757.35\n4417730021	2025-02	27	rule	b63e392751b27d4324305802fd3af4ed684fb4b14d3a568526f849f0444bcb25	2026-10-16 14:48:33.017818-06	2026-10-16 14:48:33.031872-06	\N	\N	f
933	2	4	2025-02-10	POS DEBIT 02/08 SHELL OIL 57442	-56.01	f	02/10 POS DEBIT 02/08 SHELL OIL 57442 56.01 6,584.14	2025-02	27	rule	9fa776307b454f26ac6e7260731fa7f90daf9ddda128cf7dff8b1d4079553ea8	2026-10-16 14:48:33.017818-06	2026-10-16 14:48:33.032864-06	\N	\N	f
960	2	7	2025-02-28	ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784	1912.40	f	02/28 ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 1,912.40 4,699.70\n5520017784	2025-02	27	rule	e1b5ea64e16ed1aa1a80378455832d21e349a74cd8817b57b49efeb16a40023f	2026-10-16 14:48:33.017818-06	2026-10-16 14:48:33.034623-06	\N	\N	f
932	2	7	2025-02-10	ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 8830021147	1350.00	f	02/10 ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 1,350.00 6,640.15\n8830021147	2025-02	27	ai	753f0e579e6dc8ebf12e203969b4f3c15635a8928633b8d3f77def6ead9f0ec5	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:05.645708-06	\N	1.00	f
961	2	7	2025-02-28	INTEREST PAYMENT	0.55	f	02/28 INTEREST PAYMENT 0.55 4,700.25	2025-02	27	ai	68599d17668184392718052799eaf9e53d31315616d3f827ceaaafc93cf42f80	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.249413-06	\N	0.80	f
964	2	3	2025-02-28	DEBIT CARD PURCHASE 02/28 DUTCH BROS #OR0212 FAIRVIEW OR	-11.35	f	02/28 DEBIT CARD PURCHASE 02/28 DUTCH BROS #OR0212 11.35 4,672.79\nFAIRVIEW OR	2025-02	27	ai	3cac2ee23c1f60174df9dd4b68a4891569b3d3a2716d2fb456cbade0e707311e	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.250562-06	\N	0.90	f
268	4	3	2024-09-09	STARBUCKS STORE 05521 GRESHAM OR	-8.47	f	09/09 09/09 STARBUCKS STORE 05521 GRESHAM OR 8.47	2024-09	8	ai	75382bd5c395e84e684f52956ade94da5d1d5deb961d4ba870668822f0721adb	2026-10-16 14:34:51.952053-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
116	4	3	2024-08-15	STARBUCKS STORE 05521 GRESHAM OR	-10.47	f	08/15 08/15 STARBUCKS STORE 05521 GRESHAM OR 10.47	2024-08	4	ai	28dc42b04a3356a4f65f1b02aca8af8173b1248c5ed3d2373ee994e243fe7a20	2026-10-16 14:32:16.754628-06	2026-10-16 14:49:30.815292-06	\N	0.90	f
101	4	3	2024-08-07	STARBUCKS STORE 05521 GRESHAM OR	-11.24	f	08/07 08/07 STARBUCKS STORE 05521 GRESHAM OR 11.24	2024-08	4	ai	260e736266da08b8f39fab32edfcca200dd6b8d17d505ac45376e0b4974e62fc	2026-10-16 14:32:16.754628-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
108	4	3	2024-08-08	STARBUCKS STORE 05521 GRESHAM OR	-10.37	f	08/08 08/10 STARBUCKS STORE 05521 GRESHAM OR 10.37	2024-08	4	ai	c27b2e76373d73cc2c381dbbd7153c66e31c3a01d869323a1c20a0e669362070	2026-10-16 14:32:16.754628-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
112	4	3	2024-08-12	STARBUCKS STORE 05521 GRESHAM OR	-8.44	f	08/12 08/12 STARBUCKS STORE 05521 GRESHAM OR 8.44	2024-08	4	ai	40d9c601e685a471e45148bb84939c1b1dc62173d6919c33554fb2dd9f6a548f	2026-10-16 14:32:16.754628-06	2026-10-16 14:49:30.815292-06	\N	0.90	f
273	4	3	2024-09-11	STARBUCKS STORE 05521 GRESHAM OR	-11.66	f	09/11 09/12 STARBUCKS STORE 05521 GRESHAM OR 11.66	2024-09	8	ai	a593a97b8349a23aeed1a0835d4945ab8f4f079b8fdc0dcc6c69b807792fe294	2026-10-16 14:34:51.952053-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
288	4	3	2024-09-24	STARBUCKS STORE 05521 GRESHAM OR	-8.41	f	09/24 09/24 STARBUCKS STORE 05521 GRESHAM OR 8.41	2024-09	8	ai	18f5522730df8066720e756354cd5bf600d73eaa1968b38211b1c79401bd62de	2026-10-16 14:34:51.952053-06	2026-10-16 14:49:30.815292-06	\N	0.98	f
440	4	3	2024-10-28	STARBUCKS STORE 05521 GRESHAM OR	-12.72	f	10/28 10/28 STARBUCKS STORE 05521 GRESHAM OR 12.72	2024-10	12	ai	1688446d3de75952045251cd0e95522783de50ce1c211cf3d719e7ca2ca25d93	2026-10-16 14:37:30.542559-06	2026-10-16 14:49:30.815292-06	\N	0.98	f
442	4	3	2024-10-28	STARBUCKS STORE 05521 GRESHAM OR	-14.00	f	10/28 10/30 STARBUCKS STORE 05521 GRESHAM OR 14.00	2024-10	12	ai	c8de27e7206f09c96bab287914821c9f4393e12f184a64a7975a892139b24cf6	2026-10-16 14:37:30.542559-06	2026-10-16 14:49:30.815292-06	\N	0.98	f
548	4	3	2024-11-05	STARBUCKS STORE 05521 GRESHAM OR	-13.48	f	11/05 11/06 STARBUCKS STORE 05521 GRESHAM OR 13.48	2024-11	16	ai	cfc60d3a9b8948e2d1cdab44ae64bc52a534c43c253f6677140becd37cf84125	2026-10-16 14:40:14.348274-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
738	4	3	2024-12-20	STARBUCKS STORE 05521 GRESHAM OR	-9.16	f	12/20 12/20 STARBUCKS STORE 05521 GRESHAM OR 9.16	2024-12	20	ai	42860145ab577ade2ec1eb3d5406387e3f955b1ed405b41ed7f26369d40adf3c	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:30.815292-06	\N	0.95	f
71	2	3	2024-08-14	DEBIT CARD PURCHASE 08/14 DUTCH BROS #OR0212 FAIRVIEW OR	-9.65	f	08/14 DEBIT CARD PURCHASE 08/14 DUTCH BROS #OR0212 9.65 8,134.95\nFAIRVIEW OR	2024-08	2	ai	507fc16751053df2331eb702e4fcce148b7dcce5274e41d46941a7f5a57f8098	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
80	2	3	2024-08-21	DEBIT CARD PURCHASE 08/20 DUTCH BROS #OR0212 FAIRVIEW OR	-7.05	f	08/21 DEBIT CARD PURCHASE 08/20 DUTCH BROS #OR0212 7.05 6,512.55\nFAIRVIEW OR	2024-08	2	ai	71da359063b50657a82ec809fd38c8e71b4cd67d329bb077f542dc8049c00b1d	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
86	2	3	2024-08-24	DEBIT CARD PURCHASE 08/24 DUTCH BROS #OR0212 FAIRVIEW OR	-12.55	f	08/24 DEBIT CARD PURCHASE 08/24 DUTCH BROS #OR0212 12.55 9,120.66\nFAIRVIEW OR	2024-08	2	ai	a260a57bfc61efcff785d3aa1fbf132400bc0d06501ab08658e8400a403a735f	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
87	2	3	2024-08-25	POS DEBIT 08/25 DUTCH BROS #OR0212 FAIRVIEW OR	-5.75	f	08/25 POS DEBIT 08/25 DUTCH BROS #OR0212 FAIRVIEW OR 5.75 9,114.91	2024-08	2	ai	2f017336e8d3ea646b5728caebac9f0db50d96c020c553e4654c00296da571a2	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
83	2	3	2024-08-22	DEBIT CARD PURCHASE 08/22 DUTCH BROS #OR0212 FAIRVIEW OR	-11.87	f	08/22 DEBIT CARD PURCHASE 08/22 DUTCH BROS #OR0212 11.87 6,321.51\nFAIRVIEW OR	2024-08	2	ai	e1baf71c90a2512c9622a85debf3221f297eac44475376678355aa4f7fe875ff	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
962	2	3	2025-02-28	DEBIT CARD PURCHASE 02/27 SQ *CASCADE ROASTERS FAIRVIEW OR	-10.60	f	02/28 DEBIT CARD PURCHASE 02/27 SQ *CASCADE ROASTERS 10.60 4,689.65\nFAIRVIEW OR	2025-02	27	ai	faa24b699269fd26d82210943d7f9324b64881ae21bd8430370229b49788a4c7	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
963	2	3	2025-02-28	DEBIT CARD PURCHASE 02/27 SQ *CASCADE ROASTERS FAIRVIEW OR	-5.51	f	02/28 DEBIT CARD PURCHASE 02/27 SQ *CASCADE ROASTERS 5.51 4,684.14\nFAIRVIEW OR	2025-02	27	ai	ab75530af3d4624f12aea409b259730fe78b695b90f6d3a2223162e072ed63d0	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
217	2	3	2024-09-09	POS DEBIT 09/09 DUTCH BROS #OR0212 FAIRVIEW OR	-9.98	f	09/09 POS DEBIT 09/09 DUTCH BROS #OR0212 FAIRVIEW OR 9.98 8,129.23	2024-09	6	ai	7a905b813c76969b21cd9101171941417c29e944ce155a95ac3efb650abf148e	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
234	2	3	2024-09-18	DEBIT CARD PURCHASE 09/18 DUTCH BROS #OR0212 FAIRVIEW OR	-7.96	f	09/18 DEBIT CARD PURCHASE 09/18 DUTCH BROS #OR0212 7.96 10,515.55\nFAIRVIEW OR	2024-09	6	ai	0a7e9c38b6758438b766897f1dd0b8e4b481c0d1fe392e7fea39bc7e22757c20	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:30.878729-06	\N	0.95	f
254	2	3	2024-09-30	DEBIT CARD PURCHASE 09/28 DUTCH BROS #OR0212 FAIRVIEW OR	-9.68	f	09/30 DEBIT CARD PURCHASE 09/28 DUTCH BROS #OR0212 9.68 7,928.08\nFAIRVIEW OR	2024-09	6	ai	c2ffa1412c59dfa0f0694a6e70f7f597aea3b34a5967d76c826e6942f7db1ea7	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
369	2	3	2024-10-12	DEBIT CARD PURCHASE 10/12 DUTCH BROS #OR0212 FAIRVIEW OR	-11.39	f	10/12 DEBIT CARD PURCHASE 10/12 DUTCH BROS #OR0212 11.39 8,280.39\nFAIRVIEW OR	2024-10	10	ai	6b19b18ef0a591bb65fa7f91ba533f11bd7844fcb7fb5557632305df17cff0cc	2026-10-16 14:37:30.500003-06	2026-10-16 14:49:30.878729-06	\N	0.95	f
400	2	3	2024-10-30	POS DEBIT 10/29 DUTCH BROS #OR0212 FAIRVIEW OR	-5.63	f	10/30 POS DEBIT 10/29 DUTCH BROS #OR0212 FAIRVIEW OR 5.63 4,587.76	2024-10	10	ai	666ab2a9b6983a1cecc86287a28fd8dea8460d1c0b47d54b2672895da3de0af6	2026-10-16 14:37:30.500003-06	2026-10-16 14:49:30.878729-06	\N	0.95	f
498	2	3	2024-11-04	DEBIT CARD PURCHASE 11/03 DUTCH BROS #OR0212 FAIRVIEW OR	-8.15	f	11/04 DEBIT CARD PURCHASE 11/03 DUTCH BROS #OR0212 8.15 6,432.71\nFAIRVIEW OR	2024-11	14	ai	494b2747c5ad10fea13ce819b8a3c869ad205748a21b1405053962c263965ee0	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
515	2	3	2024-11-14	POS DEBIT 11/13 DUTCH BROS #OR0212 FAIRVIEW OR	-7.98	f	11/14 POS DEBIT 11/13 DUTCH BROS #OR0212 FAIRVIEW OR 7.98 6,233.00	2024-11	14	ai	611c7111bc161aa149ae7f2042ea59a2b8ce26990277d8c0a199ca96f3d741f5	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:30.878729-06	\N	0.95	f
519	2	3	2024-11-15	DEBIT CARD PURCHASE 11/15 DUTCH BROS #OR0212 FAIRVIEW OR	-10.12	f	11/15 DEBIT CARD PURCHASE 11/15 DUTCH BROS #OR0212 10.12 10,976.02\nFAIRVIEW OR	2024-11	14	ai	39f5a40e80d0006a4a0bf7d0bb4c67a0df3fc3637fcb449002ce923b33737529	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:30.878729-06	\N	0.95	f
522	2	3	2024-11-18	DEBIT CARD PURCHASE 11/16 DUTCH BROS #OR0212 FAIRVIEW OR	-7.52	f	11/18 DEBIT CARD PURCHASE 11/16 DUTCH BROS #OR0212 7.52 10,788.51\nFAIRVIEW OR	2024-11	14	ai	8d5a79c24258b11f9046f0ab6e7bc3a9a18e94048fffd928b91fcb2c93031a84	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
535	2	3	2024-11-26	DEBIT CARD PURCHASE 11/25 DUTCH BROS #OR0212 FAIRVIEW OR	-7.18	f	11/26 DEBIT CARD PURCHASE 11/25 DUTCH BROS #OR0212 7.18 4,115.99\nFAIRVIEW OR	2024-11	14	ai	e7c80841719b95f731cfd6aba2c146a2c2c4526cd73a74c8b50cfecc0e20ca7d	2026-10-16 14:40:14.316313-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
654	2	3	2024-12-03	DEBIT CARD PURCHASE 12/02 DUTCH BROS #OR0212 FAIRVIEW OR	-5.38	f	12/03 DEBIT CARD PURCHASE 12/02 DUTCH BROS #OR0212 5.38 5,958.80\nFAIRVIEW OR	2024-12	18	ai	4c247bb38d8827cec3abc78306ee16320421110e76cad7eedb0ad18e6c2ad418	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
658	2	3	2024-12-05	DEBIT CARD PURCHASE 12/04 DUTCH BROS #OR0212 FAIRVIEW OR	-7.39	f	12/05 DEBIT CARD PURCHASE 12/04 DUTCH BROS #OR0212 7.39 5,432.46\nFAIRVIEW OR	2024-12	18	ai	39a198242285bebe1c0e73150c3926d480b4bcf2caec94af8e4220d2e3bad3fd	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
941	2	3	2025-02-15	DEBIT CARD PURCHASE 02/15 DUTCH BROS #OR0212 FAIRVIEW OR	-7.37	f	02/15 DEBIT CARD PURCHASE 02/15 DUTCH BROS #OR0212 7.37 6,148.41\nFAIRVIEW OR	2025-02	27	ai	d793710f80573416d43986e2d807fc894d921f5aad5cb0da352caec3bf555a25	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:30.878729-06	\N	0.90	f
232	2	3	2024-09-17	DEBIT CARD PURCHASE 09/17 SQ *CASCADE ROASTERS FAIRVIEW OR	-7.19	f	09/17 DEBIT CARD PURCHASE 09/17 SQ *CASCADE ROASTERS 7.19 10,570.54\nFAIRVIEW OR	2024-09	6	ai	b59999c89da0681362adb819389fc02a5ca68a44d4e8a5fcd6654e74bf4967c1	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
688	2	3	2024-12-23	DEBIT CARD PURCHASE 12/23 SQ *CASCADE ROASTERS FAIRVIEW OR	-8.84	f	12/23 DEBIT CARD PURCHASE 12/23 SQ *CASCADE ROASTERS 8.84 7,022.43\nFAIRVIEW OR	2024-12	18	ai	369fecef4e14a7b3331b6a8871ffad12b4eac105d0979242e12c70b96f69dff4	2026-10-16 14:42:56.14614-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
835	2	3	2025-01-13	DEBIT CARD PURCHASE 01/12 SQ *CASCADE ROASTERS FAIRVIEW OR	-9.78	f	<TRNTYPE>DEBIT</TRNTYPE> <DTPOSTED>20250113120000.000[-8:PST]</DTPOSTED> <TRNAMT>-9.78</TRNAMT> <FITID>MFB2025011300220978</FITID> <NAME>DEBIT CARD PURCHASE 01/12 SQ *CA</NAME> <MEMO>DEBIT CARD PURCHASE 01/12 SQ *CASCADE ROASTERS FAIRVIEW OR</MEMO>	2025-01	23	ai	21d5ebba5b476f976585e1c9e943ca756e8c694e5d735804aed59514af6f3b2f	2026-10-16 14:45:50.646579-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
910	4	3	2025-01-29	SQ *CASCADE ROASTERS FAIRVIEW OR	-6.95	f	01/29 01/30 SQ *CASCADE ROASTERS FAIRVIEW OR 6.95	2025-01	26	ai	e6ec56496a9666787460c47d5929bdb23c5a3929d5122c17debb3e5c041a8913	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:31.054101-06	\N	0.95	f
915	4	3	2025-02-01	SQ *CASCADE ROASTERS FAIRVIEW OR	-6.43	f	02/01 02/02 SQ *CASCADE ROASTERS FAIRVIEW OR 6.43	2025-01	26	ai	67c46188060fe70bd4e62d7c89726bb1055018c64cfd03a70bf6909a957ed370	2026-10-16 14:45:50.686309-06	2026-10-16 14:49:31.054101-06	\N	0.95	f
958	2	3	2025-02-26	DEBIT CARD PURCHASE 02/25 SQ *CASCADE ROASTERS FAIRVIEW OR	-7.86	f	02/26 DEBIT CARD PURCHASE 02/25 SQ *CASCADE ROASTERS 7.86 2,834.13\nFAIRVIEW OR	2025-02	27	ai	fa0537ff665216dec64ab270a8496f4cb23a8be50901620416f6fdf52c2e4e21	2026-10-16 14:48:33.017818-06	2026-10-16 14:49:31.054101-06	\N	0.90	f
142	4	3	2024-09-01	TST* PINE STATE BISCUITS PORTLAND OR	-22.85	f	09/01 09/01 TST* PINE STATE BISCUITS PORTLAND OR 22.85	2024-08	4	ai	e281388d3ebb19b1dd16f4af87466686e6299478d01384060634d42334eefa23	2026-10-16 14:32:16.754628-06	2026-10-16 14:49:31.123945-06	\N	0.95	f
715	4	3	2024-12-07	TST* PINE STATE BISCUITS PORTLAND OR	-61.26	f	12/07 12/07 TST* PINE STATE BISCUITS PORTLAND OR 61.26	2024-12	20	ai	d2dd2eeadf7e608a1253cbd054052a3f02589d335f31ec136b79996ffa9faf4f	2026-10-16 14:42:56.181941-06	2026-10-16 14:49:31.123945-06	\N	0.90	f
202	2	3	2024-09-03	DEBIT CARD PURCHASE 09/02 SUBWAY 00412290 GRESHAM OR	-34.34	f	09/03 DEBIT CARD PURCHASE 09/02 SUBWAY 00412290 GRESHAM 34.34 6,705.83\nOR	2024-09	6	ai	b21ff59e9bb60f302c3663a66b1ecfbcdc02e5fb483e3c9c9a49a695bdf884e3	2026-10-16 14:34:51.912883-06	2026-10-16 14:49:31.934296-06	\N	0.95	f
4	1	3	2024-08-28	DOORDASH*BURGERVILLE #12	-31.96	f	08/28/2024,08/29/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-31.96	2024-08	1	ai	b1b2e4fd06e9e7856b5f96cdb9e6c657039ea967a599cd9f87e1a2d6ab042975	2026-10-16 14:32:16.563626-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
304	1	3	2024-10-31	DOORDASH*BURGERVILLE #12	-41.26	f	10/31/2024,11/02/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-41.26	2024-10	9	ai	0ebd6e4a2a41aca176d3f98df75ec0eca2a75af98638a31e5e9874272b8ce1b2	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
476	1	3	2024-11-17	DOORDASH*THAI BASIL, FAIRVIEW OR	-55.31	f	<TRNTYPE>DEBIT <DTPOSTED>20241117050000.000[-5:EST] <TRNAMT>-55.31 <FITID>2024111724492368114028 <NAME>DOORDASH*THAI BASIL, FAIRVIEW OR	2024-11	13	ai	82e33e7b3c5dc62433e060a8fd602e876098425eb4b586a5eeac4c9e3ea5e6d5	2026-10-16 14:40:14.285268-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
607	1	3	2024-12-23	DOORDASH*THAI BASIL, FAIRVIEW OR	-57.19	f	12/23/2024,12/25/2024,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-57.19	2024-12	17	ai	896483b2b43e2e67c7eb6fd70f0fd11f5bfc8dfca03b4f3cdcc017db0ecefb09	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
623	1	3	2024-12-14	DOORDASH*THAI BASIL, FAIRVIEW OR	-45.99	f	12/14/2024,12/15/2024,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-45.99	2024-12	17	ai	6380957a4d5ece15ed4e61dd69cbbbe5466a6a06ccc373919354b46d7ab5402e	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
615	1	3	2024-12-19	DOORDASH*BURGERVILLE #12	-19.86	f	12/19/2024,12/19/2024,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-19.86	2024-12	17	ai	5e50f199991fd77ba03412be638331d37ca099d6b645c3827272b3b5731a4ba9	2026-10-16 14:42:56.104719-06	2026-10-16 14:49:31.994986-06	\N	0.98	f
784	1	3	2025-01-18	DOORDASH*BURGERVILLE #12	-56.40	f	01/18/2025,01/19/2025,DOORDASH*BURGERVILLE #12,Food & Drink,Sale,-56.40	2025-01	21	ai	80e5f7c2785be42db7f78134976c13423fb13c22773f6b5bf00ba07bfc1dc401	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
806	1	3	2025-01-04	DOORDASH*THAI BASIL, FAIRVIEW OR	-27.84	f	01/04/2025,01/05/2025,DOORDASH*THAI BASIL, FAIRVIEW OR,Food & Drink,Sale,-27.84	2025-01	21	ai	2ee0b0c63821b11c48ed1af487ad4f7c05694a483f8cc915f3681ae61794b242	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:31.994986-06	\N	0.95	f
320	1	3	2024-10-21	UBER *EATS PENDING HELP.UBER.COM CA	-46.68	f	10/21/2024,10/22/2024,UBER *EATS PENDING HELP.UBER.COM CA,Food & Drink,Sale,-46.68	2024-10	9	ai	0f4bdccb433c8410e8a95f376e9e0000fd138921fe2c4f5b0dd4e3f0bf0afb2a	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.058457-06	\N	0.90	f
316	1	3	2024-10-23	UBER *EATS PENDING HELP.UBER.COM CA	-47.44	f	10/23/2024,10/25/2024,UBER *EATS PENDING HELP.UBER.COM CA,Food & Drink,Sale,-47.44	2024-10	9	ai	a150f11a3b8f0457e7cc0ae14a6630d3fb4058a45462225288e90b1aed75b91d	2026-10-16 14:37:30.463707-06	2026-10-16 14:49:32.058457-06	\N	0.95	f
41	1	3	2024-08-05	PANDA EXPRESS #1912 GRESHAM OR	-60.36	f	08/05/2024,08/05/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-60.36	2024-08	1	ai	c189a85386c3b9d3ca41416cb967313dce39ae8928da208a62cb85f61644a6c0	2026-10-16 14:32:16.563626-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
181	1	3	2024-09-12	PANDA EXPRESS #1912 GRESHAM OR	-60.91	f	09/12/2024,09/14/2024,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-60.91	2024-09	5	ai	2aaef3d19604a8a7777c170a2afba66397e2b048ad65046a4dc12f881db3b94c	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
767	1	3	2025-01-29	PANDA EXPRESS #1912 GRESHAM OR	-20.73	f	01/29/2025,01/31/2025,PANDA EXPRESS #1912 GRESHAM OR,Food & Drink,Sale,-20.73	2025-01	21	ai	bcae49c2e508509f96efe5c79916c9df56193ae8a8da49d5bd77c9e6ab617a80	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.221371-06	\N	0.95	f
42	1	2	2024-08-05	FRED-MEYER #0651 GRESHAM OR	-37.08	f	08/05/2024,08/07/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-37.08	2024-08	1	ai	e0284203107290dc104323da3e18d17a096cf7c474e7a2ab5f6368c72941de11	2026-10-16 14:32:16.563626-06	2026-10-16 14:49:32.57709-06	\N	0.95	f
56	2	2	2024-08-05	DEBIT CARD PURCHASE 08/05 FRED-MEYER #0651 GRESHAM OR	-131.59	f	08/05 DEBIT CARD PURCHASE 08/05 FRED-MEYER #0651 GRESHAM 131.59 4,822.65\nOR	2024-08	2	ai	7c24fe6c712c570046998cf9ccd31f3ae6e5e2c1162561a31e79e50d82c51eb9	2026-10-16 14:32:16.700533-06	2026-10-16 14:49:32.57709-06	\N	0.95	f
165	1	2	2024-09-21	FRED-MEYER #0651 GRESHAM OR	-35.19	f	09/21/2024,09/23/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-35.19	2024-09	5	ai	e722731468909b171f0254bca9c8e45b36c53607cad1670017615990e14511e5	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
178	1	2	2024-09-14	FRED-MEYER #0651 GRESHAM OR	-98.44	f	09/14/2024,09/16/2024,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-98.44	2024-09	5	ai	5166fd0f79909a7860cf2156769b7b700ac7387a96393434fdd4460db29fdeca	2026-10-16 14:34:51.858709-06	2026-10-16 14:49:32.57709-06	\N	0.85	f
481	1	2	2024-11-22	FRED-MEYER #0651 GRESHAM OR	-49.03	f	<TRNTYPE>DEBIT <DTPOSTED>20241122050000.000[-5:EST] <TRNAMT>-49.03 <FITID>2024112224492407709033 <NAME>FRED-MEYER #0651 GRESHAM OR	2024-11	13	ai	ef9264713c4a24692b5bfb847c8ab211c561269e5f06e1356f82016e1add7e61	2026-10-16 14:40:14.285268-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
794	1	2	2025-01-10	FRED-MEYER #0651 GRESHAM OR	-95.45	f	01/10/2025,01/11/2025,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-95.45	2025-01	21	ai	0cb3ac94676c728c30af9a84c364309035fbfed9e73a4da8619eb734daf943f3	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.57709-06	\N	0.90	f
788	1	2	2025-01-15	FRED-MEYER #0651 GRESHAM OR	-162.43	f	01/15/2025,01/16/2025,FRED-MEYER #0651 GRESHAM OR,Groceries,Sale,-162.43	2025-01	21	ai	e1523aba18a9dd4ecf686368947be1c6f3c5e9a249c470f28ea0fd97ec348b52	2026-10-16 14:45:50.631631-06	2026-10-16 14:49:32.57709-06	\N	0.95	f
451	1	8	2024-11-04	THE HOME DEPOT #4012 GRESHAM OR	-96.54	f	<TRNTYPE>DEBIT <DTPOSTED>20241104050000.000[-5:EST] <TRNAMT>-96.54 <FITID>2024110424492170139003 <NAME>THE HOME DEPOT #4012 GRESHAM OR	2024-11	13	ai	d89286a2a29a79fec4783d027a895d3f02ed4a99920740399e617a029b58c65d	2026-10-16 14:40:14.285268-06	2026-10-16 14:49:34.890656-06	\N	0.90	f
\.


--
-- Name: accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.accounts_id_seq', 32, true);


--
-- Name: ai_insights_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ai_insights_id_seq', 2, true);


--
-- Name: budget_main_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.budget_main_items_id_seq', 20, true);


--
-- Name: budget_month_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.budget_month_items_id_seq', 4, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 11, true);


--
-- Name: category_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.category_rules_id_seq', 8, true);


--
-- Name: processing_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.processing_jobs_id_seq', 7, true);


--
-- Name: statement_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.statement_files_id_seq', 32, true);


--
-- Name: transaction_splits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transaction_splits_id_seq', 2, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 964, true);


--
-- Name: accounts accounts_account_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_account_name_key UNIQUE (account_name);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: ai_insights ai_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights
    ADD CONSTRAINT ai_insights_pkey PRIMARY KEY (id);


--
-- Name: budget_main_items budget_main_items_category_id_effective_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_main_items
    ADD CONSTRAINT budget_main_items_category_id_effective_from_key UNIQUE (category_id, effective_from);


--
-- Name: budget_main_items budget_main_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_main_items
    ADD CONSTRAINT budget_main_items_pkey PRIMARY KEY (id);


--
-- Name: budget_month_items budget_month_items_month_category_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_month_items
    ADD CONSTRAINT budget_month_items_month_category_id_key UNIQUE (month, category_id);


--
-- Name: budget_month_items budget_month_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_month_items
    ADD CONSTRAINT budget_month_items_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: category_rules category_rules_pattern_match_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_rules
    ADD CONSTRAINT category_rules_pattern_match_type_key UNIQUE (pattern, match_type);


--
-- Name: category_rules category_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_rules
    ADD CONSTRAINT category_rules_pkey PRIMARY KEY (id);


--
-- Name: processing_jobs processing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: statement_files statement_files_month_file_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statement_files
    ADD CONSTRAINT statement_files_month_file_name_key UNIQUE (month, file_name);


--
-- Name: statement_files statement_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statement_files
    ADD CONSTRAINT statement_files_pkey PRIMARY KEY (id);


--
-- Name: transaction_splits transaction_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_splits
    ADD CONSTRAINT transaction_splits_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: ai_insights_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_insights_month_idx ON public.ai_insights USING btree (month, created_at DESC);


--
-- Name: budget_main_items_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX budget_main_items_category_idx ON public.budget_main_items USING btree (category_id, effective_from);


--
-- Name: budget_month_items_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX budget_month_items_month_idx ON public.budget_month_items USING btree (month);


--
-- Name: processing_jobs_one_active_per_month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX processing_jobs_one_active_per_month ON public.processing_jobs USING btree (month) WHERE ((status)::text = ANY ((ARRAY['queued'::character varying, 'running'::character varying])::text[]));


--
-- Name: transaction_splits_transaction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transaction_splits_transaction_id_idx ON public.transaction_splits USING btree (transaction_id);


--
-- Name: transactions_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_category_id_idx ON public.transactions USING btree (category_id);


--
-- Name: transactions_needs_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_needs_review_idx ON public.transactions USING btree (needs_review) WHERE needs_review;


--
-- Name: transactions_statement_file_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_statement_file_id_idx ON public.transactions USING btree (statement_file_id);


--
-- Name: transactions_statement_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_statement_month_idx ON public.transactions USING btree (statement_month);


--
-- Name: transactions_transaction_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_transaction_date_idx ON public.transactions USING btree (transaction_date);


--
-- Name: transactions_transfer_pair_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_transfer_pair_idx ON public.transactions USING btree (transfer_pair_id);


--
-- Name: budget_main_items budget_main_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_main_items
    ADD CONSTRAINT budget_main_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: budget_month_items budget_month_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_month_items
    ADD CONSTRAINT budget_month_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: category_rules category_rules_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_rules
    ADD CONSTRAINT category_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: statement_files statement_files_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statement_files
    ADD CONSTRAINT statement_files_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: transaction_splits transaction_splits_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_splits
    ADD CONSTRAINT transaction_splits_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: transaction_splits transaction_splits_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_splits
    ADD CONSTRAINT transaction_splits_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: transactions transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: transactions transactions_statement_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_statement_file_id_fkey FOREIGN KEY (statement_file_id) REFERENCES public.statement_files(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_transfer_pair_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_transfer_pair_id_fkey FOREIGN KEY (transfer_pair_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


