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
    pool: { max: 20, min: 0, acquire: 30000, idle: 10000 },
  },
);

// -- Models --------------------------------------------------------------------

export const Booking = sequelize.define(
  "Booking",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    room_id: { type: DataTypes.INTEGER, allowNull: false },
    total_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: { type: DataTypes.STRING(20), defaultValue: "pending" },
  },
  {
    tableName: "bookings",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export const Payment = sequelize.define(
  "Payment",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "bookings", key: "id" },
    },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    payment_method: { type: DataTypes.STRING(50), allowNull: false },
    payment_status: { type: DataTypes.STRING(20), defaultValue: "pending" },
    transaction_id: { type: DataTypes.STRING(255), unique: true },
    payment_date: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "payments",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

Booking.hasOne(Payment, { foreignKey: "booking_id", as: "payment" });
Payment.belongsTo(Booking, { foreignKey: "booking_id", as: "booking" });

// -- Helpers -------------------------------------------------------------------

export async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log("Connected to PostgreSQL via Sequelize");
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
