import Sidebar from "@/components/Sidebar";
import NavigationProgress from "@/components/NavigationProgress";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-ground)" }}>
      <NavigationProgress />
      <Sidebar />
      <main
        className="content-area md:ml-[224px] pb-[72px] md:pb-0 min-h-screen"
      >
        {children}
      </main>
    </div>
  );
}
