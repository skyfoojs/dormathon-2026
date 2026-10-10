import { AppShell } from "@/components/layout/AppShell";

// Every page under this layout is a Client Component using React Query for
// data (not the Suspense/"use cache" pattern Cache Components' instant-nav
// validator expects), so that experimental dev-only validator can't resolve
// a static shell here. This doesn't affect what users see - the page still
// renders correctly - it only opts these routes out of that validation
// noise, as Next's own docs recommend for routes not adopting the pattern:
// https://nextjs.org/docs/app/guides/instant-navigation#opting-out
export const instant = false;

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
