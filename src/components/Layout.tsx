import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Ticket, ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Layout() {
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: '看板' },
    { to: '/tickets', icon: Ticket, label: '库存' },
    { to: '/sales', icon: ReceiptText, label: '明细' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 md:flex-row flex-col">
      {/* Sidebar for PC */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-800">记账助手</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Top Header for Mobile */}
      <header className="md:hidden bg-white border-b border-gray-200 p-4">
        <h1 className="text-lg font-bold text-gray-800 text-center">记账助手</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 pb-safe">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 p-2 min-w-[64px] rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-900'
              )
            }
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
