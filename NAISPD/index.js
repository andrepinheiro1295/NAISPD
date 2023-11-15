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
  password: "7AJ7KCEKNf.",
  port: 5432,
});

const PAGE_SIZE = 20;
let peopleData = [];

app.post('/criar', (req, res) => {
  const { nome, telefone, email, dataNascimento, rg, cpf } = req.body;

  db.query(
    "INSERT INTO atendidos (nome, telefone, email, datanascimento, rg, cpf) VALUES ($1, $2, $3, $4, $5, $6)",
    [nome, telefone, email, dataNascimento, rg, cpf],
    (error, result) => {
      if (error) {
        console.error('Error while inserting data:', error);
        return res.status(500).send('Error while inserting data.');
      }

      if (nome && telefone && email && dataNascimento && rg && cpf) {

        return res.redirect('/inserir');
      } else {
        return res.status(400).send('Preencha todos os campos corretamente.');
      }
    }
  );
});

app.post('/buscar', (req, res) => {
    const { nome_buscar, idade, responsavel_buscar, raca_buscar, deficiencia_buscar, sexo_buscar } = req.body;
  
    const intervalosIdade = {
      'all': [0, 100],
      '10-18': [10, 18],
      '18-30': [18, 30],
      '18-60': [18, 60],
      '60+': [60, Infinity],
    };
  
    const [idadeMin, idadeMax] = intervalosIdade[idade] || [0, Infinity];
  
    const pessoasFiltradas = peopleData.filter((pessoa) => {
      const dataNascimento = new Date(pessoa.dataNascimento);
      const dataAtual = new Date();
      const diferencaAnos = dataAtual.getFullYear() - dataNascimento.getFullYear();
      const idadeCalculada = diferencaAnos;
  
      const atendeIdadeRequisito = idadeCalculada >= idadeMin && idadeCalculada <= idadeMax;
  
      const isNomeMatch = !nome_buscar || pessoa.nome.toLowerCase().includes(nome_buscar.toLowerCase());
      const isResponsavelMatch = !responsavel_buscar || pessoa.responsavel.toLowerCase() === responsavel_buscar.toLowerCase();
      const isRacaMatch = !raca_buscar || pessoa.raca.toLowerCase() === raca_buscar.toLowerCase();
      const isDeficienciaMatch = !deficiencia_buscar || pessoa.deficiencia.toLowerCase().includes(deficiencia_buscar.toLowerCase());
      const isGeneroMatch = !sexo_buscar || pessoa.genero.toLowerCase() === sexo_buscar.toLowerCase();
  
      return isNomeMatch && atendeIdadeRequisito && isResponsavelMatch && isRacaMatch && isDeficienciaMatch && isGeneroMatch;
    });
    console.log(pessoasFiltradas);
    res.render('pesquisar.ejs', {peopleData: pessoasFiltradas});
  });  


  app.get('/inserir', (req, res) => {
    
    
    db.query(`SELECT nome, telefone, email, datanascimento, rg, cpf, EXTRACT(YEAR FROM AGE(NOW(), datanascimento)) AS idade FROM atendidos`, (err, dataResult) => {
      if (err) {
        console.error("Error fetching data:", err);
        return res.status(500).send('Error fetching data');
      }
      const peopleData = dataResult.rows;
      res.render('inserir.ejs', {peopleData});
    })}
);
 
 
  db.connect();

app.get('/', (req, res) => {
  let total_count;

  db.query(`SELECT COUNT(*) AS total_count FROM atendidos`, (err, countResult) => {
    if (err) {
      console.error("Error fetching count:", err);
      return res.status(500).send('Error fetching count');
    }

    total_count = countResult.rows[0].total_count;

    db.query(`SELECT nome, telefone, email, datanascimento, rg, cpf, EXTRACT(YEAR FROM AGE(NOW(), datanascimento)) AS idade FROM atendidos`, (err, dataResult) => {
      if (err) {
        console.error("Error fetching data:", err);
        return res.status(500).send('Error fetching data');
      }

      const peopleData = dataResult.rows;

      const page = req.query.page || 1; // Get the requested page number from the query string
      const offset = (page - 1) * PAGE_SIZE; // Calculate the offset for pagination
      const paginatedData = peopleData.slice(offset, offset + PAGE_SIZE);

      res.render('pesquisar.ejs', {
        peopleData: paginatedData,
        currentPage: parseInt(page), // Provide the current page to the EJS file
        totalEntries: total_count // Pass the total count to the template
      });
    });
  });
});


app.get('/alterar', (req, res) => {
  const id = req.query.id;

  if (!id || id.trim() === '') {
    return res.status(400).send('Invalid ID');
  }

  db.query('SELECT * FROM atendidos WHERE id = $1', [id], (err, dataResult) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).send('Error fetching data');
    } else {
      if (dataResult.rows.length > 0) {
        const personData = dataResult.rows[0];
        res.render('pia.ejs', { id, personData });
      } else {
        return res.status(404).send('Data not found');
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
  res.render('pia.ejs');
});


app.get('/base.ejs', (req, res) => {
  res.render('base.ejs');
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
