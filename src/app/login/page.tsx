import { redirect } from "next/navigation";
import { identity } from "@/lib/auth";
import { demoEnabled } from "@/lib/config";
import AuthForm from "./auth-form";

export default async function LoginPage() {
  if (await identity()) redirect("/dashboard");
  return <AuthForm showDemo={demoEnabled()} />;
}
