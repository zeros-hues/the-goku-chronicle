import { getClientsWithProjects } from "@/app/actions/projects";
import { getTeamMembers } from "@/app/actions/team";
import TimesheetClient from "./TimesheetClient";

export default async function TimesheetPage() {
  const [clients, members] = await Promise.all([
    getClientsWithProjects(),
    getTeamMembers(),
  ]);

  return (
    <TimesheetClient
      clients={clients as never}
      members={members.filter((m) => m.isActive)}
    />
  );
}
