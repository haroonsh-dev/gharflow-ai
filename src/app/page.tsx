import { redirect } from "next/navigation";
import { identity } from "@/lib/auth";

export default async function Home() {
  redirect((await identity()) ? "/dashboard" : "/login");
}
