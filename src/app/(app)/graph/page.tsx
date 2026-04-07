import { auth } from "@/auth";
import { redirect } from "next/navigation";
import GraphView from "@/components/GraphView";

export default async function GraphPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <GraphView userName={session.user?.name ?? "there"} />;
}
