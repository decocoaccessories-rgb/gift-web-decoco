export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus = "new" | "confirmed" | "shipping" | "done" | "cancelled";
export type PaymentMethod = "cod" | "vnpay" | "vietqr";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
export type DiscountType = "fixed" | "percent";
export type SiteContentType = "text" | "image" | "richtext" | "url";
export type PhotoSlotShape = "rect" | "circle" | "rounded-rect";

export interface PhotoSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: PhotoSlotShape;
}

export interface FrameConfig {
  canvasWidth: number;
  canvasHeight: number;
  photoSlots: PhotoSlot[];
  backgroundImage?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  image_url: string;
  stock?: number;
}

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          highlights: string | null;
          variants: ProductVariant[];
          price: number;
          stock: number;
          is_visible: boolean;
          images: string[];
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      frames: {
        Row: {
          id: string;
          name: string;
          product_id: string | null;
          thumbnail_url: string | null;
          config: FrameConfig;
          sort_order: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["frames"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["frames"]["Insert"]>;
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          product_id: string | null;
          frame_id: string | null;
          design_data: Json | null;
          design_image_url: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          recipient_name: string | null;
          recipient_phone: string | null;
          discount_code: string | null;
          discount_amount: number;
          province: string;
          address: string;
          note: string | null;
          status: OrderStatus;
          price_at_order: number;
          variant_name: string | null;
          payment_method: PaymentMethod;
          payment_status: PaymentStatus;
          vnp_txn_ref: string | null;
          vnp_transaction_no: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_term: string | null;
          utm_content: string | null;
          referrer: string | null;
          landing_page: string | null;
          vietqr_content: string | null;
          vietqr_qr_url: string | null;
          vietqr_expires_at: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      discount_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: DiscountType;
          discount_value: number;
          max_discount_amount: number | null;
          min_order_amount: number;
          starts_at: string | null;
          expires_at: string | null;
          usage_limit: number | null;
          usage_count: number;
          per_customer_limit: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["discount_codes"]["Row"], "id" | "usage_count" | "created_at" | "updated_at"> & { usage_count?: number };
        Update: Partial<Database["public"]["Tables"]["discount_codes"]["Insert"]>;
      };
      discount_redemptions: {
        Row: {
          id: string;
          discount_code_id: string;
          order_id: string | null;
          code: string;
          customer_phone: string;
          amount: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["discount_redemptions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["discount_redemptions"]["Insert"]>;
      };
      site_content: {
        Row: {
          id: string;
          key: string;
          value: string | null;
          type: SiteContentType;
          section: string | null;
          label: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["site_content"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["site_content"]["Insert"]>;
      };
      faq_items: {
        Row: {
          id: string;
          question: string;
          answer: string;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["faq_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["faq_items"]["Insert"]>;
      };
      feedback_items: {
        Row: {
          id: string;
          image_url: string;
          alt_text: string | null;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["feedback_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["feedback_items"]["Insert"]>;
      };
      icons: {
        Row: {
          id: string;
          name: string;
          svg_url: string;
          category: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["icons"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["icons"]["Insert"]>;
      };
    };
  };
}

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Frame = Database["public"]["Tables"]["frames"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type DiscountCode = Database["public"]["Tables"]["discount_codes"]["Row"];
export type DiscountRedemption = Database["public"]["Tables"]["discount_redemptions"]["Row"];
export type SiteContent = Database["public"]["Tables"]["site_content"]["Row"];
export type FaqItem = Database["public"]["Tables"]["faq_items"]["Row"];
export type FeedbackItem = Database["public"]["Tables"]["feedback_items"]["Row"];
export type Icon = Database["public"]["Tables"]["icons"]["Row"];
