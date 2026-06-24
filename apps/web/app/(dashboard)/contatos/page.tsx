import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContatosClient } from "./contatos-client";

export default async function ContatosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <ContatosClient />;
}
