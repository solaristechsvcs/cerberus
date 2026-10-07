import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class DeveloperDmLog extends Model<InferAttributes<DeveloperDmLog>,InferCreationAttributes<DeveloperDmLog>>{
 declare id:CreationOptional<number>;
 declare userId:string;
 declare username:CreationOptional<string|null>;
 declare actorId:CreationOptional<string|null>;
 declare actorName:CreationOptional<string|null>;
 declare type:"incoming"|"reply"|"closed";
 declare content:string;
 declare attachments:CreationOptional<string|null>;
 declare channelId:CreationOptional<string|null>;
 declare guildId:CreationOptional<string|null>;
 declare createdAt:CreationOptional<Date>;
 declare updatedAt:CreationOptional<Date>;
}
DeveloperDmLog.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},
 userId:{type:DataTypes.STRING(32),allowNull:false},
 username:{type:DataTypes.STRING(100),allowNull:true},
 actorId:{type:DataTypes.STRING(32),allowNull:true},
 actorName:{type:DataTypes.STRING(100),allowNull:true},
 type:{type:DataTypes.ENUM("incoming","reply","closed"),allowNull:false},
 content:{type:DataTypes.TEXT,allowNull:false},
 attachments:{type:DataTypes.TEXT,allowNull:true},
 channelId:{type:DataTypes.STRING(32),allowNull:true},
 guildId:{type:DataTypes.STRING(32),allowNull:true},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
 updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"developer_dm_logs",indexes:[{fields:["userId"]},{fields:["createdAt"]}]});
