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
    <div className="flex h-screen bg-background md:flex-row flex-col font-sans text-foreground">
      {/* Sidebar for PC */}
      <aside className="hidden md:flex flex-col w-72 bg-white/70 backdrop-blur-2xl border-r border-white/20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
        <div className="p-8 pt-10">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            记账助手
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ease-out',
                  isActive
                    ? 'bg-white text-primary shadow-[0_4px_20px_rgba(0,0,0,0.05)] font-semibold scale-[1.02]'
                    : 'text-gray-500 hover:bg-white/50 hover:text-gray-900 font-medium'
                )
              }
            >
              <item.icon className={cn("w-5 h-5", "transition-colors")} />
              <span className="text-[15px]">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Top Header for Mobile */}
      <header className="md:hidden bg-white/70 backdrop-blur-2xl border-b border-white/20 p-4 sticky top-0 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 text-center">记账助手</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-10 pb-28 md:pb-10 relative">
        <div className="max-w-4xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav for Mobile - MOZE Style */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-white/95 backdrop-blur-3xl border border-gray-100 flex justify-around p-2.5 z-50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[2rem]">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ease-out',
                isActive ? 'bg-primary text-white shadow-[0_4px_12px_rgba(37,99,235,0.4)] scale-[1.05]' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-50'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                {isActive ? (
                   <span className="text-[11px] font-bold mt-1 tracking-wide">{item.label}</span>
                ) : (
                   <span className="text-[11px] font-medium mt-1">{item.label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
