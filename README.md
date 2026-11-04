# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey alacn1!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/alacn1/document-management-system-andersonalves-0411/issues/1)

---

## Backend DMS

```sh
cd backend
npm install
npm start
```

O backend usa JavaScript CommonJS e separa rotas, controllers, services e
repositories em `backend/src`. Execute os testes com `npm test` na pasta `backend`.

- `GET /health`: verificação de saúde.
- `POST /upload`: um arquivo não vazio no campo multipart `file`; retorna `201`.
- `GET /documents`: retorna `{ "documents": [...] }` do proprietário.
- `GET /documents/:id/download`: baixa os bytes originais pelo UUID v4.

As rotas de documentos exigem `X-User-Id`. Esse cabeçalho define apenas o escopo
do MVP, **não é autenticação**. Download de outro proprietário ou de documento
inexistente retorna `404`. Os contratos completos estão na
[especificação](docs/specs/dms-spec.md).

```sh
curl -H 'X-User-Id: demo' -F 'file=@./relatorio.pdf' http://localhost:3000/upload
curl -H 'X-User-Id: demo' http://localhost:3000/documents
curl -H 'X-User-Id: demo' -OJ http://localhost:3000/documents/UUID/download
```

Configuração via ambiente:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP. |
| `UPLOAD_MAX_BYTES` | `10485760` | Limite inclusivo de bytes por arquivo (10 MiB); inteiro positivo. |
| `STORAGE_DIR` | `storage` | Diretório local, relativo à raiz de `backend` ou absoluto. |

O diretório padrão é `backend/storage`, criado automaticamente no primeiro
upload. Os arquivos são gravados por Multer `diskStorage`, com nomes gerados
pelo servidor. Metadados ficam somente em memória: reiniciar o processo perde
a listagem, mas não remove os arquivos do disco. Não há armazenamento externo.

## Frontend DMS

Com o backend em execução na porta 3000, abra outro terminal:

```sh
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`, informe um usuário e clique em **Carregar
documentos**. Escolha um arquivo não vazio e clique em **Enviar**; a lista é
atualizada após o envio. Use **Baixar** para salvar o arquivo com o nome original
ou **Atualizar lista** para consultar novamente. A interface informa carregamento
e erros em cada operação.

O cliente em `frontend/src/services/api.js` usa `fetch` com o prefixo `/api` e
envia `X-User-Id` em upload, listagem e download. O proxy de desenvolvimento do
Vite remove o prefixo e encaminha as chamadas para `http://localhost:3000`.
Em produção, configure o servidor HTTP para encaminhar `/api` ao backend com
a mesma reescrita; o build estático não inclui o proxy de desenvolvimento.

Execute `npm test` na pasta `frontend` para testar o cliente de API e
`npm run build` para gerar o build de produção.

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
