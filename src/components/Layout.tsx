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
    <div className="fixed inset-0 overflow-hidden flex bg-background md:flex-row flex-col font-sans text-foreground">
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
      <header className="md:hidden flex-none bg-white/70 backdrop-blur-2xl border-b border-white/20 p-4 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 text-center">记账助手</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-10 pb-40 md:pb-10 relative">
        <div className="max-w-4xl mx-auto h-full">
          <Outlet />
        </div>
      </main>

      {/* Fade out effect at the bottom for mobile */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none z-40"></div>

      {/* Bottom Nav for Mobile - Docked to bottom */}
      <nav className="md:hidden absolute bottom-0 left-0 right-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-200/50 flex justify-around pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] px-2 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-300 ease-out',
                isActive ? 'text-primary scale-[1.05]' : 'text-gray-400 hover:text-gray-800'
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
