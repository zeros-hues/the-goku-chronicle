import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen dot-grid" style={{ background: "var(--background)" }}>
      <Sidebar />
      <main className="md:ml-[220px] pb-[56px] md:pb-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
