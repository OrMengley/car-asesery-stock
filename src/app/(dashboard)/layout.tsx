"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useAuth } from "@/hooks/useAuth"

// Pages accessible by sale and logistic roles
const RESTRICTED_ROLE_ALLOWED_PATHS = ["/sales", "/menu"]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (loading) return

    // If role is sale or logistic, check if the current path is allowed
    if (role === "sale" || role === "logistic") {
      const isAllowed = RESTRICTED_ROLE_ALLOWED_PATHS.some(
        (path) => pathname === path || pathname.startsWith(path + "/")
      )
      if (!isAllowed) {
        router.replace("/sales")
        return
      }
    }

    setAuthorized(true)
  }, [role, loading, pathname, router])

  // Show loading state while checking auth
  if (loading || !authorized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

