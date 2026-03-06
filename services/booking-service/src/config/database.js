import { Sequelize, DataTypes, Op } from "sequelize";

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

export const Hotel = sequelize.define(
  "Hotel",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    city: { type: DataTypes.STRING(100), allowNull: false },
    country: { type: DataTypes.STRING(100), allowNull: false },
  },
  {
    tableName: "hotels",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export const Room = sequelize.define(
  "Room",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    hotel_id: { type: DataTypes.INTEGER, allowNull: false },
    room_number: { type: DataTypes.STRING(20), allowNull: false },
    room_type: { type: DataTypes.STRING(50), allowNull: false },
    price_per_night: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    is_available: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "rooms",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export const Booking = sequelize.define(
  "Booking",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    room_id: { type: DataTypes.INTEGER, allowNull: false },
    check_in_date: { type: DataTypes.DATEONLY, allowNull: false },
    check_out_date: { type: DataTypes.DATEONLY, allowNull: false },
    total_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    num_guests: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(20), defaultValue: "pending" },
    special_requests: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "bookings",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

// Associations
Hotel.hasMany(Room, { foreignKey: "hotel_id", as: "rooms" });
Room.belongsTo(Hotel, { foreignKey: "hotel_id", as: "hotel" });
Room.hasMany(Booking, { foreignKey: "room_id", as: "bookings" });
Booking.belongsTo(Room, { foreignKey: "room_id", as: "room" });

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

export { sequelize, Op };
