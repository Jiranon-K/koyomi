import { DASHBOARD_PATH } from "@/features/auth/paths";
import { PrivateShell } from "@/features/auth/private-shell";

const LINKS = [{ href: DASHBOARD_PATH, label: "Dashboard" }];

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <PrivateShell links={LINKS}>{children}</PrivateShell>;
}
