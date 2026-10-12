import { redirect } from "next/navigation";
import { identity } from "@/lib/auth";
import AuthForm from "./auth-form";

export default async function LoginPage() {
  if (await identity()) redirect("/dashboard");
  return <AuthForm />;
}
