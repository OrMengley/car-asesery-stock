"use client"

import * as React from "react"
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
  UserGroupIcon,
  Search01Icon,
  Settings01Icon,
  SchoolReportCardIcon,
} from "hugeicons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
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
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: DashboardSquare01Icon,
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
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/">
                <SidebarLeft01Icon className="!size-5" />
                <span className="text-base font-semibold italic tracking-tight">ANTIGRAVITY</span>
              </a>
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
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
