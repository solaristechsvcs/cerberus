import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class InviteTrackingSettings extends Model<InferAttributes<InviteTrackingSettings>,InferCreationAttributes<InviteTrackingSettings>>{
 declare guildId:string;declare channelId:CreationOptional<string|null>;declare enabled:CreationOptional<boolean>;declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
InviteTrackingSettings.init({guildId:{type:DataTypes.STRING(32),primaryKey:true},channelId:{type:DataTypes.STRING(32),allowNull:true},enabled:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}},{sequelize,tableName:"invite_tracking_settings"});
