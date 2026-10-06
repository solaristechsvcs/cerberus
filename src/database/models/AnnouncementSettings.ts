import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class AnnouncementSettings extends Model<InferAttributes<AnnouncementSettings>,InferCreationAttributes<AnnouncementSettings>>{
 declare guildId:string; declare channelId:CreationOptional<string|null>; declare createdAt:CreationOptional<Date>; declare updatedAt:CreationOptional<Date>;
}
AnnouncementSettings.init({
 guildId:{type:DataTypes.STRING(32),primaryKey:true},channelId:{type:DataTypes.STRING(32),allowNull:true},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"announcement_settings"});
