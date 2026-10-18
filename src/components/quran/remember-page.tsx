"use client";

import { useEffect } from "react";

import { rememberPage } from "@/lib/last-page";

/** Notes the page being read, so "continue" on the home screen lands here. */
export function RememberPage({ page }: { page: number }) {
  useEffect(() => {
    rememberPage(page);
  }, [page]);
  return null;
}
