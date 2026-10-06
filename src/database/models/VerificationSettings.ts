import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class VerificationSettings extends Model<InferAttributes<VerificationSettings>,InferCreationAttributes<VerificationSettings>>{
 declare guildId:string; declare roleId:CreationOptional<string|null>; declare createdAt:CreationOptional<Date>; declare updatedAt:CreationOptional<Date>;
}
VerificationSettings.init({
 guildId:{type:DataTypes.STRING(32),primaryKey:true},
 roleId:{type:DataTypes.STRING(32),allowNull:true},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
 updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"verification_settings"});
