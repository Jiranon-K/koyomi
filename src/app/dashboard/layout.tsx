import { ADMIN_PATH, SETTINGS_PATH } from "@/features/auth/paths";
import { PrivateShell } from "@/features/auth/private-shell";
import { currentSession } from "@/features/auth/session";
import { SCHEDULE_PATH } from "@/features/schedule/paths";

const LINKS = [
  { href: SCHEDULE_PATH, label: "Schedule" },
  { href: SETTINGS_PATH, label: "Settings" },
];
const ADMIN_LINK = { href: ADMIN_PATH, label: "Admin" };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const isAdmin = (await currentSession())?.user.role === "admin";

  return <PrivateShell links={isAdmin ? [...LINKS, ADMIN_LINK] : LINKS}>{children}</PrivateShell>;
}
