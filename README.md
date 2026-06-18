# Site OrddO

Landing page estática inicial da OrddO, construída a partir de:

- `05_comercial_crm/BRIEFING_SITE_ORDDO_001.md`
- `05_comercial_crm/PLANO_OPERACAO_CRM_KYC_001.md`

## Arquivos

- `index.html` - estrutura, copy e formulário inicial.
- `privacidade.html` - política inicial de privacidade para o piloto.
- `termos.html` - termos de uso iniciais.
- `styles.css` - layout responsivo e identidade visual.
- `script.js` - menu mobile, animações leves e simulação de envio por e-mail.

## Preview local

Na raiz do projeto:

```bash
python3 -m http.server 8080 --directory site/orddo
```

Depois abrir:

```text
http://localhost:8080
```

## Observações

- O formulário público não coleta CPF, documentos ou dados bancários.
- O envio atual usa `mailto:` apenas para protótipo.
- Em produção, conectar o formulário ao CRM com lista de supressão, consentimento/autorização de contato, política de privacidade e trilha de origem.
- Atualizar o e-mail `contato@orddo.com.br` quando o domínio oficial estiver ativo.
- Revisar `privacidade.html` e `termos.html` com advogado antes de publicação pública.
