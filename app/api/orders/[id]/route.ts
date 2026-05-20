import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendCustomerOrderEmail } from "@/lib/email";
import type { Order } from "@/lib/supabase/types";

const patchSchema = z.object({
  status: z.enum(["new", "confirmed", "shipping", "done", "cancelled"]).optional(),
  note: z.string().max(500).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });
  }

  const admin = createAdminClient();

  // Fetch the old order before updating to compare status transitions
  const { data: oldOrder, error: fetchError } = await admin
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !oldOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("orders")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trigger customer email notification on valid transitions if email exists
  const newStatus = parsed.data.status;
  const oldStatus = oldOrder.status;

  if (newStatus && newStatus !== oldStatus && oldOrder.customer_email) {
    let emailType: "confirmed" | "shipping" | "done" | "cancelled" | null = null;

    if (oldStatus === "new" && newStatus === "confirmed") {
      emailType = "confirmed";
    } else if (oldStatus === "confirmed" && newStatus === "shipping") {
      emailType = "shipping";
    } else if (oldStatus === "shipping" && newStatus === "done") {
      emailType = "done";
    } else if (newStatus === "cancelled" && oldStatus !== "cancelled") {
      emailType = "cancelled";
    }

    if (emailType) {
      // Fetch product name for customer email
      let productName: string | null = null;
      if (oldOrder.product_id) {
        const { data: productData } = await admin
          .from("products")
          .select("name")
          .eq("id", oldOrder.product_id)
          .single();
        if (productData) {
          productName = productData.name;
        }
      }

      // Fire-and-await customer email notification (fail-soft)
      await sendCustomerOrderEmail({
        order: {
          ...oldOrder,
          status: newStatus,
        } as unknown as Order,
        productName,
        type: emailType,
      });
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("orders").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
