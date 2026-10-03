


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "waytara";


ALTER SCHEMA "waytara" OWNER TO "postgres";


CREATE TYPE "waytara"."device_status" AS ENUM (
    'test',
    'active',
    'offline',
    'decommissioned'
);


ALTER TYPE "waytara"."device_status" OWNER TO "postgres";


CREATE TYPE "waytara"."invite_status" AS ENUM (
    'pending',
    'accepted',
    'expired',
    'revoked'
);


ALTER TYPE "waytara"."invite_status" OWNER TO "postgres";


CREATE TYPE "waytara"."lead_status" AS ENUM (
    'new',
    'assigned',
    'quoted',
    'converted',
    'lost'
);


ALTER TYPE "waytara"."lead_status" OWNER TO "postgres";


CREATE TYPE "waytara"."onboarding_stage" AS ENUM (
    'quotation_sent',
    'quotation_accepted',
    'payment_pending',
    'account_created',
    'site_setup',
    'connection_test',
    'install_scheduled',
    'install_completed'
);


ALTER TYPE "waytara"."onboarding_stage" OWNER TO "postgres";


CREATE TYPE "waytara"."payment_option" AS ENUM (
    'full',
    'split'
);


ALTER TYPE "waytara"."payment_option" OWNER TO "postgres";


CREATE TYPE "waytara"."payment_status" AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded'
);


ALTER TYPE "waytara"."payment_status" OWNER TO "postgres";


CREATE TYPE "waytara"."payment_type" AS ENUM (
    'full',
    'advance',
    'balance'
);


ALTER TYPE "waytara"."payment_type" OWNER TO "postgres";


CREATE TYPE "waytara"."plan_code" AS ENUM (
    'basic',
    'pro',
    'advance'
);


ALTER TYPE "waytara"."plan_code" OWNER TO "postgres";


CREATE TYPE "waytara"."power_package" AS ENUM (
    'solar_inverter',
    'solar_battery_inverter',
    'inverter_battery',
    'solar_inverter_ev',
    'solar_battery_inverter_ev',
    'inverter_battery_ev',
    'ev_charger_only'
);


ALTER TYPE "waytara"."power_package" OWNER TO "postgres";


CREATE TYPE "waytara"."power_source_category" AS ENUM (
    'grid_tied',
    'off_grid',
    'hybrid'
);


ALTER TYPE "waytara"."power_source_category" OWNER TO "postgres";


CREATE TYPE "waytara"."property_type" AS ENUM (
    'residential_independent_villas',
    'gated_communities_rwas_high_rises',
    'factories_heavy_engineering_processing_plants',
    'corporate_offices_hospitals_hotels_retail',
    'logistics_delivery_hubs_bus_depots',
    'tech_parks_data_centers_rnd_hubs'
);


ALTER TYPE "waytara"."property_type" OWNER TO "postgres";


CREATE TYPE "waytara"."quotation_status" AS ENUM (
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'revision_requested'
);


ALTER TYPE "waytara"."quotation_status" OWNER TO "postgres";


CREATE TYPE "waytara"."stock_status" AS ENUM (
    'in_stock',
    'allocated',
    'installed',
    'damaged',
    'returned'
);


ALTER TYPE "waytara"."stock_status" OWNER TO "postgres";


CREATE TYPE "waytara"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'cancelled'
);


ALTER TYPE "waytara"."subscription_status" OWNER TO "postgres";


CREATE TYPE "waytara"."test_session_status" AS ENUM (
    'running',
    'verified',
    'failed'
);


ALTER TYPE "waytara"."test_session_status" OWNER TO "postgres";


CREATE TYPE "waytara"."user_role" AS ENUM (
    'admin',
    'employee',
    'customer',
    'site_engineer'
);


ALTER TYPE "waytara"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "waytara"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'waytara', 'public', 'pg_temp'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;


ALTER FUNCTION "waytara"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "waytara"."is_site_engineer_or_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'waytara', 'public'
    AS $$
  select exists (
    select 1 from waytara.profiles
    where id = auth.uid() and role in ('admin', 'site_engineer')
  );
$$;


ALTER FUNCTION "waytara"."is_site_engineer_or_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "waytara"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'waytara', 'public', 'pg_temp'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','employee'));
$$;


ALTER FUNCTION "waytara"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "waytara"."log_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'waytara', 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_role user_role;
begin
  select role into v_role from profiles where id = v_actor;
  insert into audit_log (actor_id, actor_role, action, entity, entity_id, changes)
  values (
    v_actor,
    v_role,
    lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id)::text,
    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "waytara"."log_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "waytara"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "waytara"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "waytara"."update_device_site"("p_device_id" "uuid", "p_name" "text", "p_property_type" "waytara"."property_type", "p_power_source_category" "waytara"."power_source_category", "p_address" "jsonb", "p_power_package" "waytara"."power_package" DEFAULT NULL::"waytara"."power_package", "p_latitude" numeric DEFAULT NULL::numeric, "p_longitude" numeric DEFAULT NULL::numeric) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'waytara', 'public', 'pg_temp'
    AS $$
declare
  v_customer_id uuid;
  v_site_id uuid;
begin
  select s.customer_id, s.id
    into v_customer_id, v_site_id
  from waytara.equipment e
  join waytara.sites s on s.id = e.site_id
  where e.id = p_device_id;

  if v_customer_id is null or v_customer_id != auth.uid() then
    raise exception 'Not authorized for this device.';
  end if;

  update waytara.sites
  set name = p_name,
      property_type = p_property_type,
      power_source_category = p_power_source_category,
      address = p_address,
      power_package = p_power_package,
      latitude = p_latitude,
      longitude = p_longitude
  where id = v_site_id;

  return v_site_id;
end;
$$;


ALTER FUNCTION "waytara"."update_device_site"("p_device_id" "uuid", "p_name" "text", "p_property_type" "waytara"."property_type", "p_power_source_category" "waytara"."power_source_category", "p_address" "jsonb", "p_power_package" "waytara"."power_package", "p_latitude" numeric, "p_longitude" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "waytara"."update_device_site"("p_device_id" "uuid", "p_name" "text", "p_property_type" "waytara"."property_type", "p_power_source_category" "waytara"."power_source_category", "p_address" "jsonb", "p_power_package" "waytara"."power_package", "p_latitude" numeric, "p_longitude" numeric) IS 'Updates the site a device belongs to IN PLACE, for every device sharing that site - deliberately does not fork/split a new site, even when the site has multiple devices (see this migration''s own header comment for why, and 20260911000000 for the prior, reversed behavior).';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "waytara"."alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "device_id" "uuid" NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "acknowledged_by" "uuid",
    "acknowledged_at" timestamp with time zone
);


ALTER TABLE "waytara"."alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."audit_log" (
    "id" bigint NOT NULL,
    "actor_id" "uuid",
    "actor_role" "waytara"."user_role",
    "action" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text",
    "changes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "waytara"."audit_log" OWNER TO "postgres";


ALTER TABLE "waytara"."audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "waytara"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "waytara"."customer_onboarding" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "quotation_id" "uuid",
    "customer_id" "uuid",
    "employee_id" "uuid",
    "invite_token" "text",
    "invite_status" "waytara"."invite_status" DEFAULT 'pending'::"waytara"."invite_status",
    "current_stage" "waytara"."onboarding_stage" DEFAULT 'quotation_sent'::"waytara"."onboarding_stage" NOT NULL,
    "balance_payment_status" "text" DEFAULT 'not_applicable'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "install_scheduled_at" timestamp with time zone,
    "install_time_slot" "text",
    CONSTRAINT "customer_onboarding_install_time_slot_check" CHECK ((("install_time_slot" IS NULL) OR ("install_time_slot" = ANY (ARRAY['morning'::"text", 'afternoon'::"text", 'evening'::"text"]))))
);


ALTER TABLE "waytara"."customer_onboarding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."customers" (
    "id" "uuid" NOT NULL,
    "address" "jsonb",
    "billing_email" "text",
    "plan_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "plan_started_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tariff_rate_per_kwh" numeric(10,2) DEFAULT 8.00 NOT NULL
);


ALTER TABLE "waytara"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."equipment_telemetry" (
    "id" bigint NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "ts" timestamp with time zone NOT NULL,
    "key_name" "text" NOT NULL,
    "value" numeric,
    "unit" "text",
    "is_test" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "waytara"."equipment_telemetry" OWNER TO "postgres";


ALTER TABLE "waytara"."equipment_telemetry" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "waytara"."device_readings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "waytara"."equipment_configs" (
    "id" bigint NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL,
    "setting_category" "text" NOT NULL,
    "key_name" "text" NOT NULL,
    "setting_value" "text" NOT NULL,
    "unit" "text",
    "written_by" "uuid",
    "source" "text",
    "notes" "text",
    "modbus_register" "jsonb",
    "previous_value" "text"
);


ALTER TABLE "waytara"."equipment_configs" OWNER TO "postgres";


ALTER TABLE "waytara"."equipment_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "waytara"."device_settings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "waytara"."employee_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "waytara"."user_role" DEFAULT 'employee'::"waytara"."user_role" NOT NULL,
    "invited_by" "uuid",
    "token" "text" NOT NULL,
    "status" "waytara"."invite_status" DEFAULT 'pending'::"waytara"."invite_status" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "waytara"."employee_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "stock_id" "uuid" NOT NULL,
    "label" "text",
    "device_status" "waytara"."device_status" DEFAULT 'test'::"waytara"."device_status" NOT NULL,
    "installed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "installation_id" "uuid",
    "warranty_start_date" "date",
    "warranty_end_date" "date",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_id" "uuid"
);


ALTER TABLE "waytara"."equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."equipment_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "device_id" "uuid" NOT NULL,
    "availability" boolean DEFAULT false NOT NULL,
    "quality" boolean DEFAULT false NOT NULL,
    "power_connect" boolean DEFAULT false NOT NULL,
    "checked_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "waytara"."equipment_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."equipment_enum" (
    "enum_ref" "text" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "notes" "text"
);


ALTER TABLE "waytara"."equipment_enum" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."equipment_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "manufacturer" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text" NOT NULL,
    "brand" "text",
    "model" "text",
    "model_number" "text",
    "serial_number" "text",
    "status" "waytara"."stock_status" DEFAULT 'in_stock'::"waytara"."stock_status" NOT NULL,
    "power_capacity_value" numeric,
    "power_capacity_unit" "text",
    "size_value" numeric,
    "size_unit" "text",
    "technical_specs" "jsonb",
    "warranty_info" "jsonb",
    "quantity" integer DEFAULT 0 NOT NULL,
    "pack_size" integer,
    "primary_uom" "text",
    "purchase_price_amount" numeric(12,2),
    "unit_price" numeric(12,2),
    "purchase_date" "date",
    "supplier" "text",
    "po_reference" "text",
    "phase_count" integer
);


ALTER TABLE "waytara"."equipment_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."equipment_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "key_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "device_category" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "address" "jsonb",
    "decode" "jsonb",
    "enum_ref" "text",
    "valid_min" numeric,
    "valid_max" numeric,
    "cadence_seconds" integer,
    "show_for_user" boolean DEFAULT true NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "notes" "text",
    CONSTRAINT "equipment_metrics_device_category_check" CHECK (("device_category" = ANY (ARRAY['solar'::"text", 'ev'::"text"]))),
    CONSTRAINT "equipment_metrics_direction_check" CHECK (("direction" = ANY (ARRAY['read'::"text", 'write'::"text", 'command'::"text"])))
);


ALTER TABLE "waytara"."equipment_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."equipment_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "dashboard_section" "text" NOT NULL,
    "group_name" "text",
    "device_category" "text" NOT NULL,
    "key_name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "unit" "text",
    "direction" "text" NOT NULL,
    "value_kind" "text",
    "hybrid_1p_on_grid" boolean DEFAULT false NOT NULL,
    "hybrid_1p_off_grid" boolean DEFAULT false NOT NULL,
    "hybrid_3p_on_grid" boolean DEFAULT false NOT NULL,
    "hybrid_3p_off_grid" boolean DEFAULT false NOT NULL,
    "string_1p_on_grid" boolean DEFAULT false NOT NULL,
    "string_3p_on_grid" boolean DEFAULT false NOT NULL,
    "micro_1p_on_grid" boolean DEFAULT false NOT NULL,
    "ev_slow_ac" boolean DEFAULT false NOT NULL,
    "ev_fast_ac" boolean DEFAULT false NOT NULL,
    "ev_dc" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "source" "text",
    CONSTRAINT "equipment_templates_device_category_check" CHECK (("device_category" = ANY (ARRAY['solar'::"text", 'ev'::"text"]))),
    CONSTRAINT "equipment_templates_direction_check" CHECK (("direction" = ANY (ARRAY['read'::"text", 'write'::"text", 'command'::"text"])))
);


ALTER TABLE "waytara"."equipment_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."ev_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone,
    "start_energy_kwh" numeric,
    "end_energy_kwh" numeric,
    "stop_reason" "text",
    "is_test" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "waytara"."ev_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."installations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "scheduled_date" "date",
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text"
);


ALTER TABLE "waytara"."installations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "address" "jsonb",
    "message" "text",
    "source" "text" DEFAULT 'landing_page'::"text",
    "status" "waytara"."lead_status" DEFAULT 'new'::"waytara"."lead_status" NOT NULL,
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone
);


ALTER TABLE "waytara"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."maintenance_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "device_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "type" "text" DEFAULT 'issue'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "description" "text",
    "scheduled_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_contract_id" "uuid",
    "is_chargeable" boolean,
    "charge_amount" numeric(12,2)
);


ALTER TABLE "waytara"."maintenance_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "payment_type" "waytara"."payment_type" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "status" "waytara"."payment_status" DEFAULT 'pending'::"waytara"."payment_status" NOT NULL,
    "gateway" "text",
    "gateway_ref" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "method" "text",
    CONSTRAINT "payments_method_check" CHECK ((("method" IS NULL) OR ("method" = ANY (ARRAY['upi'::"text", 'cash'::"text", 'simulated'::"text"]))))
);


ALTER TABLE "waytara"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "waytara"."plan_code" NOT NULL,
    "name" "text" NOT NULL,
    "max_devices" integer,
    "price_monthly" numeric(10,2) NOT NULL,
    "price_yearly" numeric(10,2),
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "waytara"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "waytara"."user_role" DEFAULT 'customer'::"waytara"."user_role" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_preferences" "jsonb" DEFAULT '{"email_alerts": true, "email_maintenance_updates": true}'::"jsonb" NOT NULL,
    "deactivated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "waytara"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."quotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "plan_id" "uuid" NOT NULL,
    "pricing_breakdown" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "status" "waytara"."quotation_status" DEFAULT 'draft'::"waytara"."quotation_status" NOT NULL,
    "payment_option" "waytara"."payment_option",
    "advance_amount" numeric(10,2),
    "balance_amount" numeric(10,2),
    "pdf_url" "text",
    "sent_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "valid_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subtotal_amount" numeric,
    "gst_rate" numeric DEFAULT 18 NOT NULL,
    "gst_amount" numeric,
    "access_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_message" "text"
);


ALTER TABLE "waytara"."quotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."service_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "device_id" "uuid" NOT NULL,
    "service_plan_id" "uuid",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "waytara"."service_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."service_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "device_category" "text" NOT NULL,
    "duration_months" integer NOT NULL,
    "total_services_included" integer NOT NULL,
    "free_services_count" integer DEFAULT 0 NOT NULL,
    "price_amount" numeric(12,2),
    "per_extra_service_price_amount" numeric(12,2),
    "covered_items" "jsonb",
    "paid_extras" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "waytara"."service_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "property_type" "waytara"."property_type" NOT NULL,
    "power_source_category" "waytara"."power_source_category" NOT NULL,
    "address" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "power_package" "waytara"."power_package",
    "latitude" numeric(9,6),
    "longitude" numeric(9,6)
);


ALTER TABLE "waytara"."sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "waytara"."subscription_status" DEFAULT 'trialing'::"waytara"."subscription_status" NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "payment_gateway_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "waytara"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "sender_role" "text" NOT NULL,
    "body" "text" NOT NULL,
    "attachment_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_messages_sender_role_check" CHECK (("sender_role" = ANY (ARRAY['customer'::"text", 'employee'::"text", 'admin'::"text"])))
);


ALTER TABLE "waytara"."support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "waytara"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "waytara"."test_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "status" "waytara"."test_session_status" DEFAULT 'running'::"waytara"."test_session_status" NOT NULL,
    "data_purged" boolean DEFAULT false NOT NULL,
    "notes" "text"
);


ALTER TABLE "waytara"."test_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "waytara"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."ev_sessions"
    ADD CONSTRAINT "charging_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."customer_onboarding"
    ADD CONSTRAINT "customer_onboarding_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "waytara"."customer_onboarding"
    ADD CONSTRAINT "customer_onboarding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."equipment_telemetry"
    ADD CONSTRAINT "device_readings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."equipment_configs"
    ADD CONSTRAINT "device_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."equipment_inventory"
    ADD CONSTRAINT "device_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."equipment"
    ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."employee_invites"
    ADD CONSTRAINT "employee_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."employee_invites"
    ADD CONSTRAINT "employee_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "waytara"."equipment_checks"
    ADD CONSTRAINT "equipment_checks_device_id_key" UNIQUE ("device_id");



ALTER TABLE ONLY "waytara"."equipment_checks"
    ADD CONSTRAINT "equipment_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."equipment_metrics"
    ADD CONSTRAINT "equipment_metrics_equipment_id_key_name_key" UNIQUE ("equipment_id", "key_name");



ALTER TABLE ONLY "waytara"."equipment_metrics"
    ADD CONSTRAINT "equipment_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."equipment_templates"
    ADD CONSTRAINT "equipment_templates_device_category_key_name_key" UNIQUE ("device_category", "key_name");



ALTER TABLE ONLY "waytara"."equipment_templates"
    ADD CONSTRAINT "equipment_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."installations"
    ADD CONSTRAINT "installations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."equipment_enum"
    ADD CONSTRAINT "instrument_enum_values_pkey" PRIMARY KEY ("enum_ref", "code");



ALTER TABLE ONLY "waytara"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."maintenance_tickets"
    ADD CONSTRAINT "maintenance_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."plans"
    ADD CONSTRAINT "plans_code_key" UNIQUE ("code");



ALTER TABLE ONLY "waytara"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."quotations"
    ADD CONSTRAINT "quotations_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "waytara"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."service_contracts"
    ADD CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."service_plans"
    ADD CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "waytara"."test_sessions"
    ADD CONSTRAINT "test_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "charging_sessions_device_id_idx" ON "waytara"."ev_sessions" USING "btree" ("equipment_id", "started_at" DESC);



CREATE INDEX "charging_sessions_open_idx" ON "waytara"."ev_sessions" USING "btree" ("equipment_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "equipment_metrics_equipment_category_idx" ON "waytara"."equipment_metrics" USING "btree" ("equipment_id", "category") WHERE "show_for_user";



CREATE INDEX "equipment_metrics_equipment_id_idx" ON "waytara"."equipment_metrics" USING "btree" ("equipment_id");



CREATE INDEX "equipment_metrics_template_idx" ON "waytara"."equipment_metrics" USING "btree" ("device_category", "key_name");



CREATE INDEX "equipment_templates_dashboard_section_idx" ON "waytara"."equipment_templates" USING "btree" ("dashboard_section");



CREATE INDEX "equipment_templates_device_category_idx" ON "waytara"."equipment_templates" USING "btree" ("device_category");



CREATE INDEX "idx_audit_actor" ON "waytara"."audit_log" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_entity" ON "waytara"."audit_log" USING "btree" ("entity", "entity_id");



CREATE INDEX "idx_devices_site" ON "waytara"."equipment" USING "btree" ("site_id");



CREATE INDEX "idx_leads_assigned_to" ON "waytara"."leads" USING "btree" ("assigned_to");



CREATE INDEX "idx_leads_status" ON "waytara"."leads" USING "btree" ("status");



CREATE INDEX "idx_onboarding_customer" ON "waytara"."customer_onboarding" USING "btree" ("customer_id");



CREATE INDEX "idx_onboarding_employee" ON "waytara"."customer_onboarding" USING "btree" ("employee_id");



CREATE INDEX "idx_payments_quotation" ON "waytara"."payments" USING "btree" ("quotation_id");



CREATE INDEX "idx_quotations_lead" ON "waytara"."quotations" USING "btree" ("lead_id");



CREATE INDEX "idx_readings_device_ts" ON "waytara"."equipment_telemetry" USING "btree" ("equipment_id", "ts" DESC);



CREATE INDEX "idx_readings_test" ON "waytara"."equipment_telemetry" USING "btree" ("equipment_id", "is_test");



CREATE INDEX "idx_settings_device" ON "waytara"."equipment_configs" USING "btree" ("equipment_id", "setting_category");



CREATE INDEX "idx_sites_customer" ON "waytara"."sites" USING "btree" ("customer_id");



CREATE OR REPLACE TRIGGER "devices_set_updated_at" BEFORE UPDATE ON "waytara"."equipment" FOR EACH ROW EXECUTE FUNCTION "waytara"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_audit_alerts" AFTER INSERT OR DELETE OR UPDATE ON "waytara"."alerts" FOR EACH ROW EXECUTE FUNCTION "waytara"."log_activity"();



CREATE OR REPLACE TRIGGER "trg_audit_customer_onboarding" AFTER INSERT OR DELETE OR UPDATE ON "waytara"."customer_onboarding" FOR EACH ROW EXECUTE FUNCTION "waytara"."log_activity"();



CREATE OR REPLACE TRIGGER "trg_audit_device_settings" AFTER INSERT OR DELETE OR UPDATE ON "waytara"."equipment_configs" FOR EACH ROW EXECUTE FUNCTION "waytara"."log_activity"();



CREATE OR REPLACE TRIGGER "trg_audit_devices" AFTER INSERT OR DELETE OR UPDATE ON "waytara"."equipment" FOR EACH ROW EXECUTE FUNCTION "waytara"."log_activity"();



CREATE OR REPLACE TRIGGER "trg_audit_employee_invites" AFTER INSERT OR DELETE OR UPDATE ON "waytara"."employee_invites" FOR EACH ROW EXECUTE FUNCTION "waytara"."log_activity"();



CREATE OR REPLACE TRIGGER "trg_audit_leads" AFTER INSERT OR DELETE OR UPDATE ON "waytara"."leads" FOR EACH ROW EXECUTE FUNCTION "waytara"."log_activity"();



CREATE OR REPLACE TRIGGER "trg_audit_payments" AFTER INSERT OR DELETE OR UPDATE ON "waytara"."payments" FOR EACH ROW EXECUTE FUNCTION "waytara"."log_activity"();



CREATE OR REPLACE TRIGGER "trg_audit_plans" AFTER INSERT OR DELETE OR UPDATE ON "waytara"."plans" FOR EACH ROW EXECUTE FUNCTION "waytara"."log_activity"();



CREATE OR REPLACE TRIGGER "trg_audit_quotations" AFTER INSERT OR DELETE OR UPDATE ON "waytara"."quotations" FOR EACH ROW EXECUTE FUNCTION "waytara"."log_activity"();



ALTER TABLE ONLY "waytara"."alerts"
    ADD CONSTRAINT "alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."alerts"
    ADD CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "waytara"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."ev_sessions"
    ADD CONSTRAINT "charging_sessions_device_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "waytara"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."customer_onboarding"
    ADD CONSTRAINT "customer_onboarding_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "waytara"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."customer_onboarding"
    ADD CONSTRAINT "customer_onboarding_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."customer_onboarding"
    ADD CONSTRAINT "customer_onboarding_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "waytara"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."customer_onboarding"
    ADD CONSTRAINT "customer_onboarding_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "waytara"."quotations"("id");



ALTER TABLE ONLY "waytara"."customers"
    ADD CONSTRAINT "customers_id_fkey" FOREIGN KEY ("id") REFERENCES "waytara"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."customers"
    ADD CONSTRAINT "customers_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "waytara"."plans"("id");



ALTER TABLE ONLY "waytara"."equipment_telemetry"
    ADD CONSTRAINT "device_readings_device_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "waytara"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."equipment_configs"
    ADD CONSTRAINT "device_settings_device_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "waytara"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."equipment_configs"
    ADD CONSTRAINT "device_settings_written_by_fkey" FOREIGN KEY ("written_by") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."equipment"
    ADD CONSTRAINT "devices_device_type_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "waytara"."equipment_inventory"("id");



ALTER TABLE ONLY "waytara"."equipment"
    ADD CONSTRAINT "devices_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "waytara"."installations"("id");



ALTER TABLE ONLY "waytara"."equipment"
    ADD CONSTRAINT "devices_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "waytara"."service_contracts"("id");



ALTER TABLE ONLY "waytara"."equipment"
    ADD CONSTRAINT "devices_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "waytara"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."employee_invites"
    ADD CONSTRAINT "employee_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."equipment_checks"
    ADD CONSTRAINT "equipment_checks_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."equipment_checks"
    ADD CONSTRAINT "equipment_checks_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "waytara"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."equipment_metrics"
    ADD CONSTRAINT "equipment_metrics_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "waytara"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."equipment_metrics"
    ADD CONSTRAINT "equipment_metrics_template_fkey" FOREIGN KEY ("device_category", "key_name") REFERENCES "waytara"."equipment_templates"("device_category", "key_name");



ALTER TABLE ONLY "waytara"."installations"
    ADD CONSTRAINT "installations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."installations"
    ADD CONSTRAINT "installations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "waytara"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."leads"
    ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."maintenance_tickets"
    ADD CONSTRAINT "maintenance_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "waytara"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."maintenance_tickets"
    ADD CONSTRAINT "maintenance_tickets_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "waytara"."equipment"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."maintenance_tickets"
    ADD CONSTRAINT "maintenance_tickets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."maintenance_tickets"
    ADD CONSTRAINT "maintenance_tickets_service_contract_id_fkey" FOREIGN KEY ("service_contract_id") REFERENCES "waytara"."service_contracts"("id");



ALTER TABLE ONLY "waytara"."maintenance_tickets"
    ADD CONSTRAINT "maintenance_tickets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "waytara"."sites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."payments"
    ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "waytara"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."payments"
    ADD CONSTRAINT "payments_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "waytara"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."quotations"
    ADD CONSTRAINT "quotations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."quotations"
    ADD CONSTRAINT "quotations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "waytara"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."quotations"
    ADD CONSTRAINT "quotations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "waytara"."plans"("id");



ALTER TABLE ONLY "waytara"."service_contracts"
    ADD CONSTRAINT "service_contracts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "waytara"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."service_contracts"
    ADD CONSTRAINT "service_contracts_service_plan_id_fkey" FOREIGN KEY ("service_plan_id") REFERENCES "waytara"."service_plans"("id");



ALTER TABLE ONLY "waytara"."sites"
    ADD CONSTRAINT "sites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "waytara"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."subscriptions"
    ADD CONSTRAINT "subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "waytara"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "waytara"."plans"("id");



ALTER TABLE ONLY "waytara"."support_messages"
    ADD CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."support_messages"
    ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "waytara"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."support_tickets"
    ADD CONSTRAINT "support_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "waytara"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "waytara"."test_sessions"
    ADD CONSTRAINT "test_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "waytara"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "waytara"."test_sessions"
    ADD CONSTRAINT "test_sessions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "waytara"."sites"("id") ON DELETE CASCADE;



ALTER TABLE "waytara"."alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alerts_admin_all" ON "waytara"."alerts" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "alerts_admin_update" ON "waytara"."alerts" FOR UPDATE USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "alerts_employee_assigned" ON "waytara"."alerts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("d"."id" = "alerts"."device_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "alerts_employee_update_assigned" ON "waytara"."alerts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("d"."id" = "alerts"."device_id") AND ("co"."employee_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("d"."id" = "alerts"."device_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "alerts_owner" ON "waytara"."alerts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
  WHERE (("d"."id" = "alerts"."device_id") AND ("s"."customer_id" = "auth"."uid"())))));



CREATE POLICY "alerts_owner_update" ON "waytara"."alerts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
  WHERE (("d"."id" = "alerts"."device_id") AND ("s"."customer_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
  WHERE (("d"."id" = "alerts"."device_id") AND ("s"."customer_id" = "auth"."uid"())))));



CREATE POLICY "audit_admin_only" ON "waytara"."audit_log" FOR SELECT USING ("waytara"."is_admin"());



ALTER TABLE "waytara"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "charging_sessions_admin_all" ON "waytara"."ev_sessions" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "charging_sessions_employee_assigned" ON "waytara"."ev_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("d"."id" = "ev_sessions"."equipment_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "charging_sessions_owner" ON "waytara"."ev_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
  WHERE (("d"."id" = "ev_sessions"."equipment_id") AND ("s"."customer_id" = "auth"."uid"())))));



ALTER TABLE "waytara"."customer_onboarding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "waytara"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_admin_all" ON "waytara"."customers" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "customers_employee_assigned" ON "waytara"."customers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."customer_id" = "customers"."id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "customers_self" ON "waytara"."customers" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "customers_self_update" ON "waytara"."customers" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "devices_admin_all" ON "waytara"."equipment" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "devices_admin_insert" ON "waytara"."equipment" FOR INSERT WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "devices_admin_update" ON "waytara"."equipment" FOR UPDATE USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "devices_customer_update_own_label" ON "waytara"."equipment" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "waytara"."sites" "s"
  WHERE (("s"."id" = "equipment"."site_id") AND ("s"."customer_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "waytara"."sites" "s"
  WHERE (("s"."id" = "equipment"."site_id") AND ("s"."customer_id" = "auth"."uid"())))));



CREATE POLICY "devices_employee_assigned" ON "waytara"."equipment" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("waytara"."sites" "s"
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("s"."id" = "equipment"."site_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "devices_employee_insert_assigned" ON "waytara"."equipment" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("waytara"."sites" "s"
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("s"."id" = "equipment"."site_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "devices_employee_update_assigned" ON "waytara"."equipment" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("waytara"."sites" "s"
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("s"."id" = "equipment"."site_id") AND ("co"."employee_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("waytara"."sites" "s"
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("s"."id" = "equipment"."site_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "devices_owner" ON "waytara"."equipment" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "waytara"."sites"
  WHERE (("sites"."id" = "equipment"."site_id") AND ("sites"."customer_id" = "auth"."uid"())))));



ALTER TABLE "waytara"."employee_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_invites_admin_all" ON "waytara"."employee_invites" USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



ALTER TABLE "waytara"."equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "waytara"."equipment_checks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "equipment_checks_admin_all" ON "waytara"."equipment_checks" USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "equipment_checks_employee_assigned" ON "waytara"."equipment_checks" USING ((EXISTS ( SELECT 1
   FROM (("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("d"."id" = "equipment_checks"."device_id") AND ("co"."employee_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("d"."id" = "equipment_checks"."device_id") AND ("co"."employee_id" = "auth"."uid"())))));



ALTER TABLE "waytara"."equipment_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "waytara"."equipment_enum" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "waytara"."equipment_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "waytara"."equipment_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "equipment_metrics_owner_read" ON "waytara"."equipment_metrics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("waytara"."equipment" "e"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "e"."site_id")))
  WHERE (("e"."id" = "equipment_metrics"."equipment_id") AND ("s"."customer_id" = "auth"."uid"())))));



CREATE POLICY "equipment_metrics_staff_all" ON "waytara"."equipment_metrics" USING ("waytara"."is_site_engineer_or_admin"()) WITH CHECK ("waytara"."is_site_engineer_or_admin"());



ALTER TABLE "waytara"."equipment_telemetry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "waytara"."equipment_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "equipment_templates_read_all" ON "waytara"."equipment_templates" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "equipment_templates_staff_write" ON "waytara"."equipment_templates" USING ("waytara"."is_site_engineer_or_admin"()) WITH CHECK ("waytara"."is_site_engineer_or_admin"());



ALTER TABLE "waytara"."ev_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "waytara"."installations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "instrument_enum_values_read_all" ON "waytara"."equipment_enum" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "instrument_enum_values_staff_write" ON "waytara"."equipment_enum" USING ("waytara"."is_site_engineer_or_admin"()) WITH CHECK ("waytara"."is_site_engineer_or_admin"());



ALTER TABLE "waytara"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_admin_all" ON "waytara"."leads" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "leads_admin_update" ON "waytara"."leads" FOR UPDATE USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "leads_employee_assigned" ON "waytara"."leads" FOR SELECT USING (("assigned_to" = "auth"."uid"()));



CREATE POLICY "leads_employee_update_assigned" ON "waytara"."leads" FOR UPDATE USING (("assigned_to" = "auth"."uid"()));



CREATE POLICY "leads_public_insert" ON "waytara"."leads" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "maintenance_admin_all" ON "waytara"."maintenance_tickets" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "maintenance_customer_own_insert" ON "waytara"."maintenance_tickets" FOR INSERT WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "maintenance_customer_own_select" ON "waytara"."maintenance_tickets" FOR SELECT USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "maintenance_employee_assigned" ON "waytara"."maintenance_tickets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."customer_id" = "maintenance_tickets"."customer_id") AND ("co"."employee_id" = "auth"."uid"())))));



ALTER TABLE "waytara"."maintenance_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "onboarding_admin_all" ON "waytara"."customer_onboarding" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "onboarding_admin_insert" ON "waytara"."customer_onboarding" FOR INSERT WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "onboarding_admin_update" ON "waytara"."customer_onboarding" FOR UPDATE USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "onboarding_customer_select_own" ON "waytara"."customer_onboarding" FOR SELECT USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "onboarding_customer_update_own" ON "waytara"."customer_onboarding" FOR UPDATE USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "onboarding_employee_insert_own_lead" ON "waytara"."customer_onboarding" FOR INSERT WITH CHECK ((("employee_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "waytara"."leads" "l"
  WHERE (("l"."id" = "customer_onboarding"."lead_id") AND ("l"."assigned_to" = "auth"."uid"()))))));



CREATE POLICY "onboarding_employee_own" ON "waytara"."customer_onboarding" FOR SELECT USING (("employee_id" = "auth"."uid"()));



CREATE POLICY "onboarding_employee_update_own" ON "waytara"."customer_onboarding" FOR UPDATE USING (("employee_id" = "auth"."uid"()));



ALTER TABLE "waytara"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_admin_all" ON "waytara"."payments" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "payments_admin_insert" ON "waytara"."payments" FOR INSERT WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "payments_admin_update" ON "waytara"."payments" FOR UPDATE USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "payments_customer_insert_own" ON "waytara"."payments" FOR INSERT WITH CHECK ((("customer_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."quotation_id" = "payments"."quotation_id") AND ("co"."customer_id" = "auth"."uid"()))))));



CREATE POLICY "payments_customer_own" ON "waytara"."payments" FOR SELECT USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "payments_employee_assigned" ON "waytara"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."quotation_id" = "payments"."quotation_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "payments_employee_insert_own_quotation" ON "waytara"."payments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "waytara"."quotations" "q"
  WHERE (("q"."id" = "payments"."quotation_id") AND ("q"."employee_id" = "auth"."uid"())))));



CREATE POLICY "payments_employee_update_own_quotation" ON "waytara"."payments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "waytara"."quotations" "q"
  WHERE (("q"."id" = "payments"."quotation_id") AND ("q"."employee_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "waytara"."quotations" "q"
  WHERE (("q"."id" = "payments"."quotation_id") AND ("q"."employee_id" = "auth"."uid"())))));



ALTER TABLE "waytara"."plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plans_read_all" ON "waytara"."plans" FOR SELECT USING (true);



CREATE POLICY "plans_write_admin" ON "waytara"."plans" USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



ALTER TABLE "waytara"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_self_or_admin" ON "waytara"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR "waytara"."is_admin"()));



CREATE POLICY "profiles_self_update" ON "waytara"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "waytara"."quotations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotations_admin_all" ON "waytara"."quotations" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "quotations_admin_insert" ON "waytara"."quotations" FOR INSERT WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "quotations_admin_update" ON "waytara"."quotations" FOR UPDATE USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "quotations_customer_own" ON "waytara"."quotations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."quotation_id" = "quotations"."id") AND ("co"."customer_id" = "auth"."uid"())))));



CREATE POLICY "quotations_employee_insert_own" ON "waytara"."quotations" FOR INSERT WITH CHECK (("employee_id" = "auth"."uid"()));



CREATE POLICY "quotations_employee_own" ON "waytara"."quotations" FOR SELECT USING (("employee_id" = "auth"."uid"()));



CREATE POLICY "quotations_employee_update_own" ON "waytara"."quotations" FOR UPDATE USING (("employee_id" = "auth"."uid"())) WITH CHECK (("employee_id" = "auth"."uid"()));



CREATE POLICY "readings_admin_all" ON "waytara"."equipment_telemetry" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "readings_employee_active_test_only" ON "waytara"."equipment_telemetry" FOR SELECT USING ((("is_test" = true) AND (EXISTS ( SELECT 1
   FROM ("waytara"."test_sessions" "ts"
     JOIN "waytara"."equipment" "d" ON (("d"."site_id" = "ts"."site_id")))
  WHERE (("d"."id" = "equipment_telemetry"."equipment_id") AND ("ts"."employee_id" = "auth"."uid"()) AND ("ts"."status" = 'running'::"waytara"."test_session_status"))))));



CREATE POLICY "readings_employee_delete_own_test" ON "waytara"."equipment_telemetry" FOR DELETE USING ((("is_test" = true) AND (EXISTS ( SELECT 1
   FROM ("waytara"."test_sessions" "ts"
     JOIN "waytara"."equipment" "d" ON (("d"."site_id" = "ts"."site_id")))
  WHERE (("d"."id" = "equipment_telemetry"."equipment_id") AND ("ts"."employee_id" = "auth"."uid"()) AND ("ts"."status" = 'running'::"waytara"."test_session_status"))))));



CREATE POLICY "readings_employee_insert_active_test" ON "waytara"."equipment_telemetry" FOR INSERT WITH CHECK ((("is_test" = true) AND (EXISTS ( SELECT 1
   FROM ("waytara"."test_sessions" "ts"
     JOIN "waytara"."equipment" "d" ON (("d"."site_id" = "ts"."site_id")))
  WHERE (("d"."id" = "equipment_telemetry"."equipment_id") AND ("ts"."employee_id" = "auth"."uid"()) AND ("ts"."status" = 'running'::"waytara"."test_session_status"))))));



CREATE POLICY "readings_owner" ON "waytara"."equipment_telemetry" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
  WHERE (("d"."id" = "equipment_telemetry"."equipment_id") AND ("s"."customer_id" = "auth"."uid"())))));



ALTER TABLE "waytara"."service_contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_contracts_admin_write" ON "waytara"."service_contracts" USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "service_contracts_customer_select" ON "waytara"."service_contracts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
  WHERE (("d"."id" = "service_contracts"."device_id") AND ("s"."customer_id" = "auth"."uid"())))));



CREATE POLICY "service_contracts_staff_select" ON "waytara"."service_contracts" FOR SELECT USING ("waytara"."is_staff"());



ALTER TABLE "waytara"."service_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_plans_admin_write" ON "waytara"."service_plans" USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "service_plans_staff_select" ON "waytara"."service_plans" FOR SELECT USING ("waytara"."is_staff"());



CREATE POLICY "settings_admin_all" ON "waytara"."equipment_configs" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "settings_employee_assigned" ON "waytara"."equipment_configs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("d"."id" = "equipment_configs"."equipment_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "settings_owner" ON "waytara"."equipment_configs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
  WHERE (("d"."id" = "equipment_configs"."equipment_id") AND ("s"."customer_id" = "auth"."uid"())))));



CREATE POLICY "settings_owner_insert" ON "waytara"."equipment_configs" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM ("waytara"."equipment" "d"
     JOIN "waytara"."sites" "s" ON (("s"."id" = "d"."site_id")))
  WHERE (("d"."id" = "equipment_configs"."equipment_id") AND ("s"."customer_id" = "auth"."uid"())))) AND (("written_by" IS NULL) OR ("written_by" = "auth"."uid"()))));



ALTER TABLE "waytara"."sites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sites_admin_all" ON "waytara"."sites" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "sites_admin_insert" ON "waytara"."sites" FOR INSERT WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "sites_admin_update" ON "waytara"."sites" FOR UPDATE USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "sites_customer_update_own" ON "waytara"."sites" FOR UPDATE USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "sites_employee_assigned" ON "waytara"."sites" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."customer_id" = "sites"."customer_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "sites_employee_insert_assigned" ON "waytara"."sites" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."customer_id" = "sites"."customer_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "sites_employee_update_assigned" ON "waytara"."sites" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."customer_id" = "sites"."customer_id") AND ("co"."employee_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."customer_id" = "sites"."customer_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "sites_owner" ON "waytara"."sites" FOR SELECT USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "stock_admin_write" ON "waytara"."equipment_inventory" USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "stock_customer_select" ON "waytara"."equipment_inventory" FOR SELECT USING (true);



CREATE POLICY "stock_staff_select" ON "waytara"."equipment_inventory" FOR SELECT USING ("waytara"."is_staff"());



ALTER TABLE "waytara"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_admin_all" ON "waytara"."subscriptions" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "subscriptions_owner_select" ON "waytara"."subscriptions" FOR SELECT USING (("customer_id" = "auth"."uid"()));



ALTER TABLE "waytara"."support_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_messages_admin_all" ON "waytara"."support_messages" USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "support_messages_customer_insert" ON "waytara"."support_messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "waytara"."support_tickets" "st"
  WHERE (("st"."id" = "support_messages"."ticket_id") AND ("st"."customer_id" = "auth"."uid"()))))));



CREATE POLICY "support_messages_customer_select" ON "waytara"."support_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "waytara"."support_tickets" "st"
  WHERE (("st"."id" = "support_messages"."ticket_id") AND ("st"."customer_id" = "auth"."uid"())))));



CREATE POLICY "support_messages_employee_assigned_insert" ON "waytara"."support_messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("waytara"."support_tickets" "st"
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "st"."customer_id")))
  WHERE (("st"."id" = "support_messages"."ticket_id") AND ("co"."employee_id" = "auth"."uid"()))))));



CREATE POLICY "support_messages_employee_assigned_select" ON "waytara"."support_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("waytara"."support_tickets" "st"
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "st"."customer_id")))
  WHERE (("st"."id" = "support_messages"."ticket_id") AND ("co"."employee_id" = "auth"."uid"())))));



ALTER TABLE "waytara"."support_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_tickets_admin_all" ON "waytara"."support_tickets" USING ("waytara"."is_admin"()) WITH CHECK ("waytara"."is_admin"());



CREATE POLICY "support_tickets_customer_own_insert" ON "waytara"."support_tickets" FOR INSERT WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "support_tickets_customer_own_select" ON "waytara"."support_tickets" FOR SELECT USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "support_tickets_customer_own_update" ON "waytara"."support_tickets" FOR UPDATE USING (("customer_id" = "auth"."uid"())) WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "support_tickets_employee_assigned_select" ON "waytara"."support_tickets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."customer_id" = "support_tickets"."customer_id") AND ("co"."employee_id" = "auth"."uid"())))));



CREATE POLICY "support_tickets_employee_assigned_update" ON "waytara"."support_tickets" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."customer_id" = "support_tickets"."customer_id") AND ("co"."employee_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "waytara"."customer_onboarding" "co"
  WHERE (("co"."customer_id" = "support_tickets"."customer_id") AND ("co"."employee_id" = "auth"."uid"())))));



ALTER TABLE "waytara"."test_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "test_sessions_admin_all" ON "waytara"."test_sessions" FOR SELECT USING ("waytara"."is_admin"());



CREATE POLICY "test_sessions_employee_insert_assigned" ON "waytara"."test_sessions" FOR INSERT WITH CHECK ((("employee_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("waytara"."sites" "s"
     JOIN "waytara"."customer_onboarding" "co" ON (("co"."customer_id" = "s"."customer_id")))
  WHERE (("s"."id" = "test_sessions"."site_id") AND ("co"."employee_id" = "auth"."uid"()))))));



CREATE POLICY "test_sessions_employee_own" ON "waytara"."test_sessions" FOR SELECT USING (("employee_id" = "auth"."uid"()));



CREATE POLICY "test_sessions_employee_update_own" ON "waytara"."test_sessions" FOR UPDATE USING (("employee_id" = "auth"."uid"())) WITH CHECK (("employee_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "waytara" TO "authenticated";
GRANT USAGE ON SCHEMA "waytara" TO "anon";
GRANT USAGE ON SCHEMA "waytara" TO "service_role";



GRANT ALL ON FUNCTION "waytara"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "waytara"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "waytara"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "waytara"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "waytara"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "waytara"."is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "waytara"."log_activity"() TO "anon";
GRANT ALL ON FUNCTION "waytara"."log_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "waytara"."log_activity"() TO "service_role";



GRANT ALL ON FUNCTION "waytara"."update_device_site"("p_device_id" "uuid", "p_name" "text", "p_property_type" "waytara"."property_type", "p_power_source_category" "waytara"."power_source_category", "p_address" "jsonb", "p_power_package" "waytara"."power_package", "p_latitude" numeric, "p_longitude" numeric) TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."alerts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."alerts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."audit_log" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."audit_log" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "waytara"."audit_log_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "waytara"."audit_log_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."customer_onboarding" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."customer_onboarding" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "waytara"."customers" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."customers" TO "service_role";



GRANT UPDATE("address") ON TABLE "waytara"."customers" TO "authenticated";



GRANT UPDATE("billing_email") ON TABLE "waytara"."customers" TO "authenticated";



GRANT UPDATE("tariff_rate_per_kwh") ON TABLE "waytara"."customers" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_telemetry" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_telemetry" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "waytara"."device_readings_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "waytara"."device_readings_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_configs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_configs" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "waytara"."device_settings_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "waytara"."device_settings_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."employee_invites" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."employee_invites" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "waytara"."equipment" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment" TO "service_role";



GRANT UPDATE("label") ON TABLE "waytara"."equipment" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_checks" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_checks" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_enum" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_enum" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_inventory" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_inventory" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_metrics" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_metrics" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_templates" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."equipment_templates" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."ev_sessions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."ev_sessions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."installations" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."installations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."leads" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."leads" TO "service_role";
GRANT INSERT ON TABLE "waytara"."leads" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."maintenance_tickets" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."maintenance_tickets" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."payments" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."payments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."plans" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."plans" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "waytara"."profiles" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."profiles" TO "service_role";



GRANT UPDATE("full_name") ON TABLE "waytara"."profiles" TO "authenticated";



GRANT UPDATE("phone") ON TABLE "waytara"."profiles" TO "authenticated";



GRANT UPDATE("avatar_url") ON TABLE "waytara"."profiles" TO "authenticated";



GRANT UPDATE("notification_preferences") ON TABLE "waytara"."profiles" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."quotations" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."quotations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."service_contracts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."service_contracts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."service_plans" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."service_plans" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "waytara"."sites" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."sites" TO "service_role";



GRANT UPDATE("name") ON TABLE "waytara"."sites" TO "authenticated";



GRANT UPDATE("property_type") ON TABLE "waytara"."sites" TO "authenticated";



GRANT UPDATE("power_source_category") ON TABLE "waytara"."sites" TO "authenticated";



GRANT UPDATE("address") ON TABLE "waytara"."sites" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."subscriptions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."subscriptions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."support_messages" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."support_messages" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."support_tickets" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."support_tickets" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."test_sessions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "waytara"."test_sessions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "waytara" GRANT SELECT,USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "waytara" GRANT SELECT,USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "waytara" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "waytara" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";




