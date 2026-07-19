import { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface Props {
  children: ReactNode;
}

export default function MainLayout({ children }: Props) {
  return (
    <main className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />

        <section className="flex-1 p-8">
          <AuthGuard>{children}</AuthGuard>
        </section>
      </div>
    </main>
  );
}
