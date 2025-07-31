import { redirect } from "next/navigation";

export default function EmailConfirmedPage() {
  redirect("/login?emailConfirmed=true");
}