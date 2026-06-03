import { Column, DataType, Table, Model, BelongsToMany, ForeignKey, HasMany, Index } from "sequelize-typescript";
import { PortfolioAssets } from "../portfolio-assets/portfolio-assets.model";
import { Transaction } from "../transactions/transactions.model";
import { PortfolioType } from "../../../../libs/contracts/src/common/enums/portfolio-type.enum";
import { ApiProperty } from "@nestjs/swagger";

interface PortfolioCreationAttrs {
  name: string
  type: PortfolioType
  userId: number
  displayCurrency?: string
}

@Table({
  tableName: 'portfolios',
  // Композитный уникальный индекс — один и тот же пользователь не может
  // иметь два портфеля с одинаковым именем. Это и заменяет проверку
  // findOne+create в сервисе, и даёт быстрый поиск по имени.
  indexes: [
    {
      name: 'portfolios_user_name_unique',
      unique: true,
      fields: ['userId', 'name'],
    },
  ],
})
export class Portfolio extends Model<Portfolio, PortfolioCreationAttrs> {
  @ApiProperty({ example: 1, description: 'Уникальный идентификатор портфеля' })
  @Column({type: DataType.INTEGER, unique: true, autoIncrement: true, primaryKey: true})
  declare id: number

  @ApiProperty({ example: 'Crypto Portfolio', description: 'Название портфеля' })
  @Column({type: DataType.STRING, unique: false, allowNull: false})
  declare name: string

  @ApiProperty({ example: 'Crypto', enum: PortfolioType, description: 'Тип портфеля: Crypto, Stock или Bond' })
  @Column({type: DataType.ENUM(...Object.values(PortfolioType)), allowNull: false})
  declare type: PortfolioType

  // @ApiProperty({ type: [Asset], description: 'Список активов, связанных с портфелем', required: false })
  // @BelongsToMany(() => Asset, () => PortfolioAssets)
  // declare assets: Asset[]

  @ApiProperty({ example: 7, description: 'ID пользователя-владельца портфеля' })
  @Index('portfolios_user_id_idx')
  @Column({type: DataType.INTEGER, allowNull: false})
  declare userId: number

  // Валюта отображения стоимости портфеля: 'USD' или 'RUB'. Стоимость считается
  // внутри в USD, а в ответе конвертируется в эту валюту. По умолчанию для
  // Stock-портфелей — RUB, иначе USD (проставляется при создании).
  @ApiProperty({ example: 'USD', description: 'Валюта отображения: USD | RUB' })
  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'USD' })
  declare displayCurrency: string

  @ApiProperty({ type: [Transaction], description: 'Список транзакций, связанных с этим портфелем', required: false })
  @HasMany(() => Transaction)
  declare transactions: Transaction[]

  @ApiProperty({ type: [PortfolioAssets], description: 'Позиции в портфеле', required: false })
  @HasMany(() => PortfolioAssets)
  declare portfolioAssets: PortfolioAssets[]
}