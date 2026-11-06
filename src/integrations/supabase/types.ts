export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_insights: {
        Row: {
          action_label: string | null;
          body: string;
          business_id: string;
          confidence: number;
          created_at: string;
          id: string;
          title: string;
          type: Database["public"]["Enums"]["insight_type"];
          updated_at: string;
        };
        Insert: {
          action_label?: string | null;
          body: string;
          business_id: string;
          confidence?: number;
          created_at?: string;
          id?: string;
          title: string;
          type: Database["public"]["Enums"]["insight_type"];
          updated_at?: string;
        };
        Update: {
          action_label?: string | null;
          body?: string;
          business_id?: string;
          confidence?: number;
          created_at?: string;
          id?: string;
          title?: string;
          type?: Database["public"]["Enums"]["insight_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_insights_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_members: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["business_member_role"];
          user_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["business_member_role"];
          user_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["business_member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          ai_tone: string;
          business_category: string | null;
          category: string;
          city: string | null;
          created_at: string;
          currency: string;
          email: string | null;
          id: string;
          legal_name: string | null;
          logo: string | null;
          address: string | null;
          name: string;
          owner_id: string;
          phone: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          ai_tone?: string;
          business_category?: string | null;
          category?: string;
          city?: string | null;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          logo?: string | null;
          address?: string | null;
          name: string;
          owner_id: string;
          phone?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          ai_tone?: string;
          business_category?: string | null;
          category?: string;
          city?: string | null;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          logo?: string | null;
          address?: string | null;
          name?: string;
          owner_id?: string;
          phone?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          ai_insight: string | null;
          business_id: string;
          created_at: string;
          email: string | null;
          favorite_product: string | null;
          id: string;
          name: string;
          phone: string | null;
          total_spend: number;
          updated_at: string;
          visits: number;
        };
        Insert: {
          ai_insight?: string | null;
          business_id: string;
          created_at?: string;
          email?: string | null;
          favorite_product?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          total_spend?: number;
          updated_at?: string;
          visits?: number;
        };
        Update: {
          ai_insight?: string | null;
          business_id?: string;
          created_at?: string;
          email?: string | null;
          favorite_product?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          total_spend?: number;
          updated_at?: string;
          visits?: number;
        };
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          active: boolean;
          ai_alert: string | null;
          business_id: string;
          category: string;
          cost_price: number;
          created_at: string;
          health_score: number;
          id: string;
          minimum_stock: number;
          name: string;
          predicted_empty_at: string | null;
          selling_price: number;
          stock: number;
          supplier_id: string | null;
          unit: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          ai_alert?: string | null;
          business_id: string;
          category: string;
          cost_price?: number;
          created_at?: string;
          health_score?: number;
          id?: string;
          minimum_stock?: number;
          name: string;
          predicted_empty_at?: string | null;
          selling_price?: number;
          stock?: number;
          supplier_id?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          ai_alert?: string | null;
          business_id?: string;
          category?: string;
          cost_price?: number;
          created_at?: string;
          health_score?: number;
          id?: string;
          minimum_stock?: number;
          name?: string;
          predicted_empty_at?: string | null;
          selling_price?: number;
          stock?: number;
          supplier_id?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      outlets: {
        Row: {
          active: boolean;
          address: string | null;
          business_id: string;
          code: string | null;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          settings: Json | null;
          timezone: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          business_id: string;
          code?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string | null;
          settings?: Json | null;
          timezone?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          business_id?: string;
          code?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          settings?: Json | null;
          timezone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outlets_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          ai_badge: string | null;
          barcode: string | null;
          business_id: string;
          category: string | null;
          category_id: string | null;
          cost_price: number;
          created_at: string;
          crop_x: number | null;
          crop_y: number | null;
          description: string | null;
          has_recipe: boolean | null;
          has_variants: boolean | null;
          id: string;
          image_aspect_ratio: string | null;
          image_crop_position: Json | null;
          image_position_x: number | null;
          image_position_y: number | null;
          image_rotation: number | null;
          image_url: string | null;
          image_zoom: number | null;
          name: string;
          price: number;
          promo_price: number | null;
          rotation: number | null;
          selling_price: number;
          sku: string | null;
          stock: number;
          tax_rate: number;
          updated_at: string;
          zoom: number | null;
        };
        Insert: {
          active?: boolean;
          ai_badge?: string | null;
          barcode?: string | null;
          business_id: string;
          category?: string | null;
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          crop_x?: number | null;
          crop_y?: number | null;
          description?: string | null;
          has_recipe?: boolean | null;
          has_variants?: boolean | null;
          id?: string;
          image_aspect_ratio?: string | null;
          image_crop_position?: Json | null;
          image_position_x?: number | null;
          image_position_y?: number | null;
          image_rotation?: number | null;
          image_url?: string | null;
          image_zoom?: number | null;
          name: string;
          price?: number;
          promo_price?: number | null;
          rotation?: number | null;
          selling_price?: number;
          sku?: string | null;
          stock?: number;
          tax_rate?: number;
          updated_at?: string;
          zoom?: number | null;
        };
        Update: {
          active?: boolean;
          ai_badge?: string | null;
          barcode?: string | null;
          business_id?: string;
          category?: string | null;
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          crop_x?: number | null;
          crop_y?: number | null;
          description?: string | null;
          has_recipe?: boolean | null;
          has_variants?: boolean | null;
          id?: string;
          image_aspect_ratio?: string | null;
          image_crop_position?: Json | null;
          image_position_x?: number | null;
          image_position_y?: number | null;
          image_rotation?: number | null;
          image_url?: string | null;
          image_zoom?: number | null;
          name?: string;
          price?: number;
          promo_price?: number | null;
          rotation?: number | null;
          selling_price?: number;
          sku?: string | null;
          stock?: number;
          tax_rate?: number;
          updated_at?: string;
          zoom?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_categories: {
        Row: {
          active: boolean;
          business_id: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_system: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          business_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_system?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          business_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_system?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_categories_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          active: boolean;
          barcode: string | null;
          business_id: string;
          category: string | null;
          category_id: string | null;
          cost_price: number;
          created_at: string;
          crop_x: number | null;
          crop_y: number | null;
          description: string | null;
          has_recipe: boolean | null;
          has_variants: boolean | null;
          id: string;
          image_aspect_ratio: string | null;
          image_crop_position: Json | null;
          image_position_x: number | null;
          image_position_y: number | null;
          image_rotation: number | null;
          image_url: string | null;
          image_zoom: number | null;
          name: string;
          price: number;
          promo_price: number | null;
          rotation: number | null;
          selling_price: number;
          sku: string | null;
          stock: number;
          tax_rate: number;
          updated_at: string;
          zoom: number | null;
        };
        Insert: {
          active?: boolean;
          barcode?: string | null;
          business_id: string;
          category?: string | null;
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          crop_x?: number | null;
          crop_y?: number | null;
          description?: string | null;
          has_recipe?: boolean | null;
          has_variants?: boolean | null;
          id?: string;
          image_aspect_ratio?: string | null;
          image_crop_position?: Json | null;
          image_position_x?: number | null;
          image_position_y?: number | null;
          image_rotation?: number | null;
          image_url?: string | null;
          image_zoom?: number | null;
          name: string;
          price?: number;
          promo_price?: number | null;
          rotation?: number | null;
          selling_price?: number;
          sku?: string | null;
          stock?: number;
          tax_rate?: number;
          updated_at?: string;
          zoom?: number | null;
        };
        Update: {
          active?: boolean;
          barcode?: string | null;
          business_id?: string;
          category?: string | null;
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          crop_x?: number | null;
          crop_y?: number | null;
          description?: string | null;
          has_recipe?: boolean | null;
          has_variants?: boolean | null;
          id?: string;
          image_aspect_ratio?: string | null;
          image_crop_position?: Json | null;
          image_position_x?: number | null;
          image_position_y?: number | null;
          image_rotation?: number | null;
          image_url?: string | null;
          image_zoom?: number | null;
          name?: string;
          price?: number;
          promo_price?: number | null;
          rotation?: number | null;
          selling_price?: number;
          sku?: string | null;
          stock?: number;
          tax_rate?: number;
          updated_at?: string;
          zoom?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_variant_groups: {
        Row: {
          active: boolean;
          business_id: string;
          created_at: string;
          id: string;
          is_required: boolean;
          max_selection: number;
          menu_item_id: string;
          min_selection: number;
          name: string;
          product_id: string | null;
          selection_type: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          business_id: string;
          created_at?: string;
          id?: string;
          is_required?: boolean;
          max_selection?: number;
          menu_item_id: string;
          min_selection?: number;
          name: string;
          product_id?: string | null;
          selection_type?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          business_id?: string;
          created_at?: string;
          id?: string;
          is_required?: boolean;
          max_selection?: number;
          menu_item_id?: string;
          min_selection?: number;
          name?: string;
          product_id?: string | null;
          selection_type?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_variant_groups_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_variant_options: {
        Row: {
          active: boolean;
          additional_price: number;
          cost_price: number;
          created_at: string;
          group_id: string;
          id: string;
          image_url: string | null;
          is_default: boolean;
          name: string;
          price_adjustment: number;
          selling_price: number;
          sku: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          additional_price?: number;
          cost_price?: number;
          created_at?: string;
          group_id: string;
          id?: string;
          image_url?: string | null;
          is_default?: boolean;
          name: string;
          price_adjustment?: number;
          selling_price?: number;
          sku?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          additional_price?: number;
          cost_price?: number;
          created_at?: string;
          group_id?: string;
          id?: string;
          image_url?: string | null;
          is_default?: boolean;
          name?: string;
          price_adjustment?: number;
          selling_price?: number;
          sku?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_variant_options_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "menu_variant_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_recipes: {
        Row: {
          business_id: string;
          cost_per_portion: number;
          created_at: string;
          id: string;
          menu_item_id: string;
          name: string;
          notes: string | null;
          product_id: string | null;
          total_cost: number;
          updated_at: string;
          yield_portions: number;
        };
        Insert: {
          business_id: string;
          cost_per_portion?: number;
          created_at?: string;
          id?: string;
          menu_item_id: string;
          name: string;
          notes?: string | null;
          product_id?: string | null;
          total_cost?: number;
          updated_at?: string;
          yield_portions?: number;
        };
        Update: {
          business_id?: string;
          cost_per_portion?: number;
          created_at?: string;
          id?: string;
          menu_item_id?: string;
          name?: string;
          notes?: string | null;
          product_id?: string | null;
          total_cost?: number;
          updated_at?: string;
          yield_portions?: number;
        };
        Relationships: [
          {
            foreignKeyName: "menu_recipes_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          business_id: string;
          cost_per_portion: number;
          created_at: string;
          id: string;
          menu_item_id: string | null;
          name: string;
          notes: string | null;
          product_id: string | null;
          total_cost: number;
          updated_at: string;
          yield_portions: number;
        };
        Insert: {
          business_id: string;
          cost_per_portion?: number;
          created_at?: string;
          id?: string;
          menu_item_id?: string | null;
          name: string;
          notes?: string | null;
          product_id?: string | null;
          total_cost?: number;
          updated_at?: string;
          yield_portions?: number;
        };
        Update: {
          business_id?: string;
          cost_per_portion?: number;
          created_at?: string;
          id?: string;
          menu_item_id?: string | null;
          name?: string;
          notes?: string | null;
          product_id?: string | null;
          total_cost?: number;
          updated_at?: string;
          yield_portions?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_items: {
        Row: {
          cost_estimate: number;
          cost_per_unit: number;
          created_at: string;
          id: string;
          ingredient_id: string | null;
          ingredient_name: string;
          inventory_item_id: string | null;
          quantity: number;
          recipe_id: string;
          unit: string;
          updated_at: string;
        };
        Insert: {
          cost_estimate?: number;
          cost_per_unit?: number;
          created_at?: string;
          id?: string;
          ingredient_id?: string | null;
          ingredient_name: string;
          inventory_item_id?: string | null;
          quantity?: number;
          recipe_id: string;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          cost_estimate?: number;
          cost_per_unit?: number;
          created_at?: string;
          id?: string;
          ingredient_id?: string | null;
          ingredient_name?: string;
          inventory_item_id?: string | null;
          quantity?: number;
          recipe_id?: string;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_items_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "menu_recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredients: {
        Row: {
          active: boolean;
          business_id: string;
          category: string;
          cost_price: number;
          created_at: string;
          id: string;
          minimum_stock: number;
          name: string;
          selling_price: number;
          stock: number;
          supplier_id: string | null;
          unit: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          business_id: string;
          category?: string;
          cost_price?: number;
          created_at?: string;
          id?: string;
          minimum_stock?: number;
          name: string;
          selling_price?: number;
          stock?: number;
          supplier_id?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          business_id?: string;
          category?: string;
          cost_price?: number;
          created_at?: string;
          id?: string;
          minimum_stock?: number;
          name?: string;
          selling_price?: number;
          stock?: number;
          supplier_id?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      outlet_menu_items: {
        Row: {
          available: boolean;
          cost_price: number | null;
          created_at: string;
          id: string;
          menu_item_id: string | null;
          outlet_id: string;
          product_id: string | null;
          selling_price: number | null;
          stock: number;
          updated_at: string;
        };
        Insert: {
          available?: boolean;
          cost_price?: number | null;
          created_at?: string;
          id?: string;
          menu_item_id?: string | null;
          outlet_id: string;
          product_id?: string | null;
          selling_price?: number | null;
          stock?: number;
          updated_at?: string;
        };
        Update: {
          available?: boolean;
          cost_price?: number | null;
          created_at?: string;
          id?: string;
          menu_item_id?: string | null;
          outlet_id?: string;
          product_id?: string | null;
          selling_price?: number | null;
          stock?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outlet_menu_items_outlet_id_fkey";
            columns: ["outlet_id"];
            isOneToOne: false;
            referencedRelation: "outlets";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          language: string;
          phone: string | null;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          language?: string;
          phone?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          language?: string;
          phone?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      qris_transactions: {
        Row: {
          id: string;
          business_id: string;
          outlet_id: string | null;
          order_id: string | null;
          order_number: string;
          external_reference_id: string;
          amount: number;
          qris_payload: string;
          status: string;
          customer_name: string | null;
          payment_time: string | null;
          settlement_reference: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          outlet_id?: string | null;
          order_id?: string | null;
          order_number: string;
          external_reference_id: string;
          amount: number;
          qris_payload: string;
          status?: string;
          customer_name?: string | null;
          payment_time?: string | null;
          settlement_reference?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          outlet_id?: string | null;
          order_id?: string | null;
          order_number?: string;
          external_reference_id?: string;
          amount?: number;
          qris_payload?: string;
          status?: string;
          customer_name?: string | null;
          payment_time?: string | null;
          settlement_reference?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qris_transactions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qris_transactions_outlet_id_fkey";
            columns: ["outlet_id"];
            isOneToOne: false;
            referencedRelation: "outlets";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_order_items: {
        Row: {
          created_at: string;
          final_price: number | null;
          id: string;
          name: string;
          notes: string | null;
          order_id: string;
          product_id: string | null;
          quantity: number;
          selected_options: Json | null;
          subtotal: number;
          unit_price: number;
          variant_name: string | null;
        };
        Insert: {
          created_at?: string;
          final_price?: number | null;
          id?: string;
          name: string;
          notes?: string | null;
          order_id: string;
          product_id?: string | null;
          quantity?: number;
          selected_options?: Json | null;
          subtotal?: number;
          unit_price?: number;
          variant_name?: string | null;
        };
        Update: {
          created_at?: string;
          final_price?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          order_id?: string;
          product_id?: string | null;
          quantity?: number;
          selected_options?: Json | null;
          subtotal?: number;
          unit_price?: number;
          variant_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_orders: {
        Row: {
          business_id: string;
          channel: string;
          created_at: string;
          customer_id: string | null;
          id: string;
          order_number: string;
          outlet_id: string | null;
          paid_at: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"];
          status: Database["public"]["Enums"]["order_status"];
          total: number;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          channel?: string;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          order_number: string;
          outlet_id?: string | null;
          paid_at?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          status?: Database["public"]["Enums"]["order_status"];
          total?: number;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          channel?: string;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          order_number?: string;
          outlet_id?: string | null;
          paid_at?: string | null;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          status?: Database["public"]["Enums"]["order_status"];
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_orders_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      staff_profiles: {
        Row: {
          absence_deduction: number;
          address: string | null;
          avatar_url: string | null;
          base_salary: number;
          business_id: string;
          created_at: string;
          daily_allowance: number;
          employment_status: string;
          full_name: string;
          id: string;
          job_title: string;
          join_date: string;
          late_deduction: number;
          outlet_id: string | null;
          phone: string | null;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          absence_deduction?: number;
          address?: string | null;
          avatar_url?: string | null;
          base_salary?: number;
          business_id: string;
          created_at?: string;
          daily_allowance?: number;
          employment_status?: string;
          full_name: string;
          id?: string;
          job_title?: string;
          join_date?: string;
          late_deduction?: number;
          outlet_id?: string | null;
          phone?: string | null;
          role?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          absence_deduction?: number;
          address?: string | null;
          avatar_url?: string | null;
          base_salary?: number;
          business_id?: string;
          created_at?: string;
          daily_allowance?: number;
          employment_status?: string;
          full_name?: string;
          id?: string;
          job_title?: string;
          join_date?: string;
          late_deduction?: number;
          outlet_id?: string | null;
          phone?: string | null;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      staff_shifts: {
        Row: {
          assigned_staff_ids: Json;
          business_id: string;
          created_at: string;
          end_time: string;
          grace_period_minutes: number;
          id: string;
          outlet_id: string | null;
          shift_name: string;
          start_time: string;
          updated_at: string;
        };
        Insert: {
          assigned_staff_ids?: Json;
          business_id: string;
          created_at?: string;
          end_time?: string;
          grace_period_minutes?: number;
          id?: string;
          outlet_id?: string | null;
          shift_name: string;
          start_time?: string;
          updated_at?: string;
        };
        Update: {
          assigned_staff_ids?: Json;
          business_id?: string;
          created_at?: string;
          end_time?: string;
          grace_period_minutes?: number;
          id?: string;
          outlet_id?: string | null;
          shift_name?: string;
          start_time?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_attendances: {
        Row: {
          business_id: string;
          check_in_time: string | null;
          check_out_time: string | null;
          created_at: string;
          date: string;
          device: string;
          face_snapshot_url: string | null;
          id: string;
          notes: string | null;
          outlet_id: string | null;
          staff_name: string;
          status: string;
          type: string;
          user_id: string;
        };
        Insert: {
          business_id: string;
          check_in_time?: string | null;
          check_out_time?: string | null;
          created_at?: string;
          date: string;
          device?: string;
          face_snapshot_url?: string | null;
          id?: string;
          notes?: string | null;
          outlet_id?: string | null;
          staff_name: string;
          status?: string;
          type?: string;
          user_id: string;
        };
        Update: {
          business_id?: string;
          check_in_time?: string | null;
          check_out_time?: string | null;
          created_at?: string;
          date?: string;
          device?: string;
          face_snapshot_url?: string | null;
          id?: string;
          notes?: string | null;
          outlet_id?: string | null;
          staff_name?: string;
          status?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      staff_payrolls: {
        Row: {
          absence_count: number;
          absence_deduction_total: number;
          base_salary: number;
          business_id: string;
          created_at: string;
          daily_allowance_total: number;
          id: string;
          late_count: number;
          late_deduction_total: number;
          net_salary: number;
          notes: string | null;
          outlet_id: string | null;
          payment_date: string | null;
          payment_method: string | null;
          payment_status: string;
          period_month: number;
          period_year: number;
          staff_name: string;
          total_bonus: number;
          total_days_present: number;
          total_deductions: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          absence_count?: number;
          absence_deduction_total?: number;
          base_salary?: number;
          business_id: string;
          created_at?: string;
          daily_allowance_total?: number;
          id?: string;
          late_count?: number;
          late_deduction_total?: number;
          net_salary?: number;
          notes?: string | null;
          outlet_id?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          payment_status?: string;
          period_month: number;
          period_year: number;
          staff_name: string;
          total_bonus?: number;
          total_days_present?: number;
          total_deductions?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          absence_count?: number;
          absence_deduction_total?: number;
          base_salary?: number;
          business_id?: string;
          created_at?: string;
          daily_allowance_total?: number;
          id?: string;
          late_count?: number;
          late_deduction_total?: number;
          net_salary?: number;
          notes?: string | null;
          outlet_id?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          payment_status?: string;
          period_month?: number;
          period_year?: number;
          staff_name?: string;
          total_bonus?: number;
          total_days_present?: number;
          total_deductions?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          active: boolean;
          address: string | null;
          business_id: string;
          contact_person: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          product_category: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          business_id: string;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          product_category?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          business_id?: string;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          product_category?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_orders: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          business_id: string;
          created_at: string;
          created_by: string | null;
          expected_delivery_date: string | null;
          id: string;
          notes: string | null;
          order_date: string;
          outlet_id: string | null;
          outlet_name: string | null;
          po_number: string;
          received_at: string | null;
          status: string;
          supplier_id: string | null;
          supplier_name: string | null;
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          expected_delivery_date?: string | null;
          id?: string;
          notes?: string | null;
          order_date?: string;
          outlet_id?: string | null;
          outlet_name?: string | null;
          po_number: string;
          received_at?: string | null;
          status?: string;
          supplier_id?: string | null;
          supplier_name?: string | null;
          total_amount?: number;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          expected_delivery_date?: string | null;
          id?: string;
          notes?: string | null;
          order_date?: string;
          outlet_id?: string | null;
          outlet_name?: string | null;
          po_number?: string;
          received_at?: string | null;
          status?: string;
          supplier_id?: string | null;
          supplier_name?: string | null;
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          created_at: string;
          id: string;
          inventory_item_id: string | null;
          item_name: string;
          purchase_order_id: string;
          quantity: number;
          received_quantity: number;
          subtotal: number;
          unit: string;
          unit_cost: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          inventory_item_id?: string | null;
          item_name: string;
          purchase_order_id: string;
          quantity?: number;
          received_quantity?: number;
          subtotal?: number;
          unit?: string;
          unit_cost?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          inventory_item_id?: string | null;
          item_name?: string;
          purchase_order_id?: string;
          quantity?: number;
          received_quantity?: number;
          subtotal?: number;
          unit?: string;
          unit_cost?: number;
        };
        Relationships: [];
      };
      stock_transfers: {
        Row: {
          approved_by: string | null;
          business_id: string;
          created_at: string;
          destination_outlet_id: string | null;
          destination_outlet_name: string | null;
          id: string;
          notes: string | null;
          origin_outlet_id: string | null;
          origin_outlet_name: string | null;
          received_at: string | null;
          requested_by: string | null;
          sent_at: string | null;
          status: string;
          transfer_number: string;
          updated_at: string;
        };
        Insert: {
          approved_by?: string | null;
          business_id: string;
          created_at?: string;
          destination_outlet_id?: string | null;
          destination_outlet_name?: string | null;
          id?: string;
          notes?: string | null;
          origin_outlet_id?: string | null;
          origin_outlet_name?: string | null;
          received_at?: string | null;
          requested_by?: string | null;
          sent_at?: string | null;
          status?: string;
          transfer_number: string;
          updated_at?: string;
        };
        Update: {
          approved_by?: string | null;
          business_id?: string;
          created_at?: string;
          destination_outlet_id?: string | null;
          destination_outlet_name?: string | null;
          id?: string;
          notes?: string | null;
          origin_outlet_id?: string | null;
          origin_outlet_name?: string | null;
          received_at?: string | null;
          requested_by?: string | null;
          sent_at?: string | null;
          status?: string;
          transfer_number?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_transfer_items: {
        Row: {
          created_at: string;
          id: string;
          inventory_item_id: string | null;
          item_name: string;
          quantity: number;
          received_quantity: number;
          stock_transfer_id: string;
          unit: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          inventory_item_id?: string | null;
          item_name: string;
          quantity?: number;
          received_quantity?: number;
          stock_transfer_id: string;
          unit?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          inventory_item_id?: string | null;
          item_name?: string;
          quantity?: number;
          received_quantity?: number;
          stock_transfer_id?: string;
          unit?: string;
        };
        Relationships: [];
      };
      stock_opnames: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          business_id: string;
          conducted_by: string | null;
          created_at: string;
          date: string;
          id: string;
          notes: string | null;
          opname_number: string;
          outlet_id: string | null;
          outlet_name: string | null;
          status: string;
          total_discrepancy: number;
          total_items: number;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          business_id: string;
          conducted_by?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          opname_number: string;
          outlet_id?: string | null;
          outlet_name?: string | null;
          status?: string;
          total_discrepancy?: number;
          total_items?: number;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          business_id?: string;
          conducted_by?: string | null;
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          opname_number?: string;
          outlet_id?: string | null;
          outlet_name?: string | null;
          status?: string;
          total_discrepancy?: number;
          total_items?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_opname_items: {
        Row: {
          created_at: string;
          difference: number;
          id: string;
          inventory_item_id: string | null;
          item_name: string;
          notes: string | null;
          physical_stock: number;
          stock_opname_id: string;
          system_stock: number;
          total_difference_cost: number;
          unit: string;
          unit_cost: number;
        };
        Insert: {
          created_at?: string;
          difference?: number;
          id?: string;
          inventory_item_id?: string | null;
          item_name: string;
          notes?: string | null;
          physical_stock?: number;
          stock_opname_id: string;
          system_stock?: number;
          total_difference_cost?: number;
          unit?: string;
          unit_cost?: number;
        };
        Update: {
          created_at?: string;
          difference?: number;
          id?: string;
          inventory_item_id?: string | null;
          item_name?: string;
          notes?: string | null;
          physical_stock?: number;
          stock_opname_id?: string;
          system_stock?: number;
          total_difference_cost?: number;
          unit?: string;
          unit_cost?: number;
        };
        Relationships: [];
      };
      waste_records: {
        Row: {
          business_id: string;
          created_at: string;
          date: string;
          id: string;
          inventory_item_id: string | null;
          item_name: string;
          notes: string | null;
          outlet_id: string | null;
          outlet_name: string | null;
          quantity: number;
          reason: string;
          recorded_by: string | null;
          total_loss: number;
          unit: string;
          unit_cost: number;
          updated_at: string;
          waste_number: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          date?: string;
          id?: string;
          inventory_item_id?: string | null;
          item_name: string;
          notes?: string | null;
          outlet_id?: string | null;
          outlet_name?: string | null;
          quantity?: number;
          reason?: string;
          recorded_by?: string | null;
          total_loss?: number;
          unit?: string;
          unit_cost?: number;
          updated_at?: string;
          waste_number: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          date?: string;
          id?: string;
          inventory_item_id?: string | null;
          item_name?: string;
          notes?: string | null;
          outlet_id?: string | null;
          outlet_name?: string | null;
          quantity?: number;
          reason?: string;
          recorded_by?: string | null;
          total_loss?: number;
          unit?: string;
          unit_cost?: number;
          updated_at?: string;
          waste_number?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          inventory_item_id: string;
          notes: string | null;
          outlet_id: string | null;
          quantity: number;
          reference_id: string | null;
          reference_type: string | null;
          type: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          inventory_item_id: string;
          notes?: string | null;
          outlet_id?: string | null;
          quantity?: number;
          reference_id?: string | null;
          reference_type?: string | null;
          type: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          inventory_item_id?: string;
          notes?: string | null;
          outlet_id?: string | null;
          quantity?: number;
          reference_id?: string | null;
          reference_type?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      pos_shifts: {
        Row: {
          business_id: string;
          cash_sales: number;
          cashier_name: string;
          created_at: string;
          end_time: string | null;
          ending_cash: number | null;
          expected_ending_cash: number | null;
          id: string;
          notes: string | null;
          outlet_id: string | null;
          outlet_name: string | null;
          start_time: string;
          starting_cash: number;
          status: string;
          total_cash_in: number;
          total_cash_out: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          business_id: string;
          cash_sales?: number;
          cashier_name: string;
          created_at?: string;
          end_time?: string | null;
          ending_cash?: number | null;
          expected_ending_cash?: number | null;
          id?: string;
          notes?: string | null;
          outlet_id?: string | null;
          outlet_name?: string | null;
          start_time?: string;
          starting_cash?: number;
          status?: string;
          total_cash_in?: number;
          total_cash_out?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          business_id?: string;
          cash_sales?: number;
          cashier_name?: string;
          created_at?: string;
          end_time?: string | null;
          ending_cash?: number | null;
          expected_ending_cash?: number | null;
          id?: string;
          notes?: string | null;
          outlet_id?: string | null;
          outlet_name?: string | null;
          start_time?: string;
          starting_cash?: number;
          status?: string;
          total_cash_in?: number;
          total_cash_out?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pos_cash_movements: {
        Row: {
          amount: number;
          business_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          outlet_id: string | null;
          reason: string;
          shift_id: string;
          type: string;
        };
        Insert: {
          amount?: number;
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          outlet_id?: string | null;
          reason?: string;
          shift_id: string;
          type: string;
        };
        Update: {
          amount?: number;
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          outlet_id?: string | null;
          reason?: string;
          shift_id?: string;
          type?: string;
        };
        Relationships: [];
      };
      receipt_settings: {
        Row: {
          address: string | null;
          business_id: string;
          business_name: string | null;
          created_at: string;
          id: string;
          logo_url: string | null;
          outlet_id: string | null;
          paper_size: string;
          phone: string | null;
          receipt_footer: string | null;
          receipt_header: string | null;
          show_address: boolean;
          show_business_name: boolean;
          show_phone: boolean;
          show_tax: boolean;
          store_name: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          business_id: string;
          business_name?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          outlet_id?: string | null;
          paper_size?: string;
          phone?: string | null;
          receipt_footer?: string | null;
          receipt_header?: string | null;
          show_address?: boolean;
          show_business_name?: boolean;
          show_phone?: boolean;
          show_tax?: boolean;
          store_name?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          business_id?: string;
          business_name?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          outlet_id?: string | null;
          paper_size?: string;
          phone?: string | null;
          receipt_footer?: string | null;
          receipt_header?: string | null;
          show_address?: boolean;
          show_business_name?: boolean;
          show_phone?: boolean;
          show_tax?: boolean;
          store_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          resource: string;
          role: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          resource: string;
          role: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          resource?: string;
          role?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      create_owner_account: {
        Args: {
          _user_id?: string;
          p_user_id?: string;
          _business_name?: string;
          p_business_name?: string;
          _display_name?: string;
          p_owner_name?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "owner" | "admin" | "cashier" | "manager";
      business_member_role: "owner" | "admin" | "cashier" | "manager";
      insight_type:
        | "sales_prediction"
        | "stock_recommendation"
        | "product_analysis"
        | "customer_insight"
        | "daily_summary";
      order_status: "draft" | "paid" | "refunded" | "cancelled";
      payment_method: "cash" | "qris" | "ewallet" | "card";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "cashier", "manager"],
      business_member_role: ["owner", "admin", "cashier", "manager"],
      insight_type: [
        "sales_prediction",
        "stock_recommendation",
        "product_analysis",
        "customer_insight",
        "daily_summary",
      ],
      order_status: ["draft", "paid", "refunded", "cancelled"],
      payment_method: ["cash", "qris", "ewallet", "card"],
    },
  },
} as const;
