import { redirect } from "next/navigation";

export default function ConfigPage() {
  redirect("/dashboard?panel=config");
}
