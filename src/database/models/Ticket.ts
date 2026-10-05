import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class Ticket extends Model<InferAttributes<Ticket>, InferCreationAttributes<Ticket>> {
  declare id: CreationOptional<number>; declare guildId:string; declare channelId:string; declare userId:string;
  declare panelId:CreationOptional<number|null>; declare status:CreationOptional<"OPEN"|"CLOSED">; declare closedBy:CreationOptional<string|null>;
  declare createdAt:CreationOptional<Date>; declare updatedAt:CreationOptional<Date>;
}
Ticket.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},guildId:{type:DataTypes.STRING(32),allowNull:false},
 channelId:{type:DataTypes.STRING(32),allowNull:false,unique:true},userId:{type:DataTypes.STRING(32),allowNull:false},
 panelId:{type:DataTypes.INTEGER,allowNull:true},status:{type:DataTypes.STRING(10),allowNull:false,defaultValue:"OPEN"},
 closedBy:{type:DataTypes.STRING(32),allowNull:true},createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
 updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"tickets",indexes:[{fields:["guildId","userId","status"]}]});
