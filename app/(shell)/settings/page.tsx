export const instant = false;

import { PageHeader } from "@/components/layout/PageHeader";
import { Tag } from "@/components/ui/Tag";
import { DatabaseConnectionSection } from "@/components/settings/DatabaseConnectionSection";
import { MapTablesSection } from "@/components/settings/MapTablesSection";
import { MigrationSection } from "@/components/settings/MigrationSection";
import { SyncSourcesSection } from "@/components/settings/SyncSourcesSection";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Database connection, table mapping, migration and sync preferences."
        actions={<Tag tone="dashed">Design only, nothing connects</Tag>}
      />
      <DatabaseConnectionSection />
      <MapTablesSection />
      <MigrationSection />
      <SyncSourcesSection />
    </>
  );
}
