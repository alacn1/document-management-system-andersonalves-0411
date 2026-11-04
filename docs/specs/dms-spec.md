# Especificação - Document Management System

## 1. Objetivo

Entregar uma aplicação web que permita a um usuário enviar, listar e baixar seus documentos, mantendo os arquivos no filesystem local e os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Envio de um arquivo por solicitação.
- Listagem dos documentos associados ao usuário da solicitação.
- Download de um documento pelo identificador, limitado ao seu proprietário.
- Identificação simples do proprietário por `X-User-Id`; autenticação não faz parte desta versão.
- Interface React para envio, listagem e download, consumindo a API via `fetch`.

### Fora do escopo

- Armazenamento externo, em nuvem ou em serviços de terceiros.
- Persistência de metadados em banco de dados ou sobrevivência dos metadados a reinicializações.
- Autenticação, autorização baseada em credenciais, cadastro de usuários ou gestão de sessões.
- Versionamento, edição, exclusão, compartilhamento ou busca avançada de documentos.
- Restrições de formato por lista de extensões ou tipos MIME.

## 3. Requisitos funcionais

| ID    | Requisito |
| ----- | --------- |
| RF-01 | O sistema deve aceitar o envio de um arquivo por requisição `multipart/form-data`, no campo `file`. |
| RF-02 | O sistema deve rejeitar solicitações sem `X-User-Id` ou sem arquivo, informando um erro legível e estruturado. |
| RF-03 | O sistema deve atribuir um identificador único ao documento e registrar seu nome original, tamanho em bytes, data/hora de envio e proprietário. |
| RF-04 | O sistema deve armazenar o conteúdo do arquivo em `backend/storage`, usando `multer` com `diskStorage` e um nome de armazenamento gerado pelo sistema. |
| RF-05 | O sistema deve listar somente os metadados dos documentos cujo proprietário corresponda ao `X-User-Id` da solicitação. |
| RF-06 | O sistema deve permitir o download pelo identificador somente quando o documento pertencer ao `X-User-Id` da solicitação. |
| RF-07 | O sistema deve responder com `404` quando o identificador não existir, não estiver associado ao usuário informado ou o arquivo não estiver disponível. |
| RF-08 | O sistema deve preservar o nome original para apresentação e download, sem usá-lo como caminho ou nome físico do arquivo. |
| RF-09 | A interface deve permitir escolher e enviar um arquivo, apresentar estado de carregamento e erros, atualizar a lista após o envio e iniciar o download de um documento selecionado. |

## 4. Requisitos não funcionais

| ID     | Requisito |
| ------ | --------- |
| RNF-01 | O armazenamento de arquivos é exclusivamente local, no filesystem da aplicação, por `multer` configurado com `diskStorage`; não usar provedores externos. |
| RNF-02 | Os metadados ficam em memória nesta fase. Reiniciar o processo remove os metadados, embora arquivos já gravados possam permanecer no disco. |
| RNF-03 | O limite inicial de upload é de 10 MiB por arquivo. Qualquer tipo de arquivo é permitido; não executar nem interpretar o conteúdo enviado. |
| RNF-04 | O diretório `backend/storage` deve existir ou ser criado antes do upload, e a aplicação precisa ter permissão de escrita e leitura nele. |
| RNF-05 | Configurações operacionais devem vir de variáveis de ambiente: `PORT` (padrão `3000`), `UPLOAD_MAX_BYTES` (padrão `10485760`, 10 MiB) e `STORAGE_DIR` (padrão `backend/storage`, relativo à raiz do backend). |
| RNF-06 | A API deve responder em JSON para sucesso de metadados e erros; downloads são respostas binárias. |
| RNF-07 | Código backend em JavaScript CommonJS e frontend em JavaScript ESM, sem TypeScript nesta fase. |
| RNF-08 | A identificação por `X-User-Id` é apenas um mecanismo de escopo funcional para o MVP, não uma autenticação segura. A aplicação não deve ser exposta como sistema multiusuário confiável sem autenticação/autorização apropriadas. |

## 5. Modelo de dados (metadados do documento)

### Documento

| Campo        | Tipo   | Obrigatório | Descrição |
| ------------ | ------ | ----------- | --------- |
| `id`         | string | sim         | UUID v4 único, gerado pelo backend. |
| `originalName` | string | sim       | Nome informado pelo cliente, preservado apenas como metadado e para o nome de download. |
| `size`       | number | sim         | Tamanho do arquivo em bytes, conforme recebido e salvo. |
| `uploadedAt` | string | sim         | Data/hora do envio em ISO 8601 UTC. |
| `owner`      | string | sim         | Valor de `X-User-Id` usado na solicitação de envio. |
| `storageName` | string | sim        | Nome físico gerado pelo backend para localizar o arquivo no diretório local; campo interno. |

### Regras de dados

- Os metadados são mantidos em memória por um repositório durante a vida do processo.
- `id` (UUID v4) é a chave lógica dos metadados; `storageName` é a referência ao arquivo em disco. O caminho absoluto não é devolvido pela API.
- O cliente não pode definir `id`, `owner`, `uploadedAt` ou `storageName`.
- Nomes originais podem se repetir. O nome físico deve ser único e independente do nome original, evitando traversal e colisões.
- Metadados de usuário diferente nunca são incluídos na listagem nem retornados para download.

## 6. Contratos de API

### Convenções

- O backend expõe as rotas abaixo sem prefixo. Durante desenvolvimento, o proxy do Vite recebe chamadas em `/api` e remove esse prefixo antes de encaminhá-las ao backend.
- As rotas de documentos exigem o cabeçalho `X-User-Id`, com valor não vazio. Este valor identifica o escopo do usuário, mas não prova sua identidade.
- `Content-Type` para respostas JSON: `application/json; charset=utf-8`.
- Erros JSON seguem o formato `{ "error": { "code": "ERROR_CODE", "message": "Descrição em português" } }`.
- O limite do corpo enviado é configurado por `UPLOAD_MAX_BYTES`, com padrão de 10 MiB. Arquivos vazios são rejeitados.

### `POST /upload`

Envia um arquivo para o usuário identificado.

**Cabeçalhos**

```http
X-User-Id: user-123
```

**Entrada**

- `Content-Type: multipart/form-data`
- Campo obrigatório `file`: um arquivo. Outros campos de formulário não são usados para definir os metadados.

**Sucesso — `201 Created`**

```json
{
  "id": "c1be5a0e-8ee8-4c73-b9ac-8721e803db55",
  "originalName": "relatorio.pdf",
  "size": 2048,
  "uploadedAt": "2026-11-04T18:40:00.000Z",
  "owner": "user-123"
}
```

**Erros**

| Status | Código | Situação |
| ------ | ------ | -------- |
| `400` | `USER_ID_REQUIRED` | Cabeçalho ausente ou vazio. |
| `400` | `FILE_REQUIRED` | Campo `file` ausente ou arquivo vazio. |
| `413` | `FILE_TOO_LARGE` | Arquivo ultrapassa 10 MiB. |
| `400` | `INVALID_MULTIPART` | Requisição multipart inválida ou mais de um arquivo enviado. |
| `500` | `UPLOAD_FAILED` | Falha ao gravar arquivo ou registrar metadados. A resposta não deve expor caminhos locais nem detalhes internos. |

Se o arquivo já tiver sido gravado e a persistência dos metadados falhar, o fluxo deve tentar remover o arquivo recém-criado para evitar um arquivo órfão. A falha de limpeza deve ser reportada no log do servidor.

### `GET /documents`

Lista os documentos do usuário identificado. Não retorna caminhos ou nomes físicos do armazenamento.

**Cabeçalhos**

```http
X-User-Id: user-123
```

**Sucesso — `200 OK`**

```json
{
  "documents": [
    {
      "id": "c1be5a0e-8ee8-4c73-b9ac-8721e803db55",
      "originalName": "relatorio.pdf",
      "size": 2048,
      "uploadedAt": "2026-11-04T18:40:00.000Z",
      "owner": "user-123"
    }
  ]
}
```

Quando não houver documentos, `documents` é uma lista vazia.

**Erros**

| Status | Código | Situação |
| ------ | ------ | -------- |
| `400` | `USER_ID_REQUIRED` | Cabeçalho ausente ou vazio. |
| `500` | `DOCUMENT_LIST_FAILED` | Falha inesperada ao consultar os metadados. |

### `GET /documents/:id/download`

Baixa o conteúdo binário de um documento pertencente ao usuário identificado.

**Cabeçalhos**

```http
X-User-Id: user-123
```

**Sucesso — `200 OK`**

- Corpo: bytes originais do arquivo.
- `Content-Type: application/octet-stream`.
- `Content-Disposition: attachment` com o nome original codificado de forma segura.
- `Content-Length` correspondente ao tamanho do arquivo, quando disponível.

**Erros**

| Status | Código | Situação |
| ------ | ------ | -------- |
| `400` | `USER_ID_REQUIRED` | Cabeçalho ausente ou vazio. |
| `400` | `INVALID_DOCUMENT_ID` | Identificador ausente ou que não esteja no formato UUID v4. |
| `404` | `DOCUMENT_NOT_FOUND` | Documento inexistente, de outro proprietário ou arquivo ausente em disco. A resposta não distingue essas situações. |
| `500` | `DOWNLOAD_FAILED` | Falha inesperada de leitura/streaming, sem expor caminhos locais. |

### Formato comum de erro

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Documento não encontrado."
  }
}
```

## 7. Decisões arquiteturais

### Backend

Manter a direção de dependência `routes -> controllers -> services -> repositories`:

- `routes/`: registra caminhos HTTP e encaminha para controllers; não contém regra de negócio.
- `controllers/`: lê parâmetros, cabeçalhos e multipart, faz validação básica, chama services e traduz resultados/erros para status e respostas HTTP.
- `services/`: concentra as regras de negócio, incluindo associação ao proprietário, criação dos metadados e autorização de listagem/download pelo proprietário.
- `repositories/`: abstrai a persistência dos metadados em memória e o acesso ao arquivo local. A camada de storage deve usar filesystem local; a gravação recebida pelo endpoint deve ser feita por `multer` com `diskStorage`.
- `app.js`: compõe middleware, rotas e tratamento de erros. Não deve concentrar regras de negócio nem lógica de persistência.

Camadas internas não dependem de Express ou de detalhes HTTP. O controller deve encaminhar a identidade do proprietário como dado de entrada para o service. Erros de Multer e de filesystem precisam ser convertidos em respostas apropriadas no limite HTTP, sem respostas de sucesso simuladas ou falhas silenciosas.

### Frontend

- React com componentes funcionais e Hooks, organizados em `components/`, `pages/` e `services/`.
- Um serviço de API centraliza chamadas `fetch` sob o prefixo `/api`; o proxy Vite encaminha ao backend e remove esse prefixo em desenvolvimento.
- A interface não define nem altera metadados internos. O identificador de usuário para esta fase é configurado como contexto simples de demonstração e enviado no cabeçalho `X-User-Id`.
- Estados de carregamento, vazio, sucesso e erro devem ser apresentados ao usuário em português.

### Armazenamento e limites

- Arquivos: `backend/storage`, filesystem local, gravados por `multer.diskStorage`.
- Configuração padrão: `PORT=3000`, `UPLOAD_MAX_BYTES=10485760` e `STORAGE_DIR=backend/storage`; `STORAGE_DIR` é resolvido relativamente à raiz do backend. Não armazenar essas configurações apenas no código quando um ambiente exigir valores diferentes.
- Metadados: memória, sem banco de dados nesta fase.
- O nome físico do arquivo é gerado pelo servidor. O nome do cliente nunca é concatenado a um caminho.
- A perda dos metadados após reinicialização e a possibilidade de arquivos órfãos são limitações conhecidas desta fase; não adicionar serviço externo ou persistência não solicitada para contorná-las.

## 8. Critérios de aceite

1. Um usuário pode enviar um arquivo de até 10 MiB e recebe `201` com os metadados previstos.
2. O arquivo recebido existe no armazenamento local e seu nome físico não depende do nome original.
3. Envio sem usuário/arquivo, arquivo vazio e arquivo acima do limite produzem os erros documentados.
4. A listagem retorna somente documentos do usuário indicado e retorna `[]` quando não houver documentos.
5. O proprietário consegue baixar o conteúdo original; outro usuário e identificadores inexistentes recebem a mesma resposta `404`.
6. A API não expõe o caminho local nem o nome físico do arquivo.
7. Uma falha ao persistir metadados depois da gravação tenta limpar o arquivo parcial e registra falha de limpeza.
8. A interface cobre envio, atualização da lista, estados vazio/carregando/erro e download.
9. A implementação mantém a separação de responsabilidades e a direção de dependências descritas nesta especificação.

## 9. Plano de execução

Etapas de implementação futuras, em nível de entregas. Este documento não executa nem especifica alterações em arquivos de backend ou frontend.

1. Revisar e aprovar esta especificação, incluindo contratos, limites e critérios de aceite.
2. Implementar o fluxo de upload e metadados no backend, mantendo rotas, controllers, services e repositories em suas responsabilidades e o arquivo no filesystem local via Multer `diskStorage`.
3. Implementar listagem e download no backend, aplicando o escopo por proprietário, tratamento uniforme de erros e testes automatizados dos contratos.
4. Implementar a interface React e o serviço de comunicação HTTP para upload, listagem e download, cobrindo estados de interação e mensagens ao usuário.
5. Integrar frontend e backend via proxy `/api`, validar os critérios de aceite de ponta a ponta e documentar configuração e limitações operacionais.
