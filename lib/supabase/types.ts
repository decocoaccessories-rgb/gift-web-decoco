export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus = "new" | "confirmed" | "shipping" | "done" | "cancelled";
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
          province: string;
          address: string;
          note: string | null;
          status: OrderStatus;
          price_at_order: number;
          variant_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
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
export type SiteContent = Database["public"]["Tables"]["site_content"]["Row"];
export type FaqItem = Database["public"]["Tables"]["faq_items"]["Row"];
export type FeedbackItem = Database["public"]["Tables"]["feedback_items"]["Row"];
export type Icon = Database["public"]["Tables"]["icons"]["Row"];
