import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class SuggestionSettings extends Model<InferAttributes<SuggestionSettings>, InferCreationAttributes<SuggestionSettings>> {
  declare guildId: string;
  declare channelId: CreationOptional<string | null>;
  declare categoryId: CreationOptional<string | null>;
  declare logChannelId: CreationOptional<string | null>;
  declare staffRoleIds: CreationOptional<string[]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
SuggestionSettings.init({
  guildId: {type:DataTypes.STRING(32),primaryKey:true},
  channelId: {type:DataTypes.STRING(32),allowNull:true},
  categoryId: {type:DataTypes.STRING(32),allowNull:true},
  logChannelId: {type:DataTypes.STRING(32),allowNull:true},
  staffRoleIds: {type:DataTypes.JSON,allowNull:false,defaultValue:[]},
  createdAt: {type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
  updatedAt: {type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
}, { sequelize, tableName: "suggestion_settings", indexes: [] });
