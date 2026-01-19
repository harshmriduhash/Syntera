"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  User,
  Settings,
  Sparkles,
  BarChart3,
  Users,
  Workflow,
  FileText,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Briefcase,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { motion } from "framer-motion"

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Agents",
    href: "/dashboard/agents",
    icon: Sparkles,
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    name: "Workflows",
    href: "/dashboard/workflows",
    icon: Workflow,
  },
  {
    name: "Transcripts",
    href: "/dashboard/transcripts",
    icon: FileText,
  },
]

const crmSubItems = [
  {
    name: "Overview",
    href: "/dashboard/crm",
    icon: LayoutGrid,
  },
  {
    name: "Contacts",
    href: "/dashboard/crm/contacts",
    icon: Users,
  },
  {
    name: "Deals",
    href: "/dashboard/crm/deals",
    icon: Briefcase,
  },
]

const bottomNavigation = [
  {
    name: "Profile",
    href: "/dashboard/profile",
    icon: User,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const isCRMActive = pathname?.startsWith("/dashboard/crm")
  const [isCRMOpen, setIsCRMOpen] = useState(isCRMActive)

  // Auto-expand CRM group when on any CRM page
  useEffect(() => {
    if (isCRMActive) {
      setIsCRMOpen(true)
    }
  }, [isCRMActive])

  return (
    <Sidebar className="border-r border-border/50">
      <SidebarHeader className="border-b border-border/50 p-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2.5 group/logo transition-opacity hover:opacity-80"
          >
            <div className="relative">
              <Image 
                src="/logo.svg" 
                alt="Syntera" 
                width={120} 
                height={32}
                className="h-8 w-auto transition-transform group-hover/logo:scale-105"
                priority
              />
            </div>
          </Link>
        </motion.div>
      </SidebarHeader>
      <SidebarContent className="gap-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigation.slice(0, 3).map((item, index) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        className={cn(
                          "group relative mx-2 rounded-lg transition-all duration-200",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium shadow-sm" 
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <div className={cn(
                            "flex items-center justify-center h-8 w-8 rounded-md transition-all duration-200",
                            isActive
                              ? "bg-primary/20 text-primary"
                              : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <span className="flex-1">{item.name}</span>
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                )
              })}

              {/* CRM Expandable Group */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 3 * 0.03 }}
              >
                <Collapsible open={isCRMOpen} onOpenChange={setIsCRMOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isCRMActive}
                        className={cn(
                          "group relative mx-2 rounded-lg transition-all duration-200 w-full",
                          isCRMActive 
                            ? "bg-primary/10 text-primary font-medium shadow-sm" 
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className={cn(
                            "flex items-center justify-center h-8 w-8 rounded-md transition-all duration-200",
                            isCRMActive
                              ? "bg-primary/20 text-primary"
                              : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          )}>
                            <Users className="h-4 w-4" />
                          </div>
                          <span className="flex-1 text-left">CRM</span>
                          {isCRMActive && (
                            <motion.div
                              layoutId="activeIndicatorCRM"
                              className="h-1.5 w-1.5 rounded-full bg-primary"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                          <motion.div
                            animate={{ rotate: isCRMOpen ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </motion.div>
                        </div>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden">
                      <div className="ml-4 mt-1 space-y-1 pb-1">
                        {crmSubItems.map((subItem, subIndex) => {
                          const isSubActive = pathname === subItem.href || 
                            (subItem.href !== "/dashboard/crm" && pathname?.startsWith(`${subItem.href}/`))
                          return (
                            <motion.div
                              key={subItem.href}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: subIndex * 0.05 }}
                            >
                              <SidebarMenuButton
                                asChild
                                isActive={isSubActive}
                                className={cn(
                                  "group relative mx-2 rounded-lg transition-all duration-200",
                                  isSubActive 
                                    ? "bg-primary/10 text-primary font-medium shadow-sm" 
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                              >
                                <Link href={subItem.href} className="flex items-center gap-3">
                                  <div className={cn(
                                    "flex items-center justify-center h-7 w-7 rounded-md transition-all duration-200",
                                    isSubActive
                                      ? "bg-primary/20 text-primary"
                                      : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                  )}>
                                    <subItem.icon className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="flex-1 text-sm">{subItem.name}</span>
                                  {isSubActive && (
                                    <motion.div
                                      layoutId="activeIndicatorSub"
                                      className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary"
                                      initial={false}
                                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                  )}
                                </Link>
                              </SidebarMenuButton>
                            </motion.div>
                          )
                        })}
                      </div>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </motion.div>

              {/* Remaining navigation items */}
              {navigation.slice(3).map((item, index) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: (3 + index + 1) * 0.03 }}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        className={cn(
                          "group relative mx-2 rounded-lg transition-all duration-200",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium shadow-sm" 
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <div className={cn(
                            "flex items-center justify-center h-8 w-8 rounded-md transition-all duration-200",
                            isActive
                              ? "bg-primary/20 text-primary"
                              : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <span className="flex-1">{item.name}</span>
                          {isActive && (
                            <motion.div
                              layoutId={`activeIndicator-${item.name}`}
                              className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto border-t border-border/50 pt-4">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {bottomNavigation.map((item, index) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: (navigation.length + index) * 0.03 }}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        className={cn(
                          "group relative mx-2 rounded-lg transition-all duration-200",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium shadow-sm" 
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <div className={cn(
                            "flex items-center justify-center h-8 w-8 rounded-md transition-all duration-200",
                            isActive
                              ? "bg-primary/20 text-primary"
                              : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <span className="flex-1">{item.name}</span>
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicatorBottom"
                              className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

