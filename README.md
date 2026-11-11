# 7 Passos da Matrícula

Roteiro estático publicado pelo GitHub Pages a partir da branch `main`.

## Editar e publicar

- **Salvar rascunho** guarda a edição somente no navegador atual.
- **Publicar no site** salva o roteiro em `published-content.json`, com histórico no GitHub. Outros navegadores consultam esse conteúdo ao abrir o site.
- Para publicar, crie um token fine-grained no GitHub, selecione apenas `7-passos-matricula` e habilite **Contents: Read and write**. Informe-o apenas no campo privado do site. O token não é armazenado e é enviado somente à API do GitHub.
- Os nomes da barra de personalização permanecem locais e não entram na publicação.
- Rascunhos antigos continuam disponíveis no navegador. **Ver publicado** abre a versão compartilhada e guarda uma cópia recuperável em **Recuperar rascunho**.
- Uma edição baseada em versão desatualizada não sobrescreve silenciosamente uma publicação mais recente.

Backups JSON continuam disponíveis para exportação e importação. Na indisponibilidade da fonte compartilhada, o site tenta usar a cópia do Pages, o cache local e o conteúdo original incorporado.

## Testes

Com Node.js e Chrome instalados, execute na raiz do projeto:

```powershell
npm.cmd install --prefix .qa-tools --no-save --package-lock=false playwright-core
node tests/shared-persistence.cjs
```

A suíte usa navegadores isolados e respostas simuladas da API; não publica conteúdo de teste no repositório. Defina `CHROME_PATH` se o executável do Chrome estiver em outro local.

Se a API recusar a publicação, o site mostra o código HTTP e a mensagem do GitHub. Em **Publicar pelo GitHub sem token**, baixe `published-content.json`, envie-o pelo link indicado e confirme **Commit changes**. O arquivo baixado sozinho ainda não foi publicado.
