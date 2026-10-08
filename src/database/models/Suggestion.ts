import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class Suggestion extends Model<InferAttributes<Suggestion>, InferCreationAttributes<Suggestion>> {
  declare id: CreationOptional<number>;
  declare guildId: string;
  declare userId: string;
  declare channelId: string;
  declare logChannelId: string;
  declare title: string;
  declare content: string;
  declare staffRoleIds: string[];
  declare status: CreationOptional<"OPEN" | "CLOSED">;
  declare outcome: CreationOptional<"IMPLEMENTED" | "NOT_IMPLEMENTED" | null>;
  declare closeReason: CreationOptional<string | null>;
  declare closedBy: CreationOptional<string | null>;
  declare closedAt: CreationOptional<Date | null>;
  declare logMessageId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
Suggestion.init({
  id: {type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},
  guildId: {type:DataTypes.STRING(32),allowNull:false},
  userId: {type:DataTypes.STRING(32),allowNull:false},
  channelId: {type:DataTypes.STRING(32),allowNull:false},
  logChannelId: {type:DataTypes.STRING(32),allowNull:false},
  title: {type:DataTypes.STRING(100),allowNull:false},
  content: {type:DataTypes.TEXT,allowNull:false},
  staffRoleIds: {type:DataTypes.JSON,allowNull:false},
  status: {type:DataTypes.STRING(10),allowNull:false,defaultValue:"OPEN"},
  outcome: {type:DataTypes.STRING(20),allowNull:true},
  closeReason: {type:DataTypes.TEXT,allowNull:true},
  closedBy: {type:DataTypes.STRING(32),allowNull:true},
  closedAt: {type:DataTypes.DATE,allowNull:true},
  logMessageId: {type:DataTypes.STRING(32),allowNull:true},
  createdAt: {type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
  updatedAt: {type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
}, { sequelize, tableName: "suggestions", indexes: [{"unique":true,"fields":["channelId"]},{"fields":["guildId","status"]}] });
