import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class TicketTranscript extends Model<InferAttributes<TicketTranscript>, InferCreationAttributes<TicketTranscript>> {
  declare id: CreationOptional<number>;
  declare ticketId: number;
  declare guildId: string;
  declare userId: string;
  declare closedBy: string;
  declare channelName: string;
  declare accessToken: string;
  declare html: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

TicketTranscript.init({
  id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},
  ticketId:{type:DataTypes.INTEGER,allowNull:false},
  guildId:{type:DataTypes.STRING(32),allowNull:false},
  userId:{type:DataTypes.STRING(32),allowNull:false},
  closedBy:{type:DataTypes.STRING(32),allowNull:false},
  channelName:{type:DataTypes.STRING(100),allowNull:false},
  accessToken:{type:DataTypes.STRING(64),allowNull:false,unique:true},
  html:{type:DataTypes.TEXT("long"),allowNull:false},
  createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
  updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"ticket_transcripts",indexes:[{fields:["guildId"]},{unique:true,fields:["ticketId"]}]});
