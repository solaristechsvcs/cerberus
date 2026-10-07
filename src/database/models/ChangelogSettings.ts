import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class ChangelogSettings extends Model<InferAttributes<ChangelogSettings>,InferCreationAttributes<ChangelogSettings>>{
 declare guildId:string;declare channelId:CreationOptional<string|null>;declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
ChangelogSettings.init({guildId:{type:DataTypes.STRING(32),primaryKey:true},channelId:{type:DataTypes.STRING(32),allowNull:true},createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}},{sequelize,tableName:"changelog_settings"});
