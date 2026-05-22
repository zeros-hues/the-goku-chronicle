import { getTeamMembers } from "@/app/actions/team";
import PageMotion from "@/components/PageMotion";
import TeamClient from "./TeamClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage() {
  const members = await getTeamMembers();

  return (
    <PageMotion>
      <div className="p-6 max-w-3xl">
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
            Team Members
          </h1>
        </div>
        <TeamClient initialMembers={members} />
      </div>
    </PageMotion>
  );
}
