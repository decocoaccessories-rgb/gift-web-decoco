import Link from "next/link";
import { LayoutDashboard, Package, FileText, Layers, LogOut } from "lucide-react";

const sidebarLinks = [
  { label: "Đơn hàng", href: "/admin/don-hang", icon: LayoutDashboard },
  { label: "Sản phẩm", href: "/admin/san-pham", icon: Package },
  { label: "Nội dung", href: "/admin/noi-dung", icon: FileText },
  { label: "Khung thiết kế", href: "/admin/khung", icon: Layers },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col bg-background border-r border-border">
        <div className="p-5 border-b border-border">
          <Link
            href="/"
            className="font-heading text-xl font-semibold italic text-primary"
          >
            DECOCO
          </Link>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Admin Panel
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background">
          <Link
            href="/admin/don-hang"
            className="font-heading text-lg font-semibold italic text-primary"
          >
            DECOCO Admin
          </Link>
        </div>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
