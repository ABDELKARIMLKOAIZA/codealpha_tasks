// Importer sqlite3
const sqlite3 = require("sqlite3").verbose();

// Créer ou ouvrir la base de données database.db
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données :", err.message);
  } else {
    console.log("Connexion réussie à SQLite.");
  }
});

// Créer les tables
db.serialize(() => {
  // Table users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

  // Table products
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      image TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `);

  // Table orders
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      total INTEGER NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL
    )
  `);

  // Table order_items
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL
    )
  `);

  // Ajouter les produits seulement si la table products est vide
  db.get("SELECT COUNT(*) AS count FROM products", (err, row) => {
    if (err) {
      console.error(err.message);
      return;
    }

    if (row.count === 0) {
      const insertProduct = db.prepare(`
        INSERT INTO products (name, price, image, description)
        VALUES (?, ?, ?, ?)
      `);

      insertProduct.run(
        "Laptop HP",
        7500,
        "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
        "Ordinateur portable rapide pour travail et études."
      );

      insertProduct.run(
        "Casque Bluetooth",
        450,
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
        "Casque sans fil avec bonne qualité sonore."
      );

      insertProduct.run(
        "Smartphone",
        3200,
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
        "Téléphone moderne avec grande autonomie."
      );

      insertProduct.run(
        "Montre connectée",
        900,
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
        "Montre intelligente pour sport et notifications."
      );

      insertProduct.finalize();

      console.log("Produits ajoutés dans la base de données.");
    }
  });
});

// Fonctions utiles pour utiliser SQLite avec async/await
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Exporter les fonctions pour les utiliser dans server.js
module.exports = {
  db,
  run,
  get,
  all,
};