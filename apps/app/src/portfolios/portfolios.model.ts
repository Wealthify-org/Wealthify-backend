import { Column, DataType, Table, Model, BelongsToMany, ForeignKey, HasMany } from "sequelize-typescript";
import { Asset } from "@app/assets/assets.model";
import { PortfolioAssets } from "@app/assets/portfolio-assets.model";
import { Transaction } from "@app/transactions/transactions.model";
import { User } from "@app/users/users.model";
import { PortfolioType } from "../../../../libs/contracts/src/common/enums/portfolio-type.enum";
import { ApiProperty } from "@nestjs/swagger";

interface PortfolioCreationAttrs {
  name: string
  type: PortfolioType
  userId: number 
}

@Table({tableName: 'portfolios'}) 
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

  @ApiProperty({ type: [Asset], description: 'Список активов, связанных с портфелем', required: false })
  @BelongsToMany(() => Asset, () => PortfolioAssets)
  declare assets: Asset[]

  @ApiProperty({ example: 7, description: 'ID пользователя-владельца портфеля' })
  @ForeignKey(() => User)
  @Column({type: DataType.INTEGER, allowNull: false})
  declare userId: number

  @ApiProperty({ type: [Transaction], description: 'Список транзакций, связанных с этим портфелем', required: false })
  @HasMany(() => Transaction)
  declare transactions: Transaction[]
}