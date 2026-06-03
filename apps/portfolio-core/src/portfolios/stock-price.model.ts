import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Лёгкая read-only проекция таблицы `stock_assets` (которой владеет
 * stock-data-worker). Нужна portfolio-core, чтобы оценивать акции в портфелях
 * без RPC: цена акций хранится в рублях (`currentPrice`), и здесь мы её читаем
 * по `assetId`, а конвертацию в USD делаем через FxService.
 *
 * Только подмножество колонок и БЕЗ ассоциаций — чтобы не тянуть модели
 * stock-data в этот микросервис. `sync:alter` по этому подмножеству — no-op
 * (все колонки уже существуют, ничего не добавляется и не дропается).
 */
@Table({ tableName: 'stock_assets', timestamps: true })
export class StockPrice extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare assetId: number;

  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare currentPrice: number | null;

  @Column({ type: DataType.DOUBLE, allowNull: true })
  declare dayChangePct: number | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare currency: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare logoUrl: string | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare sparkline7D: { prices?: number[] | null } | null;
}
