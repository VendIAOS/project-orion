import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  Settings,
} from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-blue-400">
          Project Orion
        </h1>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 space-y-2">

        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition">
          <LayoutDashboard size={20} />
          Dashboard
        </button>

        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition">
          <Users size={20} />
          Clientes
        </button>

        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition">
          <ShoppingCart size={20} />
          Vendas
        </button>

        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition">
          <Package size={20} />
          Produtos
        </button>

      </nav>

      {/* Rodapé */}
      <div className="p-4 border-t border-slate-700">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition">
          <Settings size={20} />
          Configurações
        </button>
      </div>
    </aside>
  );
}
