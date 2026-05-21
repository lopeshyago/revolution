import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import pg from "pg";
import { DatabaseState, Client, AppConfig, ClientStatus, SignupLink, ReferralAgent } from "./src/types.js";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "database.json");

app.use(express.json());

// --- POSTGRESQL POOL INITIALIZATION ---
const { Pool } = pg;
const usePostgres = !!process.env.DATABASE_URL;
let pgPool: pg.Pool | null = null;

if (usePostgres) {
  console.log("PostgreSQL database URL detected. Initializing database pool...");
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false } // Common setting for direct cloud connections (Heroku, Render, Easypanel, etc.)
  });
} else {
  console.log("No PostgreSQL DATABASE_URL found. Running with local 'database.json' storage.");
}

// --- DATABASE SCHEMAS DEFINITION & AUTO-SEED IF POSTGRES ---
async function initPgDatabase() {
  if (!pgPool) return;
  const client = await pgPool.connect();
  try {
    // 1. Config Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        id INT PRIMARY KEY DEFAULT 1,
        default_cashback NUMERIC(10, 2) NOT NULL DEFAULT 50,
        default_invite_value NUMERIC(10, 2) NOT NULL DEFAULT 30,
        default_referral_commission NUMERIC(10, 2) NOT NULL DEFAULT 40,
        CONSTRAINT single_row CHECK (id = 1)
      );
    `);

    // 2. Signup Links Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS signup_links (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        value NUMERIC(10, 2) NOT NULL,
        url TEXT,
        notes TEXT,
        created_at VARCHAR(100) NOT NULL
      );
    `);

    // 3. Referral Agents Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_agents (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        commission_value NUMERIC(10, 2) NOT NULL,
        notes TEXT,
        created_at VARCHAR(100) NOT NULL
      );
    `);

    // 4. Clients Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        whatsapp VARCHAR(50) NOT NULL,
        referred_by VARCHAR(255),
        signup_link_owner VARCHAR(255),
        signup_link_value NUMERIC(10, 2) NOT NULL,
        invite_link TEXT,
        own_invite_value NUMERIC(10, 2) NOT NULL,
        notes TEXT,
        status VARCHAR(100) NOT NULL,
        cashback_amount NUMERIC(10, 2) NOT NULL,
        created_at VARCHAR(100) NOT NULL,
        status_updated_at VARCHAR(100) NOT NULL
      );
    `);

    // Bootstrap app config initial row if none exists
    const configCheck = await client.query(`SELECT 1 FROM app_config WHERE id = 1`);
    if (configCheck.rowCount === 0) {
      await client.query(`
        INSERT INTO app_config (id, default_cashback, default_invite_value, default_referral_commission)
        VALUES (1, 50, 30, 40)
      `);
    }

    // Bootstrap standard signup links if empty
    const linksCheck = await client.query(`SELECT 1 FROM signup_links LIMIT 1`);
    if (linksCheck.rowCount === 0) {
      await client.query(`
        INSERT INTO signup_links (id, name, value, notes, created_at)
        VALUES 
        ('sl_1', 'Márcia (R$ 50)', 50, 'Link principal de divulgação Márcia', $1),
        ('sl_2', 'Cauê (R$ 30)', 30, 'Link padrão do blog de Cauê', $2)
      `, [new Date().toISOString(), new Date().toISOString()]);
    }

    // Bootstrap standard referral agents if empty
    const agentsCheck = await client.query(`SELECT 1 FROM referral_agents LIMIT 1`);
    if (agentsCheck.rowCount === 0) {
      await client.query(`
        INSERT INTO referral_agents (id, name, commission_value, notes, created_at)
        VALUES 
        ('ra_1', 'Cauê', 30, 'Indicação direta por Cauê', $1),
        ('ra_2', 'Márcia', 50, 'Indicação direta por Márcia', $2)
      `, [new Date().toISOString(), new Date().toISOString()]);
    }

    console.log("PostgreSQL database setup and auto-seeding completed.");
  } catch (err) {
    console.error("Failed to initialize custom PostgreSQL database:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Helper to load or initialize fallback JSON DB content
async function getJsonDatabase(): Promise<DatabaseState> {
  const defaultState: DatabaseState = {
    config: {
      defaultCashback: 50,
      defaultInviteValue: 30,
      defaultReferralCommission: 40,
    },
    clients: [],
    signupLinks: [
      { id: "sl_1", name: "Márcia (R$ 50)", value: 50, notes: "Link principal de divulgação Márcia", createdAt: new Date().toISOString() },
      { id: "sl_2", name: "Cauê (R$ 30)", value: 30, notes: "Link padrão do blog de Cauê", createdAt: new Date().toISOString() }
    ],
    referralAgents: [
      { id: "ra_1", name: "Cauê", commissionValue: 30, notes: "Indicação direta por Cauê", createdAt: new Date().toISOString() },
      { id: "ra_2", name: "Márcia", commissionValue: 50, notes: "Indicação direta por Márcia", createdAt: new Date().toISOString() }
    ]
  };

  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (!parsed.signupLinks) parsed.signupLinks = defaultState.signupLinks;
    if (!parsed.referralAgents) parsed.referralAgents = defaultState.referralAgents;
    return parsed;
  } catch (error) {
    await fs.writeFile(DB_FILE, JSON.stringify(defaultState, null, 2), "utf-8");
    return defaultState;
  }
}

// Helper to save fallback JSON DB content
async function saveJsonDatabase(state: DatabaseState): Promise<void> {
  await fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// Fetch complete postgres state
async function getPgState(): Promise<DatabaseState> {
  if (!pgPool) throw new Error("PostgreSQL pool not created");

  const [configRes, clientsRes, linksRes, agentsRes] = await Promise.all([
    pgPool.query(`SELECT default_cashback, default_invite_value, default_referral_commission FROM app_config WHERE id = 1`),
    pgPool.query(`SELECT * FROM clients ORDER BY created_at DESC`),
    pgPool.query(`SELECT * FROM signup_links ORDER BY created_at DESC`),
    pgPool.query(`SELECT * FROM referral_agents ORDER BY created_at DESC`)
  ]);

  const configRow = configRes.rows[0] || { default_cashback: 50, default_invite_value: 30, default_referral_commission: 40 };
  const config: AppConfig = {
    defaultCashback: Number(configRow.default_cashback),
    defaultInviteValue: Number(configRow.default_invite_value),
    defaultReferralCommission: Number(configRow.default_referral_commission)
  };

  const clients: Client[] = clientsRes.rows.map(row => ({
    id: row.id,
    name: row.name,
    whatsapp: row.whatsapp,
    referredBy: row.referred_by || undefined,
    signupLinkOwner: row.signup_link_owner || undefined,
    signupLinkValue: Number(row.signup_link_value),
    inviteLink: row.invite_link || undefined,
    ownInviteValue: Number(row.own_invite_value),
    notes: row.notes || undefined,
    status: row.status as ClientStatus,
    cashbackAmount: Number(row.cashback_amount),
    createdAt: row.created_at,
    statusUpdatedAt: row.status_updated_at
  }));

  const signupLinks: SignupLink[] = linksRes.rows.map(row => ({
    id: row.id,
    name: row.name,
    value: Number(row.value),
    url: row.url || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at
  }));

  const referralAgents: ReferralAgent[] = agentsRes.rows.map(row => ({
    id: row.id,
    name: row.name,
    commissionValue: Number(row.commission_value),
    notes: row.notes || undefined,
    createdAt: row.created_at
  }));

  return {
    config,
    clients,
    signupLinks,
    referralAgents
  };
}

// --- SECURE AUTHENTICATION MIDDLEWARE ---
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Only guard API endpoints
  if (!req.path.startsWith("/api")) {
    return next();
  }
  // Exclude login and health checks
  if (req.path === "/api/login" || req.path === "/api/health") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acesso não autorizado. Por favor realize login." });
  }

  const token = authHeader.split(" ")[1];
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const expectedToken = Buffer.from(adminUser + ":" + adminPassword).toString("base64");

  if (token !== expectedToken) {
    return res.status(401).json({ error: "Sessão expirada ou inválida. Por favor realize login novamente." });
  }

  next();
}

app.use(authMiddleware);

// ---------------------- API ROUTES ----------------------

// 1. Authentication Login (no signup, custom injected user and password)
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (username === adminUser && password === adminPassword) {
    const token = Buffer.from(adminUser + ":" + adminPassword).toString("base64");
    return res.json({ success: true, token, username: adminUser });
  }

  res.status(401).json({ error: "Usuário ou senha inválidos." });
});

// Check Active Authentication status
app.get("/api/check-auth", (req, res) => {
  res.json({ authorized: true });
});

// Fetch current dashboard state (global config + clients)
app.get("/api/state", async (req, res) => {
  try {
    if (usePostgres) {
      const state = await getPgState();
      res.json(state);
    } else {
      const state = await getJsonDatabase();
      res.json(state);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read database state", details: err.message });
  }
});

// Update global config values
app.post("/api/config", async (req, res) => {
  try {
    const { defaultCashback, defaultInviteValue, defaultReferralCommission } = req.body;
    const cashback = Number(defaultCashback) || 0;
    const inviteValue = Number(defaultInviteValue) || 0;
    const referralCommission = Number(defaultReferralCommission) || 0;

    if (usePostgres && pgPool) {
      await pgPool.query(`
        INSERT INTO app_config (id, default_cashback, default_invite_value, default_referral_commission)
        VALUES (1, $1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          default_cashback = EXCLUDED.default_cashback,
          default_invite_value = EXCLUDED.default_invite_value,
          default_referral_commission = EXCLUDED.default_referral_commission
      `, [cashback, inviteValue, referralCommission]);
      
      res.json({ defaultCashback: cashback, defaultInviteValue: inviteValue, defaultReferralCommission: referralCommission });
    } else {
      const db = await getJsonDatabase();
      db.config = {
        defaultCashback: cashback,
        defaultInviteValue: inviteValue,
        defaultReferralCommission: referralCommission,
      };
      await saveJsonDatabase(db);
      res.json(db.config);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save configurations", details: err.message });
  }
});

// Create a new client client-side & freeze regional values
app.post("/api/clients", async (req, res) => {
  try {
    const {
      name,
      whatsapp,
      referredBy,
      signupLinkOwner,
      signupLinkValue,
      inviteLink,
      ownInviteValue,
      notes,
    } = req.body;

    if (!name || !whatsapp) {
      return res.status(400).json({ error: "Nome e Whatsapp são obrigatórios." });
    }

    if (usePostgres && pgPool) {
      // Get config details
      const configRes = await pgPool.query(`SELECT default_cashback, default_invite_value FROM app_config WHERE id = 1`);
      const defaultCashback = Number(configRes.rows[0]?.default_cashback || 50);
      const defaultInviteVal = Number(configRes.rows[0]?.default_invite_value || 30);

      const cachedCashbackAmount = defaultCashback;
      const parsedSignupValue = signupLinkValue !== undefined ? Number(signupLinkValue) : defaultInviteVal;
      const parsedOwnInviteValue = ownInviteValue !== undefined ? Number(ownInviteValue) : defaultInviteVal;

      const newId = "cli_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      const clientObj: Client = {
        id: newId,
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        referredBy: referredBy ? referredBy.trim() : "",
        signupLinkOwner: signupLinkOwner ? signupLinkOwner.trim() : "",
        signupLinkValue: parsedSignupValue,
        inviteLink: inviteLink ? inviteLink.trim() : "",
        ownInviteValue: parsedOwnInviteValue,
        notes: notes ? notes.trim() : "",
        status: "Cadastrando",
        cashbackAmount: cachedCashbackAmount,
        createdAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString()
      };

      await pgPool.query(`
        INSERT INTO clients (id, name, whatsapp, referred_by, signup_link_owner, signup_link_value, invite_link, own_invite_value, notes, status, cashback_amount, created_at, status_updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        clientObj.id,
        clientObj.name,
        clientObj.whatsapp,
        clientObj.referredBy || null,
        clientObj.signupLinkOwner || null,
        clientObj.signupLinkValue,
        clientObj.inviteLink || null,
        clientObj.ownInviteValue,
        clientObj.notes || null,
        clientObj.status,
        clientObj.cashbackAmount,
        clientObj.createdAt,
        clientObj.statusUpdatedAt
      ]);

      res.status(201).json(clientObj);
    } else {
      const db = await getJsonDatabase();
      const cashbackAmount = db.config.defaultCashback;

      const newClient: Client = {
        id: "cli_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        referredBy: referredBy ? referredBy.trim() : "",
        signupLinkOwner: signupLinkOwner ? signupLinkOwner.trim() : "",
        signupLinkValue: signupLinkValue !== undefined ? Number(signupLinkValue) : db.config.defaultInviteValue,
        inviteLink: inviteLink ? inviteLink.trim() : "",
        ownInviteValue: ownInviteValue !== undefined ? Number(ownInviteValue) : db.config.defaultInviteValue,
        notes: notes ? notes.trim() : "",
        status: "Cadastrando",
        cashbackAmount,
        createdAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
      };

      db.clients.push(newClient);
      await saveJsonDatabase(db);
      res.status(201).json(newClient);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to register client", details: err.message });
  }
});

// Update client parameters (including state modifications)
app.put("/api/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      whatsapp,
      referredBy,
      signupLinkOwner,
      signupLinkValue,
      inviteLink,
      ownInviteValue,
      notes,
      status,
      cashbackAmount,
    } = req.body;

    if (usePostgres && pgPool) {
      const checkRes = await pgPool.query(`SELECT * FROM clients WHERE id = $1`, [id]);
      if (checkRes.rowCount === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      const oldClient = checkRes.rows[0];
      const statusChanged = status !== undefined && oldClient.status !== status;

      const nameVal = name !== undefined ? name.trim() : oldClient.name;
      const whatsappVal = whatsapp !== undefined ? whatsapp.trim() : oldClient.whatsapp;
      const referredByVal = referredBy !== undefined ? (referredBy ? referredBy.trim() : "") : (oldClient.referred_by || "");
      const signupLinkOwnerVal = signupLinkOwner !== undefined ? (signupLinkOwner ? signupLinkOwner.trim() : "") : (oldClient.signup_link_owner || "");
      const signupLinkValueVal = signupLinkValue !== undefined ? Number(signupLinkValue) : Number(oldClient.signup_link_value);
      const inviteLinkVal = inviteLink !== undefined ? (inviteLink ? inviteLink.trim() : "") : (oldClient.invite_link || "");
      const ownInviteValueVal = ownInviteValue !== undefined ? Number(ownInviteValue) : Number(oldClient.own_invite_value);
      const notesVal = notes !== undefined ? (notes ? notes.trim() : "") : (oldClient.notes || "");
      const statusVal = status !== undefined ? status : oldClient.status;
      const cashbackAmountVal = cashbackAmount !== undefined ? Number(cashbackAmount) : Number(oldClient.cashback_amount);
      const statusUpdatedAtVal = statusChanged ? new Date().toISOString() : oldClient.status_updated_at;

      await pgPool.query(`
        UPDATE clients SET
          name = $1,
          whatsapp = $2,
          referred_by = $3,
          signup_link_owner = $4,
          signup_link_value = $5,
          invite_link = $6,
          own_invite_value = $7,
          notes = $8,
          status = $9,
          cashback_amount = $10,
          status_updated_at = $11
        WHERE id = $12
      `, [
        nameVal,
        whatsappVal,
        referredByVal || null,
        signupLinkOwnerVal || null,
        signupLinkValueVal,
        inviteLinkVal || null,
        ownInviteValueVal,
        notesVal || null,
        statusVal,
        cashbackAmountVal,
        statusUpdatedAtVal,
        id
      ]);

      const updatedClient: Client = {
        id,
        name: nameVal,
        whatsapp: whatsappVal,
        referredBy: referredByVal,
        signupLinkOwner: signupLinkOwnerVal,
        signupLinkValue: signupLinkValueVal,
        inviteLink: inviteLinkVal,
        ownInviteValue: ownInviteValueVal,
        notes: notesVal,
        status: statusVal as ClientStatus,
        cashbackAmount: cashbackAmountVal,
        createdAt: oldClient.created_at,
        statusUpdatedAt: statusUpdatedAtVal
      };

      res.json(updatedClient);
    } else {
      const db = await getJsonDatabase();
      const index = db.clients.findIndex((c) => c.id === id);

      if (index === -1) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      const oldClient = db.clients[index];
      const statusChanged = oldClient.status !== status;

      db.clients[index] = {
        ...oldClient,
        name: name !== undefined ? name.trim() : oldClient.name,
        whatsapp: whatsapp !== undefined ? whatsapp.trim() : oldClient.whatsapp,
        referredBy: referredBy !== undefined ? referredBy.trim() : oldClient.referredBy,
        signupLinkOwner: signupLinkOwner !== undefined ? signupLinkOwner.trim() : oldClient.signupLinkOwner,
        signupLinkValue: signupLinkValue !== undefined ? Number(signupLinkValue) : oldClient.signupLinkValue,
        inviteLink: inviteLink !== undefined ? inviteLink.trim() : oldClient.inviteLink,
        ownInviteValue: ownInviteValue !== undefined ? Number(ownInviteValue) : oldClient.ownInviteValue,
        notes: notes !== undefined ? notes.trim() : oldClient.notes,
        status: status !== undefined ? (status as ClientStatus) : oldClient.status,
        cashbackAmount: cashbackAmount !== undefined ? Number(cashbackAmount) : oldClient.cashbackAmount,
        statusUpdatedAt: statusChanged ? new Date().toISOString() : oldClient.statusUpdatedAt,
      };

      await saveJsonDatabase(db);
      res.json(db.clients[index]);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update client details", details: err.message });
  }
});

// Delete standard clients from records
app.delete("/api/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (usePostgres && pgPool) {
      const beforeRes = await pgPool.query(`SELECT 1 FROM clients WHERE id = $1`, [id]);
      if (beforeRes.rowCount === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }
      await pgPool.query(`DELETE FROM clients WHERE id = $1`, [id]);
      res.json({ success: true, id });
    } else {
      const db = await getJsonDatabase();
      const beforeCount = db.clients.length;

      db.clients = db.clients.filter((c) => c.id !== id);

      if (db.clients.length === beforeCount) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      await saveJsonDatabase(db);
      res.json({ success: true, id });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete client record", details: err.message });
  }
});

// --- CADASTRO DE LINKS DE INDICAÇÃO (Signup Links) ---

app.get("/api/signup-links", async (req, res) => {
  try {
    if (usePostgres && pgPool) {
      const { rows } = await pgPool.query(`SELECT * FROM signup_links ORDER BY created_at DESC`);
      const links: SignupLink[] = rows.map(r => ({
        id: r.id,
        name: r.name,
        value: Number(r.value),
        url: r.url || undefined,
        notes: r.notes || undefined,
        createdAt: r.created_at
      }));
      res.json(links);
    } else {
      const db = await getJsonDatabase();
      res.json(db.signupLinks || []);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao carregar links de indicação", details: err.message });
  }
});

app.post("/api/signup-links", async (req, res) => {
  try {
    const { name, value, url, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Nome é obrigatório." });
    }

    if (usePostgres && pgPool) {
      const configRes = await pgPool.query(`SELECT default_invite_value FROM app_config WHERE id = 1`);
      const defaultInviteValue = Number(configRes.rows[0]?.default_invite_value || 30);

      const parsedValue = value !== undefined ? Number(value) : defaultInviteValue;
      const newId = "sl_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      
      const newLink: SignupLink = {
        id: newId,
        name: name.trim(),
        value: parsedValue,
        url: url ? url.trim() : "",
        notes: notes ? notes.trim() : "",
        createdAt: new Date().toISOString()
      };

      await pgPool.query(`
        INSERT INTO signup_links (id, name, value, url, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [newLink.id, newLink.name, newLink.value, newLink.url || null, newLink.notes || null, newLink.createdAt]);

      res.status(201).json(newLink);
    } else {
      const db = await getJsonDatabase();
      const newLink: SignupLink = {
        id: "sl_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        name: name.trim(),
        value: value !== undefined ? Number(value) : db.config.defaultInviteValue,
        url: url ? url.trim() : "",
        notes: notes ? notes.trim() : "",
        createdAt: new Date().toISOString()
      };
      if (!db.signupLinks) db.signupLinks = [];
      db.signupLinks.push(newLink);
      await saveJsonDatabase(db);
      res.status(201).json(newLink);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao criar link de indicação", details: err.message });
  }
});

app.put("/api/signup-links/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, value, url, notes } = req.body;

    if (usePostgres && pgPool) {
      const checkRes = await pgPool.query(`SELECT * FROM signup_links WHERE id = $1`, [id]);
      if (checkRes.rowCount === 0) {
        return res.status(404).json({ error: "Link de indicação não encontrado." });
      }

      const oldLink = checkRes.rows[0];
      const nameVal = name !== undefined ? name.trim() : oldLink.name;
      const valueVal = value !== undefined ? Number(value) : Number(oldLink.value);
      const urlVal = url !== undefined ? (url ? url.trim() : "") : (oldLink.url || "");
      const notesVal = notes !== undefined ? (notes ? notes.trim() : "") : (oldLink.notes || "");

      await pgPool.query(`
        UPDATE signup_links SET name = $1, value = $2, url = $3, notes = $4 WHERE id = $5
      `, [nameVal, valueVal, urlVal || null, notesVal || null, id]);

      const updatedLink: SignupLink = {
        id,
        name: nameVal,
        value: valueVal,
        url: urlVal,
        notes: notesVal,
        createdAt: oldLink.created_at
      };
      res.json(updatedLink);
    } else {
      const db = await getJsonDatabase();
      if (!db.signupLinks) db.signupLinks = [];
      const index = db.signupLinks.findIndex(l => l.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Link de indicação não encontrado." });
      }
      db.signupLinks[index] = {
        ...db.signupLinks[index],
        name: name !== undefined ? name.trim() : db.signupLinks[index].name,
        value: value !== undefined ? Number(value) : db.signupLinks[index].value,
        url: url !== undefined ? url.trim() : db.signupLinks[index].url,
        notes: notes !== undefined ? notes.trim() : db.signupLinks[index].notes
      };
      await saveJsonDatabase(db);
      res.json(db.signupLinks[index]);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao atualizar link de indicação", details: err.message });
  }
});

app.delete("/api/signup-links/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (usePostgres && pgPool) {
      const checkRes = await pgPool.query(`SELECT 1 FROM signup_links WHERE id = $1`, [id]);
      if (checkRes.rowCount === 0) {
        return res.status(404).json({ error: "Link de indicação não encontrado." });
      }
      await pgPool.query(`DELETE FROM signup_links WHERE id = $1`, [id]);
      res.json({ success: true, id });
    } else {
      const db = await getJsonDatabase();
      if (!db.signupLinks) db.signupLinks = [];
      const beforeCount = db.signupLinks.length;
      db.signupLinks = db.signupLinks.filter(l => l.id !== id);
      if (db.signupLinks.length === beforeCount) {
        return res.status(404).json({ error: "Link de indicação não encontrado." });
      }
      await saveJsonDatabase(db);
      res.json({ success: true, id });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao deletar link de indicação", details: err.message });
  }
});

// --- CADASTRO DE INDICAÇÕES (Referral Agents) ---

app.get("/api/referral-agents", async (req, res) => {
  try {
    if (usePostgres && pgPool) {
      const { rows } = await pgPool.query(`SELECT * FROM referral_agents ORDER BY created_at DESC`);
      const agents: ReferralAgent[] = rows.map(r => ({
        id: r.id,
        name: r.name,
        commissionValue: Number(r.commission_value),
        notes: r.notes || undefined,
        createdAt: r.created_at
      }));
      res.json(agents);
    } else {
      const db = await getJsonDatabase();
      res.json(db.referralAgents || []);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao carregar indicações", details: err.message });
  }
});

app.post("/api/referral-agents", async (req, res) => {
  try {
    const { name, commissionValue, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Nome do indicador é obrigatório." });
    }

    if (usePostgres && pgPool) {
      const configRes = await pgPool.query(`SELECT default_referral_commission FROM app_config WHERE id = 1`);
      const defaultCommission = Number(configRes.rows[0]?.default_referral_commission || 40);

      const parsedValue = commissionValue !== undefined ? Number(commissionValue) : defaultCommission;
      const newId = "ra_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);

      const newAgent: ReferralAgent = {
        id: newId,
        name: name.trim(),
        commissionValue: parsedValue,
        notes: notes ? notes.trim() : "",
        createdAt: new Date().toISOString()
      };

      await pgPool.query(`
        INSERT INTO referral_agents (id, name, commission_value, notes, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [newAgent.id, newAgent.name, newAgent.commissionValue, newAgent.notes || null, newAgent.createdAt]);

      res.status(201).json(newAgent);
    } else {
      const db = await getJsonDatabase();
      const newAgent: ReferralAgent = {
        id: "ra_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        name: name.trim(),
        commissionValue: commissionValue !== undefined ? Number(commissionValue) : db.config.defaultReferralCommission,
        notes: notes ? notes.trim() : "",
        createdAt: new Date().toISOString()
      };
      if (!db.referralAgents) db.referralAgents = [];
      db.referralAgents.push(newAgent);
      await saveJsonDatabase(db);
      res.status(201).json(newAgent);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao criar indicação direta", details: err.message });
  }
});

app.put("/api/referral-agents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, commissionValue, notes } = req.body;

    if (usePostgres && pgPool) {
      const checkRes = await pgPool.query(`SELECT * FROM referral_agents WHERE id = $1`, [id]);
      if (checkRes.rowCount === 0) {
        return res.status(404).json({ error: "Indicador não encontrado." });
      }

      const oldAgent = checkRes.rows[0];
      const nameVal = name !== undefined ? name.trim() : oldAgent.name;
      const commissionValueVal = commissionValue !== undefined ? Number(commissionValue) : Number(oldAgent.commission_value);
      const notesVal = notes !== undefined ? (notes ? notes.trim() : "") : (oldAgent.notes || "");

      await pgPool.query(`
        UPDATE referral_agents SET name = $1, commission_value = $2, notes = $3 WHERE id = $4
      `, [nameVal, commissionValueVal, notesVal || null, id]);

      const updatedAgent: ReferralAgent = {
        id,
        name: nameVal,
        commissionValue: commissionValueVal,
        notes: notesVal,
        createdAt: oldAgent.created_at
      };
      res.json(updatedAgent);
    } else {
      const db = await getJsonDatabase();
      if (!db.referralAgents) db.referralAgents = [];
      const index = db.referralAgents.findIndex(a => a.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Indicador não encontrado." });
      }
      db.referralAgents[index] = {
        ...db.referralAgents[index],
        name: name !== undefined ? name.trim() : db.referralAgents[index].name,
        commissionValue: commissionValue !== undefined ? Number(commissionValue) : db.referralAgents[index].commissionValue,
        notes: notes !== undefined ? notes.trim() : db.referralAgents[index].notes
      };
      await saveJsonDatabase(db);
      res.json(db.referralAgents[index]);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao atualizar indicador", details: err.message });
  }
});

app.delete("/api/referral-agents/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (usePostgres && pgPool) {
      const checkRes = await pgPool.query(`SELECT 1 FROM referral_agents WHERE id = $1`, [id]);
      if (checkRes.rowCount === 0) {
        return res.status(404).json({ error: "Indicação não encontrada." });
      }
      await pgPool.query(`DELETE FROM referral_agents WHERE id = $1`, [id]);
      res.json({ success: true, id });
    } else {
      const db = await getJsonDatabase();
      if (!db.referralAgents) db.referralAgents = [];
      const beforeCount = db.referralAgents.length;
      db.referralAgents = db.referralAgents.filter(a => a.id !== id);
      if (db.referralAgents.length === beforeCount) {
        return res.status(404).json({ error: "Indicação não encontrada." });
      }
      await saveJsonDatabase(db);
      res.json({ success: true, id });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao deletar indicação direta", details: err.message });
  }
});

// -------------------- STATIC FILES SERVER & VITE MIDDLEWARE --------------------

async function run() {
  if (usePostgres) {
    try {
      await initPgDatabase();
    } catch (err) {
      console.error("Postgres startup initialization failed. Falling back. Error:", err);
    }
  }

  // Serve files via Vite in development mode, or serve distribution files in build mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to host 0.0.0.0 and port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

run().catch((err) => {
  console.error("Failed to startup fullstack server:", err);
});
