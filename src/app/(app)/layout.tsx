import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-ground)" }}>
      <Sidebar />
      <main
        className="content-area md:ml-[224px] pb-[72px] md:pb-0 min-h-screen"
      >
        {children}
      </main>
    </div>
  );
}
