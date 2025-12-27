import { Sidebar } from "@/components/sidebar";
import Navbar from "@/components/Navbar";
import { UnlockKeyToolbar } from "@/components/dev/unlock-key-toolbar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-screen flex">
      {/* LEFT SIDEBAR - New Collapsible Dark Sidebar */}
      <Sidebar />
      
      {/* RIGHT CONTENT */}
      <div className="flex-1 bg-slate-50 overflow-auto flex flex-col">
        <Navbar />
        <main className="flex-1 p-4 gap-4 flex flex-col">
           {children}
        </main>
      </div>

      {/* Dev Tools */}
      <UnlockKeyToolbar />
    </div>
  );
}
