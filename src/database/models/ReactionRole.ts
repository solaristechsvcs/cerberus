import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class ReactionRole extends Model<InferAttributes<ReactionRole>, InferCreationAttributes<ReactionRole>> {
  declare id: CreationOptional<number>;
  declare guildId: string;
  declare channelId: string;
  declare messageId: string;
  declare roleId: string;
  declare emoji: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ReactionRole.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  guildId: { type: DataTypes.STRING, allowNull: false },
  channelId: { type: DataTypes.STRING, allowNull: false },
  messageId: { type: DataTypes.STRING, allowNull: false },
  roleId: { type: DataTypes.STRING, allowNull: false },
  emoji: { type: DataTypes.STRING, allowNull: false },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, { sequelize, tableName: "reaction_roles", indexes: [{ unique: true, fields: ["guildId", "messageId", "emoji"] }] });
