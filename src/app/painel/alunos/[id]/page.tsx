import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  type DataIso,
  formatarDataCompleta,
  formatarDia,
  hojeEmSaoPaulo,
  idadeEm,
} from "@/servidor/alunos/datas";
import { obterFicha } from "@/servidor/alunos/ficha";
import { exigirAdministracao } from "@/servidor/auth/acesso";
import { obterBanco } from "@/servidor/banco/cliente";
import { formatarWhatsapp } from "@/servidor/pessoas/formatar";
import { textoDoEstado, textoDoPeriodo, textoDoResultado } from "../textos";
import { FormularioExcluir, FormularioReabrir } from "./formularios/cadastro";

export const dynamic = "force-dynamic";

const BOTAO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-acao px-6 font-semibold text-fundo hover:bg-acao-escura md:w-auto";
const SECUNDARIO =
  "inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-acao px-6 font-semibold text-link hover:bg-acao hover:text-fundo md:w-auto";
const LINK =
  "-mx-2 inline-flex min-h-12 items-center px-2 text-link underline decoration-link underline-offset-4";
const SECAO = "flex flex-col gap-4 border-linha border-t pt-6";
const LINHA =
  "flex flex-col gap-1 border-linha border-b py-3 last:border-b-0 md:flex-row md:items-baseline md:gap-6";

/** Dia de um instante em São Paulo: "15/11", ou "15/11/2025" se for de outro ano. */
function dia(em: Date, hoje: DataIso): string {
  const data = hojeEmSaoPaulo(em);
  return data.slice(0, 4) === hoje.slice(0, 4)
    ? formatarDia(data)
    : formatarDataCompleta(data);
}

function inicialMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Itens separados por " · ". */
function juntar(itens: ReactNode[]): ReactNode {
  return itens.map((item, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, sem reordenação
    <span key={i}>
      {i > 0 && " · "}
      {item}
    </span>
  ));
}

export default async function FichaAluno({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdministracao();
  const { id } = await params;
  const hoje = hojeEmSaoPaulo();
  const ficha = await obterFicha(obterBanco(), id, hoje);
  if (!ficha) notFound();
  const {
    aluno,
    historico,
    matriculasEncerradas,
    contatos,
    naoQuerContato,
    podeExcluir,
  } = ficha;
  const base = `/painel/alunos/${aluno.id}`;
  const r = aluno.responsavel;
  const resumo = aluno.resumo;
  const periodo = textoDoPeriodo(aluno.planoUltimo, resumo);
  const destrancar = historico.find((h) => h.destrancar)?.destrancar;
  const ativo = !aluno.encerrado;

  const dados: ReactNode[] = [
    aluno.nascimento
      ? `${idadeEm(aluno.nascimento, hoje)} anos`
      : "Sem data de nascimento",
  ];
  if (aluno.whatsapp)
    dados.push(
      <span className="whitespace-nowrap">
        {formatarWhatsapp(aluno.whatsapp)}
      </span>,
    );
  if (aluno.email)
    dados.push(<span className="break-words">{aluno.email}</span>);
  if (aluno.instagram)
    dados.push(
      <a
        href={`https://instagram.com/${aluno.instagram}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-link underline decoration-link underline-offset-4"
      >
        @{aluno.instagram}
      </a>,
    );

  const avisos: string[] = [];
  if (aluno.encerrado) avisos.push("Cadastro encerrado.");
  if (!aluno.email) avisos.push("Sem e-mail (pedir na ativação)");
  if (aluno.contato.usandoNumeroDoResponsavel)
    avisos.push(
      `Sem WhatsApp próprio — usando o de ${aluno.contato.nome} (responsável)`,
    );
  if (naoQuerContato)
    avisos.push(`Não quer contato desde ${dia(naoQuerContato.em, hoje)}`);

  // Ações do período: só para cadastro ativo; as regras finais ficam nos formulários.
  const acoesPeriodo: { href: string; rotulo: string }[] = [];
  if (ativo) {
    // Trancado: destrancar vem primeiro (é o botão principal).
    if (destrancar)
      acoesPeriodo.push({
        href: `${base}/destrancar/${destrancar}`,
        rotulo: "Destrancar",
      });
    if (resumo.ultimo) {
      acoesPeriodo.push({ href: `${base}/periodo`, rotulo: "Renovar" });
      acoesPeriodo.push({ href: `${base}/estender`, rotulo: "Estender" });
    }
    if (
      (resumo.estado === "vigente" || resumo.estado === "comeca_em_breve") &&
      !destrancar
    )
      acoesPeriodo.push({ href: `${base}/trancar`, rotulo: "Trancar" });
    if (resumo.estado === "vigente")
      acoesPeriodo.push({ href: `${base}/transferir`, rotulo: "Transferir" });
  }

  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-12 md:px-12 md:py-16"
    >
      <div className="flex flex-col gap-4">
        <Link href="/painel/alunos" className={`${LINK} self-start`}>
          Voltar para alunos
        </Link>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="break-words text-titulo">{aluno.nome}</h1>
          <Link href={`${base}/editar`} className={SECUNDARIO}>
            Editar
          </Link>
        </div>
        <p className="text-texto-suave">{juntar(dados)}</p>
        {r && (
          <p>
            <span className="font-semibold">Responsável:</span>{" "}
            {juntar(
              [
                r.nome,
                r.whatsapp && (
                  <span className="whitespace-nowrap">
                    {formatarWhatsapp(r.whatsapp)}
                  </span>
                ),
                r.email && <span className="break-words">{r.email}</span>,
              ].filter(Boolean),
            )}
          </p>
        )}
        {avisos.length > 0 && (
          <ul className="flex flex-col gap-1 bg-rosa-suave px-4 py-3">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </div>

      <section aria-labelledby="ficha-turmas" className={SECAO}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 id="ficha-turmas" className="text-base">
            Turmas
          </h2>
          {ativo && (
            <Link href={`${base}/turmas`} className={SECUNDARIO}>
              {aluno.matriculas.length === 0 ? "Matricular" : "Mudar turmas"}
            </Link>
          )}
        </div>
        {aluno.matriculas.length === 0 ? (
          <p className="text-texto-suave">Sem turma no momento.</p>
        ) : (
          <ul className="flex flex-col">
            {aluno.matriculas.map((m) => (
              <li key={m.matriculaId} className={LINHA}>
                <span className="min-w-0 flex-1 break-words">{m.rotulo}</span>
                <span className="text-pequeno text-texto-suave">
                  desde {formatarDia(m.entrada)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {matriculasEncerradas.length > 0 && (
          <ul className="flex flex-col gap-1 text-pequeno text-texto-suave">
            {matriculasEncerradas.map((m) => (
              <li key={`${m.rotulo}-${m.entrada}-${m.saida}`}>
                Saiu de: {m.rotulo} ({formatarDia(m.entrada)} a{" "}
                {formatarDia(m.saida)})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ficha-periodo" className={SECAO}>
        <h2 id="ficha-periodo" className="text-base">
          Período
        </h2>
        {periodo ? (
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{periodo}</p>
            <p className="text-texto-suave">
              {inicialMaiuscula(textoDoEstado(resumo))}
            </p>
          </div>
        ) : (
          <p className="text-texto-suave">
            Sem período registrado. Registre o plano contratado para acompanhar
            o vencimento.
          </p>
        )}
        {ativo && !resumo.ultimo && (
          <Link href={`${base}/periodo`} className={`${BOTAO} md:self-start`}>
            Registrar período
          </Link>
        )}
        {acoesPeriodo.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:flex md:flex-wrap">
            {acoesPeriodo.map((a, i) => (
              <Link
                key={a.href}
                href={a.href}
                className={i === 0 ? `${BOTAO} col-span-2` : SECUNDARIO}
              >
                {a.rotulo}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="ficha-historico" className={SECAO}>
        <h2 id="ficha-historico" className="text-base">
          Histórico
        </h2>
        {historico.length === 0 ? (
          <p className="text-texto-suave">
            Nada registrado ainda. Períodos, extensões, trancamentos e turmas
            aparecem aqui, do mais recente ao mais antigo.
          </p>
        ) : (
          <ul className="flex flex-col">
            {historico.map((h, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: itens sem id próprio, em ordem fixa
                key={i}
                className={LINHA}
              >
                <span className="text-pequeno text-texto-suave md:w-20 md:shrink-0">
                  {dia(h.em, hoje)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="break-words">
                    <span className={h.anulado ? "line-through" : ""}>
                      {h.texto}
                    </span>
                    <span className="text-texto-suave"> · {h.por}</span>
                  </p>
                  {h.anulado && (
                    <p className="text-pequeno text-texto-suave">
                      Anulado em {dia(h.anulado.em, hoje)} por {h.anulado.por}
                      {h.anulado.motivo && ` · ${h.anulado.motivo}`}
                    </p>
                  )}
                </div>
                {/* Corrigir o histórico (anular, destrancar) vale também para encerrado. */}
                {(h.anular || h.destrancar) && (
                  <div className="flex gap-6">
                    {h.destrancar && (
                      <Link
                        href={`${base}/destrancar/${h.destrancar}`}
                        className={LINK}
                      >
                        Destrancar
                      </Link>
                    )}
                    {ativo && h.anular?.tipo === "periodo" && (
                      <Link
                        href={`${base}/periodo?corrigir=${h.anular.id}`}
                        aria-label={`Corrigir: ${h.texto}`}
                        className={LINK}
                      >
                        Corrigir
                      </Link>
                    )}
                    {h.anular && (
                      <Link
                        href={`${base}/anular?tipo=${h.anular.tipo}&alvo=${h.anular.id}`}
                        aria-label={`Anular: ${h.texto}`}
                        className={LINK}
                      >
                        Anular
                      </Link>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ficha-contatos" className={SECAO}>
        <h2 id="ficha-contatos" className="text-base">
          Contatos
        </h2>
        {contatos.length === 0 ? (
          <p className="text-texto-suave">Nenhum contato registrado.</p>
        ) : (
          <ul className="flex flex-col">
            {contatos.map((c) => (
              <li key={`${c.grupoId}-${c.em.getTime()}`} className={LINHA}>
                <span className="text-pequeno text-texto-suave md:w-20 md:shrink-0">
                  {dia(c.em, hoje)}
                </span>
                <p className="min-w-0 flex-1 break-words">
                  {c.mensagem ?? "Contato"}
                  <span className="text-texto-suave"> · {c.por}</span>
                  {c.resultado && ` · ${textoDoResultado(c.resultado)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {aluno.encerrado && (
        <section aria-labelledby="ficha-reabrir" className={SECAO}>
          <h2 id="ficha-reabrir" className="text-base">
            Reabrir cadastro
          </h2>
          <p className="max-w-prose text-texto-suave">
            O aluno volta para as listas. As matrículas encerradas não voltam
            sozinhas: matricule de novo nas turmas.
          </p>
          <div className="md:self-start">
            <FormularioReabrir alunoId={aluno.id} />
          </div>
        </section>
      )}

      {ativo && (
        <section aria-labelledby="ficha-encerrar" className={SECAO}>
          <h2 id="ficha-encerrar" className="text-base">
            Encerrar aluno
          </h2>
          <p className="max-w-prose text-texto-suave">
            Encerra as matrículas abertas e tira o aluno das listas de contato.
            O histórico fica guardado.
          </p>
          <Link
            href={`${base}/encerrar`}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-sm border border-erro px-6 font-semibold text-erro hover:bg-erro hover:text-fundo md:w-auto md:self-start"
          >
            Encerrar aluno
          </Link>
        </section>
      )}
      {podeExcluir && (
        <section aria-labelledby="ficha-excluir" className={SECAO}>
          <h2 id="ficha-excluir" className="text-base">
            Excluir cadastro
          </h2>
          <p className="max-w-prose text-texto-suave">
            Só para cadastro feito por engano: este aluno ainda não tem período,
            turma, contato nem histórico. Se a pessoa tem outro papel no
            estúdio, só o de aluno sai.
          </p>
          <div className="md:self-start">
            <FormularioExcluir alunoId={aluno.id} nome={aluno.nome} />
          </div>
        </section>
      )}
    </main>
  );
}
