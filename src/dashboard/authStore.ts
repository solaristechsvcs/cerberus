import { DataTypes, Model, Op } from "sequelize";
import { sequelize } from "../database";
import { AuthStore, DashboardSession } from "./auth";

class DashboardAuth extends Model {
  declare data: DashboardSession | null;
}
DashboardAuth.init({
  id: { type: DataTypes.STRING(64), primaryKey: true },
  kind: { type: DataTypes.STRING(16), allowNull: false },
  data: { type: DataTypes.JSON, allowNull: true },
  expiresAt: { type: DataTypes.BIGINT, allowNull: false }
}, { sequelize, tableName: "dashboard_auth", timestamps: false, indexes: [{ fields: ["expiresAt"] }] });

export const authStore: AuthStore = {
  async put(id, kind, data, expiresAt) {
    await DashboardAuth.destroy({ where: { expiresAt: { [Op.lte]: Date.now() } } });
    await DashboardAuth.create({ id, kind, data, expiresAt });
  },
  async consumeState(id) {
    // Atomic deletion prevents two callbacks from redeeming the same state.
    return await DashboardAuth.destroy({ where: { id, kind: "state", expiresAt: { [Op.gt]: Date.now() } } }) === 1;
  },
  async getSession(id) {
    const row = await DashboardAuth.findOne({ where: { id, kind: "session", expiresAt: { [Op.gt]: Date.now() } } });
    return row?.data ?? null;
  },
  async remove(id) { await DashboardAuth.destroy({ where: { id } }); }
};
