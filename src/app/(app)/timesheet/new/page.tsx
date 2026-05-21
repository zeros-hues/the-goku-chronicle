import { getClientsWithProjects } from "@/app/actions/projects";
import { getTeamMembers } from "@/app/actions/team";
import PageMotion from "@/components/PageMotion";
import EntryForm from "@/components/EntryForm";

export const dynamic = "force-dynamic";

export default async function NewEntryPage() {
  const [clients, members] = await Promise.all([
    getClientsWithProjects(),
    getTeamMembers(),
  ]);

  const activeMembers = members.filter((m) => m.isActive);

  return (
    <PageMotion>
      <div style={{ padding: "48px", maxWidth: 640 }}>
        <h1
          style={{
            fontFamily:    "var(--font-instrument-sans)",
            fontSize:      20,
            fontWeight:    500,
            color:         "var(--text-primary)",
            letterSpacing: "-0.02em",
            lineHeight:    "28px",
            marginBottom:  32,
          }}
        >
          New Entry
        </h1>
        <EntryForm clients={clients as never} members={activeMembers} />
      </div>
    </PageMotion>
  );
}
