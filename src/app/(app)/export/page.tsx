import { getClientsWithProjects } from "@/app/actions/projects";
import { getTeamMembers } from "@/app/actions/team";
import PageMotion from "@/components/PageMotion";
import ExportClient from "./ExportClient";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const [clients, members] = await Promise.all([
    getClientsWithProjects(),
    getTeamMembers(),
  ]);

  const activeMembers = members.filter((m) => m.isActive);

  return (
    <PageMotion>
      <div className="p-6 max-w-6xl">
        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Chronicle
          </h1>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            Export
          </h2>
        </div>
        <ExportClient clients={clients as never} members={activeMembers} />
      </div>
    </PageMotion>
  );
}
