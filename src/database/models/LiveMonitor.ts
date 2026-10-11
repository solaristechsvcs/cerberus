import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export type LivePlatform="twitch"|"youtube"|"tiktok";
export class LiveMonitor extends Model<InferAttributes<LiveMonitor>,InferCreationAttributes<LiveMonitor>> {
 declare id:CreationOptional<number>;declare guildId:string;declare platform:LivePlatform;declare sourceId:string;declare displayName:string;
 declare channelId:string;declare mentionRoleId:CreationOptional<string|null>;declare messageTemplate:CreationOptional<string>;declare enabled:CreationOptional<boolean>;
 declare lastCheckedAt:CreationOptional<Date|null>;declare lastError:CreationOptional<string|null>;
 declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
LiveMonitor.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},guildId:{type:DataTypes.STRING(32),allowNull:false},
 platform:{type:DataTypes.STRING(10),allowNull:false},sourceId:{type:DataTypes.STRING(100),allowNull:false},displayName:{type:DataTypes.STRING(100),allowNull:false},
 channelId:{type:DataTypes.STRING(32),allowNull:false},mentionRoleId:{type:DataTypes.STRING(32),allowNull:true},
 messageTemplate:{type:DataTypes.TEXT,allowNull:false,defaultValue:"{creator} is live on {platform}! {url}"},enabled:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},
 lastCheckedAt:{type:DataTypes.DATE,allowNull:true},lastError:{type:DataTypes.TEXT,allowNull:true},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"live_monitors",indexes:[{unique:true,fields:["guildId","platform","sourceId"]}]});

export class LiveDelivery extends Model<InferAttributes<LiveDelivery>,InferCreationAttributes<LiveDelivery>> {
 declare id:CreationOptional<number>;declare monitorId:number;declare streamId:string;declare channelId:string;
 declare messageId:CreationOptional<string|null>;declare sentAt:CreationOptional<Date|null>;
 declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
LiveDelivery.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},monitorId:{type:DataTypes.INTEGER,allowNull:false},streamId:{type:DataTypes.STRING(128),allowNull:false},
 channelId:{type:DataTypes.STRING(32),allowNull:false},messageId:{type:DataTypes.STRING(32),allowNull:true},sentAt:{type:DataTypes.DATE,allowNull:true},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"live_deliveries",indexes:[{unique:true,fields:["monitorId","streamId"]}]});

export class LiveProviderState extends Model<InferAttributes<LiveProviderState>,InferCreationAttributes<LiveProviderState>> {
 declare key:string;declare data:CreationOptional<Record<string,unknown>>;
 declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
LiveProviderState.init({
 key:{type:DataTypes.STRING(128),primaryKey:true},data:{type:DataTypes.JSON,allowNull:false,defaultValue:{}},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"live_provider_state"});
