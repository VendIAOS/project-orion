import { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface Props {
  children: ReactNode;
}

export default function MainLayout({ children }: Props) {
  return (
    <main className="flex min-h-screen flex-col bg-slate-100 lg:flex-row">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <section className="flex-1 p-4 sm:p-6 lg:p-8">
          <AuthGuard>{children}</AuthGuard>
        </section>
      </div>
    </main>
  );
}
