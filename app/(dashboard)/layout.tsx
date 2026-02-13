import { Sidebar } from "@/components/sidebar";
import Navbar from "@/components/Navbar";
import { UnlockKeyToolbar } from "@/components/dev/unlock-key-toolbar";
import { SkipToMain, KeyboardShortcutsHelp } from "@/components/ui/skip-to-main";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-screen flex">
      {/* Skip to main content link */}
      <SkipToMain />
      
      {/* LEFT SIDEBAR - Navigation */}
      <Sidebar />
      
      {/* RIGHT CONTENT */}
      <div className="flex-1 min-h-0 bg-slate-50 dark:bg-background flex flex-col">
        {/* Header/Navigation */}
        <Navbar />
        
        {/* Main Content */}
        <main 
          id="main-content" 
          className="flex-1 p-4 gap-4 flex flex-col overflow-auto"
          role="main"
          tabIndex={-1}
        >
           {children}
        </main>
      </div>

      {/* Dev Tools */}
      <UnlockKeyToolbar />
      
      {/* Keyboard shortcuts help */}
      <KeyboardShortcutsHelp />
    </div>
  );
}
