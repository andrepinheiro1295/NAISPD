import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';

const app = express();
const port = 3000;


app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "NAISPD",
  password: ".",
  port: 5432,
});

const PAGE_SIZE = 20;
let peopleData = [];

const queryDatabase = async (query, values = []) => {
  try {
    const result = await db.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
};
 

app.get('/', async (req, res) => {
  try {
    const countResult = await db.query('SELECT COUNT(*) AS total_count FROM atendidos');
    const total_count = countResult.rows[0].total_count;

    const page = req.query.page || 1; 
    const offset = (page - 1) * PAGE_SIZE;
    const dataResult = await db.query(`
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
  
  console.log(dataResult.rows);

    peopleData = dataResult.rows.map(person => {
      return {
        ...person,
        idade: person.data_nascimento ? new Date().getFullYear() - new Date(person.data_nascimento).getFullYear() : null
      };
    });

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

app.get('/inserir', (req, res) => {

res.render('inserir', { peopleData: peopleData });
});

function validateCPF(cpf) {

  const cpfRegex = /^\d{11}$/;
  return cpfRegex.test(cpf);
}

app.post('/buscar', async (req, res) => {
  const { nome_buscar, idade, responsavel_buscar, raca_buscar, deficiencia_buscar, sexo_buscar } = req.body;

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

  try {
    const dataResult = await db.query(`
      SELECT nome, telefone, email, datanascimento, rg, cpf, EXTRACT(YEAR FROM AGE(NOW(), datanascimento)) AS idade
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

    const pessoasFiltradas = dataResult.rows;
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

app.post('/criar', (req, res) => {
  const { nome, telefone, email, dataNascimento, rg, cpf } = req.body;

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

  db.query(
    "INSERT INTO atendidos (nome, telefone, email, data_nascimento, rg, cpf) VALUES ($1, $2, $3, $4, $5, $6)",
    [nome, telefone, email, dataNascimento, rg, cpf],
    (error, result) => {
      if (error) {
        console.error('Erro ao inserir dados:', error);
        return res.status(500).send('Erro ao inserir dados.');
      }

      return res.redirect('/inserir');
    }
  );
});

 
app.get('/alterar', (req, res) => {
  const id = req.query.id;
  if (!id || id.toString().trim() === '') {
    return res.status(400).send('ID inválido');
}

  if (!id || id.trim() === '') {
    return res.status(400).send('ID inválido');
  }

  db.query('SELECT * FROM atendidos WHERE id = $1', [id], (err, dataResult) => {
    if (err) {
      console.error("Erro ao buscar dados:", err);
      return res.status(500).send('Erro ao buscar dados');
    } else {
      if (dataResult.rows.length > 0) {
        const personData = dataResult.rows[0];
        res.render('pia.ejs', { id, personData });
      } else {
        return res.status(404).send('Dados não encontrados');
      }
    }
  });
});



app.post('/salvar_pia', (req, res) => {
  const {
    eixo_deficiencia,
    eixo_familia,
    eixo_com_deficiencia,
    opiniao_atendido,
    opiniao_familia,
    avaliacao_familia,
    resumo_avaliacao,
    metas_acoes,
    resultado,
    id
  } = req.body;

  db.query(
    `UPDATE atendidos 
    SET 
       eixo_deficiencia = $1, 
       eixo_familia = $2,
       eixo_com_deficiencia = $3,
       opiniao_atendido = $4,
       opiniao_familia = $5,
       avaliacao_familia = $6,
       resumo_avaliacao = $7,
       metas_acoes = $8,
       resultado = $9
    WHERE id = $10`,
    [
      eixo_deficiencia,
      eixo_familia,
      eixo_com_deficiencia,
      opiniao_atendido,
      opiniao_familia,
      avaliacao_familia,
      resumo_avaliacao,
      metas_acoes,
      resultado,
      id
    ],
    (error, results) => {
      if (error) {
        console.error('Error updating data:', error);
        res.status(500).send('Error updating data');
      } else {
        res.status(200).send('Data updated successfully');
      }
    }
  );
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

db.connect()
  .then(() => {
    app.listen(port, () => {
      console.log(`Listening on port ${port}`);
    });
  })
  .catch(err => console.error('Error connecting to the database:', err));

  process.on('exit', () => {
    db.end();
  });
  