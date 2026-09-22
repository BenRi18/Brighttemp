// AUTO-GENERATED from the Brighttemp schema. Do not edit by hand.
// Regenerate:  supabase gen types typescript --local > lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          profile_id: string;
          admin_role: Database["public"]["Enums"]["admin_role"];
          permissions: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          admin_role?: Database["public"]["Enums"]["admin_role"];
          permissions?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          admin_role?: Database["public"]["Enums"]["admin_role"];
          permissions?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_users_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          actor_type: Database["public"]["Enums"]["actor_type"];
          action: string;
          entity_type: string;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          actor_type?: Database["public"]["Enums"]["actor_type"];
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          actor_type?: Database["public"]["Enums"]["actor_type"];
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bank_holidays: {
        Row: {
          holiday_date: string;
          name: string;
          region: string;
        };
        Insert: {
          holiday_date: string;
          name: string;
          region?: string;
        };
        Update: {
          holiday_date?: string;
          name?: string;
          region?: string;
        };
        Relationships: [];
      };
      booking_messages: {
        Row: {
          id: string;
          booking_id: string;
          sender_id: string;
          body: string;
          sent_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          booking_id: string;
          sender_id: string;
          body: string;
          sent_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          booking_id?: string;
          sender_id?: string;
          body?: string;
          sent_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_messages_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_status_history: {
        Row: {
          id: string;
          booking_id: string;
          from_status: Database["public"]["Enums"]["booking_status"] | null;
          to_status: Database["public"]["Enums"]["booking_status"];
          changed_by: string | null;
          actor: Database["public"]["Enums"]["actor_type"];
          reason: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          from_status?: Database["public"]["Enums"]["booking_status"] | null;
          to_status: Database["public"]["Enums"]["booking_status"];
          changed_by?: string | null;
          actor?: Database["public"]["Enums"]["actor_type"];
          reason?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          from_status?: Database["public"]["Enums"]["booking_status"] | null;
          to_status?: Database["public"]["Enums"]["booking_status"];
          changed_by?: string | null;
          actor?: Database["public"]["Enums"]["actor_type"];
          reason?: string | null;
          changed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          reference: string;
          practice_id: string;
          locum_id: string;
          role_id: string;
          booking_date: string;
          start_time: string;
          finish_time: string;
          hours: number | null;
          locum_hourly_rate: number;
          locum_total: number | null;
          fee_day_type: Database["public"]["Enums"]["day_type"];
          booking_fee: number;
          same_day_surcharge: number;
          is_same_day: boolean;
          status: Database["public"]["Enums"]["booking_status"];
          requires_admin_approval: boolean;
          notes: string | null;
          created_by: string | null;
          requested_at: string;
          accepted_at: string | null;
          confirmed_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          practice_id: string;
          locum_id: string;
          role_id: string;
          booking_date: string;
          start_time: string;
          finish_time: string;
          locum_hourly_rate: number;
          fee_day_type: Database["public"]["Enums"]["day_type"];
          booking_fee: number;
          same_day_surcharge?: number;
          is_same_day?: boolean;
          status?: Database["public"]["Enums"]["booking_status"];
          requires_admin_approval?: boolean;
          notes?: string | null;
          created_by?: string | null;
          requested_at?: string;
          accepted_at?: string | null;
          confirmed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference?: string;
          practice_id?: string;
          locum_id?: string;
          role_id?: string;
          booking_date?: string;
          start_time?: string;
          finish_time?: string;
          locum_hourly_rate?: number;
          fee_day_type?: Database["public"]["Enums"]["day_type"];
          booking_fee?: number;
          same_day_surcharge?: number;
          is_same_day?: boolean;
          status?: Database["public"]["Enums"]["booking_status"];
          requires_admin_approval?: boolean;
          notes?: string | null;
          created_by?: string | null;
          requested_at?: string;
          accepted_at?: string | null;
          confirmed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_locum_id_fkey";
            columns: ["locum_id"];
            isOneToOne: false;
            referencedRelation: "locums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_practice_id_fkey";
            columns: ["practice_id"];
            isOneToOne: false;
            referencedRelation: "practices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      cancellations: {
        Row: {
          id: string;
          booking_id: string;
          cancelled_by: string | null;
          cancelled_by_type: Database["public"]["Enums"]["actor_type"];
          cancelled_at: string;
          notice_hours: number;
          reason: string | null;
          cancellation_fee: number;
          fee_waived: boolean;
          waived_by: string | null;
          notifications_sent_at: string | null;
        };
        Insert: {
          id?: string;
          booking_id: string;
          cancelled_by?: string | null;
          cancelled_by_type: Database["public"]["Enums"]["actor_type"];
          cancelled_at?: string;
          notice_hours: number;
          reason?: string | null;
          cancellation_fee?: number;
          fee_waived?: boolean;
          waived_by?: string | null;
          notifications_sent_at?: string | null;
        };
        Update: {
          id?: string;
          booking_id?: string;
          cancelled_by?: string | null;
          cancelled_by_type?: Database["public"]["Enums"]["actor_type"];
          cancelled_at?: string;
          notice_hours?: number;
          reason?: string | null;
          cancellation_fee?: number;
          fee_waived?: boolean;
          waived_by?: string | null;
          notifications_sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cancellations_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cancellations_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cancellations_waived_by_fkey";
            columns: ["waived_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_documents: {
        Row: {
          id: string;
          locum_id: string;
          doc_type: Database["public"]["Enums"]["compliance_doc_type"];
          storage_path: string;
          original_filename: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          issue_date: string | null;
          expiry_date: string | null;
          reference: string | null;
          status: Database["public"]["Enums"]["compliance_status"];
          is_current: boolean;
          uploaded_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          rejection_reason: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          locum_id: string;
          doc_type: Database["public"]["Enums"]["compliance_doc_type"];
          storage_path: string;
          original_filename?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          reference?: string | null;
          status?: Database["public"]["Enums"]["compliance_status"];
          is_current?: boolean;
          uploaded_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          locum_id?: string;
          doc_type?: Database["public"]["Enums"]["compliance_doc_type"];
          storage_path?: string;
          original_filename?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          reference?: string | null;
          status?: Database["public"]["Enums"]["compliance_status"];
          is_current?: boolean;
          uploaded_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_documents_locum_id_fkey";
            columns: ["locum_id"];
            isOneToOne: false;
            referencedRelation: "locums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compliance_documents_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_requirements: {
        Row: {
          id: string;
          role_id: string;
          doc_type: Database["public"]["Enums"]["compliance_doc_type"];
          is_mandatory: boolean;
          requires_expiry: boolean;
          expiry_warning_days: number;
        };
        Insert: {
          id?: string;
          role_id: string;
          doc_type: Database["public"]["Enums"]["compliance_doc_type"];
          is_mandatory?: boolean;
          requires_expiry?: boolean;
          expiry_warning_days?: number;
        };
        Update: {
          id?: string;
          role_id?: string;
          doc_type?: Database["public"]["Enums"]["compliance_doc_type"];
          is_mandatory?: boolean;
          requires_expiry?: boolean;
          expiry_warning_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_requirements_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      favourite_locums: {
        Row: {
          practice_id: string;
          locum_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          practice_id: string;
          locum_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          practice_id?: string;
          locum_id?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favourite_locums_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favourite_locums_locum_id_fkey";
            columns: ["locum_id"];
            isOneToOne: false;
            referencedRelation: "locums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favourite_locums_practice_id_fkey";
            columns: ["practice_id"];
            isOneToOne: false;
            referencedRelation: "practices";
            referencedColumns: ["id"];
          },
        ];
      };
      fees: {
        Row: {
          id: string;
          fee_type: Database["public"]["Enums"]["fee_type"];
          role_id: string | null;
          day_type: Database["public"]["Enums"]["day_type"] | null;
          amount: number;
          notice_hours_below: number | null;
          effective_from: string;
          effective_to: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fee_type: Database["public"]["Enums"]["fee_type"];
          role_id?: string | null;
          day_type?: Database["public"]["Enums"]["day_type"] | null;
          amount: number;
          notice_hours_below?: number | null;
          effective_from?: string;
          effective_to?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          fee_type?: Database["public"]["Enums"]["fee_type"];
          role_id?: string | null;
          day_type?: Database["public"]["Enums"]["day_type"] | null;
          amount?: number;
          notice_hours_below?: number | null;
          effective_from?: string;
          effective_to?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fees_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fees_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          practice_id: string;
          booking_id: string | null;
          issue_date: string;
          due_date: string;
          subtotal: number;
          vat_rate: number;
          vat_amount: number;
          total: number | null;
          status: Database["public"]["Enums"]["invoice_status"];
          sent_at: string | null;
          paid_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number?: string;
          practice_id: string;
          booking_id?: string | null;
          issue_date?: string;
          due_date: string;
          subtotal: number;
          vat_rate?: number;
          vat_amount?: number;
          status?: Database["public"]["Enums"]["invoice_status"];
          sent_at?: string | null;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          practice_id?: string;
          booking_id?: string | null;
          issue_date?: string;
          due_date?: string;
          subtotal?: number;
          vat_rate?: number;
          vat_amount?: number;
          status?: Database["public"]["Enums"]["invoice_status"];
          sent_at?: string | null;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_practice_id_fkey";
            columns: ["practice_id"];
            isOneToOne: false;
            referencedRelation: "practices";
            referencedColumns: ["id"];
          },
        ];
      };
      locum_availability: {
        Row: {
          id: string;
          locum_id: string;
          available_on: string;
          is_available: boolean;
          start_time: string | null;
          finish_time: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          locum_id: string;
          available_on: string;
          is_available?: boolean;
          start_time?: string | null;
          finish_time?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          locum_id?: string;
          available_on?: string;
          is_available?: boolean;
          start_time?: string | null;
          finish_time?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locum_availability_locum_id_fkey";
            columns: ["locum_id"];
            isOneToOne: false;
            referencedRelation: "locums";
            referencedColumns: ["id"];
          },
        ];
      };
      locum_rates: {
        Row: {
          id: string;
          locum_id: string;
          day_type: Database["public"]["Enums"]["day_type"];
          hourly_rate: number;
          status: Database["public"]["Enums"]["rate_status"];
          effective_from: string;
          effective_to: string | null;
          requested_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          review_note: string | null;
        };
        Insert: {
          id?: string;
          locum_id: string;
          day_type: Database["public"]["Enums"]["day_type"];
          hourly_rate: number;
          status?: Database["public"]["Enums"]["rate_status"];
          effective_from?: string;
          effective_to?: string | null;
          requested_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string | null;
        };
        Update: {
          id?: string;
          locum_id?: string;
          day_type?: Database["public"]["Enums"]["day_type"];
          hourly_rate?: number;
          status?: Database["public"]["Enums"]["rate_status"];
          effective_from?: string;
          effective_to?: string | null;
          requested_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "locum_rates_locum_id_fkey";
            columns: ["locum_id"];
            isOneToOne: false;
            referencedRelation: "locums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locum_rates_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      locums: {
        Row: {
          id: string;
          profile_id: string;
          role_id: string;
          gdc_number: string | null;
          gdc_expiry: string | null;
          years_experience: number;
          bio: string | null;
          specialisms: string[];
          base_postcode: string;
          latitude: number | null;
          longitude: number | null;
          travel_radius_miles: number;
          status: Database["public"]["Enums"]["account_status"];
          is_bookable: boolean;
          approved_at: string | null;
          approved_by: string | null;
          suspended_at: string | null;
          suspension_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          role_id: string;
          gdc_number?: string | null;
          gdc_expiry?: string | null;
          years_experience?: number;
          bio?: string | null;
          specialisms?: string[];
          base_postcode: string;
          latitude?: number | null;
          longitude?: number | null;
          travel_radius_miles?: number;
          status?: Database["public"]["Enums"]["account_status"];
          is_bookable?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          suspended_at?: string | null;
          suspension_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          role_id?: string;
          gdc_number?: string | null;
          gdc_expiry?: string | null;
          years_experience?: number;
          bio?: string | null;
          specialisms?: string[];
          base_postcode?: string;
          latitude?: number | null;
          longitude?: number | null;
          travel_radius_miles?: number;
          status?: Database["public"]["Enums"]["account_status"];
          is_bookable?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          suspended_at?: string | null;
          suspension_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locums_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locums_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locums_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string | null;
          event: Database["public"]["Enums"]["notification_event"];
          channel: Database["public"]["Enums"]["notification_channel"];
          recipient: string;
          subject: string | null;
          body: string | null;
          payload: Json;
          booking_id: string | null;
          invoice_id: string | null;
          document_id: string | null;
          status: Database["public"]["Enums"]["notification_status"];
          provider_message_id: string | null;
          error: string | null;
          scheduled_for: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          event: Database["public"]["Enums"]["notification_event"];
          channel?: Database["public"]["Enums"]["notification_channel"];
          recipient: string;
          subject?: string | null;
          body?: string | null;
          payload?: Json;
          booking_id?: string | null;
          invoice_id?: string | null;
          document_id?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          provider_message_id?: string | null;
          error?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          event?: Database["public"]["Enums"]["notification_event"];
          channel?: Database["public"]["Enums"]["notification_channel"];
          recipient?: string;
          subject?: string | null;
          body?: string | null;
          payload?: Json;
          booking_id?: string | null;
          invoice_id?: string | null;
          document_id?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          provider_message_id?: string | null;
          error?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "compliance_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          amount: number;
          paid_at: string;
          method: Database["public"]["Enums"]["payment_method"];
          reference: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          amount: number;
          paid_at?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          reference?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          amount?: number;
          paid_at?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          reference?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      practice_users: {
        Row: {
          id: string;
          practice_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["practice_user_role"];
          is_primary: boolean;
          invited_at: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          practice_id: string;
          profile_id: string;
          role?: Database["public"]["Enums"]["practice_user_role"];
          is_primary?: boolean;
          invited_at?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          practice_id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["practice_user_role"];
          is_primary?: boolean;
          invited_at?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_users_practice_id_fkey";
            columns: ["practice_id"];
            isOneToOne: false;
            referencedRelation: "practices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practice_users_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      practices: {
        Row: {
          id: string;
          name: string;
          trading_name: string | null;
          address_line1: string;
          address_line2: string | null;
          city: string;
          postcode: string;
          latitude: number | null;
          longitude: number | null;
          phone: string | null;
          email: string | null;
          cqc_provider_id: string | null;
          status: Database["public"]["Enums"]["account_status"];
          trust_level: Database["public"]["Enums"]["trust_level"];
          billing_email: string | null;
          billing_address: string | null;
          vat_number: string | null;
          payment_terms_days: number;
          purchase_order_required: boolean;
          approved_at: string | null;
          approved_by: string | null;
          suspended_at: string | null;
          suspension_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          trading_name?: string | null;
          address_line1: string;
          address_line2?: string | null;
          city: string;
          postcode: string;
          latitude?: number | null;
          longitude?: number | null;
          phone?: string | null;
          email?: string | null;
          cqc_provider_id?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          trust_level?: Database["public"]["Enums"]["trust_level"];
          billing_email?: string | null;
          billing_address?: string | null;
          vat_number?: string | null;
          payment_terms_days?: number;
          purchase_order_required?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          suspended_at?: string | null;
          suspension_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          trading_name?: string | null;
          address_line1?: string;
          address_line2?: string | null;
          city?: string;
          postcode?: string;
          latitude?: number | null;
          longitude?: number | null;
          phone?: string | null;
          email?: string | null;
          cqc_provider_id?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          trust_level?: Database["public"]["Enums"]["trust_level"];
          billing_email?: string | null;
          billing_address?: string | null;
          vat_number?: string | null;
          payment_terms_days?: number;
          purchase_order_required?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          suspended_at?: string | null;
          suspension_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practices_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          user_type: Database["public"]["Enums"]["user_type"];
          full_name: string;
          email: string;
          phone: string | null;
          whatsapp_opt_in: boolean;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_type: Database["public"]["Enums"]["user_type"];
          full_name: string;
          email: string;
          phone?: string | null;
          whatsapp_opt_in?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_type?: Database["public"]["Enums"]["user_type"];
          full_name?: string;
          email?: string;
          phone?: string | null;
          whatsapp_opt_in?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          id: string;
          slug: string;
          name: string;
          requires_gdc: boolean;
          is_active: boolean;
          sort_order: number;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          requires_gdc?: boolean;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          requires_gdc?: boolean;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      booking_costs: {
        Row: {
          booking_id: string | null;
          reference: string | null;
          paid_to_locum: number | null;
          paid_to_brighttemp: number | null;
          total_practice_cost: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      search_locums: {
        Args: {
          p_role_id: string;
          p_date: string;
          p_start: string;
          p_finish: string;
          p_latitude: number;
          p_longitude: number;
          p_max_miles?: number;
          p_min_years?: number;
        };
        Returns: {
          locum_id: string;
          full_name: string;
          years_experience: number;
          distance_miles: number;
          hourly_rate: number;
          locum_total: number;
          booking_fee: number;
          total_practice_cost: number;
        }[];
        Relationships: [];
      };
      cancel_booking: {
        Args: {
          p_booking_id: string;
          p_actor: string | null;
          p_actor_type: Database["public"]["Enums"]["actor_type"];
          p_reason: string | null;
        };
        Returns: string;
        Relationships: [];
      };
      current_booking_fee: {
        Args: { p_role_id: string; p_date: string };
        Returns: number;
        Relationships: [];
      };
      day_type_for: {
        Args: { p_date: string };
        Returns: Database["public"]["Enums"]["day_type"];
        Relationships: [];
      };
      refresh_compliance_statuses: {
        Args: Record<string, never>;
        Returns: number;
      };
      locum_compliance_ok: {
        Args: { p_locum_id: string };
        Returns: boolean;
        Relationships: [];
      };
    };
    CompositeTypes: {
      [_ in never]: never;
    };
    Enums: {
      account_status: "pending" | "approved" | "rejected" | "suspended";
      actor_type: "practice" | "locum" | "admin" | "system";
      admin_role: "super_admin" | "operations" | "compliance" | "finance";
      booking_status: "requested" | "accepted" | "confirmed" | "completed" | "cancelled" | "disputed";
      compliance_doc_type: "gdc_registration" | "dbs" | "indemnity_insurance" | "hepatitis_b" | "cpr_certificate" | "infection_control";
      compliance_status: "pending" | "under_review" | "approved" | "expiring_soon" | "expired" | "rejected";
      day_type: "weekday" | "weekend" | "bank_holiday";
      fee_type: "booking" | "same_day_surcharge" | "cancellation";
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
      notification_channel: "email" | "whatsapp" | "in_app";
      notification_event: "registration_received" | "account_approved" | "account_rejected" | "booking_requested" | "booking_accepted" | "booking_declined" | "booking_confirmed" | "booking_cancelled" | "booking_reminder" | "invoice_issued" | "invoice_reminder" | "invoice_overdue" | "compliance_expiring" | "compliance_expired" | "compliance_rejected" | "rate_change_requested" | "rate_change_approved" | "same_day_booking";
      notification_status: "queued" | "sent" | "failed" | "suppressed";
      payment_method: "bank_transfer" | "card" | "direct_debit" | "other";
      practice_user_role: "owner" | "manager" | "staff";
      rate_status: "pending" | "approved" | "rejected" | "superseded";
      trust_level: "new" | "trusted";
      user_type: "practice" | "locum" | "admin";
    };
  };
};

// ---- convenience aliases -------------------------------------------------

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type InsertDto<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type UpdateDto<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export type Profile   = Tables<"profiles">;
export type Practice  = Tables<"practices">;
export type Locum     = Tables<"locums">;
export type Booking   = Tables<"bookings">;
export type Invoice   = Tables<"invoices">;
export type ComplianceDocument = Tables<"compliance_documents">;

export type UserType       = Enums<"user_type">;
export type AccountStatus  = Enums<"account_status">;
export type BookingStatus  = Enums<"booking_status">;
export type AdminRole      = Enums<"admin_role">;
export type SearchResult   =
  Database["public"]["Functions"]["search_locums"]["Returns"][number];
