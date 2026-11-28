import { describe, expect, it } from "vitest";
import { lerFiltrosContatos } from "@/servidor/alunos/listas";
import type { BolsistaCarregado } from "@/servidor/bolsistas/carga";
import {
  filtrarBolsistas,
  lerFiltrosBolsistas,
  linhasBolsistasSemVir,
} from "@/servidor/bolsistas/listas";
import { numerosDeBolsistas } from "./bolsistas";

const AGORA = new Date("2026-11-26T15:00:00Z");
let seq = 0;

function bolsista(
  nome: string,
  o: {
    ativo?: boolean;
    semVir15?: boolean;
    pessoa?: string;
    naoQuer?: boolean;
  } = {},
): BolsistaCarregado {
  seq++;
  const sem = (v: boolean) => ({ semVir: v, ultimaPresenca: null });
  return {
    id: `b${seq}`,
    nome,
    ativo: o.ativo ?? true,
    diasHoje: [2],
    contato: {
      pessoaId: o.pessoa ?? `p${seq}`,
      nome: `Contato ${seq}`,
      whatsapp: "5527999990000",
      ehResponsavel: false,
      usandoNumeroDoResponsavel: false,
      naoQuerContato: o.naoQuer ?? false,
    },
    ultimoContato: null,
    ultimoContatoGeral: null,
    mes: { combinados: 0, presentes: 0, fora: 0 },
    semVir: {
      7: sem(false),
      15: sem(o.semVir15 ?? false),
      30: sem(false),
    },
  } as unknown as BolsistaCarregado;
}

describe("numerosDeBolsistas", () => {
  const todos = [
    bolsista("Ana", { semVir15: true }),
    // irmãos no mesmo responsável: uma linha, dois bolsistas
    bolsista("Bia", { semVir15: true, pessoa: "resp" }),
    bolsista("Caio", { semVir15: true, pessoa: "resp" }),
    bolsista("Dani", { semVir15: true, naoQuer: true }),
    bolsista("Eva", { semVir15: true, ativo: false }),
    bolsista("Fabio"),
  ];

  it("ativos abre a lista de ativos e é o tamanho dela", () => {
    const n = numerosDeBolsistas(todos);
    expect(n.ativos.href).toBe("/painel/bolsistas");
    const filtros = lerFiltrosBolsistas({ situacao: "ativos", janela: "15" });
    expect(n.ativos.numero).toBe(filtrarBolsistas(todos, filtros).length);
    expect(n.ativos.numero).toBe(5);
  });

  it("sem vir abre a aba (janela 15) e é a soma dos bolsistas das linhas", () => {
    const n = numerosDeBolsistas(todos);
    expect(n.semVir.href).toBe("/painel/contatos?lista=bolsista_ausente");
    expect(lerFiltrosContatos({ lista: "bolsista_ausente" }).janela).toBe(15);
    const linhas = linhasBolsistasSemVir(todos, 15, AGORA);
    expect(linhas).toHaveLength(2);
    expect(n.semVir.numero).toBe(
      linhas.reduce((soma, l) => soma + l.bolsistas.length, 0),
    );
    expect(n.semVir.numero).toBe(3);
  });
});
