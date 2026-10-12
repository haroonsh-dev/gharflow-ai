import { redirect } from "next/navigation";
import { identity } from "@/lib/auth";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  if (!(await identity())) redirect("/login");
  return <Dashboard />;
}
