-- A chave identifica o tipo de consentimento no código e nos registros; trocá-la
-- quebraria o vínculo com a prova legal. Nome, obrigatório e ativo continuam editáveis.
-- ATENÇÃO: `bloquear_alteracao()` (migração 0004) é específica de consentimento
-- (a mensagem de erro fala de "registro de consentimento"). Não reutilize nem
-- substitua essa função para outras tabelas; crie uma função própria.
CREATE FUNCTION bloquear_troca_chave_consentimento() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.chave IS DISTINCT FROM OLD.chave THEN
    RAISE EXCEPTION 'chave do tipo de consentimento não pode ser alterada';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER tipos_consentimento_chave_imutavel
  BEFORE UPDATE ON tipos_consentimento
  FOR EACH ROW EXECUTE FUNCTION bloquear_troca_chave_consentimento();
