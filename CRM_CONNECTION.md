# Conexão do Site OrddO com o CRM MVP

## Como funciona na prática

O site está publicado em GitHub Pages, portanto é estático. Ele não pode guardar token do
Airtable no JavaScript, porque qualquer pessoa conseguiria ver o token no navegador.

O fluxo correto é:

```text
Formulário do site -> webhook seguro -> Airtable CRM MVP
```

O JavaScript do site já está pronto para enviar um JSON para o webhook configurado no
atributo `data-endpoint` do formulário.

Arquivo:

```text
index.html
```

Trecho:

```html
<form class="lead-form reveal" data-lead-form data-endpoint="" novalidate>
```

Quando o webhook estiver criado, preencher:

```html
<form class="lead-form reveal" data-lead-form data-endpoint="https://SEU-WEBHOOK" novalidate>
```

Enquanto `data-endpoint` estiver vazio, o site mantém fallback por e-mail.

## Payload enviado pelo site

```json
{
  "nome": "Nome informado",
  "email": "email@exemplo.com",
  "telefone": "+55 11 99999-9999",
  "perfil": "Titular do crédito",
  "numero_cnj": "0000000-00.0000.0.00.0000",
  "tribunal": "TJSP",
  "advogado_informado": "Nome do advogado",
  "valor_informado": "R$ 20.000",
  "consentimento_contato": true,
  "aceite_privacidade": true,
  "canal": "site",
  "origem": "inbound",
  "status": "novo"
}
```

## Destino no Airtable

Base MVP:

```text
app7hsjUV9mUTiK1P
```

Tabela:

```text
01_Inbound
```

Mapeamento:

| Site | Airtable |
|---|---|
| `nome` | `nome` |
| `email` | `email` |
| `telefone` | `telefone` |
| `perfil` | `perfil` |
| `numero_cnj` | `numero_cnj` |
| `tribunal` | `tribunal` |
| `advogado_informado` | `advogado_informado` |
| `valor_informado` | `valor_informado` |
| `consentimento_contato` | `consentimento_contato` |
| `aceite_privacidade` | `aceite_privacidade` |
| `status` | `status` |

Campos que o webhook deve preencher:

| Airtable | Valor sugerido |
|---|---|
| `data_entrada` | data/hora do recebimento |
| `status` | `novo` |
| `sla_status` | `aguardando` |

## Opções de webhook

### Opção A - Make/Zapier/n8n

1. Criar um webhook.
2. Mapear os campos recebidos.
3. Criar registro no Airtable na base `app7hsjUV9mUTiK1P`, tabela `01_Inbound`.
4. Copiar a URL do webhook.
5. Colar a URL em `data-endpoint`.

### Opção B - Cloudflare Worker/Vercel/Firebase

Template pronto:

```text
webhook/cloudflare-worker.js
```

Esse arquivo já cria registro na base MVP `app7hsjUV9mUTiK1P`, tabela `01_Inbound`.

Para Cloudflare Worker:

1. criar um Worker;
2. copiar o conteúdo de `webhook/cloudflare-worker.js`;
3. configurar o secret `AIRTABLE_TOKEN` no Worker;
4. publicar;
5. copiar a URL pública do Worker;
6. colar a URL em `data-endpoint` no `index.html`.

Criar uma função HTTP que:

1. recebe o JSON do site;
2. valida campos obrigatórios;
3. adiciona `data_entrada`, `status` e `sla_status`;
4. usa o token Airtable no ambiente secreto do provedor;
5. cria o registro em `01_Inbound`.

## Segurança

- Nunca colocar token Airtable no `index.html` ou `script.js`.
- O webhook deve aceitar apenas `POST`.
- O webhook deve validar campos obrigatórios.
- O formulário público não coleta CPF, documento pessoal, dados bancários ou uploads.
