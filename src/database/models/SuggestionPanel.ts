import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class SuggestionPanel extends Model<InferAttributes<SuggestionPanel>, InferCreationAttributes<SuggestionPanel>> {
  declare id: CreationOptional<number>;
  declare guildId: string;
  declare title: string;
  declare description: string;
  declare buttonLabel: string;
  declare channelId: CreationOptional<string | null>;
  declare messageId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
SuggestionPanel.init({
  id: {type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},
  guildId: {type:DataTypes.STRING(32),allowNull:false},
  title: {type:DataTypes.STRING(256),allowNull:false},
  description: {type:DataTypes.TEXT,allowNull:false},
  buttonLabel: {type:DataTypes.STRING(80),allowNull:false},
  channelId: {type:DataTypes.STRING(32),allowNull:true},
  messageId: {type:DataTypes.STRING(32),allowNull:true},
  createdAt: {type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
  updatedAt: {type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
}, { sequelize, tableName: "suggestion_panels", indexes: [{"fields":["guildId"]}] });
