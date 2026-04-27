"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Trang chủ", href: "/" },
  { label: "Sản phẩm", href: "/san-pham" },
  { label: "Giới thiệu", href: "/#story" },
  { label: "FAQ", href: "/#faq" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-sm border-b border-border shadow-sm"
          : "bg-white border-b border-transparent"
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="font-heading text-2xl font-semibold italic text-primary tracking-wide"
        >
          DECOCO
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/san-pham" className={cn(buttonVariants({ size: "sm" }))}>
            <ShoppingBag className="h-4 w-4 mr-1.5" />
            Mua ngay
          </Link>
        </div>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="md:hidden"
            render={<Button variant="ghost" size="icon" aria-label="Menu" />}
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 pt-10">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="font-heading text-2xl font-semibold italic text-primary"
            >
              DECOCO
            </Link>
            <nav className="mt-8 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-secondary text-primary"
                      : "hover:bg-secondary/50 text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 px-3">
              <Link
                href="/san-pham"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants(), "w-full")}
              >
                <ShoppingBag className="h-4 w-4 mr-1.5" />
                Mua ngay
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
