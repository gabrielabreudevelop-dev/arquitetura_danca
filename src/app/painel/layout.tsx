import { exigirPapel } from "@/servidor/auth/acesso";

export const dynamic = "force-dynamic";

/** Toda a área do painel exige alguém da equipe. */
export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPapel(["administracao", "atendente"]);
  return children;
}
