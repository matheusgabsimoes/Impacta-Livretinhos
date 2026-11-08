# Livretinhos

Sistema de administracao de livraria com FastAPI, React, PostgreSQL e Docker Compose.

## Executar

Copie `.env.example` para `.env` e configure as variaveis. No WSL, a partir da pasta deste projeto:

```sh
docker compose up --build -d
```

O frontend fica em http://localhost:5173 e a documentacao da API em http://localhost:8000/docs. O backend aplica as migrations ao iniciar.

## Administrador inicial

Depois de aplicar a migration, cadastre `admin@email.com` pela tela de login se a conta ainda nao existir. Escolha a senha no cadastro. Em seguida, no WSL:

```sh
docker compose exec -T backend python -m app.promote_admin admin@email.com
```

O comando falha sem alterar dados se a conta nao existir. Contas publicas e contas existentes na migration comecam como `atendente`; um administrador pode alterar seus perfis no painel. Novos bancos precisam repetir a promocao.

## Estoque e testes

A quantidade inicial e informada ao cadastrar o livro. Depois, entradas e saidas devem ser registradas como movimentacoes. Registros com historico nao podem ser excluidos.

```sh
docker compose exec -T backend python -m unittest discover -s tests -v
```

Caso use um seed SQL local, revise seu conteudo antes de executa-lo: alguns seeds atualizam quantidade e preco de titulos existentes e podem sobrescrever saldos atuais.
