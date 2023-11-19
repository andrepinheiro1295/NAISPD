# README

## Sistema de Registro e Avaliação de Atendidos

Desenvolvemos é um sistema em **Node.js** utilizando o framework **Express**, juntamente com o banco de dados **PostgreSQL** para o registro e avaliação de atendidos. O sistema permite a inserção, pesquisa, alteração e avaliação de informações relacionadas aos atendidos. Nosso objetivo é automatizar os processos administrativos de uma instituição de apoio para pessoas com deficiência.

### Configuração do Banco de Dados

O banco de dados utilizado foi o **PostgreSQL** . Sugerimos que tenha ele instalado e configurado em sua máquina. 
No arquivo `index.js`, as configurações do banco de dados estão definidas da seguinte forma:

```javascript
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "NAISPD",
  password: "7AJ7KCEKNf.",
  port: 5432,
});
```

## Dependências

As principais dependências do projeto são:

* Express: Framework web para Node.js.
* Body-parser: Middleware para analisar corpos de requisição.
* pg: Cliente PostgreSQL para Node.js.

Certifique-se de ter essas dependências instaladas antes de executar o aplicativo. Você pode instalá-las executando o seguinte comando:

```bash
    npm i express body-parser pg
    npm i nodemon
```

## Iniciando o Aplicativo

Certifique-se de ter o Node.js instalado em sua máquina. Para iniciar o aplicativo, execute o seguinte comando no terminal:

``` bash
    node index.js
```

O aplicativo será iniciado e estará acessível em http://localhost:3000. Certifique-se de substituir a porta se necessário, de acordo com a configuração no arquivo app.js.

## Funcionalidades Principais

Inserção de Dados
A rota /criar permite a inserção de novos registros de atendidos no banco de dados.

Pesquisa de Dados
A rota /buscar possibilita a busca de atendidos com base em critérios como nome, idade, responsável, raça, deficiência e sexo.

Alteração de Dados
A rota /alterar permite a modificação de informações de atendidos, como avaliações e metas.

Avaliação de Atendidos
A rota /pia.ejs permite a avaliação detalhada de atendidos, incluindo eixos de deficiência, família, comunidade com deficiência, entre outros.

## Páginas Disponíveis

inserir.ejs: Página para visualização e inserção de novos registros de atendidos.
pesquisar.ejs: Página para pesquisa e listagem de atendidos, paginada para facilitar a navegação.
pia.ejs: Página para avaliação detalhada e alteração de dados de atendidos.

## Observações

Certifique-se de que o PostgreSQL esteja em execução e que o banco de dados NAISPD esteja criado. O script SQL para criar a tabela atendidos pode ser encontrado no código-fonte.

Este README fornece uma visão geral do sistema e instruções básicas para configuração e execução. Sinta-se à vontade para explorar e expandir as funcionalidades conforme necessário para atender aos requisitos específicos do seu projeto.

## Estrutura de Diretórios

O projeto segue a seguinte estrutura de diretórios:

``` lua
/
|-- public/
|   |-- [arquivos estáticos]
|-- views/
|   |-- inserir.ejs
|   |-- pesquisar.ejs
|   |-- pia.ejs
|-- app.js
|-- [outros arquivos]
```

* public/: Contém arquivos estáticos como folhas de estilo e scripts.
* views/: Armazena os arquivos de visualização EJS para as páginas do aplicativo.
* app.js: O arquivo principal do aplicativo que contém a lógica e as configurações do servidor.

## Licença e direitos de uso.

Este projeto não esta liberado para uso por terceiros além do NAISPD Superação.
Todos os direitos estão reservados ao grupo 08 do Projeto Integrador II - 2/2023 - UNIVESP - na forma da Lei.
