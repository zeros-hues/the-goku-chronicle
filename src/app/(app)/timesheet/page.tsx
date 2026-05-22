import { getClientsWithProjects } from "@/app/actions/projects";
import { getTeamMembers } from "@/app/actions/team";
import { getUserSettings } from "@/app/actions/auth";
import TimesheetClient from "./TimesheetClient";

export const metadata = { title: "Timesheet" };

export default async function TimesheetPage() {
  const [clients, members, settings] = await Promise.all([
    getClientsWithProjects(),
    getTeamMembers(),
    getUserSettings(),
  ]);

  return (
    <TimesheetClient
      clients={clients as never}
      members={members.filter((m) => m.isActive)}
      hoursTarget={settings.hoursTarget}
    />
  );
}
