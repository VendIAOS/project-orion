import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface Props {
  children: ReactNode;
}

export default function MainLayout({ children }: Props) {
  return (
    <main className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <section className="flex-1 p-8">
          {children}
        </section>
      </div>
    </main>
  );
}