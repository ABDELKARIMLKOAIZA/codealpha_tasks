// Importer Express
const express = require("express");

// Importer express-session pour gérer le panier et la connexion
const session = require("express-session");

// Importer bcryptjs pour protéger les mots de passe
const bcrypt = require("bcryptjs");

// Importer les fonctions SQLite depuis db.js
const { run, get, all } = require("./db");

// Créer l'application Express
const app = express();

// Dire à Express qu'on utilise EJS
app.set("view engine", "ejs");

// Dire à Express que les fichiers CSS/images sont dans le dossier public
app.use(express.static("public"));

// Permettre à Express de lire les données des formulaires HTML
app.use(express.urlencoded({ extended: true }));

// Configurer la session
app.use(
  session({
    secret: "secret-ecommerce",
    resave: false,
    saveUninitialized: true,
  })
);

// Variables disponibles dans toutes les pages EJS
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;

  res.locals.cartCount = req.session.cart
    ? req.session.cart.reduce((total, item) => total + item.quantity, 0)
    : 0;

  next();
});

// Middleware pour vérifier si l'utilisateur est connecté
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.render("login", {
      error: "Vous devez vous connecter avant de passer une commande.",
      success: null,
    });
  }

  next();
}

// Route principale : page d'accueil
app.get("/", (req, res) => {
  res.render("home");
});

// Route des produits
app.get("/products", async (req, res) => {
  try {
    const products = await all("SELECT * FROM products");

    res.render("products", {
      products: products,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

// Route pour afficher les détails d'un produit
app.get("/products/:id", async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    const product = await get("SELECT * FROM products WHERE id = ?", [
      productId,
    ]);

    if (!product) {
      return res.status(404).send("Produit non trouvé");
    }

    res.render("product-details", {
      product: product,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

// Route pour ajouter un produit au panier
app.post("/cart/add/:id", async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    const product = await get("SELECT * FROM products WHERE id = ?", [
      productId,
    ]);

    if (!product) {
      return res.status(404).send("Produit non trouvé");
    }

    if (!req.session.cart) {
      req.session.cart = [];
    }

    const existingProduct = req.session.cart.find(
      (item) => item.id === productId
    );

    if (existingProduct) {
      existingProduct.quantity += 1;
    } else {
      req.session.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
      });
    }

    res.redirect("/cart");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

// Route pour afficher le panier
app.get("/cart", (req, res) => {
  const cart = req.session.cart || [];

  let total = 0;

  cart.forEach((item) => {
    total += item.price * item.quantity;
  });

  res.render("cart", {
    cart: cart,
    total: total,
  });
});

// Route pour supprimer un produit du panier
app.post("/cart/remove/:id", (req, res) => {
  const productId = parseInt(req.params.id);

  if (req.session.cart) {
    req.session.cart = req.session.cart.filter((item) => item.id !== productId);
  }

  res.redirect("/cart");
});

// Afficher la page register
app.get("/register", (req, res) => {
  res.render("register", {
    error: null,
    success: null,
  });
});

// Traiter le formulaire register
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.render("register", {
        error: "Tous les champs sont obligatoires.",
        success: null,
      });
    }

    const existingUser = await get("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (existingUser) {
      return res.render("register", {
        error: "Cet email est déjà utilisé.",
        success: null,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    res.render("login", {
      error: null,
      success: "Compte créé avec succès. Connectez-vous maintenant.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

// Afficher la page login
app.get("/login", (req, res) => {
  res.render("login", {
    error: null,
    success: null,
  });
});

// Traiter le formulaire login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", {
        error: "Email et mot de passe obligatoires.",
        success: null,
      });
    }

    const user = await get("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) {
      return res.render("login", {
        error: "Email ou mot de passe incorrect.",
        success: null,
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.render("login", {
        error: "Email ou mot de passe incorrect.",
        success: null,
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

// Déconnexion
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Afficher la page checkout
app.get("/checkout", requireLogin, (req, res) => {
  const cart = req.session.cart || [];

  if (cart.length === 0) {
    return res.redirect("/cart");
  }

  let total = 0;

  cart.forEach((item) => {
    total += item.price * item.quantity;
  });

  res.render("checkout", {
    cart: cart,
    total: total,
    error: null,
  });
});

// Traiter la commande
app.post("/checkout", requireLogin, async (req, res) => {
  try {
    const { address, phone, paymentMethod } = req.body;

    const cart = req.session.cart || [];

    if (cart.length === 0) {
      return res.redirect("/cart");
    }

    let total = 0;

    cart.forEach((item) => {
      total += item.price * item.quantity;
    });

    if (!address || !phone || !paymentMethod) {
      return res.render("checkout", {
        cart: cart,
        total: total,
        error: "Tous les champs sont obligatoires.",
      });
    }

    const date = new Date().toLocaleString("fr-FR");

    const orderResult = await run(
      `
      INSERT INTO orders 
      (user_id, user_name, user_email, total, address, phone, payment_method, status, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.session.user.id,
        req.session.user.name,
        req.session.user.email,
        total,
        address,
        phone,
        paymentMethod,
        "En cours de traitement",
        date,
      ]
    );

    const orderId = orderResult.lastID;

    for (const item of cart) {
      await run(
        `
        INSERT INTO order_items
        (order_id, product_id, product_name, price, quantity)
        VALUES (?, ?, ?, ?, ?)
        `,
        [orderId, item.id, item.name, item.price, item.quantity]
      );
    }

    const newOrder = {
      id: orderId,
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      items: cart,
      total: total,
      address: address,
      phone: phone,
      paymentMethod: paymentMethod,
      status: "En cours de traitement",
      date: date,
    };

    req.session.cart = [];
    res.locals.cartCount = 0;

    res.render("order-success", {
      order: newOrder,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

// Afficher les commandes de l'utilisateur connecté
app.get("/orders", requireLogin, async (req, res) => {
  try {
    const ordersFromDb = await all(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC",
      [req.session.user.id]
    );

    const userOrders = [];

    for (const order of ordersFromDb) {
      const items = await all(
        "SELECT * FROM order_items WHERE order_id = ?",
        [order.id]
      );

      userOrders.push({
        id: order.id,
        userId: order.user_id,
        userName: order.user_name,
        userEmail: order.user_email,
        total: order.total,
        address: order.address,
        phone: order.phone,
        paymentMethod: order.payment_method,
        status: order.status,
        date: order.date,
        items: items.map((item) => ({
          id: item.id,
          productId: item.product_id,
          name: item.product_name,
          price: item.price,
          quantity: item.quantity,
        })),
      });
    }

    res.render("orders", {
      orders: userOrders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

// Lancer le serveur
app.listen(3000, () => {
  console.log("Serveur lancé sur http://localhost:3000");
});