import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class UserNote extends Model<InferAttributes<UserNote>, InferCreationAttributes<UserNote>> {
  declare id: CreationOptional<number>;
  declare guildId: string;
  declare userId: string;
  declare authorId: string;
  declare note: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

UserNote.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  guildId: { type: DataTypes.STRING(32), allowNull: false },
  userId: { type: DataTypes.STRING(32), allowNull: false },
  authorId: { type: DataTypes.STRING(32), allowNull: false },
  note: { type: DataTypes.TEXT, allowNull: false },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { sequelize, tableName: "user_notes" });
