"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  const handleToggle = () => {
    const next = isDark ? 'light' : 'dark'
    setTheme(next)
    try {
      // Mirror theme in a cookie so the server can render consistently
      document.cookie = `theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    } catch (e) {}
  }

  // Ensure cookie matches resolvedTheme when the component mounts
  React.useEffect(() => {
    if (mounted && resolvedTheme) {
      try {
        document.cookie = `theme=${resolvedTheme}; path=/; max-age=${60 * 60 * 24 * 365}`;
      } catch (e) {}
    }
  }, [mounted, resolvedTheme])

  // Show placeholder during SSR
  if (!mounted) {
    return (
      <div className="flex items-center justify-between w-full px-2 py-1.5 text-sm">
        <span className="flex items-center">
          <Sun className="mr-2 h-4 w-4" />
          <span>Dark Mode</span>
        </span>
        <div className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-slate-200" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between w-full px-2 py-1.5 text-sm">
      <span className="flex items-center">
        {isDark ? (
           <Moon className="mr-2 h-4 w-4" />
        ) : (
           <Sun className="mr-2 h-4 w-4" />
        )}
        <span>Dark Mode</span>
      </span>
      <button 
        type="button"
        onClick={handleToggle}
        className={`
          relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
          transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 
          focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
          ${isDark ? 'bg-lamaPurple' : 'bg-slate-200'}
        `}
        aria-label="Toggle dark mode"
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 
            transition duration-200 ease-in-out
            ${isDark ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  )
}
