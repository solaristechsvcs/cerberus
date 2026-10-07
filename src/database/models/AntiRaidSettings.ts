import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class AntiRaidSettings extends Model<InferAttributes<AntiRaidSettings>,InferCreationAttributes<AntiRaidSettings>>{
 declare guildId:string;declare enabled:CreationOptional<boolean>;declare joinThreshold:CreationOptional<number>;declare windowSeconds:CreationOptional<number>;declare action:CreationOptional<"none"|"kick"|"ban">;declare alertChannelId:CreationOptional<string|null>;declare lockdownMinutes:CreationOptional<number>;declare activeUntil:CreationOptional<Date|null>;declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
AntiRaidSettings.init({
 guildId:{type:DataTypes.STRING(32),primaryKey:true},enabled:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:false},joinThreshold:{type:DataTypes.INTEGER,allowNull:false,defaultValue:8},windowSeconds:{type:DataTypes.INTEGER,allowNull:false,defaultValue:20},action:{type:DataTypes.ENUM("none","kick","ban"),allowNull:false,defaultValue:"kick"},alertChannelId:{type:DataTypes.STRING(32),allowNull:true},lockdownMinutes:{type:DataTypes.INTEGER,allowNull:false,defaultValue:10},activeUntil:{type:DataTypes.DATE,allowNull:true},createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"anti_raid_settings"});
