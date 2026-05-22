import { getUserSettings, getHolidays } from "@/app/actions/auth";
import AccountClient from "./AccountClient";

export const metadata = { title: "Account — Chronicle" };

export default async function AccountPage() {
  const [settings, holidays] = await Promise.all([getUserSettings(), getHolidays()]);
  return <AccountClient settings={settings} holidays={holidays} />;
}
