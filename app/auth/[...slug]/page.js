import { redirect } from "next/navigation";

export default function AuthFallbackPage() {
  redirect("/auth/login");
}
