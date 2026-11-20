-- Os registros e os textos de consentimento são a prova legal (LGPD e política
-- do WhatsApp da Meta): nunca podem ser alterados nem apagados, nem pelo dono
-- da tabela. A mesma função serve aos gatilhos por linha e por comando.
CREATE FUNCTION bloquear_alteracao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'registro de consentimento não pode ser alterado nem apagado';
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER registros_consentimento_imutavel
  BEFORE UPDATE OR DELETE ON registros_consentimento
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
--> statement-breakpoint
CREATE TRIGGER registros_consentimento_sem_truncate
  BEFORE TRUNCATE ON registros_consentimento
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_alteracao();
--> statement-breakpoint
CREATE TRIGGER textos_consentimento_imutavel
  BEFORE UPDATE OR DELETE ON textos_consentimento
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
--> statement-breakpoint
CREATE TRIGGER textos_consentimento_sem_truncate
  BEFORE TRUNCATE ON textos_consentimento
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_alteracao();
