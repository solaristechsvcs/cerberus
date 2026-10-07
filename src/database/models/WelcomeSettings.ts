import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class WelcomeSettings extends Model<InferAttributes<WelcomeSettings>,InferCreationAttributes<WelcomeSettings>>{
 declare guildId:string;
 declare channelId:CreationOptional<string|null>;
 declare enabled:CreationOptional<boolean>;
 declare title:CreationOptional<string>;
 declare message:CreationOptional<string>;
 declare createdAt:CreationOptional<Date>;
 declare updatedAt:CreationOptional<Date>;
}
WelcomeSettings.init({
 guildId:{type:DataTypes.STRING(32),primaryKey:true},
 channelId:{type:DataTypes.STRING(32),allowNull:true},
 enabled:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},
 title:{type:DataTypes.STRING(256),allowNull:false,defaultValue:"Welcome to {server}!"},
 message:{type:DataTypes.TEXT,allowNull:false,defaultValue:"Welcome {user}! You are member **#{memberCount}**."},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
 updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"welcome_settings"});
