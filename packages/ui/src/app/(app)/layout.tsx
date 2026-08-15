import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="subtle-radial min-h-screen">
      <AppNav />
      {children}
    </div>
  );
}
