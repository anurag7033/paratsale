export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expiry_date: string | null
          id: string
          minimum_purchase: number
          status: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expiry_date?: string | null
          id?: string
          minimum_purchase?: number
          status?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expiry_date?: string | null
          id?: string
          minimum_purchase?: number
          status?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string
          agent_id: string
          city: string
          created_at: string
          email: string | null
          id: string
          latitude: number | null
          location_accuracy: number | null
          location_captured_at: string | null
          longitude: number | null
          name: string
          phone: string
          pincode: string
          state: string
        }
        Insert: {
          address?: string
          agent_id: string
          city?: string
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          location_accuracy?: number | null
          location_captured_at?: string | null
          longitude?: number | null
          name: string
          phone: string
          pincode?: string
          state?: string
        }
        Update: {
          address?: string
          agent_id?: string
          city?: string
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          location_accuracy?: number | null
          location_captured_at?: string | null
          longitude?: number | null
          name?: string
          phone?: string
          pincode?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_agent_profile_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agent_id: string | null
          coupon_id: string | null
          created_at: string
          customer_id: string
          discount_amount: number
          final_amount: number
          id: string
          order_number: string
          order_status: string
          payment_method: string
          payment_status: string
          product_id: string
          purchase_link_id: string | null
          quantity: number
          shipping_address: string
          shipping_city: string
          shipping_latitude: number | null
          shipping_location_accuracy: number | null
          shipping_longitude: number | null
          shipping_pincode: string
          shipping_state: string
          total_amount: number
        }
        Insert: {
          agent_id?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id: string
          discount_amount?: number
          final_amount?: number
          id?: string
          order_number?: string
          order_status?: string
          payment_method?: string
          payment_status?: string
          product_id: string
          purchase_link_id?: string | null
          quantity?: number
          shipping_address?: string
          shipping_city?: string
          shipping_latitude?: number | null
          shipping_location_accuracy?: number | null
          shipping_longitude?: number | null
          shipping_pincode?: string
          shipping_state?: string
          total_amount?: number
        }
        Update: {
          agent_id?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string
          discount_amount?: number
          final_amount?: number
          id?: string
          order_number?: string
          order_status?: string
          payment_method?: string
          payment_status?: string
          product_id?: string
          purchase_link_id?: string | null
          quantity?: number
          shipping_address?: string
          shipping_city?: string
          shipping_latitude?: number | null
          shipping_location_accuracy?: number | null
          shipping_longitude?: number | null
          shipping_pincode?: string
          shipping_state?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_profile_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_purchase_link_id_fkey"
            columns: ["purchase_link_id"]
            isOneToOne: false
            referencedRelation: "purchase_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          payment_status: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_id: string
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          images: string[]
          name: string
          original_price: number
          selling_price: number
          slug: string
          specifications: Json
          status: string
          stock: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name: string
          original_price?: number
          selling_price?: number
          slug: string
          specifications?: Json
          status?: string
          stock?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name?: string
          original_price?: number
          selling_price?: number
          slug?: string
          specifications?: Json
          status?: string
          stock?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_id: string | null
          bpo_address: string | null
          bpo_city: string | null
          bpo_contact_person: string | null
          bpo_name: string | null
          bpo_pincode: string | null
          bpo_state: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          admin_id?: string | null
          bpo_address?: string | null
          bpo_city?: string | null
          bpo_contact_person?: string | null
          bpo_name?: string | null
          bpo_pincode?: string | null
          bpo_state?: string | null
          created_at?: string
          email?: string
          id: string
          name?: string
          phone?: string | null
          status?: string
        }
        Update: {
          admin_id?: string | null
          bpo_address?: string | null
          bpo_city?: string | null
          bpo_contact_person?: string | null
          bpo_name?: string | null
          bpo_pincode?: string | null
          bpo_state?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_links: {
        Row: {
          agent_id: string
          created_at: string
          customer_id: string
          id: string
          product_id: string
          status: string
          unique_token: string
          visits: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          customer_id: string
          id?: string
          product_id: string
          status?: string
          unique_token: string
          visits?: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string
          status?: string
          unique_token?: string
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_links_agent_profile_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_order: {
        Args: { _order_id: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      manages_user: {
        Args: { _admin: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "agent", "super_admin"],
    },
  },
} as const
