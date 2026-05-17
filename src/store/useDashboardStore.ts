// src/store/useDashboardStore.ts

import { Report } from "@/app/_component/ReportForm";
import { create } from "zustand";

type Store = {
  allReports: Report[];
};

export const useDashboardStore = create();
