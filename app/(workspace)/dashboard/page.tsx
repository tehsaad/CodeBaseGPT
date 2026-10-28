import type { Metadata } from "next";
import { Dashboard } from "@/components/library/dashboard";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <Dashboard />;
}
