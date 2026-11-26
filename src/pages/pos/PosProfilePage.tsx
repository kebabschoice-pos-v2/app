import { UnifiedProfileTabs } from "@/components/kebabschoicepos/UnifiedProfileTabs";

interface PosProfilePageProps {
  displayName?: string;
  email?: string;
  role?: string;
  onSignOut?: () => Promise<void> | void;
}

export function PosProfilePage({ displayName, email, role, onSignOut }: PosProfilePageProps) {
  return (
    <UnifiedProfileTabs
      displayName={displayName}
      email={email}
      role={role}
      onSignOut={onSignOut}
    />
  );
}
