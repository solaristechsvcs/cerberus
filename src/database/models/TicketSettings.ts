import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class TicketSettings extends Model<InferAttributes<TicketSettings>, InferCreationAttributes<TicketSettings>> {
  declare guildId: string;
  declare categoryId: CreationOptional<string | null>;
  declare logChannelId: CreationOptional<string | null>;
  declare staffRoleId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
TicketSettings.init({
  guildId:{type:DataTypes.STRING(32),primaryKey:true},
  categoryId:{type:DataTypes.STRING(32),allowNull:true},
  logChannelId:{type:DataTypes.STRING(32),allowNull:true},
  staffRoleId:{type:DataTypes.STRING(32),allowNull:true},
  createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
  updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"ticket_settings"});
