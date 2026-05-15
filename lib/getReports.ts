// lib/getReports.ts
import { supabase } from "./supabase";

export async function getReports() {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.log("Error fetching reports:", error);
    return [];
  }
  return data;
}
