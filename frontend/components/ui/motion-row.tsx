"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface MotionRowProps extends HTMLMotionProps<"tr"> {
  index?: number;
}

export function MotionRow({ 
  className, 
  children,
  index = 0,
  ...props 
}: MotionRowProps) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 25,
        delay: index * 0.05 // Stagger effect based on index
      }}
      className={cn(
        "group hover:bg-lamaPurpleLight/20 transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </motion.tr>
  );
}
