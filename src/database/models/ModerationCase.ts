import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export type ModerationAction = "BAN" | "UNBAN" | "KICK" | "TIMEOUT" | "WARN" | "PURGE" | "UNWARN";

export class ModerationCase extends Model<InferAttributes<ModerationCase>, InferCreationAttributes<ModerationCase>> {
  declare id: CreationOptional<number>;
  declare guildId: string;
  declare userId: string;
  declare moderatorId: string;
  declare action: ModerationAction;
  declare reason: string;
  declare durationSeconds: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
}

ModerationCase.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  guildId: { type: DataTypes.STRING(32), allowNull: false },
  userId: { type: DataTypes.STRING(32), allowNull: false },
  moderatorId: { type: DataTypes.STRING(32), allowNull: false },
  action: { type: DataTypes.STRING(16), allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { sequelize, tableName: "moderation_cases", updatedAt: false });
