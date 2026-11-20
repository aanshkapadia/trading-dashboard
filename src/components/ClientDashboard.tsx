"use client";

import dynamic from "next/dynamic";

// Client only: the dashboard reads saved settings from localStorage on first render.
const Dashboard = dynamic(() => import("./Dashboard"), {
  ssr: false,
  loading: () => <div className="p-10 text-center text-sm text-muted">Loading dashboard…</div>,
});

export default function ClientDashboard() {
  return <Dashboard />;
}
