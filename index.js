const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const PAGE_SIZE = 20;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "NAISPD",
  password: "7AJ7KCEKNf.",
  port: 5432,
});

const queryDatabase = async (query, values = []) => {
  const client = await pool.connect();
  try {
    const result = await client.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  } finally {
    client.release();
  }
};

const rollbackAndSendResponse = (res, client, done) => {
  client.query('ROLLBACK', (rollbackErr) => {
    done();
    if (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    res.status(500).send('Error updating data');
  });
};

app.get('/', async (req, res) => {
  try {
    const countResult = await queryDatabase('SELECT COUNT(*) AS total_count FROM atendidos');
    const total_count = countResult[0].total_count;

    const page = req.query.page || 1;
    const offset = (page - 1) * PAGE_SIZE;
    const dataResult = await queryDatabase(`
      SELECT 
        nome, 
        telefone, 
        email, 
        data_nascimento,
        rg, 
        cpf, 
        id, 
        EXTRACT(YEAR FROM AGE(NOW(), data_nascimento)) AS idade 
      FROM atendidos 
      OFFSET $1 LIMIT $2
    `, [offset, PAGE_SIZE]);

    console.log(dataResult);

    const peopleData = dataResult.map(person => ({
      ...person,
      idade: person.data_nascimento ? new Date().getFullYear() - new Date(person.data_nascimento).getFullYear() : null
    }));

    res.render('pesquisar.ejs', {
      peopleData,
      currentPage: parseInt(page),
      totalEntries: total_count
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).send('Error fetching data');
  }
});
app.get('/inserir', async (req, res) => {
  try {
    const dataResult = await queryDatabase(`
      SELECT 
        nome, 
        telefone, 
        email, 
        data_nascimento,
        rg, 
        cpf, 
        id, 
        EXTRACT(YEAR FROM AGE(NOW(), data_nascimento)) AS idade 
      FROM atendidos 
    `);

    res.render('inserir.ejs', { peopleData: dataResult });
  } catch (error) {
    console.error('Error fetching data for inserir:', error);
    res.status(500).send('Error fetching data for inserir');
  }
});

app.post('/buscar', async (req, res) => {
  const { nome_buscar, idade, responsavel_buscar, raca_buscar, deficiencia_buscar, sexo_buscar } = req.body;

  try {
    // Validation
    if (!idade || !nome_buscar) {
      return res.status(400).send('Os campos idade e nome para busca são obrigatórios.');
    }

    const allowedIdadeValues = ['all', '10-18', '18-30', '18-60', '60+'];
    if (!allowedIdadeValues.includes(idade)) {
      return res.status(400).send('Valor inválido para idade.');
    }

    const validOptionalFields = ['responsavel_buscar', 'raca_buscar', 'deficiencia_buscar', 'sexo_buscar'];
    const invalidOptionalFields = Object.keys(req.body).filter(field => !validOptionalFields.includes(field));

    if (invalidOptionalFields.length > 0) {
      return res.status(400).send(`Campos de busca inválidos: ${invalidOptionalFields.join(', ')}.`);
    }

    // Fetch data
    const dataResult = await queryDatabase(`
      SELECT nome, telefone, email, data_nascimento, rg, cpf, EXTRACT(YEAR FROM AGE(NOW(), data_nascimento)) AS idade
      FROM atendidos
      WHERE 
        nome ILIKE $1
        AND idade BETWEEN $2 AND $3
        AND (responsavel ILIKE $4 OR $4 IS NULL)
        AND (raca ILIKE $5 OR $5 IS NULL)
        AND (deficiencia ILIKE $6 OR $6 IS NULL)
        AND (genero ILIKE $7 OR $7 IS NULL)
    `, [
      `%${nome_buscar}%`,
      ...getAgeRange(idade),
      `%${responsavel_buscar}%`,
      `%${raca_buscar}%`,
      `%${deficiencia_buscar}%`,
      `%${sexo_buscar}%`
    ]);

    // Process data
    const pessoasFiltradas = dataResult.map(person => ({
      ...person,
      idade: person.data_nascimento ? new Date().getFullYear() - new Date(person.data_nascimento).getFullYear() : null
    }));

    // Render view
    res.render('pesquisar.ejs', { peopleData: pessoasFiltradas });
  } catch (error) {
    console.error('Error fetching search results:', error);
    res.status(500).send('Erro ao buscar dados.');
  }
});


function getAgeRange(idade) {
  const intervalosIdade = {
    'all': [0, 100],
    '10-18': [10, 18],
    '18-30': [18, 30],
    '18-60': [18, 60],
    '60+': [60, Infinity],
  };

  return intervalosIdade[idade] || [0, Infinity];
}

app.post('/criar', async (req, res) => {
  const { nome, telefone, email, dataNascimento, rg, cpf } = req.body;

  try {
    // Validation
    if (!nome || !telefone || !email || !dataNascimento || !rg || !cpf) {
      return res.status(400).send('Todos os campos são obrigatórios.');
    }

    const phoneRegex = /^\(\d{2}\) \d{5}-\d{4}$/;
    if (!phoneRegex.test(telefone)) {
      return res.status(400).send('Número de telefone inválido.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send('Endereço de e-mail inválido.');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dataNascimento)) {
      return res.status(400).send('Data de nascimento inválida. Use o formato AAAA-MM-DD.');
    }

    const rgRegex = /^[0-9]{7,}$/;
    if (!rgRegex.test(rg)) {
      return res.status(400).send('RG inválido.');
    }

    if (!validateCPF(cpf)) {
      return res.status(400).send('CPF inválido.');
    }

    // Database insertion
    await queryDatabase(
      'INSERT INTO atendidos (nome, telefone, email, data_nascimento, rg, cpf) VALUES ($1, $2, $3, $4, $5, $6)',
      [nome, telefone, email, dataNascimento, rg, cpf]
    );

    return res.redirect('/inserir');
  } catch (error) {
    console.error('Erro ao inserir dados:', error);
    return res.status(500).send('Erro ao inserir dados.');
  }
});
app.get('/alterar', async (req, res) => {
  // Check if the id is valid and ensure it is a string
  const id = parseInt(req.query.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).send('Invalid ID');
  }

  let dataResult;

  try {
    // Fetch data from the database based on the provided ID
    dataResult = await queryDatabase('SELECT * FROM atendidos WHERE id = $1', [id]);

    // Check if data is found
    if (dataResult && dataResult.length > 0) {
      const personData = dataResult[0]; // Access the first item in the array

      // Pass the id to pia.ejs to use in the endpoint along with the list of people
      res.render('pia.ejs', { id, personData });
    } else {
      return res.status(404).send('Data not found');
    }
  } catch (error) {
    // Handle errors during data retrieval
    console.error('Error fetching data:', error);
    return res.status(500).send('Error fetching data');
  }
});













app.post('/salvar_pia', async (req, res) => {
  console.log(req.body);
  const db = await pool.connect();
  const {
    id,
    nome,
    dataNascimento,
    idade,
    filiacao,
    enderecoFamilia,
    familiaresData,
    propostasPia,
    interfacesRedeExecutivaData,
    opiniaoUsuarioPia,
    opiniaoFamiliaPia,
    equipeTecnicaData,
    informacoesServico,
    motivoEncaminhamento,
    historicoPessoa,
    // ... add other fields from the form
  } = req.body;

  try {
    await db.query('BEGIN');

    // Update atendidos table
    await queryDatabase(
      `UPDATE atendidos 
      SET 
        nome = $1,
        data_nascimento = $2,
        idade = $3,
        filiacao = $4,
        endereco_familia = $5
      WHERE id = $6`,
      [nome, dataNascimento, idade, filiacao, enderecoFamilia, id],
      db
    );

    // Update familiares table
     for (const [index, familiarData] of familiaresData.entries()) {
      const {
        nome,
        data_nascimento,
        parentesco,
        servico,
        telefone,
        demanda,
      } = familiarData;

      const familiaresQuery = `
        INSERT INTO familiares (usuario_id, nome, data_nascimento, parentesco, servico_socioassistencial, telefone, demanda_apresentada)
        VALUES ($7, $1, $2, $3, $4, $5, $6)
        ON CONFLICT (usuario_id, id)
        DO UPDATE SET
          nome = $1,
          data_nascimento = $2,
          parentesco = $3,
          servico_socioassistencial = $4,
          telefone = $5,
          demanda_apresentada = $6;
      `;

      await queryDatabase(
        familiaresQuery,
        [nome, data_nascimento, parentesco, servico, telefone, demanda, id, index + 1],
        db
      );
    }


    // Update propostas_pia table
    const propostasPiaQuery = `
      INSERT INTO propostas_pia (usuario_id, propostas)
      VALUES ($2, $1)
      ON CONFLICT (usuario_id)
      DO UPDATE SET
        propostas = $1;
    `;
    await queryDatabase(propostasPiaQuery, [propostasPia, id], db);

    // Update interfaces_rede_executiva table
    for (const [index, interfaceData] of interfacesRedeExecutivaData.entries()) {
      const interfacesQuery = `
        INSERT INTO interfaces_rede_executiva (usuario_id, acao_encaminhamento, a_quem_destina, orgao_servico_atendimento)
        VALUES ($4, $1, $2, $3)
        ON CONFLICT (usuario_id, id)
        DO UPDATE SET
          acao_encaminhamento = $1,
          a_quem_destina = $2,
          orgao_servico_atendimento = $3;
      `;
      await queryDatabase(
        interfacesQuery,
        [
          interfaceData.acao_encaminhamento,
          interfaceData.a_quem_destina,
          interfaceData.orgao_servico_atendimento,
          id,
          index + 1,
        ],
        db
      );
    }

    // Update opinioes table
    const opinioesQuery = `
      INSERT INTO opinioes (usuario_id, opiniao_usuario_pia, opiniao_familia_pia)
      VALUES ($3, $1, $2)
      ON CONFLICT (usuario_id)
      DO UPDATE SET
        opiniao_usuario_pia = $1,
        opiniao_familia_pia = $2;
    `;
    await queryDatabase(opinioesQuery, [opiniaoUsuarioPia, opiniaoFamiliaPia, id], db);

    // Update equipe_tecnica table
    for (const [index, equipeData] of equipeTecnicaData.entries()) {
      const equipeTecnicaQuery = `
        INSERT INTO equipe_tecnica (usuario_id, nome, funcao)
        VALUES ($3, $1, $2)
        ON CONFLICT (usuario_id, id)
        DO UPDATE SET
          nome = $1,
          funcao = $2;
      `;
      await queryDatabase(
        equipeTecnicaQuery,
        [equipeData.nome, equipeData.funcao, id, index + 1],
        db
      );
    }

    // Update informacoes_servico table
    const informacoesServicoQuery = `
      INSERT INTO informacoes_servico (usuario_id, nome_servico, endereco_servico, email_servico, telefone_servico)
      VALUES ($2, $1, $2, $3, $4)
      ON CONFLICT (usuario_id)
      DO UPDATE SET
        nome_servico = $1,
        endereco_servico = $2,
        email_servico = $3,
        telefone_servico = $4;
    `;
    await queryDatabase(
      informacoesServicoQuery,
      [
     informacoesServico.nome_servico,
        informacoesServico.endereco_servico,
        informacoesServico.email_servico,
        informacoesServico.telefone_servico,
        id,
      ],
      db
    );

    // Commit the transaction if everything is successful
    await queryDatabase('COMMIT', [], db);

    // Send success response
    res.status(200).send('Data updated successfully');
  } catch (error) {
    console.error('Error updating data:', error);
    await queryDatabase('ROLLBACK', [], db);
    res.status(500).send('Error updating data');
  } finally {
    db.release();
  }
});



















app.get('/atendido.ejs', (req, res) => {
  res.render('atendido.ejs');
});

app.get('/pia.ejs', (req, res) => {
  const id = parseInt(req.query.id, 10);
  res.render('pia.ejs', { id });
  console.log(id)
});



app.get('/base.ejs', (req, res) => {
  res.render('base.ejs');
});

pool.connect()
.then(() => {
  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
})
.catch(err => console.error('Error connecting to the database:', err));

process.on('exit', () => {
pool.end();
});

  