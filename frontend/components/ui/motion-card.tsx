"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface MotionCardProps extends HTMLMotionProps<"div"> {
  variant?: "default" | "glass" | "lift";
}

export function MotionCard({ 
  className, 
  variant = "default",
  children,
  ...props 
}: MotionCardProps) {
  const variants = {
    default: "bg-white border border-slate-200",
    glass: "bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl",
    lift: "bg-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
  };

  const motionVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    hover: { 
      y: -5,
      scale: 1.01,
      transition: { type: "spring", stiffness: 400, damping: 25 } as const
    }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      whileHover={variant === "lift" || variant === "glass" ? "hover" : undefined}
      variants={motionVariants}
      className={cn(
        "rounded-2xl p-6 overflow-hidden",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
