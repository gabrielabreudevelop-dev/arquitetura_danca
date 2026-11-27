import type { Preferencia } from "@/servidor/bolsistas/textos";
import { CAIXA, OPCAO } from "../_pessoa/campos";

/** Segunda a domingo (0 = domingo, como em `turma_dias`). */
const DIAS = [
  { numero: 1, nome: "Segunda" },
  { numero: 2, nome: "Terça" },
  { numero: 3, nome: "Quarta" },
  { numero: 4, nome: "Quinta" },
  { numero: 5, nome: "Sexta" },
  { numero: 6, nome: "Sábado" },
  { numero: 0, nome: "Domingo" },
] as const;

const PREFERENCIAS: { valor: Preferencia; nome: string }[] = [
  { valor: "os_dois", nome: "Os dois" },
  { valor: "conduzir", nome: "Prefere conduzir" },
  { valor: "ser_conduzido", nome: "Prefere ser conduzido" },
];

/** Caixas dos dias combinados, de segunda a domingo; erro abaixo, ligado ao grupo. */
export function CampoDias({
  marcados,
  erro,
  ajuda,
}: {
  marcados: Set<number>;
  erro?: string;
  ajuda: string;
}) {
  return (
    <fieldset
      aria-describedby={erro ? "dias-erro" : undefined}
      className="flex flex-col gap-2"
    >
      <legend className="float-left flex w-full flex-col gap-1">
        <span className="font-semibold">Dias combinados</span>
        <span className="text-pequeno text-texto-suave">{ajuda}</span>
      </legend>
      <div className="grid grid-cols-2 gap-x-4">
        {DIAS.map((d) => (
          <label key={d.numero} className={OPCAO}>
            <input
              type="checkbox"
              name="dias"
              value={d.numero}
              defaultChecked={marcados.has(d.numero)}
              aria-invalid={erro ? true : undefined}
              className={CAIXA}
            />
            <span>{d.nome}</span>
          </label>
        ))}
      </div>
      {erro && (
        <p id="dias-erro" className="text-erro">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

/** Rádio da preferência na dança; sem valor válido, "os dois". */
export function CampoPreferencia({
  valor,
  erro,
}: {
  valor: string | undefined;
  erro?: string;
}) {
  const atual = PREFERENCIAS.some((p) => p.valor === valor) ? valor : "os_dois";
  return (
    <fieldset
      aria-describedby={erro ? "preferencia-erro" : undefined}
      className="flex flex-col gap-2"
    >
      <legend className="float-left flex w-full flex-col gap-1">
        <span className="font-semibold">Preferência</span>
        <span className="text-pequeno text-texto-suave">
          Ajuda a montar os pares na chamada.
        </span>
      </legend>
      <div className="flex flex-col">
        {PREFERENCIAS.map((p) => (
          <label key={p.valor} className={OPCAO}>
            <input
              type="radio"
              name="preferencia"
              value={p.valor}
              defaultChecked={atual === p.valor}
              className={CAIXA}
            />
            <span>{p.nome}</span>
          </label>
        ))}
      </div>
      {erro && (
        <p id="preferencia-erro" className="text-erro">
          {erro}
        </p>
      )}
    </fieldset>
  );
}
