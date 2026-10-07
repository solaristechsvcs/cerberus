import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class ReactionRole extends Model<InferAttributes<ReactionRole>, InferCreationAttributes<ReactionRole>> {
  declare id: CreationOptional<number>;
  declare guildId: string;
  declare channelId: string;
  declare messageId: string;
  declare roleId: string;
  declare emoji: CreationOptional<string>;
  declare label: CreationOptional<string>;
  declare panelTitle: CreationOptional<string>;
  declare panelDescription: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ReactionRole.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  guildId: { type: DataTypes.STRING, allowNull: false },
  channelId: { type: DataTypes.STRING, allowNull: false },
  messageId: { type: DataTypes.STRING, allowNull: false },
  roleId: { type: DataTypes.STRING, allowNull: false },
  emoji: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
  label: { type: DataTypes.STRING, allowNull: false, defaultValue: "Role" },
  panelTitle: { type: DataTypes.STRING, allowNull: false, defaultValue: "Choose Your Roles" },
  panelDescription: { type: DataTypes.TEXT, allowNull: false, defaultValue: "Use the buttons below to add or remove roles." },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, { sequelize, tableName: "reaction_roles", indexes: [{ unique: true, fields: ["guildId", "messageId", "roleId"] }] });
