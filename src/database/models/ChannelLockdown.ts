import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class ChannelLockdown extends Model<InferAttributes<ChannelLockdown>,InferCreationAttributes<ChannelLockdown>> {
 declare channelId:string; declare guildId:string; declare backups:CreationOptional<Array<{id:string;values:Record<string,boolean|null>}>>; declare createdAt:CreationOptional<Date>; declare updatedAt:CreationOptional<Date>;
}
ChannelLockdown.init({channelId:{type:DataTypes.STRING(32),primaryKey:true},guildId:{type:DataTypes.STRING(32),allowNull:false},backups:{type:DataTypes.JSON,allowNull:false,defaultValue:[]},createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}},{sequelize,tableName:"channel_lockdowns"});
