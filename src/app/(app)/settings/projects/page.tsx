import { getClientsWithProjects } from "@/app/actions/projects";
import PageMotion from "@/components/PageMotion";
import ProjectsClient from "./ProjectsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const clients = await getClientsWithProjects();

  return (
    <PageMotion>
      <div className="p-6 max-w-4xl">
        <div className="mb-8">
          <p
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
            Settings
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            Clients & Projects
          </h1>
        </div>
        <ProjectsClient initialClients={clients} />
      </div>
    </PageMotion>
  );
}
