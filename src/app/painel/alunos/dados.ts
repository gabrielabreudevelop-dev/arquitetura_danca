import type { DadosAluno } from "@/servidor/alunos/cadastro";
import { lerTexto } from "../_formulario/ler-texto";

const CAMPOS = [
  "nome",
  "nascimento",
  "whatsapp",
  "email",
  "instagram",
] as const;
const CAMPOS_RESPONSAVEL = [
  "responsavel.nome",
  "responsavel.whatsapp",
  "responsavel.email",
] as const;

/**
 * Traduz o formulário de aluno para os dados do serviço. `responsavelId`
 * (pessoa que já existe) vira `responsavel.pessoaId`, salvo se veio
 * `responsavelNovo` ("Cadastrar outra pessoa"). `valores` devolve o que foi
 * digitado, para o formulário não esvaziar (com `responsavelExistenteNome`,
 * o nome da pessoa escolhida, quando há `responsavelId`).
 */
export function lerDadosAluno(form: FormData): {
  dados: DadosAluno & { turmaIds: string[] };
  valores: Record<string, string>;
} {
  const valores: Record<string, string> = {};
  for (const c of [...CAMPOS, ...CAMPOS_RESPONSAVEL])
    valores[c] = lerTexto(form, c);
  const turmaIds = form.getAll("turmaIds").map(String).filter(Boolean);
  valores.turmaIds = turmaIds.join(",");

  const novo = lerTexto(form, "responsavelNovo") === "1";
  const pessoaId = novo ? "" : lerTexto(form, "responsavelId").trim();
  if (novo) valores.responsavelNovo = "1";
  if (pessoaId) {
    valores.responsavelId = pessoaId;
    // Nome de quem já está cadastrado, só para a tela mostrar a escolha.
    const nome = lerTexto(form, "responsavelExistenteNome");
    if (nome) valores.responsavelExistenteNome = nome;
  }

  return {
    dados: {
      nome: valores.nome,
      nascimento: valores.nascimento,
      whatsapp: valores.whatsapp,
      email: valores.email,
      instagram: valores.instagram,
      responsavel: pessoaId
        ? { pessoaId }
        : {
            nome: valores["responsavel.nome"],
            whatsapp: valores["responsavel.whatsapp"],
            email: valores["responsavel.email"],
            novo,
          },
      confirmarWhatsappRepetido:
        lerTexto(form, "confirmarWhatsappRepetido") === "1",
      turmaIds,
    },
    valores,
  };
}
