"use client";

import { role } from "@/lib/data";
import { 
  Video, Megaphone, BarChart3, Settings, 
  Share2, Radio, PenTool, LayoutDashboard,
  Wand2, Archive
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const menuItems = [
  {
    title: "MENU",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/",
        visible: ["admin", "strategist", "copywriter", "producer"],
      },
      {
        icon: Wand2,
        label: "Creative Director",
        href: "/director",
        visible: ["admin", "strategist"],
      },
      {
        icon: Archive,
        label: "Brand Vault",
        href: "/brand-vault",
        visible: ["admin", "strategist"],
      },
      {
        icon: Megaphone,
        label: "Campaigns",
        href: "/campaigns",
        visible: ["admin", "strategist"],
      },
      {
        icon: Video,
        label: "Videos",
        href: "/videos",
        visible: ["admin", "producer"],
      },
      {
        icon: PenTool,
        label: "Review",
        href: "/review",
        visible: ["admin", "copywriter"],
      },
       {
        icon: Share2,
        label: "Distribution",
        href: "/distribution",
        visible: ["admin", "distributor"],
      },
      {
        icon: Radio,
        label: "Publishing",
        href: "/publishing",
        visible: ["admin", "publisher"],
      },
      {
        icon: BarChart3,
        label: "Analytics",
        href: "/analytics",
        visible: ["admin", "strategist"],
      },
    ],
  },
  {
    title: "OTHER",
    items: [
      {
        icon: Settings,
        label: "Settings",
        href: "/settings",
        visible: ["admin", "strategist", "copywriter", "producer"],
      },
    ],
  },
];

const MotionLink = motion(Link);

export default function Menu() {
  const pathname = usePathname() || "/";

  return (
    <div className="mt-4 text-sm">
      {menuItems.map((i) => (
        <div className="flex flex-col gap-2" key={i.title}>
          <span className="hidden lg:block text-slate-400 font-light my-4 uppercase text-xs">
            {i.title}
          </span>
          {i.items.map((item) => {
            if (item.visible.includes(role)) {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <MotionLink
                  href={item.href}
                  key={item.label}
                  whileHover={{ y: -2 }}
                  className="flex items-center justify-center lg:justify-start gap-4 py-2 px-2 relative group"
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-menu-item"
                      className="absolute inset-0 bg-lamaSky/30 backdrop-blur-sm rounded-md"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                  
                  <item.icon 
                    size={20} 
                    className={`z-10 transition-colors ${isActive ? "text-slate-800" : "text-slate-500 group-hover:text-slate-700"}`} 
                  />
                  <span className={`hidden lg:block z-10 transition-colors ${isActive ? "font-medium text-slate-800" : "text-slate-500 group-hover:text-slate-700"}`} >
                    {item.label}
                  </span>
                </MotionLink>
              );
            }
          })}
        </div>
      ))}
    </div>
  );
}
