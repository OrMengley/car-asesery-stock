"use client"

import * as React from "react"
import Link from "next/link"
import {
  Camera01Icon,
  BarChartIcon,
  DashboardSquare01Icon,
  Database01Icon,
  AiGenerativeIcon,
  File01Icon,
  Doc01Icon,
  FolderOpenIcon,
  HelpCircleIcon,
  SidebarLeft01Icon,
  GridViewIcon,
  Package01Icon,
  Archive02Icon,
  ShoppingCart01Icon,
  UserMultipleIcon,
  UserGroupIcon,
  UserIcon,
  Search01Icon,
  Settings01Icon,
  SchoolReportCardIcon,
  Sorting01Icon,
  Home01Icon,
  MoneyReceiveSquareIcon,
} from "hugeicons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { auth } from "@/lib/firebase/config"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: DashboardSquare01Icon,
    },
    {
      title: "Product Menu",
      url: "/menu",
      icon: GridViewIcon,
    },
    {
      title: "Categories",
      url: "/categories",
      icon: GridViewIcon,
    },
    {
      title: "Products",
      url: "/products",
      icon: Package01Icon,
    },
    {
      title: "Inventory",
      url: "/inventory",
      icon: Archive02Icon,
    },
    {
      title: "Stock Transfers",
      url: "/stock-transfers",
      icon: Sorting01Icon,
    },
    {
      title: "Purchases",
      url: "/purchases",
      icon: ShoppingCart01Icon,
    },
    {
      title: "Suppliers",
      url: "/suppliers",
      icon: UserMultipleIcon,
    },
    {
      title: "Customers",
      url: "/customers",
      icon: UserIcon,
    },
    {
      title: "Sales",
      url: "/sales",
      icon: MoneyReceiveSquareIcon,
    },
    {
      title: "Warehouses",
      url: "/warehouses",
      icon: Home01Icon,
    },
    {
      title: "Users",
      url: "/users",
      icon: UserGroupIcon,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: Settings01Icon,
    },
    {
      title: "Get Help",
      url: "#",
      icon: HelpCircleIcon,
    },
    {
      title: "Search",
      url: "#",
      icon: Search01Icon,
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: Database01Icon,
    },
    {
      name: "Reports",
      url: "#",
      icon: SchoolReportCardIcon,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: Doc01Icon,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [mounted, setMounted] = React.useState(false)
  const [user, setUser] = React.useState({
    name: "User",
    email: "",
    avatar: "",
  })
  const router = useRouter()

  React.useEffect(() => {
    setMounted(true)
    
    // Get user from local storage
    const storedAuth = localStorage.getItem("user_auth")
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth)
        if (authData.user_info) {
          setUser({
            name: authData.user_info.name || "User",
            email: authData.email || "",
            avatar: authData.user_info.avatar_url || `https://ui-avatars.com/api/?name=${authData.user_info.name}&background=random`,
          })
        }
      } catch (e) {
        console.error("Failed to parse auth data", e)
      }
    }
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      localStorage.removeItem("user_auth")
      router.push("/login")
    } catch (error) {
      console.error("Failed to sign out", error)
    }
  }

  if (!mounted) {
    return (
      <Sidebar collapsible="offcanvas" {...props}>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-4 py-3">
             <div className="size-5 rounded-md bg-muted animate-pulse" />
             <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="flex flex-col gap-4 p-4">
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
          </div>
        </SidebarContent>
      </Sidebar>
    )
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <SidebarLeft01Icon className="!size-5" />
                <span className="text-base font-semibold italic tracking-tight">ANTIGRAVITY</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={handleLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
