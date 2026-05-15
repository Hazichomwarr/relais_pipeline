// lib/getReports.ts
import { supabase } from "./supabase";

export async function getReports(date?: string) {
  let query = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (date) {
    query = query
      .gte("created_at", `${date}T00:00:00`)
      .lt("created_at", `${date}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}
