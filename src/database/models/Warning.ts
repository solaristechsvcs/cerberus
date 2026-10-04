import { DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class Warning extends Model<InferAttributes<Warning>, InferCreationAttributes<Warning>> {
  declare id: number; declare guildId: string; declare userId: string;
  declare moderatorId: string; declare reason: string; declare createdAt: Date;
}
Warning.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  guildId: { type: DataTypes.STRING(32), allowNull: false },
  userId: { type: DataTypes.STRING(32), allowNull: false },
  moderatorId: { type: DataTypes.STRING(32), allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { sequelize, tableName: "warnings", updatedAt: false });
