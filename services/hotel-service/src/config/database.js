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
    description: { type: DataTypes.TEXT, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: false },
    city: { type: DataTypes.STRING(100), allowNull: false },
    country: { type: DataTypes.STRING(100), allowNull: false },
    rating: { type: DataTypes.DECIMAL(2, 1), defaultValue: 0.0 },
    amenities: { type: DataTypes.JSONB, allowNull: true },
    images: { type: DataTypes.JSONB, allowNull: true },
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
    hotel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "hotels", key: "id" },
    },
    room_number: { type: DataTypes.STRING(20), allowNull: false },
    room_type: { type: DataTypes.STRING(50), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    price_per_night: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    capacity: { type: DataTypes.INTEGER, allowNull: false },
    amenities: { type: DataTypes.JSONB, allowNull: true },
    images: { type: DataTypes.JSONB, allowNull: true },
    is_available: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "rooms",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ unique: true, fields: ["hotel_id", "room_number"] }],
  },
);

// Associations
Hotel.hasMany(Room, {
  foreignKey: "hotel_id",
  as: "rooms",
  onDelete: "CASCADE",
});
Room.belongsTo(Hotel, { foreignKey: "hotel_id", as: "hotel" });

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
