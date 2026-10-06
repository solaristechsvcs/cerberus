import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class DeveloperDmThread extends Model<InferAttributes<DeveloperDmThread>,InferCreationAttributes<DeveloperDmThread>>{
 declare id:CreationOptional<number>;declare userId:string;declare channelId:string;declare guildId:string;declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
DeveloperDmThread.init({id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},userId:{type:DataTypes.STRING(32),allowNull:false,unique:true},channelId:{type:DataTypes.STRING(32),allowNull:false,unique:true},guildId:{type:DataTypes.STRING(32),allowNull:false},createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}},{sequelize,tableName:"developer_dm_threads"});
