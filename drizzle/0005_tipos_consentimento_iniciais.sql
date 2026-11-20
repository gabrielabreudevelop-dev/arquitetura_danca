-- Tipos de consentimento iniciais. Os textos de cada tipo entram depois (decisão D6).
INSERT INTO tipos_consentimento (chave, nome, obrigatorio) VALUES ('termos_uso', 'Termos de uso', true);
--> statement-breakpoint
INSERT INTO tipos_consentimento (chave, nome, obrigatorio) VALUES ('politica_privacidade', 'Política de privacidade', true);
--> statement-breakpoint
INSERT INTO tipos_consentimento (chave, nome, obrigatorio) VALUES ('whatsapp_servico', 'WhatsApp: avisos de serviço', false);
--> statement-breakpoint
INSERT INTO tipos_consentimento (chave, nome, obrigatorio) VALUES ('whatsapp_novidades', 'WhatsApp: novidades', false);
--> statement-breakpoint
INSERT INTO tipos_consentimento (chave, nome, obrigatorio) VALUES ('lista_quem_vai', 'Aparecer na lista de quem vai aos eventos', false);
--> statement-breakpoint
INSERT INTO tipos_consentimento (chave, nome, obrigatorio) VALUES ('uso_imagem', 'Uso da minha imagem em vídeos e fotos do estúdio', false);
