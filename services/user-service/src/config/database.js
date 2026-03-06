import { Sequelize, DataTypes } from "sequelize";

const sequelize = new Sequelize(
  process.env.DB_NAME || "hotel_db",
  process.env.DB_USER || "hoteluser",
  process.env.DB_PASSWORD || "hotelpass",
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);

// -- Models ------------------------------------------------------------------

export const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    password: { type: DataTypes.STRING(255), allowNull: false },
    first_name: { type: DataTypes.STRING(100), allowNull: false },
    last_name: { type: DataTypes.STRING(100), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    role: { type: DataTypes.STRING(20), defaultValue: "customer" },
  },
  {
    tableName: "users",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

// -- Helpers ------------------------------------------------------------------

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log("Connected to PostgreSQL via Sequelize");
    // sync({ alter: true }) keeps the existing data and adjusts schema
    await sequelize.sync({ alter: false });
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
}

export async function testConnection() {
  await sequelize.authenticate();
}

export { sequelize };
