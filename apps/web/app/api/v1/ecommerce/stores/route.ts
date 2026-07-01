import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getEcommerceStores } from "@/lib/store-integration";

// Lojas disponíveis para o seletor do Ecommerce (acessível a quem vê Ecommerce).
export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("ecommerce");
  if (!guard.ok) return guard.response;

  const stores = await getEcommerceStores();
  return NextResponse.json({ data: stores.map((s) => ({ id: s.id, name: s.name })) });
}
