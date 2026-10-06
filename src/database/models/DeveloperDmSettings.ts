import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class DeveloperDmSettings extends Model<InferAttributes<DeveloperDmSettings>,InferCreationAttributes<DeveloperDmSettings>>{
 declare id:CreationOptional<number>;declare guildId:CreationOptional<string|null>;declare categoryId:CreationOptional<string|null>;declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
DeveloperDmSettings.init({id:{type:DataTypes.INTEGER,primaryKey:true,defaultValue:1},guildId:{type:DataTypes.STRING(32),allowNull:true},categoryId:{type:DataTypes.STRING(32),allowNull:true},createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}},{sequelize,tableName:"developer_dm_settings"});
