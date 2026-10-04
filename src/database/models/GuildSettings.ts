import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class GuildSettings extends Model<InferAttributes<GuildSettings>, InferCreationAttributes<GuildSettings>> {
  declare guildId: string;
  declare modLogChannelId: CreationOptional<string | null>;
  declare eventLogChannels: CreationOptional<Record<string, string | null>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

GuildSettings.init({
  guildId: { type: DataTypes.STRING(32), primaryKey: true },
  modLogChannelId: { type: DataTypes.STRING(32), allowNull: true },
  eventLogChannels: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { sequelize, tableName: "guild_settings" });
